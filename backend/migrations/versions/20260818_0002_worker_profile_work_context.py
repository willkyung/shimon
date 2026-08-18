"""add worker profile work context

Revision ID: 20260818_0002
Revises: 20260818_0001
Create Date: 2026-08-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260818_0002"
down_revision: Union[str, Sequence[str], None] = "20260818_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "worker_profiles", sa.Column("work_type", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "worker_profiles",
        sa.Column("work_intensity", sa.String(length=30), nullable=True),
    )
    op.add_column(
        "worker_profiles",
        sa.Column(
            "has_workwear", sa.Boolean(), server_default="false", nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_column("worker_profiles", "has_workwear")
    op.drop_column("worker_profiles", "work_intensity")
    op.drop_column("worker_profiles", "work_type")
