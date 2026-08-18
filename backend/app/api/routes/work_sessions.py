from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.api.dependencies import require_role
from backend.app.core.database import get_db
from backend.app.core.errors import ApiError
from backend.app.models import RestRecord, User, WorkSession, WorkSite
from backend.app.models.enums import UserRole, WorkSessionStatus
from backend.app.schemas.work_session import (
    CurrentWorkSessionData,
    CurrentWorkSessionResponse,
    EndWorkSessionData,
    EndWorkSessionResponse,
    StartWorkSessionData,
    StartWorkSessionRequest,
    StartWorkSessionResponse,
)


router = APIRouter(tags=["work sessions"])
worker_dependency = require_role(UserRole.WORKER)


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def _active_rest(db: Session, work_session_id: UUID) -> RestRecord | None:
    return db.scalar(
        select(RestRecord).where(
            RestRecord.work_session_id == work_session_id,
            RestRecord.ended_at.is_(None),
        )
    )


def _continuous_work_minutes(
    db: Session, session: WorkSession, active_rest: RestRecord | None
) -> int:
    latest_rest_end = db.scalar(
        select(RestRecord.ended_at)
        .where(
            RestRecord.work_session_id == session.id,
            RestRecord.ended_at.is_not(None),
        )
        .order_by(RestRecord.ended_at.desc())
        .limit(1)
    )
    start = _utc(latest_rest_end or session.started_at)
    end = _utc(active_rest.started_at) if active_rest else datetime.now(UTC)
    return max(0, int((end - start).total_seconds() // 60))


@router.post(
    "/work-sessions", response_model=StartWorkSessionResponse, status_code=201
)
def start_work_session(
    request: StartWorkSessionRequest,
    current_user: Annotated[User, Depends(worker_dependency)],
    db: Annotated[Session, Depends(get_db)],
) -> StartWorkSessionResponse:
    # Serialize work-start attempts for this worker; the partial unique index is
    # still the final protection when requests race.
    db.scalar(select(User.id).where(User.id == current_user.id).with_for_update())
    site = db.scalar(
        select(WorkSite).where(
            WorkSite.id == request.site_id,
            WorkSite.company_id == current_user.company_id,
            WorkSite.is_active.is_(True),
        )
    )
    profile = current_user.worker_profile
    if site is None or profile is None or profile.assigned_site_id != site.id:
        raise ApiError(404, "SITE_NOT_FOUND", "Site was not found.")

    active_id = db.scalar(
        select(WorkSession.id).where(
            WorkSession.worker_id == current_user.id,
            WorkSession.status == WorkSessionStatus.IN_PROGRESS,
        )
    )
    if active_id is not None:
        raise ApiError(
            409, "ACTIVE_WORK_SESSION_EXISTS", "An active work session already exists."
        )

    now = datetime.now(UTC)
    session = WorkSession(
        worker_id=current_user.id,
        site_id=site.id,
        status=WorkSessionStatus.IN_PROGRESS,
        work_type=request.work_type,
        work_intensity=request.work_intensity,
        clothing_level=request.clothing_level,
        environment=request.environment,
        started_at=now,
    )
    db.add(session)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError(
            409, "ACTIVE_WORK_SESSION_EXISTS", "An active work session already exists."
        ) from exc
    db.refresh(session)
    return StartWorkSessionResponse(
        data=StartWorkSessionData(
            work_session_id=session.id,
            status=session.status,
            started_at=session.started_at,
        )
    )


@router.get(
    "/me/work-session/current", response_model=CurrentWorkSessionResponse
)
def current_work_session(
    current_user: Annotated[User, Depends(worker_dependency)],
    db: Annotated[Session, Depends(get_db)],
) -> CurrentWorkSessionResponse:
    session = db.scalar(
        select(WorkSession).where(
            WorkSession.worker_id == current_user.id,
            WorkSession.status == WorkSessionStatus.IN_PROGRESS,
        )
    )
    if session is None:
        return CurrentWorkSessionResponse(data=None)

    active_rest = _active_rest(db, session.id)
    return CurrentWorkSessionResponse(
        data=CurrentWorkSessionData(
            id=session.id,
            site_id=session.site_id,
            work_type=session.work_type,
            work_intensity=session.work_intensity,
            clothing_level=session.clothing_level,
            environment=session.environment,
            status=session.status,
            started_at=session.started_at,
            continuous_work_minutes=_continuous_work_minutes(
                db, session, active_rest
            ),
            worker_state="RESTING" if active_rest else "WORKING",
        )
    )


@router.post(
    "/work-sessions/{work_session_id}/end",
    response_model=EndWorkSessionResponse,
)
def end_work_session(
    work_session_id: UUID,
    current_user: Annotated[User, Depends(worker_dependency)],
    db: Annotated[Session, Depends(get_db)],
) -> EndWorkSessionResponse:
    session = db.scalar(
        select(WorkSession)
        .where(
            WorkSession.id == work_session_id,
            WorkSession.worker_id == current_user.id,
        )
        .with_for_update()
    )
    if session is None:
        raise ApiError(404, "WORK_SESSION_NOT_FOUND", "Work session was not found.")
    if session.status != WorkSessionStatus.IN_PROGRESS:
        raise ApiError(
            409, "ACTIVE_WORK_SESSION_NOT_FOUND", "Work session is not active."
        )
    if _active_rest(db, session.id) is not None:
        raise ApiError(
            409,
            "ACTIVE_REST_ALREADY_EXISTS",
            "End the active rest before ending the work session.",
        )

    session.ended_at = datetime.now(UTC)
    session.status = WorkSessionStatus.COMPLETED
    db.commit()
    return EndWorkSessionResponse(
        data=EndWorkSessionData(
            work_session_id=session.id,
            status=session.status,
            ended_at=session.ended_at,
        )
    )
