"""CLI: circular route generator (origin + targets -> closed loop).

Usage (from the repo root):
    python -m tools.loop_cli LAT LON --distance-km 60 [--gain-m 1200] [options]
"""

import argparse
import asyncio
import sys
from pathlib import Path

from app.clients.valhalla import RouteError, ValhallaClient, ValhallaError
from app.engine.dem import DemSource
from app.engine.elevation import build_profile
from app.engine.gpx import build_gpx
from app.engine.loop import (
    GOLDEN_ANGLE_DEG,
    GeneratedLoop,
    LoopRequest,
    ProgressFn,
    climb_anchors,
    generate_loop,
)
from app.engine.polyline import encode
from app.engine.scoring import RouteScore, score_edges


def _costing_options(args) -> dict:
    options: dict = {}
    if args.use_hills is not None:
        options["use_hills"] = args.use_hills
    if args.avoid_bad_surfaces is not None:
        options["avoid_bad_surfaces"] = args.avoid_bad_surfaces
    if args.bicycle_type is not None:
        options["bicycle_type"] = args.bicycle_type
    return options


def _targets(args) -> str:
    text = f"{args.distance_km} km"
    if args.gain_m is not None:
        text += f" / {args.gain_m:.0f} m D+"
    return text


def _surface_breakdown(score: RouteScore) -> str:
    items = sorted(score.surface_km.items(), key=lambda kv: -kv[1])
    return ", ".join(
        f"{km / score.total_km:.0%} {name or 'unknown'}" for name, km in items[:3]
    )


def _print_quality(score: RouteScore) -> None:
    print(
        f"    quality: comfort {score.comfort:.0f}/100 | "
        f"paved {score.paved_share:.0%} ({_surface_breakdown(score)}) | "
        f"climb load {score.climb_load_m:.0f} m | "
        f"max grade +{score.max_grade_pct:.1f}%"
    )


def _write_gpx(args, dem, loop: GeneratedLoop, index: int,
               score: RouteScore | None) -> None:
    profile = build_profile(dem, loop.coords)
    suffix = "" if args.routes == 1 else f"_{index}"
    path = Path(f"{args.gpx}{suffix}.gpx")
    description = (
        f"{loop.distance_km:.1f} km, {loop.gain_m:.0f} m D+"
        + (f", comfort {score.comfort:.0f}/100" if score else "")
    )
    path.write_text(
        build_gpx(profile.samples, name=path.stem, description=description),
        encoding="utf-8",
    )
    print(f"    gpx: written to {path}")


def _progress_printer() -> ProgressFn:
    def progress(attempt: GeneratedLoop) -> None:
        print(
            f"    iter {attempt.iterations}: {attempt.distance_km:.1f} km, "
            f"D+ {attempt.gain_m:.0f} m, h {attempt.hilliness:.2f}, "
            f"s {attempt.stretch:.2f}, "
            f"summit {'on' if attempt.summit_used else 'off'}"
        )

    return progress


def _request(args, attempt: int) -> LoopRequest:
    return LoopRequest(
        origin=(args.origin[0], args.origin[1]),
        target_km=args.distance_km,
        target_gain_m=args.gain_m,
        tolerance=args.tolerance,
        gain_tolerance=args.gain_tolerance,
        waypoint_count=args.waypoints,
        max_iterations=args.iterations,
        seed_offset_deg=GOLDEN_ANGLE_DEG * attempt,
        via_points=tuple((v[0], v[1]) for v in args.via) if args.via else (),
    )


async def _score(client: ValhallaClient, loop: GeneratedLoop,
                 costing_options: dict) -> RouteScore | None:
    try:
        edges = await client.trace_attributes(encode(loop.coords), costing_options)
        score = score_edges(edges)
    except ValhallaError as exc:
        print(f"    quality: unavailable ({exc})")
        return None
    _print_quality(score)
    return score


async def _generate(args, client: ValhallaClient, dem: DemSource,
                    costing_options: dict) -> list[GeneratedLoop]:
    routes: list[GeneratedLoop] = []
    avoided: list[tuple[float, float]] = []
    max_attempts = max(args.routes * 3, 3)
    for attempt in range(max_attempts):
        if len(routes) >= args.routes:
            break
        try:
            loop = await generate_loop(
                client,
                dem,
                _request(args, attempt),
                costing_options=costing_options or None,
                avoid_locations=avoided or None,
                progress=_progress_printer() if args.verbose else None,
            )
        except RouteError as exc:
            print(f"  attempt {attempt}: routing failed ({exc}), skipping")
            continue

        if loop.infeasible or not (loop.distance_ok and loop.gain_ok):
            print(
                f"  attempt {attempt}: no loop meeting {_targets(args)} "
                f"(best {loop.distance_km:.1f} km / {loop.gain_m:.0f} m D+)"
            )
            continue
        anchors = climb_anchors(dem, loop.coords)
        avoided.extend(anchors)
        routes.append(loop)
        print(
            f"  route {len(routes)}: {loop.distance_km:.1f} km, "
            f"D+ {loop.gain_m:.0f} m, loss {loop.loss_m:.0f} m "
            f"(h {loop.hilliness:.2f}, s {loop.stretch:.2f}, "
            f"{loop.iterations} iters, {len(anchors)} climb(s) banned)"
        )
        score = await _score(client, loop, costing_options or {})
        if args.gpx:
            _write_gpx(args, dem, loop, len(routes) - 1, score)
    return routes


async def _run(args) -> int:
    origin = (args.origin[0], args.origin[1])
    print(
        f"Generating up to {args.routes} loop(s) from {origin} "
        f"targeting {_targets(args)} ..."
    )

    dem = DemSource(args.elevation_dir)
    client = ValhallaClient(args.base_url)
    try:
        routes = await _generate(args, client, dem, _costing_options(args))
    except ValhallaError:
        print(f"Cannot reach Valhalla at {args.base_url}.")
        return 1
    finally:
        await client.aclose()

    if not routes:
        print(
            f"INFEASIBLE: no loop meeting {_targets(args)} could be "
            f"generated in the available attempts."
        )
        return 2

    print(f"\n{len(routes)} route(s) generated:")
    for i, r in enumerate(routes):
        print(
            f"  [{i}] {r.distance_km:.2f} km | Gain: {r.gain_m:.0f} m | "
            f"Loss: {r.loss_m:.0f} m"
        )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="tools.loop_cli", description=__doc__)
    parser.add_argument("origin", nargs=2, type=float, metavar=("LAT", "LON"))
    parser.add_argument("--distance-km", type=float, required=True)
    parser.add_argument("--gain-m", type=float, default=None)
    parser.add_argument("--routes", type=int, default=1,
                        help="generate several distinct loops, each avoiding "
                             "the climbs used by the previous ones")
    parser.add_argument("--via", nargs=2, type=float, metavar=("LAT", "LON"),
                        action="append", default=None,
                        help="point every generated loop must pass through; "
                             "repeat for several waypoints")
    parser.add_argument("--waypoints", type=int, default=10)
    parser.add_argument("--iterations", type=int, default=8)
    parser.add_argument("--tolerance", type=float, default=0.05)
    parser.add_argument("--gain-tolerance", type=float, default=0.20)
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--gpx", metavar="PREFIX", default=None,
                        help="write each route to PREFIX.gpx (PREFIX_N.gpx "
                             "with --routes N > 1) with DEM elevation data")
    parser.add_argument("--use-hills", type=float, default=None)
    parser.add_argument("--avoid-bad-surfaces", type=float, default=None)
    parser.add_argument("--bicycle-type", default=None)
    parser.add_argument("--base-url", default="http://localhost:8002")
    default_dir = Path(__file__).resolve().parents[1] / "valhalla" / "elevation"
    parser.add_argument("--elevation-dir", type=Path, default=default_dir)
    return asyncio.run(_run(parser.parse_args(argv)))


if __name__ == "__main__":
    sys.exit(main())
