from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        field: str | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.field = field
        super().__init__(message)


def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    error = {"code": exc.code, "message": exc.message}
    if exc.field is not None:
        error["field"] = exc.field
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": error,
        },
    )


def validation_error_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    details = []
    for validation_error in exc.errors():
        location = [
            str(part) for part in validation_error.get("loc", ()) if part != "body"
        ]
        details.append(
            {
                "field": ".".join(location),
                "message": validation_error.get("msg", "Invalid value."),
            }
        )
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed.",
                "details": details,
            },
        },
    )
