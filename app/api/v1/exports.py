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


def export_response(
    result,
    dem: DemSource,
    fmt: Literal["gpx", "geojson"],
    *,
    kind: Literal["loop", "route"],
) -> Response:
    """Render a routed result (LoopOut/RouteOut) as GPX or GeoJSON."""
    coords = decode(result.polyline)
    samples = build_profile(dem, coords).samples
    name = f"{kind}-{result.distance_km:.1f}km"
    description = (
        f"{result.distance_km:.1f} km, {result.gain_m:.0f} m D+, "
        f"{result.loss_m:.0f} m D-"
    )
    if result.cycling_score:
        description += f", score {result.cycling_score.total:.1f}/10"

    if fmt == "gpx":
        return Response(
            content=build_gpx(samples, name=name, description=description),
            media_type="application/gpx+xml",
            headers={"Content-Disposition": f'attachment; filename="{name}.gpx"'},
        )

    doc = build_geojson(
        coords,
        name=name,
        distance_km=result.distance_km,
        duration_min=result.duration_min,
        gain_m=result.gain_m,
        loss_m=result.loss_m,
        overlap_ratio=result.overlap_ratio,
        cycling_score=(
            CyclingScore(**result.cycling_score.model_dump())
            if result.cycling_score
            else None
        ),
        elevations=[sample.elevation_m for sample in samples],
    )
    return Response(content=json.dumps(doc), media_type="application/geo+json")
