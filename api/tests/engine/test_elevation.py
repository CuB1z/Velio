import numpy as np
import pytest

from app.engine.dem import DemSource
from app.engine.elevation import build_profile, cumulative_distances


class FakeDem:
    """DEM stub returning heights from a callable."""

    def __init__(self, fn):
        self._fn = fn

    def elevation(self, lat: float, lon: float) -> float | None:
        return self._fn(lat, lon)


def test_cumulative_distances_flat_east():
    coords = [(0.0, 0.0), (0.0, 1.0)]
    dist = cumulative_distances(coords)
    expected = 111_194.9  # ~1 degree of longitude at the equator
    assert dist[1] == pytest.approx(expected, rel=1e-4)


def test_build_profile_flat_route():
    dem = FakeDem(lambda lat, lon: 100.0)
    profile = build_profile(dem, [(40.0, -3.0), (40.0, -3.01)])
    assert profile.gain_m == pytest.approx(0.0, abs=1e-6)
    assert profile.loss_m == pytest.approx(0.0, abs=1e-6)
    assert profile.max_uphill_grade_pct == pytest.approx(0.0)
    assert profile.max_downhill_grade_pct == pytest.approx(0.0)
    assert profile.distance_km == pytest.approx(0.8518, rel=1e-3)


def test_build_profile_linear_ramp():
    dem = FakeDem(lambda lat, lon: lon * 100_000.0)
    profile = build_profile(dem, [(40.0, -3.0), (40.0, -2.99)])
    run_m = profile.distance_km * 1000.0
    rise_m = 1000.0  # 0.01 deg * 100000 m/deg
    assert profile.gain_m == pytest.approx(rise_m, rel=0.05)
    assert profile.max_uphill_grade_pct == pytest.approx(
        rise_m / run_m * 100.0, rel=0.15
    )
    assert profile.samples[0].grade_pct is None


def test_build_profile_gain_and_loss():
    def terrain(lat, lon):
        return 500.0 + 200.0 * (lon + 3.0)

    up = build_profile(FakeDem(terrain), [(40.0, -3.0), (40.0, -2.99)])
    down = build_profile(FakeDem(terrain), [(40.0, -2.99), (40.0, -3.0)])
    assert up.gain_m == pytest.approx(down.loss_m, rel=0.05)
    assert up.loss_m == pytest.approx(0.0, abs=1e-6)
    assert down.gain_m == pytest.approx(0.0, abs=1e-6)


def test_build_profile_spike_is_smoothed():
    calls = {"n": 0}

    def terrain(lat, lon):
        calls["n"] += 1
        if 50 <= calls["n"] <= 54:
            return 800.0
        return 100.0

    profile = build_profile(
        FakeDem(terrain), [(40.0, -3.0), (40.0, -2.98)], mean_window=21
    )
    elevations = np.array([s.elevation_m for s in profile.samples])
    assert elevations.max() < 400.0


def test_build_profile_encoded_polyline_input():
    from app.engine.polyline import encode

    dem = FakeDem(lambda lat, lon: 50.0)
    encoded = encode([(40.0, -3.0), (40.0, -3.005)])
    profile = build_profile(dem, encoded)
    assert profile.distance_km == pytest.approx(0.427, rel=1e-2)


def test_build_profile_sea_level_elevation_is_not_a_gap():
    dem = FakeDem(lambda lat, lon: 0.0)
    profile = build_profile(dem, [(39.0, 0.0), (39.0, 0.01)])
    assert profile.gain_m == pytest.approx(0.0, abs=1e-6)
    elevations = [s.elevation_m for s in profile.samples]
    assert all(e == pytest.approx(0.0) for e in elevations)


def test_build_profile_requires_two_points():
    with pytest.raises(ValueError):
        build_profile(FakeDem(lambda lat, lon: 0.0), [(40.0, -3.0)])


def test_build_profile_no_coverage_raises(tmp_path):
    real_dem = DemSource(tmp_path)
    with pytest.raises(ValueError):
        build_profile(real_dem, [(10.0, 10.0), (10.0, 10.01)])
