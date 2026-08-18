from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base
from backend.app.models.enums import Gender, WorkIntensity

if TYPE_CHECKING:
    from backend.app.models.user import User
    from backend.app.models.work_site import WorkSite


class WorkerProfile(Base):
    __tablename__ = "worker_profiles"
    __table_args__ = (
        CheckConstraint(
            "age IS NULL OR age BETWEEN 18 AND 100", name="ck_worker_profiles_age"
        ),
        Index("ix_worker_profiles_assigned_site", "assigned_site_id"),
    )

    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), primary_key=True
    )
    assigned_site_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("work_sites.id")
    )
    age: Mapped[int | None]
    has_cooling_device: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    gender: Mapped[Gender | None] = mapped_column(
        Enum(Gender, name="gender", validate_strings=True)
    )
    job_type: Mapped[str | None] = mapped_column(String(100))
    # 작업 세션 시작 시 WorkSession.work_intensity/clothing_level의 기본값으로 쓰인다
    # (사용자가 매번 선택하지 않고, 프로필에 저장된 평소 선호값을 그대로 가져다 씀).
    work_intensity: Mapped[WorkIntensity] = mapped_column(
        Enum(WorkIntensity, name="work_intensity", validate_strings=True),
        nullable=False,
        default=WorkIntensity.MEDIUM,
        server_default=WorkIntensity.MEDIUM.value,
    )
    ppe_worn: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    notifications_enabled: Mapped[bool] = mapped_column(
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

    user: Mapped[User] = relationship(back_populates="worker_profile")
    assigned_site: Mapped[WorkSite | None] = relationship(back_populates="workers")
