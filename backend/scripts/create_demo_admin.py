import os

from sqlalchemy import select

from backend.app.core.database import SessionLocal
from backend.app.core.security import hash_password
from backend.app.models import Company, User
from backend.app.models.enums import UserRole


DEMO_COMPANY_CODE = "EST-2026"
DEMO_ADMIN_EMPLOYEE_CODE = "A001"
DEMO_ADMIN_EMAIL = "admin@shimon.local"
DEMO_ADMIN_NAME = "SHIMON Admin"


def create_demo_admin() -> User:
    password = os.getenv("DEMO_ADMIN_PASSWORD", "")
    if len(password) < 8:
        raise RuntimeError("DEMO_ADMIN_PASSWORD must contain at least 8 characters.")

    with SessionLocal.begin() as db:
        company = db.scalar(
            select(Company).where(Company.code == DEMO_COMPANY_CODE)
        )
        if company is None:
            raise RuntimeError("Run backend.scripts.seed_demo before creating an admin.")

        admin = db.scalar(
            select(User).where(
                User.company_id == company.id,
                User.employee_code == DEMO_ADMIN_EMPLOYEE_CODE,
            )
        )
        if admin is None:
            admin = User(
                company_id=company.id,
                employee_code=DEMO_ADMIN_EMPLOYEE_CODE,
                email=DEMO_ADMIN_EMAIL,
                password_hash=hash_password(password),
                name=DEMO_ADMIN_NAME,
                role=UserRole.ADMIN,
            )
            db.add(admin)
            db.flush()
        elif admin.role != UserRole.ADMIN:
            raise RuntimeError("A001 already exists but is not an ADMIN account.")
        else:
            admin.password_hash = hash_password(password)

        print(f"admin_id={admin.id} employee_code={admin.employee_code}")
        return admin


if __name__ == "__main__":
    create_demo_admin()
