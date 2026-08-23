"""Refresh token persistence for issuance, rotation and revocation."""

import hashlib

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RefreshToken


def jti_digest(jti: str) -> str:
    """Only hashed jtis touch the database."""
    return hashlib.sha256(jti.encode()).hexdigest()


class RefreshTokenRepository:
    """Store and revoke refresh tokens by their hashed id."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def store(self, user_id: int, jti: str, expires_at) -> None:
        self.db.add(
            RefreshToken(
                user_id=user_id,
                jti_hash=jti_digest(jti),
                expires_at=expires_at,
            )
        )
        await self.db.commit()

    async def find_active_by_jti(self, jti: str) -> RefreshToken | None:
        result = await self.db.execute(
            select(RefreshToken).where(RefreshToken.jti_hash == jti_digest(jti))
        )
        token = result.scalar_one_or_none()
        if token is None or token.revoked:
            return None
        return token

    async def find_any_by_jti(self, jti: str) -> RefreshToken | None:
        result = await self.db.execute(
            select(RefreshToken).where(RefreshToken.jti_hash == jti_digest(jti))
        )
        return result.scalar_one_or_none()

    async def revoke(self, token: RefreshToken) -> None:
        token.revoked = True
        await self.db.commit()

    async def revoke_all_for_user(self, user_id: int) -> None:
        """Kill every live session of the account (e.g. after a password
        change): refreshes die at once, access tokens expire on their own."""
        await self.db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
            .values(revoked=True)
        )
        await self.db.commit()
