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

import uuid  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def api_client():
    """Long-lived client; lifespan runs once and stays open."""
    with TestClient(app) as client:
        yield client


@pytest.fixture(scope="session")
def auth_headers(api_client) -> dict:
    """Bearer header for a freshly registered throwaway account."""
    email = f"user-{uuid.uuid4().hex}@test.dev"
    resp = api_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "secret123", "full_name": "Test"},
    )
    assert resp.status_code == 201, resp.text
    tokens = resp.json()["tokens"]
    return {"Authorization": f"Bearer {tokens['access_token']}"}
