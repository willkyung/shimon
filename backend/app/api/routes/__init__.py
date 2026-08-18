from backend.app.api.routes.admin import router as admin_router
from backend.app.api.routes.auth import router as auth_router
from backend.app.api.routes.users import router as users_router
from backend.app.api.routes.worker import router as worker_router

__all__ = ["admin_router", "auth_router", "users_router", "worker_router"]
