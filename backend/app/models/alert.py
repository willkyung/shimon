from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Identity,
    Index,
    Integer,
    Numeric,
    String,
    Uuid,
    desc,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base
from backend.app.models.enums import AlertStatus, OverallRiskLevel

if TYPE_CHECKING:
    from backend.app.models.user import User


class Alert(Base):
    """
    관리자가 GET /admin/alerts에서 보는 시스템 생성 위험 알림.
    5분 주기 risk_scheduler가 작업자 위험도가 CAUTION/HIGH로 올라갈 때마다 생성한다.
    """

    __tablename__ = "alerts"
    __table_args__ = (
        Index("ix_alerts_status_occurred_at", "alert_status", desc("occurred_at")),
        Index("ix_alerts_worker_occurred_at", "worker_id", desc("occurred_at")),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    display_id: Mapped[int] = mapped_column(
        Integer, Identity(always=False), unique=True, nullable=False
    )
    worker_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    risk_level: Mapped[OverallRiskLevel] = mapped_column(
        Enum(OverallRiskLevel, name="overall_risk_level", validate_strings=True),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    status_text: Mapped[str] = mapped_column(String(100), nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    apparent_temp_c: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    estimated_core_temp_c: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    reason: Mapped[str] = mapped_column(String(200), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    alert_status: Mapped[AlertStatus] = mapped_column(
        Enum(AlertStatus, name="alert_status", validate_strings=True),
        nullable=False,
        default=AlertStatus.OPEN,
        server_default=AlertStatus.OPEN.value,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    worker: Mapped[User] = relationship()
