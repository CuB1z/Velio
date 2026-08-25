"""HTTP schemas for the saved-routes endpoints."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SavedRouteIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    payload: dict[str, Any]


class SavedRouteOut(BaseModel):
    id: uuid.UUID
    name: str
    payload: dict[str, Any]
    created_at: datetime
