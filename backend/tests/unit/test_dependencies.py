"""Shared resources behind the dependency providers."""

from app.api.dependencies import get_coverage, provide, reset


def test_a_shared_resource_is_built_once_until_reset():
    first = get_coverage()
    assert get_coverage() is first

    reset()
    try:
        assert get_coverage() is not first
    finally:
        provide(coverage=first)
