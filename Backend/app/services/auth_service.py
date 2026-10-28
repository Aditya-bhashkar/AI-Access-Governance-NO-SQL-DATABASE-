"""
Authentication service – handles login, registration, and JWT operations.

Responsibilities:
- User registration with validation
- Login authentication
- JWT token creation and validation
- Password hashing/verification
- Role-aware authentication
"""

from datetime import timedelta
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.permissions import ROLE_USER, normalize_role
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate, UserRegister


class AccountDisabledError(Exception):
    """Raised when valid credentials belong to a deactivated account."""


class AuthService:
    """Service for authentication operations."""

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
    ):
        """
        Initialize service with database instance.

        Args:
            db: Motor AsyncIOMotorDatabase instance
        """
        self.db = db
        self.user_repo = UserRepository(db)

    async def register(
        self,
        data: UserRegister,
    ) -> dict:
        """
        Register a new user.

        Public registration always creates a normal
        user account. Elevated roles must be assigned
        through protected administrative operations.

        Args:
            data: UserRegister schema with name, email and
                  password. It has no role field at all.

        Returns:
            Created user document.

        Raises:
            ValueError: If email already exists.
        """

        # -----------------------------------------------------
        # Public registration must never create an elevated
        # account.
        #
        # Even if a client sends:
        #
        #     role = "admin"
        #
        # or:
        #
        #     role = "superadmin"
        #
        # the registration service forces the role to "user".
        # -----------------------------------------------------
        new_user = UserCreate(
            name=data.name,
            email=data.email,
            password=data.password,
            role=ROLE_USER,
        )

        # -----------------------------------------------------
        # Check if email already exists
        # -----------------------------------------------------
        if await self.user_repo.email_exists(
            new_user.email
        ):
            raise ValueError(
                f"Email '{new_user.email}' already registered."
            )

        # -----------------------------------------------------
        # Hash password
        # -----------------------------------------------------
        hashed_password = hash_password(
            new_user.password
        )

        # -----------------------------------------------------
        # Create user
        # -----------------------------------------------------
        user = await self.user_repo.create(
            new_user,
            hashed_password,
        )

        return user

    async def login(
        self,
        email: str,
        password: str,
    ) -> dict:
        """
        Authenticate user and return JWT token.

        Args:
            email: User email.
            password: Plain-text password.

        Returns:
            Dictionary containing:
            - access_token
            - token_type
            - expires_in
            - user data

        Raises:
            ValueError: If credentials are invalid.
            AccountDisabledError: If the credentials are valid but
                the account has been deactivated.
        """

        # -----------------------------------------------------
        # Find user by email
        # -----------------------------------------------------
        user = await self.user_repo.get_by_email(
            email
        )

        # -----------------------------------------------------
        # Validate credentials
        # -----------------------------------------------------
        if (
            not user
            or not verify_password(
                password,
                user["hashed_password"],
            )
        ):
            raise ValueError(
                "Incorrect email or password."
            )

        # -----------------------------------------------------
        # Deactivated accounts cannot authenticate.
        #
        # Checked only AFTER the password is verified so the
        # account status is not revealed to someone guessing
        # passwords.
        # -----------------------------------------------------
        if user.get("is_active", True) is False:
            raise AccountDisabledError(
                "Your account has been deactivated. "
                "Contact an administrator."
            )

        # -----------------------------------------------------
        # Create JWT token
        #
        # Include both the user's ID and role.
        # The role will be used by the RBAC dependency.
        # -----------------------------------------------------
        user_id = str(user["_id"])
        user_role = normalize_role(
            user.get("role")
        )

        expires_delta = timedelta(
            hours=1
        )

        token = create_access_token(
            subject=user_id,
            expires_delta=expires_delta,
            additional_claims={
                "role": user_role,
                "email": user["email"],
            },
        )

        # -----------------------------------------------------
        # Return authentication result
        # -----------------------------------------------------
        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": int(
                expires_delta.total_seconds()
            ),
            "user": {
                "id": str(user["_id"]),
                "name": user["name"],
                "email": user["email"],
                "role": user_role,
                "is_active": True,
                "created_at": user["created_at"],
                "updated_at": user["updated_at"],
            },
        }

    async def get_user_by_email(
        self,
        email: str,
    ) -> Optional[dict]:
        """
        Get user by email.

        Args:
            email: User email.

        Returns:
            User document or None.
        """

        return await self.user_repo.get_by_email(
            email
        )

    async def get_user_by_id(
        self,
        user_id: str,
    ) -> Optional[dict]:
        """
        Get user by ID.

        Args:
            user_id: MongoDB ObjectId as string.

        Returns:
            User document or None.
        """

        return await self.user_repo.get_by_id(
            user_id
        )