"""session metadata on refresh tokens

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("refresh_tokens") as batch:
        batch.add_column(sa.Column("user_agent", sa.String(256), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("refresh_tokens") as batch:
        batch.drop_column("user_agent")
