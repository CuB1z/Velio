import math

import pytest

from app.engine.elevation import cumulative_distances
from app.engine.geo import destination_point, haversine_m
from app.engine.loop import (
    LoopRequest,
    build_route_payload,
    climb_anchors,
    find_peak,
    generate_loop,
    insert_by_bearing,
    ring_waypoints,
    select_waypoints,
)


class ConstantDem:
    def elevation(self, lat: float, lon: float) -> float:
        return 100.0


class HillDem:
    """Terrain with a single 900 m Gaussian peak north-east of the origin."""

    PEAK = (40.06, -2.88)

    def elevation(self, lat: float, lon: float) -> float:
        dlat = lat - self.PEAK[0]
        dlon = lon - self.PEAK[1]
        return 900.0 * math.exp(-(dlat**2 + dlon**2) / (2 * 0.03**2))


def _straight_route_fn(scale: float):
    def route_fn(locations):
        coords = list(locations)
        dist_km = cumulative_distances(coords)[-1] / 1000.0 * scale
        return coords, dist_km

    return route_fn


def test_destination_point_known_bearing():
    # 111.19 km due north is roughly one degree of latitude.
    lat, lon = destination_point(40.0, -3.0, 0.0, 111_194.9)
    assert lat == pytest.approx(41.0, abs=1e-4)
    assert lon == pytest.approx(-3.0, abs=1e-4)


def test_ring_waypoints_count_and_radius():
    origin = (40.4168, -3.7038)
    radius_m = 10_000.0
    points = ring_waypoints(*origin, radius_m, count=8)
    assert len(points) == 8
    for point in points:
        assert haversine_m(origin, point) == pytest.approx(radius_m, rel=1e-6)
    assert origin not in points


def test_ring_waypoints_offset_rotates():
    base = ring_waypoints(40.0, -3.0, 5000.0, count=4)
    rotated = ring_waypoints(40.0, -3.0, 5000.0, count=4, offset_deg=45.0)
    assert base[0] != rotated[0]


def test_ring_waypoints_requires_three():
    with pytest.raises(ValueError):
        ring_waypoints(40.0, -3.0, 1000.0, count=2)


def test_select_waypoints_hilliness_biases_uphill():
    request = LoopRequest(origin=(40.0, -3.0), target_km=50.0)
    radius = 50_000.0 / (2.0 * math.pi)
    dem = HillDem()

    flat = select_waypoints(request, radius, 0.0, 0.0, dem)
    hilly = select_waypoints(request, radius, 1.0, 0.0, dem)
    stretched = select_waypoints(request, radius, 1.0, 1.0, dem)

    def mean_elevation(points):
        return sum(dem.elevation(la, lo) for la, lo in points) / len(points)

    assert mean_elevation(hilly) > mean_elevation(flat)
    assert mean_elevation(stretched) > mean_elevation(hilly)
    # One waypoint per sector: angular order around the origin is preserved.
    for wps in (flat, hilly):
        bearings = [
            math.degrees(math.atan2(lon - request.origin[1], lat - request.origin[0]))
            for lat, lon in wps
        ]
        unwrapped = list(bearings)
        for i in range(1, len(unwrapped)):
            while unwrapped[i] < unwrapped[i - 1]:
                unwrapped[i] += 360.0
        assert unwrapped == sorted(unwrapped)


def test_find_peak_locates_the_hill():
    origin = (40.0, -3.0)
    found = find_peak(origin, HillDem(), max_radius_m=15_000.0)
    assert found is not None
    point, elevation = found
    assert haversine_m(point, HillDem.PEAK) < 2_000.0
    assert elevation > 700.0


def test_generate_loop_routes_through_via_points():
    origin = (40.4168, -3.7038)
    vias = ((40.30, -3.60), (40.55, -3.85))
    captured = []

    def recording_route_fn(locations):
        captured.append(list(locations))
        return list(locations), 60.0

    request = LoopRequest(origin=origin, target_km=60.0, via_points=vias)
    loop = generate_loop(recording_route_fn, ConstantDem(), request)

    assert not loop.infeasible
    first_call = captured[0]
    assert first_call[0] == origin
    assert first_call[-1] == origin
    for via in vias:
        assert via in first_call


def test_generate_loop_without_vias_keeps_plain_ring():
    origin = (40.4168, -3.7038)
    captured = []

    def recording_route_fn(locations):
        captured.append(list(locations))
        return list(locations), 60.0

    request = LoopRequest(origin=origin, target_km=60.0)
    generate_loop(recording_route_fn, ConstantDem(), request)

    first_call = captured[0]
    assert len(first_call) == request.waypoint_count + 2  # ring plus origin twice


def test_insert_by_bearing_keeps_cyclic_order():
    origin = (40.0, -3.0)
    waypoints = ring_waypoints(*origin, 8000.0, count=4)  # N, E, S, W
    peak = (40.05, -2.95)  # roughly NE of the origin
    merged = insert_by_bearing(waypoints, origin, peak)
    assert len(merged) == 5
    assert merged[1] == peak  # between the north and east waypoints


def test_build_route_payload_includes_options_and_avoids():
    payload = build_route_payload(
        [(40.0, -3.0), (41.0, -4.0)],
        costing_options={"use_hills": 0.5},
        avoid_locations=[(40.5, -3.5)],
    )
    assert payload["costing"] == "bicycle"
    assert payload["costing_options"]["bicycle"] == {"use_hills": 0.5}
    assert payload["avoid_locations"] == [{"lat": 40.5, "lon": -3.5}]

    bare = build_route_payload([(40.0, -3.0)])
    assert "costing_options" not in bare
    assert "avoid_locations" not in bare


def test_climb_anchors_pick_high_and_steep():
    dem = HillDem()
    # A route that climbs toward the peak: start south-west, end at the peak.
    coords = [
        destination_point(
            HillDem.PEAK[0],
            HillDem.PEAK[1],
            math.radians(225),
            d,
        )
        for d in range(12_000, -1, -1_000)
    ]
    anchors = climb_anchors(dem, coords)
    assert 1 <= len(anchors) <= 2
    for lat, lon in anchors:
        # Anchors sit on the climb itself, not necessarily at the summit.
        assert haversine_m((lat, lon), HillDem.PEAK) < 3_500.0
    if len(anchors) == 2:
        assert haversine_m(anchors[0], anchors[1]) >= 1500.0


def test_generate_loop_converges_distance_only():
    request = LoopRequest(
        origin=(40.4168, -3.7038), target_km=60.0, max_iterations=10
    )
    loop = generate_loop(_straight_route_fn(1.1), ConstantDem(), request)
    assert loop.distance_ok
    assert not loop.infeasible
    assert abs(loop.distance_km - 60.0) <= 60.0 * 0.05
    assert loop.coords[0] == request.origin
    assert loop.coords[-1] == request.origin


def test_generate_loop_scales_radius_up_and_down():
    origin = (40.4168, -3.7038)
    too_long = generate_loop(
        _straight_route_fn(1.5),
        ConstantDem(),
        LoopRequest(origin=origin, target_km=50.0),
    )
    too_short = generate_loop(
        _straight_route_fn(0.7),
        ConstantDem(),
        LoopRequest(origin=origin, target_km=50.0),
    )
    assert too_long.radius_m < too_short.radius_m


def test_generate_loop_gain_target_pushes_hilliness():
    origin = (40.0, -3.0)
    low = generate_loop(
        _straight_route_fn(1.0),
        HillDem(),
        LoopRequest(origin=origin, target_km=50.0, target_gain_m=10.0),
    )
    high = generate_loop(
        _straight_route_fn(1.0),
        HillDem(),
        LoopRequest(origin=origin, target_km=50.0, target_gain_m=10_000.0),
    )
    assert high.hilliness > low.hilliness
    assert high.gain_m > low.gain_m
    assert high.stretch >= low.stretch


def test_generate_loop_flags_infeasible_when_gain_unreachable():
    # ConstantDem is flat: no knob combination can ever reach 10 km of D+.
    loop = generate_loop(
        _straight_route_fn(1.0),
        ConstantDem(),
        LoopRequest(
            origin=(40.0, -3.0),
            target_km=50.0,
            target_gain_m=10_000.0,
            max_iterations=12,
        ),
    )
    assert loop.infeasible
    assert not loop.gain_ok


def test_generate_loop_returns_best_effort_when_impossible():
    def never_converges(locations):
        return list(locations), 75.0

    loop = generate_loop(
        never_converges,
        ConstantDem(),
        LoopRequest(origin=(40.0, -3.0), target_km=50.0, max_iterations=3),
    )
    assert not loop.distance_ok
    assert loop.coords[0] == (40.0, -3.0)


def test_generate_loop_rejects_bad_target():
    with pytest.raises(ValueError):
        generate_loop(
            _straight_route_fn(1.0),
            ConstantDem(),
            LoopRequest(origin=(40.0, -3.0), target_km=0),
        )
