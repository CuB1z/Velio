"""Progress and loop events emitted while loops are generated."""

import asyncio

from app.schemas.loop import LoopCreateRequest, LoopResponse
from app.services.loop_service import LoopService
from tests.api.test_loops_api import ConstantDem, FakeValhalla


def run(body: dict) -> tuple[list[tuple[str, dict]], LoopResponse]:
    events: list[tuple[str, dict]] = []
    service = LoopService(FakeValhalla(distance_km=50.0), ConstantDem())
    data = LoopCreateRequest.model_validate(
        {"origin": {"lat": 40.4168, "lon": -3.7038}, "distance_km": 50, **body}
    )

    def emit(event: str, payload: dict) -> None:
        events.append((event, payload))

    result = asyncio.run(service.generate(data, emit=emit))
    return events, result


def test_every_seed_reports_progress_and_every_loop_is_announced():
    events, result = run({"routes": 3})
    seeds = {p["seed"] for e, p in events if e == "progress"}
    loops = [p for e, p in events if e == "loop"]
    assert seeds == {1, 2, 3}
    assert len(loops) == 3
    assert len(result.alternatives or []) == 2
    assert all(loop["alternatives"] is None for loop in loops)


def test_progress_carries_the_attempt_once_routed():
    events, _ = run({})
    routed = [p for e, p in events if e == "progress" and p["iteration"]]
    assert routed and routed[0]["distance_km"] == 50.0


def test_city_loops_are_announced_once_known_firm():
    events, _ = run({"bike": "city"})
    assert [e for e, _ in events].count("loop") == 1
