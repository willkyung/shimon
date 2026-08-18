from datetime import UTC, datetime
import hmac
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.config import get_settings
from backend.app.core.errors import ApiError
from backend.app.core.security import create_access_token, hash_password, verify_password
from backend.app.models import Company, User, WorkerProfile, WorkSite
from backend.app.models.enums import UserRole
from backend.app.schemas.auth import (
    WORK_INTENSITY_BY_TYPE,
    LoginData,
    LoginRequest,
    LoginResponse,
    LoginUser,
    SignupData,
    SignupRequest,
    SignupResponse,
)


router = APIRouter(prefix="/auth", tags=["authentication"])


def _generate_employee_code(
    db: Session, company_id: UUID, role: UserRole = UserRole.WORKER
) -> str:
    prefix = "A" if role == UserRole.ADMIN else "W"
    for _ in range(10):
        employee_code = f"{prefix}{uuid4().hex[:9].upper()}"
        exists = db.scalar(
            select(User.id).where(
                User.company_id == company_id,
                User.employee_code == employee_code,
            )
        )
        if exists is None:
            return employee_code
    raise ApiError(
        503,
        "EMPLOYEE_CODE_GENERATION_FAILED",
        "Employee code could not be generated.",
    )


@router.post("/signup", response_model=SignupResponse, status_code=201)
def signup(
    request: SignupRequest, db: Annotated[Session, Depends(get_db)]
) -> SignupResponse:
    is_admin = request.role == UserRole.ADMIN
    if is_admin:
        configured_code = get_settings().admin_signup_code
        if configured_code is None:
            raise ApiError(
                403,
                "ADMIN_SIGNUP_DISABLED",
                "Administrator signup is not enabled.",
                "adminSignupCode",
            )
        submitted_code = request.admin_signup_code or ""
        if not hmac.compare_digest(
            submitted_code, configured_code.get_secret_value()
        ):
            raise ApiError(
                403,
                "INVALID_ADMIN_SIGNUP_CODE",
                "Administrator signup code is invalid.",
                "adminSignupCode",
            )
        if request.worker_profile is not None:
            raise ApiError(
                422,
                "VALIDATION_ERROR",
                "workerProfile must not be provided for ADMIN.",
                "workerProfile",
            )
    elif request.worker_profile is None:
        raise ApiError(422, "VALIDATION_ERROR", "workerProfile is required for WORKER.")

    company = db.scalar(
        select(Company)
        .where(func.lower(Company.name) == request.company_name.lower())
        .limit(1)
    )
    if company is None:
        raise ApiError(
            404, "COMPANY_NOT_FOUND", "Company was not found.", "companyName"
        )

    normalized_email = request.email
    if db.scalar(select(User.id).where(func.lower(User.email) == normalized_email)):
        raise ApiError(
            409, "EMAIL_ALREADY_EXISTS", "Email already exists.", "email"
        )

    profile_request = request.worker_profile
    site = None
    if profile_request is not None:
        site = db.scalar(
            select(WorkSite).where(
                WorkSite.company_id == company.id,
                func.lower(WorkSite.name) == profile_request.work_area.lower(),
            )
        )
        if site is None:
            raise ApiError(
                404, "SITE_NOT_FOUND", "Work area was not found.", "workArea"
            )

    employee_code = _generate_employee_code(db, company.id, request.role)

    user = User(
        company_id=company.id,
        employee_code=employee_code,
        email=normalized_email,
        password_hash=hash_password(request.password),
        name=request.name,
        phone=request.phone,
        role=request.role,
    )
    if profile_request is not None and site is not None:
        user.worker_profile = WorkerProfile(
            assigned_site_id=site.id,
            age=profile_request.age,
            work_type=profile_request.work_type,
            work_intensity=WORK_INTENSITY_BY_TYPE[profile_request.work_type],
            has_workwear=profile_request.has_workwear,
            has_cooling_device=False,
        )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if db.scalar(select(User.id).where(func.lower(User.email) == normalized_email)):
            raise ApiError(
                409, "EMAIL_ALREADY_EXISTS", "Email already exists.", "email"
            ) from exc
        raise ApiError(
            409,
            "EMPLOYEE_CODE_ALREADY_EXISTS",
            "Employee code already exists in this company.",
        ) from exc
    db.refresh(user)

    return SignupResponse(
        data=SignupData(
            user_id=user.id,
            employee_code=user.employee_code,
            name=user.name,
            role=user.role,
        )
    )


@router.post("/login", response_model=LoginResponse)
def login(
    request: LoginRequest, db: Annotated[Session, Depends(get_db)]
) -> LoginResponse:
    user = db.scalar(
        select(User)
        .where(func.lower(User.email) == request.email)
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
