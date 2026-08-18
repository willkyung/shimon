from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base

if TYPE_CHECKING:
    from backend.app.models.company import Company


class AdminSettings(Base):
    """
    회사별 관리자 설정. 회사당 한 행만 존재한다.

    주의: apparentTemp*/coreTemp*/maxWorkMinutes/restMinutes는 여기 저장/응답은 되지만,
    실제 AI 판정 로직(heat_features.py, safety_service.py)은 아직 이 값을 읽지 않고
    고정 상수를 그대로 쓴다 — "위험 기준은 안 바꿔도 된다"는 결정에 따라 설정 화면만
    동작하고 실제 판정에는 연결하지 않았다.
    """

    __tablename__ = "admin_settings"
    __table_args__ = (UniqueConstraint("company_id", name="uq_admin_settings_company"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    company_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("companies.id"), nullable=False
    )
    apparent_temp_danger_c: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=43.0, server_default="43.0"
    )
    apparent_temp_caution_c: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=38.0, server_default="38.0"
    )
    max_work_minutes: Mapped[int] = mapped_column(nullable=False, default=120, server_default="120")
    rest_minutes: Mapped[int] = mapped_column(nullable=False, default=20, server_default="20")
    core_temp_caution_c: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=37.5, server_default="37.5"
    )
    core_temp_danger_c: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=38.0, server_default="38.0"
    )
    default_site: Mapped[str] = mapped_column(String(50), nullable=False, default="all", server_default="all")
    channel_push: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    channel_sms: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    channel_email: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    channel_emergency: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    company: Mapped[Company] = relationship()
