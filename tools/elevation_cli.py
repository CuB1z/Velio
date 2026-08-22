"""CLI: elevation profile for a route, validated against Valhalla's /height.

Usage (from the repo root):
    python -m tools.elevation_cli LAT1 LON1 LAT2 LON2 [options]
"""

import argparse
import asyncio
import math
import sys
from pathlib import Path

from app.clients.valhalla import ValhallaClient, ValhallaError
from app.engine.dem import DemSource
from app.engine.elevation import build_profile
from app.engine.models import ProfileSample


def compare_heights(
    samples: list[ProfileSample], heights: list[float | None]
) -> dict:
    """Deviation stats between engine elevations and /height ground truth."""
    diffs = [
        s.elevation_m - h for s, h in zip(samples, heights) if h is not None
    ]
    if not diffs:
        return {"count": 0}
    n = len(diffs)
    return {
        "count": n,
        "mae_m": sum(abs(d) for d in diffs) / n,
        "rmse_m": math.sqrt(sum(d * d for d in diffs) / n),
        "max_diff_m": max(abs(d) for d in diffs),
    }


async def _run(args) -> int:
    waypoints = [
        (args.coords[0], args.coords[1]),
        (args.coords[2], args.coords[3]),
    ]
    client = ValhallaClient(args.base_url)
    try:
        print(f"Route: {waypoints[0]} -> {waypoints[1]}")
        encoded = await client.route_shape(waypoints)

        dem = DemSource(args.elevation_dir)
        profile = build_profile(dem, encoded)
        print(f"Encoded polyline length: {len(encoded)} chars")
        print(
            f"Distance: {profile.distance_km:.2f} km | "
            f"Gain: {profile.gain_m:.0f} m | Loss: {profile.loss_m:.0f} m | "
            f"Max up: {profile.max_uphill_grade_pct:.1f}% | "
            f"Max down: {profile.max_downhill_grade_pct:.1f}%"
        )

        if not args.no_validate:
            lats = [s.lat for s in profile.samples]
            lons = [s.lon for s in profile.samples]
            print(f"Validating {len(lats)} samples against {args.base_url}/height ...")
            heights = await client.heights(lats, lons)
            stats = compare_heights(profile.samples, heights)
            if stats["count"] == 0:
                print("No /height coverage to validate against.")
            else:
                print(
                    f"Compared {stats['count']} points | "
                    f"MAE: {stats['mae_m']:.2f} m | "
                    f"RMSE: {stats['rmse_m']:.2f} m | "
                    f"Max diff: {stats['max_diff_m']:.2f} m"
                )
    except ValhallaError as exc:
        print(f"Cannot reach Valhalla at {args.base_url}: {exc}")
        return 1
    finally:
        await client.aclose()
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="tools.elevation_cli", description=__doc__)
    parser.add_argument(
        "coords", nargs=4, type=float, metavar=("LAT1", "LON1", "LAT2", "LON2")
    )
    parser.add_argument("--base-url", default="http://localhost:8002")
    default_dir = Path(__file__).resolve().parents[1] / "valhalla" / "elevation"
    parser.add_argument("--elevation-dir", type=Path, default=default_dir)
    parser.add_argument("--no-validate", action="store_true")
    return asyncio.run(_run(parser.parse_args(argv)))


if __name__ == "__main__":
    sys.exit(main())
