"""E2E: point-to-point routing against a live Valhalla instance."""

import pytest
from fastapi.testclient import TestClient

from app.engine.polyline import decode
from app.main import app

pytestmark = pytest.mark.e2e

MADRID = (40.4168, -3.7038)
NAVACERRADA = (40.7850, -3.9600)


def test_service_routes_madrid_to_navacerrada(base_url, elevation_dir):
    with TestClient(app) as client:
        resp = client.post(
            "/api/v1/routes",
            json={
                "waypoints": [
                    {"lat": MADRID[0], "lon": MADRID[1]},
                    {"lat": NAVACERRADA[0], "lon": NAVACERRADA[1]},
                ]
            },
        )

    assert resp.status_code == 200
    body = resp.json()
    assert 60.0 < body["distance_km"] < 90.0
    assert body["gain_m"] > 800.0
    assert body["score"] is not None
    assert 0.0 <= body["score"]["comfort"] <= 100.0

    points = decode(body["polyline"])
    assert points[0][0] == pytest.approx(MADRID[0], abs=1e-3)
    assert points[0][1] == pytest.approx(MADRID[1], abs=1e-3)
    assert len(points) > 100


def test_route_gpx_export_carries_dem_elevation(base_url, elevation_dir):
    with TestClient(app) as client:
        resp = client.post(
            "/api/v1/routes?format=gpx",
            json={
                "waypoints": [
                    {"lat": MADRID[0], "lon": MADRID[1]},
                    {"lat": NAVACERRADA[0], "lon": NAVACERRADA[1]},
                ]
            },
        )

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/gpx+xml")
    assert "<trk>" in resp.text
    assert "<ele>" in resp.text
