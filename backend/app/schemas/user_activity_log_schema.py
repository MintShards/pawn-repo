"""
User Activity Log Schemas

Pydantic schemas for user activity log API requests and responses.
"""

from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.models.user_activity_log_model import UserActivityType, ActivitySeverity


class UserActivityLogResponse(BaseModel):
    """Response schema for user activity log entries"""

    id: str = Field(..., description="Activity log entry ID")
    user_id: str = Field(..., description="User who performed the action")
    activity_type: UserActivityType = Field(..., description="Type of activity")
    severity: ActivitySeverity = Field(..., description="Severity level")
    timestamp: datetime = Field(..., description="When activity occurred")
    description: str = Field(..., description="Human-readable description")
    details: Optional[str] = Field(None, description="Additional details")

    # Context
    ip_address: Optional[str] = Field(None, description="IP address")
    user_agent: Optional[str] = Field(None, description="User agent")
    session_id: Optional[str] = Field(None, description="Session ID")
    request_id: Optional[str] = Field(None, description="Request ID")

    # Related entities
    target_user_id: Optional[str] = Field(None, description="Target user ID")
    target_customer_phone: Optional[str] = Field(None, description="Target customer phone")
    target_transaction_id: Optional[str] = Field(None, description="Target transaction ID")
    target_resource_id: Optional[str] = Field(None, description="Generic resource ID")
    resource_type: Optional[str] = Field(None, description="Resource type")

    # Metadata
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")
    previous_value: Optional[str] = Field(None, description="Previous value")
    new_value: Optional[str] = Field(None, description="New value")

    # Status
    is_success: bool = Field(..., description="Success status")
    error_message: Optional[str] = Field(None, description="Error message if failed")

    model_config = ConfigDict(from_attributes=True)


class UserActivityLogListResponse(BaseModel):
    """Response schema for list of activity logs with pagination"""

    logs: List[UserActivityLogResponse] = Field(..., description="List of activity log entries")
    total: int = Field(..., description="Total number of logs matching filters")
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Number of logs per page")
    pages: int = Field(..., description="Total number of pages")

    model_config = ConfigDict(from_attributes=True)


class UserActivityLogFilters(BaseModel):
    """Filters for querying user activity logs"""

    user_id: Optional[str] = Field(None, description="Filter by user ID")
    target_user_id: Optional[str] = Field(None, description="Filter by target user ID (admin actions)")
    activity_types: Optional[List[UserActivityType]] = Field(None, description="Filter by activity types")
    severities: Optional[List[ActivitySeverity]] = Field(None, description="Filter by severity levels")
    start_date: Optional[datetime] = Field(None, description="Filter logs after this date")
    end_date: Optional[datetime] = Field(None, description="Filter logs before this date")
    is_success: Optional[bool] = Field(None, description="Filter by success status")
    search: Optional[str] = Field(None, description="Search in description and details")
    page: int = Field(1, ge=1, description="Page number")
    per_page: int = Field(50, ge=1, le=100, description="Items per page")

    model_config = ConfigDict(from_attributes=True)


class UserActivityStatsResponse(BaseModel):
    """Response schema for user activity statistics"""

    total_activities: int = Field(..., description="Total number of activities")
    total_logins: int = Field(..., description="Total successful logins")
    failed_logins: int = Field(..., description="Total failed login attempts")
    last_activity: Optional[datetime] = Field(None, description="Most recent activity timestamp")
    last_login: Optional[datetime] = Field(None, description="Most recent successful login")
    activities_by_type: Dict[str, int] = Field(..., description="Count of activities by type")
    activities_by_severity: Dict[str, int] = Field(..., description="Count of activities by severity")
    recent_activities: List[UserActivityLogResponse] = Field(..., description="Most recent activities")

    model_config = ConfigDict(from_attributes=True)
