from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from backend.app.core.database import get_db
from backend.app.core.errors import ApiError
from backend.app.core.security import (
    create_access_token,
    create_refresh_token,
    create_verification_token,
    decode_refresh_token,
    decode_verification_token,
    hash_password,
    verify_password,
    VERIFICATION_TOKEN_EXPIRE_SECONDS,
)
from backend.app.models import EmployeeRoster, User, WorkerProfile, WorkSite
from backend.app.models.enums import UserRole
from backend.app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LoginUser,
    LogoutResponse,
    RefreshRequest,
    RefreshResponse,
    SignupRequest,
    SignupResponse,
    VerifyEmployeeInfo,
    VerifyEmployeeRequest,
    VerifyEmployeeResponse,
)
from backend.app.core.config import get_settings


router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/verify-employee", response_model=VerifyEmployeeResponse)
def verify_employee(
    request: VerifyEmployeeRequest, db: Annotated[Session, Depends(get_db)]
) -> VerifyEmployeeResponse:
    roster = db.scalar(
        select(EmployeeRoster)
        .options(
            selectinload(EmployeeRoster.company),
            selectinload(EmployeeRoster.workplace_site),
        )
        .where(
            EmployeeRoster.employee_code == request.employee_code,
            EmployeeRoster.name == request.name,
        )
    )
    if roster is None:
        raise ApiError(
            404, "EMPLOYEE_NOT_FOUND", "등록된 사원 정보를 찾을 수 없습니다."
        )
    if db.scalar(select(User.id).where(User.employee_code == roster.employee_code)):
        raise ApiError(409, "CONFLICT", "이미 가입이 완료된 사원입니다.")

    return VerifyEmployeeResponse(
        verification_token=create_verification_token(roster.id),
        expires_in=VERIFICATION_TOKEN_EXPIRE_SECONDS,
        employee=VerifyEmployeeInfo(
            employee_code=roster.employee_code,
            name=roster.name,
            company=roster.company.name,
            role=roster.role,
            job_type=roster.job_type,
            workplace=(
                roster.workplace_site.name if roster.workplace_site else None
            ),
        ),
    )


@router.post("/signup", response_model=SignupResponse, status_code=201)
def signup(
    request: SignupRequest, db: Annotated[Session, Depends(get_db)]
) -> SignupResponse:
    try:
        payload = decode_verification_token(request.verification_token)
        roster_id = UUID(str(payload["roster_id"]))
    except (jwt.PyJWTError, ValueError, KeyError) as exc:
        raise ApiError(
            401, "INVALID_VERIFICATION_TOKEN", "인증 토큰이 유효하지 않거나 만료되었습니다."
        ) from exc

    roster = db.scalar(
        select(EmployeeRoster)
        .options(selectinload(EmployeeRoster.company))
        .where(EmployeeRoster.id == roster_id)
    )
    if roster is None:
        raise ApiError(
            401, "INVALID_VERIFICATION_TOKEN", "인증 토큰이 유효하지 않거나 만료되었습니다."
        )

    if db.scalar(select(User.id).where(User.employee_code == roster.employee_code)):
        raise ApiError(409, "CONFLICT", "이미 가입이 완료된 사원입니다.")

    normalized_email = request.email.strip().lower()
    if db.scalar(select(User.id).where(User.email == normalized_email)):
        raise ApiError(409, "CONFLICT", "이미 사용 중인 이메일입니다.")

    user = User(
        company_id=roster.company_id,
        employee_code=roster.employee_code,
        email=normalized_email,
        password_hash=hash_password(request.password),
        name=roster.name,
        phone=request.phone,
        role=roster.role,
    )

    if roster.role == UserRole.WORKER:
        site = None
        if request.workplace:
            site = db.scalar(
                select(WorkSite).where(
                    WorkSite.company_id == roster.company_id,
                    WorkSite.name == request.workplace,
                )
            )
            if site is None:
                raise ApiError(404, "NOT_FOUND", "현장 정보를 찾을 수 없습니다.")
        elif roster.workplace_site_id is not None:
            site = db.get(WorkSite, roster.workplace_site_id)

        user.worker_profile = WorkerProfile(
            assigned_site_id=site.id if site else None,
            age=request.age,
            gender=request.gender,
            job_type=request.job_type or roster.job_type,
            work_intensity=request.work_intensity,
            ppe_worn=request.ppe_worn,
        )

    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError(409, "CONFLICT", "이미 사용 중인 사원코드 또는 이메일입니다.") from exc
    db.refresh(user)

    return SignupResponse(
        id=user.display_id,
        employee_code=user.employee_code,
        name=user.name,
        company=roster.company.name,
        role=user.role,
        email=user.email,
        phone=user.phone,
    )


@router.post("/login", response_model=LoginResponse)
def login(
    request: LoginRequest, db: Annotated[Session, Depends(get_db)]
) -> LoginResponse:
    identifier = request.identifier.strip().lower()
    user = db.scalar(
        select(User)
        .options(
            selectinload(User.company),
            selectinload(User.worker_profile).selectinload(
                WorkerProfile.assigned_site
            ),
        )
        .where(
            (User.employee_code == request.identifier) | (User.email == identifier)
        )
    )
    if user is None or not user.is_active or not verify_password(
        request.password, user.password_hash
    ):
        raise ApiError(401, "INVALID_CREDENTIALS", "사원코드 또는 비밀번호가 올바르지 않습니다.")

    access_token = create_access_token(user.id, user.role)
    refresh_token = create_refresh_token(user.id)
    user.last_login_at = datetime.now(UTC)
    db.commit()

    workplace = None
    if user.worker_profile is not None and user.worker_profile.assigned_site is not None:
        workplace = user.worker_profile.assigned_site.name

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=get_settings().jwt_access_token_expire_minutes * 60,
        user=LoginUser(
            id=user.display_id,
            employee_code=user.employee_code,
            role=user.role,
            name=user.name,
            company=user.company.name,
            workplace=workplace,
        ),
    )


@router.post("/refresh", response_model=RefreshResponse)
def refresh(
    request: RefreshRequest, db: Annotated[Session, Depends(get_db)]
) -> RefreshResponse:
    try:
        payload = decode_refresh_token(request.refresh_token)
        user_id = UUID(str(payload["sub"]))
    except (jwt.PyJWTError, ValueError, KeyError) as exc:
        raise ApiError(401, "UNAUTHORIZED", "리프레시 토큰이 유효하지 않거나 만료되었습니다.") from exc

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None or not user.is_active:
        raise ApiError(401, "UNAUTHORIZED", "리프레시 토큰이 유효하지 않거나 만료되었습니다.")

    return RefreshResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
        expires_in=get_settings().jwt_access_token_expire_minutes * 60,
    )


@router.post("/logout", response_model=LogoutResponse)
def logout() -> LogoutResponse:
    # 리프레시 토큰을 서버에 저장/블랙리스트하지 않는 stateless 방식이라 실제로 무효화할
    # 서버 상태가 없다. 클라이언트가 저장된 토큰을 지우는 것으로 로그아웃을 완료한다.
    return LogoutResponse()
