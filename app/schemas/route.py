"""HTTP schemas for the point-to-point routing endpoint."""

from pydantic import BaseModel, Field

from app.schemas.loop import CyclingScoreOut, ProfilePointOut, Quality, Waypoint


class RouteRequestIn(BaseModel):
    waypoints: list[Waypoint] = Field(min_length=2, max_length=20)
    include_profile: bool = False


class RouteOut(BaseModel):
    distance_km: float
    gain_m: float
    loss_m: float
    polyline: str
    duration_min: float
    score: Quality | None = None
    overlap_ratio: float | None = None
    cycling_score: CyclingScoreOut | None = None
    profile: list[ProfilePointOut] | None = None
