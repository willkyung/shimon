from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.api.dependencies import get_current_user
from backend.app.core.database import get_db
from backend.app.core.errors import ApiError
from backend.app.models import User, WorkSite
from backend.app.models.enums import UserRole
from backend.app.schemas.auth import WORK_INTENSITY_BY_TYPE
from backend.app.schemas.user import (
    AssignedSiteData,
    MeData,
    MeResponse,
    UpdateMeRequest,
    WorkerProfileData,
)


router = APIRouter(tags=["users"])


def _me_response(current_user: User) -> MeResponse:
    profile_data = None
    if current_user.worker_profile is not None:
        assigned_site = current_user.worker_profile.assigned_site
        profile_data = WorkerProfileData(
            age=current_user.worker_profile.age,
            gender=current_user.worker_profile.gender,
            work_type=current_user.worker_profile.work_type,
            work_intensity=current_user.worker_profile.work_intensity,
            has_workwear=current_user.worker_profile.has_workwear,
            has_cooling_device=current_user.worker_profile.has_cooling_device,
            assigned_site=(
                AssignedSiteData(id=assigned_site.id, name=assigned_site.name)
                if assigned_site is not None
                else None
            ),
        )

    return MeResponse(
        data=MeData(
            id=current_user.id,
            name=current_user.name,
            role=current_user.role,
            company_code=current_user.company.code,
            company_name=current_user.company.name,
            employee_code=current_user.employee_code,
            email=current_user.email,
            phone=current_user.phone,
            worker_profile=profile_data,
        )
    )


@router.get("/me", response_model=MeResponse)
def me(current_user: Annotated[User, Depends(get_current_user)]) -> MeResponse:
    return _me_response(current_user)


@router.patch("/me", response_model=MeResponse)
def update_me(
    request: UpdateMeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MeResponse:
    if current_user.role != UserRole.WORKER or current_user.worker_profile is None:
        raise ApiError(403, "FORBIDDEN", "Only worker profiles can be updated.")

    duplicate_email = db.scalar(
        select(User.id).where(
            User.id != current_user.id,
            func.lower(User.email) == request.email,
        )
    )
    if duplicate_email is not None:
        raise ApiError(409, "EMAIL_ALREADY_EXISTS", "Email already exists.", "email")

    site = db.scalar(
        select(WorkSite).where(
            WorkSite.company_id == current_user.company_id,
            func.lower(WorkSite.name) == request.work_area.lower(),
        )
    )
    if site is None:
        raise ApiError(404, "SITE_NOT_FOUND", "Work area was not found.", "workArea")

    profile = current_user.worker_profile
    current_user.email = request.email
    current_user.phone = request.phone
    profile.assigned_site_id = site.id
    profile.assigned_site = site
    profile.gender = request.gender
    profile.work_type = request.work_type
    profile.work_intensity = WORK_INTENSITY_BY_TYPE[request.work_type]
    profile.has_workwear = request.has_workwear

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError(
            409, "EMAIL_ALREADY_EXISTS", "Email already exists.", "email"
        ) from exc

    return _me_response(current_user)
