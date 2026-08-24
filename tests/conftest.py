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

# --- Hermetic environment ----------------------------------------------------
# The ONE place where external touchpoints are forced to test doubles.
# Pinned (never popped) BEFORE importing the app: pydantic-settings reads
# os.environ first and would otherwise fall back to the developer's local
# .env file, leaking real credentials or databases into the suite.
HERMETIC_ENV = {
    "DB_DRIVER": "sqlite+aiosqlite",
    "DB_NAME": os.path.join(ROOT, "test.db"),
    "JWT_SECRET_KEY": "test-secret-key-for-testing-only",
    "BREVO_API_KEY": "",
    "BREVO_LIST_ID": "0",
    "MAIL_FROM": "no-reply@test.dev",
    "RATE_LIMIT_ENABLED": "false",
}
os.environ.update(HERMETIC_ENV)

import logging

import pytest

from app.core.ratelimit import limiter as _rate_limiter


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Keep rate budgets from leaking between test cases."""
    _rate_limiter.reset()
    yield
    _rate_limiter.reset()


def pytest_configure(config):
    config.addinivalue_line("markers", "e2e: requires a running Valhalla service")
    # pytest-asyncio is installed in the interpreter but this suite drives
    # asyncio explicitly through asyncio.run(); silence its Python 3.16
    # loop-policy deprecation on every test.
    config._test_warning_filter = (
        "ignore:'asyncio.get_event_loop_policy' is deprecated:DeprecationWarning"
    )


def pytest_collection_modifyitems(config, items):
    marker = pytest.mark.filterwarnings(config._test_warning_filter)
    for item in items:
        item.add_marker(marker)


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

from app.main import app


def _require_hermetic_settings() -> None:
    """Fail loudly when a real external endpoint leaked into settings."""
    from app.core.config import settings

    assert not settings.brevo_api_key, "a real Brevo API key leaked into tests"
    assert not settings.brevo_list_id, "a real Brevo list id leaked into tests"
    assert settings.database_url.startswith("sqlite"), "the test database leaked"
    assert settings.jwt_secret_key == HERMETIC_ENV["JWT_SECRET_KEY"]


_require_hermetic_settings()


class _ListHandler(logging.Handler):
    def __init__(self):
        super().__init__()
        self.messages: list[str] = []

    def emit(self, record):
        self.messages.append(record.getMessage())


@contextmanager
def _collect_mail():
    """Capture what the console mail sender logs while the block runs."""
    collector = _ListHandler()
    mail_logger = logging.getLogger("app.clients.mail")
    previous_level = mail_logger.level
    mail_logger.addHandler(collector)
    mail_logger.setLevel(logging.INFO)
    try:
        yield collector.messages
    finally:
        mail_logger.removeHandler(collector)
        mail_logger.setLevel(previous_level)


@pytest.fixture
def collect_mail():
    """Fixture wrapper so any test directory can capture mail output."""
    return _collect_mail


def verification_code(messages: list[str]) -> str:
    """Extract the last OTP logged by the console mail sender."""
    found = re.findall(r"verification code is (\d{6})", "\n".join(messages))
    assert found, f"no verification code logged in: {messages}"
    return found[-1]


def register_and_verify(client: TestClient, email: str) -> None:
    """Drive an account from PENDING to ACTIVE through the real endpoints."""
    with _collect_mail() as messages:
        resp = client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "Secret-123", "full_name": "Test"},
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
        "/api/v1/auth/login", json={"email": email, "password": "Secret-123"}
    )
    assert resp.status_code == 200, resp.text
    tokens = resp.json()["tokens"]
    return {"Authorization": f"Bearer {tokens['access_token']}"}
