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


def _google_round_trip(
    email: str | None = None, *, email_verified: bool = True
) -> tuple[OAuthGateway, str]:
    """Fresh provider identity per call, so account creation is always exercised."""
    email = email or f"oauth-{uuid.uuid4().hex}@rider.dev"
    subject = uuid.uuid4().hex

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "oauth2.googleapis.com":
            return httpx.Response(200, json={"access_token": "g-tok"})
        return httpx.Response(
            200,
            json={
                "sub": subject,
                "email": email,
                "name": "O",
                "email_verified": email_verified,
            },
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

    # The local password now works: the account was activated without the OTP.
    logged = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Secret-123"}
    )
    assert logged.status_code == 200


def test_callback_with_unverified_email_cannot_take_over_an_account(
    monkeypatch, collect_mail
):
    """Linking requires the provider to have verified the email."""
    _configure_google(monkeypatch)
    email = f"owner-{uuid.uuid4().hex}@rider.dev"
    client = TestClient(app)

    with collect_mail():
        registered = client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "Secret-123"},
        )
    assert registered.status_code == 201

    gateway, _ = _google_round_trip(email, email_verified=False)
    app.dependency_overrides[get_oauth_gateway] = lambda: gateway
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

    assert resp.status_code == 400
    assert resp.json()["error"] == "OAUTH_ERROR"

    # The account is untouched: still pending, no identity attached.
    logged = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Secret-123"}
    )
    assert logged.status_code == 403
    assert logged.json()["error"] == "EMAIL_NOT_VERIFIED"


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


# SPA redirect ---------------------------------------------------------------


def test_callback_redirects_to_the_spa_with_tokens_in_the_fragment(monkeypatch):
    """A SPA cannot read a JSON body it navigated to, so tokens ride the fragment."""
    from urllib.parse import parse_qs, urlparse

    _configure_google(monkeypatch)
    monkeypatch.setattr(
        settings, "oauth_success_redirect", "http://localhost:5173/oauth/callback"
    )
    gateway, _ = _google_round_trip()
    app.dependency_overrides[get_oauth_gateway] = lambda: gateway
    try:
        state = create_state_token("google")
        resp = _client().get(f"/api/v1/auth/google/callback?code=c&state={state}")
    finally:
        app.dependency_overrides.pop(get_oauth_gateway, None)

    assert resp.status_code == 303
    parsed = urlparse(resp.headers["location"])
    assert f"{parsed.scheme}://{parsed.netloc}{parsed.path}" == (
        "http://localhost:5173/oauth/callback"
    )
    # The credentials live in the fragment, never in the query string.
    assert parsed.query == ""
    fragment = parse_qs(parsed.fragment)
    assert fragment["access_token"][0]
    assert fragment["refresh_token"][0]
    assert fragment["token_type"] == ["bearer"]


def test_callback_redirects_errors_to_the_spa_too(monkeypatch):
    """A rejected round trip must not strand the user on a raw JSON page."""
    from urllib.parse import parse_qs, urlparse

    _configure_google(monkeypatch)
    monkeypatch.setattr(
        settings, "oauth_success_redirect", "http://localhost:5173/oauth/callback"
    )
    gateway, _ = _google_round_trip()
    app.dependency_overrides[get_oauth_gateway] = lambda: gateway
    try:
        # A forged state is rejected before the provider is ever contacted.
        resp = _client().get("/api/v1/auth/google/callback?code=c&state=forged")
    finally:
        app.dependency_overrides.pop(get_oauth_gateway, None)

    assert resp.status_code == 303
    fragment = parse_qs(urlparse(resp.headers["location"]).fragment)
    assert fragment["error"] == ["OAUTH_ERROR"]


def test_callback_still_answers_json_when_no_spa_is_configured(monkeypatch):
    """The redirect is opt-in: unset, the endpoint keeps its JSON contract."""
    _configure_google(monkeypatch)
    monkeypatch.setattr(settings, "oauth_success_redirect", None)
    gateway, _ = _google_round_trip()
    app.dependency_overrides[get_oauth_gateway] = lambda: gateway
    try:
        state = create_state_token("google")
        resp = _client().get(f"/api/v1/auth/google/callback?code=c&state={state}")
    finally:
        app.dependency_overrides.pop(get_oauth_gateway, None)

    assert resp.status_code == 200
    assert resp.json()["tokens"]["access_token"]
