"""CLI: circular route generator (origin + targets -> closed loop).

Usage (from the repo root):
    python -m tools.loop_cli LAT LON --distance-km 60 [--gain-m 1200] [options]
"""

import argparse
import sys
from pathlib import Path
from urllib.error import URLError

from app.engine.client import RouteError, ValhallaError, fetch_trace_attributes
from app.engine.dem import DemSource
from app.engine.loop import (
    GOLDEN_ANGLE_DEG,
    GeneratedLoop,
    LoopRequest,
    build_route_payload,
    climb_anchors,
    generate_loop,
)
from app.engine.polyline import decode, encode
from app.engine.scoring import RouteScore, score_edges
from tools.valhalla import post_json


def make_route_fn(
    base_url: str,
    costing_options: dict | None = None,
    avoid_locations: list[tuple[float, float]] | None = None,
):
    """Return a route_fn for generate_loop backed by Valhalla's /route."""

    def route_fn(locations: list[tuple[float, float]]):
        data = post_json(
            f"{base_url}/route",
            build_route_payload(locations, costing_options, avoid_locations),
        )
        coords: list[tuple[float, float]] = []
        for leg in data["trip"]["legs"]:
            leg_coords = decode(leg["shape"])
            if coords and leg_coords and leg_coords[0] == coords[-1]:
                leg_coords = leg_coords[1:]
            coords.extend(leg_coords)
        distance_km = float(data["trip"]["summary"]["length"])
        return coords, distance_km

    return route_fn


def _surface_breakdown(score: RouteScore) -> str:
    items = sorted(score.surface_km.items(), key=lambda kv: -kv[1])
    return ", ".join(
        f"{km / score.total_km:.0%} {name or 'unknown'}" for name, km in items[:3]
    )


def _score_route(args, loop: GeneratedLoop, costing_options: dict) -> None:
    """Fetch trace attributes for the loop and print its quality line."""
    try:
        edges = fetch_trace_attributes(
            args.base_url, encode(loop.coords), costing_options
        )
        score = score_edges(edges)
    except (RouteError, ValhallaError) as exc:
        print(f"    quality: unavailable ({exc})")
        return
    print(
        f"    quality: comfort {score.comfort:.0f}/100 | "
        f"paved {score.paved_share:.0%} ({_surface_breakdown(score)}) | "
        f"climb load {score.climb_load_m:.0f} m | "
        f"max grade +{score.max_grade_pct:.1f}%"
    )


def _progress_printer():
    def progress(attempt: GeneratedLoop) -> None:
        print(
            f"    iter {attempt.iterations}: {attempt.distance_km:.1f} km, "
            f"D+ {attempt.gain_m:.0f} m, h {attempt.hilliness:.2f}, "
            f"s {attempt.stretch:.2f}, "
            f"summit {'on' if attempt.summit_used else 'off'}"
        )

    return progress


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="tools.loop_cli", description=__doc__)
    parser.add_argument("origin", nargs=2, type=float, metavar=("LAT", "LON"))
    parser.add_argument("--distance-km", type=float, required=True)
    parser.add_argument("--gain-m", type=float, default=None)
    parser.add_argument("--routes", type=int, default=1,
                        help="generate several distinct loops, each avoiding "
                             "the climbs used by the previous ones")
    parser.add_argument("--waypoints", type=int, default=10)
    parser.add_argument("--iterations", type=int, default=8)
    parser.add_argument("--tolerance", type=float, default=0.05)
    parser.add_argument("--gain-tolerance", type=float, default=0.20)
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--use-hills", type=float, default=None)
    parser.add_argument("--avoid-bad-surfaces", type=float, default=None)
    parser.add_argument("--bicycle-type", default=None)
    parser.add_argument("--base-url", default="http://localhost:8002")
    default_dir = Path(__file__).resolve().parents[1] / "valhalla" / "elevation"
    parser.add_argument("--elevation-dir", type=Path, default=default_dir)
    args = parser.parse_args(argv)

    costing_options: dict = {}
    if args.use_hills is not None:
        costing_options["use_hills"] = args.use_hills
    if args.avoid_bad_surfaces is not None:
        costing_options["avoid_bad_surfaces"] = args.avoid_bad_surfaces
    if args.bicycle_type is not None:
        costing_options["bicycle_type"] = args.bicycle_type

    origin = (args.origin[0], args.origin[1])
    targets = f"{args.distance_km} km"
    if args.gain_m is not None:
        targets += f" / {args.gain_m:.0f} m D+"
    print(f"Generating up to {args.routes} loop(s) from {origin} targeting {targets} ...")

    dem = DemSource(args.elevation_dir)

    def route_fn_with(avoid_locations):
        return make_route_fn(args.base_url, costing_options, avoid_locations)

    routes: list[GeneratedLoop] = []
    avoided: list[tuple[float, float]] = []
    max_attempts = max(args.routes * 3, 3)
    for attempt in range(max_attempts):
        if len(routes) >= args.routes:
            break
        request = LoopRequest(
            origin=origin,
            target_km=args.distance_km,
            target_gain_m=args.gain_m,
            tolerance=args.tolerance,
            gain_tolerance=args.gain_tolerance,
            waypoint_count=args.waypoints,
            max_iterations=args.iterations,
            seed_offset_deg=GOLDEN_ANGLE_DEG * attempt,
        )
        try:
            loop = generate_loop(
                route_fn_with(avoided),
                dem,
                request,
                progress=_progress_printer() if args.verbose else None,
            )
        except RouteError as exc:
            print(f"  attempt {attempt}: routing failed ({exc}), skipping")
            continue
        except URLError as exc:
            print(f"Cannot reach Valhalla at {args.base_url}: {exc.reason}")
            return 1

        label = f"route {len(routes)}"
        if loop.infeasible or not (loop.distance_ok and loop.gain_ok):
            print(
                f"  attempt {attempt}: no loop meeting {targets} "
                f"(best {loop.distance_km:.1f} km / {loop.gain_m:.0f} m D+)"
            )
            continue
        anchors = climb_anchors(dem, loop.coords)
        avoided.extend(anchors)
        routes.append(loop)
        print(
            f"  {label}: {loop.distance_km:.1f} km, D+ {loop.gain_m:.0f} m, "
            f"loss {loop.loss_m:.0f} m "
            f"(h {loop.hilliness:.2f}, s {loop.stretch:.2f}, "
            f"{loop.iterations} iters, {len(anchors)} climb(s) banned)"
        )
        _score_route(args, loop, costing_options)

    if not routes:
        print(
            f"INFEASIBLE: no loop meeting {targets} could be generated "
            f"in {max_attempts} attempts."
        )
        return 2

    print(f"\n{len(routes)} route(s) generated:")
    for i, r in enumerate(routes):
        print(
            f"  [{i}] {r.distance_km:.2f} km | Gain: {r.gain_m:.0f} m | "
            f"Loss: {r.loss_m:.0f} m"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
