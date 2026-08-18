import re
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator

from backend.app.models.enums import UserRole
from backend.app.schemas.common import ApiModel


WorkType = Literal[
    "순찰·점검",
    "토목 작업",
    "건설 작업",
    "도로 작업",
    "중량물 운반",
]

WORK_INTENSITY_BY_TYPE: dict[str, str] = {
    "순찰·점검": "낮음",
    "토목 작업": "보통",
    "건설 작업": "보통",
    "도로 작업": "높음",
    "중량물 운반": "높음",
}


class WorkerProfileRequest(ApiModel):
    age: int = Field(ge=18, le=100)
    work_area: str = Field(min_length=1, max_length=150)
    work_type: WorkType
    has_workwear: bool


class SignupRequest(ApiModel):
    company_name: str = Field(min_length=1, max_length=150)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=30)
    role: UserRole
    worker_profile: WorkerProfileRequest | None = None
    admin_signup_code: str | None = Field(default=None, min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("Enter a valid email address.")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
            raise ValueError("Password must contain both a letter and a number.")
        return value

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if not re.fullmatch(r"[0-9+()\-\s]{9,30}", value):
            raise ValueError("Enter a valid phone number.")
        return value


class SignupData(ApiModel):
    user_id: UUID
    employee_code: str
    name: str
    role: UserRole


class SignupResponse(ApiModel):
    success: Literal[True] = True
    data: SignupData


class LoginRequest(ApiModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("Enter a valid email address.")
        return normalized


class LoginUser(ApiModel):
    id: UUID
    name: str
    role: UserRole


class LoginData(ApiModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: LoginUser


class LoginResponse(ApiModel):
    success: Literal[True] = True
    data: LoginData
