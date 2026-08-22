"""Shared test configuration: registers markers and tames third-party noise."""

import pytest

# pytest-asyncio is installed in the interpreter but this suite drives
# asyncio explicitly through asyncio.run(); silence its Python 3.16
# loop-policy deprecation on every test.
_ASYNCIO_POLICY_FILTER = (
    "ignore:'asyncio.get_event_loop_policy' is deprecated:DeprecationWarning"
)


def pytest_configure(config):
    config.addinivalue_line("markers", "e2e: requires a running Valhalla service")


def pytest_collection_modifyitems(config, items):
    for item in items:
        item.add_marker(pytest.mark.filterwarnings(_ASYNCIO_POLICY_FILTER))
