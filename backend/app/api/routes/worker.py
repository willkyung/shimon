from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from backend.app.api.dependencies import get_current_user, require_role
from backend.app.core.database import get_db
from backend.app.core.errors import ApiError
from backend.app.models import (
    HeatRiskAssessment,
    Notification,
    RestRecord,
    User,
    WorkSession,
    WorkSite,
)
from backend.app.models.enums import (
    NotificationType,
    RestReason,
    UserRole,
    WorkSessionStatus,
)
from backend.app.schemas.worker import (
    CurrentRestSessionResponse,
    CurrentWorkSessionResponse,
    EndRestSessionResponse,
    EndWorkSessionResponse,
    HomeEnvironment,
    HomeResponse,
    HomeWorker,
    HomeWorkSession,
    MarkNotificationReadResponse,
    NotificationItem,
    NotificationSettingsResponse,
    NotificationsResponse,
    RecordItem,
    RecordsResponse,
    RecordsSummaryResponse,
    RestRecommendation,
    SafetyBlock,
    SafetyCurrentResponse,
    SnoozeNotificationRequest,
    SnoozeNotificationResponse,
    StartRestSessionRequest,
    StartRestSessionResponse,
    StartWorkSessionRequest,
    StartWorkSessionResponse,
    UpdateNotificationSettingsRequest,
)
from backend.app.services.heat_features import ppe_worn_to_clothing_level
from backend.app.services.safety_service import (
    MAX_CONTINUOUS_WORK_MINUTES,
    REST_TARGET_MINUTES,
    compute_live_safety_or_raise,
    get_active_rest_record,
    get_active_work_session,
)

router = APIRouter(prefix="/worker", tags=["worker"])
require_worker = require_role(UserRole.WORKER)


# ------------------------------------------------------------------
# 내부 헬퍼 (routes/worker.py 안에서만 짧게 쓰는 별칭)
# ------------------------------------------------------------------
_get_active_work_session = get_active_work_session
_get_active_rest_record = get_active_rest_record


def _compute_live_safety(db: Session, user: User, session: WorkSession | None) -> dict:
    return compute_live_safety_or_raise(db, user, session)


# ------------------------------------------------------------------
# GET /worker/home
# ------------------------------------------------------------------
@router.get("/home", response_model=HomeResponse)
def worker_home(
    current_user: Annotated[User, Depends(require_worker)],
    db: Annotated[Session, Depends(get_db)],
) -> HomeResponse:
    session = _get_active_work_session(db, current_user)
    safety = _compute_live_safety(db, current_user, session)
    profile = current_user.worker_profile
    workplace = profile.assigned_site.name if profile and profile.assigned_site else None

    work_session_block = None
    if session is not None:
        elapsed = int((datetime.now(UTC) - session.started_at).total_seconds())
        work_session_block = HomeWorkSession(
            id=session.display_id,
            status="WORKING",
            started_at=session.started_at,
            elapsed_seconds=max(0, elapsed),
        )

    rest_needed = safety["risk_level"] in ("CAUTION", "HIGH")

    return HomeResponse(
        worker=HomeWorker(id=current_user.display_id, name=current_user.name, workplace=workplace),
        environment=HomeEnvironment(
            air_temp_c=safety["weather"]["temp"],
            humidity_percent=safety["weather"]["humidity"],
            apparent_temp_c=safety["inputs"]["feels_like_temp"],
            observed_at=safety["assessed_at"],
        ),
        safety=SafetyBlock(
            estimated_core_temp_c=safety["predicted_core_temp"],
            core_temp_level=safety["core_temp_level"],
            risk_level=safety["risk_level"],
        ),
        work_session=work_session_block,
        rest_recommendation=RestRecommendation(
            max_continuous_work_minutes=MAX_CONTINUOUS_WORK_MINUTES,
            recommended_rest_minutes=REST_TARGET_MINUTES,
            rest_needed=rest_needed,
        ),
    )


# ------------------------------------------------------------------
# GET /worker/safety/current
# ------------------------------------------------------------------
@router.get("/safety/current", response_model=SafetyCurrentResponse)
def safety_current(
    current_user: Annotated[User, Depends(require_worker)],
    db: Annotated[Session, Depends(get_db)],
) -> SafetyCurrentResponse:
    session = _get_active_work_session(db, current_user)
    safety = _compute_live_safety(db, current_user, session)

    return SafetyCurrentResponse(
        apparent_temp_c=safety["inputs"]["feels_like_temp"],
        estimated_core_temp_c=safety["predicted_core_temp"],
        core_temp_level=safety["core_temp_level"],
        risk_level=safety["risk_level"],
        continuous_work_minutes=safety["inputs"]["continuous_work_min"],
        evaluated_at=safety["assessed_at"],
    )


# ------------------------------------------------------------------
# Work sessions
# ------------------------------------------------------------------
@router.post("/work-sessions", response_model=StartWorkSessionResponse, status_code=201)
def start_work_session(
    request: StartWorkSessionRequest,
    current_user: Annotated[User, Depends(require_worker)],
    db: Annotated[Session, Depends(get_db)],
) -> StartWorkSessionResponse:
    profile = current_user.worker_profile
    if profile is None:
        raise ApiError(404, "NOT_FOUND", "작업자 프로필 정보가 없습니다.")

    site_id = profile.assigned_site_id
    if request.workplace:
        site = db.scalar(
            select(WorkSite).where(
                WorkSite.company_id == current_user.company_id,
                WorkSite.name == request.workplace,
            )
        )
        if site is None:
            raise ApiError(404, "NOT_FOUND", "현장 정보를 찾을 수 없습니다.")
        site_id = site.id

    if site_id is None:
        raise ApiError(404, "NOT_FOUND", "배정된 현장 정보가 없습니다.")

    now = datetime.now(UTC)
    session = WorkSession(
        worker_id=current_user.id,
        site_id=site_id,
        status=WorkSessionStatus.IN_PROGRESS,
        work_type="GENERAL",
        work_intensity=profile.work_intensity.value,
        clothing_level=ppe_worn_to_clothing_level(profile.ppe_worn),
        environment="OUTDOOR",
        started_at=now,
    )
    db.add(session)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError(409, "CONFLICT", "이미 진행 중인 작업이 있습니다.") from exc
    db.refresh(session)

    db.add(Notification(
        user_id=current_user.id,
        type=NotificationType.WORK_STARTED,
        title="작업 시작",
        message="작업이 시작되었습니다. 안전하게 작업하세요.",
        risk_level=None,
    ))
    db.commit()

    return StartWorkSessionResponse(
        id=session.display_id,
        started_at=session.started_at,
        max_continuous_work_minutes=MAX_CONTINUOUS_WORK_MINUTES,
    )


@router.get("/work-sessions/current", response_model=None)
def current_work_session(
    current_user: Annotated[User, Depends(require_worker)],
    db: Annotated[Session, Depends(get_db)],
) -> CurrentWorkSessionResponse | Response:
    session = _get_active_work_session(db, current_user)
    if session is None:
        return Response(status_code=204)

    elapsed = int((datetime.now(UTC) - session.started_at).total_seconds())
    return CurrentWorkSessionResponse(
        id=session.display_id,
        started_at=session.started_at,
        elapsed_seconds=max(0, elapsed),
        max_continuous_work_minutes=MAX_CONTINUOUS_WORK_MINUTES,
    )


@router.post("/work-sessions/{session_display_id}/end", response_model=EndWorkSessionResponse)
def end_work_session(
    session_display_id: int,
    current_user: Annotated[User, Depends(require_worker)],
    db: Annotated[Session, Depends(get_db)],
) -> EndWorkSessionResponse:
    session = db.scalar(
        select(WorkSession).where(
            WorkSession.display_id == session_display_id,
            WorkSession.worker_id == current_user.id,
        )
    )
    if session is None:
        raise ApiError(404, "NOT_FOUND", "작업 세션을 찾을 수 없습니다.")
    if session.status != WorkSessionStatus.IN_PROGRESS:
        raise ApiError(409, "CONFLICT", "이미 종료된 작업입니다.")

    now = datetime.now(UTC)
    session.status = WorkSessionStatus.COMPLETED
    session.ended_at = now
    db.commit()

    assessments = db.scalars(
        select(HeatRiskAssessment).where(HeatRiskAssessment.work_session_id == session.id)
    ).all()
    avg_apparent = None
    max_core = None
    max_risk = None
    if assessments:
        avg_apparent = sum(float(a.input_snapshot["feels_like_temp"]) for a in assessments) / len(
            assessments
        )
        max_core = max(float(a.predicted_core_temperature) for a in assessments)
        risk_order = {"LOW": 0, "CAUTION": 1, "HIGH": 2}
        max_risk_enum = max(assessments, key=lambda a: risk_order[a.risk_level.value]).risk_level
        max_risk = max_risk_enum.value if max_risk_enum.value != "LOW" else "NORMAL"

    duration_minutes = int((now - session.started_at).total_seconds() // 60)
    return EndWorkSessionResponse(
        id=session.display_id,
        ended_at=now,
        duration_minutes=duration_minutes,
        average_apparent_temp_c=round(avg_apparent, 2) if avg_apparent is not None else None,
        max_estimated_core_temp_c=max_core,
        max_risk_level=max_risk,
    )


# ------------------------------------------------------------------
# Rest sessions
# ------------------------------------------------------------------
@router.post("/rest-sessions", response_model=StartRestSessionResponse, status_code=201)
def start_rest_session(
    request: StartRestSessionRequest,
    current_user: Annotated[User, Depends(require_worker)],
    db: Annotated[Session, Depends(get_db)],
) -> StartRestSessionResponse:
    work_session = None
    if request.work_session_id is not None:
        work_session = db.scalar(
            select(WorkSession).where(
                WorkSession.display_id == request.work_session_id,
                WorkSession.worker_id == current_user.id,
                WorkSession.status == WorkSessionStatus.IN_PROGRESS,
            )
        )
        if work_session is None:
            raise ApiError(404, "NOT_FOUND", "진행 중인 작업 세션을 찾을 수 없습니다.")

    now = datetime.now(UTC)
    rest = RestRecord(
        worker_id=current_user.id,
        work_session_id=work_session.id if work_session else None,
        reason=request.reason,
        target_minutes=REST_TARGET_MINUTES,
        resume_work_after_rest=work_session is not None,
        started_at=now,
    )
    db.add(rest)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError(409, "CONFLICT", "이미 진행 중인 휴식이 있습니다.") from exc
    db.refresh(rest)

    return StartRestSessionResponse(
        id=rest.display_id,
        started_at=rest.started_at,
        target_minutes=rest.target_minutes,
        resume_work_after_rest=rest.resume_work_after_rest,
    )


@router.get("/rest-sessions/current", response_model=None)
def current_rest_session(
    current_user: Annotated[User, Depends(require_worker)],
    db: Annotated[Session, Depends(get_db)],
) -> CurrentRestSessionResponse | Response:
    rest = _get_active_rest_record(db, current_user)
    if rest is None:
        return Response(status_code=204)

    elapsed = int((datetime.now(UTC) - rest.started_at).total_seconds())
    remaining = max(0, rest.target_minutes * 60 - elapsed)
    return CurrentRestSessionResponse(
        id=rest.display_id,
        started_at=rest.started_at,
        elapsed_seconds=max(0, elapsed),
        remaining_seconds=remaining,
        target_minutes=rest.target_minutes,
        resume_work_after_rest=rest.resume_work_after_rest,
    )


@router.post("/rest-sessions/{rest_display_id}/end", response_model=EndRestSessionResponse)
def end_rest_session(
    rest_display_id: int,
    current_user: Annotated[User, Depends(require_worker)],
    db: Annotated[Session, Depends(get_db)],
) -> EndRestSessionResponse:
    rest = db.scalar(
        select(RestRecord).where(
            RestRecord.display_id == rest_display_id,
            RestRecord.worker_id == current_user.id,
        )
    )
    if rest is None:
        raise ApiError(404, "NOT_FOUND", "휴식 기록을 찾을 수 없습니다.")
    if rest.ended_at is not None:
        raise ApiError(409, "CONFLICT", "이미 종료된 휴식입니다.")

    now = datetime.now(UTC)
    rest.ended_at = now
    db.commit()

    duration_minutes = int((now - rest.started_at).total_seconds() // 60)
    return EndRestSessionResponse(
        id=rest.display_id,
        ended_at=now,
        duration_minutes=duration_minutes,
        resume_work=rest.resume_work_after_rest,
    )


# ------------------------------------------------------------------
# Records
# ------------------------------------------------------------------
def _session_stats(db: Session, session_id) -> tuple[float | None, float | None, str | None]:
    assessments = db.scalars(
        select(HeatRiskAssessment).where(HeatRiskAssessment.work_session_id == session_id)
    ).all()
    if not assessments:
        return None, None, None
    avg_apparent = sum(float(a.input_snapshot["feels_like_temp"]) for a in assessments) / len(
        assessments
    )
    max_core = max(float(a.predicted_core_temperature) for a in assessments)
    risk_order = {"LOW": 0, "CAUTION": 1, "HIGH": 2}
    max_risk_enum = max(assessments, key=lambda a: risk_order[a.risk_level.value]).risk_level
    max_risk = max_risk_enum.value if max_risk_enum.value != "LOW" else "NORMAL"
    return round(avg_apparent, 2), max_core, max_risk


@router.get("/records", response_model=RecordsResponse)
def worker_records(
    current_user: Annotated[User, Depends(require_worker)],
    db: Annotated[Session, Depends(get_db)],
    type: str = Query(default="all", pattern="^(work|rest|all)$"),
    date: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> RecordsResponse:
    items: list[RecordItem] = []

    if type in ("work", "all"):
        sessions = db.scalars(
            select(WorkSession).where(
                WorkSession.worker_id == current_user.id,
                WorkSession.status == WorkSessionStatus.COMPLETED,
            )
        ).all()
        for s in sessions:
            if date and s.started_at.date().isoformat() != date:
                continue
            avg_apparent, max_core, risk = _session_stats(db, s.id)
            duration = int(((s.ended_at or s.started_at) - s.started_at).total_seconds() // 60)
            items.append(RecordItem(
                id=s.display_id,
                type="WORK",
                started_at=s.started_at,
                ended_at=s.ended_at,
                duration_minutes=duration,
                average_apparent_temp_c=avg_apparent,
                max_estimated_core_temp_c=max_core,
                risk_level=risk,
            ))

    if type in ("rest", "all"):
        rests = db.scalars(
            select(RestRecord).where(
                RestRecord.worker_id == current_user.id, RestRecord.ended_at.isnot(None)
            )
        ).all()
        for r in rests:
            if date and r.started_at.date().isoformat() != date:
                continue
            avg_apparent, max_core, risk = (None, None, None)
            if r.work_session_id is not None:
                avg_apparent, max_core, risk = _session_stats(db, r.work_session_id)
            duration = int((r.ended_at - r.started_at).total_seconds() // 60)
            items.append(RecordItem(
                id=r.display_id,
                type="REST",
                started_at=r.started_at,
                ended_at=r.ended_at,
                duration_minutes=duration,
                average_apparent_temp_c=avg_apparent,
                max_estimated_core_temp_c=max_core,
                risk_level=risk,
            ))

    items.sort(key=lambda i: i.started_at, reverse=True)
    total = len(items)
    start = (page - 1) * size
    page_items = items[start : start + size]

    return RecordsResponse(items=page_items, total=total, page=page, size=size)


@router.get("/records/summary", response_model=RecordsSummaryResponse)
def worker_records_summary(
    current_user: Annotated[User, Depends(require_worker)],
    db: Annotated[Session, Depends(get_db)],
    date: str = Query(...),
) -> RecordsSummaryResponse:
    day = datetime.strptime(date, "%Y-%m-%d").date()

    sessions = [
        s
        for s in db.scalars(
            select(WorkSession).where(
                WorkSession.worker_id == current_user.id,
                WorkSession.status == WorkSessionStatus.COMPLETED,
            )
        ).all()
        if s.started_at.date() == day
    ]
    rests = [
        r
        for r in db.scalars(
            select(RestRecord).where(
                RestRecord.worker_id == current_user.id, RestRecord.ended_at.isnot(None)
            )
        ).all()
        if r.started_at.date() == day
    ]

    total_work_minutes = sum(
        int(((s.ended_at or s.started_at) - s.started_at).total_seconds() // 60) for s in sessions
    )
    total_rest_minutes = sum(
        int((r.ended_at - r.started_at).total_seconds() // 60) for r in rests
    )

    apparent_values: list[float] = []
    core_values: list[float] = []
    risk_values: list[str] = []
    for s in sessions:
        avg_apparent, max_core, risk = _session_stats(db, s.id)
        if avg_apparent is not None:
            apparent_values.append(avg_apparent)
        if max_core is not None:
            core_values.append(max_core)
        if risk is not None:
            risk_values.append(risk)

    risk_order = {"NORMAL": 0, "CAUTION": 1, "HIGH": 2}
    max_risk = max(risk_values, key=lambda r: risk_order.get(r, 0)) if risk_values else None

    return RecordsSummaryResponse(
        work_count=len(sessions),
        total_work_minutes=total_work_minutes,
        total_rest_minutes=total_rest_minutes,
        average_apparent_temp_c=(
            round(sum(apparent_values) / len(apparent_values), 2) if apparent_values else None
        ),
        max_estimated_core_temp_c=max(core_values) if core_values else None,
        max_risk_level=max_risk,
        message="오늘도 권장 휴식을 지키며 안전하게 작업하고 있어요.",
    )


# ------------------------------------------------------------------
# Notifications
# ------------------------------------------------------------------
@router.get("/notifications", response_model=NotificationsResponse)
def worker_notifications(
    current_user: Annotated[User, Depends(require_worker)],
    db: Annotated[Session, Depends(get_db)],
) -> NotificationsResponse:
    notifications = db.scalars(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    ).all()

    items = [
        NotificationItem(
            id=n.display_id,
            type=n.type,
            title=n.title,
            message=n.message,
            risk_level=n.risk_level,
            created_at=n.created_at,
            read=n.is_read,
        )
        for n in notifications
    ]
    unread_count = sum(1 for n in notifications if not n.is_read)
    return NotificationsResponse(items=items, unread_count=unread_count)


@router.patch("/notifications/{notification_display_id}/read", response_model=MarkNotificationReadResponse)
def mark_notification_read(
    notification_display_id: int,
    current_user: Annotated[User, Depends(require_worker)],
    db: Annotated[Session, Depends(get_db)],
) -> MarkNotificationReadResponse:
    notification = db.scalar(
        select(Notification).where(
            Notification.display_id == notification_display_id,
            Notification.user_id == current_user.id,
        )
    )
    if notification is None:
        raise ApiError(404, "NOT_FOUND", "알림을 찾을 수 없습니다.")

    notification.is_read = True
    db.commit()
    return MarkNotificationReadResponse(id=notification.display_id, read=True)


@router.post("/notifications/{notification_display_id}/snooze", response_model=SnoozeNotificationResponse)
def snooze_notification(
    notification_display_id: int,
    request: SnoozeNotificationRequest,
    current_user: Annotated[User, Depends(require_worker)],
    db: Annotated[Session, Depends(get_db)],
) -> SnoozeNotificationResponse:
    notification = db.scalar(
        select(Notification).where(
            Notification.display_id == notification_display_id,
            Notification.user_id == current_user.id,
        )
    )
    if notification is None:
        raise ApiError(404, "NOT_FOUND", "알림을 찾을 수 없습니다.")

    snoozed_until = datetime.now(UTC) + timedelta(minutes=request.minutes)
    notification.snoozed_until = snoozed_until
    db.commit()

    return SnoozeNotificationResponse(
        notification_id=notification.display_id, snoozed_until=snoozed_until
    )


@router.get("/notification-settings", response_model=NotificationSettingsResponse)
def get_notification_settings(
    current_user: Annotated[User, Depends(require_worker)],
) -> NotificationSettingsResponse:
    profile = current_user.worker_profile
    return NotificationSettingsResponse(enabled=profile.notifications_enabled if profile else True)


@router.patch("/notification-settings", response_model=NotificationSettingsResponse)
def update_notification_settings(
    request: UpdateNotificationSettingsRequest,
    current_user: Annotated[User, Depends(require_worker)],
    db: Annotated[Session, Depends(get_db)],
) -> NotificationSettingsResponse:
    profile = current_user.worker_profile
    if profile is None:
        raise ApiError(404, "NOT_FOUND", "작업자 프로필 정보가 없습니다.")

    profile.notifications_enabled = request.enabled
    db.commit()
    return NotificationSettingsResponse(enabled=profile.notifications_enabled)
