"""
Service Alert model for MongoDB using Beanie ODM.

This module defines the service alert document model for tracking
customer service requests, communications, and follow-up items.
"""

from datetime import datetime
from typing import Optional
from enum import Enum

from beanie import Document, Indexed, before_event, Replace, Insert
from pydantic import Field
from pymongo import IndexModel


class AlertType(str, Enum):
    """Service alert types for customer requests"""
    HOLD_REQUEST = "hold_request"
    PAYMENT_ARRANGEMENT = "payment_arrangement"
    EXTENSION_REQUEST = "extension_request"
    PICKUP_ARRANGEMENT = "pickup_arrangement"
    ITEM_INQUIRY = "item_inquiry"
    GENERAL_NOTE = "general_note"


class AlertStatus(str, Enum):
    """Status of service alert"""
    ACTIVE = "active"
    RESOLVED = "resolved"


class ServiceAlert(Document):
    """
    Service alert document model for customer service tracking.
    
    Attributes:
        customer_phone: Phone number of the customer (reference)
        alert_type: Type of service alert
        description: Detailed description of the alert
        item_reference: Optional reference to specific pawn item
        status: Current status of the alert
        created_at: Alert creation timestamp
        created_by: User ID who created the alert
        resolved_at: Alert resolution timestamp
        resolved_by: User ID who resolved the alert
        resolution_notes: Notes added when resolving
        updated_at: Last update timestamp
        updated_by: User ID who last updated
    """
    
    # Customer reference
    customer_phone: Indexed(str) = Field(
        ...,
        min_length=10,
        max_length=10,
        description="Customer phone number (reference)"
    )
    
    # Alert details
    alert_type: AlertType = Field(
        ...,
        description="Type of service alert"
    )
    description: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Detailed alert description"
    )
    
    # Optional item reference
    item_reference: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional reference to specific pawn item"
    )
    
    # Status management
    status: AlertStatus = Field(
        default=AlertStatus.ACTIVE,
        description="Current status of the alert"
    )
    
    # Creation audit
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Alert creation timestamp"
    )
    created_by: str = Field(
        ...,
        description="User ID who created this alert"
    )
    
    # Resolution audit
    resolved_at: Optional[datetime] = Field(
        None,
        description="Alert resolution timestamp"
    )
    resolved_by: Optional[str] = Field(
        None,
        description="User ID who resolved the alert"
    )
    resolution_notes: Optional[str] = Field(
        None,
        max_length=500,
        description="Notes added when resolving alert"
    )
    
    # Update audit
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last update timestamp"
    )
    updated_by: Optional[str] = Field(
        None,
        description="User ID who last updated"
    )
    
    @before_event([Insert, Replace])
    async def update_timestamp(self):
        """Update the updated_at timestamp before save"""
        self.updated_at = datetime.utcnow()
    
    def resolve(self, resolved_by: str, resolution_notes: Optional[str] = None):
        """Mark alert as resolved"""
        self.status = AlertStatus.RESOLVED
        self.resolved_at = datetime.utcnow()
        self.resolved_by = resolved_by
        if resolution_notes:
            self.resolution_notes = resolution_notes
    
    @property
    def is_active(self) -> bool:
        """Check if alert is currently active"""
        return self.status == AlertStatus.ACTIVE
    
    @property
    def is_resolved(self) -> bool:
        """Check if alert has been resolved"""
        return self.status == AlertStatus.RESOLVED
    
    class Settings:
        """Beanie document settings"""
        name = "service_alerts"
        indexes = [
            [("customer_phone", 1)],  # For customer lookups
            [("status", 1)],  # For filtering by status
            [("alert_type", 1)],  # For filtering by type
            [("created_at", -1)],  # For chronological sorting
            [("customer_phone", 1), ("status", 1)],  # Compound index for active alerts by customer
            # Text search index for description search
            IndexModel([("description", "text")])
        ]