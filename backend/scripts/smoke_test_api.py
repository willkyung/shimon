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
    # 4. Worker 핵심 플로우(팀원의 work_sessions.py 기준) — 작업 시작 -> AI/컴플라이언스
    #    평가 -> 휴식 시작 -> 휴식 종료(자동으로 다음 세션 시작됨) -> 작업 종료
    # ------------------------------------------------------------------
    r = session.get(f"{BASE_URL}/me/work-session/current", headers=worker_headers)
    check("GET /me/work-session/current", r.status_code == 200, r.text)
    existing = (r.json() or {}).get("data")
    if existing:
        session.post(f"{BASE_URL}/work-sessions/{existing['id']}/end", headers=worker_headers)

    import subprocess
    site_id = subprocess.run(
        ["docker", "exec", "shimon-postgres", "psql", "-U", "postgres", "-d", "shimon", "-t", "-c",
         "SELECT wp.assigned_site_id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.employee_code = 'HB-W001';"],
        capture_output=True, text=True,
    ).stdout.strip()
    check("resolved worker's assigned_site_id from DB", bool(site_id), site_id)

    r = session.post(f"{BASE_URL}/work-sessions", headers=worker_headers, json={
        "siteId": site_id, "workType": "토목 작업", "workIntensity": "MEDIUM",
        "clothingLevel": "STANDARD", "environment": "OUTDOOR",
    })
    check("POST /work-sessions", r.status_code == 201, r.text)
    work_session_id = r.json().get("data", {}).get("id")
    ai_block = r.json().get("data", {}).get("latestEvaluation", {}).get("ai")
    check("work session start includes AI evaluation (XGBoost 연동 확인)", ai_block is not None, r.text)

    r = session.post(f"{BASE_URL}/work-sessions/{work_session_id}/evaluate", headers=worker_headers)
    check(
        "POST /work-sessions/{id}/evaluate returns ai.riskLevel",
        r.status_code == 200 and r.json().get("data", {}).get("ai", {}).get("riskLevel") in ("NORMAL", "CAUTION", "HIGH"),
        r.text,
    )

    r = session.post(f"{BASE_URL}/work-sessions/{work_session_id}/rests/start", headers=worker_headers)
    check("POST /work-sessions/{id}/rests/start", r.status_code == 201, r.text)
    rest_id = r.json().get("data", {}).get("restId")

    r = session.post(f"{BASE_URL}/rests/{rest_id}/end", headers=worker_headers)
    check(
        "POST /rests/{id}/end (다음 작업세션 자동 시작 + AI 재평가)",
        r.status_code == 200 and r.json().get("data", {}).get("evaluation", {}).get("ai") is not None,
        r.text,
    )
    resumed_session_id = r.json().get("data", {}).get("workSessionId")

    r = session.post(f"{BASE_URL}/work-sessions/{resumed_session_id}/end", headers=worker_headers)
    check("POST /work-sessions/{id}/end", r.status_code == 200, r.text)

    # ------------------------------------------------------------------
    # 5. Worker 기록 (알림 조회 API는 현재 없음 - admin.py가 만드는 Notification을
    #    worker가 직접 조회하는 엔드포인트는 아직 없어서 DB로 직접 확인한다. 아래 참고)
    # ------------------------------------------------------------------
    r = session.get(f"{BASE_URL}/me/work-sessions", headers=worker_headers)
    check("GET /me/work-sessions", r.status_code == 200 and "data" in r.json(), r.text)

    r = session.get(f"{BASE_URL}/me/rest-records", headers=worker_headers)
    check("GET /me/rest-records", r.status_code == 200 and "data" in r.json(), r.text)

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

        # 방금 보낸 알림이 DB에 실제로 들어갔는지 확인 (worker가 직접 조회하는 API는 아직 없음)
        import subprocess
        latest_title = subprocess.run(
            ["docker", "exec", "shimon-postgres", "psql", "-U", "postgres", "-d", "shimon", "-t", "-c",
             "SELECT title FROM notifications ORDER BY created_at DESC LIMIT 1;"],
            capture_output=True, text=True,
        ).stdout.strip()
        check("admin rest-alert가 DB notifications 테이블에 실제로 반영됨", latest_title == "관리자 휴식 권고", latest_title)

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
