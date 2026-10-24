"""Session management and refresh-token theft detection tests."""
import uuid

from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app
from tests.conftest import PASSWORD, register_account, unique_email

UA_A = {"User-Agent": "RiderApp/1.0"}
UA_B = {"User-Agent": "RiderWeb/2.0"}


def _verified_client(email: str) -> TestClient:
    client = TestClient(app)
    verified = client.post(
        "/api/v1/auth/verify", json={"email": email, "code": register_account(email)}
    )
    assert verified.status_code == 200, verified.text
    return client


def _login(client: TestClient, email: str, headers: dict) -> dict:
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["tokens"]


def _list_sessions(client: TestClient, tokens: dict) -> list[dict]:
    resp = client.get(
        "/api/v1/auth/sessions",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_login_stamps_user_agent_and_marks_current():
    email = unique_email()
    client = _verified_client(email)
    tokens = _login(client, email, UA_A)

    sessions = _list_sessions(client, tokens)
    assert len(sessions) == 1
    assert sessions[0]["current"] is True
    assert sessions[0]["user_agent"] == "RiderApp/1.0"
    assert isinstance(sessions[0]["id"], int)


def test_delete_one_session_and_foreign_rows_404():
    email = unique_email()
    client = _verified_client(email)
    tokens_a = _login(client, email, UA_A)
    tokens_b = _login(client, email, UA_B)

    sessions = _list_sessions(client, tokens_a)
    assert {s["user_agent"] for s in sessions} == {"RiderApp/1.0", "RiderWeb/2.0"}

    other_id = next(s["id"] for s in sessions if not s["current"])
    resp = client.delete(
        f"/api/v1/auth/sessions/{other_id}",
        headers={"Authorization": f"Bearer {tokens_a['access_token']}"},
    )
    assert resp.status_code == 204, resp.text
    assert len(_list_sessions(client, tokens_b)) == 1

    # Already revoked: gone for this account.
    resp = client.delete(
        f"/api/v1/auth/sessions/{other_id}",
        headers={"Authorization": f"Bearer {tokens_a['access_token']}"},
    )
    assert resp.status_code == 404


def test_revoke_others_keeps_caller_session():
    email = unique_email()
    client = _verified_client(email)
    tokens_a = _login(client, email, UA_A)
    _login(client, email, UA_B)
    _login(client, email, UA_B)

    resp = client.delete(
        "/api/v1/auth/sessions",
        headers={"Authorization": f"Bearer {tokens_a['access_token']}"},
    )
    assert resp.status_code == 204, resp.text

    sessions = _list_sessions(client, tokens_a)
    assert len(sessions) == 1
    assert sessions[0]["current"] is True
    assert sessions[0]["user_agent"] == "RiderApp/1.0"


def test_access_without_sid_revokes_everything():
    email = unique_email()
    client = _verified_client(email)
    tokens_a = _login(client, email, UA_A)
    _login(client, email, UA_B)

    # An access token without a usable sid (legacy or forged) still
    # revokes: everything dies, including the caller's own session row.
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens_a['access_token']}"},
    )
    legacy_access = create_access_token(uuid.UUID(me.json()["id"]), email)

    resp = client.delete(
        "/api/v1/auth/sessions",
        headers={"Authorization": f"Bearer {legacy_access}"},
    )
    assert resp.status_code == 204, resp.text
    assert _list_sessions(client, tokens_a) == []


def test_refresh_replay_kills_every_account_session():
    email = unique_email()
    client = _verified_client(email)
    pair_one = _login(client, email, UA_A)
    pair_two = _login(client, email, UA_B)

    # Normal rotation consumes pair_one's refresh...
    rotated = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": pair_one["refresh_token"]}
    )
    assert rotated.status_code == 200, rotated.text
    pair_three = rotated.json()["tokens"]

    # ...replaying it is theft: every live session dies.
    replay = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": pair_one["refresh_token"]}
    )
    assert replay.status_code == 401

    for tokens in (pair_two, pair_three):
        resp = client.post(
            "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
        )
        assert resp.status_code == 401, resp.text

    assert _list_sessions(client, pair_two) == []


def test_garbage_refresh_token_spares_live_sessions():
    email = unique_email()
    client = _verified_client(email)
    tokens = _login(client, email, UA_A)

    resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": f"garbage-{uuid.uuid4().hex}"},
    )
    assert resp.status_code == 401

    sessions = _list_sessions(client, tokens)
    assert len(sessions) == 1
    rotated = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert rotated.status_code == 200, rotated.text
