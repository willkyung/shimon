from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.errors import ApiError
from backend.app.core.security import create_access_token, hash_password, verify_password
from backend.app.models import Company, User, WorkerProfile, WorkSite
from backend.app.models.enums import UserRole
from backend.app.schemas.auth import (
    LoginData,
    LoginRequest,
    LoginResponse,
    LoginUser,
    SignupData,
    SignupRequest,
    SignupResponse,
)


router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/signup", response_model=SignupResponse, status_code=201)
def signup(
    request: SignupRequest, db: Annotated[Session, Depends(get_db)]
) -> SignupResponse:
    if request.role != UserRole.WORKER:
        raise ApiError(403, "FORBIDDEN", "Public signup only supports WORKER accounts.")
    if request.worker_profile is None:
        raise ApiError(422, "VALIDATION_ERROR", "workerProfile is required for WORKER.")

    company = db.scalar(select(Company).where(Company.code == request.company_code))
    if company is None:
        raise ApiError(404, "COMPANY_NOT_FOUND", "Company was not found.")

    if db.scalar(
        select(User.id).where(
            User.company_id == company.id,
            User.employee_code == request.employee_code,
        )
    ):
        raise ApiError(
            409,
            "EMPLOYEE_CODE_ALREADY_EXISTS",
            "Employee code already exists in this company.",
        )

    normalized_email = request.email.strip().lower()
    if db.scalar(select(User.id).where(User.email == normalized_email)):
        raise ApiError(409, "EMAIL_ALREADY_EXISTS", "Email already exists.")

    profile_request = request.worker_profile
    site = db.scalar(
        select(WorkSite).where(
            WorkSite.id == profile_request.assigned_site_id,
            WorkSite.company_id == company.id,
        )
    )
    if site is None:
        raise ApiError(404, "SITE_NOT_FOUND", "Assigned site was not found.")

    user = User(
        company_id=company.id,
        employee_code=request.employee_code,
        email=normalized_email,
        password_hash=hash_password(request.password),
        name=request.name,
        phone=request.phone,
        role=UserRole.WORKER,
    )
    user.worker_profile = WorkerProfile(
        assigned_site_id=site.id,
        age=profile_request.age,
        has_cooling_device=profile_request.has_cooling_device,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if db.scalar(select(User.id).where(User.email == normalized_email)):
            raise ApiError(409, "EMAIL_ALREADY_EXISTS", "Email already exists.") from exc
        raise ApiError(
            409,
            "EMPLOYEE_CODE_ALREADY_EXISTS",
            "Employee code already exists in this company.",
        ) from exc
    db.refresh(user)

    return SignupResponse(
        data=SignupData(user_id=user.id, name=user.name, role=user.role)
    )


@router.post("/login", response_model=LoginResponse)
def login(
    request: LoginRequest, db: Annotated[Session, Depends(get_db)]
) -> LoginResponse:
    user = db.scalar(
        select(User)
        .join(Company)
        .where(
            Company.code == request.company_code,
            User.employee_code == request.employee_code,
        )
    )
    if user is None or not user.is_active or not verify_password(
        request.password, user.password_hash
    ):
        raise ApiError(401, "INVALID_CREDENTIALS", "Invalid credentials.")

    access_token = create_access_token(user.id, user.role)
    user.last_login_at = datetime.now(UTC)
    db.commit()
    return LoginResponse(
        data=LoginData(
            access_token=access_token,
            user=LoginUser(id=user.id, name=user.name, role=user.role),
        )
    )
