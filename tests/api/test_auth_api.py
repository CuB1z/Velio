"""Offline unit tests for the authentication endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

REGISTER = {"email": "auth-test@rider.dev", "password": "secret123"}


@pytest.fixture(scope="module")
def session_tokens() -> dict:
    with TestClient(app) as client:
        resp = client.post("/api/v1/auth/register", json=REGISTER)
        assert resp.status_code == 201
        yield resp.json()["tokens"]


def _login() -> TestClient:
    return TestClient(app)


def test_register_returns_user_and_tokens(session_tokens):
    with _login() as client:
        me = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {session_tokens['access_token']}"},
        )
    assert me.status_code == 200
    assert me.json()["email"] == REGISTER["email"]


def test_duplicate_register_conflicts():
    with _login() as client:
        resp = client.post("/api/v1/auth/register", json=REGISTER)
    assert resp.status_code == 409


def test_login_with_wrong_password_fails():
    with _login() as client:
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": REGISTER["email"], "password": "wrong-pass"},
        )
    assert resp.status_code == 401


def test_refresh_rotates_and_revokes_the_old_token(session_tokens):
    with _login() as client:
        first = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": session_tokens["refresh_token"]},
        )
        assert first.status_code == 200
        new_tokens = first.json()["tokens"]

        # The old refresh token was rotated away: replaying it must fail...
        replay = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": session_tokens["refresh_token"]},
        )
        assert replay.status_code == 401

        # ...and the new pair works.
        me = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {new_tokens['access_token']}"},
        )
        assert me.status_code == 200


def test_logout_revokes_the_refresh_token():
    with _login() as client:
        registered = client.post("/api/v1/auth/register", json={
            "email": "logout-test@rider.dev", "password": "secret123"
        })
        tokens = registered.json()["tokens"]

        out = client.post("/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]})
        assert out.status_code == 204

        replay = client.post(
            "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
        )
        assert replay.status_code == 401


def test_me_without_token_is_unauthorized():
    with _login() as client:
        resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401
