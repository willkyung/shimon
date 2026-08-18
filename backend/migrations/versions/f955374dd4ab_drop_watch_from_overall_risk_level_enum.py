"""drop WATCH from overall_risk_level enum

Revision ID: f955374dd4ab
Revises: 99e5f9339c47
Create Date: 2026-08-19 01:41:17.657460
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



revision: str = 'f955374dd4ab'
down_revision: Union[str, Sequence[str], None] = '99e5f9339c47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Postgres는 enum 값을 직접 못 지우므로, 타입을 새로 만들고 컬럼을 옮겨 태운 뒤
    # 옛 타입을 지우는 방식으로 처리한다. 기존에 WATCH였던 값은 CAUTION으로 내린다
    # (지금 실제 데이터엔 WATCH가 없는 걸 확인했지만, 혹시 몰라 안전하게 처리).
    op.execute("ALTER TYPE overall_risk_level RENAME TO overall_risk_level_old")
    op.execute("CREATE TYPE overall_risk_level AS ENUM ('NORMAL', 'CAUTION', 'HIGH')")

    op.execute(
        "ALTER TABLE notifications ALTER COLUMN risk_level TYPE overall_risk_level "
        "USING (CASE WHEN risk_level::text = 'WATCH' THEN 'CAUTION' ELSE risk_level::text END)::overall_risk_level"
    )
    op.execute(
        "ALTER TABLE alerts ALTER COLUMN risk_level TYPE overall_risk_level "
        "USING (CASE WHEN risk_level::text = 'WATCH' THEN 'CAUTION' ELSE risk_level::text END)::overall_risk_level"
    )

    op.execute("DROP TYPE overall_risk_level_old")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TYPE overall_risk_level RENAME TO overall_risk_level_new")
    op.execute("CREATE TYPE overall_risk_level AS ENUM ('NORMAL', 'WATCH', 'CAUTION', 'HIGH')")

    op.execute(
        "ALTER TABLE notifications ALTER COLUMN risk_level TYPE overall_risk_level "
        "USING risk_level::text::overall_risk_level"
    )
    op.execute(
        "ALTER TABLE alerts ALTER COLUMN risk_level TYPE overall_risk_level "
        "USING risk_level::text::overall_risk_level"
    )

    op.execute("DROP TYPE overall_risk_level_new")
