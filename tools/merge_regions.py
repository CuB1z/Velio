"""Merge several region extracts into one OSM file. Neighbouring extracts
share the objects along their border; the merge keeps one copy of each.

The largest file streams from disk and the others are held in memory, so
pass the big country among small neighbours rather than several big ones.

Usage (from the repo root; needs `pip install osmium`):
    python -m tools.merge_regions data/spain.osm.pbf data/portugal.osm.pbf \\
        [--out data/coverage.osm.pbf]
"""

import argparse
import time
from pathlib import Path

import osmium


def merge(inputs: list[Path], out: Path) -> None:
    largest, *rest = sorted(inputs, key=lambda path: path.stat().st_size, reverse=True)
    merger = osmium.MergeInputReader()
    for path in rest:
        merger.add_file(str(path))
    out.unlink(missing_ok=True)
    reader = osmium.io.Reader(str(largest))
    writer = osmium.io.Writer(str(out))
    try:
        merger.apply_to_reader(reader, writer)
    finally:
        writer.close()
        reader.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inputs", type=Path, nargs="+")
    parser.add_argument("--out", type=Path, default=Path("data/coverage.osm.pbf"))
    args = parser.parse_args()

    started = time.monotonic()
    merge(args.inputs, args.out)
    size_mb = args.out.stat().st_size / 1e6
    elapsed = time.monotonic() - started
    count = len(args.inputs)
    print(f"{count} extracts → {args.out} ({size_mb:.0f} MB) in {elapsed:.0f} s")


if __name__ == "__main__":
    main()
