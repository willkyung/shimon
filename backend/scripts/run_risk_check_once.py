"""
run_risk_check_once.py
------------------------
5분 스케줄러가 도는 걸 기다리지 않고, "현재 활성 세션 조회 -> AI 위험도 평가 -> DB 저장"
파이프라인을 즉시 한 번 실행해서 결과를 확인한다.
"""

from backend.app.core.risk_scheduler import _save_risk_assessment, get_active_work_sessions
from backend.app.services.risk_service import assess_worker_risk


def main() -> None:
    sessions = get_active_work_sessions()
    print(f"활성 작업 세션 수: {len(sessions)}")

    if not sessions:
        print("IN_PROGRESS 상태인 작업 세션이 없습니다. seed_active_session.py를 먼저 실행하세요.")
        return

    for session in sessions:
        result = assess_worker_risk(
            worker=session["worker"],
            site=session["site"],
            work_session=session,
        )
        _save_risk_assessment(session, result)
        print(f"\nworker_id={session['worker']['id']}")
        print(result)
        print("-> heat_risk_assessments / site_weather_logs에 저장 완료")


if __name__ == "__main__":
    main()
