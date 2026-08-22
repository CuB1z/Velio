"""HTTP request/response schemas."""

from pydantic import BaseModel, Field


class Waypoint(BaseModel):
    lat: float = Field(ge=-90.0, le=90.0)
    lon: float = Field(ge=-180.0, le=180.0)


class LoopRequestIn(BaseModel):
    origin: Waypoint
    distance_km: float = Field(gt=0, le=500)
    gain_m: float | None = Field(default=None, gt=0)
    via: list[Waypoint] = Field(default_factory=list)
    tolerance: float = Field(default=0.05, gt=0, le=0.5)
    gain_tolerance: float = Field(default=0.20, gt=0, le=1.0)
    waypoint_count: int = Field(default=10, ge=3, le=50)
    max_iterations: int = Field(default=8, ge=1, le=50)


class Quality(BaseModel):
    comfort: float
    paved_share: float
    surface_km: dict[str, float]
    climb_load_m: float
    max_grade_pct: float


class LoopOut(BaseModel):
    distance_km: float
    gain_m: float
    loss_m: float
    feasible: bool
    iterations: int
    coords: list[tuple[float, float]]
    score: Quality | None = None
