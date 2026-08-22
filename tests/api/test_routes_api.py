"""Offline unit tests for the routing endpoint, with fake Valhalla/DEM."""

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_dem_source, get_valhalla_client
from app.clients.valhalla import RouteError, RouteResult, ValhallaError
from app.engine.edges import RouteEdge
from app.engine.dem import DemSource
from app.engine.polyline import decode
from app.main import app


class FakeValhalla:
    """Fake client returning plausible routing and scoring payloads."""

    async def route(self, locations, costing_options=None, avoid_locations=None):
        return RouteResult(list(locations), 74.0, 3600.0)

    async def route_alternatives(
        self, locations, count=1, costing_options=None, avoid_locations=None
    ):
        results = [await self.route(locations)]
        for i in range(count):
            results.append(
                RouteResult(
                    list(reversed(locations)), 74.0 + (i + 1) * 3.0, 3900.0
                )
            )
        return results

    async def trace_attributes(self, encoded_polyline, costing_options=None):
        raw = [
            {
                "length": 1.0,
                "surface": "paved",
                "weighted_grade": 4.0,
                "max_upward_grade": 8.0,
            }
        ]
        return [RouteEdge.from_trace(edge) for edge in raw]


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
    assert body["alternatives"] is None
    assert body["duration_min"] == pytest.approx(60.0)


def test_alternatives_return_scored_variants():
    client = make_client(FakeValhalla())
    resp = client.post("/api/v1/routes", json={**ROUTE_BODY, "alternatives": 2})
    app.dependency_overrides.clear()

    assert resp.status_code == 200
    body = resp.json()
    alts = body["alternatives"]
    assert len(alts) == 2
    assert alts[0]["distance_km"] > body["distance_km"]
    for alt in alts:
        assert alt["polyline"]
        assert alt["cycling_score"]["total"] >= 0.0


def test_too_many_alternatives_is_rejected():
    resp = make_client(FakeValhalla()).post(
        "/api/v1/routes", json={**ROUTE_BODY, "alternatives": 5}
    )
    app.dependency_overrides.clear()
    assert resp.status_code == 422


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
