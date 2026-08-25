"""Service tests for saved routes: ownership errors and limit clamping."""

import asyncio
import uuid

import pytest

from app.core.database import SessionLocal
from app.core.exceptions import NotFoundError
from app.models import User, UserStatus
from app.repositories.saved_route_repository import SavedRouteRepository
from app.services.saved_route_service import MAX_LIST_LIMIT, SavedRouteService


def _seed_user(db) -> User:
    user = User(
        email=f"svc-{uuid.uuid4().hex}@rider.dev",
        hashed_password="irrelevant",
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    return user


def test_saved_route_service_behaviours():
    async def scenario():
        async with SessionLocal() as db:
            owner = _seed_user(db)
            stranger = _seed_user(db)
            await db.commit()

            service = SavedRouteService(SavedRouteRepository(db))

            created = await service.create(
                owner.id, name="Navacerrada", payload={"polyline": "xyz"}
            )
            assert created.created_at is not None
            assert created.payload["polyline"] == "xyz"

            got = await service.get(owner.id, created.id)
            assert got.name == "Navacerrada"

            # Foreign ids are indistinguishable from missing ones.
            with pytest.raises(NotFoundError):
                await service.get(stranger.id, created.id)
            with pytest.raises(NotFoundError):
                await service.delete(stranger.id, created.id)

            for i in range(5):
                await service.create(owner.id, name=f"r{i}", payload={})

            default_list = await service.list(owner.id)
            assert [r.name for r in default_list] == [
                "r4",
                "r3",
                "r2",
                "r1",
                "r0",
                "Navacerrada",
            ]

            # Upper bound: even a huge limit caps at MAX_LIST_LIMIT.
            for i in range(MAX_LIST_LIMIT + 3):
                await service.create(owner.id, name=f"c{i}", payload={})
            capped = await service.list(owner.id, limit=10_000)
            assert len(capped) == MAX_LIST_LIMIT
            assert capped[0].name.startswith("c")

            await service.delete(owner.id, created.id)
            with pytest.raises(NotFoundError):
                await service.get(owner.id, created.id)

    asyncio.run(scenario())
