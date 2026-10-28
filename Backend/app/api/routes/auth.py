"""
Authentication routes.

POST /auth/register  – create a new user account
POST /auth/login     – exchange credentials for a JWT
"""

from fastapi import APIRouter, HTTPException, status

from app.dependencies import Database
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserRegister, UserResponse
from app.services.auth_service import (
    AccountDisabledError,
    AuthService,
)
from app.services.audit_service import AuditService
from app.utils.response import ok


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
    description=(
        "Creates a new account with the default **user** role. "
        "Public registration cannot create administrator accounts."
    ),
)
async def register(
    payload: UserRegister,
    db: Database,
) -> dict:
    """
    Register a new user.

    Public registration always creates a normal user.
    The client cannot register itself as admin or superadmin.
    """

    auth_service = AuthService(db)
    audit_service = AuditService(db)

    # ---------------------------------------------------------
    # IMPORTANT:
    # Public registration must ALWAYS create a normal user.
    #
    # UserRegister has no `role` field, so even if someone
    # manually sends:
    #
    # {
    #     "name": "Attacker",
    #     "email": "attacker@example.com",
    #     "password": "password",
    #     "role": "superadmin"
    # }
    #
    # the elevated role is dropped during request validation, and
    # AuthService.register() additionally hard-codes role="user".
    # ---------------------------------------------------------

    try:
        user = await auth_service.register(payload)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    # ---------------------------------------------------------
    # Log user creation
    # ---------------------------------------------------------
    await audit_service.log_user_created(
        user_id=user["_id"],
        created_by=user["_id"],
        email=user["email"],
        role=user["role"],
    )

    # ---------------------------------------------------------
    # Convert MongoDB document into API response format
    # ---------------------------------------------------------
    user_response = {
        "id": user["_id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "is_active": user.get("is_active", True),
        "created_at": user["created_at"],
        "updated_at": user["updated_at"],
    }

    return ok(
        data=UserResponse.model_validate(
            user_response
        ).model_dump(),
        message="Account created successfully.",
    )


@router.post(
    "/login",
    summary="Authenticate and obtain a JWT access token",
)
async def login(
    payload: LoginRequest,
    db: Database,
) -> dict:
    """
    Authenticate a user and return a JWT access token.

    The user's role is returned as part of the authenticated
    user object and will be used by the RBAC layer.
    """

    auth_service = AuthService(db)
    audit_service = AuditService(db)

    try:
        result = await auth_service.login(
            payload.email,
            payload.password,
        )

    except AccountDisabledError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ---------------------------------------------------------
    # Log login event
    # ---------------------------------------------------------
    await audit_service.log_user_login(
        user_id=result["user"]["id"],
        email=result["user"]["email"],
    )

    # ---------------------------------------------------------
    # Make sure the user object contains all fields required
    # by UserResponse.
    # ---------------------------------------------------------
    user_data = result["user"]

    user_response = {
        "id": user_data["id"],
        "name": user_data["name"],
        "email": user_data["email"],
        "role": user_data["role"],
        "is_active": user_data.get("is_active", True),
        "created_at": user_data.get("created_at"),
        "updated_at": user_data.get("updated_at"),
    }

    token_data = TokenResponse(
        access_token=result["access_token"],
        token_type=result["token_type"],
        expires_in=result["expires_in"],
        user=UserResponse.model_validate(
            user_response
        ),
    )

    return ok(
        data=token_data.model_dump(),
        message="Login successful.",
    )