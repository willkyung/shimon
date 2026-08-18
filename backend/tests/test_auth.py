from collections.abc import Generator
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
from backend.app.core.security import decode_access_token, hash_password, verify_password
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
        company = Company(code="EST-2026", name="SHIMON Company")
        other_company = Company(code="OTHER", name="Other Company")
        db.add_all([company, other_company])
        db.flush()
        site = WorkSite(company_id=company.id, name="서울 A구역")
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


def signup_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "companyName": "SHIMON Company",
        "email": "worker1@example.com",
        "password": "password123",
        "name": "Kim Worker",
        "phone": "01012345678",
        "role": "WORKER",
        "workerProfile": {
            "age": 29,
            "workArea": "서울 A구역",
            "workType": "토목 작업",
            "hasWorkwear": True,
        },
    }
    payload.update(overrides)
    return payload


def test_signup_creates_worker_profile_and_hashes_password(
    auth_context: tuple[TestClient, sessionmaker[Session], Company, WorkSite],
) -> None:
    client, test_session, _company, site = auth_context

    response = client.post("/api/v1/auth/signup", json=signup_payload())

    assert response.status_code == 201
    assert response.json()["data"]["role"] == "WORKER"
    with test_session() as db:
        user = db.scalar(select(User).where(User.email == "worker1@example.com"))
        assert user is not None
        assert user.employee_code.startswith("W")
        assert len(user.employee_code) == 10
        assert user.password_hash != "password123"
        assert verify_password("password123", user.password_hash)
        profile = db.get(WorkerProfile, user.id)
        assert profile is not None
        assert profile.assigned_site_id == site.id
        assert profile.work_type == "토목 작업"
        assert profile.work_intensity == "보통"
        assert profile.has_workwear is True
        assert profile.has_cooling_device is False


@pytest.mark.parametrize(
    ("work_type", "expected_intensity"),
    [
        ("순찰·점검", "낮음"),
        ("토목 작업", "보통"),
        ("건설 작업", "보통"),
        ("도로 작업", "높음"),
        ("중량물 운반", "높음"),
    ],
)
def test_signup_derives_mvp_work_intensity(
    auth_context: tuple[TestClient, sessionmaker[Session], Company, WorkSite],
    work_type: str,
    expected_intensity: str,
) -> None:
    client, test_session, _company, _site = auth_context
    payload = signup_payload(
        workerProfile={
            "age": 29,
            "workArea": "서울 A구역",
            "workType": work_type,
            "hasWorkwear": False,
        }
    )

    response = client.post("/api/v1/auth/signup", json=payload)

    assert response.status_code == 201
    with test_session() as db:
        user = db.scalar(select(User).where(User.email == "worker1@example.com"))
        assert user is not None
        profile = db.get(WorkerProfile, user.id)
        assert profile is not None
        assert profile.work_type == work_type
        assert profile.work_intensity == expected_intensity
        assert profile.has_workwear is False


def test_signup_rejects_unknown_company_and_work_area(
    auth_context: tuple[TestClient, sessionmaker[Session], Company, WorkSite],
) -> None:
    client, _test_session, _company, _site = auth_context

    missing_company = client.post(
        "/api/v1/auth/signup", json=signup_payload(companyName="Missing Company")
    )
    missing_work_area = client.post(
        "/api/v1/auth/signup",
        json=signup_payload(
            workerProfile={
                "age": 29,
                "workArea": "없는 구역",
                "workType": "토목 작업",
                "hasWorkwear": True,
            }
        ),
    )

    assert missing_company.status_code == 404
    assert missing_company.json()["error"]["code"] == "COMPANY_NOT_FOUND"
    assert missing_work_area.status_code == 404
    assert missing_work_area.json()["error"]["code"] == "SITE_NOT_FOUND"


def test_signup_generates_unique_employee_codes_and_rejects_duplicate_email(
    auth_context: tuple[TestClient, sessionmaker[Session], Company, WorkSite],
) -> None:
    client, _test_session, _company, site = auth_context
    first = client.post("/api/v1/auth/signup", json=signup_payload())
    assert first.status_code == 201

    second = client.post(
        "/api/v1/auth/signup",
        json=signup_payload(
            email="different@example.com",
        ),
    )
    duplicate_email = client.post(
        "/api/v1/auth/signup",
        json=signup_payload(),
    )

    assert second.status_code == 201
    assert first.json()["data"]["employeeCode"] != second.json()["data"]["employeeCode"]
    assert duplicate_email.status_code == 409
    assert duplicate_email.json()["error"]["code"] == "EMAIL_ALREADY_EXISTS"


def test_public_admin_signup_is_forbidden(
    auth_context: tuple[TestClient, sessionmaker[Session], Company, WorkSite],
) -> None:
    client, test_session, _company, site = auth_context

    response = client.post(
        "/api/v1/auth/signup",
        json=signup_payload(role="ADMIN", workerProfile=None),
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"
    with test_session() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 0


def test_signup_validation_returns_field_details(
    auth_context: tuple[TestClient, sessionmaker[Session], Company, WorkSite],
) -> None:
    client, _test_session, _company, _site = auth_context

    response = client.post(
        "/api/v1/auth/signup",
        json=signup_payload(
            email="not-an-email",
            password="passwordonly",
            workerProfile={
                "age": 17,
                "workArea": "서울 A구역",
                "workType": "토목 작업",
                "hasWorkwear": True,
            },
        ),
    )

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    fields = {detail["field"] for detail in error["details"]}
    assert {"email", "password", "workerProfile.age"} <= fields


def test_login_rejects_invalid_credentials_without_account_leakage(
    auth_context: tuple[TestClient, sessionmaker[Session], Company, WorkSite],
) -> None:
    client, _test_session, _company, site = auth_context
    client.post("/api/v1/auth/signup", json=signup_payload())

    wrong_password = client.post(
        "/api/v1/auth/login",
        json={
            "email": "worker1@example.com",
            "password": "wrong-password",
        },
    )
    unknown_user = client.post(
        "/api/v1/auth/login",
        json={
            "email": "unknown@example.com",
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
    signup = client.post("/api/v1/auth/signup", json=signup_payload())

    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "WORKER1@example.com",
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
    signup = client.post("/api/v1/auth/signup", json=signup_payload())
    login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "worker1@example.com",
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
    assert data["companyCode"] == "EST-2026"
    assert data["companyName"] == "SHIMON Company"
    assert data["employeeCode"] == signup.json()["data"]["employeeCode"]
    assert data["email"] == "worker1@example.com"
    assert data["workerProfile"]["age"] == 29
    assert data["workerProfile"]["workType"] == "토목 작업"
    assert data["workerProfile"]["workIntensity"] == "보통"
    assert data["workerProfile"]["hasWorkwear"] is True
    assert data["workerProfile"]["assignedSite"] == {
        "id": str(site.id),
        "name": "서울 A구역",
    }
    assert "passwordHash" not in data


def test_worker_can_persist_profile_updates(
    auth_context: tuple[TestClient, sessionmaker[Session], Company, WorkSite],
) -> None:
    client, test_session, company, _site = auth_context
    with test_session.begin() as db:
        second_site = WorkSite(company_id=company.id, name="서울 B구역")
        db.add(second_site)
        db.flush()
        second_site_id = second_site.id

    client.post("/api/v1/auth/signup", json=signup_payload())
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "worker1@example.com", "password": "password123"},
    )
    token = login.json()["data"]["accessToken"]

    response = client.patch(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "email": "updated@example.com",
            "phone": "010-3333-3333",
            "gender": "남성",
            "workArea": "서울 B구역",
            "workType": "중량물 운반",
            "hasWorkwear": False,
        },
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["email"] == "updated@example.com"
    assert data["phone"] == "010-3333-3333"
    assert data["workerProfile"]["gender"] == "남성"
    assert data["workerProfile"]["workType"] == "중량물 운반"
    assert data["workerProfile"]["workIntensity"] == "높음"
    assert data["workerProfile"]["hasWorkwear"] is False
    assert data["workerProfile"]["assignedSite"] == {
        "id": str(second_site_id),
        "name": "서울 B구역",
    }

    with test_session() as db:
        user = db.scalar(select(User).where(User.email == "updated@example.com"))
        assert user is not None
        profile = db.get(WorkerProfile, user.id)
        assert profile is not None
        assert profile.assigned_site_id == second_site_id
        assert profile.work_intensity == "높음"


def test_profile_update_rejects_duplicate_email_and_unknown_work_area(
    auth_context: tuple[TestClient, sessionmaker[Session], Company, WorkSite],
) -> None:
    client, _test_session, _company, _site = auth_context
    client.post("/api/v1/auth/signup", json=signup_payload())
    client.post(
        "/api/v1/auth/signup",
        json=signup_payload(email="second@example.com", name="Second Worker"),
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "worker1@example.com", "password": "password123"},
    )
    headers = {"Authorization": f"Bearer {login.json()['data']['accessToken']}"}
    base_payload = {
        "email": "worker1@example.com",
        "phone": None,
        "gender": "여성",
        "workArea": "서울 A구역",
        "workType": "토목 작업",
        "hasWorkwear": True,
    }

    duplicate = client.patch(
        "/api/v1/me",
        headers=headers,
        json={**base_payload, "email": "second@example.com"},
    )
    unknown_site = client.patch(
        "/api/v1/me",
        headers=headers,
        json={**base_payload, "workArea": "없는 구역"},
    )

    assert duplicate.status_code == 409
    assert duplicate.json()["error"] == {
        "code": "EMAIL_ALREADY_EXISTS",
        "message": "Email already exists.",
        "field": "email",
    }
    assert unknown_site.status_code == 404
    assert unknown_site.json()["error"]["code"] == "SITE_NOT_FOUND"
    assert unknown_site.json()["error"]["field"] == "workArea"


def test_existing_admin_can_login(
    auth_context: tuple[TestClient, sessionmaker[Session], Company, WorkSite],
) -> None:
    client, test_session, company, _site = auth_context
    with test_session.begin() as db:
        db.add(
            User(
                company_id=company.id,
                employee_code="A001",
                email="admin@example.com",
                password_hash=hash_password("admin-password"),
                name="Demo Admin",
                role=UserRole.ADMIN,
            )
        )

    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "admin@example.com",
            "password": "admin-password",
        },
    )

    assert response.status_code == 200
    assert response.json()["data"]["user"]["role"] == "ADMIN"


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
