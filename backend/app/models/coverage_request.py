"""ORM model for riders asking for their country to be covered."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Uuid,
    false,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class CoverageRequest(Base):
    """One person asking for one country: a user, or an anonymous email."""

    __tablename__ = "coverage_requests"
    __table_args__ = (
        CheckConstraint(
            "(user_id IS NULL) <> (email IS NULL)",
            name="ck_coverage_requests_one_requester",
        ),
        Index(
            "uq_coverage_requests_user",
            "country",
            "user_id",
            unique=True,
            postgresql_where=text("user_id IS NOT NULL"),
            sqlite_where=text("user_id IS NOT NULL"),
        ),
        Index(
            "uq_coverage_requests_email",
            "country",
            "email",
            unique=True,
            postgresql_where=text("email IS NOT NULL"),
            sqlite_where=text("email IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    country: Mapped[str] = mapped_column(String(2), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    note: Mapped[str | None] = mapped_column(String(280), nullable=True)
    notify: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    language: Mapped[str] = mapped_column(String(2), default="en", server_default="en")
    notified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
