"""The two filters that shape a route: which bike, and how much climbing.

The bike sets the terrain (it is the strongest lever on surface mix); hills
sets `use_hills`. Traffic is not a choice: every bike keeps `use_roads` low.
"""

from dataclasses import dataclass

from .cycling_score import Weights

# One weights set for every bike: the bike already changes what counts as good
# surface (SURFACE_QUALITY), so per-bike weights would double-count it.
RIDING_WEIGHTS = Weights(distance=0.30, safety=0.25, surface=0.30, elevation=0.15)


@dataclass(frozen=True)
class Bike:
    """A bike type, and the terrain it implies."""

    name: str
    description: str
    costing: dict


BIKES: dict[str, Bike] = {
    "road": Bike(
        name="road",
        description="Road bike: tarmac, cycleways and quiet lanes.",
        # avoid_bad_surfaces only has an effect with bicycle_type Road.
        costing={
            "bicycle_type": "Road",
            "avoid_bad_surfaces": 1.0,
            "use_roads": 0.3,
        },
    ),
    "city": Bike(
        name="city",
        description="City bike: cycleways and greenways, no traffic, no dirt.",
        # Fallback costing; loops try CITY_URBAN_COSTING first.
        costing={
            "bicycle_type": "Road",
            "avoid_bad_surfaces": 1.0,
            "use_roads": 0.0,
        },
    ),
    "gravel": Bike(
        name="gravel",
        description="Gravel bike: compacted tracks and mixed surfaces.",
        costing={
            "bicycle_type": "Cross",
            "use_roads": 0.2,
        },
    ),
    "mtb": Bike(
        name="mtb",
        description="Mountain bike: tracks, trails and dirt.",
        costing={
            "bicycle_type": "Mountain",
            "use_roads": 0.1,
        },
    ),
}

# City loops try Hybrid first (best against urban traffic) and keep it only
# when the loop stays off loose ground; Hybrid ignores avoid_bad_surfaces.
CITY_URBAN_COSTING: dict = {"bicycle_type": "Hybrid"}
CITY_MAX_LOOSE_SHARE = 0.05
LOOSE_SURFACES = frozenset({"gravel", "dirt", "path", "sand", "impassable"})

HILLS: dict[str, float] = {
    "flat": 0.0,
    "rolling": 0.5,
    "hilly": 1.0,
}


def costing_options_for(
    bike: str | None,
    hills: str | None = None,
    overrides: object | None = None,
) -> dict | None:
    """Bike as the base, hill preference on top, explicit costing last."""
    options: dict = {}
    if bike:
        options.update(BIKES[bike].costing)
    if hills:
        options["use_hills"] = HILLS[hills]
    if overrides is not None:
        dumped = overrides.model_dump(exclude_none=True)  # type: ignore[attr-defined]
        options.update(dumped)
    return options or None


def relax_surface(costing: dict) -> dict:
    """Turn avoid_bad_surfaces 1.0 (a hard constraint that can yield "no path")
    into a preference; every value below 1.0 behaves the same.
    """
    if costing.get("avoid_bad_surfaces", 0.0) < 1.0:
        return costing
    return {**costing, "avoid_bad_surfaces": 0.7}
