"""
Bootstrap the first (or an additional) superadmin.

Superadmins cannot be created through the public API or through the
admin-management API on purpose, so this is done out-of-band by someone
with access to the server.

Usage (from the backend folder that contains `app/`):

    python -m app.scripts.create_superadmin you@example.com

- If the email already exists, that account is promoted to superadmin
  (and re-activated).
- If it does not exist, you are prompted for a name and a password and a
  new superadmin account is created.
"""

import asyncio
import sys
from datetime import datetime, timezone
from getpass import getpass

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.core.security import hash_password


async def main(email: str) -> None:
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    users = client[settings.MONGODB_DB_NAME]["users"]

    now = datetime.now(timezone.utc)

    existing = await users.find_one({"email": email})

    if existing:
        await users.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "role": "superadmin",
                    "is_active": True,
                    "updated_at": now,
                }
            },
        )
        print(f"Promoted existing account {email} to superadmin.")
        client.close()
        return

    name = input("Full name: ").strip()
    password = getpass("Password (min 8 chars): ")

    if not name or len(password) < 8:
        print("Name is required and the password must be >= 8 characters.")
        client.close()
        sys.exit(1)

    await users.insert_one(
        {
            "name": name,
            "email": email,
            "hashed_password": hash_password(password),
            "role": "superadmin",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
    )

    print(f"Created superadmin {email}.")
    client.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python -m app.scripts.create_superadmin <email>")
        sys.exit(1)

    asyncio.run(main(sys.argv[1].strip()))
