from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError

from backend.app.api.router import api_router
from backend.app.core.errors import ApiError, api_error_handler, validation_error_handler


app = FastAPI(title="SHIMON API")
app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_router)
