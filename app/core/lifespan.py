"""Application startup and shutdown helpers.

Keeps main.py minimal: the lifespan wires shared state (Valhalla client,
DEM source) and tears it down on exit.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.clients.mail import build_mail_sender
from app.clients.valhalla import ValhallaClient
from app.core.config import settings
from app.core.database import close_db
from app.core.logging import setup_logging
from app.core.ratelimit import limiter as rate_limiter
from app.engine.dem import DemSource


async def init_state(app: FastAPI) -> None:
    """Create every shared resource and hang it off app.state."""
    setup_logging()
    app.state.valhalla = ValhallaClient(
        base_url=settings.valhalla_url, timeout_s=settings.valhalla_timeout_s
    )
    app.state.dem = DemSource(settings.elevation_dir)
    app.state.mail = build_mail_sender()
    app.state.rate_limiter = rate_limiter


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
