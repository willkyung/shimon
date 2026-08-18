from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel


class HealthData(BaseModel):
    status: Literal["ok"]


class HealthResponse(BaseModel):
    success: Literal[True]
    data: HealthData


api_router = APIRouter(prefix="/api/v1")


@api_router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(success=True, data=HealthData(status="ok"))
