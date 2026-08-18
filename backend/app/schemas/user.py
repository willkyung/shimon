import re
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator

from backend.app.models.enums import UserRole
from backend.app.schemas.auth import WorkType
from backend.app.schemas.common import ApiModel


class AssignedSiteData(ApiModel):
    id: UUID
    name: str


class WorkerProfileData(ApiModel):
    age: int | None
    gender: str | None
    work_type: str | None
    work_intensity: str | None
    has_workwear: bool
    has_cooling_device: bool
    assigned_site: AssignedSiteData | None


class MeData(ApiModel):
    id: UUID
    name: str
    role: UserRole
    company_code: str
    company_name: str
    employee_code: str
    email: str
    phone: str | None
    worker_profile: WorkerProfileData | None = None


class MeResponse(ApiModel):
    success: Literal[True] = True
    data: MeData


class UpdateMeRequest(ApiModel):
    email: str = Field(min_length=3, max_length=255)
    phone: str | None = Field(default=None, max_length=30)
    gender: Literal["남성", "여성"]
    work_area: str = Field(min_length=1, max_length=150)
    work_type: WorkType
    has_workwear: bool

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("Enter a valid email address.")
        return normalized

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if not re.fullmatch(r"[0-9+()\-\s]{9,30}", value):
            raise ValueError("Enter a valid phone number.")
        return value
