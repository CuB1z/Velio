"""Saved-route use cases: create, owned fetch/delete and clamped listing."""

import uuid

from app.core.exceptions import NotFoundError
from app.mappers.saved_route import SavedRouteMapper
from app.repositories.saved_route_repository import SavedRouteRepository
from app.schemas.saved_route import SavedRouteOut

__all__ = ["SavedRouteService"]

DEFAULT_LIST_LIMIT = 50
MAX_LIST_LIMIT = 200


class SavedRouteService:
    """Single-concern service over the saved-route repository."""

    def __init__(self, routes: SavedRouteRepository):
        self._routes = routes

    async def create(
        self, user_id: uuid.UUID, *, name: str, payload: dict
    ) -> SavedRouteOut:
        route = await self._routes.create(user_id, name=name, payload=payload)
        return SavedRouteMapper.out(route)

    async def get(self, user_id: uuid.UUID, route_id: uuid.UUID) -> SavedRouteOut:
        """Owned route or NotFoundError — foreign ids are indistinguishable."""
        route = await self._routes.get_for_user(user_id, route_id)
        if route is None:
            raise NotFoundError("Saved route not found")
        return SavedRouteMapper.out(route)

    async def delete(self, user_id: uuid.UUID, route_id: uuid.UUID) -> None:
        if not await self._routes.delete_for_user(user_id, route_id):
            raise NotFoundError("Saved route not found")

    async def list(
        self, user_id: uuid.UUID, limit: int | None = None
    ) -> list[SavedRouteOut]:
        capped = min(limit if limit is not None else DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT)
        routes = await self._routes.list_for_user(user_id, capped)
        return [SavedRouteMapper.out(route) for route in routes]
