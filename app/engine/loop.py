"""Circular route generator: origin + targets -> closed loop.

Ring candidates around the origin are located on the graph, the best of each
angular sector is routed, and controllers iterate until the targets are met:

- radius      -> distance (~linear)
- hilliness   -> gain: sectors pick higher candidates
- stretch     -> gain: the ring bulges toward high ground
- summit      -> gain, last resort: an explicit climb waypoint

When every knob is exhausted the result is flagged `infeasible`. Router and
DEM are injected, so the logic is testable without either.

Development CLI: python -m tools.loop_cli LAT LON --distance-km 60 [--gain-m 1200]
"""

import math
from collections.abc import Callable
from dataclasses import dataclass, field, replace

from .elevation import build_profile, cumulative_distances
from .geo import angular_distance_deg, destination_point, haversine_m

# Controller tuning.
HILLINESS_START = 0.5
HILLINESS_STEP = 0.1
STRETCH_STEP = 0.15
ANCHOR_MIN_GAP_M = 1500.0
SUMMIT_SEARCH_FACTOR = 2.5
PEAK_DISTANCE_PENALTY_M_PER_KM = 30.0
GOLDEN_ANGLE_DEG = 137.508
# Rideability vetoes rather than ranks: candidates within this margin of their
# sector's best are judged on geometry alone, which keeps the ring round.
RIDEABILITY_MARGIN = 0.2


ProgressFn = Callable[["GeneratedLoop"], None]


@dataclass(frozen=True)
class LoopRequest:
    """Parameters for one loop generation attempt."""

    origin: tuple[float, float]
    target_km: float
    target_gain_m: float | None = None
    tolerance: float = 0.05
    gain_tolerance: float = 0.20
    waypoint_count: int = 10
    max_iterations: int = 8
    seed_offset_deg: float = 0.0
    candidates_per_sector: int = 4
    via_points: tuple[tuple[float, float], ...] = ()
    # Bearings (from the origin) whose ring sector is skipped; set by the repair.
    banned_bearings: tuple[float, ...] = ()


@dataclass(frozen=True)
class GeneratedLoop:
    """Best loop found, with the metrics achieved."""

    coords: list[tuple[float, float]]
    distance_km: float
    gain_m: float
    loss_m: float
    radius_m: float
    hilliness: float
    stretch: float
    summit_used: bool
    iterations: int
    distance_ok: bool
    gain_ok: bool
    infeasible: bool = False
    duration_s: float = 0.0
    # The ring the loop was routed through, reused by the repair.
    waypoints: list[tuple[float, float]] = field(default_factory=list)


def climb_anchors(
    dem,
    coords: list[tuple[float, float]],
    max_anchors: int = 2,
) -> list[tuple[float, float]]:
    """Coordinates worth banning for future loops: the steepest grade and the
    highest point, deduplicated by proximity."""
    profile = build_profile(dem, coords)
    candidates: list[tuple[float, float]] = []
    graded = [s for s in profile.samples if s.grade_pct is not None]
    if graded:
        steepest = max(graded, key=lambda s: s.grade_pct or 0.0)
        candidates.append((steepest.lat, steepest.lon))
    if profile.samples:
        highest = max(profile.samples, key=lambda s: s.elevation_m)
        candidates.append((highest.lat, highest.lon))

    anchors: list[tuple[float, float]] = []
    for point in candidates:
        if all(
            haversine_m(point, anchor) >= ANCHOR_MIN_GAP_M for anchor in anchors
        ):
            anchors.append(point)
        if len(anchors) >= max_anchors:
            break
    return anchors


def ring_waypoints(
    lat: float, lon: float, radius_m: float, count: int, offset_deg: float = 0.0
) -> list[tuple[float, float]]:
    """Evenly spaced points on a circle of `radius_m` around (lat, lon)."""
    if count < 3:
        raise ValueError("a loop needs at least three waypoints")
    return [
        destination_point(
            lat, lon, math.radians(offset_deg + 360.0 * i / count), radius_m
        )
        for i in range(count)
    ]


# How good a candidate waypoint is, judged by the edge it snaps to.
SURFACE_RIDEABILITY = {
    "paved_smooth": 1.0,
    "paved": 0.95,
    "paved_rough": 0.7,
    "compacted": 0.55,
    "gravel": 0.25,
    "dirt": 0.1,
    "path": 0.1,
    "impassable": 0.0,
}
USE_RIDEABILITY = {
    "cycleway": 0.15,
    "living_street": 0.05,
    "track": -0.10,
    "path": -0.10,
    "footway": -0.15,
}

# A farther snap means the candidate is off the network.
SNAP_LIMIT_M = 150.0


def waypoint_rideability(use: str, surface: str, distance_m: float) -> float:
    """0-1 estimate of how good a candidate waypoint is, before routing.

    Unknown surfaces score 0.5 so sparse attributes degrade gracefully.
    """
    if distance_m == float("inf"):
        return 0.0

    quality = SURFACE_RIDEABILITY.get(surface, 0.5)
    quality += USE_RIDEABILITY.get(use, 0.0)
    if distance_m > SNAP_LIMIT_M:
        quality *= 0.4
    return min(1.0, max(0.0, quality))


def _ratio_error(value: float, target: float) -> float:
    """How far off `value` is, counted symmetrically in both directions.

    0 when they match; 1 when one is double the other, either way round.
    """
    if target <= 0.0 or value <= 0.0:
        return math.inf
    return max(value / target, target / value) - 1.0


def ring_candidates(
    request: LoopRequest, radius_m: float
) -> tuple[list[float], list[tuple[float, float]]]:
    """Bearings and coordinates of every candidate on the ring."""
    count = request.waypoint_count * request.candidates_per_sector
    bearings = [
        request.seed_offset_deg + 360.0 * i / count for i in range(count)
    ]
    candidates = [
        destination_point(*request.origin, math.radians(b), radius_m)
        for b in bearings
    ]
    return bearings, candidates


def select_waypoints(
    request: LoopRequest,
    radius_m: float,
    hilliness: float,
    stretch: float,
    elevation_fn,
    rideability: list[float] | None = None,
) -> list[tuple[float, float]]:
    """Pick one waypoint per angular sector from DEM-aware candidates.

    `hilliness` biases each sector toward its highest candidate; `stretch`
    moves the pick outward in proportion to its height. `rideability`, when
    given, rules out candidates well below their sector's best.
    """
    bearings, candidates = ring_candidates(request, radius_m)
    elevations = [elevation_fn.elevation(la, lo) for la, lo in candidates]
    valid = [e for e in elevations if e is not None]
    e_min = min(valid) if valid else 0.0
    e_span = (max(valid) - e_min) if valid else 0.0

    def height_of(i: int) -> float:
        elevation = elevations[i]
        if elevation is None or e_span == 0.0:
            return 0.5
        return (elevation - e_min) / e_span

    waypoints: list[tuple[float, float]] = []
    cps = request.candidates_per_sector
    half_sector = 180.0 / request.waypoint_count
    for s in range(request.waypoint_count):
        lo_i = s * cps
        hi_i = lo_i + cps
        centre = bearings[lo_i] + half_sector * (cps - 1) / cps
        if any(
            angular_distance_deg(centre, banned) <= half_sector
            for banned in request.banned_bearings
        ):
            continue

        allowed = set(range(lo_i, hi_i))
        if rideability is not None:
            best_ride = max(rideability[lo_i:hi_i])
            near_best = {
                i
                for i in range(lo_i, hi_i)
                if rideability[i] >= best_ride - RIDEABILITY_MARGIN
            }
            if near_best:
                allowed = near_best

        best_i = min(allowed)
        best_score = -math.inf
        for i in range(lo_i, hi_i):
            if i not in allowed:
                continue
            centrality = 1.0 - abs(((i - lo_i) + 0.5) / cps - 0.5) * 2.0
            score = (1.0 - hilliness) * centrality + hilliness * height_of(i)
            if score > best_score:
                best_score = score
                best_i = i
        sector_radius = radius_m * (
            1.0 + stretch * (2.0 * height_of(best_i) - 1.0)
        )
        waypoints.append(
            destination_point(
                *request.origin, math.radians(bearings[best_i]), sector_radius
            )
        )
    return waypoints


def find_peak(
    origin: tuple[float, float],
    elevation_source,
    max_radius_m: float,
) -> tuple[tuple[float, float], float] | None:
    """Best climb within `max_radius_m` of the origin (grid search).

    Scores elevation against distance from the origin, so an efficient
    nearby hill beats a distant giant. Returns (point, elevation_m).
    """
    best_point: tuple[float, float] | None = None
    best_score = -math.inf
    best_elevation = -math.inf
    for radius_step in range(2, 9):
        radius = max_radius_m * radius_step / 8.0
        for bearing in range(0, 360, 15):
            point = destination_point(
                *origin, math.radians(bearing), radius
            )
            elevation = elevation_source.elevation(*point)
            if elevation is None:
                continue
            score = elevation - PEAK_DISTANCE_PENALTY_M_PER_KM * radius / 1000.0
            if score > best_score:
                best_score = score
                best_elevation = elevation
                best_point = point
    if best_point is None:
        return None
    return best_point, best_elevation


# Via points nearer the origin than this share of the radius are visited on the
# way out instead of being slotted into the ring (which would make a spur).
NEAR_ORIGIN_RATIO = 0.7


def insert_by_bearing(
    waypoints: list[tuple[float, float]],
    origin: tuple[float, float],
    extra: tuple[float, float],
) -> list[tuple[float, float]]:
    """Insert `extra` into the cyclic waypoint order by (planar) bearing."""

    def bearing_of(p: tuple[float, float]) -> float:
        return math.atan2(p[1] - origin[1], p[0] - origin[0])

    extra_bearing = bearing_of(extra)
    for i in range(len(waypoints)):
        current = bearing_of(waypoints[i])
        nxt = bearing_of(waypoints[(i + 1) % len(waypoints)])
        span = (nxt - current) % (2.0 * math.pi)
        offset = (extra_bearing - current) % (2.0 * math.pi)
        if offset < span:
            return waypoints[: i + 1] + [extra] + waypoints[i + 1 :]
    return waypoints + [extra]


def place_via_points(
    waypoints: list[tuple[float, float]],
    origin: tuple[float, float],
    via_points: tuple[tuple[float, float], ...],
    radius_m: float,
) -> list[tuple[float, float]]:
    """Slot far via points into the ring by bearing; near ones go first."""
    near: list[tuple[float, float]] = []
    far: list[tuple[float, float]] = []
    for point in via_points:
        near_origin = haversine_m(origin, point) < radius_m * NEAR_ORIGIN_RATIO
        target = near if near_origin else far
        target.append(point)

    ordered = list(waypoints)
    for point in far:
        ordered = insert_by_bearing(ordered, origin, point)

    near.sort(key=lambda point: haversine_m(origin, point))
    return near + ordered


def _attempt_from_route(
    request: LoopRequest,
    result,
    dem,
    *,
    waypoints: list[tuple[float, float]],
    radius_m: float,
    hilliness: float,
    stretch: float,
    use_summit: bool,
    iteration: int,
) -> tuple[GeneratedLoop, float]:
    """Measure one routed ring against the targets; returns the loop and its error.

    The error is a ratio, so a degenerate near-zero loop ranks worst.
    """
    coords, distance_km = result.coords, result.distance_km
    profile = build_profile(dem, coords)

    distance_ok = (
        abs(distance_km - request.target_km) <= request.target_km * request.tolerance
    )
    gain_ok = request.target_gain_m is None or (
        abs(profile.gain_m - request.target_gain_m)
        <= request.target_gain_m * request.gain_tolerance
    )
    error = _ratio_error(distance_km, request.target_km) + 0.5 * (
        _ratio_error(profile.gain_m, request.target_gain_m)
        if request.target_gain_m
        else 0.0
    )
    loop = GeneratedLoop(
        coords=coords,
        distance_km=distance_km,
        gain_m=profile.gain_m,
        loss_m=profile.loss_m,
        radius_m=radius_m,
        hilliness=hilliness,
        stretch=stretch,
        summit_used=use_summit,
        iterations=iteration,
        distance_ok=distance_ok,
        gain_ok=gain_ok,
        duration_s=result.duration_s,
        waypoints=list(waypoints),
    )
    return loop, error


def spur_waypoints(
    coords: list[tuple[float, float]],
    waypoints: list[tuple[float, float]],
    spurs_m: list[tuple[float, float]] | tuple[tuple[float, float], ...],
    protected: tuple[tuple[float, float], ...] = (),
) -> list[tuple[float, float]]:
    """Ring waypoints that sit inside a spur, most nested first.

    `protected` waypoints (the rider's via points) are never blamed.
    """
    if len(coords) < 2 or not waypoints or not spurs_m:
        return []
    along = cumulative_distances(coords)

    def position_of(point: tuple[float, float]) -> float:
        nearest = min(range(len(coords)), key=lambda i: haversine_m(coords[i], point))
        return float(along[nearest])

    blamed: list[tuple[int, tuple[float, float]]] = []
    for waypoint in waypoints:
        if waypoint in protected:
            continue
        at = position_of(waypoint)
        hits = sum(1 for start, end in spurs_m if start < at < end)
        if hits:
            blamed.append((hits, waypoint))
    blamed.sort(key=lambda item: item[0], reverse=True)
    return [waypoint for _, waypoint in blamed]


async def generate_loop(
    client,
    dem,
    request: LoopRequest,
    costing_options: dict | None = None,
    avoid_locations: list[tuple[float, float]] | None = None,
    progress: ProgressFn | None = None,
) -> GeneratedLoop:
    """Build the best closed loop satisfying `request`.

    `client` performs the routing calls; `dem` provides waypoint selection
    heights and gain measurement. `progress`, when given, is called after
    every attempt with that attempt's GeneratedLoop.
    """
    if request.target_km <= 0:
        raise ValueError("target_km must be positive")

    radius_m = request.target_km * 1000.0 / (2.0 * math.pi)
    hilliness = HILLINESS_START if request.target_gain_m else 0.0
    stretch = 0.0
    use_summit = False
    peak = (
        find_peak(request.origin, dem, radius_m * SUMMIT_SEARCH_FACTOR)
        if request.target_gain_m
        else None
    )
    best: GeneratedLoop | None = None
    best_error = math.inf
    previous_state: tuple | None = None

    # Keyed by radius: the ring only moves when the radius does.
    rideability_cache: dict[int, list[float] | None] = {}

    async def rideability_for(radius: float) -> list[float] | None:
        """Rideability of the ring's candidates; None when the client cannot locate."""
        key = int(radius)
        if key in rideability_cache:
            return rideability_cache[key]

        value: list[float] | None = None
        if hasattr(client, "locate"):
            _, candidates = ring_candidates(request, radius)
            snapped = await client.locate(candidates, costing_options)
            if len(snapped) == len(candidates):
                value = [
                    waypoint_rideability(edge.use, edge.surface, edge.distance_m)
                    for edge in snapped
                ]
        rideability_cache[key] = value
        return value

    for iteration in range(1, request.max_iterations + 1):
        waypoints = select_waypoints(
            request,
            radius_m,
            hilliness,
            stretch,
            dem,
            await rideability_for(radius_m),
        )
        waypoints = place_via_points(
            waypoints, request.origin, request.via_points, radius_m
        )
        # The summit is chosen on the ring itself, so bearing order is right.
        if use_summit and peak is not None:
            waypoints = insert_by_bearing(waypoints, request.origin, peak[0])
        result = await client.route(
            [request.origin, *waypoints, request.origin],
            costing_options=costing_options,
            avoid_locations=avoid_locations,
        )
        attempt, error = _attempt_from_route(
            request,
            result,
            dem,
            waypoints=waypoints,
            radius_m=radius_m,
            hilliness=hilliness,
            stretch=stretch,
            use_summit=use_summit,
            iteration=iteration,
        )
        distance_ok, gain_ok, distance_km = (
            attempt.distance_ok,
            attempt.gain_ok,
            attempt.distance_km,
        )
        # A zero measurement gives an infinite error: the first attempt seeds `best`.
        if best is None or error < best_error:
            best, best_error = attempt, error
        if progress is not None:
            progress(attempt)
        if distance_ok and gain_ok:
            return attempt

        state = (round(radius_m, 1), round(hilliness, 3), round(stretch, 3), use_summit)
        if state == previous_state:
            # Knob space exhausted: not achievable from this origin.
            assert best is not None
            best = replace(best, infeasible=True)
            return best
        previous_state = state

        if not distance_ok:
            factor = request.target_km / distance_km if distance_km > 0 else 2.0
            radius_m *= min(max(factor, 0.5), 2.0)
        if request.target_gain_m is not None and not gain_ok:
            step = (request.target_gain_m - attempt.gain_m) / request.target_gain_m
            if step > 0 and hilliness < 1.0:
                hilliness = min(1.0, hilliness + max(step, HILLINESS_STEP))
            elif step > 0 and stretch < 1.0:
                stretch = min(1.0, stretch + max(step, STRETCH_STEP))
            elif step > 0 and not use_summit and peak is not None:
                use_summit = True
            elif step > 0:
                # Every knob is maxed out and the gain is still short.
                assert best is not None
                return replace(best, infeasible=True)
            elif use_summit:
                use_summit = False
            elif stretch > 0.0:
                stretch = max(0.0, stretch - max(abs(step), STRETCH_STEP))
            else:
                # Floored at zero: seeking low ground adds climbing in practice.
                hilliness = max(0.0, hilliness - max(abs(step), HILLINESS_STEP))

    assert best is not None
    return best
