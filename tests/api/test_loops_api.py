"""Offline unit tests for the HTTP API, using fake Valhalla and DEM state."""

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_dem_source, get_valhalla_client
from app.clients.valhalla import ValhallaError
from app.core.config import settings
from app.engine.dem import DemSource
from app.main import app


class FakeValhalla:
    """Fake client returning plausible routing and scoring payloads."""

    def __init__(self, distance_km: float = 60.0):
        self.distance_km = distance_km

    async def route(self, locations, costing_options=None, avoid_locations=None):
        return list(locations), self.distance_km

    async def trace_attributes(self, encoded_polyline, costing_options=None):
        return [
            {
                "length": 1.0,
                "surface": "paved_smooth",
                "weighted_grade": 2.0,
                "max_upward_grade": 5.0,
            }
        ]


class UnreachableValhalla(FakeValhalla):
    async def route(self, locations, costing_options=None, avoid_locations=None):
        raise ValhallaError("connection refused")


class ConstantDem(DemSource):
    def __init__(self):
        pass

    def elevation(self, lat: float, lon: float) -> float:
        return 100.0


def make_client(valhalla) -> TestClient:
    app.dependency_overrides[get_valhalla_client] = lambda: valhalla
    app.dependency_overrides[get_dem_source] = lambda: ConstantDem()
    return TestClient(app)


LOOP_BODY = {"origin": {"lat": 40.4168, "lon": -3.7038}, "distance_km": 50}


def teardown_function():
    app.dependency_overrides.clear()


def test_health_reports_status_and_version():
    with TestClient(app) as client:
        resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "version": settings.app_version}


def test_create_loop_returns_scored_route():
    client = make_client(FakeValhalla(distance_km=50.0))
    resp = client.post("/api/v1/loops", json={**LOOP_BODY, "max_iterations": 4})

    assert resp.status_code == 200
    body = resp.json()
    assert body["feasible"] is True
    assert body["distance_km"] == pytest.approx(50.0)
    assert body["coords"][0] == [40.4168, -3.7038]
    assert body["score"]["comfort"] > 0
    assert body["score"]["paved_share"] == pytest.approx(1.0)
    app.dependency_overrides.clear()


def test_unachievable_target_returns_best_effort_infeasible():
    client = make_client(FakeValhalla(distance_km=75.0))
    resp = client.post("/api/v1/loops", json={**LOOP_BODY, "max_iterations": 3})
    app.dependency_overrides.clear()

    assert resp.status_code == 200
    assert resp.json()["feasible"] is False


def test_invalid_payload_is_rejected():
    client = make_client(FakeValhalla())
    resp = client.post("/api/v1/loops", json={**LOOP_BODY, "distance_km": 0})
    app.dependency_overrides.clear()

    assert resp.status_code == 422
    assert resp.json()["error"] == "VALIDATION_ERROR"


def test_valhalla_outage_maps_to_503():
    client = make_client(UnreachableValhalla())
    resp = client.post("/api/v1/loops", json=LOOP_BODY)
    app.dependency_overrides.clear()

    assert resp.status_code == 503
    body = resp.json()
    assert body["error"] == "SERVICE_UNAVAILABLE"
