from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from backend.app.core.config import get_settings
from backend.app.models.enums import UserRole


ALGORITHM = "HS256"
password_hasher = PasswordHasher()

REFRESH_TOKEN_EXPIRE_MINUTES = 14 * 24 * 60  # 14일
VERIFICATION_TOKEN_EXPIRE_SECONDS = 600  # 10분, POST /auth/verify-employee 응답의 expiresIn과 일치


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
        {"sub": str(user_id), "role": role.value, "type": "access", "exp": expires_at},
        _jwt_secret(),
        algorithm=ALGORITHM,
    )


def decode_access_token(token: str) -> dict[str, object]:
    payload = jwt.decode(token, _jwt_secret(), algorithms=[ALGORITHM])
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Not an access token.")
    return payload


def create_refresh_token(user_id: UUID) -> str:
    expires_at = datetime.now(UTC) + timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(user_id), "type": "refresh", "exp": expires_at},
        _jwt_secret(),
        algorithm=ALGORITHM,
    )


def decode_refresh_token(token: str) -> dict[str, object]:
    payload = jwt.decode(token, _jwt_secret(), algorithms=[ALGORITHM])
    if payload.get("type") != "refresh":
        raise jwt.InvalidTokenError("Not a refresh token.")
    return payload


def create_verification_token(roster_id: UUID) -> str:
    """
    verify-employee 통과 직후 짧게만 유효한 토큰. signup이 이 토큰을 다시 검증해서
    "정말 verify-employee를 거쳤는지"를 확인하고, roster_id로 등록 정보를 가져온다.
    """
    expires_at = datetime.now(UTC) + timedelta(seconds=VERIFICATION_TOKEN_EXPIRE_SECONDS)
    return jwt.encode(
        {"roster_id": str(roster_id), "type": "verification", "exp": expires_at},
        _jwt_secret(),
        algorithm=ALGORITHM,
    )


def decode_verification_token(token: str) -> dict[str, object]:
    payload = jwt.decode(token, _jwt_secret(), algorithms=[ALGORITHM])
    if payload.get("type") != "verification":
        raise jwt.InvalidTokenError("Not a verification token.")
    return payload
