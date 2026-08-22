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
