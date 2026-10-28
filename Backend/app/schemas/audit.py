"""
Pydantic schemas for audit logs.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class AuditLogMetadata(BaseModel):
    """Metadata for audit log (non-sensitive information only)."""
    
    vendor: Optional[str] = None
    application_name: Optional[str] = None
    username: Optional[str] = None
    expiry_date: Optional[str] = None


class AuditLogResponse(BaseModel):
    """Audit log entry response."""
    
    id: str = Field(..., alias="_id")
    action: str  # "CREATE", "UPDATE", "DELETE", "LOGIN"
    entity_type: str  # "api_access", "user"
    entity_id: Optional[str] = None
    performed_by: Optional[str] = None
    performed_by_name: Optional[str] = None  # Enriched from user lookup
    performed_by_email: Optional[str] = None  # Enriched from user lookup
    timestamp: datetime
    metadata: Optional[dict] = None
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class EntityHistoryResponse(BaseModel):
    """Response for entity audit history."""
    
    entity_id: str
    entity_type: str
    history: list[AuditLogResponse] = Field(default_factory=list)