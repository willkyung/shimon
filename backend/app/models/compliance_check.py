from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Uuid,
    desc,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base
from backend.app.models.enums import ComplianceStatus

if TYPE_CHECKING:
    from backend.app.models.compliance_rule import ComplianceRule
    from backend.app.models.site_weather_log import SiteWeatherLog
    from backend.app.models.work_session import WorkSession


class ComplianceCheck(Base):
    __tablename__ = "compliance_checks"
    __table_args__ = (
        CheckConstraint(
            "required_rest_minutes IS NULL OR required_rest_minutes >= 0",
            name="ck_compliance_checks_required_rest_minutes",
        ),
        Index(
            "ix_compliance_checks_work_session_evaluated_at",
            "work_session_id",
            desc("evaluated_at"),
        ),
        Index(
            "ix_compliance_checks_status_evaluated_at",
            "status",
            desc("evaluated_at"),
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    work_session_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("work_sessions.id"), nullable=False
    )
    weather_log_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("site_weather_logs.id"), nullable=False
    )
    compliance_rule_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("compliance_rules.id"), nullable=False
    )
    status: Mapped[ComplianceStatus] = mapped_column(
        Enum(
            ComplianceStatus,
            name="compliance_status",
            validate_strings=True,
        ),
        nullable=False,
    )
    is_rest_required: Mapped[bool] = mapped_column(Boolean, nullable=False)
    rest_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    required_rest_minutes: Mapped[int | None] = mapped_column(Integer)
    input_snapshot: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    work_session: Mapped[WorkSession] = relationship(
        back_populates="compliance_checks"
    )
    weather_log: Mapped[SiteWeatherLog] = relationship(
        back_populates="compliance_checks"
    )
    compliance_rule: Mapped[ComplianceRule] = relationship(
        back_populates="compliance_checks"
    )
