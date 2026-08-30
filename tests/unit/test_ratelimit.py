"""Unit tests for the rate limiting port and its memory adapter."""

import asyncio
import time

import pytest

from redis.exceptions import ConnectionError as RedisConnectionError

from app.core.ratelimit import (
    InMemoryRateLimiter,
    RateLimiter,
    RedisRateLimiter,
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


# ---------------------------------------------------------------------------
# Contract parity: both adapters must satisfy the same behaviour.


class _FakeAsyncRedis:
    """Minimal async stand-in for the handful of commands the adapter uses."""

    def __init__(self):
        self.strings: dict[str, str] = {}
        self.zsets: dict[str, list[tuple[float, str]]] = {}
        self.expiry: dict[str, float] = {}
        self.down = False

    def _check(self):
        if self.down:
            raise RedisConnectionError("redis is down")

    @staticmethod
    def _alive(key, expiry):
        return expiry.get(key, 0) > time.time()

    async def exists(self, key):
        self._check()
        return int(self._alive(key, self.expiry))

    async def ttl(self, key):
        self._check()
        return (
            max(0, int(self.expiry[key] - time.time()))
            if self._alive(key, self.expiry)
            else -2
        )

    async def incr(self, key):
        self._check()
        value = int(self.strings.get(key, 0)) + 1
        self.strings[key] = str(value)
        return value

    async def expire(self, key, seconds):
        self._check()
        self.expiry[key] = time.time() + seconds

    async def setex(self, key, seconds, value):
        self._check()
        self.strings[key] = value
        self.expiry[key] = time.time() + seconds

    async def delete(self, *keys):
        self._check()
        for key in keys:
            self.strings.pop(key, None)
            self.zsets.pop(key, None)
            self.expiry.pop(key, None)

    def pipeline(self, transaction=True):
        outer = self

        class _Pipe:
            def __init__(self):
                self.ops = []

            def zadd(self, key, mapping):
                for member, score in mapping.items():
                    self.ops.append(
                        lambda k=key, m=member, s=score: outer.zsets.setdefault(
                            k, []
                        ).append((m, s))
                    )
                return self

            def zremrangebyscore(self, key, low, high):
                self.ops.append(lambda k=key: outer.zsets.__setitem__(
                    k, [x for x in outer.zsets.get(k, []) if not (low <= x[1] <= high)]
                ) or None)
                return self

            def zcard(self, key):
                self.ops.append(lambda k=key: len(outer.zsets.get(k, [])))
                return self

            def expire(self, key, seconds):
                self.ops.append(lambda k=key, s=seconds: outer.expire(k, s))
                return self

            async def execute(self):
                outer._check()
                results = []
                for op in self.ops:
                    out = op()
                    if asyncio.iscoroutine(out):
                        out = await out
                    results.append(out)
                return results

        return _Pipe()

    async def zrange(self, key, start, end, withscores=False):
        self._check()
        entries = sorted(
            self.zsets.get(key, []), key=lambda x: x[1]
        )[start : end + 1 or None]
        return entries if withscores else [m for m, s in entries]

    async def scan_iter(self, match="*"):
        import fnmatch

        self._check()
        seen = set()
        for source in (self.strings, self.zsets, list(self.expiry)):
            for key in list(source):
                if key not in seen and fnmatch.fnmatchcase(key, match):
                    seen.add(key)
                    yield key


async def _reset(adapter):
    result = adapter.reset()
    if asyncio.iscoroutine(result):
        await result


@pytest.fixture(params=["memory", "redis"], ids=["memory", "redis-fake"])
def adapter(request):
    if request.param == "memory":
        return InMemoryRateLimiter()
    return RedisRateLimiter(
        client=_FakeAsyncRedis(), penalty_base_s=1, penalty_max_s=2
    )


async def _maybe_reset(adapter):
    result = adapter.reset()
    if asyncio.iscoroutine(result):
        await result


def test_contract_burst_then_deny_reports_wait(adapter):
    async def run():
        for _ in range(2):
            assert await adapter.hit("k", 2, 60) == 0
        return await adapter.hit("k", 2, 60)

    assert asyncio.run(run()) > 0


def test_contract_reset_clears_bans_and_strikes(adapter):
    async def run():
        for _ in range(4):
            await adapter.hit("k", 2, 60)
        await _maybe_reset(adapter)
        return await adapter.hit("k", 2, 60)

    assert asyncio.run(run()) == 0


def test_contract_keys_are_isolated(adapter):
    async def run():
        for _ in range(2):
            await adapter.hit("a", 2, 60)
        return await adapter.hit("b", 2, 60)

    assert asyncio.run(run()) == 0


def test_contract_fail_open_when_backend_down(adapter):
    async def run():
        if hasattr(adapter, "_client"):
            adapter._client.down = True
        return await adapter.hit("k", 2, 60)

    assert asyncio.run(run()) == 0
