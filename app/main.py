"""Cycling-router FastAPI application."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.router import api_router
from app.clients.valhalla import ValhallaClient
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging
from app.core.middleware import setup_middlewares
from app.engine.dem import DemSource


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Shared Valhalla client and DEM source for the whole app lifetime."""
    setup_logging()
    app.state.valhalla = ValhallaClient(
        base_url=settings.valhalla_url, timeout_s=settings.valhalla_timeout_s
    )
    app.state.dem = DemSource(settings.elevation_dir)
    try:
        yield
    finally:
        await app.state.valhalla.aclose()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan,
)

setup_middlewares(app)
register_exception_handlers(app)
app.include_router(api_router)
