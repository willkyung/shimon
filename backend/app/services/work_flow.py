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
    db.commit()
    return evaluation_data(check, weather, rule)


def evaluation_data(
    check: ComplianceCheck, weather: SiteWeatherLog, rule: ComplianceRule
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
        ai=None,
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
    return evaluation_data(*row) if row is not None else None


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
