"""Shared test configuration: registers markers used across suites."""


def pytest_configure(config):
    config.addinivalue_line("markers", "e2e: tests requiring live external services")
