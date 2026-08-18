"""
safety_service.py
------------------
"이 작업자 지금 안전한가?"를 실시간으로 계산하는 공용 로직.
Worker(/worker/home, /worker/safety/current)와 Admin(/admin/dashboard,
/admin/workers)이 동일한 계산을 각자 다시 짜지 않도록 여기 한 곳에 모아둔다.

DB에 저장하지 않는 read-only 계산이다. 실제 이력 저장은 5분 주기
risk_scheduler가 따로 담당한다.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.app.core.errors import ApiError
from backend.app.models import RestRecord, User, WorkSession
from backend.app.models.enums import WorkSessionStatus
from backend.app.services.heat_features import (
    compute_overall_risk_level,
    ppe_worn_to_clothing_level,
)
from backend.app.services.risk_service import assess_worker_risk

# 명세서 v1.2 섹션 22 기본값. 위험 임계값은 하드코딩 유지하기로 결정됨 (Admin이 못 바꿈).
MAX_CONTINUOUS_WORK_MINUTES = 120
REST_TARGET_MINUTES = 20


def get_active_work_session(db: Session, user: User) -> WorkSession | None:
    return db.scalar(
        select(WorkSession)
        .options(selectinload(WorkSession.rest_records), selectinload(WorkSession.site))
        .where(
            WorkSession.worker_id == user.id,
            WorkSession.status == WorkSessionStatus.IN_PROGRESS,
        )
    )


def get_active_rest_record(db: Session, user: User) -> RestRecord | None:
    return db.scalar(
        select(RestRecord).where(
            RestRecord.worker_id == user.id, RestRecord.ended_at.is_(None)
        )
    )


def compute_live_safety(user: User, session: WorkSession | None) -> dict | None:
    """
    반환값이 None이면 "계산 불가"(프로필/현장 정보 없음) — 목록 조회(예: 관리자 대시보드)에서는
    이런 작업자를 조용히 건너뛰어야 하므로 예외 대신 None을 쓴다. 단일 조회(worker 본인 화면)에서는
    호출부가 None을 ApiError로 변환한다.
    """
    profile = user.worker_profile
    if profile is None:
        return None

    site = session.site if session is not None else profile.assigned_site
    if site is None or site.latitude is None or site.longitude is None:
        return None

    if session is not None:
        work_session_input = {
            "started_at": session.started_at,
            "clothing_level": session.clothing_level,
            "work_intensity": session.work_intensity,
            "rest_records": [{"ended_at": r.ended_at} for r in session.rest_records],
        }
    else:
        now = datetime.now(UTC)
        work_session_input = {
            "started_at": now,
            "clothing_level": ppe_worn_to_clothing_level(profile.ppe_worn),
            "work_intensity": profile.work_intensity.value,
            "rest_records": [],
        }

    result = assess_worker_risk(
        worker={"age": profile.age},
        site={"lat": float(site.latitude), "lon": float(site.longitude)},
        work_session=work_session_input,
    )
    # result["risk_level"]은 원래 심부체온만 본 3단계(coreTempLevel)다.
    # riskLevel(전체 위험도)은 여기에 연속작업시간까지 더해서 별도로 계산한다 —
    # 둘 다 최종 3단계지만, 연속작업시간 때문에 coreTempLevel보다 riskLevel이
    # 더 높게 나올 수 있어 값을 분리해서 보관한다.
    result["core_temp_level"] = result["risk_level"]
    result["risk_level"] = compute_overall_risk_level(
        result["core_temp_level"],
        result["inputs"]["continuous_work_min"],
        result["inputs"]["feels_like_temp"],
    )
    return result


def compute_live_safety_or_raise(db: Session, user: User, session: WorkSession | None) -> dict:
    result = compute_live_safety(user, session)
    if result is None:
        raise ApiError(404, "NOT_FOUND", "작업자 프로필 또는 현장 정보가 없습니다.")
    return result
