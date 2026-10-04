"""Unit tests for the bike catalogue and the two riding filters."""

import pytest

from app.engine.bikes import BIKES, HILLS, RIDING_WEIGHTS, costing_options_for
from app.engine.cycling_score import SURFACE_QUALITY

SPEC_BIKES = {"road", "city", "gravel", "mtb"}


def test_spec_bikes_are_all_present():
    assert set(BIKES) == SPEC_BIKES
    # Every bike needs its own surface ranking; that is how it filters terrain.
    assert SPEC_BIKES <= set(SURFACE_QUALITY)


def test_weights_are_normalised():
    total = (
        RIDING_WEIGHTS.distance
        + RIDING_WEIGHTS.safety
        + RIDING_WEIGHTS.surface
        + RIDING_WEIGHTS.elevation
    )
    assert total == pytest.approx(1.0)


@pytest.mark.parametrize("name", sorted(SPEC_BIKES))
def test_every_bike_asks_for_quiet_roads(name):
    """Traffic avoidance is not a choice: nobody asks for more cars."""
    costing = BIKES[name].costing
    assert costing["use_roads"] <= 0.3


def test_terrain_bikes_pick_different_bicycle_types():
    """Only `bicycle_type` moves the surface mix (city shares road's on purpose)."""
    types = {BIKES[name].costing["bicycle_type"] for name in ("road", "gravel", "mtb")}
    assert len(types) == 3


def test_only_asphalt_bikes_hard_avoid_bad_surfaces():
    """`avoid_bad_surfaces` is a no-op unless bicycle_type is Road."""
    for name in ("road", "city"):
        assert BIKES[name].costing["bicycle_type"] == "Road"
        assert BIKES[name].costing["avoid_bad_surfaces"] == 1.0
    assert "avoid_bad_surfaces" not in BIKES["gravel"].costing
    assert "avoid_bad_surfaces" not in BIKES["mtb"].costing


def test_the_city_bike_is_the_road_bike_that_refuses_traffic():
    """`Hybrid` ignores avoid_bad_surfaces, so city is a traffic-free road bike."""
    assert BIKES["city"].costing["use_roads"] == 0.0
    assert BIKES["city"].costing["use_roads"] < BIKES["road"].costing["use_roads"]
    # And a compacted greenway suits it where it would not suit 23mm tyres.
    assert SURFACE_QUALITY["city"]["compacted"] > SURFACE_QUALITY["road"]["compacted"]
    assert SURFACE_QUALITY["city"]["dirt"] < 0.3


def test_surface_rankings_disagree_about_dirt():
    """A farm track is a puncture for a road bike and the point for gravel."""
    assert SURFACE_QUALITY["road"]["dirt"] < 0.2
    assert SURFACE_QUALITY["gravel"]["dirt"] > 0.8
    assert SURFACE_QUALITY["mtb"]["path"] > SURFACE_QUALITY["road"]["path"] * 5
    # And tarmac the other way round.
    road, mtb = SURFACE_QUALITY["road"], SURFACE_QUALITY["mtb"]
    assert road["paved_smooth"] > mtb["paved_smooth"]


def test_hills_maps_to_use_hills():
    assert HILLS["flat"] < HILLS["rolling"] < HILLS["hilly"]
    assert costing_options_for("road", "hilly")["use_hills"] == 1.0
    assert costing_options_for("road", "flat")["use_hills"] == 0.0


def test_hills_is_independent_of_the_bike():
    """Terrain and climbing are separate questions, so they compose freely."""
    for name in BIKES:
        for hills in HILLS:
            options = costing_options_for(name, hills)
            assert options["bicycle_type"] == BIKES[name].costing["bicycle_type"]
            assert options["use_hills"] == HILLS[hills]


def test_no_filters_leaves_valhalla_defaults():
    assert costing_options_for(None, None) is None
