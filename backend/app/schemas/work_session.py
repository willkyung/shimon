from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import ConfigDict, Field

from backend.app.models.enums import WorkSessionStatus
from backend.app.schemas.common import ApiModel


class StartWorkSessionRequest(ApiModel):
    model_config = ConfigDict(extra="forbid")

    site_id: UUID
    work_type: str = Field(min_length=1, max_length=100)
    work_intensity: str = Field(min_length=1, max_length=30)
    clothing_level: str = Field(min_length=1, max_length=30)
    environment: str = Field(min_length=1, max_length=50)


class StartWorkSessionData(ApiModel):
    work_session_id: UUID
    status: WorkSessionStatus
    started_at: datetime


class StartWorkSessionResponse(ApiModel):
    success: Literal[True] = True
    data: StartWorkSessionData


class CurrentWorkSessionData(ApiModel):
    id: UUID
    site_id: UUID
    work_type: str
    work_intensity: str
    clothing_level: str
    environment: str
    status: WorkSessionStatus
    started_at: datetime
    continuous_work_minutes: int
    worker_state: Literal["WORKING", "RESTING"]


class CurrentWorkSessionResponse(ApiModel):
    success: Literal[True] = True
    data: CurrentWorkSessionData | None


class EndWorkSessionData(ApiModel):
    work_session_id: UUID
    status: WorkSessionStatus
    ended_at: datetime
    worker_state: Literal["IDLE"] = "IDLE"


class EndWorkSessionResponse(ApiModel):
    success: Literal[True] = True
    data: EndWorkSessionData
