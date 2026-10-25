"""Race-condition tests for the user repository unique constraints.

The existence pre-checks can always be fooled by a concurrent writer;
the IntegrityError fallback must answer the same business conflicts.
Both phases share ONE event loop, like a real request would.
"""

import asyncio
import uuid

import pytest

from app.core.database import SessionLocal
from app.core.exceptions import ConflictError, EmailAlreadyRegisteredError
from app.models import User, UserIdentity, UserStatus
from app.repositories.user_repository import UserRepository


def _seed_winner(db, email: str) -> User:
    winner = User(
        email=email,
        hashed_password="irrelevant",
        status=UserStatus.ACTIVE,
    )
    db.add(winner)
    return winner


def _ghost_once(real):
    """Return None on the wrapped method's first call, then behave."""
    async def wrapped(self, *args):
        if not wrapped.used:
            wrapped.used = True
            return None
        return await real(self, *args)

    wrapped.used = False
    return wrapped


def test_unique_races_answer_business_conflicts(monkeypatch):
    async def scenario():
        # Phase 1: concurrent local registration on the same email.
        async with SessionLocal() as db:
            email = f"race-{uuid.uuid4().hex}@rider.dev"
            _seed_winner(db, email)
            await db.commit()

            monkeypatch.setattr(
                UserRepository, "get_by_email", _ghost_once(UserRepository.get_by_email)
            )
            repo = UserRepository(db)
            with pytest.raises(EmailAlreadyRegisteredError):
                await repo.create_local(email=email, hashed_password="x")
            await db.rollback()

        # Phase 2: concurrent OAuth link on the same provider identity.
        async with SessionLocal() as db:
            email = f"link-{uuid.uuid4().hex}@rider.dev"
            winner = _seed_winner(db, email)
            await db.flush()
            db.add(
                UserIdentity(
                    user_id=winner.id,
                    provider="google",
                    provider_user_id=f"race-{uuid.uuid4().hex[:8]}",
                )
            )
            await db.commit()

            monkeypatch.setattr(
                UserRepository,
                "find_identity_user_id",
                _ghost_once(UserRepository.find_identity_user_id),
            )
            monkeypatch.setattr(
                UserRepository,
                "get_by_email",
                _ghost_once(UserRepository.get_by_email),
            )
            repo = UserRepository(db)
            with pytest.raises(ConflictError):
                await repo.get_or_create_oauth(
                    provider="google",
                    provider_user_id=f"race-{uuid.uuid4().hex[:8]}",
                    email=email,
                )
            await db.rollback()

    # Single loop for both phases (see module docstring).
    asyncio.run(scenario())
