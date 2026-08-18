from collections.abc import Callable
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.app.core.database import get_db
from backend.app.core.errors import ApiError
from backend.app.core.security import decode_access_token
from backend.app.models import User, WorkerProfile
from backend.app.models.enums import UserRole


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise ApiError(401, "INVALID_CREDENTIALS", "Authentication is required.")

    try:
        payload = decode_access_token(credentials.credentials)
        subject = payload.get("sub")
        token_role = payload.get("role")
        if not isinstance(subject, str) or not isinstance(token_role, str):
            raise jwt.InvalidTokenError
        user_id = UUID(subject)
    except (jwt.PyJWTError, ValueError) as exc:
        raise ApiError(401, "INVALID_CREDENTIALS", "Invalid or expired token.") from exc

    user = db.scalar(
        select(User)
        .options(
            selectinload(User.worker_profile).selectinload(
                WorkerProfile.assigned_site
            )
        )
        .where(User.id == user_id)
    )
    if user is None or not user.is_active or user.role.value != token_role:
        raise ApiError(401, "INVALID_CREDENTIALS", "Invalid or expired token.")
    return user


def require_role(*allowed_roles: UserRole) -> Callable[..., User]:
    def role_dependency(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in allowed_roles:
            raise ApiError(403, "FORBIDDEN", "You do not have permission to proceed.")
        return current_user

    return role_dependency
