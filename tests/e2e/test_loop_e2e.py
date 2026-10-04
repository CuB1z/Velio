"""E2E: loop generation against live Valhalla, plus quality scoring."""

import asyncio

import pytest

from app.clients.valhalla import ValhallaClient
from app.engine.dem import DemSource
from app.engine.loop import LoopRequest, generate_loop
from app.engine.polyline import encode
from app.engine.scoring import score_edges

pytestmark = pytest.mark.e2e

ALGETE = (40.5964, -3.6318)


def test_generated_loop_meets_targets_and_scores(base_url, elevation_dir):
    request = LoopRequest(origin=ALGETE, target_km=70.0, target_gain_m=900.0)

    async def run():
        client = ValhallaClient(base_url)
        try:
            loop = await generate_loop(
                client, DemSource(elevation_dir), request
            )
            edges = await client.trace_attributes(encode(loop.coords))
        finally:
            await client.aclose()
        return loop, edges

    loop, edges = asyncio.run(run())

    assert not loop.infeasible
    assert loop.distance_ok
    assert loop.gain_ok

    score = score_edges(edges)
    assert 0.0 <= score.comfort <= 100.0
    assert score.total_km == pytest.approx(loop.distance_km, rel=0.15)


CAMPAMENTO = (40.398, -3.775)


def test_loops_stay_out_of_restricted_areas(base_url, elevation_dir):
    from pathlib import Path

    from app.engine.bikes import costing_options_for
    from app.engine.loop import GOLDEN_ANGLE_DEG
    from app.engine.restricted import RestrictedAreas

    path = Path("data/restricted_areas.geojson")
    if not path.is_file():
        pytest.skip("restricted areas file not generated")
    areas = RestrictedAreas.from_geojson(path)

    async def run():
        client = ValhallaClient(base_url)
        try:
            return [
                await generate_loop(
                    client,
                    DemSource(elevation_dir),
                    LoopRequest(
                        origin=CAMPAMENTO,
                        target_km=12.0,
                        seed_offset_deg=GOLDEN_ANGLE_DEG * seed,
                    ),
                    costing_options=costing_options_for("mtb", "rolling"),
                    restricted=areas,
                )
                for seed in range(6)
            ]
        finally:
            await client.aclose()

    for loop in asyncio.run(run()):
        assert areas.metres_inside(loop.coords) <= 50.0
