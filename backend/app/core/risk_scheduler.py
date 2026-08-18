"""
risk_scheduler.py
------------------
5분마다 "현재 작업 중인 모든 노동자"의 위험도를 재계산하고,
CAUTION/DANGER로 바뀐 경우에만 알림을 보낸다.

FastAPI 앱의 시작 시점에 백그라운드로 이 루프를 띄운다.
"""

import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.app.core.database import SessionLocal
from backend.app.models.enums import AiRiskLevel, WeatherSource, WorkSessionStatus
from backend.app.models.heat_risk_assessment import HeatRiskAssessment
from backend.app.models.site_weather_log import SiteWeatherLog
from backend.app.models.user import User
from backend.app.models.work_session import WorkSession
from backend.app.services.risk_service import MODEL_NAME, MODEL_VERSION, assess_worker_risk
# from notification_service import send_notification

# heat_features.score_to_risk_level()이 내는 값(SAFE/CAUTION/DANGER)과
# DB의 AiRiskLevel enum(LOW/CAUTION/HIGH)은 이름이 서로 다르므로 매핑이 필요하다.
RISK_LEVEL_TO_AI_RISK_LEVEL = {
    "SAFE": AiRiskLevel.LOW,
    "CAUTION": AiRiskLevel.CAUTION,
    "DANGER": AiRiskLevel.HIGH,
}

logger = logging.getLogger(__name__)

RISK_CHECK_INTERVAL_SECONDS = 5 * 60  # 5분

# session_id -> 마지막으로 계산된 위험 등급. DB에서 매번 새로 조회하는 세션 정보와
# 별개로, 이 프로세스가 떠 있는 동안만 유지되는 메모리 상태다 (재시작하면 초기화됨).
_last_known_risk_level: dict[str, str] = {}


def get_active_work_sessions() -> list[dict]:
    """
    status == IN_PROGRESS인 모든 작업 세션을, assess_worker_risk()가 바로 쓸 수 있는
    형태(worker/site 정보 + rest_records 포함)로 조회해서 반환한다.
    """
    with SessionLocal() as db:
        rows = db.scalars(
            select(WorkSession)
            .where(WorkSession.status == WorkSessionStatus.IN_PROGRESS)
            .options(
                selectinload(WorkSession.worker).selectinload(User.worker_profile),
                selectinload(WorkSession.site),
                selectinload(WorkSession.rest_records),
            )
        ).all()

        sessions = []
        for row in rows:
            worker_profile = row.worker.worker_profile
            if worker_profile is None or row.site.latitude is None or row.site.longitude is None:
                # 나이 정보나 현장 좌표가 없으면 모델을 돌릴 수 없으므로 건너뜀
                logger.warning(f"위험도 평가 건너뜀 (필수 정보 누락): session_id={row.id}")
                continue

            sessions.append({
                "id": str(row.id),
                "worker": {
                    "id": str(row.worker_id),
                    "age": worker_profile.age,
                },
                "site": {
                    "id": str(row.site_id),
                    "lat": float(row.site.latitude),
                    "lon": float(row.site.longitude),
                },
                "started_at": row.started_at,
                "clothing_level": row.clothing_level,
                "work_intensity": row.work_intensity,
                "rest_records": [{"ended_at": r.ended_at} for r in row.rest_records],
            })

        return sessions


async def risk_check_loop():
    while True:
        try:
            await _check_all_active_workers()
        except Exception as e:
            # 한 번의 실패가 전체 루프를 멈추면 안 되므로 로그만 남기고 계속 진행
            logger.error(f"위험도 재평가 중 오류: {e}")

        await asyncio.sleep(RISK_CHECK_INTERVAL_SECONDS)


async def _check_all_active_workers():
    active_sessions = await asyncio.to_thread(get_active_work_sessions)

    for session in active_sessions:
        result = assess_worker_risk(
            worker=session["worker"],
            site=session["site"],
            work_session=session,
        )

        await asyncio.to_thread(_save_risk_assessment, session, result)

        previous_level = _last_known_risk_level.get(session["id"])
        new_level = result["risk_level"]

        # 등급이 실제로 "올라간" 경우에만 알림 (매번 알림 보내면 스팸이 됨)
        if _is_escalation(previous_level, new_level):
            # send_notification(session["worker"], result)
            logger.info(f"[알림 발송] worker={session['worker']['id']} -> {new_level}")

        _last_known_risk_level[session["id"]] = new_level


def _save_risk_assessment(session: dict, result: dict) -> None:
    """
    모델이 계산한 결과를 site_weather_logs + heat_risk_assessments에 저장한다.
    weather_log를 먼저 만들어야 heat_risk_assessment.weather_log_id(FK)를 채울 수 있다.
    """
    weather = result["weather"]

    with SessionLocal.begin() as db:
        weather_log = SiteWeatherLog(
            site_id=session["site"]["id"],
            source=WeatherSource.KMA_API,
            temperature=weather["temp"],
            humidity=weather["humidity"],
            feels_like_temperature=result["inputs"]["feels_like_temp"],
            latitude=session["site"]["lat"],
            longitude=session["site"]["lon"],
            measured_at=result["assessed_at"],
        )
        db.add(weather_log)
        db.flush()  # weather_log.id를 FK로 쓰기 위해 먼저 INSERT

        db.add(HeatRiskAssessment(
            work_session_id=session["id"],
            weather_log_id=weather_log.id,
            predicted_core_temperature=result["predicted_core_temp"],
            risk_level=RISK_LEVEL_TO_AI_RISK_LEVEL[result["risk_level"]],
            input_snapshot=result["inputs"],
            main_factors=[],  # 요청 1건당 SHAP 계산은 아직 없음 (전역 중요도만 model_metadata.json에 존재)
            feature_schema_version="1",
            model_name=MODEL_NAME,
            model_version=MODEL_VERSION,
            evaluated_at=result["assessed_at"],
        ))


def _is_escalation(previous: str | None, current: str) -> bool:
    order = {"SAFE": 0, "CAUTION": 1, "DANGER": 2}
    if previous is None:
        return current != "SAFE"
    return order[current] > order[previous]
