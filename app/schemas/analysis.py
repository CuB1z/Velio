"""HTTP schemas for the standalone analysis endpoints."""

from pydantic import BaseModel, Field

from app.schemas.loop import CyclingScoreOut, ProfilePointOut, Quality


class PolylineIn(BaseModel):
    """An encoded polyline6 shape to analyse offline."""

    polyline: str = Field(min_length=1)
    target_km: float | None = Field(default=None, gt=0, le=500)
    target_gain_m: float | None = Field(default=None, gt=0)


class AnalysisOut(BaseModel):
    distance_km: float
    gain_m: float
    loss_m: float
    score: Quality | None = None
    overlap_ratio: float | None = None
    cycling_score: CyclingScoreOut | None = None


class ElevationOut(BaseModel):
    distance_km: float
    gain_m: float
    loss_m: float
    max_uphill_grade_pct: float
    max_downhill_grade_pct: float
    profile: list[ProfilePointOut]
