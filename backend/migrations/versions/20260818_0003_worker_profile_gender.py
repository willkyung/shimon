"""add worker profile gender

Revision ID: 20260818_0003
Revises: 20260818_0002
Create Date: 2026-08-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260818_0003"
down_revision: Union[str, Sequence[str], None] = "20260818_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "worker_profiles", sa.Column("gender", sa.String(length=20), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("worker_profiles", "gender")
