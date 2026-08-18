from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Uuid,
    desc,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base
from backend.app.models.enums import WorkSessionStatus

if TYPE_CHECKING:
    from backend.app.models.compliance_check import ComplianceCheck
    from backend.app.models.heat_risk_assessment import HeatRiskAssessment
    from backend.app.models.rest_record import RestRecord
    from backend.app.models.user import User
    from backend.app.models.work_site import WorkSite


class WorkSession(Base):
    __tablename__ = "work_sessions"
    __table_args__ = (
        CheckConstraint(
            "(status = 'IN_PROGRESS' AND ended_at IS NULL) OR "
            "(status = 'COMPLETED' AND ended_at IS NOT NULL)",
            name="ck_work_sessions_status_ended_at",
        ),
        CheckConstraint(
            "ended_at IS NULL OR ended_at >= started_at",
            name="ck_work_sessions_time_order",
        ),
        Index(
            "uq_work_sessions_active_worker",
            "worker_id",
            unique=True,
            postgresql_where=text("status = 'IN_PROGRESS'"),
            sqlite_where=text("status = 'IN_PROGRESS'"),
        ),
        Index(
            "ix_work_sessions_worker_started_at", "worker_id", desc("started_at")
        ),
        Index("ix_work_sessions_site_status", "site_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    worker_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    site_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("work_sites.id"), nullable=False
    )
    status: Mapped[WorkSessionStatus] = mapped_column(
        Enum(
            WorkSessionStatus,
            name="work_session_status",
            validate_strings=True,
        ),
        nullable=False,
        default=WorkSessionStatus.IN_PROGRESS,
        server_default=WorkSessionStatus.IN_PROGRESS.value,
    )
    work_type: Mapped[str] = mapped_column(String(100), nullable=False)
    work_intensity: Mapped[str] = mapped_column(String(30), nullable=False)
    clothing_level: Mapped[str] = mapped_column(String(30), nullable=False)
    environment: Mapped[str] = mapped_column(String(50), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    worker: Mapped[User] = relationship(back_populates="work_sessions")
    site: Mapped[WorkSite] = relationship(back_populates="work_sessions")
    rest_records: Mapped[list[RestRecord]] = relationship(
        back_populates="work_session"
    )
    compliance_checks: Mapped[list[ComplianceCheck]] = relationship(
        back_populates="work_session"
    )
    heat_risk_assessments: Mapped[list[HeatRiskAssessment]] = relationship(
        back_populates="work_session"
    )
