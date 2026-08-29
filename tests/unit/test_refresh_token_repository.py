"""Repository tests for refresh tokens: revocation never commits."""

import asyncio
import uuid
from unittest.mock import AsyncMock

from app.models import RefreshToken
from app.repositories.refresh_token_repository import RefreshTokenRepository


def test_revoke_flushes_without_committing():
    async def scenario():
        db = AsyncMock()
        repo = RefreshTokenRepository(db)
        token = RefreshToken(
            id=1,
            user_id=uuid.uuid4(),
            jti_hash="deadbeef",
            revoked=False,
        )
        await repo.revoke(token)
        db.flush.assert_awaited_once()
        db.commit.assert_not_awaited()

    asyncio.run(scenario())