"""Route sampling, DEM profiling, smoothing and elevation metrics."""

import math

import numpy as np

from .dem import DemSource
from .models import ElevationProfile, ProfileSample
from .polyline import decode

EARTH_RADIUS_M = 6_371_008.8


def build_profile(
    dem: DemSource,
    shape: str | list[tuple[float, float]],
    *,
    sample_interval_m: float = 10.0,
    median_window: int = 5,
    mean_window: int = 11,
    grade_baseline_m: float = 30.0,
) -> ElevationProfile:
    """Build an elevation profile for a route.

    `shape` is either an encoded polyline (str) or a list of (lat, lon).
    """
    coords = decode(shape) if isinstance(shape, str) else list(shape)
    if len(coords) < 2:
        raise ValueError("a route needs at least two coordinates")

    distances = cumulative_distances(coords)
    total_m = float(distances[-1])
    lats, lons, sample_dist = _resample(coords, distances, sample_interval_m)

    raw = np.array(
        [
            math.nan if h is None else h
            for h in (dem.elevation(la, lo) for la, lo in zip(lats, lons))
        ],
        dtype=np.float64,
    )
    filled = _fill_gaps(raw)
    smoothed = _smooth(filled, median_window, mean_window)

    gain, loss = _gain_loss(smoothed)
    grades_pct = _grades_over_baseline(sample_dist, smoothed, grade_baseline_m)
    max_uphill = float(grades_pct.max()) if grades_pct.size else 0.0
    max_downhill = float(grades_pct.min()) if grades_pct.size else 0.0

    local_grades = _local_grade_pct(sample_dist, smoothed)
    samples = [
        ProfileSample(
            lat=float(la),
            lon=float(lo),
            distance_m=float(d),
            elevation_m=float(e),
            grade_pct=(None if math.isnan(g) else float(g)),
        )
        for la, lo, d, e, g in zip(lats, lons, sample_dist, smoothed, local_grades)
    ]

    return ElevationProfile(
        distance_km=total_m / 1000.0,
        gain_m=gain,
        loss_m=loss,
        max_uphill_grade_pct=max_uphill,
        max_downhill_grade_pct=max_downhill,
        samples=samples,
    )


def cumulative_distances(coords: list[tuple[float, float]]) -> np.ndarray:
    """Cumulative great-circle distance in meters along the vertices."""
    lat = np.radians([c[0] for c in coords])
    lon = np.radians([c[1] for c in coords])
    dlat = np.diff(lat)
    dlon = np.diff(lon)
    a = (
        np.sin(dlat / 2.0) ** 2
        + np.cos(lat[:-1]) * np.cos(lat[1:]) * np.sin(dlon / 2.0) ** 2
    )
    steps = 2.0 * EARTH_RADIUS_M * np.arcsin(np.sqrt(a))
    return np.concatenate(([0.0], np.cumsum(steps)))


def _resample(
    coords: list[tuple[float, float]], distances: np.ndarray, interval_m: float
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Densify the route at regular distance intervals by linear interpolation."""
    total = float(distances[-1])
    count = max(2, int(math.ceil(total / interval_m)) + 1)
    targets = np.linspace(0.0, total, count)
    vertex_lat = np.array([c[0] for c in coords])
    vertex_lon = np.array([c[1] for c in coords])
    lats = np.interp(targets, distances, vertex_lat)
    lons = np.interp(targets, distances, vertex_lon)
    return lats, lons, targets


def _fill_gaps(elevations: np.ndarray) -> np.ndarray:
    """Linearly interpolate NaN lookups; edges take the nearest valid value."""
    valid = ~np.isnan(elevations)
    if not valid.any():
        raise ValueError("no DEM coverage along the route")
    if valid.all():
        return elevations
    idx = np.arange(elevations.size)
    return np.interp(idx, idx[valid], elevations[valid])


def _smooth(elevations: np.ndarray, median_window: int, mean_window: int) -> np.ndarray:
    """Median filter followed by a moving average to remove DEM noise."""
    smoothed = _rolling(elevations, median_window, np.median)
    smoothed = _rolling(smoothed, mean_window, np.mean)
    return smoothed


def _rolling(values: np.ndarray, window: int, fn) -> np.ndarray:
    if window <= 1:
        return values.copy()
    pad = window // 2
    padded = np.pad(values, pad, mode="edge")
    windows = np.lib.stride_tricks.sliding_window_view(padded, window)
    return fn(windows, axis=-1)


def _gain_loss(elevations: np.ndarray) -> tuple[float, float]:
    diffs = np.diff(elevations)
    return float(diffs[diffs > 0].sum()), float(-diffs[diffs < 0].sum())


def _grades_over_baseline(
    distances: np.ndarray, elevations: np.ndarray, baseline_m: float
) -> np.ndarray:
    """Grade (%) measured over >= baseline_m ahead of each sample."""
    if distances[-1] <= baseline_m:
        return _local_grade_pct(distances, elevations)
    end_idx = np.searchsorted(distances, distances + baseline_m, side="right")
    end_idx = np.clip(end_idx, 1, distances.size - 1)
    run = distances[end_idx] - distances
    rise = elevations[end_idx] - elevations
    with np.errstate(divide="ignore", invalid="ignore"):
        grades = np.where(run > 0, rise / run * 100.0, np.nan)
    return grades[~np.isnan(grades)]


def _local_grade_pct(distances: np.ndarray, elevations: np.ndarray) -> np.ndarray:
    """Grade (%) between consecutive samples; first sample has no grade."""
    if distances.size < 2:
        return np.array([])
    run = np.diff(distances)
    rise = np.diff(elevations)
    with np.errstate(divide="ignore", invalid="ignore"):
        grades = np.where(run > 0, rise / run * 100.0, np.nan)
    return np.concatenate(([np.nan], grades))
