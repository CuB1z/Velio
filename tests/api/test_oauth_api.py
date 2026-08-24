"""Offline unit tests for the OAuth endpoints, with a mocked provider."""

import uuid

import httpx
from fastapi.testclient import TestClient

from app.api.dependencies import get_oauth_gateway
from app.clients.oauth import OAuthGateway
from app.core.config import settings
from app.core.security import create_state_token
from app.main import app


def _mock_transport(handler) -> OAuthGateway:
    return OAuthGateway(transport=httpx.MockTransport(handler))


def _configure_google(monkeypatch):
    monkeypatch.setattr(settings, "oauth_google_client_id", "cid")
    monkeypatch.setattr(settings, "oauth_google_client_secret", "secret")


def _google_round_trip(email: str | None = None) -> tuple[OAuthGateway, str]:
    """Gateway for one fresh provider identity; returns (gateway, email).

    The provider subject is unique per call so repeated runs against a
    long-lived test database always exercise account creation.
    """
    email = email or f"oauth-{uuid.uuid4().hex}@rider.dev"
    subject = uuid.uuid4().hex

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "oauth2.googleapis.com":
            return httpx.Response(200, json={"access_token": "g-tok"})
        return httpx.Response(
            200,
            json={"sub": subject, "email": email, "name": "O"},
        )

    return _mock_transport(handler), email


# OAuth endpoints answer 307; never chase them to the real provider.
def _client() -> TestClient:
    return TestClient(app, follow_redirects=False)


def test_unknown_provider_is_404(auth_headers):
    # Unknown providers fall through to the service mapping.
    resp = _client().get("/api/v1/auth/github/authorize")
    assert resp.status_code == 404


def test_unconfigured_provider_maps_to_503(monkeypatch):
    # Hermetic: force-absent credentials even when a local .env has them.
    monkeypatch.setattr(settings, "oauth_google_client_id", None)
    monkeypatch.setattr(settings, "oauth_google_client_secret", None)
    resp = _client().get("/api/v1/auth/google/authorize")
    assert resp.status_code == 503


def test_authorize_redirects_to_google(monkeypatch):
    from urllib.parse import parse_qs, urlparse

    _configure_google(monkeypatch)
    resp = _client().get("/api/v1/auth/google/authorize")

    assert resp.status_code == 307
    parsed = urlparse(resp.headers["location"])
    assert parsed.netloc == "accounts.google.com"
    query = parse_qs(parsed.query)
    assert query["response_type"] == ["code"]
    assert query["client_id"] == ["cid"]
    assert query["scope"] == ["openid email profile"]
    assert query["redirect_uri"] == [
        f"{settings.auth_redirect_base}/api/v1/auth/google/callback"
    ]
    assert query["state"]


def test_callback_happy_path_opens_the_account(monkeypatch):
    _configure_google(monkeypatch)
    gateway, oauth_email = _google_round_trip()
    app.dependency_overrides[get_oauth_gateway] = lambda: gateway

    state = create_state_token("google")
    try:
        resp = _client().get(
            "/api/v1/auth/google/callback",
            params={"code": "good-code", "state": state},
        )
    finally:
        app.dependency_overrides.pop(get_oauth_gateway, None)

    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["email"] == oauth_email
    assert body["user"]["status"] == "active"
    assert body["tokens"]["access_token"]

    # The session is a real one: /me answers with the same account.
    me = TestClient(app).get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {body['tokens']['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == oauth_email


def test_callback_links_and_activates_a_pending_local_account(
    monkeypatch, collect_mail
):
    """A provider-validated mailbox proves ownership of a pending account."""
    _configure_google(monkeypatch)
    email = f"pending-{uuid.uuid4().hex}@rider.dev"
    client = TestClient(app)

    with collect_mail():
        registered = client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "Secret-123"},
        )
    assert registered.status_code == 201

    app.dependency_overrides[get_oauth_gateway] = lambda: _google_round_trip(email)[0]
    try:
        resp = _client().get(
            "/api/v1/auth/google/callback",
            params={
                "code": "good-code",
                "state": create_state_token("google"),
            },
        )
    finally:
        app.dependency_overrides.pop(get_oauth_gateway, None)

    assert resp.status_code == 200
    assert resp.json()["user"]["status"] == "active"

    # The local password now works too: the account was activated, and the
    # verification code that was mailed out became irrelevant.
    logged = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Secret-123"}
    )
    assert logged.status_code == 200


def test_callback_with_tampered_state_is_rejected(monkeypatch):
    _configure_google(monkeypatch)
    gateway, _ = _google_round_trip()
    app.dependency_overrides[get_oauth_gateway] = lambda: gateway

    forged = uuid_hex_forged_state()
    try:
        resp = _client().get(
            "/api/v1/auth/google/callback",
            params={"code": "code", "state": forged},
        )
    finally:
        app.dependency_overrides.pop(get_oauth_gateway, None)

    assert resp.status_code == 400
    body = resp.json()
    assert body["error"] == "OAUTH_ERROR"


def uuid_hex_forged_state() -> str:
    import uuid

    return f"{uuid.uuid4().hex}.forged"
