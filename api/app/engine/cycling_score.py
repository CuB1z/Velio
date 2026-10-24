"""Multi-factor 0-10 quality score for cycling routes.

Weighted mean of distance, safety (traffic), surface (ground vs bike) and
elevation, minus an overlap penalty. Unknown attributes stay neutral.
"""

from dataclasses import dataclass

from .edges import RouteEdge

W_DISTANCE = 0.4
W_SAFETY = 0.4
W_SURFACE = 0.2
W_ELEVATION = 0.0  # enabled by bike-specific weights

# Relative error with full marks (0%) and zero marks at the tolerance.
DISTANCE_TOLERANCE = 0.20
ELEVATION_TOLERANCE = 0.30

# No penalty up to this overlap ratio; the cap is reached at FULL_AT.
OVERLAP_PENALTY_START = 0.05
OVERLAP_PENALTY_FULL_AT = 0.30
OVERLAP_PENALTY_CAP = 5.0

# A plain rideable road. Kept low so real cycling infrastructure can stand
# clearly above a residential street.
_BASE_QUALITY = 0.5

_BONUS_ROAD_CLASS = 0.15
_BONUS_CYCLE_LANE = 0.20
_BONUS_BICYCLE_NETWORK = 0.10
_BONUS_SHOULDER = 0.05
_BONUS_SIDEWALK = 0.05
_PENALTY_BIG_ROAD = 0.35
_PENALTY_LANES = 0.20
_PENALTY_TRUCK = 0.25
_PENALTY_SIGNALS = 0.10

# Surface ranking per bike: good ground for a gravel bike is bad ground for
# road tyres. `default` is used when no bike is given.
SURFACE_QUALITY: dict[str, dict[str, float]] = {
    "default": {
        "paved_smooth": 1.0,
        "paved": 0.9,
        "paved_rough": 0.65,
        "compacted": 0.55,
        "dirt": 0.25,
        "gravel": 0.2,
        "path": 0.2,
        "sand": 0.05,
        "impassable": 0.0,
    },
    "road": {
        "paved_smooth": 1.0,
        "paved": 0.95,
        "paved_rough": 0.60,
        "compacted": 0.30,
        "dirt": 0.10,
        "gravel": 0.10,
        "path": 0.10,
        "sand": 0.0,
        "impassable": 0.0,
    },
    "city": {
        # Like `road`, but a compacted greenway is a fine ride.
        "paved_smooth": 1.0,
        "paved": 0.95,
        "paved_rough": 0.70,
        "compacted": 0.70,
        "gravel": 0.30,
        "dirt": 0.20,
        "path": 0.15,
        "sand": 0.0,
        "impassable": 0.0,
    },
    "gravel": {
        # Tarmac is perfectly fine, it is just not what you came for.
        "paved_smooth": 0.85,
        "paved": 0.85,
        "paved_rough": 0.80,
        "compacted": 1.0,
        "gravel": 0.90,
        "dirt": 0.85,
        "path": 0.55,
        "sand": 0.25,
        "impassable": 0.0,
    },
    "mtb": {
        "paved_smooth": 0.50,
        "paved": 0.50,
        "paved_rough": 0.60,
        "compacted": 0.80,
        "gravel": 0.90,
        "dirt": 1.0,
        "path": 1.0,
        "sand": 0.45,
        "impassable": 0.0,
    },
}

# Edge use as a statement about traffic only. `track` and `path` are neutral:
# surface and the traffic-free share score them on their own axes.
USE_QUALITY = {
    "cycleway": 0.45,
    "living_street": 0.25,
    "road": 0.0,
    "service_road": -0.05,
    "track": 0.0,
    "path": 0.0,
    "footway": -0.15,
    "pedestrian": -0.15,
    "steps": -0.50,
}

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
    surface: float = W_SURFACE
    elevation: float = W_ELEVATION


BALANCED_WEIGHTS = Weights()


@dataclass(frozen=True)
class CyclingScore:
    """Normalised 0-10 rating plus its contributing factors."""

    distance: float
    safety: float
    surface: float
    elevation: float
    overlap_penalty: float
    total: float


def _edge_quality(edge: RouteEdge) -> float:
    """Per-edge bike friendliness in [0, 1]."""
    quality = _BASE_QUALITY

    # Unknown uses stay neutral, so a new Valhalla enum never invents a bonus.
    quality += USE_QUALITY.get(edge.use, 0.0)

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


# Climb rate (m/km) that counts as fully hilly. Lives here, not in bikes.py,
# because bikes imports from this module.
HILLS_GAIN_SCALE_M_PER_KM = 25.0


def elevation_score(
    gain_m: float | None,
    target_gain_m: float | None,
    *,
    distance_km: float | None = None,
    hills: str | None = None,
) -> float:
    """Marks for the climb: match to a target, or fit to a preference.

    With a target: 10 on target, 0 at ±30%. Otherwise a `flat`/`hilly`
    preference scores the climb rate against HILLS_GAIN_SCALE_M_PER_KM.
    Neutral (10) without either.
    """
    if target_gain_m and gain_m is not None:
        delta = abs(gain_m - target_gain_m) / target_gain_m
        return max(0.0, 1.0 - delta / ELEVATION_TOLERANCE) * 10.0
    if hills in ("flat", "hilly") and gain_m is not None and distance_km:
        hilliness = min(1.0, gain_m / distance_km / HILLS_GAIN_SCALE_M_PER_KM)
        return 10.0 * (hilliness if hills == "hilly" else 1.0 - hilliness)
    return 10.0


def safety_score(
    edges: list[RouteEdge], traffic_free_share: float | None = None
) -> float:
    """How little traffic the rider is exposed to, 0-10.

    `traffic_free_share` is the fraction of the route closed to cars, which
    edge attributes cannot express. When given, that fraction scores a full
    10 and the rest is scored from the edges.
    """
    total_km = 0.0
    weighted = 0.0
    for edge in edges:
        km = float(edge.length_km)
        total_km += km
        weighted += km * _edge_quality(edge)
    if total_km == 0.0:
        raise ValueError("edges carry no length")

    from_edges = 10.0 * weighted / total_km
    if traffic_free_share is None:
        return from_edges

    share = min(1.0, max(0.0, traffic_free_share))
    return (1.0 - share) * from_edges + share * 10.0


def surface_score(edges: list[RouteEdge], bike: str | None = None) -> float:
    """How well the ground suits the bike, 0-10.

    `bike` picks the SURFACE_QUALITY ranking (`default` when None); an unknown
    surface scores a neutral 0.5.
    """
    ranking = SURFACE_QUALITY.get(bike or "default", SURFACE_QUALITY["default"])
    total_km = 0.0
    weighted = 0.0
    for edge in edges:
        km = float(edge.length_km)
        total_km += km
        weighted += km * ranking.get(edge.surface, 0.5)
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
    traffic_free_share: float | None = None,
    bike: str | None = None,
    hills: str | None = None,
) -> CyclingScore:
    """Full multi-factor rating of one route."""
    distance = distance_score(distance_km, target_km if target_km else distance_km)
    elevation = elevation_score(
        gain_m, target_gain_m, distance_km=distance_km, hills=hills
    )
    safety = safety_score(edges, traffic_free_share)
    surface = surface_score(edges, bike)
    penalty = overlap_penalty(overlap_ratio)

    weight_sum = (
        weights.distance + weights.safety + weights.surface + weights.elevation
    )
    total = (
        weights.distance * distance
        + weights.safety * safety
        + weights.surface * surface
        + weights.elevation * elevation
    ) / weight_sum - penalty
    return CyclingScore(
        distance=distance,
        safety=safety,
        surface=surface,
        elevation=elevation,
        overlap_penalty=penalty,
        total=max(0.0, min(10.0, total)),
    )
