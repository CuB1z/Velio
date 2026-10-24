"""Overlap repair: find the waypoint inside the out-and-back, drop its sector."""

import math

import pytest

from app.engine.geo import destination_point, initial_bearing_deg
from app.engine.loop import LoopRequest, select_waypoints, spur_waypoints

ORIGIN = (40.0, -3.7)
# A straight line north, one vertex every ~111 m (0.001 deg of latitude).
LINE = [(40.0 + i * 0.001, -3.7) for i in range(100)]


class FlatDem:
    def elevation(self, lat, lon):
        return 100.0


def test_the_waypoint_inside_the_spur_is_blamed_and_the_others_are_not():
    inside = LINE[40]  # ~4.4 km along: inside the (2 km, 6 km) spur
    outside = LINE[80]  # ~8.9 km along: past it
    blamed = spur_waypoints(LINE, [outside, inside], [(2000.0, 6000.0)])
    assert blamed == [inside]


def test_nested_spurs_rank_the_deepest_waypoint_first():
    shallow = LINE[15]  # inside the outer spur only
    deep = LINE[30]  # inside both
    spurs = [(1000.0, 5000.0), (2500.0, 3500.0)]
    assert spur_waypoints(LINE, [shallow, deep], spurs) == [deep, shallow]


def test_via_points_are_never_blamed():
    """The rider asked to pass there; the repair may not remove it."""
    via = LINE[40]
    assert spur_waypoints(LINE, [via], [(2000.0, 6000.0)], protected=(via,)) == []


def test_nothing_to_blame_without_geometry_or_spurs():
    assert spur_waypoints([], [LINE[1]], [(0.0, 10.0)]) == []
    assert spur_waypoints(LINE, [LINE[1]], []) == []


def test_banned_bearing_removes_exactly_that_sector():
    """Ban the sector a waypoint sits in and the ring comes back one short."""
    request = LoopRequest(origin=ORIGIN, target_km=30.0, waypoint_count=8)
    radius = 30_000.0 / (2 * math.pi)
    full = select_waypoints(request, radius, 0.0, 0.0, FlatDem())
    assert len(full) == 8

    culprit = full[3]
    banned = LoopRequest(
        origin=ORIGIN,
        target_km=30.0,
        waypoint_count=8,
        banned_bearings=(initial_bearing_deg(ORIGIN, culprit),),
    )
    reduced = select_waypoints(banned, radius, 0.0, 0.0, FlatDem())
    assert len(reduced) == 7
    assert culprit not in reduced
    # Every other sector survives untouched.
    assert [w for w in full if w != culprit] == reduced


def test_ban_respects_the_seed_rotation():
    """Bearings are absolute, so a ban survives the golden-angle reseeding."""
    request = LoopRequest(
        origin=ORIGIN, target_km=30.0, waypoint_count=10, seed_offset_deg=137.5
    )
    radius = 4775.0
    full = select_waypoints(request, radius, 0.0, 0.0, FlatDem())
    target_bearing = initial_bearing_deg(ORIGIN, full[6])
    reduced = select_waypoints(
        LoopRequest(
            origin=ORIGIN,
            target_km=30.0,
            waypoint_count=10,
            seed_offset_deg=137.5,
            banned_bearings=(target_bearing,),
        ),
        radius,
        0.0,
        0.0,
        FlatDem(),
    )
    assert len(reduced) == 9
    assert all(
        abs(initial_bearing_deg(ORIGIN, w) - target_bearing) > 1.0 for w in reduced
    )


def test_bearing_round_trip():
    point = destination_point(*ORIGIN, math.radians(45.0), 5000.0)
    assert initial_bearing_deg(ORIGIN, point) == pytest.approx(45.0, abs=0.05)
