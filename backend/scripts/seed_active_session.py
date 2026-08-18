"""
seed_active_session.py
-----------------------
risk_scheduler / risk_service 파이프라인을 테스트하기 위해,
"지금 45분째 작업 중인" 가상의 작업자 1명 + 진행 중인 WorkSession 1개를 만든다.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from backend.app.core.database import SessionLocal
from backend.app.models import User, WorkerProfile, WorkSession
from backend.app.models.enums import UserRole, WorkSessionStatus
from backend.scripts.seed_demo import seed_demo

DEMO_EMPLOYEE_CODE = "DEMO-001"


def seed_active_session() -> None:
    company, site = seed_demo()

    with SessionLocal.begin() as db:
        user = db.scalar(
            select(User).where(
                User.company_id == company.id,
                User.employee_code == DEMO_EMPLOYEE_CODE,
            )
        )
        if user is None:
            user = User(
                company_id=company.id,
                employee_code=DEMO_EMPLOYEE_CODE,
                email="demo.worker@example.com",
                password_hash="not-a-real-hash",
                name="테스트 작업자",
                role=UserRole.WORKER,
            )
            db.add(user)
            db.flush()

        profile = db.get(WorkerProfile, user.id)
        if profile is None:
            db.add(WorkerProfile(user_id=user.id, assigned_site_id=site.id, age=35))
        else:
            profile.age = 35
            profile.assigned_site_id = site.id

        existing_session = db.scalar(
            select(WorkSession).where(
                WorkSession.worker_id == user.id,
                WorkSession.status == WorkSessionStatus.IN_PROGRESS,
            )
        )
        if existing_session is None:
            db.add(WorkSession(
                worker_id=user.id,
                site_id=site.id,
                status=WorkSessionStatus.IN_PROGRESS,
                work_type="construction",
                work_intensity="MEDIUM",       # heat_features.WORK_INTENSITY_TO_GRADIENT 키와 일치해야 함
                clothing_level="NON_BREATHABLE",  # heat_features.CLOTHING_TO_CODE 키와 일치해야 함
                environment="outdoor",
                started_at=datetime.now(timezone.utc) - timedelta(minutes=45),
            ))

        db.flush()

    print(f"company_id={company.id}")
    print(f"site_id={site.id}")
    print(f"worker_id={user.id}")
    print("진행 중인(IN_PROGRESS) 작업 세션 준비 완료 (연속작업시간 약 45분)")


if __name__ == "__main__":
    seed_active_session()
