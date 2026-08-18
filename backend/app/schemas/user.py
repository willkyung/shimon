from uuid import UUID

from backend.app.models.enums import Gender, UserRole, WorkIntensity
from backend.app.schemas.common import ApiModel


class MeResponse(ApiModel):
    id: int
    employee_code: str
    role: UserRole
    name: str
    company: str
    phone: str | None
    email: str
    # Worker 전용 필드. Admin 응답에서는 전부 None으로 내려간다.
    age: int | None = None
    gender: Gender | None = None
    job_type: str | None = None
    workplace: str | None = None
    # work_sessions.py(POST /work-sessions)가 site_id(UUID)를 요구해서 추가한 필드.
    # 명세서 v1.2엔 없지만, 프론트가 작업 시작 시 이 값을 그대로 site_id로 보낸다.
    assigned_site_id: UUID | None = None
    work_intensity: WorkIntensity | None = None
    ppe_worn: bool | None = None


class UpdateMeRequest(ApiModel):
    phone: str | None = None
    email: str | None = None
    gender: Gender | None = None
    job_type: str | None = None
    workplace: str | None = None
    work_intensity: WorkIntensity | None = None
    ppe_worn: bool | None = None
