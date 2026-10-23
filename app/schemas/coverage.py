"""HTTP schemas for the covered-regions endpoint."""

from typing import Literal

from pydantic import BaseModel


class CoverageRegion(BaseModel):
    key: str
    name: str
    iso: str


class CoverageGeometry(BaseModel):
    type: Literal["MultiPolygon"] = "MultiPolygon"
    coordinates: list[list[list[tuple[float, float]]]]


class CoverageResponse(BaseModel):
    regions: list[CoverageRegion]
    bbox: tuple[float, float, float, float]
    geometry: CoverageGeometry | None
