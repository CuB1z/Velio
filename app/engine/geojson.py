"""GeoJSON 1.1 export for generated routes.

Produces a FeatureCollection holding one LineString feature whose
properties carry the route metrics. Coordinates follow the GeoJSON
[lon, lat] order; optional DEM coverage adds a third `ele` component.
"""

from dataclasses import asdict
from typing import Any

from .cycling_score import CyclingScore


def build_geojson(
    coords: list[tuple[float, float]],
    *,
    name: str,
    distance_km: float,
    duration_min: float | None = None,
    gain_m: float | None = None,
    loss_m: float | None = None,
    overlap_ratio: float | None = None,
    cycling_score: CyclingScore | None = None,
    elevations: list[float | None] | None = None,
) -> dict[str, Any]:
    """Build a GeoJSON FeatureCollection dict for one route."""
    points: list[list[float]] = []
    for i, (lat, lon) in enumerate(coords):
        point = [round(lon, 6), round(lat, 6)]
        if elevations is not None and i < len(elevations):
            ele = elevations[i]
            if ele is not None:
                point.append(round(ele, 1))
        points.append(point)

    properties: dict[str, Any] = {
        "name": name,
        "distance_km": round(distance_km, 2),
        "duration_min": round(duration_min, 1) if duration_min is not None else None,
        "elevation_gain_m": round(gain_m) if gain_m is not None else None,
        "elevation_loss_m": round(loss_m) if loss_m is not None else None,
        "overlap_ratio": (
            round(overlap_ratio, 4) if overlap_ratio is not None else None
        ),
        "cycling_score": asdict(cycling_score) if cycling_score else None,
    }

    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": properties,
                "geometry": {"type": "LineString", "coordinates": points},
            }
        ],
    }
