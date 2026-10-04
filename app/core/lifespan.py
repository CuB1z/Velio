"""Application startup and shutdown helpers.

Keeps main.py minimal: the lifespan wires shared state (Valhalla client,
DEM source) and tears it down on exit.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from app.clients.mail import build_mail_sender
from app.clients.valhalla import ValhallaClient
from app.core.config import settings
from app.core.database import close_db
from app.core.logging import setup_logging
from app.engine.dem import DemSource
from app.engine.restricted import RestrictedAreas

logger = logging.getLogger(__name__)


def load_restricted_areas(path: Path | None) -> RestrictedAreas:
    if path is None or not path.is_file():
        logger.warning(
            "restricted areas not loaded; loops will not avoid them",
            extra={"extra_data": {"path": str(path)}},
        )
        return RestrictedAreas()
    return RestrictedAreas.from_geojson(path)


async def init_state(app: FastAPI) -> None:
    """Create every shared resource and hang it off app.state."""
    setup_logging()
    app.state.valhalla = ValhallaClient(
        base_url=settings.valhalla_url, timeout_s=settings.valhalla_timeout_s
    )
    app.state.dem = DemSource(settings.elevation_dir)
    app.state.restricted = load_restricted_areas(settings.restricted_areas_path)
    app.state.mail = build_mail_sender()


async def shutdown_state(app: FastAPI) -> None:
    """Release the resources created in init_state."""
    await app.state.valhalla.aclose()
    await close_db()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Shared Valhalla client and DEM source for the whole app lifetime."""
    await init_state(app)
    try:
        yield
    finally:
        await shutdown_state(app)
