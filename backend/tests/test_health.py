from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_root_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_versioned_health() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["data"]["status"] == "ok"


def test_worker_frontend_origin_is_allowed_by_cors() -> None:
    response = client.options(
        "/api/v1/me",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
