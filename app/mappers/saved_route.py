"""Saved-route model -> HTTP schemas."""

from app.models import SavedRoute
from app.schemas.saved_route import SavedRouteResponse


class SavedRouteMapper:
    """Encapsulates every translation from the SavedRoute model."""

    @staticmethod
    def out(route: SavedRoute) -> SavedRouteResponse:
        return SavedRouteResponse(
            id=route.id,
            name=route.name,
            payload=route.payload,
            created_at=route.created_at,
            updated_at=route.updated_at,
        )
