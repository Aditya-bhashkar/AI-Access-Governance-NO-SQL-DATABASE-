"""
MongoDB connection setup using Motor (async driver).

This module provides:
- MongoDB client initialization
- Database instance
- Connection lifecycle management
- Index creation on startup

Motor is the async MongoDB driver used with asyncio and FastAPI.
"""

from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorDatabase,
)

from app.core.config import settings


# ============================================================
# Global MongoDB state
# ============================================================

client: AsyncIOMotorClient | None = None
db: AsyncIOMotorDatabase | None = None


# ============================================================
# Connection
# ============================================================

async def connect_to_mongo() -> AsyncIOMotorDatabase:
    """
    Initialize MongoDB connection.

    Creates a Motor AsyncClient, selects the configured
    database, and creates required indexes.
    """

    global client, db

    client = AsyncIOMotorClient(
        settings.MONGODB_URL
    )

    db = client[
        settings.MONGODB_DB_NAME
    ]

    await create_indexes(db)
    await normalize_legacy_users(db)

    print(
        f"✓ Connected to MongoDB: "
        f"{settings.MONGODB_DB_NAME}"
    )

    return db


# ============================================================
# Disconnect
# ============================================================

async def close_mongo_connection() -> None:
    """
    Close MongoDB connection.

    Called during application shutdown.
    """

    global client, db

    if client is not None:
        client.close()

    client = None
    db = None

    print(
        "✓ Disconnected from MongoDB"
    )


# ============================================================
# Indexes
# ============================================================

async def create_indexes(
    database: AsyncIOMotorDatabase,
) -> None:
    """
    Create MongoDB indexes used by the application.

    Existing indexes are preserved.

    Index categories:

    Users:
        - unique email lookup
        - role / status / creation-date lookups used by
          user management

    API Access:
        - ownership/RBAC filtering
        - common filters
        - expiry analytics
        - creation ordering
        - vendor/business-unit filtering
        - text search

    Audit Logs:
        - timestamp queries
        - entity lookup
        - user lookup
        - entity history lookup
    """

    # ========================================================
    # Users
    # ========================================================

    users_col = database["users"]

    await users_col.create_index(
        "email",
        unique=True,
    )

    # User-management filters and ordering.
    await users_col.create_index(
        "role",
    )

    await users_col.create_index(
        "is_active",
    )

    await users_col.create_index(
        "created_at",
    )


    # ========================================================
    # API Access
    # ========================================================

    api_access_col = database[
        "api_access"
    ]

    # --------------------------------------------------------
    # RBAC / ownership
    # --------------------------------------------------------

    await api_access_col.create_index(
        "user_id",
    )

    # Useful for user-specific
    # expiring-record queries.
    await api_access_col.create_index(
        [
            ("user_id", 1),
            ("expiry_date", 1),
        ],
    )

    # --------------------------------------------------------
    # Common single-field queries
    # --------------------------------------------------------

    await api_access_col.create_index(
        "username",
    )

    await api_access_col.create_index(
        "application_name",
    )

    await api_access_col.create_index(
        "business_unit",
    )

    await api_access_col.create_index(
        "vendor",
    )

    await api_access_col.create_index(
        "expiry_date",
    )

    await api_access_col.create_index(
        "created_at",
    )

    await api_access_col.create_index(
        "created_by",
    )

    # --------------------------------------------------------
    # Compound indexes
    # --------------------------------------------------------

    await api_access_col.create_index(
        [
            ("business_unit", 1),
            ("vendor", 1),
        ],
    )

    await api_access_col.create_index(
        [
            ("expiry_date", 1),
            ("created_at", 1),
        ],
    )

    # --------------------------------------------------------
    # Text search
    # --------------------------------------------------------

    await api_access_col.create_index(
        [
            ("username", "text"),
            ("application_name", "text"),
            ("business_unit", "text"),
            ("vendor", "text"),
        ],
    )


    # ========================================================
    # Audit Logs
    # ========================================================

    audit_logs_col = database[
        "audit_logs"
    ]

    await audit_logs_col.create_index(
        "timestamp",
    )

    await audit_logs_col.create_index(
        "entity_id",
    )

    await audit_logs_col.create_index(
        [
            ("entity_type", 1),
            ("entity_id", 1),
        ],
    )

    await audit_logs_col.create_index(
        "performed_by",
    )

    print(
        "✓ MongoDB indexes created successfully"
    )


# ============================================================
# Legacy user data normalization
# ============================================================

async def normalize_legacy_users(
    database: AsyncIOMotorDatabase,
) -> None:
    """
    Bring existing user documents in line with the RBAC model.

    Idempotent and non-destructive: no user is deleted and no other
    field is touched.

        role == "super_admin"        -> "superadmin"
        role missing / invalid       -> "user"   (fail closed)
        is_active missing            -> True
    """

    users_col = database["users"]

    await users_col.update_many(
        {"role": "super_admin"},
        {"$set": {"role": "superadmin"}},
    )

    await users_col.update_many(
        {
            "role": {
                "$nin": [
                    "user",
                    "admin",
                    "superadmin",
                ]
            }
        },
        {"$set": {"role": "user"}},
    )

    await users_col.update_many(
        {"is_active": {"$exists": False}},
        {"$set": {"is_active": True}},
    )


# ============================================================
# Database dependency
# ============================================================

async def get_database() -> AsyncIOMotorDatabase:
    """
    Return the initialized MongoDB database instance.

    Used by FastAPI dependency injection.
    """

    if db is None:
        raise RuntimeError(
            "Database not initialized. "
            "Call connect_to_mongo() during "
            "application startup."
        )

    return db