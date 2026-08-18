"""
seed_employee_roster.py
-------------------------
Phase 1 인증(verify-employee) 테스트용 데모 직원 명단을 만든다.
실제로는 관리자가 직원을 등록하는 기능이 필요하지만, 해커톤 MVP라 이 스크립트로 대신한다.
"""

from sqlalchemy import select

from backend.app.core.database import SessionLocal
from backend.app.models import EmployeeRoster
from backend.app.models.enums import UserRole
from backend.scripts.seed_demo import seed_demo

DEMO_WORKER_CODE = "HB-W001"
DEMO_WORKER_NAME = "김철수"
DEMO_ADMIN_CODE = "HB-A001"
DEMO_ADMIN_NAME = "관리자"


def seed_employee_roster() -> None:
    company, site = seed_demo()

    with SessionLocal.begin() as db:
        worker_roster = db.scalar(
            select(EmployeeRoster).where(
                EmployeeRoster.employee_code == DEMO_WORKER_CODE
            )
        )
        if worker_roster is None:
            db.add(EmployeeRoster(
                company_id=company.id,
                employee_code=DEMO_WORKER_CODE,
                name=DEMO_WORKER_NAME,
                role=UserRole.WORKER,
                job_type="토목 작업",
                workplace_site_id=site.id,
            ))

        admin_roster = db.scalar(
            select(EmployeeRoster).where(
                EmployeeRoster.employee_code == DEMO_ADMIN_CODE
            )
        )
        if admin_roster is None:
            db.add(EmployeeRoster(
                company_id=company.id,
                employee_code=DEMO_ADMIN_CODE,
                name=DEMO_ADMIN_NAME,
                role=UserRole.ADMIN,
            ))

    print(f"직원 명단 준비 완료: {DEMO_WORKER_CODE}({DEMO_WORKER_NAME}), {DEMO_ADMIN_CODE}({DEMO_ADMIN_NAME})")


if __name__ == "__main__":
    seed_employee_roster()
