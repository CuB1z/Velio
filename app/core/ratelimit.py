"""Rate limiting for the API layer.

Reads top-down like a maintainer would: the budgets you tune, the
counter backend behind them, how a request resolves to its budget, and
the enforcement call. One router-level dependency enforces per-endpoint
rules; a global per-IP courtesy ceiling lives in middleware.
"""

import asyncio
import math
import time
from collections import deque
from typing import Literal

from fastapi import Request

from app.core.exceptions import RateLimitingError

# ---------------------------------------------------------------------------
# Budgets — requests per minute; the part you actually edit.


WINDOW_S = 60

# Each rule may carry an "ip" and/or a "user" budget (None = not limited).
# Code constants on purpose: changes ship through review like any other limit.
RULES: dict[str, dict[Literal["ip", "user"], int | None]] = {
    "/api/v1/auth/register": {"ip": 3, "user": None},
    "/api/v1/auth/login": {"ip": 10, "user": None},
    "/api/v1/auth/verify": {"ip": 10, "user": None},
    "/api/v1/auth/resend-verification": {"ip": 3, "user": None},
    "/api/v1/auth/forgot-password": {"ip": 3, "user": None},
    "/api/v1/auth/reset-password": {"ip": 10, "user": None},
    "/api/v1/auth/refresh": {"ip": 30, "user": None},
    "/api/v1/auth/logout": {"ip": 30, "user": None},
    "/api/v1/auth/me": {"ip": None, "user": 60},
    "/api/v1/auth/change-password": {"ip": None, "user": 60},
    "/api/v1/auth/sessions": {"ip": None, "user": 30},
    "/api/v1/auth/sessions/{session_id}": {"ip": None, "user": 30},
    "/api/v1/auth/{provider}/authorize": {"ip": 30, "user": None},
    "/api/v1/auth/{provider}/callback": {"ip": 30, "user": None},
    "/api/v1/routes": {"ip": None, "user": 30},
    "/api/v1/routes/analyze": {"ip": None, "user": 30},
    "/api/v1/routes/elevation": {"ip": None, "user": 30},
    "/api/v1/routes/saved": {"ip": None, "user": 30},
    "/api/v1/routes/saved/{route_id}": {"ip": None, "user": 30},
    "/api/v1/loops": {"ip": None, "user": 30},
}

# Courtesy ceiling applied by middleware to every route, ruled or not.
GLOBAL_RPM = 120


# ---------------------------------------------------------------------------
# Port — budget counters, swappable (memory today, redis tomorrow).


class RateLimiter:
    """Port: budget checkers keyed by opaque strings."""

    async def hit(self, key: str, limit: int, window_s: int) -> int:
        """Record one hit; return seconds until the key frees up (0 = allowed)."""
        raise NotImplementedError


class InMemoryRateLimiter(RateLimiter):
    """Sliding-window log per key, held in process memory.

    Exact for single-instance deployments (the current VPS); swap in a
    shared backend when instances scale out.
    """

    SWEEP_INTERVAL_S = 60

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}
        self._lock = asyncio.Lock()
        self._max_window_s = 0
        self._last_sweep = time.monotonic()

    async def hit(self, key: str, limit: int, window_s: int) -> int:
        now = time.monotonic()
        async with self._lock:
            if now - self._last_sweep >= self.SWEEP_INTERVAL_S:
                self._sweep(now)
            stamps = self._hits.setdefault(key, deque())
            cutoff = now - window_s
            while stamps and stamps[0] <= cutoff:
                stamps.popleft()
            if len(stamps) >= limit:
                return max(1, math.ceil(stamps[0] + window_s - now))
            stamps.append(now)
            self._max_window_s = max(self._max_window_s, window_s)
            return 0

    def reset(self) -> None:
        """Clear every bucket; tests call this between cases."""
        self._hits.clear()

    def _sweep(self, now: float) -> None:
        horizon = now - self._max_window_s
        stale = [k for k, v in self._hits.items() if not v or v[-1] <= horizon]
        for key in stale:
            del self._hits[key]
        self._last_sweep = now


def build_rate_limiter() -> RateLimiter:
    """Pick the limiter backend."""
    return InMemoryRateLimiter()


limiter = build_rate_limiter()


# ---------------------------------------------------------------------------
# Request matching — which budget applies to this request.


def client_ip(request: Request) -> str | None:
    """Real client address honouring the proxy chain (Dokploy/Traefik)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def match_rule(path: str) -> str | None:
    """Return the RULES template key matching a concrete request path.

    Exact hits short-circuit; templates only differ from paths in their
    "{param}" segments, so a plain segment comparison suffices.
    """
    if path in RULES:
        return path
    for template in RULES:
        parts_template = template.split("/")
        parts_path = path.split("/")
        if len(parts_template) != len(parts_path):
            continue
        if all(
            t == p or (t.startswith("{") and t.endswith("}"))
            for t, p in zip(parts_template, parts_path)
        ):
            return template
    return None


# ---------------------------------------------------------------------------
# Enforcement


async def enforce(path: str, side: Literal["ip", "user"], identity: str) -> None:
    """Charge one hit against RULES[path][side]; 429 when exhausted."""
    retry_after = await limiter.hit(
        f"{path}:{side}:{identity}", RULES[path][side], WINDOW_S
    )
    if retry_after:
        raise RateLimitingError(retry_after)
