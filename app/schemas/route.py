"""HTTP schemas for the point-to-point routing endpoint."""

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.loop import (
    CostingOptions,
    CyclingScore,
    ProfilePoint,
    Quality,
    Waypoint,
)


class RouteCreateRequest(BaseModel):
    waypoints: list[Waypoint] = Field(min_length=2, max_length=20)
    # Same rider-facing filters as the loop endpoint.
    bike: Literal["road", "city", "gravel", "mtb"] | None = None
    hills: Literal["flat", "rolling", "hilly"] | None = None
    costing: CostingOptions | None = None
    include_profile: bool = False
    alternatives: int = Field(default=0, ge=0, le=2)


class RouteResponse(BaseModel):
    distance_km: float
    gain_m: float
    loss_m: float
    polyline: str
    duration_min: float
    score: Quality | None = None
    overlap_ratio: float | None = None
    cycling_score: CyclingScore | None = None
    profile: list[ProfilePoint] | None = None
    alternatives: list["RouteResponse"] | None = None


RouteResponse.model_rebuild()
