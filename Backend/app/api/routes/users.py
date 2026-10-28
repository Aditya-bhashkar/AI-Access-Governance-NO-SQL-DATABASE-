"""
User management routes.

Endpoints:
- GET    /users/me                  own profile
- GET    /users                     list users          (admin, superadmin)
- POST   /users/admin               create an admin     (superadmin)
- GET    /users/{user_id}           user details
- PATCH  /users/{user_id}           update name / email
- PATCH  /users/{user_id}/status    activate / deactivate (admin, superadmin)
- PATCH  /users/{user_id}/role      change role         (superadmin)
- DELETE /users/{user_id}           delete user         (admin, superadmin)

Route-level dependencies give a fast, coarse 403. The real rules (who may
touch whom) are enforced again in UserManagementService using
app.core.permissions, so a mistake in one layer cannot open a hole.

Authorization:
- user       -> own profile only
- admin      -> normal users only
- superadmin -> normal users and admins (superadmin accounts are protected)
"""

from typing import NoReturn, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.dependencies import (
    AdminUser,
    CurrentUser,
    Database,
    SuperAdminUser,
)
from app.schemas.user import (
    AdminCreate,
    ManagedUserResponse,
    UserProfileUpdate,
    UserRole,
    UserRoleUpdate,
    UserStatusUpdate,
)
from app.services.user_service import (
    UserConflictError,
    UserManagementService,
    UserNotFoundError,
    UserPermissionError,
    UserValidationError,
)
from app.utils.response import ok


router = APIRouter(
    prefix="/users",
    tags=["User Management"],
)


# ============================================================
# Helpers
# ============================================================

def _raise_http(exc: Exception) -> NoReturn:
    """Translate service errors into HTTP errors."""

    if isinstance(exc, UserNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )

    if isinstance(exc, UserPermissionError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )

    if isinstance(exc, UserConflictError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    if isinstance(exc, UserValidationError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    raise exc


def _serialize(user: dict) -> dict:
    """Validate through the response schema (drops unknown fields)."""

    return ManagedUserResponse.model_validate(
        user
    ).model_dump()


# ============================================================
# Own profile
# ============================================================

@router.get(
    "/me",
    summary="Get the authenticated user's profile",
)
async def get_my_profile(
    db: Database,
    current_user: CurrentUser,
) -> dict:
    service = UserManagementService(db)

    try:
        user = await service.get_me(
            current_user
        )
    except Exception as exc:
        _raise_http(exc)

    return ok(
        data=_serialize(user),
        message="Profile retrieved.",
    )


# ============================================================
# List
# ============================================================

@router.get(
    "",
    summary="List users",
    description=(
        "Admins see normal users. Superadmins see everyone and may "
        "filter by role. Password data is never returned."
    ),
)
async def list_users(
    db: Database,
    current_user: AdminUser,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: Optional[str] = Query(
        default=None,
        max_length=100,
        description="Match on name or email.",
    ),
    role: Optional[UserRole] = Query(
        default=None,
        description="Filter by role.",
    ),
    is_active: Optional[bool] = Query(
        default=None,
        description="Filter by account status.",
    ),
) -> dict:
    service = UserManagementService(db)

    try:
        users, total = await service.list_users(
            actor=current_user,
            page=page,
            limit=limit,
            search=search,
            role=role,
            is_active=is_active,
        )
    except Exception as exc:
        _raise_http(exc)

    return ok(
        data=[_serialize(user) for user in users],
        message=f"{total} user(s) found.",
        page=page,
        limit=limit,
        total=total,
    )


# ============================================================
# Create admin (superadmin only)
# ============================================================

@router.post(
    "/admin",
    status_code=status.HTTP_201_CREATED,
    summary="Create an admin account (superadmin only)",
)
async def create_admin(
    payload: AdminCreate,
    db: Database,
    current_user: SuperAdminUser,
) -> dict:
    service = UserManagementService(db)

    try:
        user = await service.create_admin(
            actor=current_user,
            data=payload,
        )
    except Exception as exc:
        _raise_http(exc)

    return ok(
        data=_serialize(user),
        message="Admin account created successfully.",
    )


# ============================================================
# Details
# ============================================================

@router.get(
    "/{user_id}",
    summary="Get a user",
)
async def get_user(
    user_id: str,
    db: Database,
    current_user: CurrentUser,
) -> dict:
    service = UserManagementService(db)

    try:
        user = await service.get_user(
            actor=current_user,
            user_id=user_id,
        )
    except Exception as exc:
        _raise_http(exc)

    return ok(
        data=_serialize(user),
        message="User retrieved.",
    )


# ============================================================
# Update profile
# ============================================================

@router.patch(
    "/{user_id}",
    summary="Update a user's name / email",
    description=(
        "Only `name` and `email` are accepted. Role, status and "
        "password have dedicated operations and are rejected here."
    ),
)
async def update_user(
    user_id: str,
    payload: UserProfileUpdate,
    db: Database,
    current_user: CurrentUser,
) -> dict:
    service = UserManagementService(db)

    try:
        user = await service.update_profile(
            actor=current_user,
            user_id=user_id,
            data=payload,
        )
    except Exception as exc:
        _raise_http(exc)

    return ok(
        data=_serialize(user),
        message="User updated successfully.",
    )


# ============================================================
# Activate / deactivate
# ============================================================

@router.patch(
    "/{user_id}/status",
    summary="Activate or deactivate a user",
)
async def update_user_status(
    user_id: str,
    payload: UserStatusUpdate,
    db: Database,
    current_user: AdminUser,
) -> dict:
    service = UserManagementService(db)

    try:
        user = await service.update_status(
            actor=current_user,
            user_id=user_id,
            is_active=payload.is_active,
        )
    except Exception as exc:
        _raise_http(exc)

    return ok(
        data=_serialize(user),
        message=(
            "User activated."
            if payload.is_active
            else "User deactivated."
        ),
    )


# ============================================================
# Role management (superadmin only)
# ============================================================

@router.patch(
    "/{user_id}/role",
    summary="Change a user's role (superadmin only)",
)
async def update_user_role(
    user_id: str,
    payload: UserRoleUpdate,
    db: Database,
    current_user: SuperAdminUser,
) -> dict:
    service = UserManagementService(db)

    try:
        user = await service.update_role(
            actor=current_user,
            user_id=user_id,
            new_role=payload.role,
        )
    except Exception as exc:
        _raise_http(exc)

    return ok(
        data=_serialize(user),
        message="User role updated.",
    )


# ============================================================
# Delete
# ============================================================

@router.delete(
    "/{user_id}",
    summary="Delete a user",
)
async def delete_user(
    user_id: str,
    db: Database,
    current_user: AdminUser,
) -> dict:
    service = UserManagementService(db)

    try:
        result = await service.delete_user(
            actor=current_user,
            user_id=user_id,
        )
    except Exception as exc:
        _raise_http(exc)

    return ok(
        data=result,
        message="User deleted successfully.",
    )
