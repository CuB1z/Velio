"""Tests for the access-log middleware."""

import logging

import pytest
from fastapi.testclient import TestClient

from app.engine.polyline import encode
from app.main import app

ACCESS_LOGGER = "app.core.middleware"


class ListHandler(logging.Handler):
    """Captures records straight from the target logger, bypassing root."""

    def __init__(self):
        super().__init__()
        self.records: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record)


@pytest.fixture
def access_events() -> ListHandler:
    handler = ListHandler()
    logger = logging.getLogger(ACCESS_LOGGER)
    old_level = logger.level
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)
    yield handler
    logger.removeHandler(handler)
    logger.setLevel(old_level)


def _last(access_events: ListHandler) -> logging.LogRecord:
    assert access_events.records, "no access events were emitted"
    return access_events.records[-1]


def test_access_log_emits_structured_fields(access_events):
    resp = TestClient(app).get("/api/health")

    assert resp.status_code == 200
    data = _last(access_events).extra_data
    assert data["method"] == "GET"
    assert data["path"] == "/api/health"
    assert data["status"] == 200
    assert isinstance(data["duration_ms"], float)
    assert data["request_id"]


def test_health_is_logged_at_debug_only(access_events):
    import logging as _logging

    logger = logging.getLogger(ACCESS_LOGGER)
    logger.setLevel(_logging.INFO)
    TestClient(app).get("/api/health")
    assert access_events.records == []


def test_request_id_is_echoed_as_header():
    resp = TestClient(app).get("/api/health")
    request_id = resp.headers["x-request-id"]
    assert len(request_id) == 12


def test_forwarded_for_wins_over_remote_address(access_events):
    TestClient(app).get(
        "/api/health", headers={"x-forwarded-for": "203.0.113.7, 10.0.0.1"}
    )

    assert _last(access_events).extra_data["client_ip"] == "203.0.113.7"


def test_regular_endpoints_log_at_info(access_events, auth_headers):
    class DownValhalla:
        async def trace_attributes(self, polyline, costing_options=None):
            from app.core.exceptions import ValhallaError

            raise ValhallaError("valhalla down")

        async def aclose(self):
            pass

    class AnyDem:
        def elevation(self, lat, lon):
            return 0.0

    app.state.valhalla = DownValhalla()
    app.state.dem = AnyDem()

    valid_polyline = encode([(40.0, -3.0), (40.01, -3.01)])
    # Unavailable Valhalla answers 503; the access line must exist either way.
    resp = TestClient(app).post(
        "/api/v1/routes/analyze",
        json={"polyline": valid_polyline},
        headers=auth_headers,
    )

    assert resp.status_code == 503
    assert _last(access_events).extra_data["status"] == 503


def test_access_line_survives_unhandled_errors(access_events, auth_headers):
    class ExplodingValhalla:
        async def trace_attributes(self, polyline, costing_options=None):
            # Not a ValhallaError: nothing in the app converts this, so it
            # escapes as an unhandled 500.
            raise RuntimeError("boom")

        async def aclose(self):
            pass

    class AnyDem:
        def elevation(self, lat, lon):
            return 100.0

    app.state.valhalla = ExplodingValhalla()
    app.state.dem = AnyDem()
    polyline = encode([(40.0, -3.0), (40.01, -3.01)])

    with pytest.raises(RuntimeError):
        TestClient(app).post(
            "/api/v1/routes/analyze",
            json={"polyline": polyline},
            headers=auth_headers,
        )

    assert _last(access_events).extra_data["status"] == 500
