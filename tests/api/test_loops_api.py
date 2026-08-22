"""Offline unit tests for the HTTP API, using fake Valhalla and DEM state."""

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_dem_source, get_valhalla_client
from app.clients.valhalla import RouteResult, ValhallaError
from app.core.config import settings
from app.engine.dem import DemSource
from app.engine.polyline import decode
from app.main import app


class FakeValhalla:
    """Fake client returning plausible routing and scoring payloads."""

    def __init__(self, distance_km: float = 60.0):
        self.distance_km = distance_km
        self.costing_calls: list[dict | None] = []

    async def route(self, locations, costing_options=None, avoid_locations=None):
        self.costing_calls.append(costing_options)
        return RouteResult(list(locations), self.distance_km, 3600.0)

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
    points = decode(body["polyline"])
    assert points[0][0] == pytest.approx(40.4168, abs=1e-3)
    assert points[0][1] == pytest.approx(-3.7038, abs=1e-3)
    assert len(points) > 10
    assert body["score"]["comfort"] > 0
    assert body["score"]["paved_share"] == pytest.approx(1.0)

    # Fake edges carry no way ids: overlap is 0 and safety falls back to
    # the neutral baseline (0.8 * 10).
    assert body["overlap_ratio"] == 0.0
    assert body["duration_min"] == pytest.approx(60.0)
    rating = body["cycling_score"]
    assert rating["distance"] == pytest.approx(10.0)
    assert rating["safety"] == pytest.approx(8.0)
    assert rating["total"] == pytest.approx(0.4 * 10 + 0.6 * 8)
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


def test_unknown_profile_is_rejected():
    client = make_client(FakeValhalla())
    resp = client.post(
        "/api/v1/loops", json={**LOOP_BODY, "profile": "gravel-grinder"}
    )
    app.dependency_overrides.clear()

    assert resp.status_code == 422
    assert resp.json()["error"] == "VALIDATION_ERROR"


def test_out_of_range_costing_option_is_rejected():
    client = make_client(FakeValhalla())
    resp = client.post(
        "/api/v1/loops", json={**LOOP_BODY, "costing": {"use_hills": 5.0}}
    )
    app.dependency_overrides.clear()

    assert resp.status_code == 422


def test_profile_and_raw_costing_are_merged():
    fake = FakeValhalla(distance_km=50.0)
    client = make_client(fake)
    resp = client.post(
        "/api/v1/loops",
        json={
            **LOOP_BODY,
            "max_iterations": 4,
            "profile": "road",
            "costing": {"use_hills": 0.5},
        },
    )
    app.dependency_overrides.clear()

    assert resp.status_code == 200
    assert fake.costing_calls[0] == {
        "bicycle_type": "Road",
        "use_roads": 1.0,
        "avoid_bad_surfaces": 1.0,
        "use_hills": 0.5,
    }


def test_extra_routes_return_alternatives():
    fake = FakeValhalla(distance_km=50.0)
    client = make_client(fake)
    resp = client.post("/api/v1/loops", json={**LOOP_BODY, "routes": 2})
    app.dependency_overrides.clear()

    assert resp.status_code == 200
    body = resp.json()
    assert body["alternatives"] is not None
    assert len(body["alternatives"]) == 1
    # The alternatives carry the same shape as the primary loop.
    assert body["alternatives"][0]["distance_km"] == pytest.approx(50.0)


def test_include_profile_returns_resampled_points():
    client = make_client(FakeValhalla(distance_km=50.0))
    resp = client.post(
        "/api/v1/loops",
        json={**LOOP_BODY, "max_iterations": 4, "include_profile": True},
    )
    app.dependency_overrides.clear()

    assert resp.status_code == 200
    profile = resp.json()["profile"]
    assert len(profile) > 2
    point = profile[0]
    assert set(point) == {
        "lat",
        "lon",
        "distance_m",
        "elevation_m",
        "grade_pct",
    }
    assert point["elevation_m"] == pytest.approx(100.0)


def test_profile_is_absent_by_default():
    client = make_client(FakeValhalla(distance_km=50.0))
    resp = client.post("/api/v1/loops", json={**LOOP_BODY, "max_iterations": 4})
    app.dependency_overrides.clear()

    assert resp.status_code == 200
    assert resp.json()["profile"] is None


def test_gpx_format_returns_xml_document():
    client = make_client(FakeValhalla(distance_km=50.0))
    resp = client.post("/api/v1/loops?format=gpx", json={**LOOP_BODY})
    app.dependency_overrides.clear()

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/gpx+xml")
    assert resp.text.startswith("<?xml")
    assert "<trk>" in resp.text
    assert "<ele>" in resp.text


def test_geojson_format_returns_feature_collection():
    client = make_client(FakeValhalla(distance_km=50.0))
    resp = client.post("/api/v1/loops?format=geojson", json={**LOOP_BODY})
    app.dependency_overrides.clear()

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/geo+json")
    doc = resp.json()
    assert doc["type"] == "FeatureCollection"
    props = doc["features"][0]["properties"]
    assert props["distance_km"] == pytest.approx(50.0)
    assert props["duration_min"] > 0.0


def test_valhalla_outage_maps_to_503():
    client = make_client(UnreachableValhalla())
    resp = client.post("/api/v1/loops", json=LOOP_BODY)
    app.dependency_overrides.clear()

    assert resp.status_code == 503
    body = resp.json()
    assert body["error"] == "SERVICE_UNAVAILABLE"
