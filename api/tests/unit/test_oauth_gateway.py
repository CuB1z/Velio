"""Unit tests for the OAuth gateway and provider round trips."""

import asyncio

import httpx
import pytest

from app.clients.oauth import (
    OAuthGateway,
    OAuthRejectedError,
    build_authorize_url,
    get_provider,
)
from app.core.config import settings


@pytest.fixture(autouse=True)
def _configured_providers(monkeypatch):
    """Gateway-level tests assume Google carries credentials."""
    monkeypatch.setattr(settings, "oauth_google_client_id", "g-cid")
    monkeypatch.setattr(settings, "oauth_google_client_secret", "g-secret")


def test_google_requests_identity_and_profile_only():
    # openid+email to identify, profile just for the display name.
    config = get_provider("google")
    assert config.scope == "openid email profile"
    assert "fitness" not in config.scope and "activity" not in config.scope


def test_authorize_url_carries_required_params():
    config = get_provider("google")
    url = build_authorize_url(config, "http://cb", "state123")
    assert url.startswith(config.authorize_url)
    assert "response_type=code" in url
    assert "client_id=" in url
    assert "redirect_uri=http%3A%2F%2Fcb" in url
    assert "scope=openid+email+profile" in url
    assert "state=state123" in url


def test_unknown_provider_raises_key_error():
    with pytest.raises(KeyError):
        get_provider("github")


GOOGLE_PROFILE = {
    "sub": "google-123",
    "email": "rider@gmail.com",
    "name": "Test Rider",
}


def _gateway(handler) -> OAuthGateway:
    return OAuthGateway(transport=httpx.MockTransport(handler))


def test_happy_path_extracts_minimum_identity():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "oauth2.googleapis.com":
            return httpx.Response(200, json={"access_token": "g-tok"})
        return httpx.Response(200, json=GOOGLE_PROFILE)

    gateway = _gateway(handler)
    identity = asyncio.run(
        gateway.exchange("google", "code-1", "http://cb/google/callback")
    )
    assert identity.provider_user_id == "google-123"
    assert identity.email == "rider@gmail.com"
    assert identity.full_name == "Test Rider"


def test_provider_rejection_maps_to_rejected_error():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": "bad code"})

    gateway = _gateway(handler)
    with pytest.raises(OAuthRejectedError):
        asyncio.run(gateway.exchange("google", "bad", "http://cb"))
