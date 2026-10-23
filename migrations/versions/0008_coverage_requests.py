"""coverage requests: riders asking for their country

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "coverage_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("country", sa.String(2), nullable=False),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("email", sa.String(254), nullable=True),
        sa.Column("note", sa.String(280), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(user_id IS NULL) <> (email IS NULL)",
            name="ck_coverage_requests_one_requester",
        ),
    )
    op.create_index("ix_coverage_requests_country", "coverage_requests", ["country"])
    op.create_index(
        "uq_coverage_requests_user",
        "coverage_requests",
        ["country", "user_id"],
        unique=True,
        postgresql_where=sa.text("user_id IS NOT NULL"),
        sqlite_where=sa.text("user_id IS NOT NULL"),
    )
    op.create_index(
        "uq_coverage_requests_email",
        "coverage_requests",
        ["country", "email"],
        unique=True,
        postgresql_where=sa.text("email IS NOT NULL"),
        sqlite_where=sa.text("email IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_coverage_requests_email", table_name="coverage_requests")
    op.drop_index("uq_coverage_requests_user", table_name="coverage_requests")
    op.drop_index("ix_coverage_requests_country", table_name="coverage_requests")
    op.drop_table("coverage_requests")
