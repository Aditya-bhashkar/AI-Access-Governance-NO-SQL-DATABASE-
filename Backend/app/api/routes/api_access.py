"""
API Access routes – full CRUD with search, filter, sort, and pagination.

All endpoints require a valid JWT bearer token.

Authorization:
- user       -> own records only
- admin      -> all records
- superadmin -> all records

Operations are performed server-side by MongoDB.
"""

from datetime import date
from typing import Optional

from fastapi import (
    APIRouter,
    HTTPException,
    Query,
    status,
)

from app.dependencies import CurrentUser, Database
from app.schemas.api_access import (
    ApiAccessCreate,
    ApiAccessResponse,
    ApiAccessUpdate,
)
from app.services.api_access_service import (
    ApiAccessService,
)
from app.utils.response import ok


router = APIRouter(
    prefix="/api-access",
    tags=["API Access"],
)


# ============================================================
# Serialization
# ============================================================

def _serialize(record: dict) -> dict:
    """
    Convert MongoDB record into API response format.

    Converts MongoDB ObjectIds to strings and includes
    ownership information.
    """

    payload = {
        "id": str(
            record["_id"]
        ),

        # ----------------------------------------------------
        # Ownership
        # ----------------------------------------------------

        "user_id": (
            str(record["user_id"])
            if record.get("user_id") is not None
            else None
        ),

        # ----------------------------------------------------
        # Record fields
        # ----------------------------------------------------

        "username": record["username"],

        "application_name": (
            record["application_name"]
        ),

        "business_unit": (
            record["business_unit"]
        ),

        "it_spoke": (
            record["it_spoke"]
        ),

        "business_spoke": (
            record["business_spoke"]
        ),

        "vendor": (
            record["vendor"]
        ),

        "date_issued": (
            record["date_issued"]
        ),

        "expiry_date": (
            record["expiry_date"]
        ),

        "notes": (
            record.get("notes")
        ),

        # ----------------------------------------------------
        # Computed / audit metadata
        # ----------------------------------------------------

        "status": (
            record.get("status")
        ),

        "created_by": (
            str(record["created_by"])
            if record.get("created_by") is not None
            else None
        ),

        "created_at": (
            record["created_at"]
        ),

        "updated_at": (
            record["updated_at"]
        ),
    }

    return (
        ApiAccessResponse
        .model_validate(payload)
        .model_dump(
            by_alias=True
        )
    )


# ============================================================
# List
# ============================================================

@router.get(
    "",
    summary="List API access records",
    description=(
        "Returns a paginated list of API access records. "
        "Normal users see only their own records. "
        "Admins and superadmins can see all records. "
        "Supports full-text search, field-level filters, "
        "and column-level sorting."
    ),
)
async def list_api_access(
    db: Database,
    current_user: CurrentUser,

    # --------------------------------------------------------
    # Pagination
    # --------------------------------------------------------

    page: int = Query(
        default=1,
        ge=1,
        description="Page number (1-based).",
    ),

    limit: int = Query(
        default=10,
        ge=1,
        le=500,
        description="Rows per page.",
    ),

    # --------------------------------------------------------
    # Search
    # --------------------------------------------------------

    search: Optional[str] = Query(
        default=None,
        description=(
            "Search across username, application, "
            "business unit and vendor."
        ),
    ),

    # --------------------------------------------------------
    # Filters
    # --------------------------------------------------------

    vendor: Optional[str] = Query(
        default=None,
        description="Filter by vendor name.",
    ),

    business_unit: Optional[str] = Query(
        default=None,
        description="Filter by business unit.",
    ),

    issue_date_from: Optional[date] = Query(
        default=None,
    ),

    issue_date_to: Optional[date] = Query(
        default=None,
    ),

    expiry_date_from: Optional[date] = Query(
        default=None,
    ),

    expiry_date_to: Optional[date] = Query(
        default=None,
    ),

    record_status: Optional[str] = Query(
        default=None,
        alias="status",
        description=(
            "Active | Expiring Soon | Expired"
        ),
    ),

    # --------------------------------------------------------
    # Sorting
    # --------------------------------------------------------

    sort_by: str = Query(
        default="created_at",
        description="Column to sort by.",
    ),

    sort_order: str = Query(
        default="desc",
        pattern="^(asc|desc)$",
    ),
) -> dict:
    """
    List API access records with pagination and filtering.

    Ownership filtering is handled by ApiAccessService and
    ApiAccessRepository based on the authenticated user's role.
    """

    service = ApiAccessService(
        db
    )

    records, total = await service.list_records(
        current_user=current_user,
        page=page,
        limit=limit,
        search=search,
        vendor=vendor,
        business_unit=business_unit,
        issue_date_from=issue_date_from,
        issue_date_to=issue_date_to,
        expiry_date_from=expiry_date_from,
        expiry_date_to=expiry_date_to,
        status=record_status,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    return ok(
        data=[
            _serialize(record)
            for record in records
        ],
        message=(
            f"{total} record(s) found."
        ),
        page=page,
        limit=limit,
        total=total,
    )


# ============================================================
# Get single record
# ============================================================

@router.get(
    "/{record_id}",
    summary="Get a single API access record by ID",
)
async def get_api_access(
    record_id: str,
    db: Database,
    current_user: CurrentUser,
) -> dict:
    """
    Get a single API access record.

    Normal users can only access their own records.
    Admins and superadmins can access any record.
    """

    service = ApiAccessService(
        db
    )

    record = await service.get_record(
        record_id=record_id,
        current_user=current_user,
    )

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"API access record with "
                f"id={record_id} not found."
            ),
        )

    return ok(
        data=_serialize(record),
        message="Record retrieved.",
    )


# ============================================================
# Create
# ============================================================

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new API access record",
)
async def create_api_access_record(
    payload: ApiAccessCreate,
    db: Database,
    current_user: CurrentUser,
) -> dict:
    """
    Create a new API access record.

    The authenticated user automatically becomes
    the record owner.

    Ownership cannot be supplied by the client.
    """

    user_id = str(
        current_user["_id"]
    )

    service = ApiAccessService(
        db
    )

    try:
        record = await service.create_record(
            data=payload,
            created_by=user_id,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=str(exc),
        )

    return ok(
        data=_serialize(record),
        message=(
            "Record created successfully."
        ),
    )


# ============================================================
# Update
# ============================================================

@router.put(
    "/{record_id}",
    summary="Update an existing API access record",
)
async def update_api_access_record(
    record_id: str,
    payload: ApiAccessUpdate,
    db: Database,
    current_user: CurrentUser,
) -> dict:
    """
    Update an API access record.

    Normal users can update only their own records.
    Admins and superadmins can update any record.
    """

    user_id = str(
        current_user["_id"]
    )

    service = ApiAccessService(
        db
    )

    try:
        record = await service.update_record(
            record_id=record_id,
            data=payload,
            updated_by=user_id,
            current_user=current_user,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=str(exc),
        )

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"API access record with "
                f"id={record_id} not found."
            ),
        )

    return ok(
        data=_serialize(record),
        message=(
            "Record updated successfully."
        ),
    )


# ============================================================
# Delete
# ============================================================

@router.delete(
    "/{record_id}",
    summary="Delete an API access record",
)
async def delete_api_access_record(
    record_id: str,
    db: Database,
    current_user: CurrentUser,
) -> dict:
    """
    Delete an API access record.

    Normal users can delete only their own records.
    Admins and superadmins can delete any record.
    """

    user_id = str(
        current_user["_id"]
    )

    service = ApiAccessService(
        db
    )

    deleted = await service.delete_record(
        record_id=record_id,
        deleted_by=user_id,
        current_user=current_user,
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"API access record with "
                f"id={record_id} not found."
            ),
        )

    return ok(
        data={
            "id": record_id,
        },
        message=(
            "Record deleted successfully."
        ),
    )