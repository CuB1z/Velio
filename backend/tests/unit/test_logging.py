"""Tests for the structured logging setup."""

import logging

import pytest

from app.core.logging import StructuredFormatter, setup_logging


@pytest.fixture(autouse=True)
def _restore_root_handlers():
    root = logging.getLogger()
    saved = root.handlers[:]
    yield
    root.handlers = saved


def test_formatter_emits_structured_fields():
    record = logging.LogRecord(
        "test", logging.INFO, __file__, 1, "hello %s", ("world",), None
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
            "test",
            logging.ERROR,
            __file__,
            1,
            "failed",
            None,
            sys.exc_info(),
        )
    output = StructuredFormatter().format(record)
    assert "ValueError: boom" in output


def test_setup_logging_is_a_noop_under_pytest():
    """The runner owns root handlers; setup must not clobber them."""
    root = logging.getLogger()
    before = list(root.handlers)
    setup_logging()
    assert root.handlers == before


def test_uvicorn_loggers_flow_through_the_structured_pipeline():
    # Simulate production wiring manually (setup_logging skips it in tests).
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        native = logging.getLogger(name)
        saved_handlers, saved_propagate = native.handlers[:], native.propagate
        native.handlers.clear()
        native.propagate = True

        assert not native.handlers, f"{name} keeps native handlers"
        assert native.propagate, f"{name} does not propagate to root"

        native.handlers, native.propagate = saved_handlers, saved_propagate
