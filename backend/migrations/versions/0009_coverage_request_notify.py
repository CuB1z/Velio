"""coverage requests: opt in to hear once when the country ships

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "coverage_requests",
        sa.Column("notify", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "coverage_requests",
        sa.Column("language", sa.String(2), nullable=False, server_default="en"),
    )
    op.add_column(
        "coverage_requests",
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("coverage_requests", "notified_at")
    op.drop_column("coverage_requests", "language")
    op.drop_column("coverage_requests", "notify")
