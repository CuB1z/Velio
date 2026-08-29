"""HTTP schemas for the point-to-point routing endpoint."""

from pydantic import BaseModel, Field

from app.schemas.loop import CyclingScore, ProfilePoint, Quality, Waypoint


class RouteCreateRequest(BaseModel):
    waypoints: list[Waypoint] = Field(min_length=2, max_length=20)
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
