"""E2E: engine elevation profile vs Valhalla /height ground truth.

Run with the service up:
    .venv/bin/python -m pytest tests/ -m e2e
"""

import pytest

from app.engine.dem import DemSource
from app.engine.elevation import build_profile
from tools.elevation_cli import compare_heights
from tools.valhalla import fetch_heights, fetch_route_shape

pytestmark = pytest.mark.e2e

MADRID = (40.4168, -3.7038)
NAVARCERRADA = (40.7850, -3.9600)


def test_profile_matches_height_ground_truth(base_url, elevation_dir):
    shape = fetch_route_shape(base_url, [MADRID, NAVARCERRADA])
    profile = build_profile(DemSource(elevation_dir), shape)

    # Mountain route sanity: Navacerrada climb must show up.
    assert 60.0 < profile.distance_km < 90.0
    assert profile.gain_m > 800.0

    heights = fetch_heights(
        base_url, [s.lat for s in profile.samples], [s.lon for s in profile.samples]
    )
    stats = compare_heights(profile.samples, heights)
    assert stats["count"] > 0.9 * len(profile.samples)
    assert stats["mae_m"] < 5.0
