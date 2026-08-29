"""Persistence for routes saved by authenticated users.

Like every repository it never commits: the request-scoped session owns
the transaction (see `DbTransactionMiddleware`).
"""

import uuid

from sqlalchemy import func, select
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

    async def update_for_user(
        self,
        user_id: uuid.UUID,
        route_id: uuid.UUID,
        *,
        name: str | None = None,
    ) -> SavedRoute | None:
        """Apply partial edits to one owned route, touching updated_at.

        No-op when nothing to change; None when absent or foreign.
        """
        route = await self.get_for_user(user_id, route_id)
        if route is None:
            return None
        if name is not None:
            route.name = name
            await self.db.flush()
        return route

    async def page_for_user(
        self, user_id: uuid.UUID, *, limit: int, offset: int = 0
    ) -> tuple[list[SavedRoute], int]:
        """One page of newest-first routes plus the caller's total, in one query.

        `count(*) OVER ()` sees the whole match set before OFFSET/LIMIT so the
        total stays correct even on early pages; an empty page (past the end)
        falls back to a count-only query.
        """
        result = await self.db.execute(
            select(SavedRoute, func.count().over().label("total"))
            .where(SavedRoute.user_id == user_id)
            .order_by(SavedRoute.created_at.desc(), SavedRoute.id.desc())
            .offset(offset)
            .limit(limit)
        )
        rows = result.all()
        if not rows:
            return [], await self._count_for_user(user_id)
        return [row[0] for row in rows], rows[0][1]

    async def _count_for_user(self, user_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(SavedRoute).where(
                SavedRoute.user_id == user_id
            )
        )
        return result.scalar_one()
