"""Regions covered by the routing graph, from the coverage GeoJSON."""

import json
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from .restricted import Polygon, RestrictedAreas, feature_polygons

WORLD_BBOX = (-180.0, -90.0, 180.0, 90.0)


@dataclass(frozen=True)
class Region:
    key: str
    name: str
    iso: str


class Coverage:
    """A point is covered when it falls inside any region polygon."""

    def __init__(self, regions: Sequence[Region], polygons: Sequence[Polygon]):
        self.regions = list(regions)
        self.polygons = list(polygons)
        self._index = RestrictedAreas(self.polygons)
        if self.polygons:
            outer = [point for polygon in self.polygons for point in polygon[0]]
            xs = [x for x, _ in outer]
            ys = [y for _, y in outer]
            self.bbox = (min(xs), min(ys), max(xs), max(ys))
        else:
            self.bbox = WORLD_BBOX

    @classmethod
    def everywhere(cls) -> "Coverage":
        return cls([], [])

    @classmethod
    def from_geojson(cls, path: Path | str) -> "Coverage":
        data = json.loads(Path(path).read_text())
        regions: list[Region] = []
        polygons: list[Polygon] = []
        for feature in data.get("features", []):
            props = feature.get("properties") or {}
            regions.append(
                Region(key=props["key"], name=props["name"], iso=props["iso"])
            )
            polygons += feature_polygons(feature)
        return cls(regions, polygons)

    @property
    def isos(self) -> list[str]:
        return sorted({region.iso for region in self.regions})

    def contains(self, lat: float, lon: float) -> bool:
        return not self.polygons or self._index.contains(lat, lon)

    def outside(self, points: Sequence[tuple[float, float]]) -> list[int]:
        """Indexes of the (lat, lon) points no region covers."""
        return [i for i, (lat, lon) in enumerate(points) if not self.contains(lat, lon)]
