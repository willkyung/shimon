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
    Identity,
    Index,
    Integer,
    Uuid,
    desc,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base
from backend.app.models.enums import RestReason

if TYPE_CHECKING:
    from backend.app.models.user import User
    from backend.app.models.work_session import WorkSession


class RestRecord(Base):
    __tablename__ = "rest_records"
    __table_args__ = (
        CheckConstraint(
            "ended_at IS NULL OR ended_at >= started_at",
            name="ck_rest_records_time_order",
        ),
        Index(
            "uq_rest_records_active_work_session",
            "work_session_id",
            unique=True,
            postgresql_where=text("ended_at IS NULL"),
            sqlite_where=text("ended_at IS NULL"),
        ),
        Index(
            "uq_rest_records_active_worker",
            "worker_id",
            unique=True,
            postgresql_where=text("ended_at IS NULL AND work_session_id IS NULL"),
        ),
        Index(
            "ix_rest_records_work_session_started_at",
            "work_session_id",
            desc("started_at"),
        ),
        Index("ix_rest_records_worker_started_at", "worker_id", desc("started_at")),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    display_id: Mapped[int] = mapped_column(
        Integer, Identity(always=False), unique=True, nullable=False
    )
    worker_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    # 작업 중 휴식이면 해당 세션 ID, "독립 휴식"(작업 시작 전 홈 화면에서 바로 휴식)이면 NULL.
    work_session_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("work_sessions.id")
    )
    reason: Mapped[RestReason] = mapped_column(
        Enum(RestReason, name="rest_reason", validate_strings=True), nullable=False
    )
    target_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    resume_work_after_rest: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
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

    worker: Mapped[User] = relationship()
    work_session: Mapped[WorkSession | None] = relationship(back_populates="rest_records")
