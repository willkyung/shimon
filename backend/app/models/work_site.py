from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base

if TYPE_CHECKING:
    from backend.app.models.company import Company
    from backend.app.models.site_weather_log import SiteWeatherLog
    from backend.app.models.worker_profile import WorkerProfile
    from backend.app.models.work_session import WorkSession


class WorkSite(Base):
    __tablename__ = "work_sites"
    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uq_work_sites_company_name"),
        CheckConstraint(
            "latitude IS NULL OR latitude BETWEEN -90 AND 90",
            name="ck_work_sites_latitude",
        ),
        CheckConstraint(
            "longitude IS NULL OR longitude BETWEEN -180 AND 180",
            name="ck_work_sites_longitude",
        ),
        Index("ix_work_sites_company_active", "company_id", "is_active"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    company_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("companies.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    timezone: Mapped[str] = mapped_column(
        String(64), nullable=False, default="Asia/Seoul", server_default="Asia/Seoul"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    company: Mapped[Company] = relationship(back_populates="work_sites")
    workers: Mapped[list[WorkerProfile]] = relationship(back_populates="assigned_site")
    weather_logs: Mapped[list[SiteWeatherLog]] = relationship(back_populates="site")
    work_sessions: Mapped[list[WorkSession]] = relationship(back_populates="site")
