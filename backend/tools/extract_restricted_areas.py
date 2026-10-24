"""Extract areas closed to riders (military land, aerodromes, prisons) from the
OSM extract into the GeoJSON the loop engine loads at startup.

Usage (from the repo root; needs `pip install osmium`):
    python -m tools.extract_restricted_areas [--pbf data/coverage.osm.pbf]
        [--out data/restricted_areas.geojson]
"""

import argparse
import json
import tempfile
import time
from pathlib import Path

import osmium

RESTRICTED_TAGS = {
    ("landuse", "military"),
    ("aeroway", "aerodrome"),
    ("amenity", "prison"),
}
MILITARY = {
    "airfield",
    "barracks",
    "base",
    "danger_area",
    "naval_base",
    "range",
    "training_area",
    "yes",
}
PRECISION = 5


def is_restricted(tags) -> bool:
    return (
        any(tags.get(k) == v for k, v in RESTRICTED_TAGS)
        or tags.get("military") in MILITARY
    )


class OnlyRestricted:
    def way(self, way) -> bool:
        return not is_restricted(way.tags)

    def relation(self, relation) -> bool:
        return not is_restricted(relation.tags)


def rounded(coords):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], PRECISION), round(coords[1], PRECISION)]
    return [rounded(c) for c in coords]


def extract(pbf: Path, out: Path) -> int:
    factory = osmium.geom.GeoJSONFactory()
    features = []
    with tempfile.TemporaryDirectory(dir=out.parent) as tmp:
        processor = (
            osmium.FileProcessor(str(pbf))
            .with_locations(f"sparse_file_array,{tmp}/locations")
            .with_areas(OnlyRestricted())
            .with_filter(osmium.filter.EntityFilter(osmium.osm.AREA))
        )
        for area in processor:
            if not is_restricted(area.tags):
                continue
            try:
                geometry = json.loads(factory.create_multipolygon(area))
            except RuntimeError:
                continue
            geometry["coordinates"] = rounded(geometry["coordinates"])
            kind = next(
                (f"{k}={v}" for k, v in RESTRICTED_TAGS if area.tags.get(k) == v),
                f"military={area.tags.get('military')}",
            )
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "osm_id": area.orig_id(),
                        "osm_type": "way" if area.from_way() else "relation",
                        "kind": kind,
                        "name": area.tags.get("name"),
                    },
                    "geometry": geometry,
                }
            )
    out.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    return len(features)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pbf", type=Path, default=Path("data/coverage.osm.pbf"))
    parser.add_argument(
        "--out", type=Path, default=Path("data/restricted_areas.geojson")
    )
    args = parser.parse_args()
    started = time.monotonic()
    count = extract(args.pbf, args.out)
    size_mb = args.out.stat().st_size / 1e6
    elapsed = time.monotonic() - started
    print(f"{count} areas → {args.out} ({size_mb:.1f} MB) in {elapsed:.0f} s")


if __name__ == "__main__":
    main()
