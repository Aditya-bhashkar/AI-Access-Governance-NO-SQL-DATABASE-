"""
Pydantic schemas for the User model.

Schemas are deliberately kept separate so that a request can never
accidentally carry security-sensitive fields into the wrong operation:

    UserRegister        public registration (NO role field)
    UserCreate          internal creation (role set by the backend)
    AdminCreate         superadmin creating an admin account
    UserProfileUpdate   name / email only        (extra fields rejected)
    UserStatusUpdate    is_active only           (extra fields rejected)
    UserRoleUpdate      role only                (extra fields rejected)
    UserResponse        safe public representation (no password data)
    ManagedUserResponse UserResponse + per-row permissions
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ============================================================
# Role definitions
# ============================================================

UserRole = Literal[
    "user",
    "admin",
    "superadmin",
]


# ============================================================
# Base User Schema
# ============================================================

class UserBase(BaseModel):
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Full name of the user.",
    )

    email: EmailStr = Field(
        ...,
        description="Unique email address.",
    )

    role: UserRole = Field(
        default="user",
        description="Role assigned to the user.",
    )


# ============================================================
# Public registration
# ============================================================

class UserRegister(BaseModel):
    """
    Body of POST /auth/register.

    There is intentionally NO `role` (or `is_active`) field here.
    Pydantic ignores unknown fields by default, so a client that sends
    {"role": "superadmin"} has it silently dropped before it can reach
    any service code.
    """

    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Full name of the user.",
    )

    email: EmailStr = Field(
        ...,
        description="Unique email address.",
    )

    password: str = Field(
        ...,
        min_length=8,
        description="Plain-text password (min 8 chars).",
    )


# ============================================================
# Internal user creation
# ============================================================

class UserCreate(UserBase):
    password: str = Field(
        ...,
        min_length=8,
        description="Plain-text password (min 8 chars).",
    )


# ============================================================
# Admin creation (superadmin only)
# ============================================================

class AdminCreate(BaseModel):
    """
    Body of POST /users/admin.

    The role is NOT accepted from the client; the backend always
    creates role="admin".
    """

    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
    )

    email: EmailStr

    password: str = Field(
        ...,
        min_length=8,
        description="Plain-text password (min 8 chars).",
    )


# ============================================================
# Profile update (NO role / status / password)
# ============================================================

class UserProfileUpdate(BaseModel):
    """
    Body of PATCH /users/{id}.

    Only profile fields are accepted. Any other field (role,
    is_active, password, hashed_password ...) is rejected with 422
    instead of being silently applied.
    """

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    email: EmailStr | None = None


# ============================================================
# Status update
# ============================================================

class UserStatusUpdate(BaseModel):
    """Body of PATCH /users/{id}/status."""

    model_config = ConfigDict(extra="forbid")

    is_active: bool


# ============================================================
# Role update
# ============================================================

class UserRoleUpdate(BaseModel):
    """Body of PATCH /users/{id}/role."""

    model_config = ConfigDict(extra="forbid")

    role: UserRole


# ============================================================
# Legacy update schema (kept for backward compatibility)
# ============================================================

class UserUpdate(BaseModel):
    """
    Kept so existing imports keep working.

    NOT used by any route. Use UserProfileUpdate, UserStatusUpdate
    or UserRoleUpdate instead.
    """

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    email: EmailStr | None = None

    role: UserRole | None = Field(
        default=None,
        description="Updated user role.",
    )

    password: str | None = Field(
        default=None,
        min_length=8,
    )


# ============================================================
# User Response
# ============================================================

class UserResponse(UserBase):
    """
    Safe user representation. Never contains password data.
    """

    id: str

    is_active: bool = True

    created_at: datetime

    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


class UserPermissions(BaseModel):
    """What the *current* actor may do to a given user row."""

    view: bool = False
    edit: bool = False
    change_status: bool = False
    change_role: bool = False
    delete: bool = False


class ManagedUserResponse(UserResponse):
    """UserResponse plus the actor's permissions on this user."""

    permissions: UserPermissions = Field(
        default_factory=UserPermissions
    )
