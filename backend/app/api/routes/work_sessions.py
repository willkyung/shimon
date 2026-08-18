from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from backend.app.api.dependencies import require_role
from backend.app.core.database import get_db
from backend.app.core.errors import ApiError
from backend.app.models import (
    ComplianceCheck,
    HeatRiskAssessment,
    RestRecord,
    SiteWeatherLog,
    User,
    WorkSession,
)
from backend.app.models.enums import RestReason, UserRole, WorkSessionStatus
from backend.app.schemas.work import (
    ActiveRestData,
    CurrentWorkSessionResponse,
    EvaluationResponse,
    RestData,
    RestEndData,
    RestEndResponse,
    RestHistoryItemData,
    RestHistoryResponse,
    RestStartResponse,
    RecordEvaluationData,
    StartWorkSessionRequest,
    WorkEndData,
    WorkEndResponse,
    WorkHistoryItemData,
    WorkHistoryResponse,
    WorkSessionData,
    WorkSessionResponse,
)
from backend.app.services.work_flow import (
    continuous_work_minutes,
    continuous_work_started_at,
    evaluate_work_session,
    latest_evaluation,
    latest_rest_type,
)


router = APIRouter(tags=["work sessions"])
worker_only = require_role(UserRole.WORKER)


def _owned_session(db: Session, session_id: UUID, user_id: UUID) -> WorkSession:
    work_session = db.scalar(
        select(WorkSession)
        .options(selectinload(WorkSession.site))
        .where(WorkSession.id == session_id, WorkSession.worker_id == user_id)
    )
    if work_session is None:
        raise ApiError(404, "ACTIVE_WORK_SESSION_NOT_FOUND", "Work session was not found.")
    return work_session


def _session_data(db: Session, work_session: WorkSession) -> WorkSessionData:
    active_rest = db.scalar(
        select(RestRecord).where(
            RestRecord.work_session_id == work_session.id,
            RestRecord.ended_at.is_(None),
        )
    )
    latest = latest_evaluation(db, work_session.id)
    required_rest_minutes = (
        latest.compliance.required_rest_minutes
        if latest and latest.compliance.required_rest_minutes
        else 20
    )
    return WorkSessionData(
        id=work_session.id,
        status=work_session.status,
        started_at=work_session.started_at,
        continuous_work_started_at=continuous_work_started_at(db, work_session),
        continuous_work_minutes=continuous_work_minutes(db, work_session),
        worker_state="RESTING" if active_rest is not None else "WORKING",
        active_rest=(
            ActiveRestData(
                rest_id=active_rest.id,
                rest_type=active_rest.reason,
                started_at=active_rest.started_at,
                required_rest_minutes=required_rest_minutes,
            )
            if active_rest is not None
            else None
        ),
        latest_evaluation=latest,
    )


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _duration_minutes(started_at: datetime, ended_at: datetime | None) -> int:
    end = _aware(ended_at) if ended_at is not None else datetime.now(UTC)
    return max(0, int((end - _aware(started_at)).total_seconds() // 60))


def _record_evaluation(
    db: Session,
    work_session_id: UUID,
    *,
    evaluated_before: datetime | None = None,
) -> RecordEvaluationData | None:
    check_query = (
        select(ComplianceCheck, SiteWeatherLog)
        .join(SiteWeatherLog, ComplianceCheck.weather_log_id == SiteWeatherLog.id)
        .where(ComplianceCheck.work_session_id == work_session_id)
    )
    ai_query = select(HeatRiskAssessment).where(
        HeatRiskAssessment.work_session_id == work_session_id
    )
    if evaluated_before is not None:
        check_query = check_query.where(ComplianceCheck.evaluated_at <= evaluated_before)
        ai_query = ai_query.where(HeatRiskAssessment.evaluated_at <= evaluated_before)

    check_row = db.execute(
        check_query.order_by(desc(ComplianceCheck.evaluated_at)).limit(1)
    ).first()
    if check_row is None:
        return None
    check, weather = check_row
    ai = db.scalar(ai_query.order_by(desc(HeatRiskAssessment.evaluated_at)).limit(1))
    return RecordEvaluationData(
        evaluated_at=check.evaluated_at,
        feels_like_temperature=float(weather.feels_like_temperature),
        compliance_status=check.status,
        is_rest_required=check.is_rest_required,
        ai_risk_level=ai.risk_level if ai is not None else None,
        predicted_core_temperature=(
            float(ai.predicted_core_temperature) if ai is not None else None
        ),
    )


def _work_duration_minutes(db: Session, work_session: WorkSession) -> int:
    total = _duration_minutes(work_session.started_at, work_session.ended_at)
    rests = db.scalars(
        select(RestRecord).where(RestRecord.work_session_id == work_session.id)
    ).all()
    rest_minutes = sum(
        _duration_minutes(rest.started_at, rest.ended_at) for rest in rests
    )
    return max(0, total - rest_minutes)


@router.get("/me/work-sessions", response_model=WorkHistoryResponse)
def work_history(
    current_user: Annotated[User, Depends(worker_only)],
    db: Annotated[Session, Depends(get_db)],
) -> WorkHistoryResponse:
    sessions = db.scalars(
        select(WorkSession)
        .where(WorkSession.worker_id == current_user.id)
        .order_by(desc(WorkSession.started_at))
    ).all()
    return WorkHistoryResponse(data=[
        WorkHistoryItemData(
            id=session.id,
            status=session.status,
            started_at=session.started_at,
            ended_at=session.ended_at,
            duration_minutes=_work_duration_minutes(db, session),
            work_type=session.work_type,
            work_intensity=session.work_intensity,
            evaluation=_record_evaluation(db, session.id),
        )
        for session in sessions
    ])


@router.get("/me/rest-records", response_model=RestHistoryResponse)
def rest_history(
    current_user: Annotated[User, Depends(worker_only)],
    db: Annotated[Session, Depends(get_db)],
) -> RestHistoryResponse:
    records = db.scalars(
        select(RestRecord)
        .join(WorkSession)
        .where(WorkSession.worker_id == current_user.id)
        .order_by(desc(RestRecord.started_at))
    ).all()
    return RestHistoryResponse(data=[
        RestHistoryItemData(
            id=record.id,
            work_session_id=record.work_session_id,
            rest_type=record.reason,
            started_at=record.started_at,
            ended_at=record.ended_at,
            duration_minutes=_duration_minutes(record.started_at, record.ended_at),
            evaluation=_record_evaluation(
                db,
                record.work_session_id,
                evaluated_before=record.started_at,
            ),
        )
        for record in records
    ])


@router.post("/work-sessions", response_model=WorkSessionResponse, status_code=201)
def start_work_session(
    request: StartWorkSessionRequest,
    current_user: Annotated[User, Depends(worker_only)],
    db: Annotated[Session, Depends(get_db)],
) -> WorkSessionResponse:
    profile = current_user.worker_profile
    if profile is None or profile.assigned_site_id is None:
        raise ApiError(422, "SITE_NOT_FOUND", "Worker has no assigned site.")
    if request.site_id != profile.assigned_site_id:
        raise ApiError(403, "FORBIDDEN", "Worker may only start at the assigned site.")
    existing = db.scalar(
        select(WorkSession.id).where(
            WorkSession.worker_id == current_user.id,
            WorkSession.status == WorkSessionStatus.IN_PROGRESS,
        )
    )
    if existing is not None:
        raise ApiError(409, "ACTIVE_WORK_SESSION_EXISTS", "An active work session already exists.")
    active_rest = db.scalar(
        select(RestRecord.id)
        .join(WorkSession)
        .where(
            WorkSession.worker_id == current_user.id,
            RestRecord.ended_at.is_(None),
        )
    )
    if active_rest is not None:
        raise ApiError(409, "ACTIVE_REST_ALREADY_EXISTS", "End the active rest before starting work.")

    work_session = WorkSession(
        worker_id=current_user.id,
        site_id=profile.assigned_site_id,
        status=WorkSessionStatus.IN_PROGRESS,
        work_type=profile.job_type or request.work_type,
        work_intensity=profile.work_intensity.value if profile.work_intensity else request.work_intensity,
        clothing_level=request.clothing_level,
        environment=request.environment,
        started_at=datetime.now(UTC),
    )
    db.add(work_session)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError(409, "ACTIVE_WORK_SESSION_EXISTS", "An active work session already exists.") from exc
    db.refresh(work_session)
    work_session.site = profile.assigned_site
    evaluation = evaluate_work_session(db, work_session)
    data = _session_data(db, work_session)
    data.latest_evaluation = evaluation
    return WorkSessionResponse(data=data)


@router.get("/me/work-session/current", response_model=CurrentWorkSessionResponse)
def current_work_session(
    current_user: Annotated[User, Depends(worker_only)],
    db: Annotated[Session, Depends(get_db)],
) -> CurrentWorkSessionResponse:
    work_session = db.scalar(
        select(WorkSession)
        .options(selectinload(WorkSession.site))
        .where(
            WorkSession.worker_id == current_user.id,
            WorkSession.status == WorkSessionStatus.IN_PROGRESS,
        )
        .limit(1)
    )
    if work_session is None:
        active_rest = db.scalar(
            select(RestRecord)
            .join(WorkSession)
            .options(
                selectinload(RestRecord.work_session).selectinload(WorkSession.site)
            )
            .where(
                WorkSession.worker_id == current_user.id,
                RestRecord.ended_at.is_(None),
            )
            .order_by(desc(RestRecord.started_at))
            .limit(1)
        )
        if active_rest is not None:
            work_session = active_rest.work_session
    return CurrentWorkSessionResponse(
        data=_session_data(db, work_session) if work_session is not None else None
    )


@router.post("/work-sessions/{session_id}/evaluate", response_model=EvaluationResponse)
def evaluate(
    session_id: UUID,
    current_user: Annotated[User, Depends(worker_only)],
    db: Annotated[Session, Depends(get_db)],
) -> EvaluationResponse:
    work_session = _owned_session(db, session_id, current_user.id)
    return EvaluationResponse(data=evaluate_work_session(db, work_session))


@router.post("/work-sessions/{session_id}/rests/start", response_model=RestStartResponse, status_code=201)
def start_rest(
    session_id: UUID,
    current_user: Annotated[User, Depends(worker_only)],
    db: Annotated[Session, Depends(get_db)],
) -> RestStartResponse:
    work_session = _owned_session(db, session_id, current_user.id)
    if work_session.status != WorkSessionStatus.IN_PROGRESS:
        raise ApiError(409, "ACTIVE_WORK_SESSION_NOT_FOUND", "Work session is not active.")
    active = db.scalar(
        select(RestRecord.id).where(
            RestRecord.work_session_id == session_id, RestRecord.ended_at.is_(None)
        )
    )
    if active is not None:
        raise ApiError(409, "ACTIVE_REST_ALREADY_EXISTS", "An active rest already exists.")
    is_legal, is_ai_high, check = latest_rest_type(db, session_id)
    # RestType(예전 이름) -> RestReason: LEGAL_REQUIRED/AI_RECOMMENDED는 둘 다 "사람이 직접
    # 시작한 게 아니라 시스템이 판단해서 강제/권고한 것"이라 SYSTEM_RECOMMENDED로 합친다.
    reason = RestReason.SYSTEM_RECOMMENDED if (is_legal or is_ai_high) else RestReason.USER_STARTED
    required_minutes = check.required_rest_minutes if check and check.required_rest_minutes else 20
    rest_started_at = datetime.now(UTC)
    work_session.status = WorkSessionStatus.COMPLETED
    work_session.ended_at = rest_started_at
    rest = RestRecord(
        worker_id=work_session.worker_id,
        work_session_id=session_id,
        reason=reason,
        target_minutes=required_minutes,
        started_at=rest_started_at,
    )
    db.add(rest)
    db.commit()
    db.refresh(rest)
    return RestStartResponse(data=RestData(
        rest_id=rest.id,
        work_session_id=session_id,
        rest_type=rest.reason,
        started_at=rest.started_at,
        required_rest_minutes=required_minutes,
    ))


@router.post("/rests/{rest_id}/end", response_model=RestEndResponse)
def end_rest(
    rest_id: UUID,
    current_user: Annotated[User, Depends(worker_only)],
    db: Annotated[Session, Depends(get_db)],
) -> RestEndResponse:
    rest = db.scalar(
        select(RestRecord)
        .join(WorkSession)
        .options(selectinload(RestRecord.work_session).selectinload(WorkSession.site))
        .where(RestRecord.id == rest_id, WorkSession.worker_id == current_user.id)
    )
    if rest is None or rest.ended_at is not None:
        raise ApiError(409, "ACTIVE_REST_NOT_FOUND", "Active rest was not found.")
    previous_session = rest.work_session
    active_session = db.scalar(
        select(WorkSession.id).where(
            WorkSession.worker_id == current_user.id,
            WorkSession.status == WorkSessionStatus.IN_PROGRESS,
        )
    )
    if active_session is not None:
        raise ApiError(409, "ACTIVE_WORK_SESSION_EXISTS", "An active work session already exists.")
    ended_at = datetime.now(UTC)
    started_at = rest.started_at if rest.started_at.tzinfo else rest.started_at.replace(tzinfo=UTC)
    rest.ended_at = ended_at
    next_session = WorkSession(
        worker_id=previous_session.worker_id,
        site_id=previous_session.site_id,
        status=WorkSessionStatus.IN_PROGRESS,
        work_type=previous_session.work_type,
        work_intensity=previous_session.work_intensity,
        clothing_level=previous_session.clothing_level,
        environment=previous_session.environment,
        started_at=ended_at,
    )
    db.add(next_session)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError(409, "ACTIVE_WORK_SESSION_EXISTS", "An active work session already exists.") from exc
    db.refresh(next_session)
    duration = max(0, int((ended_at - started_at).total_seconds() // 60))
    evaluation = evaluate_work_session(db, next_session)
    return RestEndResponse(data=RestEndData(
        rest_id=rest.id,
        work_session_id=next_session.id,
        ended_at=ended_at,
        continuous_work_started_at=ended_at,
        duration_minutes=duration,
        evaluation=evaluation,
    ))


@router.post("/work-sessions/{session_id}/end", response_model=WorkEndResponse)
def end_work_session(
    session_id: UUID,
    current_user: Annotated[User, Depends(worker_only)],
    db: Annotated[Session, Depends(get_db)],
) -> WorkEndResponse:
    work_session = _owned_session(db, session_id, current_user.id)
    if work_session.status != WorkSessionStatus.IN_PROGRESS:
        raise ApiError(409, "ACTIVE_WORK_SESSION_NOT_FOUND", "Work session is not active.")
    active_rest = db.scalar(select(RestRecord.id).where(
        RestRecord.work_session_id == session_id, RestRecord.ended_at.is_(None)
    ))
    if active_rest is not None:
        raise ApiError(409, "ACTIVE_REST_ALREADY_EXISTS", "End the active rest first.")
    ended_at = datetime.now(UTC)
    work_session.status = WorkSessionStatus.COMPLETED
    work_session.ended_at = ended_at
    db.commit()
    return WorkEndResponse(data=WorkEndData(
        work_session_id=work_session.id,
        status=work_session.status,
        ended_at=ended_at,
    ))
