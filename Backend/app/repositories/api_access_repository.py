"""
API Access repository – MongoDB operations for API access records.

Responsibilities:
- CRUD operations
- User ownership filtering
- Search with MongoDB text indexes
- Filtering with optimized queries
- Sorting and pagination
- Audit support
"""

from datetime import (
    date,
    datetime,
    timedelta,
    timezone,
)
from typing import Optional, Tuple

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.schemas.api_access import (
    ApiAccessCreate,
    ApiAccessUpdate,
)
from app.utils.status import EXPIRING_SOON_DAYS


class ApiAccessRepository:
    """Repository for API Access collection operations."""

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
    ):
        self.db = db
        self.collection = db["api_access"]

    # ============================================================
    # Helpers
    # ============================================================

    @staticmethod
    def _to_object_id(
        value: str | ObjectId | None,
    ) -> Optional[ObjectId]:
        """Convert a string/ObjectId to ObjectId safely."""

        if value is None:
            return None

        if isinstance(value, ObjectId):
            return value

        if not value:
            return None

        if not ObjectId.is_valid(value):
            return None

        try:
            return ObjectId(value)
        except Exception:
            return None

    @staticmethod
    def _serialize_record(
        record: Optional[dict],
    ) -> Optional[dict]:
        """
        Convert MongoDB-specific values into API-friendly values.

        Does not mutate the original MongoDB document.
        """

        if not record:
            return None

        serialized = record.copy()

        if serialized.get("_id") is not None:
            serialized["_id"] = str(
                serialized["_id"]
            )

        if serialized.get("created_by") is not None:
            serialized["created_by"] = str(
                serialized["created_by"]
            )

        if serialized.get("user_id") is not None:
            serialized["user_id"] = str(
                serialized["user_id"]
            )

        return serialized

    @staticmethod
    def _build_owner_filter(
        user_id: Optional[str] = None,
        include_all: bool = False,
    ) -> dict:
        """
        Build the ownership portion of a MongoDB query.

        include_all=True:
            Admin/superadmin access to all records.

        include_all=False:
            Only records owned by user_id.

        Missing/invalid user IDs deliberately match
        no records to prevent accidental data exposure.
        """

        # Admin / superadmin.
        if include_all:
            return {}

        # Normal user without an ID.
        if not user_id:
            return {
                "_id": {
                    "$exists": False,
                },
            }

        owner_id = (
            ApiAccessRepository._to_object_id(
                user_id
            )
        )

        # Invalid user ID -> fail closed.
        if owner_id is None:
            return {
                "_id": {
                    "$exists": False,
                },
            }

        return {
            "user_id": owner_id,
        }

    @staticmethod
    def _date_to_datetime(
        value: date,
    ) -> datetime:
        """
        Convert Python date to timezone-aware UTC datetime.
        """

        return datetime.combine(
            value,
            datetime.min.time(),
        ).replace(
            tzinfo=timezone.utc
        )

    # ============================================================
    # Create
    # ============================================================

    async def create(
        self,
        data: ApiAccessCreate,
        created_by: str,
    ) -> dict:
        """
        Create a new API access record.

        The creator becomes the owner of the record.
        """

        owner_id = (
            self._to_object_id(
                created_by
            )
        )

        if owner_id is None:
            raise ValueError(
                "Invalid user ID"
            )

        date_issued = (
            self._date_to_datetime(
                data.date_issued
            )
        )

        expiry_date = (
            self._date_to_datetime(
                data.expiry_date
            )
        )

        now = datetime.now(
            timezone.utc
        )

        record_doc = {
            "username": data.username,
            "application_name": (
                data.application_name
            ),
            "business_unit": (
                data.business_unit
            ),
            "it_spoke": data.it_spoke,
            "business_spoke": (
                data.business_spoke
            ),
            "vendor": data.vendor,
            "date_issued": date_issued,
            "expiry_date": expiry_date,
            "notes": data.notes,

            # Ownership.
            "user_id": owner_id,

            # Existing audit compatibility.
            "created_by": owner_id,

            "created_at": now,
            "updated_at": now,
        }

        result = await self.collection.insert_one(
            record_doc
        )

        record_doc["_id"] = (
            result.inserted_id
        )

        return self._serialize_record(
            record_doc
        )

    # ============================================================
    # Get by ID
    # ============================================================

    async def get_by_id(
        self,
        record_id: str,
        user_id: Optional[str] = None,
        include_all: bool = False,
    ) -> Optional[dict]:
        """
        Retrieve a record by ID.

        Normal users:
            Only their own records.

        Admin/superadmin:
            Any record.
        """

        obj_id = self._to_object_id(
            record_id
        )

        if obj_id is None:
            return None

        filters = {
            "_id": obj_id,
        }

        filters.update(
            self._build_owner_filter(
                user_id=user_id,
                include_all=include_all,
            )
        )

        try:
            record = (
                await self.collection.find_one(
                    filters
                )
            )

            return self._serialize_record(
                record
            )

        except Exception:
            return None

    # ============================================================
    # List
    # ============================================================

    async def list(
        self,
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
        user_id: Optional[str] = None,
        include_all: bool = False,
    ) -> Tuple[list, int]:
        """
        List API access records with:

        - ownership filtering
        - search
        - vendor filtering
        - business-unit filtering
        - issue-date filtering
        - expiry-date filtering
        - status filtering
        - sorting
        - pagination
        """

        filters = (
            self._build_owner_filter(
                user_id=user_id,
                include_all=include_all,
            )
        )

        # ========================================================
        # Text search
        # ========================================================

        if search:
            filters["$text"] = {
                "$search": search,
            }

        # ========================================================
        # Vendor
        # ========================================================

        if vendor:
            filters["vendor"] = vendor

        # ========================================================
        # Business unit
        # ========================================================

        if business_unit:
            filters["business_unit"] = {
                "$regex": (
                    f"^{business_unit}$"
                ),
                "$options": "i",
            }

        # ========================================================
        # Issue date range
        # ========================================================

        if (
            issue_date_from
            or issue_date_to
        ):
            date_filter = {}

            if issue_date_from:
                date_filter["$gte"] = (
                    self._date_to_datetime(
                        issue_date_from
                    )
                )

            if issue_date_to:
                date_filter["$lte"] = (
                    self._date_to_datetime(
                        issue_date_to
                    )
                )

            filters["date_issued"] = (
                date_filter
            )

        # ========================================================
        # Expiry date range
        # ========================================================

        if (
            expiry_date_from
            or expiry_date_to
        ):
            date_filter = {}

            if expiry_date_from:
                date_filter["$gte"] = (
                    self._date_to_datetime(
                        expiry_date_from
                    )
                )

            if expiry_date_to:
                date_filter["$lte"] = (
                    self._date_to_datetime(
                        expiry_date_to
                    )
                )

            filters["expiry_date"] = (
                date_filter
            )

        # ========================================================
        # Status
        # ========================================================

        if status:
            today = date.today()

            expiry_soon_threshold = (
                today
                + timedelta(
                    days=EXPIRING_SOON_DAYS
                )
            )

            today_datetime = (
                self._date_to_datetime(
                    today
                )
            )

            expiry_soon_datetime = (
                self._date_to_datetime(
                    expiry_soon_threshold
                )
            )

            if status == "Active":
                filters["expiry_date"] = {
                    "$gt": expiry_soon_datetime,
                }

            elif status == "Expiring Soon":
                filters["$and"] = [
                    {
                        "expiry_date": {
                            "$gte": today_datetime,
                        },
                    },
                    {
                        "expiry_date": {
                            "$lte": (
                                expiry_soon_datetime
                            ),
                        },
                    },
                ]

            elif status == "Expired":
                filters["expiry_date"] = {
                    "$lt": today_datetime,
                }

        # ========================================================
        # Count
        # ========================================================

        total = (
            await self.collection.count_documents(
                filters
            )
        )

        # ========================================================
        # Sorting
        # ========================================================

        sort_direction = (
            1
            if sort_order == "asc"
            else -1
        )

        sort_field = sort_by

        if sort_by == "dateIssued":
            sort_field = "date_issued"

        elif sort_by == "expiryDate":
            sort_field = "expiry_date"

        elif sort_by == "createdAt":
            sort_field = "created_at"

        elif sort_by == "updatedAt":
            sort_field = "updated_at"

        # ========================================================
        # Pagination
        # ========================================================

        skip = max(
            0,
            (page - 1) * limit,
        )

        records = (
            await self.collection
            .find(filters)
            .sort(
                sort_field,
                sort_direction,
            )
            .skip(skip)
            .limit(limit)
            .to_list(
                length=limit
            )
        )

        serialized_records = [
            self._serialize_record(
                record
            )
            for record in records
        ]

        return (
            serialized_records,
            total,
        )

    # ============================================================
    # Update
    # ============================================================

    async def update(
        self,
        record_id: str,
        data: ApiAccessUpdate,
        user_id: Optional[str] = None,
        include_all: bool = False,
    ) -> Optional[dict]:
        """
        Update an API access record.

        Normal users:
            Can update only their own records.

        Admins/superadmins:
            Can update any record.
        """

        obj_id = self._to_object_id(
            record_id
        )

        if obj_id is None:
            return None

        filters = {
            "_id": obj_id,
        }

        filters.update(
            self._build_owner_filter(
                user_id=user_id,
                include_all=include_all,
            )
        )

        try:
            update_dict = {}

            for (
                field,
                value,
            ) in data.model_dump(
                exclude_unset=True
            ).items():

                if value is None:
                    continue

                if (
                    isinstance(
                        value,
                        date,
                    )
                    and not isinstance(
                        value,
                        datetime,
                    )
                ):
                    value = (
                        self._date_to_datetime(
                            value
                        )
                    )

                update_dict[field] = value

            update_dict["updated_at"] = (
                datetime.now(
                    timezone.utc
                )
            )

            record = (
                await self.collection
                .find_one_and_update(
                    filters,
                    {
                        "$set": update_dict,
                    },
                    return_document=(
                        ReturnDocument.AFTER
                    ),
                )
            )

            return self._serialize_record(
                record
            )

        except Exception:
            return None

    # ============================================================
    # Delete
    # ============================================================

    async def delete(
        self,
        record_id: str,
        user_id: Optional[str] = None,
        include_all: bool = False,
    ) -> bool:
        """
        Delete an API access record.

        Normal users:
            Can delete only their own records.

        Admins/superadmins:
            Can delete any record.
        """

        obj_id = self._to_object_id(
            record_id
        )

        if obj_id is None:
            return False

        filters = {
            "_id": obj_id,
        }

        filters.update(
            self._build_owner_filter(
                user_id=user_id,
                include_all=include_all,
            )
        )

        try:
            result = (
                await self.collection.delete_one(
                    filters
                )
            )

            return (
                result.deleted_count > 0
            )

        except Exception:
            return False

    # ============================================================
    # Audit support
    # ============================================================

    async def get_by_id_for_audit(
        self,
        record_id: str,
    ) -> Optional[dict]:
        """
        Get record data for audit logging.

        This method intentionally does not apply ownership
        filtering.

        Authorization must be performed by the service
        before calling this method.
        """

        obj_id = self._to_object_id(
            record_id
        )

        if obj_id is None:
            return None

        try:
            record = (
                await self.collection.find_one(
                    {
                        "_id": obj_id,
                    },
                    {
                        "_id": 1,
                        "vendor": 1,
                        "application_name": 1,
                        "username": 1,
                        "expiry_date": 1,
                        "user_id": 1,
                        "created_by": 1,
                    },
                )
            )

            if not record:
                return None

            return self._serialize_record(
                record
            )

        except Exception:
            return None