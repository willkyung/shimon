from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.api.dependencies import get_current_user
from backend.app.core.database import get_db
from backend.app.core.errors import ApiError
from backend.app.models import User, WorkerProfile, WorkSite
from backend.app.models.enums import UserRole
from backend.app.schemas.user import MeResponse, UpdateMeRequest


router = APIRouter(prefix="/users", tags=["users"])


def _to_me_response(user: User) -> MeResponse:
    profile = user.worker_profile
    workplace = None
    if profile is not None and profile.assigned_site is not None:
        workplace = profile.assigned_site.name

    return MeResponse(
        id=user.display_id,
        employee_code=user.employee_code,
        role=user.role,
        name=user.name,
        company=user.company.name,
        phone=user.phone,
        email=user.email,
        age=profile.age if profile else None,
        gender=profile.gender if profile else None,
        job_type=profile.job_type if profile else None,
        workplace=workplace,
        work_intensity=profile.work_intensity if profile else None,
        ppe_worn=profile.ppe_worn if profile else None,
    )


@router.get("/me", response_model=MeResponse)
def me(current_user: Annotated[User, Depends(get_current_user)]) -> MeResponse:
    return _to_me_response(current_user)


@router.patch("/me", response_model=MeResponse)
def update_me(
    request: UpdateMeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MeResponse:
    if current_user.role != UserRole.WORKER:
        raise ApiError(403, "ROLE_NOT_ALLOWED", "Worker 계정만 프로필을 수정할 수 있습니다.")

    if request.phone is not None:
        current_user.phone = request.phone
    if request.email is not None:
        normalized_email = request.email.strip().lower()
        if normalized_email != current_user.email and db.scalar(
            select(User.id).where(User.email == normalized_email)
        ):
            raise ApiError(409, "CONFLICT", "이미 사용 중인 이메일입니다.")
        current_user.email = normalized_email

    profile = current_user.worker_profile
    if profile is not None:
        if request.gender is not None:
            profile.gender = request.gender
        if request.job_type is not None:
            profile.job_type = request.job_type
        if request.work_intensity is not None:
            profile.work_intensity = request.work_intensity
        if request.ppe_worn is not None:
            profile.ppe_worn = request.ppe_worn
        if request.workplace is not None:
            site = db.scalar(
                select(WorkSite).where(
                    WorkSite.company_id == current_user.company_id,
                    WorkSite.name == request.workplace,
                )
            )
            if site is None:
                raise ApiError(404, "NOT_FOUND", "현장 정보를 찾을 수 없습니다.")
            profile.assigned_site_id = site.id

    db.commit()
    db.refresh(current_user)
    return _to_me_response(current_user)
