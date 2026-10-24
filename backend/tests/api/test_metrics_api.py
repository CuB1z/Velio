"""API tests for /metrics: closed by default, token-guarded when configured."""

from fastapi.testclient import TestClient

from app.core import middleware
from app.core.config import settings


def test_metrics_is_closed_by_default(api_client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "metrics_enabled", False)
    resp = api_client.get("/metrics")
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"] == "NOT_FOUND"


def test_metrics_exposes_http_counters_after_traffic(
    api_client: TestClient, monkeypatch
):
    monkeypatch.setattr(settings, "metrics_enabled", True)
    monkeypatch.setattr(settings, "metrics_token", None)

    api_client.get("/api/v1/auth/me")
    resp = api_client.get("/metrics")

    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("text/plain")
    assert "http_requests_total" in resp.text
    assert 'handler="/api/v1/auth/me"' in resp.text
    assert 'handler="/metrics"' not in resp.text


def test_metrics_token_is_required_when_configured(api_client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "metrics_enabled", True)
    monkeypatch.setattr(settings, "metrics_token", "scrape-7f3c2a")

    assert api_client.get("/metrics").status_code == 401
    wrong = {"Authorization": "Bearer nope"}
    assert api_client.get("/metrics", headers=wrong).status_code == 401
    right = {"Authorization": "Bearer scrape-7f3c2a"}
    assert api_client.get("/metrics", headers=right).status_code == 200


def test_scraping_does_not_spend_rate_budget(api_client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(settings, "metrics_enabled", True)
    monkeypatch.setattr(settings, "metrics_token", None)
    monkeypatch.setattr(middleware, "GLOBAL_RPM", 2)

    for _ in range(5):
        assert api_client.get("/metrics").status_code == 200

    statuses = [api_client.get("/api/v1/routes/saved").status_code for _ in range(3)]
    assert statuses[-1] == 429
