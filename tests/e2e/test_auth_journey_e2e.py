"""End-to-end auth journey: register, verify from the mail log, ride."""

import logging
import re
import uuid
from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient

from app.core.logging import get_logger
from app.main import app

pytestmark = [pytest.mark.e2e]

PASSWORD = "secret123"


class _ListHandler(logging.Handler):
    def __init__(self):
        super().__init__()
        self.messages: list[str] = []

    def emit(self, record):
        self.messages.append(record.getMessage())


@contextmanager
def collect_verification_codes():
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


def test_full_verification_journey():
    """Registration gates the account until the emailed code lands."""
    client = TestClient(app)
    email = f"journey-{uuid.uuid4().hex}@rider.dev"

    # 1. A fresh registration returns the pending account, never tokens.
    with collect_verification_codes() as messages:
        registered = client.post(
            "/api/v1/auth/register", json={"email": email, "password": PASSWORD}
        )
    assert registered.status_code == 201
    body = registered.json()
    assert body["status"] == "pending"
    assert "tokens" not in body

    # 2. The console sender carried the OTP out through the logs.
    code = latest_code(messages)

    # 3. Logging in before confirming stays forbidden.
    early = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert early.status_code == 403
    assert early.json()["error"] == "EMAIL_NOT_VERIFIED"

    # 4. Confirming the code activates the account...
    verified = client.post("/api/v1/auth/verify", json={"email": email, "code": code})
    assert verified.status_code == 200
    assert verified.json()["status"] == "active"

    # 5. ...and only then a session opens.
    session = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert session.status_code == 200
    tokens = session.json()["tokens"]

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == email
    assert me.json()["status"] == "active"

    # 6. The session survives a refresh rotation.
    rotated = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert rotated.status_code == 200
