"""Refresh token persistence for issuance, rotation and revocation."""

import hashlib
import uuid

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

    async def store(
        self, user_id: uuid.UUID, jti: str, expires_at, user_agent: str | None = None
    ) -> None:
        self.db.add(
            RefreshToken(
                user_id=user_id,
                jti_hash=jti_digest(jti),
                expires_at=expires_at,
                user_agent=user_agent,
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

    async def revoke_all_for_user(self, user_id: uuid.UUID) -> None:
        """Kill every live session of the account (e.g. after a password
        change): refreshes die at once, access tokens expire on their own."""
        await self.db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
            .values(revoked=True)
        )
        await self.db.commit()

    async def list_live_for_user(self, user_id: uuid.UUID) -> list[RefreshToken]:
        """Live sessions of the account, newest first."""
        result = await self.db.execute(
            select(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
            .order_by(RefreshToken.created_at.desc())
        )
        return list(result.scalars())

    async def revoke_by_id(self, user_id: uuid.UUID, token_id: int) -> bool:
        """Revoke one live session owned by the account; False if absent."""
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.id == token_id,
                RefreshToken.user_id == user_id,
                RefreshToken.revoked.is_(False),
            )
        )
        token = result.scalar_one_or_none()
        if token is None:
            return False
        await self.revoke(token)
        return True

    async def revoke_all_for_user_except(
        self, user_id: uuid.UUID, keep_id: int
    ) -> int:
        """Revoke every live session but `keep_id`; return how many died."""
        live = await self.list_live_for_user(user_id)
        doomed = [t.id for t in live if t.id != keep_id]
        if not doomed:
            return 0
        await self.db.execute(
            update(RefreshToken)
            .where(RefreshToken.id.in_(doomed))
            .values(revoked=True)
        )
        await self.db.commit()
        return len(doomed)
