"""Repository tests for saved routes: round-trip, ownership, ordering."""

import asyncio
import uuid

from app.core.database import SessionLocal
from app.models import User, UserStatus
from app.repositories.saved_route_repository import SavedRouteRepository


def _seed_user(db) -> User:
    user = User(
        email=f"sr-{uuid.uuid4().hex}@rider.dev",
        hashed_password="irrelevant",
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    return user


def test_saved_route_repository_roundtrip_and_ownership():
    async def scenario():
        async with SessionLocal() as db:
            owner = _seed_user(db)
            stranger = _seed_user(db)
            await db.commit()

            repo = SavedRouteRepository(db)

            created = await repo.create(
                owner.id,
                name="Algete 70",
                payload={"polyline": "abc", "distance_km": 70.0},
            )
            assert created.id is not None
            assert created.created_at is not None

            fetched = await repo.get_for_user(owner.id, created.id)
            assert fetched is not None and str(fetched.id) == str(created.id)
            assert fetched.payload["distance_km"] == 70.0

            # A foreign caller gets nothing, both on read and delete.
            assert await repo.get_for_user(stranger.id, created.id) is None
            assert await repo.delete_for_user(stranger.id, created.id) is False

            # Listing is newest-first and honours the limit.
            for i in range(3):
                await repo.create(owner.id, name=f"loop-{i}", payload={})
            listed = await repo.list_for_user(owner.id, limit=2)
            assert len(listed) == 2
            assert [r.name for r in listed] == ["loop-2", "loop-1"]

            assert await repo.delete_for_user(owner.id, created.id) is True
            assert await repo.get_for_user(owner.id, created.id) is None

    asyncio.run(scenario())
