"""Offline unit tests for the loops API, using fake Valhalla and DEM state."""

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_loop_service
from app.core.config import settings
from app.engine.dem import DemSource
from app.engine.polyline import decode
from app.main import app
from app.services.loop_service import LoopService
from tests.conftest import AuthorizedClient


class FakeValhalla:
    """Fake client returning plausible routing and scoring payloads."""

    async def aclose(self):
        pass


    def __init__(self, distance_km: float = 60.0):
        self.distance_km = distance_km
        self.costing_calls: list[dict | None] = []

    async def route(self, locations, costing_options=None, avoid_locations=None):
        self.costing_calls.append(costing_options)
        from app.clients.valhalla import RouteResult

        return RouteResult(list(locations), self.distance_km, 3600.0)

    async def trace_attributes(self, encoded_polyline, costing_options=None):
        from app.engine.edges import RouteEdge

        raw = [
            {
                "length": 1.0,
                "surface": "paved_smooth",
                "weighted_grade": 2.0,
                "max_upward_grade": 5.0,
            }
        ]
        return [RouteEdge.from_trace(edge) for edge in raw]


class UnreachableValhalla(FakeValhalla):
    async def route(self, locations, costing_options=None, avoid_locations=None):
        from app.core.exceptions import ValhallaError

        raise ValhallaError("connection refused")


class ConstantDem(DemSource):
    def __init__(self):
        pass

    def elevation(self, lat: float, lon: float) -> float:
        return 100.0


def make_client(valhalla, auth_headers) -> AuthorizedClient:
    app.dependency_overrides[get_loop_service] = lambda: LoopService(
        valhalla=valhalla, dem=ConstantDem()
    )
    return AuthorizedClient(TestClient(app), auth_headers["Authorization"])


LOOP_BODY = {"origin": {"lat": 40.4168, "lon": -3.7038}, "distance_km": 50}


def teardown_function():
    app.dependency_overrides.clear()


def test_health_reports_status_and_version():
    resp = TestClient(app).get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "version": settings.app_version}


def test_create_loop_returns_scored_route(auth_headers):
    client = make_client(FakeValhalla(distance_km=50.0), auth_headers)
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

    # Fake edges carry no way ids or road attributes: no overlap, neutral safety.
    assert body["overlap_ratio"] == 0.0
    assert body["duration_min"] == pytest.approx(60.0)
    rating = body["cycling_score"]
    assert rating["distance"] == pytest.approx(10.0)
    assert rating["safety"] == pytest.approx(5.0)
    # paved_smooth edges max out the surface axis.
    assert rating["surface"] == pytest.approx(10.0)
    assert rating["total"] == pytest.approx(0.4 * 10 + 0.4 * 5 + 0.2 * 10)


def test_create_loop_sends_cache_control(auth_headers):
    client = make_client(FakeValhalla(distance_km=50.0), auth_headers)
    resp = client.post("/api/v1/loops", json={**LOOP_BODY, "max_iterations": 4})

    assert resp.status_code == 200
    assert (
        resp.headers["cache-control"]
        == f"public, max-age={settings.cache_control_max_age}"
    )


def test_unachievable_target_returns_best_effort_infeasible(auth_headers):
    client = make_client(FakeValhalla(distance_km=75.0), auth_headers)
    resp = client.post("/api/v1/loops", json={**LOOP_BODY, "max_iterations": 3})

    assert resp.status_code == 200
    assert resp.json()["feasible"] is False


def test_invalid_payload_is_rejected(auth_headers):
    client = make_client(FakeValhalla(), auth_headers)
    resp = client.post("/api/v1/loops", json={**LOOP_BODY, "distance_km": 0})

    assert resp.status_code == 422
    assert resp.json()["error"] == "VALIDATION_ERROR"


def test_unknown_bike_is_rejected(auth_headers):
    client = make_client(FakeValhalla(), auth_headers)
    resp = client.post(
        "/api/v1/loops", json={**LOOP_BODY, "bike": "gravel-grinder"}
    )

    assert resp.status_code == 422
    assert resp.json()["error"] == "VALIDATION_ERROR"


def test_unknown_hills_preference_is_rejected(auth_headers):
    client = make_client(FakeValhalla(), auth_headers)
    resp = client.post("/api/v1/loops", json={**LOOP_BODY, "hills": "vertical"})

    assert resp.status_code == 422


def test_out_of_range_costing_option_is_rejected(auth_headers):
    client = make_client(FakeValhalla(), auth_headers)
    resp = client.post(
        "/api/v1/loops", json={**LOOP_BODY, "costing": {"use_hills": 5.0}}
    )

    assert resp.status_code == 422


def test_bike_hills_and_raw_costing_are_merged(auth_headers):
    fake = FakeValhalla(distance_km=50.0)
    client = make_client(fake, auth_headers)
    resp = client.post(
        "/api/v1/loops",
        json={
            **LOOP_BODY,
            "max_iterations": 4,
            "bike": "road",
            "hills": "flat",
            "costing": {"use_hills": 0.5},
        },
    )

    assert resp.status_code == 200
    # Bike, then hills, then explicit costing: use_hills beats `flat`'s 0.0.
    assert fake.costing_calls[0] == {
        "bicycle_type": "Road",
        "avoid_bad_surfaces": 1.0,
        "use_roads": 0.3,
        "use_hills": 0.5,
    }


def test_gravel_and_mtb_reach_valhalla_as_different_bicycle_types(auth_headers):
    """The bike is the only lever that actually changes the surface mix."""
    seen = []
    for bike, expected in (("gravel", "Cross"), ("mtb", "Mountain")):
        # (the city bike is Road-typed on purpose; see test_bikes)
        fake = FakeValhalla(distance_km=50.0)
        client = make_client(fake, auth_headers)
        resp = client.post("/api/v1/loops", json={**LOOP_BODY, "bike": bike})
        assert resp.status_code == 200
        assert fake.costing_calls[0]["bicycle_type"] == expected
        seen.append(fake.costing_calls[0])
    # And neither of them sets the option that only works on a road bike.
    assert all("avoid_bad_surfaces" not in call for call in seen)


def test_extra_routes_return_alternatives(auth_headers):
    fake = FakeValhalla(distance_km=50.0)
    client = make_client(fake, auth_headers)
    resp = client.post("/api/v1/loops", json={**LOOP_BODY, "routes": 2})

    assert resp.status_code == 200
    body = resp.json()
    assert body["alternatives"] is not None
    assert len(body["alternatives"]) == 1
    # The alternatives carry the same shape as the primary loop.
    assert body["alternatives"][0]["distance_km"] == pytest.approx(50.0)


def test_include_profile_returns_resampled_points(auth_headers):
    client = make_client(FakeValhalla(distance_km=50.0), auth_headers)
    resp = client.post(
        "/api/v1/loops",
        json={**LOOP_BODY, "max_iterations": 4, "include_profile": True},
    )

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


def test_profile_is_absent_by_default(auth_headers):
    client = make_client(FakeValhalla(distance_km=50.0), auth_headers)
    resp = client.post("/api/v1/loops", json={**LOOP_BODY, "max_iterations": 4})

    assert resp.status_code == 200
    assert resp.json()["profile"] is None


def test_gpx_format_returns_xml_document(auth_headers):
    client = make_client(FakeValhalla(distance_km=50.0), auth_headers)
    resp = client.post("/api/v1/loops?format=gpx", json=LOOP_BODY)

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/gpx+xml")
    assert resp.text.startswith("<?xml")
    assert "<trk>" in resp.text
    assert "<ele>" in resp.text


def test_geojson_format_returns_feature_collection(auth_headers):
    client = make_client(FakeValhalla(distance_km=50.0), auth_headers)
    resp = client.post("/api/v1/loops?format=geojson", json=LOOP_BODY)

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/geo+json")
    doc = resp.json()
    assert doc["type"] == "FeatureCollection"
    props = doc["features"][0]["properties"]
    assert props["distance_km"] == pytest.approx(50.0)
    assert props["duration_min"] > 0.0


def test_valhalla_outage_maps_to_503(auth_headers):
    client = make_client(UnreachableValhalla(), auth_headers)
    resp = client.post("/api/v1/loops", json=LOOP_BODY)

    assert resp.status_code == 503
    body = resp.json()
    assert body["error"] == "SERVICE_UNAVAILABLE"


def test_best_effort_loop_is_still_scored(auth_headers):
    """The rider needs the score precisely to decide whether to accept it."""
    client = make_client(FakeValhalla(distance_km=75.0), auth_headers)
    resp = client.post("/api/v1/loops", json={**LOOP_BODY, "max_iterations": 3})

    assert resp.status_code == 200
    body = resp.json()
    assert body["feasible"] is False
    assert body["cycling_score"] is not None
    assert body["score"] is not None
    # And the distance axis reports the miss rather than hiding it.
    assert body["cycling_score"]["distance"] < 10.0


class OutAndBackValhalla(FakeValhalla):
    """Rides way 7 out and back until the ring loses a waypoint, then fresh ways."""

    def __init__(self):
        super().__init__(distance_km=50.0)
        self.ring_sizes: list[int] = []

    async def route(self, locations, costing_options=None, avoid_locations=None):
        self.ring_sizes.append(len(locations))
        return await super().route(locations, costing_options, avoid_locations)

    async def trace_attributes(self, encoded_polyline, costing_options=None):
        from app.engine.edges import RouteEdge

        shrunk = self.ring_sizes and self.ring_sizes[-1] < max(self.ring_sizes)
        if shrunk:
            ways = ["1", "2", "3", "4", "5", "6"]
        else:
            ways = ["1", "7", "7", "2", "7", "7"]  # way 7 out, way 7 back
        return [
            RouteEdge.from_trace(
                {"length": 8.0, "surface": "paved_smooth", "way_id": way}
            )
            for way in ways
        ]


def test_out_and_back_loops_are_repaired_before_answering(auth_headers):
    """The waypoint inside the spur loses its sector and the ring is regenerated."""
    fake = OutAndBackValhalla()
    client = make_client(fake, auth_headers)
    resp = client.post("/api/v1/loops", json={**LOOP_BODY, "max_iterations": 4})

    assert resp.status_code == 200
    body = resp.json()
    assert body["overlap_ratio"] == pytest.approx(0.0)
    # Reached by regenerating with a smaller ring.
    assert min(fake.ring_sizes) < max(fake.ring_sizes)


class CountryValhalla(FakeValhalla):
    """A graph where the hybrid finds only farm tracks and the road bike tarmac."""

    async def trace_attributes(self, encoded_polyline, costing_options=None):
        from app.engine.edges import RouteEdge

        hybrid = (self.costing_calls[-1] or {}).get("bicycle_type") == "Hybrid"
        surface = "dirt" if hybrid else "paved_smooth"
        return [
            RouteEdge.from_trace({"length": 10.0, "surface": surface, "way_id": str(i)})
            for i in range(5)
        ]


def test_city_bike_tries_hybrid_first_and_keeps_it_on_firm_ground(auth_headers):
    """In the city the hybrid is the quietest thing the graph offers."""
    fake = FakeValhalla(distance_km=50.0)  # every edge paved_smooth
    client = make_client(fake, auth_headers)
    resp = client.post("/api/v1/loops", json={**LOOP_BODY, "bike": "city"})

    assert resp.status_code == 200
    assert resp.json()["score"]["paved_share"] == pytest.approx(1.0)
    types = {call["bicycle_type"] for call in fake.costing_calls if call}
    assert types == {"Hybrid"}  # one pass was enough


def test_city_bike_falls_back_to_asphalt_when_the_hybrid_finds_dirt(auth_headers):
    """Outside the city the hybrid goes straight onto farm tracks."""
    fake = CountryValhalla(distance_km=50.0)
    client = make_client(fake, auth_headers)
    resp = client.post("/api/v1/loops", json={**LOOP_BODY, "bike": "city"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["score"]["paved_share"] == pytest.approx(1.0)
    types = [call["bicycle_type"] for call in fake.costing_calls if call]
    assert types[0] == "Hybrid" and types[-1] == "Road"


def test_an_explicit_bicycle_type_skips_the_urban_pass(auth_headers):
    fake = FakeValhalla(distance_km=50.0)
    client = make_client(fake, auth_headers)
    resp = client.post(
        "/api/v1/loops",
        json={**LOOP_BODY, "bike": "city", "costing": {"bicycle_type": "Cross"}},
    )

    assert resp.status_code == 200
    assert {call["bicycle_type"] for call in fake.costing_calls if call} == {"Cross"}


class NoPathValhalla(FakeValhalla):
    """Every ring is unroutable: Valhalla is up, the terrain says no."""

    async def route(self, locations, costing_options=None, avoid_locations=None):
        from app.core.exceptions import RouteError

        self.costing_calls.append(costing_options)
        raise RouteError("HTTP 400: No path could be found for input")


def test_no_routable_loop_is_a_422_not_a_503(auth_headers):
    """"No path" is a fact about the request, not the service (same as /routes)."""
    fake = NoPathValhalla(distance_km=50.0)
    client = make_client(fake, auth_headers)
    resp = client.post("/api/v1/loops", json={**LOOP_BODY, "bike": "mtb"})

    assert resp.status_code == 422
    assert resp.json()["error"] == "ROUTING_ERROR"
    # And it did not give up after three seeds.
    assert len(fake.costing_calls) >= 6


class TraceRecordingValhalla(FakeValhalla):
    def __init__(self):
        super().__init__(distance_km=50.0)
        self.trace_costings: list[dict | None] = []

    async def trace_attributes(self, encoded_polyline, costing_options=None):
        self.trace_costings.append(costing_options)
        return await super().trace_attributes(encoded_polyline, costing_options)


def test_routes_are_described_with_a_permissive_costing_not_the_bikes(auth_headers):
    """Map-matching only snaps to edges the costing allows."""
    from app.clients.valhalla import TRACE_COSTING

    fake = TraceRecordingValhalla()
    client = make_client(fake, auth_headers)
    resp = client.post("/api/v1/loops", json={**LOOP_BODY, "bike": "road"})

    assert resp.status_code == 200
    assert fake.trace_costings and all(c == TRACE_COSTING for c in fake.trace_costings)
