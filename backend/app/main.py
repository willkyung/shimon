from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.router import api_router
from backend.app.core.config import get_settings
from backend.app.core.errors import ApiError, api_error_handler, validation_error_handler


app = FastAPI(title="SHIMON API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_router)
