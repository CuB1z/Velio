import asyncio
import math

import pytest

from app.clients.valhalla import RouteResult, build_route_payload
from app.engine.elevation import cumulative_distances
from app.engine.geo import destination_point, haversine_m
from app.engine.loop import (
    LoopRequest,
    climb_anchors,
    find_peak,
    generate_loop,
    insert_by_bearing,
    place_via_points,
    ring_candidates,
    ring_waypoints,
    select_waypoints,
    waypoint_rideability,
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


class StraightRouter:
    """Fake client routing straight through the locations at a fixed scale."""

    def __init__(self, scale: float):
        self.scale = scale

    async def route(self, locations, costing_options=None, avoid_locations=None):
        coords = list(locations)
        dist_km = cumulative_distances(coords)[-1] / 1000.0 * self.scale
        return RouteResult(coords, dist_km, 0.0)


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

    class RecordingRouter:
        async def route(self, locations, costing_options=None, avoid_locations=None):
            captured.append(list(locations))
            return RouteResult(list(locations), 60.0, 0.0)

    request = LoopRequest(origin=origin, target_km=60.0, via_points=vias)
    loop = asyncio.run(generate_loop(RecordingRouter(), ConstantDem(), request))

    assert not loop.infeasible
    first_call = captured[0]
    assert first_call[0] == origin
    assert first_call[-1] == origin
    for via in vias:
        assert via in first_call


def test_generate_loop_without_vias_keeps_plain_ring():
    origin = (40.4168, -3.7038)
    captured = []

    class RecordingRouter:
        async def route(self, locations, costing_options=None, avoid_locations=None):
            captured.append(list(locations))
            return RouteResult(list(locations), 60.0, 0.0)

    request = LoopRequest(origin=origin, target_km=60.0)
    asyncio.run(generate_loop(RecordingRouter(), ConstantDem(), request))

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
    assert payload["locations"][0]["type"] == "break"
    assert "alternatives" not in payload

    with_alternatives = build_route_payload([(40.0, -3.0)], alternatives=2)
    assert with_alternatives["alternatives"] == 2

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
    loop = asyncio.run(generate_loop(StraightRouter(1.1), ConstantDem(), request))
    assert loop.distance_ok
    assert not loop.infeasible
    assert abs(loop.distance_km - 60.0) <= 60.0 * 0.05
    assert loop.coords[0] == request.origin
    assert loop.coords[-1] == request.origin


def test_generate_loop_scales_radius_up_and_down():
    origin = (40.4168, -3.7038)
    too_long = asyncio.run(
        generate_loop(
            StraightRouter(1.5),
            ConstantDem(),
            LoopRequest(origin=origin, target_km=50.0),
        )
    )
    too_short = asyncio.run(
        generate_loop(
            StraightRouter(0.7),
            ConstantDem(),
            LoopRequest(origin=origin, target_km=50.0),
        )
    )
    assert too_long.radius_m < too_short.radius_m


def test_generate_loop_gain_target_pushes_hilliness():
    origin = (40.0, -3.0)
    low = asyncio.run(
        generate_loop(
            StraightRouter(1.0),
            HillDem(),
            LoopRequest(origin=origin, target_km=50.0, target_gain_m=10.0),
        )
    )
    high = asyncio.run(
        generate_loop(
            StraightRouter(1.0),
            HillDem(),
            LoopRequest(origin=origin, target_km=50.0, target_gain_m=10_000.0),
        )
    )
    assert high.hilliness > low.hilliness
    assert high.gain_m > low.gain_m
    assert high.stretch >= low.stretch


def test_generate_loop_flags_infeasible_when_gain_unreachable():
    # ConstantDem is flat: no knob combination can ever reach 10 km of D+.
    loop = asyncio.run(
        generate_loop(
            StraightRouter(1.0),
            ConstantDem(),
            LoopRequest(
                origin=(40.0, -3.0),
                target_km=50.0,
                target_gain_m=10_000.0,
                max_iterations=12,
            ),
        )
    )
    assert loop.infeasible
    assert not loop.gain_ok


def test_generate_loop_returns_best_effort_when_impossible():
    class FixedRouter:
        """Fake client that always reports the same length."""

        async def route(self, locations, costing_options=None, avoid_locations=None):
            return RouteResult(list(locations), 75.0, 0.0)

    loop = asyncio.run(
        generate_loop(
            FixedRouter(),
            ConstantDem(),
            LoopRequest(origin=(40.0, -3.0), target_km=50.0, max_iterations=3),
        )
    )
    assert not loop.distance_ok
    assert loop.coords[0] == (40.0, -3.0)


def test_generate_loop_rejects_bad_target():
    with pytest.raises(ValueError):
        asyncio.run(
            generate_loop(
                StraightRouter(1.0),
                ConstantDem(),
                LoopRequest(origin=(40.0, -3.0), target_km=0),
            )
        )


def test_via_points_near_the_origin_are_visited_on_the_way_out():
    """Slotted between ring waypoints, a near via turns into an out and back."""
    origin = (40.3765, -3.7592)
    radius_m = 9070.0  # a 57 km loop
    ring = ring_waypoints(*origin, radius_m, 8)
    near = (40.398283, -3.757684)  # 2.4 km out: 27% of the radius

    placed = place_via_points(ring, origin, (near,), radius_m)

    # Leaving the origin, the near point comes before any ring waypoint.
    assert placed[0] == near
    assert placed[1:] == ring


def test_via_points_out_on_the_ring_still_slot_in_by_bearing():
    origin = (40.3765, -3.7592)
    radius_m = 9070.0
    ring = ring_waypoints(*origin, radius_m, 8)
    far = destination_point(*origin, math.radians(100.0), radius_m)

    placed = place_via_points(ring, origin, (far,), radius_m)

    assert placed[0] != far
    assert far in placed
    # Its neighbours bracket it in bearing, so the loop stays convex.
    index = placed.index(far)
    assert index not in (0, len(placed) - 1)


def test_near_via_points_are_ordered_nearest_first():
    origin = (40.3765, -3.7592)
    radius_m = 9070.0
    ring = ring_waypoints(*origin, radius_m, 8)
    nearer = (40.398283, -3.757684)
    further = (40.425252, -3.733513)

    placed = place_via_points(ring, origin, (further, nearer), radius_m)

    assert placed[:2] == [nearer, further]


class TestWaypointRideability:
    """No costing can rescue a waypoint that only a dirt track reaches."""

    def test_tarmac_beats_dirt(self):
        paved = waypoint_rideability("road", "paved_smooth", 20.0)
        dirt = waypoint_rideability("track", "dirt", 20.0)
        assert paved > 0.9
        assert dirt < 0.15
        assert paved > dirt

    def test_a_cycleway_is_the_best_place_to_be_sent(self):
        cycleway = waypoint_rideability("cycleway", "paved", 20.0)
        street = waypoint_rideability("road", "paved", 20.0)
        assert cycleway > street

    def test_a_point_off_the_network_is_discounted(self):
        near = waypoint_rideability("road", "paved", 20.0)
        far = waypoint_rideability("road", "paved", 400.0)
        assert far < near * 0.5

    def test_nothing_nearby_scores_zero(self):
        assert waypoint_rideability("", "", float("inf")) == 0.0

    def test_unknown_surfaces_stay_in_the_middle(self):
        # Sparse attributes degrade to neutral instead of rejecting every candidate.
        assert waypoint_rideability("road", "brand_new_enum", 20.0) == 0.5


class TestRideabilityDrivesSelection:
    def test_the_sector_picks_its_most_rideable_candidate(self):
        origin = (40.5964, -3.6318)
        request = LoopRequest(
            origin=origin,
            target_km=40.0,
            waypoint_count=4,
            candidates_per_sector=4,
        )
        _, candidates = ring_candidates(request, 6000.0)

        # Third candidate of the first sector is the only good surface.
        rideability = [0.0] * len(candidates)
        rideability[2] = 1.0

        chosen = select_waypoints(
            request, 6000.0, 0.0, 0.0, _FlatDem(), rideability
        )
        assert chosen[0] == pytest.approx(candidates[2])

    def test_without_the_hint_selection_is_unchanged(self):
        origin = (40.5964, -3.6318)
        request = LoopRequest(origin=origin, target_km=40.0, waypoint_count=4)
        plain = select_waypoints(request, 6000.0, 0.0, 0.0, _FlatDem())
        none_given = select_waypoints(
            request, 6000.0, 0.0, 0.0, _FlatDem(), None
        )
        assert plain == none_given


class _FlatDem:
    def elevation(self, lat: float, lon: float) -> float:
        return 100.0
