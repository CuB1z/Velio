"""Application startup and shutdown.

Keeps main.py minimal: startup loads the shared resources through their
providers so no request pays for it, shutdown releases them.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.dependencies import (
    get_coverage,
    get_dem_source,
    get_mail_sender,
    get_restricted_areas,
    get_valhalla_client,
    reset,
)
from app.core.database import close_db
from app.core.logging import setup_logging

SHARED_RESOURCES = (
    get_valhalla_client,
    get_dem_source,
    get_restricted_areas,
    get_coverage,
    get_mail_sender,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the shared resources on startup and release them on exit."""
    setup_logging()
    for provider in SHARED_RESOURCES:
        provider()
    try:
        yield
    finally:
        await get_valhalla_client().aclose()
        await close_db()
        reset()
