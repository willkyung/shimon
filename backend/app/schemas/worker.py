from datetime import datetime
from typing import Literal

from backend.app.models.enums import NotificationType, OverallRiskLevel, RestReason
from backend.app.schemas.common import ApiModel


# ------------------------------------------------------------------
# GET /worker/home
# ------------------------------------------------------------------
class HomeWorker(ApiModel):
    id: int
    name: str
    workplace: str | None


class HomeEnvironment(ApiModel):
    air_temp_c: float
    humidity_percent: float
    apparent_temp_c: float
    observed_at: datetime


class SafetyBlock(ApiModel):
    estimated_core_temp_c: float
    core_temp_level: str
    risk_level: str
    measurement_type: Literal["AI_ESTIMATE"] = "AI_ESTIMATE"
    is_measured: Literal[False] = False


class HomeWorkSession(ApiModel):
    id: int
    status: Literal["WORKING"]
    started_at: datetime
    elapsed_seconds: int


class RestRecommendation(ApiModel):
    max_continuous_work_minutes: int
    recommended_rest_minutes: int
    rest_needed: bool


class HomeResponse(ApiModel):
    worker: HomeWorker
    environment: HomeEnvironment
    safety: SafetyBlock
    work_session: HomeWorkSession | None
    rest_recommendation: RestRecommendation


# ------------------------------------------------------------------
# GET /worker/safety/current
# ------------------------------------------------------------------
class SafetyCurrentResponse(ApiModel):
    apparent_temp_c: float
    estimated_core_temp_c: float
    core_temp_level: str
    risk_level: str
    continuous_work_minutes: int
    measurement_type: Literal["AI_ESTIMATE"] = "AI_ESTIMATE"
    is_measured: Literal[False] = False
    evaluated_at: datetime


# ------------------------------------------------------------------
# Work sessions
# ------------------------------------------------------------------
class StartWorkSessionRequest(ApiModel):
    workplace: str | None = None


class StartWorkSessionResponse(ApiModel):
    id: int
    status: Literal["WORKING"] = "WORKING"
    started_at: datetime
    max_continuous_work_minutes: int


class CurrentWorkSessionResponse(ApiModel):
    id: int
    status: Literal["WORKING"] = "WORKING"
    started_at: datetime
    elapsed_seconds: int
    max_continuous_work_minutes: int


class EndWorkSessionResponse(ApiModel):
    id: int
    status: Literal["COMPLETED"] = "COMPLETED"
    ended_at: datetime
    duration_minutes: int
    average_apparent_temp_c: float | None
    max_estimated_core_temp_c: float | None
    max_risk_level: str | None


# ------------------------------------------------------------------
# Rest sessions
# ------------------------------------------------------------------
class StartRestSessionRequest(ApiModel):
    work_session_id: int | None = None
    reason: RestReason = RestReason.USER_STARTED


class StartRestSessionResponse(ApiModel):
    id: int
    status: Literal["RESTING"] = "RESTING"
    started_at: datetime
    target_minutes: int
    resume_work_after_rest: bool


class CurrentRestSessionResponse(ApiModel):
    id: int
    status: Literal["RESTING"] = "RESTING"
    started_at: datetime
    elapsed_seconds: int
    remaining_seconds: int
    target_minutes: int
    resume_work_after_rest: bool


class EndRestSessionResponse(ApiModel):
    id: int
    status: Literal["COMPLETED"] = "COMPLETED"
    ended_at: datetime
    duration_minutes: int
    resume_work: bool


# ------------------------------------------------------------------
# Records
# ------------------------------------------------------------------
class RecordItem(ApiModel):
    id: int
    type: Literal["WORK", "REST"]
    started_at: datetime
    ended_at: datetime | None
    duration_minutes: int
    average_apparent_temp_c: float | None
    max_estimated_core_temp_c: float | None
    risk_level: str | None


class RecordsResponse(ApiModel):
    items: list[RecordItem]
    total: int
    page: int
    size: int


class RecordsSummaryResponse(ApiModel):
    work_count: int
    total_work_minutes: int
    total_rest_minutes: int
    average_apparent_temp_c: float | None
    max_estimated_core_temp_c: float | None
    max_risk_level: str | None
    message: str


# ------------------------------------------------------------------
# Notifications
# ------------------------------------------------------------------
class NotificationItem(ApiModel):
    id: int
    type: NotificationType
    title: str
    message: str
    risk_level: OverallRiskLevel | None
    created_at: datetime
    read: bool


class NotificationsResponse(ApiModel):
    items: list[NotificationItem]
    unread_count: int


class MarkNotificationReadResponse(ApiModel):
    id: int
    read: bool


class SnoozeNotificationRequest(ApiModel):
    minutes: int = 5


class SnoozeNotificationResponse(ApiModel):
    notification_id: int
    snoozed_until: datetime


class NotificationSettingsResponse(ApiModel):
    enabled: bool


class UpdateNotificationSettingsRequest(ApiModel):
    enabled: bool
