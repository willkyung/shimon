from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Uuid,
    desc,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base
from backend.app.models.enums import AiRiskLevel

if TYPE_CHECKING:
    from backend.app.models.site_weather_log import SiteWeatherLog
    from backend.app.models.work_session import WorkSession


class HeatRiskAssessment(Base):
    __tablename__ = "heat_risk_assessments"
    __table_args__ = (
        CheckConstraint(
            "risk_score IS NULL OR risk_score >= 0",
            name="ck_heat_risk_assessments_risk_score",
        ),
        Index(
            "ix_heat_risk_assessments_work_session_evaluated_at",
            "work_session_id",
            desc("evaluated_at"),
        ),
        Index(
            "ix_heat_risk_assessments_risk_level_evaluated_at",
            "risk_level",
            desc("evaluated_at"),
        ),
        Index("ix_heat_risk_assessments_model_version", "model_version"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    work_session_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("work_sessions.id"), nullable=False
    )
    weather_log_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("site_weather_logs.id"), nullable=False
    )
    predicted_core_temperature: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False
    )
    risk_level: Mapped[AiRiskLevel] = mapped_column(
        Enum(AiRiskLevel, name="ai_risk_level", validate_strings=True),
        nullable=False,
    )
    risk_score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    input_snapshot: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    main_factors: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    feature_schema_version: Mapped[str] = mapped_column(String(100), nullable=False)
    model_name: Mapped[str] = mapped_column(String(150), nullable=False)
    model_version: Mapped[str] = mapped_column(String(100), nullable=False)
    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    work_session: Mapped[WorkSession] = relationship(
        back_populates="heat_risk_assessments"
    )
    weather_log: Mapped[SiteWeatherLog] = relationship(
        back_populates="heat_risk_assessments"
    )
