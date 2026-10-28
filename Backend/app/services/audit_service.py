"""
Audit service – handles audit log operations and enrichment.

Responsibilities:
- Create audit log entries
- Retrieve audit history with user details
- Enforce record ownership for API-access history
- Enforce user-audit ownership
- Filter audit logs by entity, user, or type
- Enrich audit logs with user information
- Record security-sensitive user-management events
  (USER_UPDATED, USER_ACTIVATED, USER_DEACTIVATED, ROLE_CHANGED,
  ADMIN_CREATED, ADMIN_DEMOTED, USER_DELETED)

Authorization:
- user       -> own API-access history and own user audit logs
- admin      -> all audit logs
- superadmin -> all audit logs
"""

from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.permissions import normalize_role
from app.repositories.api_access_repository import ApiAccessRepository
from app.repositories.audit_repository import AuditRepository
from app.repositories.user_repository import UserRepository


class AuditService:
    """Service for audit log operations."""

    def __init__(self, db: AsyncIOMotorDatabase):
        """
        Initialize service with database instance.
        """

        self.db = db
        self.audit_repo = AuditRepository(db)
        self.api_access_repo = ApiAccessRepository(db)
        self.user_repo = UserRepository(db)

    # ------------------------------------------------------------------
    # Authorization helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _get_user_id(current_user: dict) -> str:
        """Get the authenticated user's ID."""

        user_id = (
            current_user.get("_id")
            or current_user.get("id")
        )

        if not user_id:
            raise ValueError(
                "Authenticated user ID is missing."
            )

        return str(user_id)

    @staticmethod
    def _get_role(current_user: dict) -> str:
        """
        Get and normalize the authenticated user's role.

        Supports the legacy `super_admin` role name.
        Unknown roles fail closed as `user`.
        """

        return normalize_role(
            current_user.get("role")
        )

    @classmethod
    def _can_access_all_records(
        cls,
        current_user: dict,
    ) -> bool:
        """
        Return True for admin and superadmin users.
        """

        return cls._get_role(current_user) in {
            "admin",
            "superadmin",
        }

    # ------------------------------------------------------------------
    # Create audit log
    # ------------------------------------------------------------------

    async def create_audit_log(
        self,
        action: str,
        entity_type: str,
        entity_id: str,
        performed_by: str,
        metadata: Optional[dict] = None,
    ) -> dict:
        """
        Create a new audit log entry.

        This method is intentionally focused on persistence.
        Authorization should happen before calling it.
        """

        log = await self.audit_repo.create_log(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            performed_by=performed_by,
            metadata=metadata or {},
        )

        return log

    # ------------------------------------------------------------------
    # Record audit history
    # ------------------------------------------------------------------

    async def get_record_history(
        self,
        record_id: str,
        current_user: dict,
        entity_type: str = "api_access",
        limit: int = 50,
    ) -> dict:
        """
        Retrieve audit history for a specific record.

        Authorization:

        user:
            Can view history only for their own API-access record.

        admin/superadmin:
            Can view history for any API-access record.

        Raises:
            ValueError:
                If the requested record does not exist or the user
                does not have access to it.
        """

        # --------------------------------------------------------------
        # API-access ownership check
        # --------------------------------------------------------------

        if entity_type == "api_access":
            user_id = self._get_user_id(
                current_user
            )

            include_all = self._can_access_all_records(
                current_user
            )

            record = await self.api_access_repo.get_by_id(
                record_id=record_id,
                user_id=user_id,
                include_all=include_all,
            )

            if not record:
                raise ValueError(
                    f"API access record with id={record_id} "
                    "not found."
                )

        # --------------------------------------------------------------
        # Retrieve audit history
        # --------------------------------------------------------------

        logs = await self.audit_repo.get_history_for_entity(
            entity_id=record_id,
            entity_type=entity_type,
            limit=limit,
        )

        # --------------------------------------------------------------
        # Enrich audit logs with user information
        # --------------------------------------------------------------

        enriched_logs = []

        for log in logs:
            enriched_log = (
                await self._enrich_log_with_user(log)
            )

            enriched_logs.append(
                enriched_log
            )

        return {
            "history": enriched_logs,
            "total": len(enriched_logs),
            "entity_id": record_id,
            "entity_type": entity_type,
        }

    # ------------------------------------------------------------------
    # Recent audit logs
    # ------------------------------------------------------------------

    async def get_recent_logs(
        self,
        limit: int = 100,
        entity_type: Optional[str] = None,
    ) -> dict:
        """
        Retrieve recent audit logs with user details.

        This method is intended for administrative audit views.

        Route-level RBAC currently restricts this endpoint to
        admin and superadmin users.
        """

        logs = await self.audit_repo.get_recent_logs(
            limit=limit,
            entity_type=entity_type,
        )

        enriched_logs = []

        for log in logs:
            enriched_log = (
                await self._enrich_log_with_user(log)
            )

            enriched_logs.append(
                enriched_log
            )

        return {
            "logs": enriched_logs,
            "total": len(enriched_logs),
        }

    # ------------------------------------------------------------------
    # User actions
    # ------------------------------------------------------------------

    async def get_user_actions(
        self,
        user_id: str,
        limit: int = 100,
        current_user: Optional[dict] = None,
    ) -> dict:
        """
        Retrieve audit logs for actions performed by a user.

        Authorization:

        - admin/superadmin can query any user.
        - normal users can query only themselves.

        If current_user is supplied, authorization is enforced here
        in addition to any route-level authorization.
        """

        if current_user is not None:
            current_user_id = self._get_user_id(
                current_user
            )

            if not self._can_access_all_records(
                current_user
            ):
                if str(user_id) != current_user_id:
                    raise PermissionError(
                        "You can only view your own audit logs."
                    )

        logs = await self.audit_repo.get_user_actions(
            user_id=user_id,
            limit=limit,
        )

        enriched_logs = []

        for log in logs:
            enriched_log = (
                await self._enrich_log_with_user(log)
            )

            enriched_logs.append(
                enriched_log
            )

        return {
            "logs": enriched_logs,
            "total": len(enriched_logs),
            "user_id": user_id,
        }

    # ------------------------------------------------------------------
    # Enrich audit log
    # ------------------------------------------------------------------

    async def _enrich_log_with_user(
        self,
        log: dict,
    ) -> dict:
        """
        Enrich an audit log with user information.
        """

        enriched = log.copy()

        performed_by = log.get(
            "performed_by"
        )

        if performed_by:
            try:
                user = await self.user_repo.get_by_id(
                    performed_by
                )

                if user:
                    enriched["performed_by_name"] = (
                        user.get(
                            "name",
                            "Unknown",
                        )
                    )

                    enriched["performed_by_email"] = (
                        user.get(
                            "email",
                            "",
                        )
                    )

                else:
                    enriched["performed_by_name"] = (
                        "Deleted User"
                    )

                    enriched["performed_by_email"] = ""

            except Exception as e:
                print(
                    "Error enriching log with user details: "
                    f"{e}"
                )

                enriched["performed_by_name"] = (
                    "Unknown"
                )

                enriched["performed_by_email"] = ""

        else:
            enriched["performed_by_name"] = "System"
            enriched["performed_by_email"] = ""

        return enriched

    # ------------------------------------------------------------------
    # API access CREATE audit
    # ------------------------------------------------------------------

    async def log_api_access_created(
        self,
        record_id: str,
        created_by: str,
        record_data: dict,
    ) -> dict:
        """
        Create a CREATE audit log for API access record.
        """

        metadata = {
            "username": record_data.get(
                "username"
            ),
            "application_name": record_data.get(
                "application_name"
            ),
            "vendor": record_data.get(
                "vendor"
            ),
            "business_unit": record_data.get(
                "business_unit"
            ),
        }

        return await self.create_audit_log(
            action="CREATE",
            entity_type="api_access",
            entity_id=record_id,
            performed_by=created_by,
            metadata=metadata,
        )

    # ------------------------------------------------------------------
    # API access UPDATE audit
    # ------------------------------------------------------------------

    async def log_api_access_updated(
        self,
        record_id: str,
        updated_by: str,
        changes: dict,
        record_data: dict,
    ) -> dict:
        """
        Create an UPDATE audit log for API access record.
        """

        metadata = {
            "changed_fields": list(
                changes.keys()
            ),
            "application_name": record_data.get(
                "application_name"
            ),
            "vendor": record_data.get(
                "vendor"
            ),
        }

        for field in [
            "expiry_date",
            "business_unit",
            "vendor",
        ]:
            if field in changes:
                metadata[
                    f"{field}_changed"
                ] = True

        return await self.create_audit_log(
            action="UPDATE",
            entity_type="api_access",
            entity_id=record_id,
            performed_by=updated_by,
            metadata=metadata,
        )

    # ------------------------------------------------------------------
    # API access DELETE audit
    # ------------------------------------------------------------------

    async def log_api_access_deleted(
        self,
        record_id: str,
        deleted_by: str,
        record_data: dict,
    ) -> dict:
        """
        Create a DELETE audit log for API access record.
        """

        metadata = {
            "username": record_data.get(
                "username"
            ),
            "application_name": record_data.get(
                "application_name"
            ),
            "vendor": record_data.get(
                "vendor"
            ),
            "business_unit": record_data.get(
                "business_unit"
            ),
            "expiry_date": str(
                record_data.get(
                    "expiry_date"
                )
            ),
        }

        return await self.create_audit_log(
            action="DELETE",
            entity_type="api_access",
            entity_id=record_id,
            performed_by=deleted_by,
            metadata=metadata,
        )

    # ------------------------------------------------------------------
    # User LOGIN audit
    # ------------------------------------------------------------------

    async def log_user_login(
        self,
        user_id: str,
        email: str,
    ) -> dict:
        """
        Create a LOGIN audit log for user authentication.
        """

        return await self.create_audit_log(
            action="LOGIN",
            entity_type="user",
            entity_id=user_id,
            performed_by=user_id,
            metadata={
                "email": email,
            },
        )

    # ------------------------------------------------------------------
    # USER CREATED audit
    # ------------------------------------------------------------------

    async def log_user_created(
        self,
        user_id: str,
        created_by: str,
        email: str,
        role: str,
    ) -> dict:
        """
        Create a USER_CREATED audit log.
        """

        return await self.create_audit_log(
            action="USER_CREATED",
            entity_type="user",
            entity_id=user_id,
            performed_by=created_by,
            metadata={
                "email": email,
                "role": role,
            },
        )

    # ------------------------------------------------------------------
    # User-management audit events
    # ------------------------------------------------------------------

    # Keys that must never be written to the audit log, at any depth.
    _FORBIDDEN_METADATA_KEYS = frozenset(
        {
            "password",
            "hashed_password",
            "new_password",
            "token",
            "access_token",
            "refresh_token",
            "jwt",
            "authorization",
            "secret",
            "api_key",
            "api_secret",
        }
    )

    @classmethod
    def _sanitize_metadata(cls, value):
        """
        Recursively drop credential-like keys from audit metadata.
        """

        if isinstance(value, dict):
            return {
                key: cls._sanitize_metadata(item)
                for key, item in value.items()
                if str(key).lower()
                not in cls._FORBIDDEN_METADATA_KEYS
            }

        if isinstance(value, (list, tuple)):
            return [
                cls._sanitize_metadata(item)
                for item in value
            ]

        return value

    async def log_user_event(
        self,
        action: str,
        target_user_id: str,
        performed_by: str,
        metadata: Optional[dict] = None,
    ) -> dict:
        """
        Record an administrative operation on a user account.

        Examples of `action`:
            USER_UPDATED, USER_ACTIVATED, USER_DEACTIVATED,
            ROLE_CHANGED, ADMIN_CREATED, ADMIN_DEMOTED, USER_DELETED

        The log always carries:
            action, entity_type="user", entity_id=target,
            performed_by, timestamp (added by the repository)
        plus sanitized metadata. Passwords, password hashes, JWTs and
        secrets are stripped even if a caller passes them by mistake.
        """

        safe_metadata = self._sanitize_metadata(
            metadata or {}
        )

        safe_metadata["target_user_id"] = str(
            target_user_id
        )

        return await self.create_audit_log(
            action=action,
            entity_type="user",
            entity_id=str(target_user_id),
            performed_by=performed_by,
            metadata=safe_metadata,
        )

