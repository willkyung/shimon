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
    Uuid,
    desc,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base
from backend.app.models.enums import WeatherSource

if TYPE_CHECKING:
    from backend.app.models.compliance_check import ComplianceCheck
    from backend.app.models.heat_risk_assessment import HeatRiskAssessment
    from backend.app.models.work_site import WorkSite


class SiteWeatherLog(Base):
    __tablename__ = "site_weather_logs"
    __table_args__ = (
        CheckConstraint(
            "humidity BETWEEN 0 AND 100", name="ck_site_weather_logs_humidity"
        ),
        CheckConstraint(
            "latitude BETWEEN -90 AND 90", name="ck_site_weather_logs_latitude"
        ),
        CheckConstraint(
            "longitude BETWEEN -180 AND 180",
            name="ck_site_weather_logs_longitude",
        ),
        Index(
            "ix_site_weather_logs_site_measured_at",
            "site_id",
            desc("measured_at"),
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    site_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("work_sites.id"), nullable=False
    )
    source: Mapped[WeatherSource] = mapped_column(
        Enum(WeatherSource, name="weather_source", validate_strings=True),
        nullable=False,
    )
    temperature: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    humidity: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    wind_speed: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    feels_like_temperature: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False
    )
    latitude: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    longitude: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    measured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    site: Mapped[WorkSite] = relationship(back_populates="weather_logs")
    compliance_checks: Mapped[list[ComplianceCheck]] = relationship(
        back_populates="weather_log"
    )
    heat_risk_assessments: Mapped[list[HeatRiskAssessment]] = relationship(
        back_populates="weather_log"
    )
