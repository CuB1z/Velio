"""E2E: engine elevation profile vs Valhalla /height ground truth.

Run with the service up:
    .venv/bin/python -m pytest tests/ -m e2e
"""

import asyncio

import pytest

from app.clients.valhalla import ValhallaClient
from app.engine.dem import DemSource
from app.engine.elevation import build_profile
from tools.elevation_cli import compare_heights

pytestmark = pytest.mark.e2e

MADRID = (40.4168, -3.7038)
NAVACERRADA = (40.7850, -3.9600)


def test_profile_matches_height_ground_truth(base_url, elevation_dir):
    async def run():
        client = ValhallaClient(base_url)
        try:
            shape = await client.route_shape([MADRID, NAVACERRADA])
            profile = build_profile(DemSource(elevation_dir), shape)
            heights = await client.heights(
                [s.lat for s in profile.samples], [s.lon for s in profile.samples]
            )
        finally:
            await client.aclose()
        return profile, heights

    profile, heights = asyncio.run(run())

    # Mountain route sanity: Navacerrada climb must show up.
    assert 60.0 < profile.distance_km < 90.0
    assert profile.gain_m > 800.0

    stats = compare_heights(profile.samples, heights)
    assert stats["count"] > 0.9 * len(profile.samples)
    assert stats["mae_m"] < 5.0
