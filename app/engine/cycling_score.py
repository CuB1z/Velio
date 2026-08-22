"""Multi-factor 0-10 quality score for cycling routes.

Combines how close the ride is to the requested distance (S_dist), how
friendly its roads are to bikes (S_safe, length-weighted from Valhalla
edge attributes) and how much of it repeats already-ridden roads
(P_overlap):

    total = W_DISTANCE * S_dist + W_SAFETY * S_safe - P_overlap

Attributes the server does not provide degrade gracefully: unknown values
never add bonuses nor penalties.
"""

from dataclasses import dataclass
from typing import Any

W_DISTANCE = 0.4
W_SAFETY = 0.6

# Relative distance error with full marks (0%) and zero marks (>= 20%).
DISTANCE_TOLERANCE = 0.20

# No penalty up to this overlap ratio; the cap is reached at FULL_AT.
OVERLAP_PENALTY_START = 0.05
OVERLAP_PENALTY_FULL_AT = 0.30
OVERLAP_PENALTY_CAP = 5.0

_BASE_QUALITY = 0.8
_BONUS_ROAD_CLASS = 0.2
_BONUS_CYCLE_LANE = 0.15
_BONUS_BICYCLE_NETWORK = 0.15
_PENALTY_BIG_ROAD = 0.4
_PENALTY_LANES = 0.25
_PENALTY_TRUCK = 0.25

BONUS_ROAD_CLASSES = frozenset(
    {
        "residential",
        "living_street",
        "service",
        "unclassified",
        "tertiary",
        "tertiary_link",
        "secondary",
        "secondary_link",
    }
)
PENALTY_ROAD_CLASSES = frozenset(
    {"primary", "primary_link", "trunk", "trunk_link", "motorway"}
)

# Known cycle lane values that indicate real infrastructure; anything else
# (including future/unknown enums) stays neutral.
BONUS_CYCLE_LANES = frozenset(
    {"shared", "lane", "lanes", "dedicated", "protected", "track", "separated"}
)


@dataclass(frozen=True)
class CyclingScore:
    """Normalised 0-10 rating plus its contributing factors."""

    distance: float
    safety: float
    overlap_penalty: float
    total: float


def _flag(value: Any) -> bool:
    """Interpret Valhalla attribute values as on/off flags."""
    if value is None or isinstance(value, bool):
        return bool(value)
    text = str(value).strip().lower()
    return text not in ("", "0", "false", "none", "no")


def _edge_quality(edge: dict[str, Any]) -> float:
    """Per-edge bike friendliness in [0, 1]."""
    quality = _BASE_QUALITY
    road_class = str(edge.get("road_class") or "").lower()
    if road_class in BONUS_ROAD_CLASSES:
        quality += _BONUS_ROAD_CLASS
    elif road_class in PENALTY_ROAD_CLASSES:
        quality -= _PENALTY_BIG_ROAD

    cycle_lane = str(edge.get("cycle_lane") or "").lower()
    if cycle_lane in BONUS_CYCLE_LANES:
        quality += _BONUS_CYCLE_LANE
    if _flag(edge.get("bicycle_network")):
        quality += _BONUS_BICYCLE_NETWORK

    lanes = edge.get("lane_count")
    try:
        if lanes is not None and int(lanes) > 2:
            quality -= _PENALTY_LANES
    except (TypeError, ValueError):
        pass
    if _flag(edge.get("truck_route")):
        quality -= _PENALTY_TRUCK

    return min(1.0, max(0.0, quality))


def distance_score(distance_km: float, target_km: float) -> float:
    """Marks for matching the requested length: 10 on target, 0 at ±20%."""
    if target_km <= 0:
        return 0.0
    delta = abs(distance_km - target_km) / target_km
    return max(0.0, 1.0 - delta / DISTANCE_TOLERANCE) * 10.0


def safety_score(edges: list[dict[str, Any]]) -> float:
    """Length-weighted bike friendliness of the edges, 0-10."""
    total_km = 0.0
    weighted = 0.0
    for edge in edges:
        km = float(edge["length"])
        total_km += km
        weighted += km * _edge_quality(edge)
    if total_km == 0.0:
        raise ValueError("edges carry no length")
    return 10.0 * weighted / total_km


def overlap_penalty(ratio: float) -> float:
    """Points subtracted for repeated roads: 0 up to 5%, capped at 5.0."""
    if ratio <= OVERLAP_PENALTY_START:
        return 0.0
    over = ratio - OVERLAP_PENALTY_START
    span = OVERLAP_PENALTY_FULL_AT - OVERLAP_PENALTY_START
    return min(OVERLAP_PENALTY_CAP, over / span * OVERLAP_PENALTY_CAP)


def cycling_score(
    edges: list[dict[str, Any]],
    *,
    distance_km: float,
    target_km: float,
    overlap_ratio: float,
) -> CyclingScore:
    """Full multi-factor rating of one route."""
    distance = distance_score(distance_km, target_km)
    safety = safety_score(edges)
    penalty = overlap_penalty(overlap_ratio)
    total = max(0.0, min(10.0, W_DISTANCE * distance + W_SAFETY * safety - penalty))
    return CyclingScore(
        distance=distance,
        safety=safety,
        overlap_penalty=penalty,
        total=total,
    )
