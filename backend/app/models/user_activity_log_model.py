"""
User Activity Log Model

Dedicated model for tracking all user-related actions and events for audit trail,
security monitoring, and compliance requirements.
"""

from beanie import Document, Indexed
from pydantic import Field, field_validator, ConfigDict
from datetime import datetime, UTC
from typing import Optional, Dict, Any
from enum import Enum


class UserActivityType(str, Enum):
    """Valid user activity types for tracking"""
    # Authentication events
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    SESSION_EXPIRED = "session_expired"
    TOKEN_REFRESHED = "token_refreshed"
    ACCOUNT_LOCKED = "account_locked"
    ACCOUNT_UNLOCKED = "account_unlocked"

    # Account management
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DELETED = "user_deleted"
    STATUS_CHANGED = "status_changed"
    ROLE_CHANGED = "role_changed"
    PIN_RESET = "pin_reset"
    PIN_CHANGED = "pin_changed"

    # Session management
    SESSION_CREATED = "session_created"
    SESSION_REVOKED = "session_revoked"
    CONCURRENT_SESSION_LIMIT = "concurrent_session_limit"

    # Customer operations
    CUSTOMER_CREATED = "customer_created"
    CUSTOMER_VIEWED = "customer_viewed"
    CUSTOMER_UPDATED = "customer_updated"
    CUSTOMER_DELETED = "customer_deleted"

    # Transaction operations
    TRANSACTION_CREATED = "transaction_created"
    TRANSACTION_VIEWED = "transaction_viewed"
    TRANSACTION_UPDATED = "transaction_updated"
    TRANSACTION_STATUS_CHANGED = "transaction_status_changed"

    # Payment operations
    PAYMENT_PROCESSED = "payment_processed"
    PAYMENT_REVERSED = "payment_reversed"
    EXTENSION_APPLIED = "extension_applied"
    EXTENSION_CANCELLED = "extension_cancelled"

    # System actions
    BULK_OPERATION = "bulk_operation"
    REPORT_GENERATED = "report_generated"
    SETTINGS_CHANGED = "settings_changed"

    # Security events
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    PERMISSION_DENIED = "permission_denied"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"


class ActivitySeverity(str, Enum):
    """Severity level for activity classification"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class UserActivityLog(Document):
    """
    Comprehensive activity log for user actions and system events.

    Provides audit trail, security monitoring, and compliance tracking
    for all user interactions with the system.
    """

    # Core identification
    user_id: str = Field(
        ...,
        description="User ID who performed the action"
    )

    activity_type: UserActivityType = Field(
        ...,
        description="Type of activity performed"
    )

    severity: ActivitySeverity = Field(
        default=ActivitySeverity.INFO,
        description="Severity level of the activity"
    )

    # Temporal tracking
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="UTC timestamp when activity occurred"
    )

    # Activity details
    description: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Human-readable description of the activity"
    )

    details: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Additional technical details about the activity"
    )

    # Context information
    ip_address: Optional[str] = Field(
        default=None,
        description="IP address from which action was performed"
    )

    user_agent: Optional[str] = Field(
        default=None,
        max_length=500,
        description="User agent string from the request"
    )

    session_id: Optional[str] = Field(
        default=None,
        description="Session ID associated with the activity"
    )

    request_id: Optional[str] = Field(
        default=None,
        description="Unique request ID for correlation"
    )

    # Related entities
    target_user_id: Optional[str] = Field(
        default=None,
        description="User ID affected by the action (for admin operations)"
    )

    target_customer_phone: Optional[str] = Field(
        default=None,
        description="Customer phone affected by the action"
    )

    target_transaction_id: Optional[str] = Field(
        default=None,
        description="Transaction ID affected by the action"
    )

    target_resource_id: Optional[str] = Field(
        default=None,
        description="Generic resource ID for other entity types"
    )

    resource_type: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Type of resource affected (payment, extension, etc.)"
    )

    # Metadata
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional metadata as key-value pairs"
    )

    # Change tracking
    previous_value: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Previous value for update operations"
    )

    new_value: Optional[str] = Field(
        default=None,
        max_length=500,
        description="New value for update operations"
    )

    # Status
    is_success: bool = Field(
        default=True,
        description="Whether the activity was successful"
    )

    error_message: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Error message if activity failed"
    )

    @field_validator('description')
    @classmethod
    def validate_description(cls, v: str) -> str:
        """Validate description is not empty."""
        v = v.strip()
        if not v:
            raise ValueError('Description cannot be empty')
        return v

    @field_validator('timestamp')
    @classmethod
    def validate_timestamp(cls, v: datetime) -> datetime:
        """Ensure timestamp is timezone-aware."""
        if v.tzinfo is None:
            return v.replace(tzinfo=UTC)
        return v

    model_config = ConfigDict(
        validate_assignment=True,
        arbitrary_types_allowed=True,
        json_schema_extra={
            "example": {
                "user_id": "69",
                "activity_type": "login_success",
                "severity": "info",
                "description": "User logged in successfully",
                "ip_address": "192.168.1.100",
                "is_success": True
            }
        }
    )

    class Settings:
        name = "user_activity_logs"
        indexes = [
            "user_id",
            "activity_type",
            "timestamp",
            [("user_id", 1), ("timestamp", -1)],  # Compound index for user activity queries
            [("target_user_id", 1), ("timestamp", -1)],  # Compound index for admin action queries
        ]


# Helper functions for creating activity logs
async def log_user_activity(
    user_id: str,
    activity_type: UserActivityType,
    description: str,
    severity: ActivitySeverity = ActivitySeverity.INFO,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    session_id: Optional[str] = None,
    request_id: Optional[str] = None,
    target_user_id: Optional[str] = None,
    target_customer_phone: Optional[str] = None,
    target_transaction_id: Optional[str] = None,
    target_resource_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    previous_value: Optional[str] = None,
    new_value: Optional[str] = None,
    is_success: bool = True,
    error_message: Optional[str] = None
) -> UserActivityLog:
    """
    Create and save a user activity log entry.

    Args:
        user_id: User who performed the action
        activity_type: Type of activity
        description: Human-readable description
        severity: Severity level
        details: Additional technical details
        ip_address: Client IP address
        user_agent: User agent string
        session_id: Session identifier
        request_id: Request correlation ID
        target_user_id: User affected by action
        target_customer_phone: Customer affected by action
        target_transaction_id: Transaction affected by action
        target_resource_id: Generic resource ID
        resource_type: Type of resource
        metadata: Additional metadata
        previous_value: Previous value for updates
        new_value: New value for updates
        is_success: Whether action succeeded
        error_message: Error message if failed

    Returns:
        UserActivityLog: Created and saved activity log entry
    """
    activity_log = UserActivityLog(
        user_id=user_id,
        activity_type=activity_type,
        severity=severity,
        description=description,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
        session_id=session_id,
        request_id=request_id,
        target_user_id=target_user_id,
        target_customer_phone=target_customer_phone,
        target_transaction_id=target_transaction_id,
        target_resource_id=target_resource_id,
        resource_type=resource_type,
        metadata=metadata,
        previous_value=previous_value,
        new_value=new_value,
        is_success=is_success,
        error_message=error_message
    )

    await activity_log.insert()
    return activity_log


# Convenience functions for common activities
async def log_login_success(user_id: str, ip_address: Optional[str] = None, user_agent: Optional[str] = None, session_id: Optional[str] = None) -> UserActivityLog:
    """Log successful login."""
    return await log_user_activity(
        user_id=user_id,
        activity_type=UserActivityType.LOGIN_SUCCESS,
        description=f"User {user_id} logged in successfully",
        ip_address=ip_address,
        user_agent=user_agent,
        session_id=session_id
    )


async def log_login_failed(user_id: str, ip_address: Optional[str] = None, reason: str = "Invalid credentials") -> UserActivityLog:
    """Log failed login attempt."""
    return await log_user_activity(
        user_id=user_id,
        activity_type=UserActivityType.LOGIN_FAILED,
        description=f"Failed login attempt for user {user_id}",
        severity=ActivitySeverity.WARNING,
        details=reason,
        ip_address=ip_address,
        is_success=False,
        error_message=reason
    )


async def log_account_locked(user_id: str, reason: str = "Too many failed login attempts") -> UserActivityLog:
    """Log account lockout."""
    return await log_user_activity(
        user_id=user_id,
        activity_type=UserActivityType.ACCOUNT_LOCKED,
        description=f"Account {user_id} locked",
        severity=ActivitySeverity.ERROR,
        details=reason
    )


async def log_user_action(
    user_id: str,
    activity_type: UserActivityType,
    description: str,
    target_id: Optional[str] = None,
    resource_type: Optional[str] = None
) -> UserActivityLog:
    """Generic user action logger."""
    return await log_user_activity(
        user_id=user_id,
        activity_type=activity_type,
        description=description,
        target_resource_id=target_id,
        resource_type=resource_type
    )
