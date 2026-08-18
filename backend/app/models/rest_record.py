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
    Uuid,
    desc,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base
from backend.app.models.enums import RestType

if TYPE_CHECKING:
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
            "ix_rest_records_work_session_started_at",
            "work_session_id",
            desc("started_at"),
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    work_session_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("work_sessions.id"), nullable=False
    )
    rest_type: Mapped[RestType] = mapped_column(
        Enum(RestType, name="rest_type", validate_strings=True), nullable=False
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

    work_session: Mapped[WorkSession] = relationship(back_populates="rest_records")
