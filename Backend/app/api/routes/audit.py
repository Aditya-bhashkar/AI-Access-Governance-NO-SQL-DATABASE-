"""
Audit routes – endpoints for retrieving audit history and logs.

Endpoints:
- GET /api-access/{record_id}/audit
    Get audit history for a specific API access record

- GET /audits/recent
    Get recent audit logs (admin/superadmin only)

- GET /audits/user/{user_id}
    Get audit logs for a specific user
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.dependencies import CurrentUser, Database
from app.services.audit_service import AuditService
from app.utils.response import ok


router = APIRouter(
    prefix="",
    tags=["Audit"],
)


# ============================================================
# RBAC helpers
# ============================================================

def _normalize_role(current_user: dict) -> str:
    """
    Return the normalized role of the authenticated user.

    Supports the legacy `super_admin` role name.
    Unknown roles fail closed as `user`.
    """

    role = current_user.get(
        "role",
        "user",
    )

    if role == "super_admin":
        role = "superadmin"

    if role not in {
        "user",
        "admin",
        "superadmin",
    }:
        role = "user"

    return role


def _is_admin(current_user: dict) -> bool:
    """
    Check whether the authenticated user is an admin
    or superadmin.
    """

    return _normalize_role(current_user) in {
        "admin",
        "superadmin",
    }


def _get_current_user_id(
    current_user: dict,
) -> str:
    """
    Get the authenticated user's ID.
    """

    user_id = (
        current_user.get("_id")
        or current_user.get("id")
    )

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user ID is missing.",
        )

    return str(user_id)


# ============================================================
# Record audit history
# ============================================================

@router.get(
    "/api-access/{record_id}/audit",
    summary="Get audit history for a specific API access record",
    description=(
        "Returns the audit trail for an API access record. "
        "Regular users can only access their own records. "
        "Admins and superadmins can access any record."
    ),
)
async def get_record_audit_history(
    record_id: str,
    db: Database,
    current_user: CurrentUser,
    limit: int = Query(
        default=50,
        ge=1,
        le=500,
        description="Max audit logs to return",
    ),
) -> dict:
    """
    Get audit history for a specific API access record.

    Authorization is enforced by AuditService.

    Regular users:
        Only their own records.

    Admin/superadmin:
        Any API access record.
    """

    service = AuditService(db)

    try:
        result = await service.get_record_history(
            record_id=record_id,
            current_user=current_user,
            entity_type="api_access",
            limit=limit,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    return ok(
        data=result,
        message=(
            f"Audit history retrieved "
            f"({result['total']} entries)."
        ),
    )


# ============================================================
# Recent system audit logs
# ============================================================

@router.get(
    "/audits/recent",
    summary="Get recent audit logs",
    description=(
        "Returns recent audit logs across the system. "
        "Accessible only to admins and superadmins."
    ),
)
async def get_recent_audits(
    db: Database,
    current_user: CurrentUser,
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
        description="Max audit logs to return",
    ),
    entity_type: Optional[str] = Query(
        default=None,
        description="Optional filter: 'api_access' or 'user'",
    ),
) -> dict:
    """
    Get recent audit logs across the entire system.

    Only admin and superadmin users are allowed.
    """

    if not _is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Admin or superadmin role required "
                "to view system audit logs."
            ),
        )

    service = AuditService(db)

    result = await service.get_recent_logs(
        limit=limit,
        entity_type=entity_type,
    )

    return ok(
        data=result,
        message=(
            f"Recent audit logs retrieved "
            f"({result['total']} entries)."
        ),
    )


# ============================================================
# User-specific audit logs
# ============================================================

@router.get(
    "/audits/user/{user_id}",
    summary="Get audit logs for a specific user",
    description=(
        "Returns audit logs for actions performed by a user. "
        "Regular users can only access their own audit logs. "
        "Admins and superadmins can access any user's audit logs."
    ),
)
async def get_user_audit_logs(
    user_id: str,
    db: Database,
    current_user: CurrentUser,
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
        description="Max audit logs to return",
    ),
) -> dict:
    """
    Get audit logs for actions performed by a specific user.

    Authorization is enforced both at the route and service level.

    Regular users:
        Can only retrieve their own audit logs.

    Admin/superadmin:
        Can retrieve any user's audit logs.
    """

    current_user_id = _get_current_user_id(
        current_user
    )

    # --------------------------------------------------------
    # Route-level authorization
    # --------------------------------------------------------

    if not _is_admin(current_user):
        if user_id != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You can only view your own audit logs."
                ),
            )

    service = AuditService(db)

    try:
        result = await service.get_user_actions(
            user_id=user_id,
            limit=limit,
            current_user=current_user,
        )

    except PermissionError as e:
        # Service-level defense-in-depth authorization.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return ok(
        data=result,
        message=(
            f"User audit logs retrieved "
            f"({result['total']} entries)."
        ),
    )