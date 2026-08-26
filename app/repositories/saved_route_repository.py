"""Persistence for routes saved by authenticated users.

Like every repository it never commits: the request-scoped session owns
the transaction (see `DbTransactionMiddleware`).
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SavedRoute


class SavedRouteRepository:
    """Read/write access to saved routes, ownership-checked per query."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self, user_id: uuid.UUID, *, name: str, payload: dict
    ) -> SavedRoute:
        route = SavedRoute(user_id=user_id, name=name, payload=payload)
        self.db.add(route)
        await self.db.flush()
        await self.db.refresh(route)
        return route

    async def get_for_user(
        self, user_id: uuid.UUID, route_id: uuid.UUID
    ) -> SavedRoute | None:
        """The route when it exists AND belongs to the caller."""
        result = await self.db.execute(
            select(SavedRoute).where(
                SavedRoute.id == route_id, SavedRoute.user_id == user_id
            )
        )
        return result.scalar_one_or_none()

    async def delete_for_user(self, user_id: uuid.UUID, route_id: uuid.UUID) -> bool:
        """Remove one owned route; False when absent or foreign."""
        route = await self.get_for_user(user_id, route_id)
        if route is None:
            return False
        await self.db.delete(route)
        return True

    async def list_for_user(
        self, user_id: uuid.UUID, limit: int
    ) -> list[SavedRoute]:
        """Newest-first listing capped by SQL-level limit."""
        result = await self.db.execute(
            select(SavedRoute)
            .where(SavedRoute.user_id == user_id)
            .order_by(SavedRoute.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars())
