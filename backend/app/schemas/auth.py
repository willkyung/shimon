from typing import Literal
from uuid import UUID

from pydantic import Field

from backend.app.models.enums import Gender, UserRole, WorkIntensity
from backend.app.schemas.common import ApiModel


# ------------------------------------------------------------------
# POST /auth/verify-employee
# ------------------------------------------------------------------
class VerifyEmployeeRequest(ApiModel):
    employee_code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)


class VerifyEmployeeInfo(ApiModel):
    employee_code: str
    name: str
    company: str
    role: UserRole
    job_type: str | None = None
    workplace: str | None = None


class VerifyEmployeeResponse(ApiModel):
    verified: Literal[True] = True
    verification_token: str
    expires_in: int
    employee: VerifyEmployeeInfo


# ------------------------------------------------------------------
# POST /auth/signup
# ------------------------------------------------------------------
class SignupRequest(ApiModel):
    verification_token: str
    phone: str = Field(min_length=1, max_length=30)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=4, max_length=128)
    gender: Gender | None = None
    age: int | None = Field(default=None, ge=18, le=100)
    job_type: str | None = Field(default=None, max_length=100)
    workplace: str | None = Field(default=None, max_length=150)
    work_intensity: WorkIntensity = WorkIntensity.MEDIUM
    ppe_worn: bool = True


class SignupResponse(ApiModel):
    id: int
    employee_code: str
    name: str
    company: str
    role: UserRole
    email: str
    phone: str | None


# ------------------------------------------------------------------
# POST /auth/login
# ------------------------------------------------------------------
class LoginRequest(ApiModel):
    identifier: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class LoginUser(ApiModel):
    id: int
    employee_code: str
    role: UserRole
    name: str
    company: str
    workplace: str | None = None


class LoginResponse(ApiModel):
    access_token: str
    refresh_token: str
    expires_in: int
    user: LoginUser


# ------------------------------------------------------------------
# POST /auth/refresh
# ------------------------------------------------------------------
class RefreshRequest(ApiModel):
    refresh_token: str


class RefreshResponse(ApiModel):
    access_token: str
    refresh_token: str
    expires_in: int


# ------------------------------------------------------------------
# POST /auth/logout
# ------------------------------------------------------------------
class LogoutResponse(ApiModel):
    success: Literal[True] = True
