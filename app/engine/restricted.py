"""Areas closed to riders (military land, aerodromes, prisons), from GeoJSON."""

import json
import math
from collections.abc import Iterable
from pathlib import Path

from .geo import haversine_m

CELL_DEG = 0.05

Ring = list[tuple[float, float]]
Polygon = list[Ring]


def _cell(lon: float, lat: float) -> tuple[int, int]:
    return math.floor(lon / CELL_DEG), math.floor(lat / CELL_DEG)


def _crossings(lon: float, lat: float, ring: Ring) -> int:
    count = 0
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            count += 1
        j = i
    return count


def feature_polygons(feature: dict) -> list[Polygon]:
    geometry = feature.get("geometry") or {}
    if geometry.get("type") == "Polygon":
        parts = [geometry["coordinates"]]
    elif geometry.get("type") == "MultiPolygon":
        parts = geometry["coordinates"]
    else:
        return []
    return [[[(x, y) for x, y, *_ in ring] for ring in rings] for rings in parts]


class RestrictedAreas:
    """Polygons in (lon, lat), each an outer ring followed by its holes."""

    def __init__(self, polygons: Iterable[Polygon] = ()):
        self._polygons: list[Polygon] = []
        self._boxes: list[tuple[float, float, float, float]] = []
        self._grid: dict[tuple[int, int], list[int]] = {}
        for polygon in polygons:
            if not polygon or len(polygon[0]) < 3:
                continue
            xs = [x for x, _ in polygon[0]]
            ys = [y for _, y in polygon[0]]
            box = (min(xs), min(ys), max(xs), max(ys))
            index = len(self._polygons)
            self._polygons.append(polygon)
            self._boxes.append(box)
            (x0, y0), (x1, y1) = _cell(box[0], box[1]), _cell(box[2], box[3])
            for cx in range(x0, x1 + 1):
                for cy in range(y0, y1 + 1):
                    self._grid.setdefault((cx, cy), []).append(index)

    @classmethod
    def from_geojson(cls, path: Path | str) -> "RestrictedAreas":
        data = json.loads(Path(path).read_text())
        return cls(
            polygon
            for feature in data.get("features", [])
            for polygon in feature_polygons(feature)
        )

    def __len__(self) -> int:
        return len(self._polygons)

    def contains(self, lat: float, lon: float) -> bool:
        for index in self._grid.get(_cell(lon, lat), ()):
            x0, y0, x1, y1 = self._boxes[index]
            if not (x0 <= lon <= x1 and y0 <= lat <= y1):
                continue
            rings = self._polygons[index]
            if sum(_crossings(lon, lat, ring) for ring in rings) % 2:
                return True
        return False

    def metres_inside(self, coords: list[tuple[float, float]]) -> float:
        """Length of a (lat, lon) line whose segments' midpoints fall inside."""
        if not self._polygons:
            return 0.0
        total = 0.0
        for a, b in zip(coords, coords[1:], strict=False):
            if self.contains((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0):
                total += haversine_m(a, b)
        return total
