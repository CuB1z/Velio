"""The loop endpoint as Server-Sent Events."""

import json

from fastapi.testclient import TestClient

from app.api.dependencies import get_loop_service
from app.main import app
from app.services.loop_service import LoopService
from tests.api.test_loops_api import (
    LOOP_BODY,
    ConstantDem,
    FakeValhalla,
    UnreachableValhalla,
)


def stream(valhalla, auth_headers, body=LOOP_BODY):
    app.dependency_overrides[get_loop_service] = lambda: LoopService(
        valhalla=valhalla, dem=ConstantDem()
    )
    try:
        with TestClient(app).stream(
            "POST", "/api/v1/loops/stream", json=body, headers=auth_headers
        ) as resp:
            lines = list(resp.iter_lines())
            return resp, parse(lines)
    finally:
        app.dependency_overrides.pop(get_loop_service, None)


def parse(lines: list[str]) -> list[tuple[str, dict]]:
    events, event = [], None
    for line in lines:
        if line.startswith("event: "):
            event = line[len("event: ") :]
        elif line.startswith("data: ") and event:
            events.append((event, json.loads(line[len("data: ") :])))
            event = None
    return events


def test_progress_then_each_loop_then_the_ranked_result(auth_headers):
    body = {**LOOP_BODY, "routes": 3}
    resp, events = stream(FakeValhalla(distance_km=50.0), auth_headers, body)
    names = [name for name, _ in events]
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")
    assert resp.headers["x-accel-buffering"] == "no"
    assert names[0] == "progress"
    assert names.count("loop") == 3
    assert names[-1] == "result"
    assert names.index("loop") < len(names) - 1
    assert len(events[-1][1]["alternatives"]) == 2


def test_a_failed_generation_ends_with_an_error_event(auth_headers):
    resp, events = stream(UnreachableValhalla(), auth_headers)
    name, payload = events[-1]
    assert resp.status_code == 200
    assert name == "error"
    assert payload["status"] == 503
    assert set(payload) == {"status", "error", "message", "details"}


def test_auth_is_checked_before_streaming():
    resp = TestClient(app).post("/api/v1/loops/stream", json=LOOP_BODY)
    assert resp.status_code == 401
    assert resp.headers["content-type"].startswith("application/json")
