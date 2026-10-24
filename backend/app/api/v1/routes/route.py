"""Point-to-point routing, standalone analysis and saved-route endpoints."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import (
    allow_public_caching,
    get_analysis_service,
    get_current_user,
    get_dem_source,
    get_route_service,
    get_saved_route_service,
)
from app.api.v1.exports import export_response
from app.engine.dem import DemSource
from app.models import User
from app.schemas.analysis import AnalysisResponse, ElevationResponse, PolylineRequest
from app.schemas.common import PaginatedResponse
from app.schemas.route import RouteCreateRequest, RouteResponse
from app.schemas.saved_route import (
    SavedRouteCreateRequest,
    SavedRouteResponse,
    SavedRouteUpdateRequest,
)
from app.services.analysis_service import RouteAnalysisService
from app.services.route_service import RouteService
from app.services.saved_route_service import SavedRouteService

router = APIRouter(prefix="/routes", tags=["routes"])


@router.post("", response_model=RouteResponse)
async def create_route(
    data: RouteCreateRequest,
    service: RouteService = Depends(get_route_service),
    _: User = Depends(get_current_user),
    dem: DemSource = Depends(get_dem_source),
    _cache: None = Depends(allow_public_caching),
    response_format: Literal["json", "gpx", "geojson"] = Query(
        default="json", alias="format"
    ),
):
    route_out = await service.generate(data)
    if response_format == "json":
        return route_out
    return export_response(route_out, dem, response_format, kind="route")


@router.post("/analyze", response_model=AnalysisResponse)
async def route_analyze(
    data: PolylineRequest,
    _: User = Depends(get_current_user),
    _cache: None = Depends(allow_public_caching),
    service: RouteAnalysisService = Depends(get_analysis_service),
):
    """Score an existing encoded polyline without re-routing it."""
    return await service.analyze(data)


@router.post("/elevation", response_model=ElevationResponse)
async def route_elevation(
    data: PolylineRequest,
    _: User = Depends(get_current_user),
    _cache: None = Depends(allow_public_caching),
    service: RouteAnalysisService = Depends(get_analysis_service),
):
    """DEM elevation profile for an existing encoded polyline."""
    return service.elevation(data)


# Saved routes ----------------------------------------------------------------


@router.get("/saved", response_model=PaginatedResponse[SavedRouteResponse])
async def list_saved_routes(
    limit: int | None = Query(default=None, ge=1, le=200),
    page: int = Query(default=1, ge=1),
    current_user: User = Depends(get_current_user),
    service: SavedRouteService = Depends(get_saved_route_service),
) -> PaginatedResponse[SavedRouteResponse]:
    """The caller's saved routes, newest first (offset pagination)."""
    return await service.list(current_user.id, limit, page)


@router.delete("/saved", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_routes(
    ids: str = Query(...),
    current_user: User = Depends(get_current_user),
    service: SavedRouteService = Depends(get_saved_route_service),
) -> None:
    """Bulk-delete owned saved routes (comma-separated ids, max 50)."""
    await service.delete_many(current_user.id, ids)


@router.post(
    "/saved", response_model=SavedRouteResponse, status_code=status.HTTP_201_CREATED
)
async def save_route(
    data: SavedRouteCreateRequest,
    current_user: User = Depends(get_current_user),
    service: SavedRouteService = Depends(get_saved_route_service),
) -> SavedRouteResponse:
    """Store one compute result under a name."""
    return await service.create(current_user.id, name=data.name, payload=data.payload)


@router.get("/saved/{route_id}", response_model=SavedRouteResponse)
async def get_saved_route(
    route_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: SavedRouteService = Depends(get_saved_route_service),
) -> SavedRouteResponse:
    """One owned saved route; foreign ids are indistinguishable from missing."""
    return await service.get(current_user.id, route_id)


@router.delete("/saved/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_route(
    route_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: SavedRouteService = Depends(get_saved_route_service),
) -> None:
    """Remove one owned saved route."""
    await service.delete(current_user.id, route_id)


@router.patch("/saved/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
async def update_saved_route(
    route_id: uuid.UUID,
    data: SavedRouteUpdateRequest,
    current_user: User = Depends(get_current_user),
    service: SavedRouteService = Depends(get_saved_route_service),
) -> None:
    """Partially edit one owned saved route (name today, more later)."""
    await service.update(current_user.id, route_id, name=data.name)
