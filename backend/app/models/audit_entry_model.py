"""
Audit Entry Model

Model for structured system audit log entries that track all system-generated
events and transactions. Used to separate system audit logs from manual staff notes.
"""

from pydantic import BaseModel, Field, field_validator, ConfigDict
from datetime import datetime, UTC, timezone
from typing import Optional
from enum import Enum


class AuditActionType(str, Enum):
    """Valid audit action types for system events"""
    PAYMENT_PROCESSED = "payment_processed"
    EXTENSION_APPLIED = "extension_applied"
    EXTENSION_CANCELLED = "extension_cancelled"
    STATUS_CHANGED = "status_changed"
    TRANSACTION_CREATED = "transaction_created"
    TRANSACTION_UPDATED = "transaction_updated"
    CUSTOMER_UPDATED = "customer_updated"
    ITEM_UPDATED = "item_updated"
    REDEMPTION_COMPLETED = "redemption_completed"
    SYSTEM_NOTIFICATION = "system_notification"
    OVERDUE_FEE_SET = "overdue_fee_set"
    OVERDUE_FEE_CLEARED = "overdue_fee_cleared"
    DISCOUNT_APPLIED = "discount_applied"


class AuditEntry(BaseModel):
    """
    Structured audit log entry for system events.
    
    Replaces mixed text entries in internal_notes with structured data
    that preserves all audit information without character limits.
    """
    
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="UTC timestamp when the event occurred"
    )
    
    action_type: AuditActionType = Field(
        ...,
        description="Type of action that occurred"
    )
    
    staff_member: str = Field(
        ...,
        min_length=1,
        description="User ID of staff member who performed the action"
    )
    
    action_summary: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Brief summary of the action taken"
    )
    
    details: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Additional details about the action"
    )
    
    amount: Optional[int] = Field(
        default=None,
        ge=0,
        description="Monetary amount involved in the action (in whole dollars)"
    )
    
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
    
    related_id: Optional[str] = Field(
        default=None,
        description="ID of related record (payment_id, extension_id, etc.)"
    )
    
    @field_validator('action_summary')
    @classmethod
    def validate_action_summary(cls, v: str) -> str:
        """Validate action summary is not empty and reasonably sized."""
        v = v.strip()
        if not v:
            raise ValueError('Action summary cannot be empty')
        return v
    
    @field_validator('staff_member')
    @classmethod
    def validate_staff_member(cls, v: str) -> str:
        """Validate staff member ID format."""
        v = v.strip()
        if not v:
            raise ValueError('Staff member ID cannot be empty')
        # Allow flexible user ID formats (existing system uses 2-digit strings)
        if len(v) > 10:
            raise ValueError('Staff member ID too long')
        return v
    
    @field_validator('timestamp')
    @classmethod
    def validate_timestamp(cls, v: datetime) -> datetime:
        """Ensure timestamp is timezone-aware."""
        if v.tzinfo is None:
            # If naive, assume UTC
            return v.replace(tzinfo=UTC)
        return v
    
    def to_legacy_string(self) -> str:
        """
        Convert audit entry to legacy internal_notes format for backward compatibility.
        
        Returns:
            Formatted string matching legacy internal_notes format
        """
        timestamp_str = self.timestamp.strftime("%Y-%m-%d %H:%M UTC")
        
        # Build message
        message_parts = [self.action_summary]
        
        if self.amount is not None:
            message_parts[0] = f"{self.action_summary} (${self.amount:,})"
        
        if self.details:
            message_parts.append(self.details)
        
        message = ". ".join(message_parts)
        
        return f"[{timestamp_str} by {self.staff_member}] {message}"
    
    def __str__(self) -> str:
        """String representation for display."""
        return self.to_legacy_string()
    
    model_config = ConfigDict(
        validate_assignment=True,
        arbitrary_types_allowed=True,
        json_schema_extra={
            "example": {
                "action_type": "payment_processed",
                "staff_member": "02",
                "action_summary": "Payment processed",
                "details": "Balance after payment: $150",
                "amount": 200,
                "related_id": "payment_123"
            }
        }
    )


def create_audit_entry(
    action_type: AuditActionType,
    staff_member: str,
    action_summary: str,
    details: Optional[str] = None,
    amount: Optional[int] = None,
    previous_value: Optional[str] = None,
    new_value: Optional[str] = None,
    related_id: Optional[str] = None
) -> AuditEntry:
    """
    Factory function to create audit entries with validation.
    
    Args:
        action_type: Type of action performed
        staff_member: User ID of staff member
        action_summary: Brief description of action
        details: Optional additional details
        amount: Optional monetary amount
        previous_value: Previous value for updates
        new_value: New value for updates
        related_id: Related record ID
        
    Returns:
        AuditEntry instance
    """
    return AuditEntry(
        action_type=action_type,
        staff_member=staff_member,
        action_summary=action_summary,
        details=details,
        amount=amount,
        previous_value=previous_value,
        new_value=new_value,
        related_id=related_id
    )


# Pre-defined audit entry creators for common actions
def create_payment_audit(staff_member: str, amount: int, balance_after: int, payment_id: str) -> AuditEntry:
    """Create audit entry for payment processing."""
    return create_audit_entry(
        action_type=AuditActionType.PAYMENT_PROCESSED,
        staff_member=staff_member,
        action_summary="Payment processed",
        details=f"Balance after payment: ${balance_after:,}",
        amount=amount,
        related_id=payment_id
    )


def create_extension_audit(staff_member: str, months: int, new_maturity: str, extension_id: str, fee: Optional[int] = None) -> AuditEntry:
    """Create audit entry for extension processing."""
    details = f"Extended {months} months. New maturity: {new_maturity}"
    if fee:
        details += f". Extension fee: ${fee:,}"
    
    return create_audit_entry(
        action_type=AuditActionType.EXTENSION_APPLIED,
        staff_member=staff_member,
        action_summary="Extension applied",
        details=details,
        amount=fee,
        related_id=extension_id
    )


def create_status_change_audit(staff_member: str, old_status: str, new_status: str, reason: Optional[str] = None) -> AuditEntry:
    """Create audit entry for status changes."""
    details = f"Status changed from {old_status} to {new_status}"
    if reason:
        details += f". Reason: {reason}"
    
    return create_audit_entry(
        action_type=AuditActionType.STATUS_CHANGED,
        staff_member=staff_member,
        action_summary="Status updated",
        details=details,
        previous_value=old_status,
        new_value=new_status
    )


def create_redemption_audit(staff_member: str, total_paid: int) -> AuditEntry:
    """Create audit entry for redemption completion."""
    return create_audit_entry(
        action_type=AuditActionType.REDEMPTION_COMPLETED,
        staff_member=staff_member,
        action_summary="Transaction redeemed",
        details="All amounts paid in full. Items ready for pickup",
        amount=total_paid
    )


def create_discount_audit(
    staff_member: str,
    discount_amount: int,
    discount_reason: str,
    approved_by: str,
    payment_id: str
) -> AuditEntry:
    """Create audit entry for discount application."""
    details = f"Discount approved by admin {approved_by}. Reason: {discount_reason}"

    return create_audit_entry(
        action_type=AuditActionType.DISCOUNT_APPLIED,
        staff_member=staff_member,
        action_summary="Discount applied to payment",
        details=details,
        amount=discount_amount,
        related_id=payment_id
    )