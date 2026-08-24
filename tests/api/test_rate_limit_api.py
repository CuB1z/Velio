"""API tests for rate limiting: budgets trip into 429 responses."""

from fastapi.testclient import TestClient

from app.core import ratelimit
from app.core.config import settings


def _enable(monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", True)


def test_exhausted_ip_budget_answers_429_with_retry_after(
    api_client: TestClient, monkeypatch
):
    _enable(monkeypatch)
    monkeypatch.setitem(ratelimit.RULES["/api/v1/auth/resend-verification"], "ip", 2)

    for _ in range(2):
        resp = api_client.post(
            "/api/v1/auth/resend-verification",
            json={"email": "nobody@test.dev"},
        )
        assert resp.status_code == 202, resp.text

    resp = api_client.post(
        "/api/v1/auth/resend-verification",
        json={"email": "nobody@test.dev"},
    )
    assert resp.status_code == 429, resp.text
    body = resp.json()
    assert body["error"] == "RATE_LIMITED"
    assert int(resp.headers["Retry-After"]) > 0


def test_user_budget_throttles_per_account_not_by_ip(
    api_client: TestClient, auth_headers: dict, monkeypatch
):
    _enable(monkeypatch)
    monkeypatch.setitem(ratelimit.RULES["/api/v1/auth/me"], "user", 1)

    resp = api_client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200, resp.text

    resp = api_client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 429, resp.text
    assert resp.json()["error"] == "RATE_LIMITED"


def test_anonymous_caller_skips_the_user_side(api_client: TestClient, monkeypatch):
    _enable(monkeypatch)

    resp = api_client.get("/api/v1/auth/me")
    assert resp.status_code == 401, resp.text


def test_global_baseline_catches_unmarked_traffic(
    api_client: TestClient, monkeypatch
):
    _enable(monkeypatch)
    monkeypatch.setattr("app.core.middleware.GLOBAL_RPM", 2)

    for _ in range(2):
        resp = api_client.get("/api/v1/auth/me")
        assert resp.status_code == 401, resp.text

    resp = api_client.get("/api/v1/auth/me")
    assert resp.status_code == 429, resp.text
    assert resp.json()["error"] == "RATE_LIMITED"


def test_disabled_limiter_never_blocks(api_client: TestClient):
    assert settings.rate_limit_enabled is False

    for _ in range(5):
        resp = api_client.post(
            "/api/v1/auth/resend-verification",
            json={"email": "nobody@test.dev"},
        )
        assert resp.status_code != 429, resp.text


def test_every_rule_points_at_a_real_endpoint():
    """Guard against stale RULES entries after route refactors.

    Endpoints without a rule are fine: they simply live under the
    global ceiling alone.
    """
    from app.main import app

    spec_paths = set(app.openapi()["paths"])
    assert set(ratelimit.RULES) <= spec_paths
