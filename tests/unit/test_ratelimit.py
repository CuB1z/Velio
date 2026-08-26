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


def test_ban_is_a_pure_ttl_that_never_extends(monkeypatch):
    clock = _Clock()
    limiter = InMemoryRateLimiter()
    monkeypatch.setattr("app.core.ratelimit.time.monotonic", clock)

    async def run():
        for _ in range(2):
            await limiter.hit("k", 2, 60)
        first = await limiter.hit("k", 2, 60)   # strike 1: window remainder
        hammer_1 = await limiter.hit("k", 2, 60)
        clock.now += 15
        hammer_2 = await limiter.hit("k", 2, 60)
        clock.now += first - 15                 # ban fully expired
        return first, hammer_1, hammer_2, await limiter.hit("k", 2, 60)

    first, hammer_1, hammer_2, after = asyncio.run(run())
    assert first == 60
    assert hammer_1 == 60                       # inside the ban: same deadline
    assert hammer_2 == 45                       # it only counts down
    assert after == 0                           # expired -> accepted


def test_re_overflow_right_after_expiry_doubles_the_ban(monkeypatch):
    clock = _Clock()
    limiter = InMemoryRateLimiter()
    monkeypatch.setattr("app.core.ratelimit.time.monotonic", clock)

    async def run():
        for _ in range(2):
            await limiter.hit("k", 2, 10)
        first = await limiter.hit("k", 2, 10)       # strike 1: ~window
        clock.now += first + 1                      # ban gone, old stamps too
        for _ in range(2):
            await limiter.hit("k", 2, 10)           # fresh traffic refills
        return first, await limiter.hit("k", 2, 10)  # strike 2: doubled

    first, second = asyncio.run(run())
    assert first <= 10
    assert second >= 60                             # penalty floor kicked in


def test_keys_are_isolated(monkeypatch):
    limiter = _clocked_limiter(monkeypatch)

    async def run():
        for _ in range(3):
            await limiter.hit("a", 3, 60)
        return await limiter.hit("b", 3, 60)

    assert asyncio.run(run()) == 0


def test_quiet_window_restores_forgiveness(monkeypatch):
    clock = _Clock()
    limiter = InMemoryRateLimiter()
    monkeypatch.setattr("app.core.ratelimit.time.monotonic", clock)

    async def run():
        for _ in range(2):
            await limiter.hit("k", 2, 60)
        first = await limiter.hit("k", 2, 60)           # strike 1 -> banned 60s
        clock.now += 1
        during_ban = await limiter.hit("k", 2, 60)      # pure countdown
        clock.now += 59                                 # ban just expired
        for _ in range(2):
            await limiter.hit("k", 2, 60)               # re-abuse fills fast
        escalated = await limiter.hit("k", 2, 60)       # strike 2 -> doubled
        clock.now += escalated + 61                     # real quiet period
        await limiter.hit("k", 2, 60)                   # forgiven
        return first, during_ban, escalated, await limiter.hit("k", 2, 60)

    first, during_ban, escalated, after = asyncio.run(run())
    assert first == 60
    assert during_ban == 59
    assert escalated >= 60                              # immediate re-abuse doubles
    assert after == 0                                   # only real quiet forgives



def test_reset_clears_every_bucket():
    limiter = InMemoryRateLimiter()

    async def run():
        for _ in range(5):
            await limiter.hit("k", 3, 60)
        limiter.reset()
        return await limiter.hit("k", 3, 60)

    assert asyncio.run(run()) == 0
