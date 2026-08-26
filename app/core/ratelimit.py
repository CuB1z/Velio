"""Rate limiting for the API layer.

Reads top-down like a maintainer would: the budgets you tune, the
counter backend behind them, how a request resolves to its budget, and
the enforcement call. One router-level dependency enforces per-endpoint
rules; a global per-IP courtesy ceiling lives in middleware.
"""

import asyncio
import logging
import math
import time
from collections import deque
from typing import Literal

import redis.asyncio as redis_asyncio
from fastapi import Request
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import TimeoutError as RedisTimeoutError

from app.core.config import settings
from app.core.exceptions import RateLimitingError

logger = logging.getLogger(__name__)

PENALTY_BASE_S = 60
PENALTY_MAX_S = 3600

# ---------------------------------------------------------------------------
# Budgets — requests per minute; the part you actually edit.


WINDOW_S = 60

# Each rule may carry an "ip" and/or a "user" budget (None = not limited).
# Code constants on purpose: changes ship through review like any other limit.
RULES: dict[str, dict[Literal["ip", "user"], int | None]] = {
    "/api/v1/auth/register": {"ip": 50, "user": None},
    "/api/v1/auth/login": {"ip": 50, "user": None},
    "/api/v1/auth/verify": {"ip": 30, "user": None},
    "/api/v1/auth/resend-verification": {"ip": 20, "user": None},
    "/api/v1/auth/forgot-password": {"ip": 20, "user": None},
    "/api/v1/auth/reset-password": {"ip": 30, "user": None},
    "/api/v1/auth/refresh": {"ip": 60, "user": None},
    "/api/v1/auth/logout": {"ip": 60, "user": None},
    "/api/v1/auth/me": {"ip": None, "user": 120},
    "/api/v1/auth/me/delete-request": {"ip": None, "user": 3},
    "/api/v1/auth/change-password": {"ip": None, "user": 60},
    "/api/v1/auth/sessions": {"ip": None, "user": 60},
    "/api/v1/auth/sessions/{session_id}": {"ip": None, "user": 60},
    "/api/v1/auth/{provider}/authorize": {"ip": 60, "user": None},
    "/api/v1/auth/{provider}/callback": {"ip": 60, "user": None},
    "/api/v1/routes": {"ip": None, "user": 60},
    "/api/v1/routes/analyze": {"ip": None, "user": 60},
    "/api/v1/routes/elevation": {"ip": None, "user": 60},
    "/api/v1/routes/saved": {"ip": None, "user": 120},
    "/api/v1/routes/saved/{route_id}": {"ip": None, "user": 120},
    "/api/v1/loops": {"ip": None, "user": 60},
}

# Courtesy ceiling applied by middleware to every route, ruled or not.
GLOBAL_RPM = 300


# ---------------------------------------------------------------------------
# Port — budget counters, swappable (memory today, redis tomorrow).


class RateLimiter:
    """Port: budget checkers keyed by opaque strings."""

    async def hit(self, key: str, limit: int, window_s: int) -> int:
        """Record one hit; return seconds until the key frees up (0 = allowed)."""
        raise NotImplementedError


class InMemoryRateLimiter(RateLimiter):
    """Sliding-window log per key with Redis-style ban expiries.

    Exact for single-instance deployments (the current VPS); swap in a
    shared backend when instances scale out. Exhausting a budget plants a
    per-key ban with a fixed expiry (`_bans[key] = deadline`): hammering
    during the ban never extends it, and overflowing again right after
    expiry doubles the next ban (60s doubling, 1h cap). A quiet window
    restores the key.
    """

    SWEEP_INTERVAL_S = 60

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}
        self._bans: dict[str, float] = {}
        self._strikes: dict[str, int] = {}
        self._last_strike: dict[str, float] = {}
        self._lock = asyncio.Lock()
        self._max_window_s = 0
        self._last_sweep = time.monotonic()

    async def hit(self, key: str, limit: int, window_s: int) -> int:
        """Record one hit; return seconds until the key accepts again."""
        now = time.monotonic()
        async with self._lock:
            if now - self._last_sweep >= self.SWEEP_INTERVAL_S:
                self._sweep(now)

            banned_until = self._bans.get(key)
            if banned_until is not None:
                if now < banned_until:
                    # Pure TTL: hammering during a ban never extends it.
                    return math.ceil(banned_until - now)
                del self._bans[key]
                # Quiet-time is measured from the END of a ban, so an
                # immediate re-overflow still escalates.
                self._last_strike[key] = max(
                    self._last_strike.get(key, -math.inf), banned_until
                )

            stamps = self._hits.setdefault(key, deque())
            cutoff = now - window_s
            while stamps and stamps[0] <= cutoff:
                stamps.popleft()

            if len(stamps) >= limit:
                strike = self._strikes.get(key, 0) + 1
                self._strikes[key] = strike
                self._last_strike[key] = now
                window_wait = math.ceil(stamps[0] + window_s - now)
                penalty = (
                    min(PENALTY_BASE_S * 2 ** (strike - 2), PENALTY_MAX_S)
                    if strike >= 2
                    else 0
                )
                self._bans[key] = now + max(window_wait, penalty)
                return math.ceil(self._bans[key] - now)

            if now - self._last_strike.get(key, -math.inf) >= window_s:
                self._strikes.pop(key, None)
            stamps.append(now)
            self._max_window_s = max(self._max_window_s, window_s)
            return 0

    def reset(self) -> None:
        """Clear every bucket, ban and strike; tests call this between cases."""
        self._hits.clear()
        self._bans.clear()
        self._strikes.clear()
        self._last_strike.clear()

    def _sweep(self, now: float) -> None:
        horizon = now - self._max_window_s
        stale = [k for k, v in self._hits.items() if not v or v[-1] <= horizon]
        for key in stale:
            del self._hits[key]
        expired = [k for k, until in self._bans.items() if until <= now]
        for key in expired:
            del self._bans[key]
        self._last_sweep = now


class RedisRateLimiter(RateLimiter):
    """Redis-backed counters with TTL'd ban keys, ready for scale-out.

    Same semantics as the in-memory adapter: sliding window, per-key bans
    with fixed expiries and escalating re-overflows. Fails OPEN: if Redis
    is unreachable every request is allowed, because availability outranks
    throttling.
    """

    def __init__(
        self,
        url: str | None = None,
        *,
        client: "redis_asyncio.Redis | None" = None,
        penalty_base_s: int = PENALTY_BASE_S,
        penalty_max_s: int = PENALTY_MAX_S,
    ):
        if client is not None:
            self._client = client
        elif url:
            self._client = redis_asyncio.from_url(
                url,
                decode_responses=True,
                socket_connect_timeout=0.05,
                socket_timeout=0.05,
            )
        else:
            raise ValueError("RedisRateLimiter needs a url or a client")
        self._penalty_base_s = penalty_base_s
        self._penalty_max_s = penalty_max_s

    async def hit(self, key: str, limit: int, window_s: int) -> int:
        now = time.time()
        hit_key, ban_key, strike_key = (
            f"rl:hit:{key}",
            f"rl:ban:{key}",
            f"rl:strike:{key}",
        )
        try:
            # O(1) ban fast-path before touching the window.
            if await self._client.exists(ban_key):
                ttl = await self._client.ttl(ban_key)
                if ttl > 0:
                    return ttl

            pipe = self._client.pipeline(transaction=True)
            pipe.zadd(hit_key, {str(now): now})
            pipe.zremrangebyscore(hit_key, 0, now - window_s)
            pipe.zcard(hit_key)
            pipe.expire(hit_key, window_s * 2)
            _, _, count, _ = await pipe.execute()
            # The ZADD above already counted THIS request: overflow is
            # strictly greater than.
            if count <= limit:
                return 0

            strike = await self._client.incr(strike_key)
            await self._client.expire(strike_key, window_s)
            oldest = await self._client.zrange(hit_key, 0, 0, withscores=True)
            window_wait = math.ceil(oldest[0][1] + window_s - now) if oldest else 1
            penalty = 0
            if strike >= 2:
                penalty = min(
                    self._penalty_base_s * 2 ** (strike - 2), self._penalty_max_s
                )
            ban_for = max(window_wait, penalty, 1)
            await self._client.setex(ban_key, ban_for, 1)
            return ban_for
        except (RedisConnectionError, RedisTimeoutError) as exc:
            logger.warning(f"rate limiter fail-open: {exc}")
            return 0

    async def reset(self) -> None:
        """Drop every rate-limit key; tests call this between cases."""
        keys = [k async for k in self._client.scan_iter(match="rl:*")]
        if keys:
            await self._client.delete(*keys)


def build_rate_limiter() -> RateLimiter:
    """Pick the limiter backend from settings."""
    if settings.rate_limit_backend == "redis":
        if not settings.redis_url:
            raise RuntimeError("RATE_LIMIT_BACKEND=redis requires REDIS_URL")
        return RedisRateLimiter(settings.redis_url)
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
