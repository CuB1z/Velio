"""Shared test configuration: hermetic env pinned before any app import,
one Postgres container per session, schema built by the real Alembic
migrations."""

import asyncio
import atexit
import gzip
import os
import struct
import tempfile

from testcontainers.community.postgres import PostgresContainer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _synthetic_elevation_dir() -> str:
    root = tempfile.mkdtemp(prefix="velio-dem-")
    os.makedirs(os.path.join(root, "N40"))
    values = [600 + 10 * (row + col) for row in range(11) for col in range(11)]
    with gzip.open(os.path.join(root, "N40", "N40W004.hgt.gz"), "wb") as fh:
        fh.write(struct.pack(f">{len(values)}h", *values))
    return root


def _postgres_address() -> tuple[str, str]:
    """One container per test process, even though pytest and the test
    modules import this file twice (as a plugin and as tests.conftest)."""
    if "VELIO_TEST_PG_PORT" not in os.environ:
        container = PostgresContainer(
            "postgres:16-alpine",
            username="velio",
            password="velio",
            dbname="velio_test",
        )
        try:
            container.start()
        except Exception as exc:
            raise SystemExit(
                f"The backend tests need Docker to start Postgres: {exc}"
            ) from exc
        atexit.register(container.stop)
        os.environ["VELIO_TEST_PG_HOST"] = container.get_container_host_ip()
        os.environ["VELIO_TEST_PG_PORT"] = str(container.get_exposed_port(5432))
    return os.environ["VELIO_TEST_PG_HOST"], os.environ["VELIO_TEST_PG_PORT"]


PG_HOST, PG_PORT = _postgres_address()

# --- Hermetic environment ----------------------------------------------------
# Pinned before the app import so pydantic-settings never falls back to the
# developer's .env (real credentials or databases).
HERMETIC_ENV = {
    "ENV": "dev",
    "OTP_TEST_MODE": "false",
    "DB_DRIVER": "postgresql+asyncpg",
    "DB_NAME": "velio_test",
    "DB_HOST": PG_HOST,
    "DB_PORT": PG_PORT,
    "DB_USER": "velio",
    "DB_PASSWORD": "velio",
    "JWT_SECRET_KEY": "test-secret-key-for-testing-only",
    "VALHALLA_URL": "http://localhost:8002",
    "VALHALLA_ELEVATION_DIR": _synthetic_elevation_dir(),
    "BREVO_API_KEY": "",
    "BREVO_LIST_ID": "0",
    "MAIL_FROM": "no-reply@test.dev",
    "RATE_LIMIT_ENABLED": "false",
}
os.environ.update(HERMETIC_ENV)


def _unpooled_engine() -> None:
    """Fresh connection per session: the suite runs several event loops
    (TestClient's and asyncio.run's) and asyncpg ties each connection to
    the loop that opened it."""
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.pool import NullPool

    from app.core import database

    database.engine = create_async_engine(
        database.settings.database_url, poolclass=NullPool
    )
    database.SessionLocal.configure(bind=database.engine)


_unpooled_engine()

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
    # The suite drives asyncio via asyncio.run(); silence pytest-asyncio's
    # loop-policy deprecation.
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

PASSWORD = "Secret-123"


def _pin_hermetic_settings() -> None:
    """Pin settings an empty env var cannot mask (env_ignore_empty=True)."""
    from app.core.config import settings

    # JSON callback is the baseline; SPA-redirect tests opt in themselves.
    settings.oauth_success_redirect = None
    settings.restricted_areas_path = None


def _require_hermetic_settings() -> None:
    """Fail loudly when a real external endpoint leaked into settings."""
    from app.core.config import settings

    assert not settings.brevo_api_key, "a real Brevo API key leaked into tests"
    assert not settings.brevo_list_id, "a real Brevo list id leaked into tests"
    assert settings.db_host == HERMETIC_ENV["DB_HOST"], "the test database leaked"
    assert settings.db_port == int(HERMETIC_ENV["DB_PORT"]), "the test database leaked"
    assert settings.jwt_secret_key == HERMETIC_ENV["JWT_SECRET_KEY"]
    # JSON callback is the baseline (see _pin_hermetic_settings).
    assert not settings.oauth_success_redirect, "a real SPA redirect leaked into tests"


_pin_hermetic_settings()
_require_hermetic_settings()


class _ListHandler(logging.Handler):
    def __init__(self):
        super().__init__()
        self.messages: list[str] = []

    def emit(self, record):
        self.messages.append(record.getMessage())


@contextmanager
def mail_capture():
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
    return mail_capture


def verification_code(messages: list[str]) -> str:
    """Extract the last OTP logged by the console mail sender."""
    found = re.findall(r"verification code is (\d{6})", "\n".join(messages))
    assert found, f"no verification code logged in: {messages}"
    return found[-1]


def unique_email() -> str:
    return f"user-{uuid.uuid4().hex}@test.dev"


def register_account(email: str, *, full_name: str = "") -> str:
    """Register one fresh account through the API; return its live OTP."""
    with mail_capture() as messages:
        resp = TestClient(app).post(
            "/api/v1/auth/register",
            json={"email": email, "password": PASSWORD, "full_name": full_name},
        )
    assert resp.status_code == 201, resp.text
    return verification_code(messages)


def register_and_verify(client: TestClient, email: str) -> None:
    """Drive an account from PENDING to ACTIVE through the real endpoints."""
    code = register_account(email, full_name="Test")
    resp = client.post(
        "/api/v1/auth/verify",
        json={"email": email, "code": code},
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
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert resp.status_code == 200, resp.text
    tokens = resp.json()["tokens"]
    return {"Authorization": f"Bearer {tokens['access_token']}"}


class AuthorizedClient:
    """TestClient that attaches the session Bearer token to every call."""

    def __init__(self, inner: TestClient, authorization: str):
        self._inner = inner
        self._authorization = authorization

    def get(self, url: str, **kwargs):
        kwargs.setdefault("headers", {"Authorization": self._authorization})
        return self._inner.get(url, **kwargs)

    def post(self, url: str, **kwargs):
        kwargs.setdefault("headers", {"Authorization": self._authorization})
        return self._inner.post(url, **kwargs)
