from fastapi import FastAPI

from backend.app.api.router import api_router


app = FastAPI(title="SHIMON API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_router)
