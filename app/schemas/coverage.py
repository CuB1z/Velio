"""HTTP schemas for the covered-regions endpoint."""

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.countries import ISO_COUNTRIES


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


class CoverageRequestCreateRequest(BaseModel):
    """`email` is required when anonymous and ignored when signed in."""

    country: str = Field(min_length=2, max_length=2)
    email: EmailStr | None = None
    note: str | None = Field(default=None, max_length=280)

    @field_validator("country")
    @classmethod
    def _known_country(cls, value: str) -> str:
        code = value.upper()
        if code not in ISO_COUNTRIES:
            raise ValueError("not an ISO 3166-1 alpha-2 country code")
        return code


class CoverageRequestResponse(BaseModel):
    country: str
    recorded: bool
