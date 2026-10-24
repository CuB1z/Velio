"""HTTP schemas for the saved-routes endpoints."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SavedRouteCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    payload: dict[str, Any]


class SavedRouteUpdateRequest(BaseModel):
    """Partial update (PATCH). Fields absent are left untouched; extend as
    more attributes become editable."""

    name: str | None = Field(default=None, min_length=1, max_length=100)


class SavedRouteResponse(BaseModel):
    id: uuid.UUID
    name: str
    payload: dict[str, Any]
    created_at: datetime
    updated_at: datetime
