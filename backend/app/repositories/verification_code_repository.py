"""Persistence for single-use verification codes.

Like every repository it never commits: the request-scoped session owns
the transaction (see `DbTransactionMiddleware`).
"""

import uuid
from datetime import datetime, UTC

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import VerificationCode


class VerificationCodeRepository:
    """Read/write access to hashed one-time codes, one live per purpose."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def issue(
        self, user_id: uuid.UUID, *, purpose: str, code_hash: str, expires_at: datetime
    ) -> VerificationCode:
        """Store a fresh hashed code, replacing any previous live one."""
        await self.db.execute(
            delete(VerificationCode).where(
                VerificationCode.user_id == user_id,
                VerificationCode.purpose == purpose,
            )
        )
        row = VerificationCode(
            user_id=user_id,
            purpose=purpose,
            code_hash=code_hash,
            expires_at=expires_at,
        )
        self.db.add(row)
        await self.db.flush()
        return row

    async def find_active(
        self, user_id: uuid.UUID, *, purpose: str
    ) -> VerificationCode | None:
        """Return the live code for this purpose or None once expired."""
        result = await self.db.execute(
            select(VerificationCode).where(
                VerificationCode.user_id == user_id,
                VerificationCode.purpose == purpose,
                VerificationCode.expires_at > datetime.now(UTC),
            )
        )
        return result.scalar_one_or_none()

    async def register_attempt(self, code: VerificationCode) -> None:
        """Count one wrong guess against the stored code."""
        code.attempts += 1

    async def consume(self, code: VerificationCode) -> None:
        """Retire the code so it can never be used again."""
        await self.db.execute(
            delete(VerificationCode).where(VerificationCode.id == code.id)
        )
