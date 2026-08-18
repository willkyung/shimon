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
from backend.app.models import RestRecord, User, WorkSession
from backend.app.models.enums import RestType, UserRole, WorkSessionStatus
from backend.app.schemas.rest import (
    EndRestData,
    EndRestResponse,
    StartRestData,
    StartRestResponse,
)


router = APIRouter(tags=["rests"])
worker_dependency = require_role(UserRole.WORKER)


@router.post(
    "/work-sessions/{work_session_id}/rests/start",
    response_model=StartRestResponse,
    status_code=201,
)
def start_rest(
    work_session_id: UUID,
    current_user: Annotated[User, Depends(worker_dependency)],
    db: Annotated[Session, Depends(get_db)],
) -> StartRestResponse:
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
    if db.scalar(
        select(RestRecord.id).where(
            RestRecord.work_session_id == session.id,
            RestRecord.ended_at.is_(None),
        )
    ):
        raise ApiError(
            409, "ACTIVE_REST_ALREADY_EXISTS", "An active rest already exists."
        )

    rest = RestRecord(
        work_session_id=session.id,
        rest_type=RestType.SELF_INITIATED,
        started_at=datetime.now(UTC),
    )
    db.add(rest)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError(
            409, "ACTIVE_REST_ALREADY_EXISTS", "An active rest already exists."
        ) from exc
    db.refresh(rest)
    return StartRestResponse(
        data=StartRestData(
            rest_id=rest.id,
            work_session_id=session.id,
            rest_type=rest.rest_type,
            started_at=rest.started_at,
        )
    )


@router.post("/rests/{rest_id}/end", response_model=EndRestResponse)
def end_rest(
    rest_id: UUID,
    current_user: Annotated[User, Depends(worker_dependency)],
    db: Annotated[Session, Depends(get_db)],
) -> EndRestResponse:
    rest = db.scalar(
        select(RestRecord)
        .join(WorkSession)
        .where(
            RestRecord.id == rest_id,
            WorkSession.worker_id == current_user.id,
        )
        .with_for_update()
    )
    if rest is None:
        raise ApiError(404, "REST_NOT_FOUND", "Rest record was not found.")
    if rest.ended_at is not None:
        raise ApiError(409, "ACTIVE_REST_NOT_FOUND", "Rest record is not active.")

    session = db.scalar(
        select(WorkSession)
        .where(WorkSession.id == rest.work_session_id)
        .with_for_update()
    )
    if session is None or session.status != WorkSessionStatus.IN_PROGRESS:
        raise ApiError(
            409, "ACTIVE_WORK_SESSION_NOT_FOUND", "Parent work session is not active."
        )

    rest.ended_at = datetime.now(UTC)
    started_at = (
        rest.started_at.replace(tzinfo=UTC)
        if rest.started_at.tzinfo is None
        else rest.started_at
    )
    duration_minutes = max(
        0, int((rest.ended_at - started_at).total_seconds() // 60)
    )
    db.commit()
    return EndRestResponse(
        data=EndRestData(
            rest_id=rest.id,
            ended_at=rest.ended_at,
            duration_minutes=duration_minutes,
        )
    )
