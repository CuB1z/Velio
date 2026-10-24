"""Build the covered-regions GeoJSON from the Geofabrik boundary polygons
(data/<region>.poly) of the regions in the routing graph.

Usage (from the repo root):
    python -m tools.build_coverage spain portugal andorra \\
        [--out data/coverage.geojson] [--tolerance 0.002]
"""

import argparse
import json
from pathlib import Path

Ring = list[tuple[float, float]]
Polygon = list[Ring]

PRECISION = 4


def parse_poly(text: str) -> list[Polygon]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    polygons: list[Polygon] = []
    index = 1
    while index < len(lines) and lines[index] != "END":
        is_hole = lines[index].startswith("!")
        index += 1
        ring: Ring = []
        while lines[index] != "END":
            lon, lat = lines[index].split()[:2]
            ring.append((float(lon), float(lat)))
            index += 1
        index += 1
        if ring[0] != ring[-1]:
            ring.append(ring[0])
        if is_hole:
            polygons[-1].append(ring)
        else:
            polygons.append([ring])
    return polygons


def _distance(
    point: tuple[float, float], start: tuple[float, float], end: tuple[float, float]
) -> float:
    (x, y), (x1, y1), (x2, y2) = point, start, end
    dx, dy = x2 - x1, y2 - y1
    if dx == dy == 0:
        return ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
    return abs(dy * x - dx * y + x2 * y1 - y2 * x1) / (dx * dx + dy * dy) ** 0.5


def simplify(ring: Ring, tolerance: float) -> Ring:
    if len(ring) <= 4:
        return ring
    keep = [False] * len(ring)
    keep[0] = keep[-1] = True
    stack = [(0, len(ring) - 1)]
    while stack:
        first, last = stack.pop()
        farthest, index = 0.0, first
        for i in range(first + 1, last):
            d = _distance(ring[i], ring[first], ring[last])
            if d > farthest:
                farthest, index = d, i
        if farthest > tolerance:
            keep[index] = True
            stack += [(first, index), (index, last)]
    out = [point for point, kept in zip(ring, keep, strict=True) if kept]
    return out if len(out) >= 4 else ring


def region_feature(
    key: str, region: dict, polygons: list[Polygon], tolerance: float
) -> dict:
    coordinates = [
        [
            [
                [round(lon, PRECISION), round(lat, PRECISION)]
                for lon, lat in simplify(ring, tolerance)
            ]
            for ring in polygon
        ]
        for polygon in polygons
    ]
    return {
        "type": "Feature",
        "properties": {"key": key, "name": region["name"], "iso": region["iso"]},
        "geometry": {"type": "MultiPolygon", "coordinates": coordinates},
    }


def build(keys: list[str], regions: dict, data_dir: Path, tolerance: float) -> dict:
    features = []
    for key in keys:
        polygons = parse_poly((data_dir / f"{key}.poly").read_text())
        features.append(region_feature(key, regions[key], polygons, tolerance))
    return {"type": "FeatureCollection", "features": features}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("regions", nargs="+")
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    parser.add_argument("--out", type=Path, default=Path("data/coverage.geojson"))
    parser.add_argument("--tolerance", type=float, default=0.002)
    args = parser.parse_args()

    catalog = json.loads((args.data_dir / "regions.json").read_text())
    collection = build(args.regions, catalog, args.data_dir, args.tolerance)
    args.out.write_text(json.dumps(collection, separators=(",", ":")))
    size_kb = args.out.stat().st_size / 1e3
    print(f"{len(args.regions)} regions → {args.out} ({size_kb:.0f} kB)")


if __name__ == "__main__":
    main()
