"""Tests for the structured logging setup."""

import logging

import pytest

from app.core.logging import StructuredFormatter, get_logger, setup_logging


@pytest.fixture(autouse=True)
def _restore_root_handlers():
    root = logging.getLogger()
    saved = root.handlers[:]
    yield
    root.handlers = saved


def test_formatter_emits_structured_fields():
    record = logging.LogRecord(
        "cycling-router.test", logging.INFO, __file__, 1, "hello %s", ("world",), None
    )
    record.extra_data = {"distance_km": 70.0, "profile": "safe"}

    output = StructuredFormatter().format(record)

    assert "'message': 'hello world'" in output
    assert "'level': 'INFO'" in output
    assert "distance_km" in output
    assert "profile" in output


def test_formatter_includes_exceptions():
    try:
        raise ValueError("boom")
    except ValueError:
        import sys

        record = logging.LogRecord(
            "cycling-router.test",
            logging.ERROR,
            __file__,
            1,
            "failed",
            None,
            sys.exc_info(),
        )
    output = StructuredFormatter().format(record)
    assert "ValueError: boom" in output


def test_setup_logging_installs_a_single_structured_handler():
    setup_logging()
    root = logging.getLogger()
    assert len(root.handlers) == 1
    assert isinstance(root.handlers[0].formatter, StructuredFormatter)


def test_get_logger_namespaces_under_the_app():
    assert get_logger("services.loop").name == "cycling-router.services.loop"


def test_uvicorn_loggers_flow_through_the_structured_pipeline():
    setup_logging()
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        native = logging.getLogger(name)
        assert not native.handlers, f"{name} keeps native handlers"
        assert native.propagate, f"{name} does not propagate to root"
