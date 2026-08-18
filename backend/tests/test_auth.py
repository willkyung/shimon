from collections.abc import Generator
from uuid import uuid4

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.dependencies import require_role
from backend.app.core.config import get_settings
from backend.app.core.database import get_db
from backend.app.core.errors import ApiError
from backend.app.core.security import decode_access_token, verify_password
from backend.app.main import app
from backend.app.models import Company, User, WorkerProfile, WorkSite
from backend.app.models.enums import UserRole


TEST_JWT_SECRET = "test-only-jwt-secret-with-at-least-32-characters"


@pytest.fixture
def auth_context(
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[tuple[TestClient, sessionmaker[Session], Company, WorkSite], None, None]:
    monkeypatch.setenv("JWT_SECRET", TEST_JWT_SECRET)
    monkeypatch.setenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60")
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
    ]
    for table in tables:
        table.create(engine)

    test_session = sessionmaker(bind=engine, expire_on_commit=False)
    with test_session.begin() as db:
        company = Company(code="EST-2026", name="SHIMON Demo Company")
        other_company = Company(code="OTHER", name="Other Company")
        db.add_all([company, other_company])
        db.flush()
        site = WorkSite(company_id=company.id, name="Demo Site")
        other_site = WorkSite(company_id=other_company.id, name="Other Site")
        db.add_all([site, other_site])

    def override_get_db() -> Generator[Session, None, None]:
        with test_session() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client, test_session, company, site

    app.dependency_overrides.clear()
    get_settings.cache_clear()
    for table in reversed(tables):
        table.drop(engine)
    engine.dispose()


def signup_payload(site_id: object, **overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "companyCode": "EST-2026",
        "employeeCode": "W001",
        "email": "worker1@example.com",
        "password": "password123",
        "name": "Kim Worker",
        "phone": "01012345678",
        "role": "WORKER",
        "workerProfile": {
            "age": 29,
            "assignedSiteId": str(site_id),
            "hasCoolingDevice": True,
        },
    }
    payload.update(overrides)
    return payload


def test_signup_creates_worker_profile_and_hashes_password(
    auth_context: tuple[TestClient, sessionmaker[Session], Company, WorkSite],
) -> None:
    client, test_session, _company, site = auth_context

    response = client.post("/api/v1/auth/signup", json=signup_payload(site.id))

    assert response.status_code == 201
    assert response.json()["data"]["role"] == "WORKER"
    with test_session() as db:
        user = db.scalar(select(User).where(User.employee_code == "W001"))
        assert user is not None
        assert user.password_hash != "password123"
        assert verify_password("password123", user.password_hash)
        profile = db.get(WorkerProfile, user.id)
        assert profile is not None
        assert profile.assigned_site_id == site.id
        assert profile.has_cooling_device is True


def test_signup_rejects_unknown_company_and_cross_company_site(
    auth_context: tuple[TestClient, sessionmaker[Session], Company, WorkSite],
) -> None:
    client, _test_session, _company, _site = auth_context

    missing_company = client.post(
        "/api/v1/auth/signup",
        json=signup_payload(uuid4(), companyCode="MISSING"),
    )
    cross_company = client.post(
        "/api/v1/auth/signup",
        json=signup_payload(_other_site_id(_test_session)),
    )

    assert missing_company.status_code == 404
    assert missing_company.json()["error"]["code"] == "COMPANY_NOT_FOUND"
    assert cross_company.status_code == 404
    assert cross_company.json()["error"]["code"] == "SITE_NOT_FOUND"


def _other_site_id(test_session: sessionmaker[Session]) -> object:
    with test_session() as db:
        return db.scalar(select(WorkSite.id).where(WorkSite.name == "Other Site"))


def test_signup_rejects_duplicate_employee_code_and_email(
    auth_context: tuple[TestClient, sessionmaker[Session], Company, WorkSite],
) -> None:
    client, _test_session, _company, site = auth_context
    first = client.post("/api/v1/auth/signup", json=signup_payload(site.id))
    assert first.status_code == 201

    duplicate_employee = client.post(
        "/api/v1/auth/signup",
        json=signup_payload(
            site.id,
            email="different@example.com",
        ),
    )
    duplicate_email = client.post(
        "/api/v1/auth/signup",
        json=signup_payload(
            site.id,
            employeeCode="W002",
        ),
    )

    assert duplicate_employee.status_code == 409
    assert duplicate_employee.json()["error"]["code"] == (
        "EMPLOYEE_CODE_ALREADY_EXISTS"
    )
    assert duplicate_email.status_code == 409
    assert duplicate_email.json()["error"]["code"] == "EMAIL_ALREADY_EXISTS"


def test_public_admin_signup_is_forbidden(
    auth_context: tuple[TestClient, sessionmaker[Session], Company, WorkSite],
) -> None:
    client, test_session, _company, site = auth_context

    response = client.post(
        "/api/v1/auth/signup",
        json=signup_payload(site.id, role="ADMIN", workerProfile=None),
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"
    with test_session() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 0


def test_login_rejects_invalid_credentials_without_account_leakage(
    auth_context: tuple[TestClient, sessionmaker[Session], Company, WorkSite],
) -> None:
    client, _test_session, _company, site = auth_context
    client.post("/api/v1/auth/signup", json=signup_payload(site.id))

    wrong_password = client.post(
        "/api/v1/auth/login",
        json={
            "companyCode": "EST-2026",
            "employeeCode": "W001",
            "password": "wrong-password",
        },
    )
    unknown_user = client.post(
        "/api/v1/auth/login",
        json={
            "companyCode": "EST-2026",
            "employeeCode": "UNKNOWN",
            "password": "wrong-password",
        },
    )

    assert wrong_password.status_code == unknown_user.status_code == 401
    assert wrong_password.json() == unknown_user.json()
    assert wrong_password.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_valid_login_returns_jwt_with_required_claims(
    auth_context: tuple[TestClient, sessionmaker[Session], Company, WorkSite],
) -> None:
    client, _test_session, _company, site = auth_context
    signup = client.post("/api/v1/auth/signup", json=signup_payload(site.id))

    response = client.post(
        "/api/v1/auth/login",
        json={
            "companyCode": "EST-2026",
            "employeeCode": "W001",
            "password": "password123",
        },
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["tokenType"] == "bearer"
    claims = decode_access_token(data["accessToken"])
    assert claims["sub"] == signup.json()["data"]["userId"]
    assert claims["role"] == "WORKER"
    assert "exp" in claims


def test_me_requires_authentication_and_returns_worker_profile(
    auth_context: tuple[TestClient, sessionmaker[Session], Company, WorkSite],
) -> None:
    client, _test_session, _company, site = auth_context
    client.post("/api/v1/auth/signup", json=signup_payload(site.id))
    login = client.post(
        "/api/v1/auth/login",
        json={
            "companyCode": "EST-2026",
            "employeeCode": "W001",
            "password": "password123",
        },
    )

    unauthenticated = client.get("/api/v1/me")
    authenticated = client.get(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {login.json()['data']['accessToken']}"},
    )

    assert unauthenticated.status_code == 401
    assert unauthenticated.json()["error"]["code"] == "INVALID_CREDENTIALS"
    assert authenticated.status_code == 200
    data = authenticated.json()["data"]
    assert data["name"] == "Kim Worker"
    assert data["workerProfile"]["age"] == 29
    assert data["workerProfile"]["assignedSite"] == {
        "id": str(site.id),
        "name": "Demo Site",
    }
    assert "passwordHash" not in data


def test_invalid_token_and_wrong_role_are_rejected(
    auth_context: tuple[TestClient, sessionmaker[Session], Company, WorkSite],
) -> None:
    client, _test_session, company, _site = auth_context
    invalid_token = client.get(
        "/api/v1/me", headers={"Authorization": "Bearer invalid-token"}
    )

    worker = User(
        company_id=company.id,
        employee_code="ROLE-TEST",
        email="role@example.com",
        password_hash="not-used",
        name="Role Test",
        role=UserRole.WORKER,
    )
    admin_only = require_role(UserRole.ADMIN)

    assert invalid_token.status_code == 401
    with pytest.raises(ApiError) as error:
        admin_only(worker)
    assert error.value.status_code == 403
    assert error.value.code == "FORBIDDEN"
