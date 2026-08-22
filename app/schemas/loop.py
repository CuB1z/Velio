"""HTTP request/response schemas."""

from typing import Literal

from pydantic import BaseModel, Field


class Waypoint(BaseModel):
    lat: float = Field(ge=-90.0, le=90.0)
    lon: float = Field(ge=-180.0, le=180.0)


class CostingOptionsIn(BaseModel):
    """Raw Valhalla bicycle costing overrides (win over `profile`)."""

    bicycle_type: Literal["Road", "Hybrid", "Cross", "Mountain"] | None = None
    use_roads: float | None = Field(default=None, ge=0, le=1)
    use_hills: float | None = Field(default=None, ge=0, le=1)
    avoid_bad_surfaces: float | None = Field(default=None, ge=0, le=1)


class LoopRequestIn(BaseModel):
    origin: Waypoint
    distance_km: float = Field(gt=0, le=500)
    gain_m: float | None = Field(default=None, gt=0)
    via: list[Waypoint] = Field(default_factory=list)
    tolerance: float = Field(default=0.05, gt=0, le=0.5)
    gain_tolerance: float = Field(default=0.20, gt=0, le=1.0)
    waypoint_count: int = Field(default=10, ge=3, le=50)
    max_iterations: int = Field(default=8, ge=1, le=50)
    profile: Literal["fast", "safe", "fitness", "relaxed"] | None = None
    routes: int = Field(default=1, ge=1, le=5)
    costing: CostingOptionsIn | None = None
    include_profile: bool = False


class Quality(BaseModel):
    comfort: float
    paved_share: float
    surface_km: dict[str, float]
    climb_load_m: float
    max_grade_pct: float


class CyclingScoreOut(BaseModel):
    distance: float
    safety: float
    elevation: float
    overlap_penalty: float
    total: float


class ProfilePointOut(BaseModel):
    """One resampled point of the DEM elevation profile."""

    lat: float
    lon: float
    distance_m: float
    elevation_m: float
    grade_pct: float | None = None


class LoopOut(BaseModel):
    distance_km: float
    gain_m: float
    loss_m: float
    feasible: bool
    iterations: int
    polyline: str
    duration_min: float
    overlap_ratio: float | None = None
    score: Quality | None = None
    cycling_score: CyclingScoreOut | None = None
    profile: list[ProfilePointOut] | None = None
    alternatives: list["LoopOut"] | None = None


LoopOut.model_rebuild()
