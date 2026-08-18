from datetime import datetime

from backend.app.models.enums import AlertStatus, OverallRiskLevel
from backend.app.schemas.common import ApiModel


# ------------------------------------------------------------------
# GET /admin/dashboard
# ------------------------------------------------------------------
class DashboardMetrics(ApiModel):
    working_count: int
    resting_count: int
    rest_needed_count: int
    current_apparent_temp_c: float | None
    max_apparent_temp_c: float | None
    high_core_temp_count: int
    average_estimated_core_temp_c: float | None
    high_risk_count: int
    ppe_missing_count: int
    rest_compliance_rate: int


class ApparentTempTrendPoint(ApiModel):
    time: str
    apparent_temp_c: float


class PriorityWorker(ApiModel):
    worker_id: int
    name: str
    site: str | None
    status: str
    risk_level: str
    apparent_temp_c: float
    estimated_core_temp_c: float


class DashboardResponse(ApiModel):
    metrics: DashboardMetrics
    apparent_temp_trend: list[ApparentTempTrendPoint]
    priority_workers: list[PriorityWorker]


# ------------------------------------------------------------------
# GET /admin/workers
# ------------------------------------------------------------------
class AdminWorkerItem(ApiModel):
    id: int
    employee_code: str
    name: str
    job_type: str | None
    phone: str | None
    ppe_worn: bool
    apparent_temp_c: float | None
    estimated_core_temp_c: float | None
    core_temp_level: str | None
    last_work_started_at: datetime | None
    last_work_ended_at: datetime | None
    daily_work_minutes: int
    status: str
    risk_level: str
    site: str | None


class AdminWorkersResponse(ApiModel):
    items: list[AdminWorkerItem]
    total: int
    page: int
    size: int


class AdminWorkerDetail(ApiModel):
    id: int
    employee_code: str
    name: str
    company: str
    job_type: str | None
    phone: str | None
    email: str
    age: int | None
    work_intensity: str | None
    ppe_worn: bool
    site: str | None
    current_status: str
    risk_level: str
    apparent_temp_c: float | None
    estimated_core_temp_c: float | None
    core_temp_level: str | None
    continuous_work_minutes: int | None
    daily_work_minutes: int
    last_work_started_at: datetime | None
    last_work_ended_at: datetime | None


# ------------------------------------------------------------------
# Alerts
# ------------------------------------------------------------------
class AlertItem(ApiModel):
    id: int
    worker_id: int
    worker_name: str
    risk_level: OverallRiskLevel
    title: str
    status_text: str
    message: str
    apparent_temp_c: float
    estimated_core_temp_c: float
    reason: str
    occurred_at: datetime
    alert_status: AlertStatus


class AlertsResponse(ApiModel):
    items: list[AlertItem]
    total: int
    page: int
    size: int


class UpdateAlertRequest(ApiModel):
    status: AlertStatus


class UpdateAlertResponse(ApiModel):
    id: int
    alert_status: AlertStatus
    updated_at: datetime


# ------------------------------------------------------------------
# Rest alert
# ------------------------------------------------------------------
class RestAlertRequest(ApiModel):
    message: str
    reason: str = "MANUAL_ADMIN_REQUEST"


class RestAlertResponse(ApiModel):
    notification_id: int
    worker_id: int
    type: str = "ADMIN_REST_REQUEST"
    sent_at: datetime


# ------------------------------------------------------------------
# Settings
# ------------------------------------------------------------------
class NotificationChannels(ApiModel):
    push: bool
    sms: bool
    email: bool
    emergency: bool


class AdminSettingsResponse(ApiModel):
    apparent_temp_danger_c: float
    apparent_temp_caution_c: float
    max_work_minutes: int
    rest_minutes: int
    core_temp_caution_c: float
    core_temp_danger_c: float
    default_site: str
    channels: NotificationChannels


class UpdateAdminSettingsRequest(ApiModel):
    apparent_temp_danger_c: float
    apparent_temp_caution_c: float
    max_work_minutes: int
    rest_minutes: int
    core_temp_caution_c: float
    core_temp_danger_c: float
    default_site: str
    channels: NotificationChannels


# ------------------------------------------------------------------
# Sites
# ------------------------------------------------------------------
class SiteItem(ApiModel):
    site_id: str
    site_code: str
    name: str
    zone_count: int


class SitesResponse(ApiModel):
    items: list[SiteItem]
