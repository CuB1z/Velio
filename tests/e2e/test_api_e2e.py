"""E2E: the HTTP service against a live Valhalla instance."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

pytestmark = pytest.mark.e2e

ALGETE = (40.5964, -3.6318)


def test_service_generates_scored_loop(base_url, elevation_dir):
    with TestClient(app) as client:
        resp = client.post(
            "/api/v1/loops",
            json={
                "origin": {"lat": ALGETE[0], "lon": ALGETE[1]},
                "distance_km": 70,
                "gain_m": 900,
            },
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["feasible"] is True
    assert body["distance_km"] == pytest.approx(70.0, rel=0.05)
    assert body["gain_m"] == pytest.approx(900.0, rel=0.20)
    assert body["score"] is not None
    assert 0.0 <= body["score"]["comfort"] <= 100.0

    # Quality metadata from /trace_attributes.
    assert body["duration_min"] > 60.0  # ~70 km cannot ride in under an hour
    assert 0.0 <= body["overlap_ratio"] <= 1.0
    rating = body["cycling_score"]
    assert rating is not None
    assert rating["distance"] >= 0.0
    assert 0.0 < rating["total"] <= 10.0
