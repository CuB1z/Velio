"""Loops that enter a restricted area are never returned."""

from fastapi.testclient import TestClient

from app.api.dependencies import get_loop_service
from app.clients.valhalla import RouteResult
from app.engine.restricted import RestrictedAreas
from app.main import app
from app.services.loop_service import LoopService
from tests.api.test_loops_api import LOOP_BODY, ConstantDem, FakeValhalla
from tests.conftest import AuthorizedClient

ORIGIN = (LOOP_BODY["origin"]["lat"], LOOP_BODY["origin"]["lon"])


class DenseValhalla(FakeValhalla):
    async def route(self, locations, costing_options=None, avoid_locations=None):
        self.costing_calls.append(costing_options)
        coords = []
        for (lat0, lon0), (lat1, lon1) in zip(locations, locations[1:], strict=False):
            coords += [
                (lat0 + (lat1 - lat0) * t / 100, lon0 + (lon1 - lon0) * t / 100)
                for t in range(100)
            ]
        coords.append(locations[-1])
        return RouteResult(coords, self.distance_km, 3600.0)


def box_around(lat: float, lon: float, half: float) -> RestrictedAreas:
    ring = [
        (lon - half, lat - half),
        (lon + half, lat - half),
        (lon + half, lat + half),
        (lon - half, lat + half),
        (lon - half, lat - half),
    ]
    return RestrictedAreas([[ring]])


def post_loop(fake, areas, auth_headers):
    app.dependency_overrides[get_loop_service] = lambda: LoopService(
        valhalla=fake, dem=ConstantDem(), restricted=areas
    )
    client = AuthorizedClient(TestClient(app), auth_headers["Authorization"])
    try:
        return client.post("/api/v1/loops", json=LOOP_BODY)
    finally:
        app.dependency_overrides.pop(get_loop_service, None)


def test_an_intruding_loop_is_never_returned(auth_headers):
    fake = DenseValhalla(distance_km=50.0)
    resp = post_loop(fake, box_around(*ORIGIN, 0.003), auth_headers)
    assert resp.status_code == 422
    assert len(fake.costing_calls) == 6


def test_a_distant_area_changes_nothing(auth_headers):
    fake = DenseValhalla(distance_km=50.0)
    resp = post_loop(fake, box_around(41.5, -1.0, 0.01), auth_headers)
    assert resp.status_code == 200
    assert resp.json()["distance_km"] == 50.0
