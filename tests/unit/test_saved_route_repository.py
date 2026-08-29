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

            # Rename touches the name and moves updated_at forward. SQLite
            # round-trips lose the timezone, so compare on a naive stamp;
            # the rename mutates the same identity-mapped instance, so the
            # pre-rename stamp must be captured first.
            before = created.updated_at.replace(tzinfo=None)
            await asyncio.sleep(0.01)
            first = await repo.update_for_user(owner.id, created.id, name="Toro 60")
            assert first is not None and first.name == "Toro 60"
            updated = first.updated_at.replace(tzinfo=None)
            assert updated >= first.created_at
            assert updated > before
            assert await repo.update_for_user(stranger.id, created.id, name="nope") is None

            # A no-op update returns the route without touching the stamp.
            unchanged = await repo.update_for_user(owner.id, created.id)
            assert unchanged is not None and unchanged.name == "Toro 60"
            assert unchanged.updated_at.replace(tzinfo=None) == updated

            # Listing is newest-first and honours the limit, page + total in one call.
            for i in range(3):
                await repo.create(owner.id, name=f"loop-{i}", payload={})
            listed, total = await repo.page_for_user(owner.id, limit=2)
            assert total == 4
            assert len(listed) == 2
            assert [r.name for r in listed] == ["loop-2", "loop-1"]

            # A page past the end is empty and still reports the total.
            empty, empty_total = await repo.page_for_user(owner.id, limit=2, offset=10)
            assert empty == [] and empty_total == 4

            assert await repo.delete_for_user(owner.id, created.id) is True
            assert await repo.get_for_user(owner.id, created.id) is None

    asyncio.run(scenario())
