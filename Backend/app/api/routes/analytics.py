"""
Analytics routes – dashboard and analytics endpoints.

Endpoints:
- GET /analytics/overview
- GET /analytics/complete
- GET /analytics/vendor
- GET /analytics/business-unit
- GET /analytics/expiring-soon
- GET /analytics/recent

Authorization:
- user       -> analytics for own records
- admin      -> analytics for all records
- superadmin -> analytics for all records
"""

from fastapi import APIRouter, Query

from app.dependencies import CurrentUser, Database
from app.services.analytics_service import AnalyticsService
from app.utils.response import ok


router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
)


# -------------------------------------------------------------------
# Overview
# -------------------------------------------------------------------

@router.get(
    "/overview",
    summary="Get dashboard overview statistics",
    description=(
        "Returns total, active, expiring-soon, and expired "
        "counts according to the authenticated user's access."
    ),
)
async def get_analytics_overview(
    db: Database,
    current_user: CurrentUser,
) -> dict:
    service = AnalyticsService(db)

    result = await service.get_overview(
        current_user=current_user,
    )

    return ok(
        data=result,
        message="Analytics overview retrieved successfully.",
    )


# -------------------------------------------------------------------
# Complete analytics
# -------------------------------------------------------------------

@router.get(
    "/complete",
    summary="Get complete analytics",
    description=(
        "Returns complete analytics including distributions "
        "according to the authenticated user's access."
    ),
)
async def get_complete_analytics(
    db: Database,
    current_user: CurrentUser,
) -> dict:
    service = AnalyticsService(db)

    result = await service.get_complete_analytics(
        current_user=current_user,
    )

    return ok(
        data=result,
        message="Complete analytics retrieved successfully.",
    )


# -------------------------------------------------------------------
# Vendor analytics
# -------------------------------------------------------------------

@router.get(
    "/vendor",
    summary="Get vendor analytics",
    description=(
        "Returns analytics grouped by AI vendor "
        "according to the authenticated user's access."
    ),
)
async def get_vendor_analytics(
    db: Database,
    current_user: CurrentUser,
) -> dict:
    service = AnalyticsService(db)

    result = await service.get_vendor_analytics(
        current_user=current_user,
    )

    return ok(
        data=result,
        message="Vendor analytics retrieved successfully.",
    )


# -------------------------------------------------------------------
# Business-unit analytics
# -------------------------------------------------------------------

@router.get(
    "/business-unit",
    summary="Get business unit analytics",
    description=(
        "Returns analytics grouped by business unit "
        "according to the authenticated user's access."
    ),
)
async def get_business_unit_analytics(
    db: Database,
    current_user: CurrentUser,
) -> dict:
    service = AnalyticsService(db)

    result = await service.get_business_unit_analytics(
        current_user=current_user,
    )

    return ok(
        data=result,
        message="Business unit analytics retrieved successfully.",
    )


# -------------------------------------------------------------------
# Expiring soon
# -------------------------------------------------------------------

@router.get(
    "/expiring-soon",
    summary="Get expiring API accesses",
    description=(
        "Returns API access records that are expiring soon, "
        "ordered by nearest expiry, according to the "
        "authenticated user's access."
    ),
)
async def get_expiring_soon(
    db: Database,
    current_user: CurrentUser,
    limit: int = Query(
        default=10,
        ge=1,
        le=100,
        description="Maximum number of expiring records to return.",
    ),
) -> dict:
    service = AnalyticsService(db)

    result = await service.get_expiring_soon_details(
        current_user=current_user,
        limit=limit,
    )

    return ok(
        data=result,
        message="Expiring-soon records retrieved successfully.",
    )


# -------------------------------------------------------------------
# Recent records
# -------------------------------------------------------------------

@router.get(
    "/recent",
    summary="Get recent API access records",
    description=(
        "Returns recently created API access records "
        "according to the authenticated user's access."
    ),
)
async def get_recent_analytics(
    db: Database,
    current_user: CurrentUser,
    limit: int = Query(
        default=10,
        ge=1,
        le=100,
        description="Maximum number of recent records.",
    ),
) -> dict:
    service = AnalyticsService(db)

    result = await service.get_recent_records(
        current_user=current_user,
        limit=limit,
    )

    return ok(
        data=result,
        message="Recent API access records retrieved successfully.",
    )