"""Circular route generator: origin + targets -> closed loop.

Strategy: place candidate waypoints on a ring around the origin, pick one per
angular sector, route through them in order, then drive three controllers
until the loop meets the requested distance and elevation gain:

- radius      -> distance (~linear)
- hilliness   -> gain: sectors pick higher candidates as it grows
- stretch     -> gain: the ring bulges toward high ground
- summit      -> gain, last resort: an explicit climb waypoint is inserted

If every knob is exhausted without meeting the targets, the result is flagged
`infeasible` instead of returning a route that misses them.

The router and DEM are injected, so the logic is testable without Valhalla
or elevation data.

Development CLI (from the repo root):
    python -m tools.loop_cli LAT LON --distance-km 60 [--gain-m 1200] [options]
"""

import math
from collections.abc import Callable
from dataclasses import dataclass, replace

from .elevation import build_profile
from .geo import destination_point, haversine_m

# Controller tuning.
HILLINESS_START = 0.5
HILLINESS_STEP = 0.1
STRETCH_STEP = 0.15
ANCHOR_MIN_GAP_M = 1500.0
SUMMIT_SEARCH_FACTOR = 2.5
PEAK_DISTANCE_PENALTY_M_PER_KM = 30.0
GOLDEN_ANGLE_DEG = 137.508


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


def select_waypoints(
    request: LoopRequest,
    radius_m: float,
    hilliness: float,
    stretch: float,
    elevation_fn,
) -> list[tuple[float, float]]:
    """Pick one waypoint per angular sector from DEM-aware candidates.

    `hilliness` biases each sector's pick toward its highest candidate;
    `stretch` pushes the chosen waypoint outward (or inward) proportionally
    to how high its sector is, so the loop bulges toward high ground.
    Candidates without DEM coverage fall back to centrality.
    """
    n_candidates = request.waypoint_count * request.candidates_per_sector
    bearings = [
        request.seed_offset_deg + 360.0 * i / n_candidates
        for i in range(n_candidates)
    ]
    candidates = [
        destination_point(*request.origin, math.radians(b), radius_m)
        for b in bearings
    ]
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
    for s in range(request.waypoint_count):
        lo_i = s * cps
        hi_i = lo_i + cps
        best_i = lo_i
        best_score = -math.inf
        for i in range(lo_i, hi_i):
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


def insert_by_bearing(
    waypoints: list[tuple[float, float]],
    origin: tuple[float, float],
    extra: tuple[float, float],
) -> list[tuple[float, float]]:
    """Insert `extra` into the cyclic waypoint order by bearing.

    Bearings use a planar atan2 approximation; it is consistent across all
    points, which is all the cyclic ordering needs at these distances.
    """

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

    for iteration in range(1, request.max_iterations + 1):
        waypoints = select_waypoints(
            request, radius_m, hilliness, stretch, dem
        )
        extras = list(request.via_points)
        if use_summit and peak is not None:
            extras.append(peak[0])
        for extra in extras:
            waypoints = insert_by_bearing(waypoints, request.origin, extra)
        result = await client.route(
            [request.origin, *waypoints, request.origin],
            costing_options=costing_options,
            avoid_locations=avoid_locations,
        )
        coords, distance_km = result.coords, result.distance_km
        profile = build_profile(dem, coords)

        distance_ok = (
            abs(distance_km - request.target_km)
            <= request.target_km * request.tolerance
        )
        gain_ok = request.target_gain_m is None or (
            abs(profile.gain_m - request.target_gain_m)
            <= request.target_gain_m * request.gain_tolerance
        )
        error = abs(distance_km - request.target_km) / request.target_km + 0.5 * (
            abs(profile.gain_m - request.target_gain_m) / request.target_gain_m
            if request.target_gain_m
            else 0.0
        )
        attempt = GeneratedLoop(
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
        )
        if error < best_error:
            best, best_error = attempt, error
        if progress is not None:
            progress(attempt)
        if distance_ok and gain_ok:
            return attempt

        state = (round(radius_m, 1), round(hilliness, 3), round(stretch, 3), use_summit)
        if state == previous_state:
            # Knob space exhausted without meeting the targets: the request
            # is not achievable from this origin (or with this distance).
            assert best is not None
            best = replace(best, infeasible=True)
            return best
        previous_state = state

        if not distance_ok:
            factor = request.target_km / distance_km if distance_km > 0 else 2.0
            radius_m *= min(max(factor, 0.5), 2.0)
        if request.target_gain_m is not None and not gain_ok:
            step = (request.target_gain_m - profile.gain_m) / request.target_gain_m
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
                hilliness = max(0.0, hilliness - max(abs(step), HILLINESS_STEP))

    assert best is not None
    return best
