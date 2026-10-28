"""
Analytics service – computes governance statistics using MongoDB.

Responsibilities:
- Calculate total, active, expired, expiring-soon counts
- Aggregate records by vendor
- Aggregate records by business unit
- Provide complete analytics
- Provide vendor analytics
- Provide business-unit analytics
- Provide expiring-soon records
- Provide recently added records
- Enforce user record ownership

Authorization:
- user       -> own records only
- admin      -> all records
- superadmin -> all records
"""

from datetime import (
    date,
    datetime,
    timedelta,
    timezone,
)
from typing import List, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.utils.status import EXPIRING_SOON_DAYS


class AnalyticsService:
    """Service for computing analytics and statistics."""

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
    def _date_to_datetime(
        value: date,
    ) -> datetime:
        """
        Convert Python date to a timezone-aware
        UTC datetime for MongoDB queries.
        """

        return datetime.combine(
            value,
            datetime.min.time(),
        ).replace(
            tzinfo=timezone.utc
        )

    @staticmethod
    def _get_count(
        stats: dict,
        key: str,
    ) -> int:
        """
        Safely extract a MongoDB $count result.
        """

        values = stats.get(
            key,
            [],
        )

        if not values:
            return 0

        return values[0].get(
            "count",
            0,
        )

    @staticmethod
    def _get_user_id(
        current_user: Optional[dict],
    ) -> Optional[str]:
        """
        Extract the authenticated user's ID.

        Supports both internal `_id` and API-style `id`.
        """

        if not current_user:
            return None

        user_id = (
            current_user.get("_id")
            or current_user.get("id")
        )

        if not user_id:
            return None

        return str(user_id)

    @staticmethod
    def _normalize_role(
        current_user: Optional[dict],
    ) -> str:
        """
        Normalize the user's role.

        Supported:
            user
            admin
            superadmin

        Legacy:
            super_admin -> superadmin

        Unknown roles fail closed to `user`.
        """

        if not current_user:
            return "user"

        role = current_user.get(
            "role",
            "user",
        )

        if role == "super_admin":
            return "superadmin"

        if role not in {
            "user",
            "admin",
            "superadmin",
        }:
            return "user"

        return role

    @classmethod
    def _can_access_all_records(
        cls,
        current_user: Optional[dict],
    ) -> bool:
        """
        Return True for admin and superadmin users.

        Normal users are restricted to their own records.
        """

        role = cls._normalize_role(
            current_user
        )

        return role in {
            "admin",
            "superadmin",
        }

    def _build_access_filter(
        self,
        current_user: Optional[dict],
    ) -> dict:
        """
        Build the MongoDB ownership filter.

        Admins/superadmins:
            Empty filter -> all records.

        Normal users:
            user_id filter -> own records only.

        Missing/invalid user identity:
            Fail closed -> no records.
        """

        if self._can_access_all_records(
            current_user
        ):
            return {}

        user_id = self._get_user_id(
            current_user
        )

        if (
            not user_id
            or not ObjectId.is_valid(
                user_id
            )
        ):
            return {
                "_id": {
                    "$exists": False,
                },
            }

        return {
            "user_id": ObjectId(
                user_id
            ),
        }

    @staticmethod
    def _serialize_record(
        record: dict,
    ) -> dict:
        """
        Convert MongoDB ObjectIds to strings.

        Returns a copy rather than mutating the
        original MongoDB document.
        """

        payload = dict(
            record
        )

        if payload.get("_id") is not None:
            payload["_id"] = str(
                payload["_id"]
            )

        if payload.get("created_by") is not None:
            payload["created_by"] = str(
                payload["created_by"]
            )

        if payload.get("user_id") is not None:
            payload["user_id"] = str(
                payload["user_id"]
            )

        return payload

    # ============================================================
    # Overview
    # ============================================================

    async def get_overview(
        self,
        current_user: Optional[dict] = None,
    ) -> dict:
        """
        Get dashboard overview statistics.

        Statistics are restricted according to
        the authenticated user's role.
        """

        today = date.today()

        today_datetime = (
            self._date_to_datetime(
                today
            )
        )

        expiring_soon_date = (
            today
            + timedelta(
                days=EXPIRING_SOON_DAYS
            )
        )

        expiring_soon_datetime = (
            self._date_to_datetime(
                expiring_soon_date
            )
        )

        access_filter = (
            self._build_access_filter(
                current_user
            )
        )

        pipeline = [
            {
                "$match": access_filter,
            },
            {
                "$facet": {
                    "total": [
                        {
                            "$count": "count",
                        },
                    ],
                    "active": [
                        {
                            "$match": {
                                "expiry_date": {
                                    "$gt": (
                                        expiring_soon_datetime
                                    ),
                                },
                            },
                        },
                        {
                            "$count": "count",
                        },
                    ],
                    "expiring_soon": [
                        {
                            "$match": {
                                "$and": [
                                    {
                                        "expiry_date": {
                                            "$gte": (
                                                today_datetime
                                            ),
                                        },
                                    },
                                    {
                                        "expiry_date": {
                                            "$lte": (
                                                expiring_soon_datetime
                                            ),
                                        },
                                    },
                                ],
                            },
                        },
                        {
                            "$count": "count",
                        },
                    ],
                    "expired": [
                        {
                            "$match": {
                                "expiry_date": {
                                    "$lt": (
                                        today_datetime
                                    ),
                                },
                            },
                        },
                        {
                            "$count": "count",
                        },
                    ],
                },
            },
        ]

        result = (
            await self.collection
            .aggregate(
                pipeline
            )
            .to_list(
                length=1
            )
        )

        stats = (
            result[0]
            if result
            else {}
        )

        return {
            "total": self._get_count(
                stats,
                "total",
            ),
            "active": self._get_count(
                stats,
                "active",
            ),
            "expiring_soon": self._get_count(
                stats,
                "expiring_soon",
            ),
            "expired": self._get_count(
                stats,
                "expired",
            ),
        }

    # ============================================================
    # Vendor analytics
    # ============================================================

    async def get_by_vendor(
        self,
        current_user: Optional[dict] = None,
    ) -> List[dict]:
        """Get record counts grouped by vendor."""

        access_filter = (
            self._build_access_filter(
                current_user
            )
        )

        pipeline = [
            {
                "$match": access_filter,
            },
            {
                "$group": {
                    "_id": "$vendor",
                    "count": {
                        "$sum": 1,
                    },
                },
            },
            {
                "$sort": {
                    "count": -1,
                },
            },
            {
                "$project": {
                    "_id": 0,
                    "vendor": "$_id",
                    "count": 1,
                },
            },
        ]

        return await (
            self.collection
            .aggregate(
                pipeline
            )
            .to_list(
                length=None
            )
        )

    async def get_vendor_analytics(
        self,
        current_user: Optional[dict] = None,
    ) -> List[dict]:
        """Get analytics grouped by vendor."""

        return await self.get_by_vendor(
            current_user=current_user
        )

    # ============================================================
    # Business-unit analytics
    # ============================================================

    async def get_by_business_unit(
        self,
        current_user: Optional[dict] = None,
    ) -> List[dict]:
        """Get record counts grouped by business unit."""

        access_filter = (
            self._build_access_filter(
                current_user
            )
        )

        pipeline = [
            {
                "$match": access_filter,
            },
            {
                "$group": {
                    "_id": "$business_unit",
                    "count": {
                        "$sum": 1,
                    },
                },
            },
            {
                "$sort": {
                    "count": -1,
                },
            },
            {
                "$project": {
                    "_id": 0,
                    "business_unit": "$_id",
                    "count": 1,
                },
            },
        ]

        return await (
            self.collection
            .aggregate(
                pipeline
            )
            .to_list(
                length=None
            )
        )

    async def get_business_unit_analytics(
        self,
        current_user: Optional[dict] = None,
    ) -> List[dict]:
        """Get analytics grouped by business unit."""

        return await self.get_by_business_unit(
            current_user=current_user
        )

    # ============================================================
    # Vendor + business-unit analytics
    # ============================================================

    async def get_by_vendor_and_business_unit(
        self,
        current_user: Optional[dict] = None,
    ) -> List[dict]:
        """
        Get record counts grouped by vendor
        and business-unit combination.
        """

        access_filter = (
            self._build_access_filter(
                current_user
            )
        )

        pipeline = [
            {
                "$match": access_filter,
            },
            {
                "$group": {
                    "_id": {
                        "vendor": "$vendor",
                        "business_unit": (
                            "$business_unit"
                        ),
                    },
                    "count": {
                        "$sum": 1,
                    },
                },
            },
            {
                "$sort": {
                    "count": -1,
                },
            },
            {
                "$project": {
                    "_id": 0,
                    "vendor": "$_id.vendor",
                    "business_unit": (
                        "$_id.business_unit"
                    ),
                    "count": 1,
                },
            },
        ]

        return await (
            self.collection
            .aggregate(
                pipeline
            )
            .to_list(
                length=None
            )
        )

    # ============================================================
    # Complete analytics
    # ============================================================

    async def get_complete_analytics(
        self,
        current_user: Optional[dict] = None,
    ) -> dict:
        """Get complete analytics data."""

        overview = (
            await self.get_overview(
                current_user=current_user
            )
        )

        vendor = (
            await self.get_by_vendor(
                current_user=current_user
            )
        )

        business_unit = (
            await self.get_by_business_unit(
                current_user=current_user
            )
        )

        vendor_business_unit = (
            await self
            .get_by_vendor_and_business_unit(
                current_user=current_user
            )
        )

        return {
            "overview": overview,
            "by_vendor": vendor,
            "by_business_unit": business_unit,
            "by_vendor_and_business_unit": (
                vendor_business_unit
            ),
        }

    # ============================================================
    # Expiring soon
    # ============================================================

    async def get_expiring_soon(
        self,
        current_user: Optional[dict] = None,
        days: int = EXPIRING_SOON_DAYS,
    ) -> List[dict]:
        """
        Get API access records expiring within
        the specified number of days.

        Results are sorted by nearest expiry first.
        """

        # Protect against invalid negative values.
        days = max(
            0,
            days,
        )

        today = date.today()

        today_datetime = (
            self._date_to_datetime(
                today
            )
        )

        expiry_threshold_date = (
            today
            + timedelta(
                days=days
            )
        )

        expiry_threshold_datetime = (
            self._date_to_datetime(
                expiry_threshold_date
            )
        )

        access_filter = (
            self._build_access_filter(
                current_user
            )
        )

        filters = {
            **access_filter,
            "$and": [
                {
                    "expiry_date": {
                        "$gte": today_datetime,
                    },
                },
                {
                    "expiry_date": {
                        "$lte": (
                            expiry_threshold_datetime
                        ),
                    },
                },
            ],
        }

        records = (
            await self.collection
            .find(filters)
            .sort(
                "expiry_date",
                1,
            )
            .to_list(
                length=None
            )
        )

        serialized_records = []

        for record in records:
            payload = (
                self._serialize_record(
                    record
                )
            )

            expiry_value = record.get(
                "expiry_date"
            )

            if isinstance(
                expiry_value,
                datetime,
            ):
                expiry_date = (
                    expiry_value.date()
                )

            elif isinstance(
                expiry_value,
                date,
            ):
                expiry_date = (
                    expiry_value
                )

            else:
                continue

            payload[
                "days_until_expiry"
            ] = (
                expiry_date - today
            ).days

            serialized_records.append(
                payload
            )

        return serialized_records

    async def get_expiring_soon_details(
        self,
        current_user: Optional[dict] = None,
        limit: int = 10,
    ) -> List[dict]:
        """
        Get details of records expiring soon.

        Results are ordered by nearest expiry.
        """

        limit = max(
            1,
            min(
                limit,
                500,
            ),
        )

        records = (
            await self.get_expiring_soon(
                current_user=current_user,
                days=EXPIRING_SOON_DAYS,
            )
        )

        return records[:limit]

    # ============================================================
    # Recent records
    # ============================================================

    async def get_recent_records(
        self,
        current_user: Optional[dict] = None,
        limit: int = 10,
    ) -> List[dict]:
        """
        Get the most recently created API access records.

        Records are sorted newest first.
        """

        limit = max(
            1,
            min(
                limit,
                500,
            ),
        )

        access_filter = (
            self._build_access_filter(
                current_user
            )
        )

        records = (
            await self.collection
            .find(access_filter)
            .sort(
                "created_at",
                -1,
            )
            .limit(limit)
            .to_list(
                length=limit
            )
        )

        return [
            self._serialize_record(
                record
            )
            for record in records
        ]

    async def get_recently_added(
        self,
        current_user: Optional[dict] = None,
        limit: int = 10,
    ) -> List[dict]:
        """
        Backward-compatible alias for
        get_recent_records().
        """

        return await self.get_recent_records(
            current_user=current_user,
            limit=limit,
        )