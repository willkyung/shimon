from typing import Annotated

from fastapi import APIRouter, Depends

from backend.app.api.dependencies import get_current_user
from backend.app.models import User
from backend.app.schemas.user import (
    AssignedSiteData,
    MeData,
    MeResponse,
    WorkerProfileData,
)


router = APIRouter(tags=["users"])


@router.get("/me", response_model=MeResponse)
def me(current_user: Annotated[User, Depends(get_current_user)]) -> MeResponse:
    profile_data = None
    if current_user.worker_profile is not None:
        assigned_site = current_user.worker_profile.assigned_site
        profile_data = WorkerProfileData(
            age=current_user.worker_profile.age,
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
            worker_profile=profile_data,
        )
    )
