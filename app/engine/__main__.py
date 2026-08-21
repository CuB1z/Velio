"""CLI: elevation profile for a route, validated against Valhalla's /height.

Usage (from the repo root):
    python -m app.engine LAT1 LON1 LAT2 LON2 [options]
"""

import argparse
import json
import math
import sys
from pathlib import Path
from urllib import request as url_request
from urllib.error import URLError

from .dem import DemSource
from .elevation import build_profile
from .models import ProfileSample


def _post_json(url: str, payload: dict) -> dict:
    req = url_request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    with url_request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def fetch_route_shape(base_url: str, coords: list[tuple[float, float]]) -> str:
    """Request a bicycle route and return its encoded polyline."""
    data = _post_json(
        f"{base_url}/route",
        {
            "locations": [{"lat": la, "lon": lo} for la, lo in coords],
            "costing": "bicycle",
        },
    )
    return data["trip"]["legs"][0]["shape"]


def fetch_heights(
    base_url: str, lats: list[float], lons: list[float], chunk_size: int = 500
) -> list[float | None]:
    """Query /height for every sample point, in chunks."""
    heights: list[float | None] = []
    for start in range(0, len(lats), chunk_size):
        chunk_lats = lats[start : start + chunk_size]
        chunk_lons = lons[start : start + chunk_size]
        data = _post_json(
            f"{base_url}/height",
            {"shape": [{"lat": la, "lon": lo} for la, lo in zip(chunk_lats, chunk_lons)]},
        )
        heights.extend(data["height"])
    return heights


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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="app.engine", description=__doc__)
    parser.add_argument(
        "coords", nargs=4, type=float, metavar=("LAT1", "LON1", "LAT2", "LON2")
    )
    parser.add_argument("--base-url", default="http://localhost:8002")
    default_dir = Path(__file__).resolve().parents[2] / "valhalla" / "elevation"
    parser.add_argument("--elevation-dir", type=Path, default=default_dir)
    parser.add_argument("--no-validate", action="store_true")
    args = parser.parse_args(argv)

    waypoints = [
        (args.coords[0], args.coords[1]),
        (args.coords[2], args.coords[3]),
    ]

    print(f"Route: {waypoints[0]} -> {waypoints[1]}")
    try:
        encoded = fetch_route_shape(args.base_url, waypoints)
    except URLError as exc:
        print(f"Cannot reach Valhalla at {args.base_url}: {exc.reason}")
        return 1

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
        heights = fetch_heights(args.base_url, lats, lons)
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
    return 0


if __name__ == "__main__":
    sys.exit(main())
