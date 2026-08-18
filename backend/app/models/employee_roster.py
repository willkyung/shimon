from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base
from backend.app.models.enums import UserRole

if TYPE_CHECKING:
    from backend.app.models.company import Company
    from backend.app.models.work_site import WorkSite


class EmployeeRoster(Base):
    """
    회사가 미리 등록해둔 "가입 가능한 직원" 명단.
    POST /auth/verify-employee가 이 테이블과 대조해서 가입 자격을 확인한다.
    해커톤 MVP라 관리자가 직접 등록하는 API/UI는 아직 없고, 시드 스크립트로만 채운다.
    """

    __tablename__ = "employee_rosters"
    __table_args__ = (
        # verify-employee 요청에 companyCode가 없으므로(사원코드만으로 조회),
        # employee_code가 회사 구분 없이 전역에서 유일해야 한다.
        UniqueConstraint("employee_code", name="uq_employee_rosters_employee_code"),
        Index("ix_employee_rosters_employee_code_name", "employee_code", "name"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    company_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("companies.id"), nullable=False
    )
    employee_code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", validate_strings=True), nullable=False
    )
    job_type: Mapped[str | None] = mapped_column(String(100))
    workplace_site_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("work_sites.id")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    company: Mapped[Company] = relationship()
    workplace_site: Mapped[WorkSite | None] = relationship()
