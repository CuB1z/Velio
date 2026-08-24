"""Unit tests for the rate limiting port and its memory adapter."""

import asyncio

import pytest

from app.core.ratelimit import (
    InMemoryRateLimiter,
    RateLimiter,
    match_rule,
)


def test_match_rule_hits_exact_paths():
    assert match_rule("/api/v1/auth/login") == "/api/v1/auth/login"


def test_match_rule_expands_template_segments():
    path = "/api/v1/auth/google/callback"
    assert match_rule(path) == "/api/v1/auth/{provider}/callback"


def test_match_rule_rejects_unknown_or_shaped_differently():
    assert match_rule("/api/v1/auth/nobody") is None
    assert match_rule("/api/v1/auth/google/callback/extra") is None
    assert match_rule("/api/health") is None


def test_port_refuses_to_run_without_an_adapter():
    with pytest.raises(NotImplementedError):
        asyncio.run(RateLimiter().hit("k", 1, 60))


class _Clock:
    """Stand-in for time.monotonic the tests can advance at will."""

    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def _clocked_limiter(monkeypatch) -> InMemoryRateLimiter:
    limiter = InMemoryRateLimiter()
    monkeypatch.setattr("app.core.ratelimit.time.monotonic", _Clock())
    return limiter


def test_allows_hits_up_to_the_limit_then_reports_retry_after(monkeypatch):
    limiter = _clocked_limiter(monkeypatch)

    async def run():
        for _ in range(3):
            assert await limiter.hit("k", 3, 60) == 0
        return await limiter.hit("k", 3, 60)

    assert asyncio.run(run()) == 60


def test_window_expiry_frees_the_key(monkeypatch):
    clock = _Clock()
    limiter = InMemoryRateLimiter()
    monkeypatch.setattr("app.core.ratelimit.time.monotonic", clock)

    async def run():
        for _ in range(2):
            await limiter.hit("k", 2, 60)
        assert await limiter.hit("k", 2, 60) > 0
        clock.now += 61
        return await limiter.hit("k", 2, 60)

    assert asyncio.run(run()) == 0


def test_sliding_window_drops_only_expired_hits(monkeypatch):
    clock = _Clock()
    limiter = InMemoryRateLimiter()
    monkeypatch.setattr("app.core.ratelimit.time.monotonic", clock)

    async def run():
        await limiter.hit("k", 2, 60)
        clock.now += 30
        await limiter.hit("k", 2, 60)
        # The bucket is full again; retry points at the oldest hit.
        retry = await limiter.hit("k", 2, 60)
        clock.now += 31
        return retry, await limiter.hit("k", 2, 60)

    retry, allowed = asyncio.run(run())
    assert retry == 30
    assert allowed == 0


def test_keys_are_isolated(monkeypatch):
    limiter = _clocked_limiter(monkeypatch)

    async def run():
        for _ in range(3):
            await limiter.hit("a", 3, 60)
        return await limiter.hit("b", 3, 60)

    assert asyncio.run(run()) == 0


def test_reset_clears_every_bucket():
    limiter = InMemoryRateLimiter()

    async def run():
        for _ in range(5):
            await limiter.hit("k", 3, 60)
        limiter.reset()
        return await limiter.hit("k", 3, 60)

    assert asyncio.run(run()) == 0
