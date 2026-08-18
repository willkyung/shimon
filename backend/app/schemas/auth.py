from typing import Literal
from uuid import UUID

from pydantic import Field

from backend.app.models.enums import UserRole
from backend.app.schemas.common import ApiModel


class WorkerProfileRequest(ApiModel):
    age: int = Field(ge=18, le=100)
    assigned_site_id: UUID
    has_cooling_device: bool = False


class SignupRequest(ApiModel):
    company_code: str = Field(min_length=1, max_length=50)
    employee_code: str = Field(min_length=1, max_length=50)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=30)
    role: UserRole
    worker_profile: WorkerProfileRequest | None = None


class SignupData(ApiModel):
    user_id: UUID
    name: str
    role: UserRole


class SignupResponse(ApiModel):
    success: Literal[True] = True
    data: SignupData


class LoginRequest(ApiModel):
    company_code: str = Field(min_length=1, max_length=50)
    employee_code: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)


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
