"""Prometheus exposition at /metrics, closed unless METRICS_ENABLED."""

import secrets

from fastapi import Depends, FastAPI, Request
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import settings
from app.core.exceptions import NotFoundError, UnauthorizedError
from app.core.middleware import METRICS_PATH


def require_metrics_access(request: Request) -> None:
    if not settings.metrics_enabled:
        raise NotFoundError()
    if settings.metrics_token is None:
        return
    supplied = request.headers.get("Authorization", "").encode()
    expected = f"Bearer {settings.metrics_token}".encode()
    if not secrets.compare_digest(supplied, expected):
        raise UnauthorizedError()


def setup_metrics(app: FastAPI, excluded: tuple[str, ...]) -> None:
    Instrumentator(excluded_handlers=[METRICS_PATH, *excluded]).instrument(app).expose(
        app,
        endpoint=METRICS_PATH,
        include_in_schema=False,
        dependencies=[Depends(require_metrics_access)],
    )
