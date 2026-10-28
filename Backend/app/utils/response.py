"""
Helper that builds the standard API response envelope.
"""

from typing import Any, Optional

from app.schemas.api_access import ApiResponse, PaginationMeta


def ok(
    data: Any = None,
    message: str = "OK",
    page: Optional[int] = None,
    limit: Optional[int] = None,
    total: Optional[int] = None,
) -> dict:
 
    pagination = None
    if page is not None and limit is not None and total is not None:
        total_pages = max(1, -(-total // limit))  # ceiling division
        pagination = PaginationMeta(page=page, limit=limit, total=total, total_pages=total_pages)

    return ApiResponse(
        success=True,
        message=message,
        data=data,
        pagination=pagination,
    ).model_dump()


def err(message: str, data: Any = None) -> dict:
    """Build an error response envelope (used inside HTTPException detail)."""
    return ApiResponse(success=False, message=message, data=data).model_dump()