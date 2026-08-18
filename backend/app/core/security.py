from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from backend.app.core.config import get_settings
from backend.app.models.enums import UserRole


ALGORITHM = "HS256"
password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except (InvalidHashError, VerificationError, VerifyMismatchError):
        return False


def _jwt_secret() -> str:
    secret = get_settings().jwt_secret
    if secret is None or not secret.get_secret_value():
        raise RuntimeError("JWT_SECRET must be configured before issuing tokens.")
    secret_value = secret.get_secret_value()
    if len(secret_value) < 32:
        raise RuntimeError("JWT_SECRET must contain at least 32 characters.")
    return secret_value


def create_access_token(user_id: UUID, role: UserRole) -> str:
    settings = get_settings()
    expires_at = datetime.now(UTC) + timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )
    return jwt.encode(
        {"sub": str(user_id), "role": role.value, "exp": expires_at},
        _jwt_secret(),
        algorithm=ALGORITHM,
    )


def decode_access_token(token: str) -> dict[str, object]:
    return jwt.decode(token, _jwt_secret(), algorithms=[ALGORITHM])
