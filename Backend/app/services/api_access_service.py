"""
API Access service – handles CRUD operations and business logic
for API access records.

Responsibilities:
- Create, read, update, delete API access records
- Enforce record ownership rules
- Validate business logic
- Compute record status
- Coordinate with repositories and audit logging

Authorization:
- user       -> own records only
- admin      -> all records
- superadmin -> all records
"""

from datetime import date
from typing import Optional, Tuple

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.api_access_repository import (
    ApiAccessRepository,
)
from app.repositories.audit_repository import (
    AuditRepository,
)
from app.schemas.api_access import (
    ApiAccessCreate,
    ApiAccessUpdate,
)
from app.utils.status import compute_status


class ApiAccessService:
    """Service for API access records."""

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
    ):
        self.db = db
        self.repo = ApiAccessRepository(db)
        self.audit_repo = AuditRepository(db)

    # ============================================================
    # Authorization helpers
    # ============================================================

    @staticmethod
    def _normalize_role(
        role: str | None,
    ) -> str:
        """
        Normalize supported roles.

        Legacy:
            super_admin -> superadmin

        Unknown roles fail closed to `user`.
        """

        if role == "super_admin":
            return "superadmin"

        if role in {
            "user",
            "admin",
            "superadmin",
        }:
            return role

        return "user"

    @staticmethod
    def _get_user_id(
        current_user: dict,
    ) -> str:
        """
        Extract the authenticated user's ID.

        Supports both internal `_id` and API-style `id`.
        """

        user_id = current_user.get(
            "_id"
        )

        if not user_id:
            user_id = current_user.get(
                "id"
            )

        if not user_id:
            raise ValueError(
                "Authenticated user ID is missing."
            )

        return str(user_id)

    @classmethod
    def _can_access_all_records(
        cls,
        current_user: dict,
    ) -> bool:
        """
        Return True only for admin and superadmin users.

        Normal users are restricted to their own records.
        Unknown roles fail closed.
        """

        role = cls._normalize_role(
            current_user.get(
                "role"
            )
        )

        return role in {
            "admin",
            "superadmin",
        }

    # ============================================================
    # Create
    # ============================================================

    async def create_record(
        self,
        data: ApiAccessCreate,
        created_by: str,
    ) -> dict:
        """
        Create a new API access record.

        The creator automatically becomes the owner.
        """

        # --------------------------------------------------------
        # Validate dates
        # --------------------------------------------------------

        if data.expiry_date <= data.date_issued:
            raise ValueError(
                "expiry_date must be strictly after date_issued."
            )

        # --------------------------------------------------------
        # Create record
        # --------------------------------------------------------

        record = await self.repo.create(
            data=data,
            created_by=created_by,
        )

        # --------------------------------------------------------
        # Audit
        # --------------------------------------------------------

        metadata = {
            "vendor": record.get(
                "vendor"
            ),
            "application_name": record.get(
                "application_name"
            ),
            "username": record.get(
                "username"
            ),
        }

        await self.audit_repo.create_log(
            action="CREATE",
            entity_type="api_access",
            entity_id=record["_id"],
            performed_by=created_by,
            metadata=metadata,
        )

        # --------------------------------------------------------
        # Status
        # --------------------------------------------------------

        record["status"] = compute_status(
            record["expiry_date"]
        )

        return record

    # ============================================================
    # Get single record
    # ============================================================

    async def get_record(
        self,
        record_id: str,
        current_user: dict,
    ) -> Optional[dict]:
        """
        Get a single API access record.

        user:
            own records only

        admin/superadmin:
            any record
        """

        user_id = self._get_user_id(
            current_user
        )

        include_all = (
            self._can_access_all_records(
                current_user
            )
        )

        record = await self.repo.get_by_id(
            record_id=record_id,
            user_id=user_id,
            include_all=include_all,
        )

        if record:
            record["status"] = compute_status(
                record["expiry_date"]
            )

        return record

    # ============================================================
    # List records
    # ============================================================

    async def list_records(
        self,
        current_user: dict,
        page: int = 1,
        limit: int = 10,
        search: Optional[str] = None,
        vendor: Optional[str] = None,
        business_unit: Optional[str] = None,
        issue_date_from: Optional[date] = None,
        issue_date_to: Optional[date] = None,
        expiry_date_from: Optional[date] = None,
        expiry_date_to: Optional[date] = None,
        status: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> Tuple[list, int]:
        """
        List API access records.

        user:
            own records only

        admin/superadmin:
            all records
        """

        user_id = self._get_user_id(
            current_user
        )

        include_all = (
            self._can_access_all_records(
                current_user
            )
        )

        records, total = await self.repo.list(
            page=page,
            limit=limit,
            search=search,
            vendor=vendor,
            business_unit=business_unit,
            issue_date_from=issue_date_from,
            issue_date_to=issue_date_to,
            expiry_date_from=expiry_date_from,
            expiry_date_to=expiry_date_to,
            status=status,
            sort_by=sort_by,
            sort_order=sort_order,
            user_id=user_id,
            include_all=include_all,
        )

        # Add computed status.
        for record in records:
            record["status"] = compute_status(
                record["expiry_date"]
            )

        return records, total

    # ============================================================
    # Update
    # ============================================================

    async def update_record(
        self,
        record_id: str,
        data: ApiAccessUpdate,
        updated_by: str,
        current_user: dict,
    ) -> Optional[dict]:
        """
        Update an API access record.

        user:
            own records only

        admin/superadmin:
            any record
        """

        user_id = self._get_user_id(
            current_user
        )

        include_all = (
            self._can_access_all_records(
                current_user
            )
        )

        # --------------------------------------------------------
        # Get current record using ownership rules
        # --------------------------------------------------------

        current = await self.repo.get_by_id(
            record_id=record_id,
            user_id=user_id,
            include_all=include_all,
        )

        if not current:
            return None

        # --------------------------------------------------------
        # Validate final date combination
        # --------------------------------------------------------

        new_issue = (
            data.date_issued
            if data.date_issued is not None
            else current["date_issued"]
        )

        new_expiry = (
            data.expiry_date
            if data.expiry_date is not None
            else current["expiry_date"]
        )

        if new_expiry <= new_issue:
            raise ValueError(
                "expiry_date must be strictly after date_issued."
            )

        # --------------------------------------------------------
        # Update
        # --------------------------------------------------------

        updated = await self.repo.update(
            record_id=record_id,
            data=data,
            user_id=user_id,
            include_all=include_all,
        )

        if not updated:
            return None

        # --------------------------------------------------------
        # Audit
        # --------------------------------------------------------

        metadata = {
            "vendor": updated.get(
                "vendor"
            ),
            "application_name": updated.get(
                "application_name"
            ),
            "username": updated.get(
                "username"
            ),
        }

        await self.audit_repo.create_log(
            action="UPDATE",
            entity_type="api_access",
            entity_id=record_id,
            performed_by=updated_by,
            metadata=metadata,
        )

        # --------------------------------------------------------
        # Status
        # --------------------------------------------------------

        updated["status"] = compute_status(
            updated["expiry_date"]
        )

        return updated

    # ============================================================
    # Delete
    # ============================================================

    async def delete_record(
        self,
        record_id: str,
        deleted_by: str,
        current_user: dict,
    ) -> bool:
        """
        Delete an API access record.

        user:
            own records only

        admin/superadmin:
            any record
        """

        user_id = self._get_user_id(
            current_user
        )

        include_all = (
            self._can_access_all_records(
                current_user
            )
        )

        # --------------------------------------------------------
        # Retrieve record before deletion.
        #
        # Ownership is checked here.
        # --------------------------------------------------------

        record = await self.repo.get_by_id(
            record_id=record_id,
            user_id=user_id,
            include_all=include_all,
        )

        if not record:
            return False

        # --------------------------------------------------------
        # Delete using the SAME ownership restrictions.
        # --------------------------------------------------------

        deleted = await self.repo.delete(
            record_id=record_id,
            user_id=user_id,
            include_all=include_all,
        )

        if deleted:
            metadata = {
                "vendor": record.get(
                    "vendor"
                ),
                "application_name": record.get(
                    "application_name"
                ),
                "username": record.get(
                    "username"
                ),
            }

            await self.audit_repo.create_log(
                action="DELETE",
                entity_type="api_access",
                entity_id=record_id,
                performed_by=deleted_by,
                metadata=metadata,
            )

        return deleted