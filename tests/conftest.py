"""Shared test configuration.

Environment is pinned BEFORE any app import so settings pick the test
database; the schema comes from real Alembic migrations, run once per
session exactly like production startup does.
"""

import asyncio
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

os.environ["DB_DRIVER"] = "sqlite+aiosqlite"
os.environ["DB_NAME"] = os.path.join(ROOT, "test.db")
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only"

import logging  # noqa: E402

import pytest  # noqa: E402


def pytest_configure(config):
    config.addinivalue_line("markers", "e2e: requires a running Valhalla service")
    # pytest-asyncio is installed in the interpreter but this suite drives
    # asyncio explicitly through asyncio.run(); silence its Python 3.16
    # loop-policy deprecation on every test.
    warnings_filter = (
        "ignore:'asyncio.get_event_loop_policy' is deprecated:DeprecationWarning"
    )
    config._test_warning_filter = warnings_filter


def pytest_collection_modifyitems(config, items):
    marker = getattr(pytest.mark, "filterwarnings")(_warning_filter_text())
    for item in items:
        item.add_marker(marker)


def _warning_filter_text() -> str:
    return (
        "ignore:'asyncio.get_event_loop_policy' is deprecated:DeprecationWarning"
    )


@pytest.fixture(scope="session", autouse=True)
def _database():
    """Apply migrations once; every client reuses the migrated schema."""
    from app.core.database import run_migrations

    asyncio.run(run_migrations())
    yield
    asyncio.run(_dispose_engine())


def _dispose_engine():
    from app.core.database import close_db

    return close_db()


# Shared auth helpers --------------------------------------------------------

import re
import uuid
from contextlib import contextmanager

from fastapi.testclient import TestClient

from app.core.logging import get_logger
from app.main import app


class _ListHandler(logging.Handler):
    def __init__(self):
        super().__init__()
        self.messages: list[str] = []

    def emit(self, record):
        self.messages.append(record.getMessage())


@contextmanager
def collect_mail():
    """Capture what the console mail sender logs while the block runs."""
    collector = _ListHandler()
    mail_logger = get_logger("mail")
    previous_level = mail_logger.level
    mail_logger.addHandler(collector)
    mail_logger.setLevel(logging.INFO)
    try:
        yield collector.messages
    finally:
        mail_logger.removeHandler(collector)
        mail_logger.setLevel(previous_level)


def verification_code(messages: list[str]) -> str:
    """Extract the last OTP logged by the console mail sender."""
    found = re.findall(r"verification code is (\d{6})", "\n".join(messages))
    assert found, f"no verification code logged in: {messages}"
    return found[-1]


def register_and_verify(client: TestClient, email: str) -> None:
    """Drive an account from PENDING to ACTIVE through the real endpoints."""
    with collect_mail() as messages:
        resp = client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "secret123", "full_name": "Test"},
        )
    assert resp.status_code == 201, resp.text

    resp = client.post(
        "/api/v1/auth/verify",
        json={"email": email, "code": verification_code(messages)},
    )
    assert resp.status_code == 200, resp.text


@pytest.fixture(scope="session")
def api_client():
    """Long-lived client; lifespan runs once and stays open."""
    with TestClient(app) as client:
        yield client


@pytest.fixture(scope="session")
def auth_headers(api_client) -> dict:
    """Bearer header for a freshly registered, verified throwaway account."""
    email = f"user-{uuid.uuid4().hex}@test.dev"
    register_and_verify(api_client, email)

    resp = api_client.post(
        "/api/v1/auth/login", json={"email": email, "password": "secret123"}
    )
    assert resp.status_code == 200, resp.text
    tokens = resp.json()["tokens"]
    return {"Authorization": f"Bearer {tokens['access_token']}"}
