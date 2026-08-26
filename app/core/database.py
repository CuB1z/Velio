"""Async SQLAlchemy engine and request-scoped sessions.

The request transaction is owned by `DbTransactionMiddleware`
(core/middleware.py): it opens one session per HTTP request and commits
before the response leaves the server. Dependencies receive that session
through `get_db` in app.api.dependencies. Point reads that must not pin
a pool connection across slow outbound calls use `lookup_session`.
"""

import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

_REPO_ROOT = Path(__file__).resolve().parents[2]

engine = create_async_engine(settings.database_url, echo=False)
SessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, autocommit=False, expire_on_commit=False
)


@asynccontextmanager
async def lookup_session() -> AsyncGenerator[AsyncSession, None]:
    """Short-lived session for point reads (bearer resolution).

    Opens, reads and commits in one go so nothing holds a pool
    connection across the slow outbound calls a handler may make next.
    """
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def _upgrade_head() -> None:
    from alembic import command
    from alembic.config import Config

    config = Config(str(_REPO_ROOT / "migrations" / "alembic.ini"))
    command.upgrade(config, "head")


async def run_migrations() -> None:
    """Apply pending Alembic migrations; safe to call repeatedly."""
    await asyncio.to_thread(_upgrade_head)


async def close_db() -> None:
    await engine.dispose()
