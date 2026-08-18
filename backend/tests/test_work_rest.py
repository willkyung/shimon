from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.core.config import get_settings
from backend.app.core.database import get_db
from backend.app.core.security import create_access_token
from backend.app.main import app
from backend.app.models import (
    Company,
    RestRecord,
    User,
    WorkerProfile,
    WorkSession,
    WorkSite,
)
from backend.app.models.enums import UserRole


TEST_JWT_SECRET = "test-only-jwt-secret-with-at-least-32-characters"


@pytest.fixture
def work_context(
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[tuple[TestClient, User, User, User, WorkSite], None, None]:
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
        WorkSession.__table__,
        RestRecord.__table__,
    ]
    for table in tables:
        table.create(engine)

    test_session = sessionmaker(bind=engine, expire_on_commit=False)
    with test_session.begin() as db:
        company = Company(code="WORK", name="Work Company")
        db.add(company)
        db.flush()
        site = WorkSite(company_id=company.id, name="Assigned Site")
        db.add(site)
        db.flush()
        worker = User(
            company_id=company.id,
            employee_code="W1",
            email="w1@example.com",
            password_hash="unused",
            name="Worker One",
            role=UserRole.WORKER,
        )
        other_worker = User(
            company_id=company.id,
            employee_code="W2",
            email="w2@example.com",
            password_hash="unused",
            name="Worker Two",
            role=UserRole.WORKER,
        )
        admin = User(
            company_id=company.id,
            employee_code="A1",
            email="admin@example.com",
            password_hash="unused",
            name="Admin",
            role=UserRole.ADMIN,
        )
        db.add_all([worker, other_worker, admin])
        db.flush()
        db.add_all(
            [
                WorkerProfile(user_id=worker.id, assigned_site_id=site.id),
                WorkerProfile(user_id=other_worker.id, assigned_site_id=site.id),
            ]
        )

    def override_get_db() -> Generator[Session, None, None]:
        with test_session() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client, worker, other_worker, admin, site
    app.dependency_overrides.clear()
    get_settings.cache_clear()
    for table in reversed(tables):
        table.drop(engine)
    engine.dispose()


def _headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role)}"}


def _start_payload(site: WorkSite) -> dict[str, str]:
    return {
        "siteId": str(site.id),
        "workType": "MATERIAL_TRANSPORT",
        "workIntensity": "HIGH",
        "clothingLevel": "PROTECTIVE",
        "environment": "OUTDOOR_SUN",
    }


def test_work_and_rest_acceptance_flow_and_conflicts(
    work_context: tuple[TestClient, User, User, User, WorkSite],
) -> None:
    client, worker, _other_worker, _admin, site = work_context
    headers = _headers(worker)

    unauthenticated = client.post("/api/v1/work-sessions", json=_start_payload(site))
    assert unauthenticated.status_code == 401

    started = client.post(
        "/api/v1/work-sessions", json=_start_payload(site), headers=headers
    )
    assert started.status_code == 201
    work_id = started.json()["data"]["workSessionId"]

    duplicate_work = client.post(
        "/api/v1/work-sessions", json=_start_payload(site), headers=headers
    )
    assert duplicate_work.status_code == 409
    assert duplicate_work.json()["error"]["code"] == "ACTIVE_WORK_SESSION_EXISTS"

    current = client.get("/api/v1/me/work-session/current", headers=headers)
    assert current.json()["data"]["workerState"] == "WORKING"
    assert current.json()["data"]["continuousWorkMinutes"] >= 0

    started_rest = client.post(
        f"/api/v1/work-sessions/{work_id}/rests/start", json={}, headers=headers
    )
    assert started_rest.status_code == 201
    rest_id = started_rest.json()["data"]["restId"]
    assert started_rest.json()["data"]["restType"] == "SELF_INITIATED"
    assert client.get(
        "/api/v1/me/work-session/current", headers=headers
    ).json()["data"]["workerState"] == "RESTING"

    duplicate_rest = client.post(
        f"/api/v1/work-sessions/{work_id}/rests/start", json={}, headers=headers
    )
    assert duplicate_rest.status_code == 409
    assert duplicate_rest.json()["error"]["code"] == "ACTIVE_REST_ALREADY_EXISTS"

    end_while_resting = client.post(
        f"/api/v1/work-sessions/{work_id}/end", headers=headers
    )
    assert end_while_resting.status_code == 409

    ended_rest = client.post(f"/api/v1/rests/{rest_id}/end", headers=headers)
    assert ended_rest.status_code == 200
    assert ended_rest.json()["data"]["workerState"] == "WORKING"
    assert client.get(
        "/api/v1/me/work-session/current", headers=headers
    ).json()["data"]["workerState"] == "WORKING"

    ended_work = client.post(
        f"/api/v1/work-sessions/{work_id}/end", headers=headers
    )
    assert ended_work.status_code == 200
    assert ended_work.json()["data"]["workerState"] == "IDLE"
    assert client.get(
        "/api/v1/me/work-session/current", headers=headers
    ).json()["data"] is None


def test_worker_cannot_modify_another_workers_session(
    work_context: tuple[TestClient, User, User, User, WorkSite],
) -> None:
    client, worker, other_worker, _admin, site = work_context
    started = client.post(
        "/api/v1/work-sessions", json=_start_payload(site), headers=_headers(worker)
    )
    work_id = started.json()["data"]["workSessionId"]

    response = client.post(
        f"/api/v1/work-sessions/{work_id}/end", headers=_headers(other_worker)
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "WORK_SESSION_NOT_FOUND"


def test_admin_cannot_use_worker_actions(
    work_context: tuple[TestClient, User, User, User, WorkSite],
) -> None:
    client, _worker, _other_worker, admin, site = work_context

    response = client.post(
        "/api/v1/work-sessions", json=_start_payload(site), headers=_headers(admin)
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"
