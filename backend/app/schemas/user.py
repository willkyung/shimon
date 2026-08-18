from typing import Literal
from uuid import UUID

from backend.app.models.enums import UserRole
from backend.app.schemas.common import ApiModel


class AssignedSiteData(ApiModel):
    id: UUID
    name: str


class WorkerProfileData(ApiModel):
    age: int | None
    has_cooling_device: bool
    assigned_site: AssignedSiteData | None


class MeData(ApiModel):
    id: UUID
    name: str
    role: UserRole
    worker_profile: WorkerProfileData | None = None


class MeResponse(ApiModel):
    success: Literal[True] = True
    data: MeData
