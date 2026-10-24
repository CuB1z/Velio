import gzip
import struct

import numpy as np
import pytest

from app.engine.dem import VOID_VALUE, DemSource, DemTile


def make_hgt_bytes(values: np.ndarray) -> bytes:
    """Serialize a 2D int array as big-endian int16 HGT payload."""
    return struct.pack(f">{values.size}h", *values.flatten())


def write_tile(tmp_path, lat: int, lon: int, values: np.ndarray) -> None:
    lat_part = ("N" if lat >= 0 else "S") + f"{abs(lat):02d}"
    lon_part = ("E" if lon >= 0 else "W") + f"{abs(lon):03d}"
    tile_dir = tmp_path / lat_part
    tile_dir.mkdir()
    with gzip.open(tile_dir / f"{lat_part}{lon_part}.hgt.gz", "wb") as fh:
        fh.write(make_hgt_bytes(values))


def test_demtile_ramp_bilinear():
    size = 4
    ramp = np.arange(size * size, dtype=np.int16).reshape(size, size) * 10
    tile = DemTile(ramp, lat_min=40, lon_min=-4)

    # HGT rows start at the NW corner: the south edge is the last row.
    assert tile.lookup(40.0, -4.0) == pytest.approx(120.0)
    assert tile.lookup(40.75, -3.25) == pytest.approx(52.5)
    assert tile.lookup(40.5, -3.5) == pytest.approx(75.0)


def test_demtile_void_corners_filled():
    grid = np.full((3, 3), 100, dtype=np.int16)
    grid[0, 0] = VOID_VALUE
    tile = DemTile(grid, lat_min=40, lon_min=-4)
    value = tile.lookup(40.9, -3.9)
    assert value == pytest.approx(100.0)


def test_demtile_all_void_returns_none():
    grid = np.full((3, 3), VOID_VALUE, dtype=np.int16)
    tile = DemTile(grid, lat_min=40, lon_min=-4)
    assert tile.lookup(40.5, -3.5) is None


def test_demtile_out_of_bounds_returns_none():
    tile = DemTile(np.zeros((3, 3), dtype=np.int16), lat_min=40, lon_min=-4)
    assert tile.lookup(41.5, -3.5) is None
    assert tile.lookup(40.5, -2.5) is None


def test_demsource_loads_gzip_tile(tmp_path):
    values = np.arange(25, dtype=np.int16).reshape(5, 5) * 20
    write_tile(tmp_path, 40, -4, values)

    source = DemSource(tmp_path)
    assert source.elevation(40.0, -4.0) == pytest.approx(400.0)
    assert source.elevation(40.5, -3.5) == pytest.approx(240.0)


def test_demsource_missing_tile_returns_none(tmp_path):
    source = DemSource(tmp_path)
    assert source.elevation(10.0, 10.0) is None


def test_demsource_missing_directory_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        DemSource(tmp_path / "nope")


def test_demsource_lru_cache_eviction(tmp_path):
    for lat in (40, 41):
        write_tile(tmp_path, lat, -4, np.full((5, 5), lat * 100, dtype=np.int16))

    source = DemSource(tmp_path, cache_size=1)
    source.elevation(40.5, -3.5)
    source.elevation(41.5, -3.5)
    assert len(source._cache) == 1
