"""
Migration script: PostgreSQL to MongoDB

This script migrates data from the existing PostgreSQL database to MongoDB.

Usage:
    python migrate_postgres_to_mongodb.py

Requirements:
    - Source PostgreSQL database running with existing schema
    - Target MongoDB database ready
    - Environment variables: DATABASE_URL, MONGODB_URL, MONGODB_DB_NAME

This script is a one-time utility and is NOT required for normal app operation.
"""

import asyncio
import os
from datetime import datetime

import pymongo
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session

# Configure source and target databases
POSTGRES_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/db")
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "ai_access_governance")


def migrate():
    """Perform the migration from PostgreSQL to MongoDB."""
    
    print("=" * 80)
    print("PostgreSQL to MongoDB Migration")
    print("=" * 80)
    
    try:
        # Connect to PostgreSQL
        engine = create_engine(POSTGRES_URL)
        db_session = Session(engine)
        
        # Connect to MongoDB
        mongo_client = pymongo.MongoClient(MONGODB_URL)
        mongo_db = mongo_client[MONGODB_DB_NAME]
        
        print(f"\n✓ Connected to PostgreSQL")
        print(f"✓ Connected to MongoDB: {MONGODB_DB_NAME}")
        
        # Get table inspector
        inspector = inspect(engine)
        
        # Migrate users
        print("\n--- Migrating Users ---")
        users_count = migrate_users(db_session, mongo_db, inspector)
        print(f"✓ Migrated {users_count} user(s)")
        
        # Migrate API access records
        print("\n--- Migrating API Access Records ---")
        records_count = migrate_api_access(db_session, mongo_db, inspector)
        print(f"✓ Migrated {records_count} API access record(s)")
        
        # Create indexes
        print("\n--- Creating Indexes ---")
        create_indexes(mongo_db)
        print("✓ Indexes created")
        
        print("\n" + "=" * 80)
        print("Migration completed successfully!")
        print("=" * 80)
        print(f"\nSummary:")
        print(f"  - Users migrated: {users_count}")
        print(f"  - API Access records migrated: {records_count}")
        print(f"\nMongoDB database: {MONGODB_DB_NAME}")
        print(f"Collections created: users, api_access, audit_logs")
        
        db_session.close()
        mongo_client.close()
        
    except Exception as e:
        print(f"\n✗ Migration failed: {str(e)}")
        raise


def migrate_users(db_session: Session, mongo_db, inspector) -> int:
    """Migrate users from PostgreSQL to MongoDB."""
    
    # Check if users table exists
    if "users" not in inspector.get_table_names():
        print("  No users table found in PostgreSQL")
        return 0
    
    # Query all users from PostgreSQL
    from sqlalchemy import text
    
    query = text("SELECT id, name, email, hashed_password, role, created_at, updated_at FROM users")
    result = db_session.execute(query)
    
    users_collection = mongo_db["users"]
    
    # Create a mapping of PostgreSQL user IDs to MongoDB ObjectIds
    id_mapping = {}
    
    count = 0
    for row in result:
        user_doc = {
            "name": row[1],
            "email": row[2],
            "hashed_password": row[3],
            "role": row[4],
            "created_at": row[5] or datetime.utcnow(),
            "updated_at": row[6] or datetime.utcnow(),
        }
        
        result = users_collection.insert_one(user_doc)
        id_mapping[row[0]] = str(result.inserted_id)  # Map PostgreSQL ID to MongoDB ID
        count += 1
    
    # Save ID mapping for use in API access migration
    with open(".migration_id_map.txt", "w") as f:
        for pg_id, mongo_id in id_mapping.items():
            f.write(f"{pg_id}|{mongo_id}\n")
    
    return count


def migrate_api_access(db_session: Session, mongo_db, inspector) -> int:
    """Migrate API access records from PostgreSQL to MongoDB."""
    
    # Check if api_access table exists
    if "api_access" not in inspector.get_table_names():
        print("  No api_access table found in PostgreSQL")
        return 0
    
    # Load ID mapping
    id_mapping = {}
    if os.path.exists(".migration_id_map.txt"):
        with open(".migration_id_map.txt", "r") as f:
            for line in f:
                parts = line.strip().split("|")
                if len(parts) == 2:
                    id_mapping[int(parts[0])] = parts[1]
    
    # Query all API access records
    from sqlalchemy import text
    
    query = text("""
        SELECT id, username, application_name, business_unit, it_spoke, 
               business_spoke, vendor, date_issued, expiry_date, notes,
               created_by, created_at, updated_at
        FROM api_access
    """)
    result = db_session.execute(query)
    
    api_access_collection = mongo_db["api_access"]
    
    count = 0
    for row in result:
        from bson import ObjectId
        
        created_by_id = None
        if row[10] and row[10] in id_mapping:
            created_by_id = ObjectId(id_mapping[row[10]])
        
        record_doc = {
            "username": row[1],
            "application_name": row[2],
            "business_unit": row[3],
            "it_spoke": row[4],
            "business_spoke": row[5],
            "vendor": row[6],
            "date_issued": row[7],
            "expiry_date": row[8],
            "notes": row[9],
            "created_by": created_by_id,
            "created_at": row[11] or datetime.utcnow(),
            "updated_at": row[12] or datetime.utcnow(),
        }
        
        api_access_collection.insert_one(record_doc)
        count += 1
    
    return count


def create_indexes(mongo_db) -> None:
    """Create MongoDB indexes for optimal performance."""
    
    # Users indexes
    users_col = mongo_db["users"]
    users_col.create_index("email", unique=True)
    
    # API Access indexes
    api_access_col = mongo_db["api_access"]
    api_access_col.create_index("username")
    api_access_col.create_index("application_name")
    api_access_col.create_index("business_unit")
    api_access_col.create_index("vendor")
    api_access_col.create_index("expiry_date")
    api_access_col.create_index("created_at")
    api_access_col.create_index("created_by")
    api_access_col.create_index([("business_unit", 1), ("vendor", 1)])
    api_access_col.create_index([("expiry_date", 1), ("created_at", 1)])
    
    # Audit logs indexes (empty collection, but index for future use)
    audit_logs_col = mongo_db["audit_logs"]
    audit_logs_col.create_index("timestamp")
    audit_logs_col.create_index("entity_id")
    audit_logs_col.create_index([("entity_type", 1), ("entity_id", 1)])
    audit_logs_col.create_index("performed_by")


if __name__ == "__main__":
    migrate()