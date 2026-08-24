"""Async SQLAlchemy engine and request-scoped sessions."""

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
from app.core.exceptions import AppError

_REPO_ROOT = Path(__file__).resolve().parents[2]

engine = create_async_engine(settings.database_url, echo=False)
SessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, autocommit=False, expire_on_commit=False
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield one session per request; the request is the transaction.

    Repositories never commit themselves, so multi-step use cases (verify
    email = consume code + activate account) land atomically. Business
    errors (AppError) still commit: some are answers that carry intended
    side effects — e.g. a replayed refresh token revokes every session of
    the account before the 401 is raised. Bearer resolution does not go
    through here: it uses `lookup_session` so Valhalla-bound handlers
    hold no connection at all.
    """
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except AppError:
            try:
                await session.commit()
            except Exception:  # noqa: BLE001 - poisoned tx, best effort
                await session.rollback()
            raise
        except Exception:
            await session.rollback()
            raise


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
