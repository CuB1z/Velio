"""Shared geodesic math helpers."""

import math

EARTH_RADIUS_M = 6_371_008.8


def haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle distance in meters between two (lat, lon) points."""
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2.0) ** 2
    )
    return 2.0 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def destination_point(
    lat: float, lon: float, bearing_rad: float, distance_m: float
) -> tuple[float, float]:
    """Great-circle destination from a start point, bearing and distance."""
    angular = distance_m / EARTH_RADIUS_M
    lat_r = math.radians(lat)
    lon_r = math.radians(lon)
    lat_p = math.asin(
        math.sin(lat_r) * math.cos(angular)
        + math.cos(lat_r) * math.sin(angular) * math.cos(bearing_rad)
    )
    lon_p = lon_r + math.atan2(
        math.sin(bearing_rad) * math.sin(angular) * math.cos(lat_r),
        math.cos(angular) - math.sin(lat_r) * math.sin(lat_p),
    )
    return math.degrees(lat_p), math.degrees(lon_p)


def initial_bearing_deg(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Compass bearing from `a` to `b` in [0, 360)."""
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - (
        math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    )
    return math.degrees(math.atan2(x, y)) % 360.0


def angular_distance_deg(a: float, b: float) -> float:
    """Smallest angle between two bearings, in [0, 180]."""
    return abs((a - b + 180.0) % 360.0 - 180.0)
