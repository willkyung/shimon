from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.core.config import get_settings
from backend.app.core.database import get_db
from backend.app.core.security import hash_password
from backend.app.main import app
from backend.app.models import (
    Company,
    ComplianceCheck,
    ComplianceRule,
    HeatRiskAssessment,
    RestRecord,
    SiteWeatherLog,
    User,
    WorkerProfile,
    WorkSession,
    WorkSite,
)
from backend.app.models.enums import UserRole, WorkSessionStatus
from backend.app.services.compliance import evaluate_mvp_heat_rest_rule
from backend.app.services.work_flow import continuous_work_minutes


@compiles(JSONB, "sqlite")
def _compile_jsonb_for_sqlite(_type, _compiler, **_kwargs) -> str:
    return "JSON"


TEST_JWT_SECRET = "test-work-flow-jwt-secret-with-at-least-32-characters"


@pytest.fixture
def work_context(
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[tuple[TestClient, sessionmaker[Session], User, WorkSite], None, None]:
    monkeypatch.setenv("JWT_SECRET", TEST_JWT_SECRET)
    get_settings.cache_clear()
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    tables = [
        Company.__table__,
        WorkSite.__table__,
        User.__table__,
        WorkerProfile.__table__,
        SiteWeatherLog.__table__,
        WorkSession.__table__,
        RestRecord.__table__,
        ComplianceRule.__table__,
        ComplianceCheck.__table__,
        HeatRiskAssessment.__table__,
    ]
    for table in tables:
        table.create(engine)
    test_session = sessionmaker(bind=engine, expire_on_commit=False)
    with test_session.begin() as db:
        company = Company(code="FLOW", name="Flow Company")
        db.add(company)
        db.flush()
        site = WorkSite(
            company_id=company.id,
            name="A1",
            latitude=Decimal("37.497900"),
            longitude=Decimal("127.027600"),
        )
        db.add(site)
        db.flush()
        user = User(
            company_id=company.id,
            employee_code="WFLOW00001",
            email="flow@example.com",
            password_hash=hash_password("password123"),
            name="Flow Worker",
            role=UserRole.WORKER,
        )
        user.worker_profile = WorkerProfile(
            assigned_site_id=site.id,
            age=29,
            work_type="토목 작업",
            work_intensity="보통",
            has_workwear=True,
            has_cooling_device=False,
        )
        db.add(user)

    def override_get_db() -> Generator[Session, None, None]:
        with test_session() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client, test_session, user, site
    app.dependency_overrides.clear()
    get_settings.cache_clear()
    for table in reversed(tables):
        table.drop(engine)
    engine.dispose()


def _login(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "flow@example.com", "password": "password123"},
    )
    return {"Authorization": f"Bearer {response.json()['data']['accessToken']}"}


def _start(client: TestClient, site: WorkSite, headers: dict[str, str]) -> dict:
    response = client.post(
        "/api/v1/work-sessions",
        headers=headers,
        json={
            "siteId": str(site.id),
            "workType": "토목 작업",
            "workIntensity": "보통",
            "clothingLevel": "WORKWEAR",
            "environment": "OUTDOOR",
        },
    )
    assert response.status_code == 201, response.json()
    return response.json()["data"]


def _parse_api_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


@pytest.mark.parametrize(
    ("feels_like", "minutes", "required"),
    [
        (Decimal("32.9"), 120, False),
        (Decimal("33.0"), 119, False),
        (Decimal("33.0"), 120, True),
    ],
)
def test_mvp_rule_boundaries(
    feels_like: Decimal, minutes: int, required: bool
) -> None:
    result = evaluate_mvp_heat_rest_rule(feels_like, minutes)
    assert result.is_rest_required is required
    assert (result.status.value == "IMMEDIATE_REST_REQUIRED") is required


def test_active_session_derives_time_from_started_at(
    work_context: tuple[TestClient, sessionmaker[Session], User, WorkSite],
) -> None:
    client, test_session, _user, site = work_context
    headers = _login(client)
    started = _start(client, site, headers)
    session_id = UUID(started["id"])
    with test_session.begin() as db:
        session = db.get(WorkSession, session_id)
        session.started_at = datetime.now(UTC) - timedelta(minutes=125)
    with test_session() as db:
        session = db.get(WorkSession, session_id)
        assert 124 <= continuous_work_minutes(db, session) <= 125

    current = client.get("/api/v1/me/work-session/current", headers=headers)
    assert current.status_code == 200
    assert current.json()["data"]["continuousWorkMinutes"] >= 124


def test_evaluation_appends_check_and_backend_owns_rest_type(
    work_context: tuple[TestClient, sessionmaker[Session], User, WorkSite],
) -> None:
    client, test_session, _user, site = work_context
    headers = _login(client)
    started = _start(client, site, headers)
    session_id = UUID(started["id"])

    with test_session.begin() as db:
        session = db.get(WorkSession, session_id)
        session.started_at = datetime.now(UTC) - timedelta(minutes=120)
        weather = db.scalar(
            select(SiteWeatherLog)
            .where(SiteWeatherLog.site_id == site.id)
            .order_by(SiteWeatherLog.measured_at.desc())
        )
        weather.feels_like_temperature = Decimal("33.00")

    evaluation = client.post(
        f"/api/v1/work-sessions/{session_id}/evaluate", headers=headers
    )
    assert evaluation.status_code == 200
    compliance = evaluation.json()["data"]["compliance"]
    assert compliance["status"] == "IMMEDIATE_REST_REQUIRED"
    assert compliance["isRestRequired"] is True
    assert compliance["requiredRestMinutes"] == 20

    rest = client.post(
        f"/api/v1/work-sessions/{session_id}/rests/start",
        headers=headers,
        json={"restType": "SELF_INITIATED"},
    )
    assert rest.status_code == 201
    assert rest.json()["data"]["restType"] == "LEGAL_REQUIRED"
    current = client.get("/api/v1/me/work-session/current", headers=headers)
    assert current.json()["data"]["workerState"] == "RESTING"

    with test_session() as db:
        assert db.scalar(
            select(func.count())
            .select_from(ComplianceCheck)
            .where(ComplianceCheck.work_session_id == session_id)
        ) == 2
        record = db.scalar(select(RestRecord).where(RestRecord.work_session_id == session_id))
        assert record is not None
        assert record.rest_type.value == "LEGAL_REQUIRED"


def test_work_and_rest_history_follow_real_session_lifecycle(
    work_context: tuple[TestClient, sessionmaker[Session], User, WorkSite],
) -> None:
    client, _test_session, _user, site = work_context
    headers = _login(client)

    empty_work = client.get("/api/v1/me/work-sessions", headers=headers)
    empty_rest = client.get("/api/v1/me/rest-records", headers=headers)
    assert empty_work.status_code == 200
    assert empty_work.json()["data"] == []
    assert empty_rest.status_code == 200
    assert empty_rest.json()["data"] == []

    started = _start(client, site, headers)
    session_id = started["id"]
    assert _parse_api_datetime(started["continuousWorkStartedAt"]) == _parse_api_datetime(
        started["startedAt"]
    )
    work_history = client.get("/api/v1/me/work-sessions", headers=headers)
    assert work_history.status_code == 200
    work_item = work_history.json()["data"][0]
    assert work_item["id"] == session_id
    assert work_item["status"] == "IN_PROGRESS"
    assert work_item["endedAt"] is None
    assert work_item["evaluation"]["complianceStatus"] == "NORMAL"

    rest_started = client.post(
        f"/api/v1/work-sessions/{session_id}/rests/start", headers=headers
    )
    assert rest_started.status_code == 201
    rest_id = rest_started.json()["data"]["restId"]
    rest_history = client.get("/api/v1/me/rest-records", headers=headers)
    assert rest_history.status_code == 200
    rest_item = rest_history.json()["data"][0]
    assert rest_item["id"] == rest_id
    assert rest_item["endedAt"] is None
    assert rest_item["restType"] == "SELF_INITIATED"
    assert rest_item["evaluation"]["complianceStatus"] == "NORMAL"
    blocked_during_rest = client.post(
        "/api/v1/work-sessions",
        headers=headers,
        json={
            "siteId": str(site.id),
            "workType": "Civil work",
            "workIntensity": "MEDIUM",
            "clothingLevel": "WORKWEAR",
            "environment": "OUTDOOR",
        },
    )
    assert blocked_during_rest.status_code == 409
    assert blocked_during_rest.json()["error"]["code"] == "ACTIVE_REST_ALREADY_EXISTS"
    completed_first_work = client.get("/api/v1/me/work-sessions", headers=headers)
    assert completed_first_work.json()["data"][0]["id"] == session_id
    assert completed_first_work.json()["data"][0]["status"] == "COMPLETED"
    assert completed_first_work.json()["data"][0]["endedAt"] is not None

    rest_ended = client.post(f"/api/v1/rests/{rest_id}/end", headers=headers)
    assert rest_ended.status_code == 200, rest_ended.json()
    rest_end_data = rest_ended.json()["data"]
    assert _parse_api_datetime(
        rest_end_data["continuousWorkStartedAt"]
    ) == _parse_api_datetime(rest_end_data["endedAt"])
    resumed = client.get("/api/v1/me/work-session/current", headers=headers)
    assert resumed.status_code == 200
    next_session_id = rest_end_data["workSessionId"]
    assert next_session_id != session_id
    assert resumed.json()["data"]["id"] == next_session_id
    assert resumed.json()["data"]["status"] == "IN_PROGRESS"
    assert _parse_api_datetime(
        resumed.json()["data"]["continuousWorkStartedAt"]
    ) == _parse_api_datetime(rest_end_data["endedAt"])
    assert resumed.json()["data"]["continuousWorkMinutes"] == 0
    work_ended = client.post(
        f"/api/v1/work-sessions/{next_session_id}/end", headers=headers
    )
    assert work_ended.status_code == 200

    completed_work = client.get("/api/v1/me/work-sessions", headers=headers)
    completed_rest = client.get("/api/v1/me/rest-records", headers=headers)
    assert len(completed_work.json()["data"]) == 2
    assert completed_work.json()["data"][0]["id"] == next_session_id
    assert completed_work.json()["data"][0]["status"] == "COMPLETED"
    assert completed_work.json()["data"][0]["endedAt"] is not None
    assert completed_rest.json()["data"][0]["endedAt"] is not None
