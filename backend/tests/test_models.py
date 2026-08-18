from backend.app.core.database import Base
from backend.app.models import ComplianceCheck, HeatRiskAssessment
from backend.app.models.enums import AiRiskLevel


EXPECTED_P0_TABLES = {
    "companies",
    "users",
    "worker_profiles",
    "work_sites",
    "site_weather_logs",
    "work_sessions",
    "rest_records",
    "compliance_rules",
    "compliance_checks",
    "heat_risk_assessments",
}


def test_p0_models_use_shared_metadata() -> None:
    assert set(Base.metadata.tables) == EXPECTED_P0_TABLES


def test_ai_risk_enum_is_canonical() -> None:
    assert [risk.value for risk in AiRiskLevel] == ["LOW", "CAUTION", "HIGH"]


def test_compliance_and_ai_records_are_separate() -> None:
    compliance_columns = set(ComplianceCheck.__table__.columns.keys())
    ai_columns = set(HeatRiskAssessment.__table__.columns.keys())

    assert "status" in compliance_columns
    assert "risk_level" not in compliance_columns
    assert "risk_level" in ai_columns
    assert "status" not in ai_columns


def test_active_work_and_rest_indexes_are_partial_unique() -> None:
    work_index = next(
        index
        for index in Base.metadata.tables["work_sessions"].indexes
        if index.name == "uq_work_sessions_active_worker"
    )
    rest_index = next(
        index
        for index in Base.metadata.tables["rest_records"].indexes
        if index.name == "uq_rest_records_active_work_session"
    )

    assert work_index.unique is True
    assert work_index.dialect_options["postgresql"]["where"] is not None
    assert rest_index.unique is True
    assert rest_index.dialect_options["postgresql"]["where"] is not None
