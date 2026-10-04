"""Ring waypoints never land on private roads or inside restricted areas."""

import asyncio
import math

from app.clients.valhalla import RouteResult, SnappedEdge
from app.engine.geo import haversine_m
from app.engine.loop import (
    LoopRequest,
    find_peak,
    generate_loop,
    ring_candidates,
    select_waypoints,
)
from app.engine.restricted import RestrictedAreas
from tests.engine.test_loop import ConstantDem, HillDem

ORIGIN = (40.0, -3.0)
REQUEST = LoopRequest(origin=ORIGIN, target_km=50.0)
RADIUS = 50_000.0 / (2.0 * math.pi)


def box_around(lat: float, lon: float, half: float) -> RestrictedAreas:
    ring = [
        (lon - half, lat - half),
        (lon + half, lat - half),
        (lon + half, lat + half),
        (lon - half, lat + half),
        (lon - half, lat - half),
    ]
    return RestrictedAreas([[ring]])


def test_blocked_candidates_are_never_picked():
    _, candidates = ring_candidates(REQUEST, RADIUS)
    cps = REQUEST.candidates_per_sector
    blocked = [i % cps != cps - 1 for i in range(len(candidates))]
    picks = select_waypoints(REQUEST, RADIUS, 0.0, 0.0, ConstantDem(), blocked=blocked)
    allowed = {candidates[i] for i in range(len(candidates)) if not blocked[i]}
    assert len(picks) == REQUEST.waypoint_count
    assert all(min(haversine_m(p, a) for a in allowed) < 1.0 for p in picks)


def test_a_fully_blocked_sector_is_skipped():
    _, candidates = ring_candidates(REQUEST, RADIUS)
    cps = REQUEST.candidates_per_sector
    blocked = [i < cps for i in range(len(candidates))]
    picks = select_waypoints(REQUEST, RADIUS, 0.0, 0.0, ConstantDem(), blocked=blocked)
    assert len(picks) == REQUEST.waypoint_count - 1


def test_a_sector_whose_pick_is_inside_an_area_is_skipped():
    free = select_waypoints(REQUEST, RADIUS, 0.0, 0.0, ConstantDem())
    areas = box_around(*free[0], 0.002)
    picks = select_waypoints(REQUEST, RADIUS, 0.0, 0.0, ConstantDem(), restricted=areas)
    assert len(picks) == REQUEST.waypoint_count - 1
    assert not any(areas.contains(*p) for p in picks)


def test_a_pick_stretched_into_an_area_stays_on_the_ring():
    free = select_waypoints(REQUEST, RADIUS, 1.0, 1.0, HillDem())
    stretched = max(free, key=lambda p: haversine_m(ORIGIN, p))
    assert haversine_m(ORIGIN, stretched) > RADIUS * 1.2
    areas = box_around(*stretched, 0.005)
    picks = select_waypoints(REQUEST, RADIUS, 1.0, 1.0, HillDem(), restricted=areas)
    assert not any(areas.contains(*p) for p in picks)
    assert any(abs(haversine_m(ORIGIN, p) - RADIUS) < 1.0 for p in picks)


def test_find_peak_avoids_restricted_areas():
    areas = box_around(*HillDem.PEAK, 0.03)
    found = find_peak(ORIGIN, HillDem(), max_radius_m=15_000.0, restricted=areas)
    assert found is not None
    assert not areas.contains(*found[0])


def test_generate_loop_never_routes_through_private_snaps():
    private: set[tuple[float, float]] = set()
    routed: list[tuple[float, float]] = []

    class PrivateEveryOther:
        async def locate(self, points, costing_options=None):
            edges = []
            for i, point in enumerate(points):
                is_private = i % 2 == 0
                if is_private:
                    private.add(point)
                edge = SnappedEdge("", "road", "paved", 5.0, dest_only=is_private)
                edges.append(edge)
            return edges

        async def route(self, locations, costing_options=None, avoid_locations=None):
            routed.extend(locations)
            return RouteResult(list(locations), 50.0, 0.0)

    asyncio.run(generate_loop(PrivateEveryOther(), ConstantDem(), REQUEST))
    assert routed
    assert not private.intersection(routed)
