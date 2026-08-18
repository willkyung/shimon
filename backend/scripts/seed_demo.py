from decimal import Decimal

from sqlalchemy import func, select

from backend.app.core.database import SessionLocal
from backend.app.models import Company, WorkSite


DEMO_COMPANY_CODE = "EST-2026"
DEMO_COMPANY_NAME = "SHIMON Demo Company"
DEMO_SITE_NAME = "SHIMON Demo Construction Site"
DEMO_LATITUDE = Decimal("37.497900")
DEMO_LONGITUDE = Decimal("127.027600")


def seed_demo() -> tuple[Company, WorkSite]:
    with SessionLocal.begin() as db:
        company = db.scalar(
            select(Company).where(Company.code == DEMO_COMPANY_CODE)
        )
        if company is None:
            company = Company(code=DEMO_COMPANY_CODE, name=DEMO_COMPANY_NAME)
            db.add(company)
            db.flush()
        else:
            company.name = DEMO_COMPANY_NAME

        site = db.scalar(
            select(WorkSite).where(
                WorkSite.company_id == company.id,
                WorkSite.name == DEMO_SITE_NAME,
            )
        )
        if site is None:
            site = WorkSite(
                company_id=company.id,
                name=DEMO_SITE_NAME,
                latitude=DEMO_LATITUDE,
                longitude=DEMO_LONGITUDE,
                timezone="Asia/Seoul",
            )
            db.add(site)
            db.flush()
        else:
            site.latitude = DEMO_LATITUDE
            site.longitude = DEMO_LONGITUDE
            site.timezone = "Asia/Seoul"
            site.is_active = True

        company_count = db.scalar(
            select(func.count()).select_from(Company).where(
                Company.code == DEMO_COMPANY_CODE
            )
        )
        site_count = db.scalar(
            select(func.count()).select_from(WorkSite).where(
                WorkSite.company_id == company.id,
                WorkSite.name == DEMO_SITE_NAME,
            )
        )
        if company_count != 1 or site_count != 1:
            raise RuntimeError("Demo seed uniqueness invariant failed.")

        print(f"company_id={company.id} company_count={company_count}")
        print(f"site_id={site.id} site_count={site_count}")
        return company, site


if __name__ == "__main__":
    seed_demo()
