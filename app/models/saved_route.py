"""ORM model for routes saved by authenticated users."""

import uuid
from datetime import datetime, UTC

from sqlalchemy import JSON, DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class SavedRoute(Base):
    """One stored compute result: name plus the verbatim response payload.

    The payload keeps whatever the routing endpoints returned (polyline6 and
    metric blocks) as opaque JSON, so replaying a saved route never requires
    re-routing.
    """

    __tablename__ = "saved_routes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
