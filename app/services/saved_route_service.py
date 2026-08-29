"""Saved-route use cases: create, owned fetch/delete and clamped listing."""

import uuid

from app.core.exceptions import NotFoundError
from app.mappers.saved_route import SavedRouteMapper
from app.repositories.saved_route_repository import SavedRouteRepository
from app.schemas.common import PageMeta, PaginatedResponse
from app.schemas.saved_route import SavedRouteResponse

__all__ = ["SavedRouteService"]

DEFAULT_LIST_LIMIT = 50
MAX_LIST_LIMIT = 200


class SavedRouteService:
    """Single-concern service over the saved-route repository."""

    def __init__(self, routes: SavedRouteRepository):
        self._routes = routes

    async def create(
        self, user_id: uuid.UUID, *, name: str, payload: dict
    ) -> SavedRouteResponse:
        route = await self._routes.create(user_id, name=name, payload=payload)
        return SavedRouteMapper.out(route)

    async def get(self, user_id: uuid.UUID, route_id: uuid.UUID) -> SavedRouteResponse:
        """Owned route or NotFoundError — foreign ids are indistinguishable."""
        route = await self._routes.get_for_user(user_id, route_id)
        if route is None:
            raise NotFoundError("Saved route not found")
        return SavedRouteMapper.out(route)

    async def delete(self, user_id: uuid.UUID, route_id: uuid.UUID) -> None:
        if not await self._routes.delete_for_user(user_id, route_id):
            raise NotFoundError("Saved route not found")

    async def update(
        self,
        user_id: uuid.UUID,
        route_id: uuid.UUID,
        *,
        name: str | None = None,
    ) -> None:
        """Apply partial edits to one owned route; foreign ids are
        indistinguishable from missing."""
        route = await self._routes.update_for_user(user_id, route_id, name=name)
        if route is None:
            raise NotFoundError("Saved route not found")

    async def list(
        self,
        user_id: uuid.UUID,
        limit: int | None = None,
        page: int = 1,
    ) -> PaginatedResponse[SavedRouteResponse]:
        """One page (1-based) of the caller's routes, newest first; a page
        past the last one returns empty data."""
        capped = min(limit if limit is not None else DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT)
        offset = (page - 1) * capped
        routes, total = await self._routes.page_for_user(
            user_id, limit=capped, offset=offset
        )
        total_pages = -(-total // capped)
        return PaginatedResponse[SavedRouteResponse](
            data=[SavedRouteMapper.out(route) for route in routes],
            meta=PageMeta(
                page=page,
                limit=capped,
                total=total,
                total_pages=total_pages,
                is_last=page >= total_pages,
            ),
        )
