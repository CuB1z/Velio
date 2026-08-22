"""FastAPI dependency providers."""

from fastapi import Depends, Request

from app.clients.valhalla import ValhallaClient
from app.engine.dem import DemSource
from app.services.loop_service import LoopService
from app.services.route_service import RouteService


def get_valhalla_client(request: Request) -> ValhallaClient:
    """Shared Valhalla client created at startup."""
    return request.app.state.valhalla


def get_dem_source(request: Request) -> DemSource:
    """Shared DEM source created at startup."""
    return request.app.state.dem


def get_loop_service(
    valhalla: ValhallaClient = Depends(get_valhalla_client),
    dem: DemSource = Depends(get_dem_source),
) -> LoopService:
    """Compose the shared client and DEM source into the loop service."""
    return LoopService(valhalla=valhalla, dem=dem)


def get_route_service(
    valhalla: ValhallaClient = Depends(get_valhalla_client),
    dem: DemSource = Depends(get_dem_source),
) -> RouteService:
    """Compose the shared client and DEM source into the route service."""
    return RouteService(valhalla=valhalla, dem=dem)
