"""Unit tests for the riding profile catalogue."""

import pytest

from app.engine.profiles import RIDING_PROFILES

SPEC_PROFILES = {"fast", "safe", "fitness", "relaxed"}


def test_spec_profiles_are_all_present():
    assert set(RIDING_PROFILES) == SPEC_PROFILES


@pytest.mark.parametrize("name", sorted(SPEC_PROFILES))
def test_every_profile_has_costing_and_normalised_weights(name):
    profile = RIDING_PROFILES[name]
    assert profile.costing, f"{name} lacks costing options"
    total = (
        profile.weights.distance
        + profile.weights.safety
        + profile.weights.elevation
    )
    assert total == pytest.approx(1.0)
    assert all(w > 0 for w in (profile.weights.distance, profile.weights.safety))


def test_fitness_weights_climbing_over_safety():
    fitness = RIDING_PROFILES["fitness"]
    safe = RIDING_PROFILES["safe"]
    assert fitness.weights.elevation > safe.weights.elevation
    assert fitness.weights.safety < safe.weights.safety


def test_safe_weights_safety_over_distance():
    safe = RIDING_PROFILES["safe"]
    fast = RIDING_PROFILES["fast"]
    assert safe.weights.safety > fast.weights.safety
    assert fast.weights.distance > safe.weights.distance
