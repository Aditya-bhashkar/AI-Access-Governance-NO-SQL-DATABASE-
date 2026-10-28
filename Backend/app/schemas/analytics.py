"""
Pydantic schemas for analytics and statistics.
"""

from typing import List

from pydantic import BaseModel, Field


class DistributionItem(BaseModel):
    """Item in a distribution (e.g., vendor or business unit)."""

    name: str = Field(
        ...,
        description="Name of the vendor or business unit",
    )
    count: int = Field(
        ...,
        description="Number of records",
    )


class VendorDistribution(BaseModel):
    """Distribution of records by vendor."""

    vendor: str
    count: int


class BusinessUnitDistribution(BaseModel):
    """Distribution of records by business unit."""

    business_unit: str
    count: int


class AnalyticsOverview(BaseModel):
    """Dashboard overview statistics."""

    total: int = Field(
        ...,
        description="Total API access records",
    )
    active: int = Field(
        ...,
        description="Active API access records",
    )
    expiring_soon: int = Field(
        ...,
        description="Records expiring within 30 days",
    )
    expired: int = Field(
        ...,
        description="Expired API access records",
    )


class AnalyticsResponse(BaseModel):
    """Complete analytics response for dashboard."""

    overview: AnalyticsOverview

    by_vendor: List[VendorDistribution] = Field(
        default_factory=list,
        description="Records grouped by vendor",
    )

    by_business_unit: List[BusinessUnitDistribution] = Field(
        default_factory=list,
        description="Records grouped by business unit",
    )