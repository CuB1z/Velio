"""Offline unit tests for the authentication endpoints."""

import logging
import re
import uuid
from contextlib import contextmanager

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.logging import get_logger
from app.main import app

PASSWORD = "secret123"


class _ListHandler(logging.Handler):
    def __init__(self):
        super().__init__()
        self.messages: list[str] = []

    def emit(self, record):
        self.messages.append(record.getMessage())


@contextmanager
def collect_verification_codes():
    """Capture OTPs logged by the console mail sender inside the block."""
    collector = _ListHandler()
    mail_logger = get_logger("mail")
    previous_level = mail_logger.level
    mail_logger.addHandler(collector)
    mail_logger.setLevel("INFO")
    try:
        yield collector.messages
    finally:
        mail_logger.removeHandler(collector)
        mail_logger.setLevel(previous_level)


def latest_code(messages: list[str]) -> str:
    found = re.findall(r"verification code is (\d{6})", "\n".join(messages))
    assert found, f"no verification code logged: {messages}"
    return found[-1]


def _register(email: str) -> str:
    """Register one fresh account; return its live OTP."""
    with collect_verification_codes() as messages:
        resp = TestClient(app).post(
            "/api/v1/auth/register", json={"email": email, "password": PASSWORD}
        )
    assert resp.status_code == 201, resp.text
    return latest_code(messages)


def _verified_session(email: str) -> tuple[TestClient, dict]:
    """A client plus tokens for an already ACTIVE account."""
    client = TestClient(app)
    verified = client.post(
        "/api/v1/auth/verify", json={"email": email, "code": _register(email)}
    )
    assert verified.status_code == 200, verified.text

    logged = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert logged.status_code == 200, logged.text
    return client, logged.json()["tokens"]


def _unique_email() -> str:
    return f"auth-{uuid.uuid4().hex}@rider.dev"


def test_register_creates_pending_account_without_tokens():
    email = _unique_email()
    with collect_verification_codes():
        resp = TestClient(app).post(
            "/api/v1/auth/register", json={"email": email, "password": PASSWORD}
        )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == email
    assert body["status"] == "pending"
    assert "tokens" not in body


def test_duplicate_register_conflicts():
    email = _unique_email()
    _register(email)
    resp = TestClient(app).post(
        "/api/v1/auth/register", json={"email": email, "password": PASSWORD}
    )
    assert resp.status_code == 409


def test_login_with_wrong_password_fails():
    email = _unique_email()
    _register(email)
    resp = TestClient(app).post(
        "/api/v1/auth/login", json={"email": email, "password": "wrong-pass"}
    )
    assert resp.status_code == 401


def test_login_pending_account_is_forbidden():
    email = _unique_email()
    _register(email)
    resp = TestClient(app).post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert resp.status_code == 403
    assert resp.json()["error"] == "EMAIL_NOT_VERIFIED"


def test_verify_activates_the_account_and_login_opens_a_session():
    email = _unique_email()
    code = _register(email)

    client = TestClient(app)
    resp = client.post("/api/v1/auth/verify", json={"email": email, "code": code})
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"

    logged = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert logged.status_code == 200
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {logged.json()['tokens']['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_verify_rejects_a_wrong_code():
    email = _unique_email()
    _register(email)
    resp = TestClient(app).post(
        "/api/v1/auth/verify", json={"email": email, "code": "000001"}
    )
    assert resp.status_code == 400
    assert resp.json()["error"] == "VERIFY_ERROR"


def test_verify_exhausts_after_max_attempts():
    email = _unique_email()
    code = _register(email)
    client = TestClient(app)

    for _ in range(settings.otp_max_attempts):
        wrong = client.post("/api/v1/auth/verify", json={"email": email, "code": "000002"})
        assert wrong.status_code == 400

    # The right answer no longer helps once the guesses ran out.
    spent = client.post("/api/v1/auth/verify", json={"email": email, "code": code})
    assert spent.status_code == 400


def test_resend_invalidates_the_old_code():
    email = _unique_email()
    old_code = _register(email)

    client = TestClient(app)
    with collect_verification_codes() as messages:
        resent = client.post("/api/v1/auth/resend-verification", json={"email": email})
        assert resent.status_code == 202
    fresh_code = latest_code(messages)

    old = client.post("/api/v1/auth/verify", json={"email": email, "code": old_code})
    assert old.status_code == 400

    new = client.post("/api/v1/auth/verify", json={"email": email, "code": fresh_code})
    assert new.status_code == 200


def test_resend_is_accepted_even_for_unknown_emails():
    resp = TestClient(app).post(
        "/api/v1/auth/resend-verification", json={"email": _unique_email()}
    )
    assert resp.status_code == 202


def test_verify_is_idempotent_once_active():
    email = _unique_email()
    _verified_session(email)
    resp = TestClient(app).post(
        "/api/v1/auth/verify", json={"email": email, "code": "999999"}
    )
    assert resp.status_code == 200


def test_refresh_rotates_and_revokes_the_old_token():
    client, tokens = _verified_session(_unique_email())

    first = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert first.status_code == 200
    new_tokens = first.json()["tokens"]

    # The old refresh token was rotated away: replaying it must fail...
    replay = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert replay.status_code == 401

    # ...and the new pair works.
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {new_tokens['access_token']}"},
    )
    assert me.status_code == 200


def test_logout_revokes_the_refresh_token():
    client, tokens = _verified_session(_unique_email())

    out = client.post(
        "/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]}
    )
    assert out.status_code == 204

    replay = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert replay.status_code == 401


def test_me_without_token_is_unauthorized():
    resp = TestClient(app).get("/api/v1/auth/me")
    assert resp.status_code == 401
