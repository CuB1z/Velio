"""Cross-cutting HTTP middleware for the API layer.

Authentication will join later as a router-level dependency (the seam is
`api_router` in `app/api/router.py`); these middlewares stay neutral to it
and guarantee exactly one structured log line per request.
"""

import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings

logger = logging.getLogger(__name__)

HEALTH_PATH = "/api/health"


class AccessLogMiddleware(BaseHTTPMiddleware):
    """Emit one structured access event per request, proxy aware.

    Unhandled exceptions still get their line (status 500) before the
    server error middleware takes over.
    """

    async def dispatch(self, request: Request, call_next):
        started = time.perf_counter()
        request_id = uuid.uuid4().hex[:12]
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000, 1)
            level = (
                logging.DEBUG if request.url.path == HEALTH_PATH else logging.INFO
            )
            logger.log(
                level,
                "request",
                extra={
                    "extra_data": {
                        "request_id": request_id,
                        "method": request.method,
                        "path": request.url.path,
                        "status": status_code,
                        "duration_ms": duration_ms,
                        "client_ip": self._client_ip(request),
                    }
                },
            )

    @staticmethod
    def _client_ip(request: Request) -> str | None:
        """Real client address honouring the proxy chain (Dokploy/Traefik)."""
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else None


def setup_middlewares(app: FastAPI) -> None:
    """Install every cross-cutting middleware in one place."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(AccessLogMiddleware)
