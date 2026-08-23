"""Tests for the access-log middleware."""

import logging

import pytest
from fastapi.testclient import TestClient

from app.engine.polyline import encode
from app.main import app

ACCESS_LOGGER = "cycling-router.access"


class _OkValhalla:
    async def trace_attributes(self, polyline, costing_options=None):
        from app.engine.edges import RouteEdge

        return [RouteEdge.from_trace({"length": 1.0, "surface": "paved"})]


def _last_access_record(caplog) -> logging.LogRecord:
    return next(r for r in caplog.records if r.name == ACCESS_LOGGER)


def test_access_log_emits_structured_fields(caplog):
    with caplog.at_level(logging.DEBUG, logger=ACCESS_LOGGER):
        resp = TestClient(app).get("/api/health")

    assert resp.status_code == 200
    data = _last_access_record(caplog).extra_data
    assert data["method"] == "GET"
    assert data["path"] == "/api/health"
    assert data["status"] == 200
    assert isinstance(data["duration_ms"], float)
    assert data["request_id"]


def test_health_is_logged_at_debug_only(caplog):
    caplog.set_level(logging.INFO, logger=ACCESS_LOGGER)
    TestClient(app).get("/api/health")
    assert not [r for r in caplog.records if r.name == ACCESS_LOGGER]


def test_request_id_is_echoed_as_header():
    resp = TestClient(app).get("/api/health")
    request_id = resp.headers["x-request-id"]
    assert len(request_id) == 12


def test_forwarded_for_wins_over_remote_address(caplog):
    with caplog.at_level(logging.DEBUG, logger=ACCESS_LOGGER):
        TestClient(app).get(
            "/api/health", headers={"x-forwarded-for": "203.0.113.7, 10.0.0.1"}
        )

    assert _last_access_record(caplog).extra_data["client_ip"] == "203.0.113.7"


def test_regular_endpoints_log_at_info(caplog):
    class DownValhalla:
        async def trace_attributes(self, polyline, costing_options=None):
            from app.clients.valhalla import ValhallaError

            raise ValhallaError("valhalla down")

    class AnyDem:
        def elevation(self, lat, lon):
            return 0.0

    app.state.valhalla = DownValhalla()
    app.state.dem = AnyDem()
    from app.engine.polyline import encode

    valid_polyline = encode([(40.0, -3.0), (40.01, -3.01)])
    with caplog.at_level(logging.INFO, logger=ACCESS_LOGGER):
        # Unavailable Valhalla answers 503; the access line must exist either way.
        TestClient(app).post(
            "/api/v1/routes/analyze", json={"polyline": valid_polyline}
        )
    records = [r for r in caplog.records if r.name == ACCESS_LOGGER]
    assert records and records[-1].extra_data["status"] == 503


def test_access_line_survives_unhandled_errors(caplog):
    class ExplodingValhalla:
        async def trace_attributes(self, polyline, costing_options=None):
            # Not a ValhallaError: nothing in the app converts this, so it
            # escapes as an unhandled 500.
            raise RuntimeError("boom")

    class AnyDem:
        def elevation(self, lat, lon):
            return 100.0

    app.state.valhalla = ExplodingValhalla()
    app.state.dem = AnyDem()
    polyline = encode([(40.0, -3.0), (40.01, -3.01)])

    with caplog.at_level(logging.INFO, logger=ACCESS_LOGGER):
        with pytest.raises(RuntimeError):
            TestClient(app).post("/api/v1/routes/analyze", json={"polyline": polyline})

    records = [r for r in caplog.records if r.name == ACCESS_LOGGER]
    assert records and records[-1].extra_data["status"] == 500
