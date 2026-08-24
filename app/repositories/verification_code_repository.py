"""Persistence for single-use verification codes."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import VerificationCode


class VerificationCodeRepository:
    """Read/write access to hashed one-time codes, one live per purpose."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def issue(
        self, user_id: uuid.UUID, *, purpose: str, code: str, expires_at: datetime
    ) -> VerificationCode:
        """Store a fresh code, replacing any previous live one."""
        await self.db.execute(
            delete(VerificationCode).where(
                VerificationCode.user_id == user_id,
                VerificationCode.purpose == purpose,
            )
        )
        row = VerificationCode(
            user_id=user_id,
            purpose=purpose,
            code_hash=hash_password(code),
            expires_at=expires_at,
        )
        self.db.add(row)
        await self.db.commit()
        await self.db.refresh(row)
        return row

    async def find_active(
        self, user_id: uuid.UUID, *, purpose: str
    ) -> VerificationCode | None:
        """Return the live code for this purpose or None once expired."""
        result = await self.db.execute(
            select(VerificationCode).where(
                VerificationCode.user_id == user_id,
                VerificationCode.purpose == purpose,
                VerificationCode.expires_at > datetime.now(timezone.utc),
            )
        )
        return result.scalar_one_or_none()

    async def register_attempt(self, code: VerificationCode) -> None:
        """Count one wrong guess against the stored code."""
        code.attempts += 1
        await self.db.commit()

    async def consume(self, code: VerificationCode) -> None:
        """Retire the code so it can never be used again."""
        await self.db.execute(
            delete(VerificationCode).where(VerificationCode.id == code.id)
        )
        await self.db.commit()
