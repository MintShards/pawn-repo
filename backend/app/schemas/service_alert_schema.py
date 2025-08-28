"""
Service Alert schemas for request/response validation.

This module defines Pydantic schemas for service alert API operations
including creation, updates, and responses.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models.service_alert_model import AlertType, AlertStatus


class ServiceAlertCreate(BaseModel):
    """Schema for creating a new service alert"""
    
    customer_phone: str = Field(
        ...,
        min_length=10,
        max_length=10,
        description="Customer phone number"
    )
    alert_type: AlertType = Field(
        ...,
        description="Type of service alert"
    )
    description: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Detailed description"
    )
    item_reference: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional item reference"
    )


class ServiceAlertUpdate(BaseModel):
    """Schema for updating an existing service alert"""
    
    alert_type: Optional[AlertType] = Field(
        None,
        description="Type of service alert"
    )
    description: Optional[str] = Field(
        None,
        min_length=1,
        max_length=1000,
        description="Detailed description"
    )
    item_reference: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional item reference"
    )


class ServiceAlertResolve(BaseModel):
    """Schema for resolving a service alert"""
    
    resolution_notes: Optional[str] = Field(
        None,
        max_length=500,
        description="Resolution notes"
    )


class ServiceAlertResponse(BaseModel):
    """Schema for service alert API responses"""
    
    id: str = Field(..., description="Alert ID")
    customer_phone: str = Field(..., description="Customer phone number")
    alert_type: AlertType = Field(..., description="Alert type")
    description: str = Field(..., description="Alert description")
    item_reference: Optional[str] = Field(None, description="Item reference")
    status: AlertStatus = Field(..., description="Alert status")
    
    # Timestamps and audit
    created_at: datetime = Field(..., description="Creation timestamp")
    created_by: str = Field(..., description="Created by user ID")
    resolved_at: Optional[datetime] = Field(None, description="Resolution timestamp")
    resolved_by: Optional[str] = Field(None, description="Resolved by user ID")
    resolution_notes: Optional[str] = Field(None, description="Resolution notes")
    updated_at: datetime = Field(..., description="Last update timestamp")
    updated_by: Optional[str] = Field(None, description="Last updated by user ID")
    
    class Config:
        from_attributes = True


class ServiceAlertListResponse(BaseModel):
    """Schema for paginated service alert list responses"""
    
    alerts: List[ServiceAlertResponse] = Field(..., description="List of service alerts")
    total: int = Field(..., description="Total number of alerts")
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Items per page")
    has_next: bool = Field(..., description="Whether there are more pages")
    has_prev: bool = Field(..., description="Whether there are previous pages")


class ServiceAlertCountResponse(BaseModel):
    """Schema for alert count responses"""
    
    customer_phone: str = Field(..., description="Customer phone number")
    active_count: int = Field(..., description="Number of active alerts")
    resolved_count: int = Field(..., description="Number of resolved alerts")
    total_count: int = Field(..., description="Total number of alerts")


class CustomerItemResponse(BaseModel):
    """Schema for customer pawn item responses (for alert item selection)"""
    
    id: str = Field(..., description="Item ID")
    description: str = Field(..., description="Item description")
    category: str = Field(..., description="Item category")
    condition: str = Field(..., description="Item condition")
    status: str = Field(..., description="Item status")
    loan_date: datetime = Field(..., description="Loan date")
    maturity_date: datetime = Field(..., description="Maturity date")
    
    class Config:
        from_attributes = True