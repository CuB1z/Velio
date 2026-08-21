"""DEM lookup over Valhalla-style .hgt.gz elevation tiles.

Tiles are Copernicus DEM GLO-30 repackaged by Tilezen: one 1x1 degree cell,
int16 big-endian heights, row-major starting at the north-west corner.
"""

import gzip
import math
from collections import OrderedDict
from pathlib import Path

import numpy as np

VOID_VALUE = -32768


class DemTile:
    """A single loaded .hgt tile with bilinear lookup."""

    def __init__(self, data: np.ndarray, lat_min: int, lon_min: int):
        if data.ndim != 2 or data.shape[0] != data.shape[1]:
            raise ValueError(f"expected a square grid, got {data.shape}")
        self._data = data.astype(np.float64)
        self.lat_min = float(lat_min)
        self.lon_min = float(lon_min)
        self.lat_max = self.lat_min + 1.0
        self.lon_max = self.lon_min + 1.0
        self.size = data.shape[0]

    def lookup(self, lat: float, lon: float) -> float | None:
        """Bilinear height at (lat, lon); None if the point falls in voids."""
        if not (
            self.lat_min <= lat < self.lat_max and self.lon_min <= lon < self.lon_max
        ):
            return None

        x = (lon - self.lon_min) * (self.size - 1)
        y = (self.lat_max - lat) * (self.size - 1)
        x0 = min(int(x), self.size - 2)
        y0 = min(int(y), self.size - 2)
        fx = x - x0
        fy = y - y0

        v00 = self._data[y0, x0]
        v01 = self._data[y0, x0 + 1]
        v10 = self._data[y0 + 1, x0]
        v11 = self._data[y0 + 1, x0 + 1]

        corners = [v00, v01, v10, v11]
        valid = [v for v in corners if v != VOID_VALUE]
        if not valid:
            return None
        fill = sum(valid) / len(valid)
        v00, v01, v10, v11 = (v if v != VOID_VALUE else fill for v in corners)

        top = v00 * (1.0 - fx) + v01 * fx
        bottom = v10 * (1.0 - fx) + v11 * fx
        return top * (1.0 - fy) + bottom * fy


class DemSource:
    """Loads tiles on demand from a directory with an LRU cache."""

    def __init__(self, directory: str | Path, cache_size: int = 16):
        self.directory = Path(directory)
        if not self.directory.is_dir():
            raise FileNotFoundError(f"elevation directory not found: {self.directory}")
        self.cache_size = cache_size
        self._cache: OrderedDict[Path, DemTile] = OrderedDict()

    def elevation(self, lat: float, lon: float) -> float | None:
        """Height in meters at (lat, lon); None when out of coverage."""
        tile = self._tile_for(lat, lon)
        if tile is None:
            return None
        return tile.lookup(lat, lon)

    def _tile_path(self, lat: float, lon: float) -> Path:
        lat_i = math.floor(lat)
        lon_i = math.floor(lon)
        lat_part = ("N" if lat_i >= 0 else "S") + f"{abs(lat_i):02d}"
        lon_part = ("E" if lon_i >= 0 else "W") + f"{abs(lon_i):03d}"
        name = f"{lat_part}{lon_part}.hgt.gz"
        return self.directory / lat_part / name

    def _tile_for(self, lat: float, lon: float) -> DemTile | None:
        path = self._tile_path(lat, lon)
        tile = self._cache.get(path)
        if tile is not None:
            self._cache.move_to_end(path)
            return tile
        if not path.exists():
            return None
        tile = DemTile(_load_hgt(path), math.floor(lat), math.floor(lon))
        self._cache[path] = tile
        while len(self._cache) > self.cache_size:
            self._cache.popitem(last=False)
        return tile


def _load_hgt(path: Path) -> np.ndarray:
    with gzip.open(path, "rb") as fh:
        raw = fh.read()
    size = int(round(math.sqrt(len(raw) / 2)))
    return np.frombuffer(raw, dtype=">i2").reshape(size, size)
