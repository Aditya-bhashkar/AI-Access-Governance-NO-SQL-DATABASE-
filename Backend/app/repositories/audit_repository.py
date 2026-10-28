"""
Audit repository – MongoDB operations for audit logs.

Responsibilities:
- Create audit log entries
- Retrieve audit history
- Retrieve actions performed by a user
- Retrieve recent audit logs
- Serialize MongoDB ObjectIds safely

Authorization is handled by AuditService.
This repository only performs database operations.
"""

from datetime import datetime, timezone
from typing import List, Optional, Union

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


class AuditRepository:
    """Repository for Audit Logs collection operations."""

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
    ):
        """
        Initialize repository with database instance.
        """

        self.db = db
        self.collection = db["audit_logs"]

    # ============================================================
    # Helpers
    # ============================================================

    @staticmethod
    def _to_object_id(
        value: Union[str, ObjectId, None],
    ) -> Optional[ObjectId]:
        """
        Safely convert a value to ObjectId.

        Returns:
            ObjectId if valid, otherwise None.
        """

        if value is None:
            return None

        if isinstance(value, ObjectId):
            return value

        value = str(value)

        if not value:
            return None

        if not ObjectId.is_valid(value):
            return None

        return ObjectId(value)

    @staticmethod
    def _serialize_log(
        log: dict,
    ) -> dict:
        """
        Convert MongoDB ObjectIds to strings.

        Returns a copy so the original MongoDB document
        is never mutated.
        """

        serialized = log.copy()

        if serialized.get("_id") is not None:
            serialized["_id"] = str(
                serialized["_id"]
            )

        if serialized.get("entity_id") is not None:
            serialized["entity_id"] = str(
                serialized["entity_id"]
            )

        if serialized.get("performed_by") is not None:
            serialized["performed_by"] = str(
                serialized["performed_by"]
            )

        return serialized

    @staticmethod
    def _normalize_limit(
        limit: int,
        default: int = 100,
        maximum: int = 500,
    ) -> int:
        """
        Normalize query limits defensively.
        """

        if not isinstance(limit, int):
            return default

        if limit < 1:
            return 1

        return min(
            limit,
            maximum,
        )

    # ============================================================
    # Create audit log
    # ============================================================

    async def create_log(
        self,
        action: str,
        entity_type: str,
        entity_id: str,
        performed_by: str,
        metadata: Optional[dict] = None,
    ) -> dict:
        """
        Create a new audit log entry.

        Args:
            action:
                CREATE, UPDATE, DELETE, LOGIN, USER_CREATED

            entity_type:
                Type of entity affected.

            entity_id:
                Entity ID as string.

            performed_by:
                User ID as string.

            metadata:
                Additional non-sensitive metadata.

        Returns:
            Created audit log document.
        """

        entity_object_id = self._to_object_id(
            entity_id
        )

        performed_by_object_id = self._to_object_id(
            performed_by
        )

        audit_doc = {
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_object_id,
            "performed_by": performed_by_object_id,
            "timestamp": datetime.now(
                timezone.utc
            ),
            "metadata": metadata or {},
        }

        result = await self.collection.insert_one(
            audit_doc
        )

        audit_doc["_id"] = result.inserted_id

        return self._serialize_log(
            audit_doc
        )

    # ============================================================
    # Get history for entity
    # ============================================================

    async def get_history_for_entity(
        self,
        entity_id: str,
        entity_type: str = "api_access",
        limit: int = 50,
    ) -> List[dict]:
        """
        Retrieve audit history for a specific entity.

        Results are sorted by timestamp descending.

        Authorization must be performed by AuditService before
        calling this method.
        """

        obj_id = self._to_object_id(
            entity_id
        )

        if obj_id is None:
            return []

        limit = self._normalize_limit(
            limit=limit,
            default=50,
        )

        logs = await (
            self.collection
            .find(
                {
                    "entity_id": obj_id,
                    "entity_type": entity_type,
                }
            )
            .sort(
                "timestamp",
                -1,
            )
            .limit(limit)
            .to_list(
                length=limit
            )
        )

        return [
            self._serialize_log(log)
            for log in logs
        ]

    # ============================================================
    # Get user actions
    # ============================================================

    async def get_user_actions(
        self,
        user_id: str,
        limit: int = 100,
    ) -> List[dict]:
        """
        Retrieve all audit logs for actions performed
        by a specific user.

        Results are sorted by timestamp descending.

        Authorization must be performed by AuditService.
        """

        obj_id = self._to_object_id(
            user_id
        )

        if obj_id is None:
            return []

        limit = self._normalize_limit(
            limit=limit,
            default=100,
        )

        logs = await (
            self.collection
            .find(
                {
                    "performed_by": obj_id,
                }
            )
            .sort(
                "timestamp",
                -1,
            )
            .limit(limit)
            .to_list(
                length=limit
            )
        )

        return [
            self._serialize_log(log)
            for log in logs
        ]

    # ============================================================
    # Get recent logs
    # ============================================================

    async def get_recent_logs(
        self,
        limit: int = 100,
        entity_type: Optional[str] = None,
    ) -> List[dict]:
        """
        Retrieve recent audit logs.

        Args:
            limit:
                Maximum number of logs.

            entity_type:
                Optional entity type filter.

        Authorization must be performed by AuditService/route.
        """

        limit = self._normalize_limit(
            limit=limit,
            default=100,
        )

        filters = {}

        if entity_type:
            filters["entity_type"] = entity_type

        logs = await (
            self.collection
            .find(filters)
            .sort(
                "timestamp",
                -1,
            )
            .limit(limit)
            .to_list(
                length=limit
            )
        )

        return [
            self._serialize_log(log)
            for log in logs
        ]