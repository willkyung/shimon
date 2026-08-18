from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.app.api.dependencies import require_role
from backend.app.core.database import get_db
from backend.app.core.errors import ApiError
from backend.app.models import (
    AdminSettings,
    Alert,
    Notification,
    SiteWeatherLog,
    User,
    WorkerProfile,
    WorkSession,
    WorkSite,
)
from backend.app.models.enums import (
    AlertStatus,
    NotificationType,
    UserRole,
    WorkSessionStatus,
)
from backend.app.schemas.admin import (
    AdminSettingsResponse,
    AdminWorkerDetail,
    AdminWorkerItem,
    AdminWorkersResponse,
    AlertItem,
    AlertsResponse,
    ApparentTempTrendPoint,
    DashboardMetrics,
    DashboardResponse,
    NotificationChannels,
    PriorityWorker,
    RestAlertRequest,
    RestAlertResponse,
    SiteItem,
    SitesResponse,
    UpdateAdminSettingsRequest,
    UpdateAlertRequest,
    UpdateAlertResponse,
)
from backend.app.services.safety_service import (
    compute_live_safety,
    get_active_rest_record,
    get_active_work_session,
)

router = APIRouter(tags=["admin"])
require_admin = require_role(UserRole.ADMIN)


# ------------------------------------------------------------------
# 내부 헬퍼: 회사 내 전체 작업자에 대해 실시간 상태를 한 번에 계산
# ------------------------------------------------------------------
def _load_company_workers(db: Session, company_id: UUID) -> list[User]:
    return db.scalars(
        select(User)
        .join(WorkerProfile)
        .where(User.company_id == company_id, User.role == UserRole.WORKER, User.is_active)
        .options(
            selectinload(User.worker_profile).selectinload(WorkerProfile.assigned_site)
        )
    ).all()


def _compute_worker_status(db: Session, worker: User) -> dict:
    """
    작업자 1명의 현재 상태를 계산한다. 작업 중이 아니면(IDLE) 안전값도 참고용
    기준치로만 계산되고, status는 IDLE로 내려간다.
    """
    session = get_active_work_session(db, worker)
    safety = compute_live_safety(worker, session)

    if session is None:
        status = "IDLE"
    else:
        rest = get_active_rest_record(db, worker)
        if rest is not None and rest.work_session_id == session.id:
            status = "RESTING"
        elif safety is not None and safety["risk_level"] in ("CAUTION", "HIGH"):
            status = "REST_NEEDED"
        else:
            status = "WORKING"

    return {"session": session, "safety": safety, "status": status}


# ------------------------------------------------------------------
# GET /admin/dashboard
# ------------------------------------------------------------------
@router.get("/admin/dashboard", response_model=DashboardResponse)
def admin_dashboard(
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    site: str = "all",
) -> DashboardResponse:
    workers = _load_company_workers(db, current_user.company_id)

    working_count = resting_count = rest_needed_count = 0
    high_core_temp_count = high_risk_count = ppe_missing_count = 0
    apparent_values: list[float] = []
    core_values: list[float] = []
    priority: list[PriorityWorker] = []

    for worker in workers:
        info = _compute_worker_status(db, worker)
        status = info["status"]
        safety = info["safety"]

        if status == "WORKING":
            working_count += 1
        elif status == "RESTING":
            resting_count += 1
        elif status == "REST_NEEDED":
            rest_needed_count += 1
            working_count += 1  # REST_NEEDED도 "일하고 있는 중"의 하위 상태로 집계

        if safety is None:
            continue

        apparent_values.append(safety["inputs"]["feels_like_temp"])
        core_values.append(safety["predicted_core_temp"])
        if safety["risk_level"] == "HIGH":
            high_core_temp_count += 1
            high_risk_count += 1
        if worker.worker_profile and not worker.worker_profile.ppe_worn:
            ppe_missing_count += 1

        if status in ("REST_NEEDED",) or safety["risk_level"] in ("CAUTION", "HIGH"):
            site_name = (
                worker.worker_profile.assigned_site.name
                if worker.worker_profile and worker.worker_profile.assigned_site
                else None
            )
            priority.append(PriorityWorker(
                worker_id=worker.display_id,
                name=worker.name,
                site=site_name,
                status=status,
                risk_level=safety["risk_level"],
                apparent_temp_c=safety["inputs"]["feels_like_temp"],
                estimated_core_temp_c=safety["predicted_core_temp"],
            ))

    # 오늘 하루 시간대별(2시간 단위) 평균 체감온도 — 회사 소속 현장의 site_weather_logs 기준
    today = datetime.now(UTC).date()
    logs = db.scalars(
        select(SiteWeatherLog)
        .join(WorkSite)
        .where(WorkSite.company_id == current_user.company_id)
    ).all()
    today_logs = [l for l in logs if l.measured_at.date() == today]
    buckets: dict[int, list[float]] = {}
    for log in today_logs:
        bucket = (log.measured_at.hour // 2) * 2
        buckets.setdefault(bucket, []).append(float(log.feels_like_temperature))
    trend = [
        ApparentTempTrendPoint(time=f"{hour:02d}:00", apparent_temp_c=round(sum(vals) / len(vals), 1))
        for hour, vals in sorted(buckets.items())
    ]

    priority.sort(key=lambda p: {"NORMAL": 0, "CAUTION": 1, "HIGH": 2}[p.risk_level], reverse=True)

    return DashboardResponse(
        metrics=DashboardMetrics(
            working_count=working_count,
            resting_count=resting_count,
            rest_needed_count=rest_needed_count,
            current_apparent_temp_c=(
                round(sum(apparent_values) / len(apparent_values), 1) if apparent_values else None
            ),
            max_apparent_temp_c=max(apparent_values) if apparent_values else None,
            high_core_temp_count=high_core_temp_count,
            average_estimated_core_temp_c=(
                round(sum(core_values) / len(core_values), 2) if core_values else None
            ),
            high_risk_count=high_risk_count,
            ppe_missing_count=ppe_missing_count,
            rest_compliance_rate=100,  # 실제 이행률 추적 로직은 아직 없음 (단순 기본값)
        ),
        apparent_temp_trend=trend,
        priority_workers=priority[:10],
    )


# ------------------------------------------------------------------
# GET /admin/workers
# ------------------------------------------------------------------
@router.get("/admin/workers", response_model=AdminWorkersResponse)
def admin_workers(
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    site: str = "all",
    status: str = "all",
    search: str | None = None,
    sort: str = "priority",
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=200),
) -> AdminWorkersResponse:
    workers = _load_company_workers(db, current_user.company_id)

    items: list[AdminWorkerItem] = []
    for worker in workers:
        if search and search not in worker.name:
            continue
        profile = worker.worker_profile
        site_name = profile.assigned_site.name if profile and profile.assigned_site else None
        if site != "all" and site_name != site:
            continue

        info = _compute_worker_status(db, worker)
        worker_status = info["status"]
        if status != "all" and worker_status != status:
            continue
        safety = info["safety"]
        session = info["session"]

        items.append(AdminWorkerItem(
            id=worker.display_id,
            employee_code=worker.employee_code,
            name=worker.name,
            job_type=profile.job_type if profile else None,
            phone=worker.phone,
            ppe_worn=profile.ppe_worn if profile else True,
            apparent_temp_c=safety["inputs"]["feels_like_temp"] if safety else None,
            estimated_core_temp_c=safety["predicted_core_temp"] if safety else None,
            core_temp_level=safety["core_temp_level"] if safety else None,
            last_work_started_at=session.started_at if session else None,
            last_work_ended_at=session.ended_at if session else None,
            daily_work_minutes=_daily_work_minutes(db, worker.id),
            status=worker_status,
            risk_level=safety["risk_level"] if safety else "NORMAL",
            site=site_name,
        ))

    sort_key = {
        "priority": lambda i: {"NORMAL": 0, "CAUTION": 1, "HIGH": 2}.get(i.risk_level, 0),
        "temp_desc": lambda i: i.apparent_temp_c or 0,
        "core_desc": lambda i: i.estimated_core_temp_c or 0,
        "work_desc": lambda i: i.daily_work_minutes,
        "name": lambda i: i.name,
    }.get(sort)
    if sort_key:
        items.sort(key=sort_key, reverse=(sort != "name"))

    total = len(items)
    start = (page - 1) * size
    page_items = items[start : start + size]
    return AdminWorkersResponse(items=page_items, total=total, page=page, size=size)


def _daily_work_minutes(db: Session, worker_id: UUID) -> int:
    today = datetime.now(UTC).date()
    sessions = db.scalars(
        select(WorkSession).where(WorkSession.worker_id == worker_id)
    ).all()
    total = 0
    for s in sessions:
        if s.started_at.date() != today:
            continue
        end = s.ended_at or datetime.now(UTC)
        total += int((end - s.started_at).total_seconds() // 60)
    return total


@router.get("/admin/workers/{worker_display_id}", response_model=AdminWorkerDetail)
def admin_worker_detail(
    worker_display_id: int,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminWorkerDetail:
    worker = db.scalar(
        select(User)
        .options(selectinload(User.worker_profile).selectinload(WorkerProfile.assigned_site))
        .where(User.display_id == worker_display_id, User.company_id == current_user.company_id)
    )
    if worker is None:
        raise ApiError(404, "NOT_FOUND", "작업자를 찾을 수 없습니다.")

    info = _compute_worker_status(db, worker)
    safety = info["safety"]
    session = info["session"]
    profile = worker.worker_profile

    return AdminWorkerDetail(
        id=worker.display_id,
        employee_code=worker.employee_code,
        name=worker.name,
        company=current_user.company.name,
        job_type=profile.job_type if profile else None,
        phone=worker.phone,
        email=worker.email,
        age=profile.age if profile else None,
        work_intensity=profile.work_intensity.value if profile else None,
        ppe_worn=profile.ppe_worn if profile else True,
        site=profile.assigned_site.name if profile and profile.assigned_site else None,
        current_status=info["status"],
        risk_level=safety["risk_level"] if safety else "NORMAL",
        apparent_temp_c=safety["inputs"]["feels_like_temp"] if safety else None,
        estimated_core_temp_c=safety["predicted_core_temp"] if safety else None,
        core_temp_level=safety["core_temp_level"] if safety else None,
        continuous_work_minutes=safety["inputs"]["continuous_work_min"] if safety else None,
        daily_work_minutes=_daily_work_minutes(db, worker.id),
        last_work_started_at=session.started_at if session else None,
        last_work_ended_at=session.ended_at if session else None,
    )


# ------------------------------------------------------------------
# Alerts
# ------------------------------------------------------------------
@router.get("/admin/alerts", response_model=AlertsResponse)
def admin_alerts(
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    site: str = "all",
    level: str = "all",
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=200),
) -> AlertsResponse:
    alerts = db.scalars(
        select(Alert)
        .join(User, Alert.worker_id == User.id)
        .options(selectinload(Alert.worker))
        .where(User.company_id == current_user.company_id)
        .order_by(Alert.occurred_at.desc())
    ).all()

    if level != "all":
        alerts = [a for a in alerts if a.risk_level.value == level]
    if status:
        alerts = [a for a in alerts if a.alert_status.value == status]

    total = len(alerts)
    start = (page - 1) * size
    page_alerts = alerts[start : start + size]

    items = [
        AlertItem(
            id=a.display_id,
            worker_id=a.worker.display_id,
            worker_name=a.worker.name,
            risk_level=a.risk_level,
            title=a.title,
            status_text=a.status_text,
            message=a.message,
            apparent_temp_c=float(a.apparent_temp_c),
            estimated_core_temp_c=float(a.estimated_core_temp_c),
            reason=a.reason,
            occurred_at=a.occurred_at,
            alert_status=a.alert_status,
        )
        for a in page_alerts
    ]
    return AlertsResponse(items=items, total=total, page=page, size=size)


@router.patch("/admin/alerts/{alert_display_id}", response_model=UpdateAlertResponse)
def update_alert(
    alert_display_id: int,
    request: UpdateAlertRequest,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> UpdateAlertResponse:
    alert = db.scalar(
        select(Alert)
        .join(User, Alert.worker_id == User.id)
        .where(Alert.display_id == alert_display_id, User.company_id == current_user.company_id)
    )
    if alert is None:
        raise ApiError(404, "NOT_FOUND", "알림을 찾을 수 없습니다.")

    alert.alert_status = request.status
    db.commit()
    db.refresh(alert)
    return UpdateAlertResponse(id=alert.display_id, alert_status=alert.alert_status, updated_at=alert.updated_at)


# ------------------------------------------------------------------
# POST /admin/workers/{workerId}/rest-alert
# ------------------------------------------------------------------
@router.post("/admin/workers/{worker_display_id}/rest-alert", response_model=RestAlertResponse, status_code=201)
def send_rest_alert(
    worker_display_id: int,
    request: RestAlertRequest,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> RestAlertResponse:
    worker = db.scalar(
        select(User).where(
            User.display_id == worker_display_id, User.company_id == current_user.company_id
        )
    )
    if worker is None:
        raise ApiError(404, "NOT_FOUND", "작업자를 찾을 수 없습니다.")

    now = datetime.now(UTC)
    notification = Notification(
        user_id=worker.id,
        type=NotificationType.ADMIN_REST_REQUEST,
        title="관리자 휴식 권고",
        message=request.message,
        risk_level=None,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    return RestAlertResponse(
        notification_id=notification.display_id, worker_id=worker.display_id, sent_at=now
    )


# ------------------------------------------------------------------
# Settings
# ------------------------------------------------------------------
def _get_or_create_settings(db: Session, company_id: UUID) -> AdminSettings:
    settings = db.scalar(select(AdminSettings).where(AdminSettings.company_id == company_id))
    if settings is None:
        settings = AdminSettings(company_id=company_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _to_settings_response(settings: AdminSettings) -> AdminSettingsResponse:
    return AdminSettingsResponse(
        apparent_temp_danger_c=float(settings.apparent_temp_danger_c),
        apparent_temp_caution_c=float(settings.apparent_temp_caution_c),
        max_work_minutes=settings.max_work_minutes,
        rest_minutes=settings.rest_minutes,
        core_temp_caution_c=float(settings.core_temp_caution_c),
        core_temp_danger_c=float(settings.core_temp_danger_c),
        default_site=settings.default_site,
        channels=NotificationChannels(
            push=settings.channel_push,
            sms=settings.channel_sms,
            email=settings.channel_email,
            emergency=settings.channel_emergency,
        ),
    )


@router.get("/admin/settings", response_model=AdminSettingsResponse)
def get_admin_settings(
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminSettingsResponse:
    settings = _get_or_create_settings(db, current_user.company_id)
    return _to_settings_response(settings)


@router.put("/admin/settings", response_model=AdminSettingsResponse)
def update_admin_settings(
    request: UpdateAdminSettingsRequest,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminSettingsResponse:
    if request.apparent_temp_danger_c <= request.apparent_temp_caution_c:
        raise ApiError(422, "VALIDATION_ERROR", "apparentTempDangerC는 apparentTempCautionC보다 커야 합니다.")
    if request.core_temp_danger_c <= request.core_temp_caution_c:
        raise ApiError(422, "VALIDATION_ERROR", "coreTempDangerC는 coreTempCautionC보다 커야 합니다.")
    if request.rest_minutes <= 0:
        raise ApiError(422, "VALIDATION_ERROR", "restMinutes는 0보다 커야 합니다.")
    if request.max_work_minutes <= 0:
        raise ApiError(422, "VALIDATION_ERROR", "maxWorkMinutes는 0보다 커야 합니다.")

    settings = _get_or_create_settings(db, current_user.company_id)
    settings.apparent_temp_danger_c = request.apparent_temp_danger_c
    settings.apparent_temp_caution_c = request.apparent_temp_caution_c
    settings.max_work_minutes = request.max_work_minutes
    settings.rest_minutes = request.rest_minutes
    settings.core_temp_caution_c = request.core_temp_caution_c
    settings.core_temp_danger_c = request.core_temp_danger_c
    settings.default_site = request.default_site
    settings.channel_push = request.channels.push
    settings.channel_sms = request.channels.sms
    settings.channel_email = request.channels.email
    settings.channel_emergency = request.channels.emergency
    db.commit()
    db.refresh(settings)
    return _to_settings_response(settings)


# ------------------------------------------------------------------
# GET /sites
# ------------------------------------------------------------------
@router.get("/sites", response_model=SitesResponse)
def list_sites(
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SitesResponse:
    sites = db.scalars(
        select(WorkSite).where(WorkSite.company_id == current_user.company_id)
    ).all()
    items = [
        SiteItem(
            site_id=str(s.id),
            site_code=s.name.upper().replace(" ", "_"),
            name=s.name,
            zone_count=1,
        )
        for s in sites
    ]
    return SitesResponse(items=items)
