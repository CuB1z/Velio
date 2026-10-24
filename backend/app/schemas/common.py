"""Shared HTTP schemas reused across endpoints."""

from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PageMeta(BaseModel):
    """Pagination metadata carried alongside a list payload."""

    page: int
    limit: int
    total: int
    total_pages: int
    is_last: bool


class PaginatedResponse[T](BaseModel):
    """Envelope for offset-paginated lists: `data` plus page metadata."""

    data: list[T]
    meta: PageMeta