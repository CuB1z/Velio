"""user ids become uuids

Resetting the auth tables: pre-production data is disposable and int keys
leaked account volume through public responses.

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _drop_all() -> None:
    op.drop_table("verification_codes")
    op.drop_table("refresh_tokens")
    op.drop_table("user_identities")
    op.drop_table("users")


def _users(user_id_type) -> None:
    op.create_table(
        "users",
        sa.Column("id", user_id_type, primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=True),
        sa.Column("full_name", sa.String(255), nullable=False, server_default=""),
        sa.Column(
            "status", sa.String(16), nullable=False, server_default="active"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)


def _user_identities(user_id_type) -> None:
    op.create_table(
        "user_identities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            user_id_type,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("provider_user_id", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "provider", "provider_user_id", name="uq_provider_identity"
        ),
    )
    op.create_index("ix_user_identities_user_id", "user_identities", ["user_id"])


def _refresh_tokens(user_id_type) -> None:
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            user_id_type,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("jti_hash", sa.String(64), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index(
        "ix_refresh_tokens_jti_hash", "refresh_tokens", ["jti_hash"], unique=True
    )


def _verification_codes(user_id_type) -> None:
    op.create_table(
        "verification_codes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            user_id_type,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("purpose", sa.String(32), nullable=False),
        sa.Column("code_hash", sa.String(255), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("user_id", "purpose", name="uq_verification_purpose"),
    )
    op.create_index(
        "ix_verification_codes_user_id", "verification_codes", ["user_id"]
    )


def upgrade() -> None:
    _drop_all()
    _users(sa.Uuid())
    _user_identities(sa.Uuid())
    _refresh_tokens(sa.Uuid())
    _verification_codes(sa.Uuid())


def downgrade() -> None:
    _drop_all()
    _users(sa.Integer())
    _user_identities(sa.Integer())
    _refresh_tokens(sa.Integer())
    _verification_codes(sa.Integer())
