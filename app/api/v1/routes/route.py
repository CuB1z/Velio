"""Point-to-point routing, standalone analysis and saved-route endpoints."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import (
    get_analysis_service,
    get_current_user,
    get_dem_source,
    get_route_service,
    get_saved_route_service,
)
from app.api.v1.exports import export_response
from app.engine.dem import DemSource
from app.models import User
from app.schemas.analysis import AnalysisOut, ElevationOut, PolylineIn
from app.schemas.common import PaginatedOut
from app.schemas.route import RouteOut, RouteRequestIn
from app.schemas.saved_route import SavedRouteIn, SavedRouteOut
from app.services.analysis_service import RouteAnalysisService
from app.services.route_service import RouteService
from app.services.saved_route_service import SavedRouteService

router = APIRouter(prefix="/routes", tags=["routes"])


@router.post("", response_model=RouteOut)
async def create_route(
    data: RouteRequestIn,
    service: RouteService = Depends(get_route_service),
    _: User = Depends(get_current_user),
    dem: DemSource = Depends(get_dem_source),
    response_format: Literal["json", "gpx", "geojson"] = Query(
        default="json", alias="format"
    ),
):
    route_out = await service.generate(data)
    if response_format == "json":
        return route_out
    return export_response(route_out, dem, response_format, kind="route")


@router.post("/analyze", response_model=AnalysisOut)
async def analyze_route(
    data: PolylineIn,
    _: User = Depends(get_current_user),
    service: RouteAnalysisService = Depends(get_analysis_service),
):
    """Score an existing encoded polyline without re-routing it."""
    return await service.analyze(data)


@router.post("/elevation", response_model=ElevationOut)
async def route_elevation(
    data: PolylineIn,
    _: User = Depends(get_current_user),
    service: RouteAnalysisService = Depends(get_analysis_service),
):
    """DEM elevation profile for an existing encoded polyline."""
    return service.elevation(data)


# Saved routes ----------------------------------------------------------------


@router.get("/saved", response_model=PaginatedOut[SavedRouteOut])
async def list_saved_routes(
    limit: int | None = Query(default=None, ge=1, le=200),
    page: int = Query(default=1, ge=1),
    current_user: User = Depends(get_current_user),
    service: SavedRouteService = Depends(get_saved_route_service),
) -> PaginatedOut[SavedRouteOut]:
    """The caller's saved routes, newest first (offset pagination)."""
    return await service.list(current_user.id, limit, page)


@router.post("/saved", response_model=SavedRouteOut, status_code=status.HTTP_201_CREATED)
async def save_route(
    data: SavedRouteIn,
    current_user: User = Depends(get_current_user),
    service: SavedRouteService = Depends(get_saved_route_service),
) -> SavedRouteOut:
    """Store one compute result under a name."""
    return await service.create(current_user.id, name=data.name, payload=data.payload)


@router.get("/saved/{route_id}", response_model=SavedRouteOut)
async def get_saved_route(
    route_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: SavedRouteService = Depends(get_saved_route_service),
) -> SavedRouteOut:
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
