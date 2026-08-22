"""E2E: loop generation against live Valhalla, plus quality scoring."""

import pytest

from app.engine.client import fetch_trace_attributes
from app.engine.dem import DemSource
from app.engine.loop import LoopRequest, generate_loop
from app.engine.polyline import encode
from app.engine.scoring import score_edges
from tools.loop_cli import make_route_fn

pytestmark = pytest.mark.e2e

ALGETE = (40.5964, -3.6318)


def test_generated_loop_meets_targets_and_scores(base_url, elevation_dir):
    route_fn = make_route_fn(base_url)
    dem = DemSource(elevation_dir)
    request = LoopRequest(
        origin=ALGETE, target_km=70.0, target_gain_m=900.0
    )

    loop = generate_loop(route_fn, dem, request)

    assert not loop.infeasible
    assert loop.distance_ok
    assert loop.gain_ok

    edges = fetch_trace_attributes(base_url, encode(loop.coords))
    score = score_edges(edges)
    assert 0.0 <= score.comfort <= 100.0
    assert score.total_km == pytest.approx(loop.distance_km, rel=0.15)
