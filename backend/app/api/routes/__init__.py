from backend.app.api.routes.admin import router as admin_router
from backend.app.api.routes.auth import router as auth_router
from backend.app.api.routes.users import router as users_router
from backend.app.api.routes.work_sessions import router as work_sessions_router

__all__ = ["admin_router", "auth_router", "users_router", "work_sessions_router"]
