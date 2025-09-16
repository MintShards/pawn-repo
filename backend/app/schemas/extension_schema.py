"""
Extension Pydantic schemas for request/response validation.

This module defines all schemas used for extension-related API operations,
including extension processing, history, and eligibility checks.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class ExtensionBase(BaseModel):
    """Base extension schema"""
    extension_months: int = Field(
        ...,
        ge=1,
        le=3,
        description="Number of months to extend (1-3 months)"
    )
    extension_fee_per_month: int = Field(
        ...,
        ge=0,
        le=500,
        description="Fee per month of extension in whole dollars (max $500/month)"
    )
    extension_reason: Optional[str] = Field(
        None,
        max_length=200,
        description="Reason for extension"
    )


class ExtensionCreate(ExtensionBase):
    """Schema for creating a new extension"""
    transaction_id: str = Field(
        ...,
        description="ID of transaction to extend"
    )


class ExtensionResponse(ExtensionBase):
    """Schema for extension response"""
    extension_id: str = Field(..., description="Unique extension identifier")
    formatted_id: Optional[str] = Field(None, description="Display-friendly extension ID (e.g., 'EX000001')")
    transaction_id: str = Field(..., description="Associated transaction ID")
    processed_by_user_id: str = Field(..., description="Staff member who processed extension")
    
    # Date calculations
    original_maturity_date: datetime = Field(..., description="Original maturity date")
    new_maturity_date: Optional[datetime] = Field(None, description="New maturity date after extension")
    new_grace_period_end: Optional[datetime] = Field(None, description="New grace period end date")
    extension_date: datetime = Field(..., description="Date extension was processed")
    
    # Financial details
    total_extension_fee: int = Field(..., description="Total extension fee charged")
    fee_paid: bool = Field(..., description="Whether extension fee has been paid")
    
    # Cancellation functionality
    is_cancelled: bool = Field(default=False, description="Whether this extension has been cancelled")
    cancelled_date: Optional[datetime] = Field(None, description="Date/time when extension was cancelled")
    cancelled_by_user_id: Optional[str] = Field(None, description="User ID who cancelled the extension")
    cancellation_reason: Optional[str] = Field(None, description="Reason for cancellation")
    
    # Metadata
    created_at: datetime = Field(..., description="Extension creation timestamp")
    updated_at: datetime = Field(..., description="Extension last update timestamp")
    
    model_config = ConfigDict(from_attributes=True)


class ExtensionListResponse(BaseModel):
    """Schema for paginated extension list"""
    extensions: List[ExtensionResponse]
    total_count: int = Field(..., description="Total number of extensions")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Items per page")
    has_next: bool = Field(..., description="Whether there are more pages")


class ExtensionEligibilityResponse(BaseModel):
    """Schema for extension eligibility check"""
    transaction_id: str = Field(..., description="Transaction identifier")
    is_eligible: bool = Field(..., description="Whether transaction is eligible for extension")
    eligibility_reasons: List[str] = Field(..., description="Reasons for eligibility status")
    
    # Current transaction state
    current_status: str = Field(..., description="Current transaction status")
    current_balance: int = Field(..., description="Current outstanding balance")
    maturity_date: datetime = Field(..., description="Current maturity date")
    is_overdue: bool = Field(..., description="Whether transaction is overdue")
    days_overdue: int = Field(..., description="Number of days overdue (0 if not overdue)")
    
    # Extension history
    previous_extensions: int = Field(..., description="Number of previous extensions")
    can_extend_months: List[int] = Field(..., description="Available extension durations")
    
    # Fee information
    recommended_fee_per_month: int = Field(..., description="Recommended extension fee per month")
    min_fee_per_month: int = Field(..., description="Minimum extension fee per month")
    max_fee_per_month: int = Field(..., description="Maximum extension fee per month")


class ExtensionSummaryResponse(BaseModel):
    """Schema for extension summary"""
    transaction_id: str = Field(..., description="Transaction identifier")
    total_extensions: int = Field(..., description="Total number of extensions")
    total_extension_fees: int = Field(..., description="Total extension fees charged")
    total_months_extended: int = Field(..., description="Total months extended")
    last_extension_date: Optional[datetime] = Field(None, description="Date of last extension")
    average_fee_per_month: int = Field(..., description="Average fee per month")
    current_maturity_date: datetime = Field(..., description="Current maturity date")
    current_grace_period_end: datetime = Field(..., description="Current grace period end date")


class ExtensionReceiptResponse(BaseModel):
    """Schema for extension receipt data"""
    extension_id: str = Field(..., description="Extension identifier")
    
    # Transaction details
    transaction_id: str = Field(..., description="Transaction identifier")
    customer_name: str = Field(..., description="Customer full name")
    customer_phone: str = Field(..., description="Customer phone number")
    
    # Extension details
    extension_months: int = Field(..., description="Number of months extended")
    extension_fee_per_month: int = Field(..., description="Fee per month")
    total_extension_fee: int = Field(..., description="Total extension fee")
    extension_date: str = Field(..., description="Extension date (formatted)")
    
    # Date changes
    original_maturity_date: str = Field(..., description="Original maturity date (formatted)")
    new_maturity_date: str = Field(..., description="New maturity date (formatted)")
    
    # Staff information
    processed_by: str = Field(..., description="Staff member who processed extension")
    
    # Additional information
    extension_reason: Optional[str] = Field(None, description="Reason for extension")
    notes: Optional[str] = Field(None, description="Extension notes")
    
    # Formatting
    total_extension_fee_formatted: str = Field(..., description="Formatted total extension fee")
    extension_fee_per_month_formatted: str = Field(..., description="Formatted fee per month")


class ExtensionHistoryResponse(BaseModel):
    """Schema for extension history"""
    transaction_id: str = Field(..., description="Transaction identifier")
    extensions: List[ExtensionResponse] = Field(..., description="List of extensions")
    summary: ExtensionSummaryResponse = Field(..., description="Extension summary")
    
    # Additional context
    transaction_details: Dict[str, Any] = Field(..., description="Basic transaction info")


class ExtensionValidationResponse(BaseModel):
    """Schema for extension validation"""
    is_valid: bool = Field(..., description="Whether extension request is valid")
    validation_errors: List[str] = Field(..., description="List of validation errors")
    
    # Extension impact preview
    current_maturity_date: datetime = Field(..., description="Current maturity date")
    new_maturity_date: datetime = Field(..., description="New maturity date after extension")
    total_extension_fee: int = Field(..., description="Total fee for extension")
    
    # Business rule checks
    exceeds_max_extensions: bool = Field(..., description="Whether request exceeds maximum extensions")
    requires_payment_first: bool = Field(..., description="Whether payment required before extension")
    within_extension_window: bool = Field(..., description="Whether within allowed extension window")