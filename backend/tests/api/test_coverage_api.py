"""Covered regions: the coverage endpoint and the out-of-coverage error."""

from fastapi.testclient import TestClient

from app.api.dependencies import get_dem_source, get_loop_service, get_valhalla_client
from app.core.config import settings
from app.engine.coverage import WORLD_BBOX, Coverage
from app.main import app
from app.mappers.coverage import CoverageMapper
from app.services.loop_service import LoopService
from tests.api.test_loops_api import LOOP_BODY, ConstantDem
from tests.api.test_loops_stream import parse
from tests.api.test_routes_api import FakeValhalla
from tests.conftest import AuthorizedClient

COVERAGE = Coverage.from_geojson(settings.coverage_path)

MADRID = {"lat": 40.4168, "lon": -3.7038}
PARIS = {"lat": 48.8566, "lon": 2.3522}
MARRAKESH = {"lat": 31.6295, "lon": -7.9811}
LISBON = {"lat": 38.7223, "lon": -9.1393}
PORTO = {"lat": 41.1579, "lon": -8.6291}


class NoValhalla:
    """Fails the request if anything reaches the routing engine."""

    def __getattr__(self, name):
        raise AssertionError(f"Valhalla.{name} reached for an uncovered point")


def loop_client(valhalla, auth_headers) -> AuthorizedClient:
    app.dependency_overrides[get_loop_service] = lambda: LoopService(
        valhalla=valhalla, dem=ConstantDem(), coverage=COVERAGE
    )
    return AuthorizedClient(TestClient(app), auth_headers["Authorization"])


def route_client(valhalla, auth_headers) -> AuthorizedClient:
    app.dependency_overrides[get_valhalla_client] = lambda: valhalla
    app.dependency_overrides[get_dem_source] = lambda: ConstantDem()
    return AuthorizedClient(TestClient(app), auth_headers["Authorization"])


def teardown_function():
    app.dependency_overrides.clear()


def assert_out_of_coverage(body: dict, points: list[int]) -> None:
    assert body["error"] == "OUT_OF_COVERAGE"
    assert body["details"] == {"points": points, "regions": ["AD", "ES", "PT"]}


def test_a_loop_from_paris_is_rejected_before_routing(auth_headers):
    client = loop_client(NoValhalla(), auth_headers)
    resp = client.post("/api/v1/loops", json={**LOOP_BODY, "origin": PARIS})
    assert resp.status_code == 422
    assert_out_of_coverage(resp.json(), [0])


def test_a_route_through_morocco_names_the_uncovered_waypoint(auth_headers):
    client = route_client(NoValhalla(), auth_headers)
    resp = client.post(
        "/api/v1/routes", json={"waypoints": [MADRID, MARRAKESH, LISBON]}
    )
    assert resp.status_code == 422
    assert_out_of_coverage(resp.json(), [1])


def test_the_stream_ends_with_the_out_of_coverage_error(auth_headers):
    loop_client(NoValhalla(), auth_headers)
    with TestClient(app).stream(
        "POST",
        "/api/v1/loops/stream",
        json={**LOOP_BODY, "origin": PARIS},
        headers=auth_headers,
    ) as resp:
        events = parse(list(resp.iter_lines()))
    [(name, payload)] = events
    assert name == "error"
    assert payload["status"] == 422
    assert_out_of_coverage(payload, [0])


def test_a_route_in_portugal_is_routed(auth_headers):
    client = route_client(FakeValhalla(), auth_headers)
    resp = client.post("/api/v1/routes", json={"waypoints": [LISBON, PORTO]})
    assert resp.status_code == 200


def test_coverage_lists_the_regions_bbox_and_geometry(api_client):
    resp = api_client.get("/api/v1/coverage")
    assert resp.status_code == 200
    assert resp.headers["Cache-Control"] == (
        f"public, max-age={settings.cache_control_max_age}"
    )
    body = resp.json()
    assert body["regions"][2] == {"key": "portugal", "name": "Portugal", "iso": "PT"}
    assert [region["iso"] for region in body["regions"]] == ["ES", "ES", "PT", "AD"]
    assert body["bbox"] == list(COVERAGE.bbox)
    assert body["geometry"]["type"] == "MultiPolygon"
    assert len(body["geometry"]["coordinates"]) == len(COVERAGE.polygons)


def test_without_a_coverage_file_the_answer_is_the_whole_world():
    body = CoverageMapper.out(Coverage.everywhere()).model_dump()
    assert body == {"regions": [], "bbox": WORLD_BBOX, "geometry": None}
