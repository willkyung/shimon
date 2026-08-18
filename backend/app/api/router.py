from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from backend.app.api.routes import auth_router, users_router, work_sessions_router


class HealthData(BaseModel):
    status: Literal["ok"]


class HealthResponse(BaseModel):
    success: Literal[True]
    data: HealthData


api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(work_sessions_router)


@api_router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(success=True, data=HealthData(status="ok"))
