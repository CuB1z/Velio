"""User riding profiles: costing options plus scoring weights.

Each profile shapes both how Valhalla picks roads (costing) and how the
multi-factor score weighs its components (weights). They mirror the
original specification: fast, safe, fitness and relaxed.
"""

from dataclasses import dataclass

from .cycling_score import Weights


@dataclass(frozen=True)
class RidingProfile:
    """Named riding style applied to routing and scoring."""

    name: str
    description: str
    costing: dict
    weights: Weights


RIDING_PROFILES: dict[str, RidingProfile] = {
    "fast": RidingProfile(
        name="fast",
        description="Time and distance first; bigger roads are acceptable.",
        costing={"bicycle_type": "Road", "use_roads": 1.0},
        weights=Weights(distance=0.50, safety=0.20, elevation=0.30),
    ),
    "safe": RidingProfile(
        name="safe",
        description="Quiet roads, cycle infrastructure and good surfaces.",
        costing={
            "bicycle_type": "Hybrid",
            "use_roads": 0.4,
            "avoid_bad_surfaces": 1.0,
        },
        weights=Weights(distance=0.25, safety=0.55, elevation=0.20),
    ),
    "fitness": RidingProfile(
        name="fitness",
        description="Training rides: distance and climbing matter most.",
        costing={"bicycle_type": "Road", "use_hills": 1.0},
        weights=Weights(distance=0.30, safety=0.15, elevation=0.55),
    ),
    "relaxed": RidingProfile(
        name="relaxed",
        description="Easy spinning: little traffic and gentle terrain.",
        costing={
            "bicycle_type": "Hybrid",
            "use_hills": 0.2,
            "avoid_bad_surfaces": 1.0,
        },
        weights=Weights(distance=0.25, safety=0.40, elevation=0.35),
    ),
}
