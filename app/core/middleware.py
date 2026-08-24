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
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.ratelimit import GLOBAL_RPM, WINDOW_S, client_ip, limiter

logger = logging.getLogger(__name__)

HEALTH_PATH = "/api/health"
RATE_LIMIT_SKIP_PREFIXES = ("/docs", "/redoc", "/openapi.json")


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
                        "client_ip": client_ip(request),
                    }
                },
            )


class GlobalRateLimitMiddleware(BaseHTTPMiddleware):
    """Courtesy ceiling: one budget per client IP across every route.

    Sits outside the exception handlers, so it answers with the 429
    envelope directly instead of raising.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if (
            not settings.rate_limit_enabled
            or path == HEALTH_PATH
            or path.startswith(RATE_LIMIT_SKIP_PREFIXES)
        ):
            return await call_next(request)

        retry_after = await limiter.hit(
            f"global:ip:{client_ip(request)}", GLOBAL_RPM, WINDOW_S
        )
        if retry_after:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "RATE_LIMITED",
                    "message": "Too many requests",
                    "details": {},
                },
                headers={"Retry-After": str(retry_after)},
            )
        return await call_next(request)


def setup_middlewares(app: FastAPI) -> None:
    """Install every cross-cutting middleware in one place."""
    app.add_middleware(GlobalRateLimitMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(AccessLogMiddleware)
