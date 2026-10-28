"""
Pydantic schemas for API Access records.

Supports:
- Frontend camelCase payloads
- Backend snake_case fields
- Create / Update / Response schemas
- MongoDB ObjectId values represented as strings
- Record ownership via user_id
- Computed record status
- Pagination metadata
"""

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


# -------------------------------------------------------------------
# Allowed values
# -------------------------------------------------------------------

VendorLiteral = Literal[
    "ChatGPT",
    "Gemini",
    "Claude",
    "Microsoft Copilot",
    "GitHub Copilot",
    "AWS Bedrock",
    "Azure OpenAI",
    "Custom",
]

StatusLiteral = Literal[
    "Active",
    "Expiring Soon",
    "Expired",
]


# -------------------------------------------------------------------
# Base schema
# -------------------------------------------------------------------

class ApiAccessBase(BaseModel):
    """
    Common fields shared by create and response models.

    The API accepts both:
        applicationName
        application_name

    because populate_by_name=True allows the Python field name
    in addition to the configured alias.
    """

    username: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Employee username.",
    )

    application_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        alias="applicationName",
        description="Application using the API access.",
    )

    business_unit: str = Field(
        ...,
        min_length=1,
        max_length=255,
        alias="businessUnit",
        description="Business unit associated with the access.",
    )

    it_spoke: str = Field(
        ...,
        min_length=1,
        max_length=255,
        alias="itSpoke",
        description="IT SPOC responsible for the access.",
    )

    business_spoke: str = Field(
        ...,
        min_length=1,
        max_length=255,
        alias="businessSpoke",
        description="Business SPOC responsible for the access.",
    )

    vendor: VendorLiteral = Field(
        ...,
        description="AI vendor providing the API.",
    )

    date_issued: date = Field(
        ...,
        alias="dateIssued",
        description="Date the API key/access was issued.",
    )

    expiry_date: date = Field(
        ...,
        alias="expiryDate",
        description="Date the API key/access expires.",
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Optional notes about the API access.",
    )

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
    )

    @model_validator(mode="after")
    def expiry_must_be_after_issue(self) -> "ApiAccessBase":
        """
        Ensure expiry date is strictly after issue date.
        """

        if self.expiry_date <= self.date_issued:
            raise ValueError(
                "expiry_date must be strictly after date_issued."
            )

        return self


# -------------------------------------------------------------------
# Create
# -------------------------------------------------------------------

class ApiAccessCreate(ApiAccessBase):
    """
    Schema for:

        POST /api-access

    The authenticated user's ID is assigned by the backend.
    Clients cannot choose the owner.
    """

    pass


# -------------------------------------------------------------------
# Update
# -------------------------------------------------------------------

class ApiAccessUpdate(BaseModel):
    """
    Schema for:

        PUT /api-access/{record_id}

    All fields are optional so partial updates are possible.
    """

    username: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    application_name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=255,
        alias="applicationName",
    )

    business_unit: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=255,
        alias="businessUnit",
    )

    it_spoke: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=255,
        alias="itSpoke",
    )

    business_spoke: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=255,
        alias="businessSpoke",
    )

    vendor: Optional[VendorLiteral] = Field(
        default=None,
    )

    date_issued: Optional[date] = Field(
        default=None,
        alias="dateIssued",
    )

    expiry_date: Optional[date] = Field(
        default=None,
        alias="expiryDate",
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=2000,
    )

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
    )

    @model_validator(mode="after")
    def expiry_after_issue_if_both_present(
        self,
    ) -> "ApiAccessUpdate":
        """
        Validate the date relationship when both dates are supplied
        in the same update request.

        Final-date validation for partial updates should additionally
        be handled by the service layer using the existing record.
        """

        if (
            self.date_issued is not None
            and self.expiry_date is not None
        ):
            if self.expiry_date <= self.date_issued:
                raise ValueError(
                    "expiry_date must be strictly after date_issued."
                )

        return self


# -------------------------------------------------------------------
# Response
# -------------------------------------------------------------------

class ApiAccessResponse(ApiAccessBase):
    """
    Full API Access record returned by read/write endpoints.
    """

    # MongoDB document ID represented as a string.
    id: str

    # Owner of this API access record.
    #
    # Normal users will normally only receive their own records.
    # Admins and superadmins can receive records belonging to
    # other users as well.
    user_id: Optional[str] = Field(
        default=None,
        alias="userId",
    )

    # Computed by the service/repository layer.
    status: StatusLiteral

    # User who originally created the record.
    created_by: Optional[str] = Field(
        default=None,
        alias="createdBy",
    )

    created_at: datetime = Field(
        ...,
        alias="createdAt",
    )

    updated_at: datetime = Field(
        ...,
        alias="updatedAt",
    )

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


# -------------------------------------------------------------------
# Pagination
# -------------------------------------------------------------------

class PaginationMeta(BaseModel):
    """
    Pagination information returned by list endpoints.
    """

    page: int
    limit: int
    total: int
    total_pages: int


# -------------------------------------------------------------------
# Generic API response
# -------------------------------------------------------------------

class ApiResponse(BaseModel):
    """
    Standard response envelope used by the API.
    """

    success: bool = True
    message: str = "OK"
    data: object = None
    pagination: Optional[PaginationMeta] = None