"""
smoke_test_api.py
-------------------
커밋 전에 "API가 DB랑 실제로 잘 연결되고 데이터가 오가는지" 한 번에 훑어보는 스모크 테스트.

전제조건:
  - Docker Postgres가 떠 있고 마이그레이션이 최신 상태일 것
  - uvicorn backend.app.main:app 이 로컬에서 실행 중일 것 (기본 8000 포트)
  - backend/scripts/seed_employee_roster.py 를 먼저 실행해서 HB-W001/HB-A001 직원 명단이 있을 것

이 스크립트는 실제로 존재하지 않는 값을 조회했을 때 404가 나는지, 잘못된 비밀번호에 401이
나는지 같은 "실패 케이스"도 같이 확인한다. 단순히 200이 뜨는지만 보는 게 아니라, 응답 안의
필드 값이 기대한 대로인지까지 검증(assert)한다.
"""

import sys
import uuid

import requests

BASE_URL = "http://localhost:8000/api/v1"

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"

results: list[tuple[str, bool, str]] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    results.append((name, condition, detail))
    tag = PASS if condition else FAIL
    print(f"[{tag}] {name}" + (f" — {detail}" if detail and not condition else ""))


def main() -> None:
    session = requests.Session()

    # ------------------------------------------------------------------
    # 0. 서버가 살아있는지
    # ------------------------------------------------------------------
    r = session.get(f"{BASE_URL}/health")
    check("health check", r.status_code == 200, r.text)

    # ------------------------------------------------------------------
    # 1. Auth — Worker 로그인 (이미 가입된 데모 계정 사용)
    # ------------------------------------------------------------------
    r = session.post(f"{BASE_URL}/auth/login", json={
        "identifier": "HB-W001", "password": "1234abcd",
    })
    check("worker login", r.status_code == 200, r.text)
    worker_login = r.json()
    worker_token = worker_login.get("accessToken")
    worker_headers = {"Authorization": f"Bearer {worker_token}"}
    check("worker login returns numeric id", isinstance(worker_login.get("user", {}).get("id"), int))

    # 잘못된 비밀번호 -> 401
    r = session.post(f"{BASE_URL}/auth/login", json={
        "identifier": "HB-W001", "password": "wrong-password",
    })
    check("worker login wrong password -> 401", r.status_code == 401, r.text)

    # 등록 안 된 사원 -> 404
    r = session.post(f"{BASE_URL}/auth/verify-employee", json={
        "employeeCode": f"NO-SUCH-{uuid.uuid4().hex[:6]}", "name": "없는사람",
    })
    check("verify-employee unknown -> 404", r.status_code == 404, r.text)

    # refresh
    r = session.post(f"{BASE_URL}/auth/refresh", json={"refreshToken": worker_login.get("refreshToken")})
    check("refresh token", r.status_code == 200 and "accessToken" in r.json(), r.text)

    # ------------------------------------------------------------------
    # 2. Admin 로그인
    # ------------------------------------------------------------------
    r = session.post(f"{BASE_URL}/auth/login", json={
        "identifier": "HB-A001", "password": "1234abcd",
    })
    check("admin login", r.status_code == 200, r.text)
    admin_token = r.json().get("accessToken")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # ------------------------------------------------------------------
    # 3. /users/me
    # ------------------------------------------------------------------
    r = session.get(f"{BASE_URL}/users/me", headers=worker_headers)
    check("GET /users/me (worker)", r.status_code == 200 and r.json().get("role") == "WORKER", r.text)

    # ------------------------------------------------------------------
    # 4. Worker 핵심 플로우 — 작업 시작 -> 안전값 -> 휴식 -> 종료
    # ------------------------------------------------------------------
    r = session.get(f"{BASE_URL}/worker/home", headers=worker_headers)
    check("GET /worker/home", r.status_code == 200 and "safety" in r.json(), r.text)

    # 혹시 이미 진행 중인 세션이 있으면 먼저 정리
    r = session.get(f"{BASE_URL}/worker/work-sessions/current", headers=worker_headers)
    if r.status_code == 200:
        existing_id = r.json()["id"]
        session.post(f"{BASE_URL}/worker/work-sessions/{existing_id}/end", headers=worker_headers)

    r = session.post(f"{BASE_URL}/worker/work-sessions", headers=worker_headers, json={})
    check("POST /worker/work-sessions", r.status_code == 201, r.text)
    work_session_id = r.json().get("id")
    check("work session has numeric id", isinstance(work_session_id, int))

    r = session.get(f"{BASE_URL}/worker/safety/current", headers=worker_headers)
    check(
        "GET /worker/safety/current returns riskLevel",
        r.status_code == 200 and r.json().get("riskLevel") in ("NORMAL", "CAUTION", "HIGH"),
        r.text,
    )

    r = session.post(f"{BASE_URL}/worker/rest-sessions", headers=worker_headers, json={
        "workSessionId": work_session_id, "reason": "USER_STARTED",
    })
    check("POST /worker/rest-sessions", r.status_code == 201, r.text)
    rest_id = r.json().get("id")

    r = session.get(f"{BASE_URL}/worker/rest-sessions/current", headers=worker_headers)
    check("GET /worker/rest-sessions/current", r.status_code == 200, r.text)

    r = session.post(f"{BASE_URL}/worker/rest-sessions/{rest_id}/end", headers=worker_headers)
    check("POST /worker/rest-sessions/{id}/end", r.status_code == 200 and r.json().get("status") == "COMPLETED", r.text)

    r = session.post(f"{BASE_URL}/worker/work-sessions/{work_session_id}/end", headers=worker_headers)
    check("POST /worker/work-sessions/{id}/end", r.status_code == 200 and r.json().get("status") == "COMPLETED", r.text)

    # ------------------------------------------------------------------
    # 5. Worker 기록/알림
    # ------------------------------------------------------------------
    r = session.get(f"{BASE_URL}/worker/records?type=all&page=1&size=20", headers=worker_headers)
    check("GET /worker/records", r.status_code == 200 and "items" in r.json(), r.text)

    r = session.get(f"{BASE_URL}/worker/notifications", headers=worker_headers)
    check("GET /worker/notifications", r.status_code == 200 and "unreadCount" in r.json(), r.text)

    r = session.get(f"{BASE_URL}/worker/notification-settings", headers=worker_headers)
    check("GET /worker/notification-settings", r.status_code == 200, r.text)

    # ------------------------------------------------------------------
    # 6. Admin — dashboard / workers / alerts / settings / sites
    # ------------------------------------------------------------------
    r = session.get(f"{BASE_URL}/admin/dashboard", headers=admin_headers)
    check("GET /admin/dashboard", r.status_code == 200 and "metrics" in r.json(), r.text)

    r = session.get(f"{BASE_URL}/admin/workers", headers=admin_headers)
    check("GET /admin/workers", r.status_code == 200 and "items" in r.json(), r.text)
    worker_display_id = None
    for item in r.json().get("items", []):
        if item.get("employeeCode") == "HB-W001":
            worker_display_id = item["id"]

    check("worker HB-W001 visible to admin", worker_display_id is not None)

    if worker_display_id is not None:
        r = session.get(f"{BASE_URL}/admin/workers/{worker_display_id}", headers=admin_headers)
        check("GET /admin/workers/{id}", r.status_code == 200, r.text)

        r = session.post(
            f"{BASE_URL}/admin/workers/{worker_display_id}/rest-alert",
            headers=admin_headers,
            json={"message": "스모크 테스트 알림", "reason": "MANUAL_ADMIN_REQUEST"},
        )
        check("POST /admin/workers/{id}/rest-alert", r.status_code == 201, r.text)

        # 방금 보낸 알림이 worker 알림함에 실제로 들어갔는지 -> DB round-trip 검증
        r = session.get(f"{BASE_URL}/worker/notifications", headers=worker_headers)
        titles = [n["title"] for n in r.json().get("items", [])]
        check("admin rest-alert가 worker notifications에 실제로 반영됨", "관리자 휴식 권고" in titles)

    r = session.get(f"{BASE_URL}/admin/alerts", headers=admin_headers)
    check("GET /admin/alerts", r.status_code == 200 and "items" in r.json(), r.text)

    r = session.get(f"{BASE_URL}/admin/settings", headers=admin_headers)
    check("GET /admin/settings", r.status_code == 200, r.text)

    r = session.get(f"{BASE_URL}/sites", headers=admin_headers)
    check("GET /sites", r.status_code == 200 and "items" in r.json(), r.text)

    # ------------------------------------------------------------------
    # 7. 권한 체크 — worker가 admin API를 부르면 막히는지
    # ------------------------------------------------------------------
    r = session.get(f"{BASE_URL}/admin/dashboard", headers=worker_headers)
    check("worker가 admin API 호출 -> 403", r.status_code == 403, r.text)

    # ------------------------------------------------------------------
    # 결과 요약
    # ------------------------------------------------------------------
    total = len(results)
    passed = sum(1 for _, ok, _ in results if ok)
    print(f"\n{passed}/{total} 통과")
    if passed != total:
        print("\n실패한 항목:")
        for name, ok, detail in results:
            if not ok:
                print(f"  - {name}: {detail}")
        sys.exit(1)


if __name__ == "__main__":
    main()
