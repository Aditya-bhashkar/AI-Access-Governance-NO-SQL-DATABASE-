"""
Security utilities.

Responsibilities:
- Password hashing and verification
- JWT access-token creation
- JWT access-token decoding and validation
"""

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


_BCRYPT_MAX_BYTES = 72


def hash_password(plain_password: str) -> str:
    """
    Return a bcrypt hash of plain_password.

    bcrypt only supports passwords up to 72 bytes.
    Passwords longer than that are safely truncated to
    maintain compatibility with bcrypt.
    """

    password_bytes = plain_password.encode(
        "utf-8"
    )[:_BCRYPT_MAX_BYTES]

    hashed = bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt(),
    )

    return hashed.decode("utf-8")


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    """
    Return True if plain_password matches hashed_password.
    """

    password_bytes = plain_password.encode(
        "utf-8"
    )[:_BCRYPT_MAX_BYTES]

    hashed_bytes = hashed_password.encode(
        "utf-8"
    )

    try:
        return bcrypt.checkpw(
            password_bytes,
            hashed_bytes,
        )
    except (ValueError, TypeError):
        return False


def create_access_token(
    subject: Any,
    expires_delta: timedelta | None = None,
    additional_claims: dict[str, Any] | None = None,
) -> str:
    """
    Create and return a JWT access token.

    Args:
        subject:
            Unique identifier of the authenticated user.

        expires_delta:
            Optional token lifetime.

        additional_claims:
            Optional additional JWT claims such as:
            - role
            - email

    Returns:
        Encoded JWT access token.
    """

    now = datetime.now(
        tz=timezone.utc
    )

    expire = now + (
        expires_delta
        or timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    payload: dict[str, Any] = {
        "sub": str(subject),
        "exp": expire,
        "iat": now,
    }

    # ---------------------------------------------------------
    # Add optional claims.
    #
    # These are used by the RBAC layer to identify the
    # authenticated user's role.
    # ---------------------------------------------------------
    if additional_claims:
        payload.update(additional_claims)

    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def decode_access_token(
    token: str,
) -> dict[str, Any] | None:
    """
    Decode and validate a JWT access token.

    Returns:
        Decoded JWT payload when valid.
        None when the token is invalid or expired.
    """

    try:
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

    except JWTError:
        return None