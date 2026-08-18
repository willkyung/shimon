from datetime import datetime
from typing import Literal
from uuid import UUID

from backend.app.models.enums import RestType
from backend.app.schemas.common import ApiModel


class StartRestData(ApiModel):
    rest_id: UUID
    work_session_id: UUID
    rest_type: RestType
    started_at: datetime
    worker_state: Literal["RESTING"] = "RESTING"


class StartRestResponse(ApiModel):
    success: Literal[True] = True
    data: StartRestData


class EndRestData(ApiModel):
    rest_id: UUID
    ended_at: datetime
    duration_minutes: int
    worker_state: Literal["WORKING"] = "WORKING"


class EndRestResponse(ApiModel):
    success: Literal[True] = True
    data: EndRestData
