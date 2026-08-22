"""Offline unit tests for the routing endpoint, with fake Valhalla/DEM."""

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_dem_source, get_valhalla_client
from app.clients.valhalla import RouteError, ValhallaError
from app.engine.dem import DemSource
from app.engine.polyline import decode
from app.main import app


class FakeValhalla:
    """Fake client returning plausible routing and scoring payloads."""

    async def route(self, locations, costing_options=None, avoid_locations=None):
        return list(locations), 74.0

    async def trace_attributes(self, encoded_polyline, costing_options=None):
        return [
            {
                "length": 1.0,
                "surface": "paved",
                "weighted_grade": 4.0,
                "max_upward_grade": 8.0,
            }
        ]


class UnroutableValhalla(FakeValhalla):
    async def route(self, locations, costing_options=None, avoid_locations=None):
        raise RouteError("no path found")


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


ROUTE_BODY = {
    "waypoints": [
        {"lat": 40.4168, "lon": -3.7038},
        {"lat": 40.7850, "lon": -3.9600},
    ]
}


def teardown_function():
    app.dependency_overrides.clear()


def test_create_route_returns_scored_path():
    client = make_client(FakeValhalla())
    resp = client.post("/api/v1/routes", json=ROUTE_BODY)
    app.dependency_overrides.clear()

    assert resp.status_code == 200
    body = resp.json()
    assert body["distance_km"] == pytest.approx(74.0)
    points = decode(body["polyline"])
    assert points[0][0] == pytest.approx(40.4168, abs=1e-3)
    assert points[0][1] == pytest.approx(-3.7038, abs=1e-3)
    assert body["score"]["comfort"] > 0


def test_single_waypoint_is_rejected():
    client = make_client(FakeValhalla())
    resp = client.post("/api/v1/routes", json={"waypoints": [ROUTE_BODY["waypoints"][0]]})
    app.dependency_overrides.clear()

    assert resp.status_code == 422
    assert resp.json()["error"] == "VALIDATION_ERROR"


def test_no_possible_route_maps_to_422_routing_error():
    client = make_client(UnroutableValhalla())
    resp = client.post("/api/v1/routes", json=ROUTE_BODY)
    app.dependency_overrides.clear()

    assert resp.status_code == 422
    assert resp.json()["error"] == "ROUTING_ERROR"


def test_valhalla_outage_maps_to_503():
    client = make_client(UnreachableValhalla())
    resp = client.post("/api/v1/routes", json=ROUTE_BODY)
    app.dependency_overrides.clear()

    assert resp.status_code == 503
    assert resp.json()["error"] == "SERVICE_UNAVAILABLE"
