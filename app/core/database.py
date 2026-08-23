"""Async SQLAlchemy engine and request-scoped sessions."""

import asyncio
from collections.abc import AsyncGenerator
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


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield one session per request; always closed afterwards."""
    async with SessionLocal() as session:
        yield session


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
