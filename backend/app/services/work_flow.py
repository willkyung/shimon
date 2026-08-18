from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from backend.app.core.errors import ApiError
from backend.app.models import (
    ComplianceCheck,
    ComplianceRule,
    HeatRiskAssessment,
    RestRecord,
    SiteWeatherLog,
    WorkSession,
)
from backend.app.models.enums import AiRiskLevel, ComplianceStatus, WeatherSource
from backend.app.schemas.work import (
    AiEvaluationData,
    ComplianceEvaluationData,
    EvaluationData,
    WeatherEvaluationData,
)
from backend.app.services.compliance import (
    MVP_CONTINUOUS_WORK_MINUTES,
    MVP_FEELS_LIKE_THRESHOLD,
    MVP_REQUIRED_REST_MINUTES,
    MVP_RULE_CODE,
    MVP_RULE_VERSION,
    evaluate_mvp_heat_rest_rule,
    utc_now,
)
from backend.app.services.heat_features import compute_overall_risk_level, normalize_clothing_level
from backend.app.services.risk_service import MODEL_NAME, MODEL_VERSION, assess_worker_risk

# heat_features.score_to_risk_level()이 내는 값(NORMAL/CAUTION/HIGH)과
# DB의 AiRiskLevel enum(LOW/CAUTION/HIGH)은 이름이 하나만 다르므로 매핑이 필요하다.
_RISK_LEVEL_TO_AI_RISK_LEVEL = {
    "NORMAL": AiRiskLevel.LOW,
    "CAUTION": AiRiskLevel.CAUTION,
    "HIGH": AiRiskLevel.HIGH,
}


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def continuous_work_started_at(db: Session, work_session: WorkSession) -> datetime:
    latest_completed_rest = db.scalar(
        select(RestRecord)
        .where(
            RestRecord.work_session_id == work_session.id,
            RestRecord.ended_at.is_not(None),
        )
        .order_by(desc(RestRecord.ended_at))
        .limit(1)
    )
    continuous_start = _aware(work_session.started_at)
    if latest_completed_rest is not None and latest_completed_rest.ended_at is not None:
        continuous_start = max(continuous_start, _aware(latest_completed_rest.ended_at))
    return continuous_start


def continuous_work_minutes(
    db: Session, work_session: WorkSession, *, now: datetime | None = None
) -> int:
    evaluated_at = _aware(now or utc_now())
    continuous_start = continuous_work_started_at(db, work_session)
    return max(0, int((evaluated_at - continuous_start).total_seconds() // 60))


def _latest_weather(db: Session, work_session: WorkSession) -> SiteWeatherLog:
    weather = db.scalar(
        select(SiteWeatherLog)
        .where(SiteWeatherLog.site_id == work_session.site_id)
        .order_by(desc(SiteWeatherLog.measured_at))
        .limit(1)
    )
    if weather is not None:
        return weather

    site = work_session.site
    weather = SiteWeatherLog(
        site_id=work_session.site_id,
        source=WeatherSource.DEMO,
        temperature=Decimal("31.80"),
        humidity=Decimal("68.00"),
        wind_speed=Decimal("1.80"),
        feels_like_temperature=Decimal("33.00"),
        latitude=site.latitude or Decimal("37.497900"),
        longitude=site.longitude or Decimal("127.027600"),
        measured_at=utc_now(),
    )
    db.add(weather)
    db.flush()
    return weather


def _mvp_rule(db: Session) -> ComplianceRule:
    rule = db.scalar(
        select(ComplianceRule).where(
            ComplianceRule.rule_code == MVP_RULE_CODE,
            ComplianceRule.version == MVP_RULE_VERSION,
        )
    )
    if rule is not None:
        return rule
    rule = ComplianceRule(
        rule_code=MVP_RULE_CODE,
        version=MVP_RULE_VERSION,
        name="MVP apparent-temperature continuous-work rest rule",
        description="Configured SHIMON MVP operational rule; not an authoritative legal measurement.",
        configuration={
            "feelsLikeTemperatureThreshold": float(MVP_FEELS_LIKE_THRESHOLD),
            "continuousWorkMinutesThreshold": MVP_CONTINUOUS_WORK_MINUTES,
            "requiredRestMinutes": MVP_REQUIRED_REST_MINUTES,
        },
        effective_from=utc_now(),
        is_active=True,
    )
    db.add(rule)
    db.flush()
    return rule


def _run_ai_assessment(db: Session, work_session: WorkSession) -> AiEvaluationData | None:
    """
    XGBoost 모델 + Rule Engine을 돌려서 AI 추정치를 계산하고, heat_risk_assessments에
    이력을 남긴다. 나이/현장 좌표가 없어서 계산 불가능하면 None을 반환한다
    (컴플라이언스 체크는 AI 없이도 독립적으로 동작해야 하므로, 여기서 예외를 던지지 않는다).
    """
    profile = work_session.worker.worker_profile if work_session.worker else None
    site = work_session.site
    if profile is None or site is None or site.latitude is None or site.longitude is None:
        return None

    rest_records = db.scalars(
        select(RestRecord).where(RestRecord.work_session_id == work_session.id)
    ).all()

    clothing_level = normalize_clothing_level(work_session.clothing_level)

    result = assess_worker_risk(
        worker={"age": profile.age},
        site={"lat": float(site.latitude), "lon": float(site.longitude)},
        work_session={
            "started_at": work_session.started_at,
            "clothing_level": clothing_level,
            "work_intensity": work_session.work_intensity,
            "rest_records": [{"ended_at": r.ended_at} for r in rest_records],
        },
    )
    core_temp_level = result["risk_level"]
    overall_level = compute_overall_risk_level(
        core_temp_level,
        result["inputs"]["continuous_work_min"],
        result["inputs"]["feels_like_temp"],
    )

    weather = result["weather"]
    weather_log = SiteWeatherLog(
        site_id=work_session.site_id,
        source=WeatherSource.KMA_API,
        temperature=weather["temp"],
        humidity=weather["humidity"],
        feels_like_temperature=result["inputs"]["feels_like_temp"],
        latitude=site.latitude,
        longitude=site.longitude,
        measured_at=result["assessed_at"],
    )
    db.add(weather_log)
    db.flush()

    db.add(HeatRiskAssessment(
        work_session_id=work_session.id,
        weather_log_id=weather_log.id,
        predicted_core_temperature=result["predicted_core_temp"],
        risk_level=_RISK_LEVEL_TO_AI_RISK_LEVEL[core_temp_level],
        input_snapshot=result["inputs"],
        main_factors=[],
        feature_schema_version="1",
        model_name=MODEL_NAME,
        model_version=MODEL_VERSION,
        evaluated_at=result["assessed_at"],
    ))

    return AiEvaluationData(
        estimated_core_temp_c=result["predicted_core_temp"],
        core_temp_level=core_temp_level,
        risk_level=overall_level,
        model_version=MODEL_VERSION,
    )


def evaluate_work_session(db: Session, work_session: WorkSession) -> EvaluationData:
    if work_session.status.value != "IN_PROGRESS":
        raise ApiError(409, "ACTIVE_WORK_SESSION_NOT_FOUND", "Work session is not active.")

    evaluated_at = utc_now()
    weather = _latest_weather(db, work_session)
    minutes = continuous_work_minutes(db, work_session, now=evaluated_at)
    result = evaluate_mvp_heat_rest_rule(weather.feels_like_temperature, minutes)
    rule = _mvp_rule(db)
    check = ComplianceCheck(
        work_session_id=work_session.id,
        weather_log_id=weather.id,
        compliance_rule_id=rule.id,
        status=result.status,
        is_rest_required=result.is_rest_required,
        rest_deadline=None,
        required_rest_minutes=result.required_rest_minutes,
        input_snapshot={
            "feelsLikeTemperature": float(weather.feels_like_temperature),
            "continuousWorkMinutes": minutes,
        },
        evaluated_at=evaluated_at,
    )
    db.add(check)
    ai = _run_ai_assessment(db, work_session)
    db.commit()
    return evaluation_data(check, weather, rule, ai)


def evaluation_data(
    check: ComplianceCheck,
    weather: SiteWeatherLog,
    rule: ComplianceRule,
    ai: AiEvaluationData | None = None,
) -> EvaluationData:
    return EvaluationData(
        evaluated_at=check.evaluated_at,
        weather=WeatherEvaluationData(
            temperature=float(weather.temperature),
            humidity=float(weather.humidity),
            feels_like_temperature=float(weather.feels_like_temperature),
        ),
        compliance=ComplianceEvaluationData(
            status=check.status,
            is_rest_required=check.is_rest_required,
            required_rest_minutes=check.required_rest_minutes,
            continuous_work_minutes=int(check.input_snapshot["continuousWorkMinutes"]),
            feels_like_temperature=float(check.input_snapshot["feelsLikeTemperature"]),
            rule_code=rule.rule_code,
            rule_version=rule.version,
        ),
        ai=ai,
    )


def _latest_ai_evaluation(db: Session, work_session_id) -> AiEvaluationData | None:
    ai = db.scalar(
        select(HeatRiskAssessment)
        .where(HeatRiskAssessment.work_session_id == work_session_id)
        .order_by(desc(HeatRiskAssessment.evaluated_at))
        .limit(1)
    )
    if ai is None:
        return None
    core_temp_level = {v: k for k, v in _RISK_LEVEL_TO_AI_RISK_LEVEL.items()}[ai.risk_level]
    return AiEvaluationData(
        estimated_core_temp_c=float(ai.predicted_core_temperature),
        core_temp_level=core_temp_level,
        risk_level=core_temp_level,  # 과거 이력은 그 시점 연속작업시간을 다시 계산하지 않고 coreTempLevel로 대체
        model_version=ai.model_version,
    )


def latest_evaluation(db: Session, work_session_id) -> EvaluationData | None:
    row = db.execute(
        select(ComplianceCheck, SiteWeatherLog, ComplianceRule)
        .join(SiteWeatherLog, ComplianceCheck.weather_log_id == SiteWeatherLog.id)
        .join(ComplianceRule, ComplianceCheck.compliance_rule_id == ComplianceRule.id)
        .where(ComplianceCheck.work_session_id == work_session_id)
        .order_by(desc(ComplianceCheck.evaluated_at))
        .limit(1)
    ).first()
    if row is None:
        return None
    check, weather, rule = row
    return evaluation_data(check, weather, rule, _latest_ai_evaluation(db, work_session_id))


def latest_rest_type(db: Session, work_session_id) -> tuple:
    check = db.scalar(
        select(ComplianceCheck)
        .where(ComplianceCheck.work_session_id == work_session_id)
        .order_by(desc(ComplianceCheck.evaluated_at))
        .limit(1)
    )
    ai = db.scalar(
        select(HeatRiskAssessment)
        .where(HeatRiskAssessment.work_session_id == work_session_id)
        .order_by(desc(HeatRiskAssessment.evaluated_at))
        .limit(1)
    )
    is_legal = check is not None and check.status == ComplianceStatus.IMMEDIATE_REST_REQUIRED
    is_ai_high = ai is not None and ai.risk_level == AiRiskLevel.HIGH
    return is_legal, is_ai_high, check
