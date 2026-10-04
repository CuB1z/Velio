"""Generation stops when the client goes away."""

import asyncio

import pytest

from app.api.streaming import event_stream, unless_disconnected
from app.core.exceptions import ClientDisconnectedError
from app.schemas.loop import LoopCreateRequest
from app.services.loop_service import LoopService
from tests.api.test_loops_api import ConstantDem, FakeValhalla


class FakeRequest:
    def __init__(self, gone_after: float):
        self.gone_after = gone_after

    async def receive(self) -> dict:
        await asyncio.sleep(self.gone_after)
        return {"type": "http.disconnect"}


def test_work_is_cancelled_when_the_client_disconnects():
    cancelled = []

    async def slow():
        try:
            await asyncio.sleep(10)
        except asyncio.CancelledError:
            cancelled.append(True)
            raise

    async def scenario():
        with pytest.raises(ClientDisconnectedError):
            await unless_disconnected(FakeRequest(gone_after=0.05), slow())
        await asyncio.sleep(0)

    asyncio.run(scenario())
    assert cancelled


def test_work_finishes_while_the_client_waits():
    async def quick():
        return 42

    assert asyncio.run(unless_disconnected(FakeRequest(gone_after=5), quick())) == 42


class SlowValhalla(FakeValhalla):
    def __init__(self):
        super().__init__(distance_km=50.0)
        self.routes = 0

    async def route(self, locations, costing_options=None, avoid_locations=None):
        self.routes += 1
        await asyncio.sleep(0.01)
        return await super().route(locations, costing_options, avoid_locations)


def test_closing_the_stream_stops_valhalla_calls():
    valhalla = SlowValhalla()
    service = LoopService(valhalla, ConstantDem())
    data = LoopCreateRequest.model_validate(
        {"origin": {"lat": 40.4168, "lon": -3.7038}, "distance_km": 50, "routes": 4}
    )

    async def scenario() -> tuple[int, int]:
        events = event_stream(lambda emit: service.generate(data, emit))
        first = await anext(events)
        assert first.startswith("event: progress")
        await events.aclose()
        at_close = valhalla.routes
        await asyncio.sleep(0.2)
        return at_close, valhalla.routes

    at_close, later = asyncio.run(scenario())
    assert later == at_close
