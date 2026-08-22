"""Offline unit tests for the standalone analysis endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_analysis_service
from app.engine.dem import DemSource
from app.engine.edges import RouteEdge
from app.engine.geo import haversine_m
from app.engine.polyline import decode, encode
from app.main import app
from app.services.analysis_service import RouteAnalysisService


class OutAndBackValhalla:
    """Fake client whose edges mirror way ids on the way back."""

    async def trace_attributes(self, encoded_polyline, costing_options=None):
        coords = decode(encoded_polyline)
        half = (len(coords) - 1) // 2 or 1
        raw = []
        for i in range(len(coords) - 1):
            way = i if i <= half else len(coords) - 1 - i
            km = haversine_m(coords[i], coords[i + 1]) / 1000.0
            raw.append(
                {
                    "length": km,
                    "surface": "paved",
                    "way_id": f"w{way}",
                    "weighted_grade": 1.0,
                }
            )
        return [RouteEdge.from_trace(edge) for edge in raw]


class ConstantDem(DemSource):
    def __init__(self):
        pass

    def elevation(self, lat: float, lon: float) -> float:
        return 100.0


def make_client() -> TestClient:
    app.dependency_overrides[get_analysis_service] = lambda: RouteAnalysisService(
        valhalla=OutAndBackValhalla(), dem=ConstantDem()
    )
    return TestClient(app)


def teardown_function():
    app.dependency_overrides.clear()


def _out_and_back(steps: int, step_deg: float) -> str:
    up = [(40.0 + i * step_deg, -3.0) for i in range(steps)]
    down = list(reversed(up[:-1]))
    return encode(up + down)


BODY = {"polyline": _out_and_back(8, 0.01)}  # ~15.5 km out and back


def test_analyze_scores_a_polyline():
    client = make_client()
    resp = client.post("/api/v1/routes/analyze", json=BODY)
    app.dependency_overrides.clear()

    assert resp.status_code == 200
    body = resp.json()
    # The return leg rides the same ways again -> visible repetition.
    assert body["overlap_ratio"] > 0.3
    assert body["score"]["comfort"] > 0
    rating = body["cycling_score"]
    assert 0.0 <= rating["total"] <= 10.0
    assert body["gain_m"] == pytest.approx(0.0, abs=0.5)


def test_analyze_with_targets_drives_the_rating():
    client = make_client()
    far_off = client.post(
        "/api/v1/routes/analyze", json={**BODY, "target_km": 499}
    ).json()
    on_target = client.post(
        "/api/v1/routes/analyze", json={**BODY, "target_km": 16}
    ).json()
    app.dependency_overrides.clear()

    assert (
        far_off["cycling_score"]["distance"]
        < on_target["cycling_score"]["distance"]
    )


def test_elevation_profiles_a_polyline():
    client = make_client()
    resp = client.post("/api/v1/routes/elevation", json=BODY)
    app.dependency_overrides.clear()

    assert resp.status_code == 200
    body = resp.json()
    assert body["distance_km"] > 0
    assert body["gain_m"] == pytest.approx(0.0, abs=0.5)
    assert len(body["profile"]) > 2
    assert body["profile"][0]["elevation_m"] == pytest.approx(100.0)


def test_single_point_polyline_is_rejected():
    client = make_client()
    resp = client.post(
        "/api/v1/routes/elevation",
        json={"polyline": encode([(40.0, -3.0)])},
    )
    app.dependency_overrides.clear()

    assert resp.status_code == 400
    assert resp.json()["error"] == "VALIDATION_ERROR"
