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
