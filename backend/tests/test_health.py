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
