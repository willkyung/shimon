from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from backend.app.models.enums import (
    AiRiskLevel,
    ComplianceStatus,
    RestType,
    WorkSessionStatus,
)
from backend.app.schemas.common import ApiModel


class StartWorkSessionRequest(ApiModel):
    site_id: UUID
    work_type: str = Field(min_length=1, max_length=100)
    work_intensity: str = Field(min_length=1, max_length=30)
    clothing_level: str = Field(min_length=1, max_length=30)
    environment: str = Field(min_length=1, max_length=50)


class WeatherEvaluationData(ApiModel):
    temperature: float
    humidity: float
    feels_like_temperature: float


class ComplianceEvaluationData(ApiModel):
    status: ComplianceStatus
    is_rest_required: bool
    required_rest_minutes: int | None
    continuous_work_minutes: int
    feels_like_temperature: float
    rule_code: str
    rule_version: str


class EvaluationData(ApiModel):
    evaluated_at: datetime
    weather: WeatherEvaluationData
    compliance: ComplianceEvaluationData
    ai: None = None


class ActiveRestData(ApiModel):
    rest_id: UUID
    rest_type: RestType
    started_at: datetime
    required_rest_minutes: int


class WorkSessionData(ApiModel):
    id: UUID
    status: WorkSessionStatus
    started_at: datetime
    continuous_work_started_at: datetime
    continuous_work_minutes: int
    worker_state: Literal["WORKING", "RESTING"]
    active_rest: ActiveRestData | None = None
    latest_evaluation: EvaluationData | None = None


class WorkSessionResponse(ApiModel):
    success: Literal[True] = True
    data: WorkSessionData


class CurrentWorkSessionResponse(ApiModel):
    success: Literal[True] = True
    data: WorkSessionData | None


class EvaluationResponse(ApiModel):
    success: Literal[True] = True
    data: EvaluationData


class RestData(ApiModel):
    rest_id: UUID
    work_session_id: UUID
    rest_type: RestType
    started_at: datetime
    required_rest_minutes: int
    worker_state: Literal["RESTING"] = "RESTING"


class RestStartResponse(ApiModel):
    success: Literal[True] = True
    data: RestData


class RestEndData(ApiModel):
    rest_id: UUID
    work_session_id: UUID
    ended_at: datetime
    continuous_work_started_at: datetime
    duration_minutes: int
    worker_state: Literal["WORKING"] = "WORKING"
    evaluation: EvaluationData


class RestEndResponse(ApiModel):
    success: Literal[True] = True
    data: RestEndData


class WorkEndData(ApiModel):
    work_session_id: UUID
    status: WorkSessionStatus
    ended_at: datetime


class WorkEndResponse(ApiModel):
    success: Literal[True] = True
    data: WorkEndData


class RecordEvaluationData(ApiModel):
    evaluated_at: datetime
    feels_like_temperature: float
    compliance_status: ComplianceStatus
    is_rest_required: bool
    ai_risk_level: AiRiskLevel | None = None
    predicted_core_temperature: float | None = None


class WorkHistoryItemData(ApiModel):
    id: UUID
    status: WorkSessionStatus
    started_at: datetime
    ended_at: datetime | None
    duration_minutes: int
    work_type: str
    work_intensity: str
    evaluation: RecordEvaluationData | None = None


class WorkHistoryResponse(ApiModel):
    success: Literal[True] = True
    data: list[WorkHistoryItemData]


class RestHistoryItemData(ApiModel):
    id: UUID
    work_session_id: UUID
    rest_type: RestType
    started_at: datetime
    ended_at: datetime | None
    duration_minutes: int
    evaluation: RecordEvaluationData | None = None


class RestHistoryResponse(ApiModel):
    success: Literal[True] = True
    data: list[RestHistoryItemData]
