"""
User repository – MongoDB operations for the User model.

Responsibilities:
- Database queries
- User CRUD
- Role handling
- Account status handling
- Listing / searching users for user management
- Index usage for efficient lookups

Supported roles:
- user
- admin
- superadmin

Legacy role:
- super_admin -> superadmin
"""

import re
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.permissions import (
    LEGACY_SUPERADMIN_ROLES,
    ROLE_ADMIN,
    ROLE_SUPERADMIN,
    normalize_role,
)
from app.schemas.user import UserCreate


# Fields that must never leave the backend.
_SENSITIVE_FIELDS = (
    "hashed_password",
    "password",
)


class UserRepository:
    """Repository for User collection operations."""

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
    ):
        """
        Initialize repository with database instance.
        """

        self.db = db
        self.collection = db["users"]

    # ============================================================
    # Helpers
    # ============================================================

    @staticmethod
    def _normalize_role(
        role: str | None,
    ) -> str:
        """
        Normalize a user role (delegates to the central policy).

        super_admin -> superadmin
        Unknown roles fail safely to `user`.
        """

        return normalize_role(role)

    @staticmethod
    def _serialize_user(
        user: Optional[dict],
    ) -> Optional[dict]:
        """
        Convert MongoDB-specific values into
        API-friendly values.

        Does not mutate the original MongoDB document.

        NOTE: this keeps `hashed_password` because login needs it.
        Use `to_public()` before returning anything to a client.
        """

        if not user:
            return None

        serialized = user.copy()

        if serialized.get("_id") is not None:
            serialized["_id"] = str(
                serialized["_id"]
            )

        serialized["role"] = (
            UserRepository._normalize_role(
                serialized.get("role")
            )
        )

        # Legacy documents have no status field -> active.
        serialized["is_active"] = (
            serialized.get("is_active", True)
            is not False
        )

        return serialized

    @staticmethod
    def to_public(
        user: Optional[dict],
    ) -> Optional[dict]:
        """
        Return the API-safe representation of a user:
        no password / hash, `id` instead of `_id`, normalized role,
        and a guaranteed `is_active`.
        """

        if not user:
            return None

        now = datetime.now(timezone.utc)

        created_at = (
            user.get("created_at")
            or user.get("updated_at")
            or now
        )

        updated_at = user.get("updated_at") or created_at

        return {
            "id": str(
                user.get("_id") or user.get("id")
            ),
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "role": normalize_role(user.get("role")),
            "is_active": user.get("is_active", True) is not False,
            "created_at": created_at,
            "updated_at": updated_at,
        }

    @staticmethod
    def _to_object_id(
        user_id: str,
    ) -> Optional[ObjectId]:
        """
        Safely convert a user ID string into ObjectId.
        """

        if not user_id:
            return None

        if not ObjectId.is_valid(
            user_id
        ):
            return None

        try:
            return ObjectId(
                user_id
            )
        except Exception:
            return None

    @staticmethod
    def _role_query(
        role: str,
    ) -> dict:
        """
        MongoDB filter for a canonical role, tolerant of legacy data.

        superadmin -> role in (superadmin, super_admin)
        admin      -> role == admin
        user       -> anything that is not admin/superadmin
                      (includes missing / invalid roles, which fail
                      closed to `user`)
        """

        if role == ROLE_SUPERADMIN:
            return {
                "role": {
                    "$in": [
                        ROLE_SUPERADMIN,
                        *LEGACY_SUPERADMIN_ROLES,
                    ]
                }
            }

        if role == ROLE_ADMIN:
            return {"role": ROLE_ADMIN}

        return {
            "role": {
                "$nin": [
                    ROLE_ADMIN,
                    ROLE_SUPERADMIN,
                    *LEGACY_SUPERADMIN_ROLES,
                ]
            }
        }

    # ============================================================
    # Create
    # ============================================================

    async def create(
        self,
        data: UserCreate,
        hashed_password: str,
    ) -> dict:
        """
        Create a new user document.

        Public registration is forced to the `user` role
        by AuthService. Role normalization here provides
        an additional safety layer.
        """

        now = datetime.now(
            timezone.utc
        )

        # Never trust an unsupported role.
        role = self._normalize_role(
            data.role
        )

        user_doc = {
            "name": data.name,
            "email": data.email,
            "hashed_password": hashed_password,
            "role": role,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }

        result = await self.collection.insert_one(
            user_doc
        )

        user_doc["_id"] = str(
            result.inserted_id
        )

        return user_doc

    # ============================================================
    # Read by email
    # ============================================================

    async def get_by_email(
        self,
        email: str,
    ) -> Optional[dict]:
        """
        Retrieve a user by email.

        Uses the unique email index.
        """

        if not email:
            return None

        user = await self.collection.find_one(
            {
                "email": email,
            }
        )

        return self._serialize_user(
            user
        )

    # ============================================================
    # Read by ID
    # ============================================================

    async def get_by_id(
        self,
        user_id: str,
    ) -> Optional[dict]:
        """
        Retrieve a user by MongoDB ObjectId.

        Returns:
            Serialized user document or None.
        """

        obj_id = self._to_object_id(
            user_id
        )

        if obj_id is None:
            return None

        try:
            user = await self.collection.find_one(
                {
                    "_id": obj_id,
                }
            )

            return self._serialize_user(
                user
            )

        except Exception:
            return None

    # ============================================================
    # List / count (user management)
    # ============================================================

    def _build_list_query(
        self,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> dict:
        """Build the MongoDB filter used by list/count."""

        clauses: list[dict] = []

        if role:
            clauses.append(
                self._role_query(
                    normalize_role(role)
                )
            )

        if is_active is True:
            # Missing field means active (legacy data).
            clauses.append(
                {"is_active": {"$ne": False}}
            )
        elif is_active is False:
            clauses.append(
                {"is_active": False}
            )

        if search and search.strip():
            pattern = re.escape(search.strip())

            clauses.append(
                {
                    "$or": [
                        {
                            "name": {
                                "$regex": pattern,
                                "$options": "i",
                            }
                        },
                        {
                            "email": {
                                "$regex": pattern,
                                "$options": "i",
                            }
                        },
                    ]
                }
            )

        if not clauses:
            return {}

        if len(clauses) == 1:
            return clauses[0]

        return {"$and": clauses}

    async def get_all_users(
        self,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 10,
    ) -> list[dict]:
        """
        List users, newest first.

        Password hashes are excluded at the database level.
        """

        query = self._build_list_query(
            role=role,
            is_active=is_active,
            search=search,
        )

        limit = max(1, min(int(limit), 500))
        skip = max(0, int(skip))

        docs = await (
            self.collection
            .find(
                query,
                {
                    field: 0
                    for field in _SENSITIVE_FIELDS
                },
            )
            .sort(
                [
                    ("created_at", -1),
                    ("_id", -1),
                ]
            )
            .skip(skip)
            .limit(limit)
            .to_list(length=limit)
        )

        return [
            self._serialize_user(doc)
            for doc in docs
        ]

    async def get_users_by_role(
        self,
        role: str,
        limit: int = 100,
    ) -> list[dict]:
        """List users with a given canonical role."""

        return await self.get_all_users(
            role=role,
            limit=limit,
        )

    async def count_users(
        self,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> int:
        """Count users matching the same filters as get_all_users()."""

        query = self._build_list_query(
            role=role,
            is_active=is_active,
            search=search,
        )

        return await self.collection.count_documents(
            query
        )

    # ============================================================
    # Update
    # ============================================================

    async def update(
        self,
        user_id: str,
        update_data: dict,
    ) -> Optional[dict]:
        """
        Update a user document.

        Role updates are normalized before persistence.
        Internal helper: routes must use update_profile(),
        update_role() or update_status() which whitelist fields.

        Returns:
            Updated user document, or None.

        Raises:
            DuplicateKeyError: unique email index violated.
        """

        obj_id = self._to_object_id(
            user_id
        )

        if obj_id is None:
            return None

        try:
            # Never mutate the caller's dictionary.
            changes = dict(
                update_data
            )

            # Normalize explicitly supplied roles.
            if "role" in changes:
                changes["role"] = (
                    self._normalize_role(
                        changes["role"]
                    )
                )

            # Do not allow accidental MongoDB replacement
            # of protected identity fields through this method.
            changes.pop(
                "_id",
                None,
            )

            changes["updated_at"] = (
                datetime.now(
                    timezone.utc
                )
            )

            user = (
                await self.collection.find_one_and_update(
                    {
                        "_id": obj_id,
                    },
                    {
                        "$set": changes,
                    },
                    return_document=ReturnDocument.AFTER,
                )
            )

            return self._serialize_user(
                user
            )

        except DuplicateKeyError:
            raise

        except Exception:
            return None

    async def update_profile(
        self,
        user_id: str,
        changes: dict,
    ) -> Optional[dict]:
        """Update profile fields only (name, email)."""

        safe = {
            key: value
            for key, value in changes.items()
            if key in {"name", "email"}
        }

        if not safe:
            return await self.get_by_id(user_id)

        return await self.update(
            user_id,
            safe,
        )

    async def update_role(
        self,
        user_id: str,
        role: str,
    ) -> Optional[dict]:
        """Set a canonical role."""

        return await self.update(
            user_id,
            {
                "role": normalize_role(role),
            },
        )

    async def update_status(
        self,
        user_id: str,
        is_active: bool,
    ) -> Optional[dict]:
        """Activate / deactivate an account."""

        return await self.update(
            user_id,
            {
                "is_active": bool(is_active),
            },
        )

    # ============================================================
    # Delete
    # ============================================================

    async def delete(
        self,
        user_id: str,
    ) -> bool:
        """
        Delete a user document.

        Returns:
            True if deleted.
            False if not found or invalid ID.
        """

        obj_id = self._to_object_id(
            user_id
        )

        if obj_id is None:
            return False

        try:
            result = await self.collection.delete_one(
                {
                    "_id": obj_id,
                }
            )

            return (
                result.deleted_count > 0
            )

        except Exception:
            return False

    # ============================================================
    # Email existence check
    # ============================================================

    async def email_exists(
        self,
        email: str,
        exclude_user_id: Optional[str] = None,
    ) -> bool:
        """
        Check whether an email already exists.

        exclude_user_id lets an update ignore the user's own
        current email.
        """

        if not email:
            return False

        query: dict = {
            "email": email,
        }

        if exclude_user_id:
            exclude_id = self._to_object_id(
                exclude_user_id
            )

            if exclude_id is not None:
                query["_id"] = {
                    "$ne": exclude_id,
                }

        count = (
            await self.collection.count_documents(
                query
            )
        )

        return count > 0
