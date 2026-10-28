"""
Dependency injection for FastAPI routes.

Provides:
- Database dependency
- Current authenticated user dependency
- Role-based authorization dependencies

Roles:
- user
- admin
- superadmin
"""

from typing import Annotated, Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.permissions import normalize_role
from app.core.security import decode_access_token
from app.db.database import get_database
from app.repositories.user_repository import UserRepository


# ============================================================
# HTTP Bearer authentication
# ============================================================

security = HTTPBearer(
    auto_error=True,
)


# ============================================================
# Role normalization
# ============================================================

def _normalize_role(role: str | None) -> str:
    """
    Normalize a user role.

    Delegates to the centralized policy in app.core.permissions:

        super_admin -> superadmin
        unknown     -> user (fail closed)
    """

    return normalize_role(role)


# ============================================================
# Current authenticated user
# ============================================================

async def get_current_user(
    db: AsyncIOMotorDatabase = Depends(
        get_database
    ),
    credentials: HTTPAuthorizationCredentials = Depends(
        security
    ),
) -> dict:
    """
    Extract and validate the current user from the JWT.

    Authentication flow:

        Authorization header
                ↓
             JWT token
                ↓
        decode_access_token()
                ↓
          user ID from `sub`
                ↓
          MongoDB user lookup
                ↓
       latest role from database
                ↓
        authenticated user

    The user's role is deliberately fetched from MongoDB
    rather than trusted from the JWT. This means an admin
    whose role is later changed to user will immediately lose
    admin privileges without requiring a new token.

    The account must also be active. A deactivated account is
    rejected on every request, so deactivation takes effect
    immediately even if the user still holds a valid token.

    Raises:
        401: Missing, invalid, or expired token, or the user no
             longer exists.
        403: Account has been deactivated.

    Returns:
        Current user document (never contains password data).
    """

    token = credentials.credentials

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    # --------------------------------------------------------
    # Decode JWT
    # --------------------------------------------------------

    payload = decode_access_token(
        token
    )

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    # --------------------------------------------------------
    # Extract authenticated user ID
    # --------------------------------------------------------

    user_id = payload.get(
        "sub"
    )

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    # --------------------------------------------------------
    # Fetch latest user document from MongoDB
    # --------------------------------------------------------

    user_repo = UserRepository(
        db
    )

    user = await user_repo.get_by_id(
        user_id
    )

    if not user:
        # The token is syntactically valid but its subject no longer
        # exists (for example the account was deleted).
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    # --------------------------------------------------------
    # Disabled accounts cannot use protected resources
    # --------------------------------------------------------

    if user.get("is_active", True) is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your account has been deactivated. "
                "Contact an administrator."
            ),
        )

    # --------------------------------------------------------
    # Normalize role (always from the database, never the JWT)
    # --------------------------------------------------------

    user["role"] = _normalize_role(
        user.get("role")
    )

    # --------------------------------------------------------
    # Never carry credential data around inside request handlers
    # --------------------------------------------------------

    user.pop("hashed_password", None)
    user.pop("password", None)

    user["id"] = str(user["_id"])

    return user


# ============================================================
# Type alias for current authenticated user
# ============================================================

CurrentUser = Annotated[
    dict,
    Depends(
        get_current_user
    ),
]


# ============================================================
# Database dependency
# ============================================================

Database = Annotated[
    AsyncIOMotorDatabase,
    Depends(
        get_database
    ),
]


# ============================================================
# Role authorization helper
# ============================================================

def require_roles(
    *allowed_roles: str,
) -> Callable:
    """
    Create a FastAPI dependency that allows only users
    with one of the specified roles.

    Example:

        AdminUser = Annotated[
            dict,
            Depends(
                require_roles(
                    "admin",
                    "superadmin",
                )
            ),
        ]
    """

    normalized_allowed_roles = {
        _normalize_role(role)
        for role in allowed_roles
    }

    async def role_checker(
        current_user: CurrentUser,
    ) -> dict:
        """
        Verify that the authenticated user has an
        allowed role.
        """

        role = _normalize_role(
            current_user.get("role")
        )

        if role not in normalized_allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You do not have permission "
                    "to perform this action"
                ),
            )

        return current_user

    return role_checker


# ============================================================
# Reusable RBAC dependencies
# ============================================================

# Admin OR Superadmin
AdminUser = Annotated[
    dict,
    Depends(
        require_roles(
            "admin",
            "superadmin",
        )
    ),
]


# Superadmin only
SuperAdminUser = Annotated[
    dict,
    Depends(
        require_roles(
            "superadmin",
        )
    ),
]


# Regular user only
RegularUser = Annotated[
    dict,
    Depends(
        require_roles(
            "user",
        )
    ),
]