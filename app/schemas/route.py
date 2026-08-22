"""HTTP schemas for the point-to-point routing endpoint."""

from pydantic import BaseModel, Field

from app.schemas.loop import Quality, Waypoint


class RouteRequestIn(BaseModel):
    waypoints: list[Waypoint] = Field(min_length=2, max_length=20)


class RouteOut(BaseModel):
    distance_km: float
    gain_m: float
    loss_m: float
    polyline: str
    score: Quality | None = None
