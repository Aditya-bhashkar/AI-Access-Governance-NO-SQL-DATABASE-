"""
User management service.

Responsibilities:
- List / view users according to the actor's role
- Update profile fields (name, email)
- Activate / deactivate accounts
- Change roles (superadmin only)
- Create admin accounts (superadmin only)
- Delete accounts
- Audit every security-sensitive operation

All authorization decisions come from app.core.permissions, which is the
single place where the role rules live. This service never compares role
strings itself.

Errors are raised as the small exception classes below; the route layer
maps them to HTTP status codes:

    UserNotFoundError    -> 404
    UserPermissionError  -> 403
    UserConflictError    -> 409
    UserValidationError  -> 400
"""

from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.core.permissions import (
    ASSIGNABLE_ROLES,
    ROLE_ADMIN,
    ROLE_SUPERADMIN,
    ROLE_USER,
    can_change_role,
    can_change_status,
    can_create_admin,
    can_delete_user,
    can_list_users,
    can_update_profile,
    can_view_user,
    denial_reason,
    get_user_id,
    normalize_role,
    permissions_for,
)
from app.core.security import hash_password
from app.repositories.user_repository import UserRepository
from app.schemas.user import (
    AdminCreate,
    UserCreate,
    UserProfileUpdate,
)
from app.services.audit_service import AuditService


# ============================================================
# Errors
# ============================================================

class UserNotFoundError(Exception):
    """User does not exist (or is intentionally hidden)."""


class UserPermissionError(Exception):
    """Authenticated but not allowed."""


class UserConflictError(Exception):
    """Duplicate / conflicting resource (e.g. email)."""


class UserValidationError(Exception):
    """Request is well-formed but not acceptable."""


# ============================================================
# Service
# ============================================================

class UserManagementService:
    """Business logic for user / admin management."""

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
    ):
        self.db = db
        self.user_repo = UserRepository(db)
        self.audit = AuditService(db)

    # ============================================================
    # Helpers
    # ============================================================

    @staticmethod
    def _actor_id(actor: dict) -> str:
        actor_id = get_user_id(actor)

        if not actor_id:
            # Fail closed.
            raise UserPermissionError(
                "Authenticated user ID is missing."
            )

        return actor_id

    def _present(
        self,
        actor: dict,
        user: dict,
    ) -> dict:
        """
        Safe representation of `user` for `actor`:
        no password data + the actor's permissions on this row.
        """

        public = UserRepository.to_public(user)

        public["permissions"] = permissions_for(
            actor,
            user,
        )

        return public

    async def _get_or_404(
        self,
        user_id: str,
    ) -> dict:
        user = await self.user_repo.get_by_id(
            user_id
        )

        if not user:
            raise UserNotFoundError(
                "User not found."
            )

        return user

    @staticmethod
    def _status_value(user: dict) -> bool:
        return user.get("is_active", True) is not False

    # ============================================================
    # Read
    # ============================================================

    async def get_me(
        self,
        actor: dict,
    ) -> dict:
        """The authenticated user's own profile."""

        self._actor_id(actor)

        return self._present(
            actor,
            actor,
        )

    async def list_users(
        self,
        actor: dict,
        page: int = 1,
        limit: int = 10,
        search: Optional[str] = None,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> tuple[list[dict], int]:
        """
        List users.

        admin       -> normal users only
        superadmin  -> everyone (optionally filtered by role)
        user        -> forbidden
        """

        self._actor_id(actor)

        if not can_list_users(actor):
            raise UserPermissionError(
                "You do not have permission to view users."
            )

        actor_role = normalize_role(
            actor.get("role")
        )

        effective_role = role

        if actor_role != ROLE_SUPERADMIN:
            # Admins only ever see normal users.
            if role not in (None, ROLE_USER):
                raise UserPermissionError(
                    "You do not have permission to view "
                    "these accounts."
                )

            effective_role = ROLE_USER

        skip = max(0, (page - 1) * limit)

        users = await self.user_repo.get_all_users(
            role=effective_role,
            is_active=is_active,
            search=search,
            skip=skip,
            limit=limit,
        )

        total = await self.user_repo.count_users(
            role=effective_role,
            is_active=is_active,
            search=search,
        )

        return (
            [
                self._present(actor, user)
                for user in users
            ],
            total,
        )

    async def get_user(
        self,
        actor: dict,
        user_id: str,
    ) -> dict:
        """
        View one user.

        Accounts the actor is not allowed to view are reported as
        "not found" so their existence is not revealed.
        """

        self._actor_id(actor)

        user = await self.user_repo.get_by_id(
            user_id
        )

        if not user or not can_view_user(
            actor,
            user,
        ):
            raise UserNotFoundError(
                "User not found."
            )

        return self._present(
            actor,
            user,
        )

    # ============================================================
    # Update profile (name / email)
    # ============================================================

    async def update_profile(
        self,
        actor: dict,
        user_id: str,
        data: UserProfileUpdate,
    ) -> dict:
        actor_id = self._actor_id(actor)

        target = await self._get_or_404(
            user_id
        )

        if not can_update_profile(
            actor,
            target,
        ):
            raise UserPermissionError(
                denial_reason(
                    actor,
                    target,
                    "update",
                )
            )

        requested = data.model_dump(
            exclude_unset=True,
            exclude_none=True,
        )

        if not requested:
            raise UserValidationError(
                "No changes supplied."
            )

        changes: dict = {}

        if "name" in requested:
            name = requested["name"].strip()

            if not name:
                raise UserValidationError(
                    "Name cannot be empty."
                )

            if name != target.get("name"):
                changes["name"] = name

        if "email" in requested:
            email = requested["email"]

            if email != target.get("email"):
                if await self.user_repo.email_exists(
                    email,
                    exclude_user_id=get_user_id(target),
                ):
                    raise UserConflictError(
                        "Email is already registered."
                    )

                changes["email"] = email

        # Nothing actually changed.
        if not changes:
            return self._present(
                actor,
                target,
            )

        try:
            updated = await self.user_repo.update_profile(
                get_user_id(target),
                changes,
            )
        except DuplicateKeyError:
            raise UserConflictError(
                "Email is already registered."
            )

        if not updated:
            raise UserNotFoundError(
                "User not found."
            )

        await self.audit.log_user_event(
            action="USER_UPDATED",
            target_user_id=get_user_id(target),
            performed_by=actor_id,
            metadata={
                "target_email": updated.get("email"),
                "target_role": updated.get("role"),
                "changed_fields": sorted(
                    changes.keys()
                ),
                "self_update": actor_id
                == get_user_id(target),
            },
        )

        return self._present(
            actor,
            updated,
        )

    # ============================================================
    # Activate / deactivate
    # ============================================================

    async def update_status(
        self,
        actor: dict,
        user_id: str,
        is_active: bool,
    ) -> dict:
        actor_id = self._actor_id(actor)

        target = await self._get_or_404(
            user_id
        )

        if not can_change_status(
            actor,
            target,
        ):
            raise UserPermissionError(
                denial_reason(
                    actor,
                    target,
                    "change the status of",
                )
            )

        old_status = self._status_value(
            target
        )

        # Idempotent: nothing to do, nothing to audit.
        if old_status == is_active:
            return self._present(
                actor,
                target,
            )

        updated = await self.user_repo.update_status(
            get_user_id(target),
            is_active,
        )

        if not updated:
            raise UserNotFoundError(
                "User not found."
            )

        await self.audit.log_user_event(
            action=(
                "USER_ACTIVATED"
                if is_active
                else "USER_DEACTIVATED"
            ),
            target_user_id=get_user_id(target),
            performed_by=actor_id,
            metadata={
                "target_email": updated.get("email"),
                "target_role": updated.get("role"),
                "old_status": (
                    "active" if old_status else "inactive"
                ),
                "new_status": (
                    "active" if is_active else "inactive"
                ),
            },
        )

        return self._present(
            actor,
            updated,
        )

    # ============================================================
    # Role management
    # ============================================================

    async def update_role(
        self,
        actor: dict,
        user_id: str,
        new_role: str,
    ) -> dict:
        actor_id = self._actor_id(actor)

        target = await self._get_or_404(
            user_id
        )

        # Actor / target checks first (superadmin only, not self,
        # target must be user/admin).
        if not can_change_role(
            actor,
            target,
        ):
            raise UserPermissionError(
                denial_reason(
                    actor,
                    target,
                    "change the role of",
                )
            )

        # Only user/admin may be assigned. `superadmin` (and anything
        # invalid) is refused.
        if new_role not in ASSIGNABLE_ROLES:
            raise UserPermissionError(
                "This role cannot be assigned through the API."
            )

        old_role = normalize_role(
            target.get("role")
        )

        # user -> user / admin -> admin: allowed, nothing to change.
        if old_role == new_role:
            return self._present(
                actor,
                target,
            )

        updated = await self.user_repo.update_role(
            get_user_id(target),
            new_role,
        )

        if not updated:
            raise UserNotFoundError(
                "User not found."
            )

        base_metadata = {
            "target_email": updated.get("email"),
            "old_role": old_role,
            "new_role": new_role,
        }

        await self.audit.log_user_event(
            action="ROLE_CHANGED",
            target_user_id=get_user_id(target),
            performed_by=actor_id,
            metadata=base_metadata,
        )

        if (
            old_role == ROLE_ADMIN
            and new_role == ROLE_USER
        ):
            await self.audit.log_user_event(
                action="ADMIN_DEMOTED",
                target_user_id=get_user_id(target),
                performed_by=actor_id,
                metadata=base_metadata,
            )

        return self._present(
            actor,
            updated,
        )

    # ============================================================
    # Admin creation
    # ============================================================

    async def create_admin(
        self,
        actor: dict,
        data: AdminCreate,
    ) -> dict:
        actor_id = self._actor_id(actor)

        if not can_create_admin(actor):
            raise UserPermissionError(
                "Only a superadmin can create admin accounts."
            )

        if await self.user_repo.email_exists(
            data.email
        ):
            raise UserConflictError(
                "Email is already registered."
            )

        # The role is fixed by the backend; the client cannot choose.
        new_user = UserCreate(
            name=data.name.strip(),
            email=data.email,
            password=data.password,
            role=ROLE_ADMIN,
        )

        try:
            created = await self.user_repo.create(
                new_user,
                hash_password(data.password),
            )
        except DuplicateKeyError:
            raise UserConflictError(
                "Email is already registered."
            )

        await self.audit.log_user_event(
            action="ADMIN_CREATED",
            target_user_id=created["_id"],
            performed_by=actor_id,
            metadata={
                "target_email": created["email"],
                "role": ROLE_ADMIN,
            },
        )

        return self._present(
            actor,
            created,
        )

    # ============================================================
    # Delete
    # ============================================================

    async def delete_user(
        self,
        actor: dict,
        user_id: str,
    ) -> dict:
        """
        Delete a user account.

        API-access records created by the user are retained (they are
        organization assets); audit logs are retained as well.
        """

        actor_id = self._actor_id(actor)

        target = await self._get_or_404(
            user_id
        )

        if not can_delete_user(
            actor,
            target,
        ):
            raise UserPermissionError(
                denial_reason(
                    actor,
                    target,
                    "delete",
                )
            )

        deleted = await self.user_repo.delete(
            get_user_id(target)
        )

        if not deleted:
            raise UserNotFoundError(
                "User not found."
            )

        await self.audit.log_user_event(
            action="USER_DELETED",
            target_user_id=get_user_id(target),
            performed_by=actor_id,
            metadata={
                "target_email": target.get("email"),
                "target_role": normalize_role(
                    target.get("role")
                ),
                "target_status": (
                    "active"
                    if self._status_value(target)
                    else "inactive"
                ),
            },
        )

        return {
            "id": get_user_id(target),
        }
