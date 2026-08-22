"""Shared `?format=` exporters for the route endpoints."""

import json
from typing import Literal

from fastapi import Response

from app.engine.cycling_score import CyclingScore
from app.engine.dem import DemSource
from app.engine.elevation import build_profile
from app.engine.geojson import build_geojson
from app.engine.gpx import build_gpx
from app.engine.polyline import decode
from app.schemas.loop import CyclingScoreOut


def export_response(
    polyline: str,
    dem: DemSource,
    fmt: Literal["gpx", "geojson"],
    *,
    name: str,
    distance_km: float,
    gain_m: float,
    loss_m: float,
    duration_min: float,
    overlap_ratio: float | None = None,
    cycling_score: CyclingScoreOut | None = None,
) -> Response:
    """Render one routed shape as GPX 1.1 or GeoJSON with DEM elevations."""
    samples = build_profile(dem, decode(polyline)).samples
    description = f"{distance_km:.1f} km, {gain_m:.0f} m D+, {loss_m:.0f} m D-"
    if cycling_score:
        description += f", score {cycling_score.total:.1f}/10"

    if fmt == "gpx":
        return Response(
            content=build_gpx(samples, name=name, description=description),
            media_type="application/gpx+xml",
            headers={"Content-Disposition": f'attachment; filename="{name}.gpx"'},
        )

    doc = build_geojson(
        decode(polyline),
        name=name,
        distance_km=distance_km,
        duration_min=duration_min,
        gain_m=gain_m,
        loss_m=loss_m,
        overlap_ratio=overlap_ratio,
        cycling_score=(
            CyclingScore(**cycling_score.model_dump()) if cycling_score else None
        ),
        elevations=[sample.elevation_m for sample in samples],
    )
    return Response(content=json.dumps(doc), media_type="application/geo+json")
