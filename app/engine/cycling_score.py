"""Multi-factor 0-10 quality score for cycling routes.

Combines how close the ride is to the requested distance and elevation
(S_dist, S_elev), how friendly its roads are to bikes (S_safe,
length-weighted from Valhalla edge attributes) and how much of it repeats
already-ridden roads (P_overlap):

    total = W_DISTANCE * S_dist + W_SAFETY * S_safe + W_ELEVATION * S_elev
            - P_overlap

Attributes the server does not provide degrade gracefully: unknown values
never add bonuses nor penalties.
"""

from dataclasses import dataclass

from .edges import RouteEdge

W_DISTANCE = 0.4
W_SAFETY = 0.6
W_ELEVATION = 0.0  # enabled by profiles that care about climbing

# Relative error with full marks (0%) and zero marks at the tolerance.
DISTANCE_TOLERANCE = 0.20
ELEVATION_TOLERANCE = 0.30

# No penalty up to this overlap ratio; the cap is reached at FULL_AT.
OVERLAP_PENALTY_START = 0.05
OVERLAP_PENALTY_FULL_AT = 0.30
OVERLAP_PENALTY_CAP = 5.0

_BASE_QUALITY = 0.8
_BONUS_ROAD_CLASS = 0.2
_BONUS_CYCLE_LANE = 0.15
_BONUS_BICYCLE_NETWORK = 0.15
_BONUS_SHOULDER = 0.05
_BONUS_SIDEWALK = 0.05
_PENALTY_BIG_ROAD = 0.4
_PENALTY_LANES = 0.25
_PENALTY_TRUCK = 0.25
_PENALTY_SIGNALS = 0.1

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
class Weights:
    """Relative importance of each positive factor; sums are normalised."""

    distance: float = W_DISTANCE
    safety: float = W_SAFETY
    elevation: float = W_ELEVATION


BALANCED_WEIGHTS = Weights()


@dataclass(frozen=True)
class CyclingScore:
    """Normalised 0-10 rating plus its contributing factors."""

    distance: float
    safety: float
    elevation: float
    overlap_penalty: float
    total: float


def _edge_quality(edge: RouteEdge) -> float:
    """Per-edge bike friendliness in [0, 1]."""
    quality = _BASE_QUALITY
    if edge.road_class in BONUS_ROAD_CLASSES:
        quality += _BONUS_ROAD_CLASS
    elif edge.road_class in PENALTY_ROAD_CLASSES:
        quality -= _PENALTY_BIG_ROAD

    if edge.cycle_lane in BONUS_CYCLE_LANES:
        quality += _BONUS_CYCLE_LANE
    if edge.bicycle_network:
        quality += _BONUS_BICYCLE_NETWORK
    if edge.shoulder:
        quality += _BONUS_SHOULDER
    if edge.sidewalk in ("sidepath", "separate", "yes"):
        quality += _BONUS_SIDEWALK

    if edge.lane_count is not None and edge.lane_count > 2:
        quality -= _PENALTY_LANES
    if edge.truck_route:
        quality -= _PENALTY_TRUCK
    if edge.traffic_signal and edge.road_class in PENALTY_ROAD_CLASSES:
        quality -= _PENALTY_SIGNALS

    return min(1.0, max(0.0, quality))


def distance_score(distance_km: float, target_km: float) -> float:
    """Marks for matching the requested length: 10 on target, 0 at ±20%."""
    if target_km <= 0:
        return 0.0
    delta = abs(distance_km - target_km) / target_km
    return max(0.0, 1.0 - delta / DISTANCE_TOLERANCE) * 10.0


def elevation_score(gain_m: float | None, target_gain_m: float | None) -> float:
    """Marks for matching the requested climb; neutral without a target."""
    if not target_gain_m or gain_m is None:
        return 10.0
    delta = abs(gain_m - target_gain_m) / target_gain_m
    return max(0.0, 1.0 - delta / ELEVATION_TOLERANCE) * 10.0


def safety_score(edges: list[RouteEdge]) -> float:
    """Length-weighted bike friendliness of the edges, 0-10."""
    total_km = 0.0
    weighted = 0.0
    for edge in edges:
        km = float(edge.length_km)
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
    edges: list[RouteEdge],
    *,
    distance_km: float,
    gain_m: float | None = None,
    target_km: float | None = None,
    target_gain_m: float | None = None,
    overlap_ratio: float = 0.0,
    weights: Weights = BALANCED_WEIGHTS,
) -> CyclingScore:
    """Full multi-factor rating of one route."""
    distance = distance_score(distance_km, target_km if target_km else distance_km)
    elevation = elevation_score(gain_m, target_gain_m)
    safety = safety_score(edges)
    penalty = overlap_penalty(overlap_ratio)

    weight_sum = weights.distance + weights.safety + weights.elevation
    total = (
        weights.distance * distance
        + weights.safety * safety
        + weights.elevation * elevation
    ) / weight_sum - penalty
    return CyclingScore(
        distance=distance,
        safety=safety,
        elevation=elevation,
        overlap_penalty=penalty,
        total=max(0.0, min(10.0, total)),
    )
