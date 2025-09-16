"""
Reversal Schemas

Pydantic schemas for payment reversals and extension cancellations.
Handles validation for same-day mistake correction system.
"""

from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional


class PaymentReversalEligibilityResponse(BaseModel):
    """Response schema for payment reversal eligibility check"""
    
    payment_id: str = Field(..., description="Payment ID being checked")
    is_eligible: bool = Field(..., description="Whether payment can be reversed")
    reason: Optional[str] = Field(default=None, description="Reason if not eligible")
    hours_since_payment: Optional[float] = Field(default=None, description="Hours since payment was made")
    max_hours_allowed: int = Field(default=24, description="Maximum hours allowed for reversal")
    
    class Config:
        json_schema_extra = {
            "example": {
                "payment_id": "12345678-1234-1234-1234-123456789abc",
                "is_eligible": True,
                "reason": None,
                "hours_since_payment": 2.5,
                "max_hours_allowed": 24
            }
        }


class PaymentReversalRequest(BaseModel):
    """Request schema for payment reversal"""
    
    reversal_reason: str = Field(
        ..., 
        min_length=1, 
        max_length=200,
        description="Reason for reversing the payment"
    )
    admin_pin: str = Field(
        ..., 
        min_length=4, 
        max_length=4,
        description="Admin PIN for authorization"
    )
    staff_notes: Optional[str] = Field(
        default=None,
        max_length=300,
        description="Additional staff notes about the reversal"
    )
    
    @field_validator('reversal_reason')
    @classmethod
    def validate_reversal_reason(cls, v: str) -> str:
        """Ensure reversal reason is not empty"""
        if not v or not v.strip():
            raise ValueError('Reversal reason is required')
        return v.strip()
    
    @field_validator('admin_pin')
    @classmethod
    def validate_admin_pin(cls, v: str) -> str:
        """Ensure admin PIN is 4 digits"""
        if not v or len(v) != 4 or not v.isdigit():
            raise ValueError('Admin PIN must be exactly 4 digits')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "reversal_reason": "Incorrect amount entered, customer paid $100 not $150",
                "admin_pin": "6969",
                "staff_notes": "Customer noticed error immediately, correcting to proper amount"
            }
        }


class PaymentReversalResponse(BaseModel):
    """Response schema for successful payment reversal"""
    
    payment_id: str = Field(..., description="Reversed payment ID")
    transaction_id: str = Field(..., description="Associated transaction ID")
    original_amount: int = Field(..., description="Original payment amount that was reversed")
    balance_restored: int = Field(..., description="Balance amount restored to transaction")
    reversal_date: datetime = Field(..., description="Date/time of reversal")
    reversed_by_user_id: str = Field(..., description="User who performed the reversal")
    reversal_reason: str = Field(..., description="Reason for reversal")
    
    class Config:
        json_schema_extra = {
            "example": {
                "payment_id": "12345678-1234-1234-1234-123456789abc", 
                "transaction_id": "87654321-4321-4321-4321-210987654321",
                "original_amount": 150,
                "balance_restored": 150,
                "reversal_date": "2025-01-13T10:30:00Z",
                "reversed_by_user_id": "69",
                "reversal_reason": "Incorrect amount entered"
            }
        }


class ExtensionCancellationEligibilityResponse(BaseModel):
    """Response schema for extension cancellation eligibility check"""
    
    extension_id: str = Field(..., description="Extension ID being checked")
    is_eligible: bool = Field(..., description="Whether extension can be cancelled")
    reason: Optional[str] = Field(default=None, description="Reason if not eligible")
    hours_since_extension: Optional[float] = Field(default=None, description="Hours since extension was processed")
    max_hours_allowed: int = Field(default=24, description="Maximum hours allowed for cancellation")
    
    class Config:
        json_schema_extra = {
            "example": {
                "extension_id": "98765432-9876-9876-9876-321098765432",
                "is_eligible": True,
                "reason": None,
                "hours_since_extension": 1.2,
                "max_hours_allowed": 24
            }
        }


class ExtensionCancellationRequest(BaseModel):
    """Request schema for extension cancellation"""
    
    cancellation_reason: str = Field(
        ..., 
        min_length=1, 
        max_length=200,
        description="Reason for cancelling the extension"
    )
    admin_pin: str = Field(
        ..., 
        min_length=4, 
        max_length=4,
        description="Admin PIN for authorization"
    )
    staff_notes: Optional[str] = Field(
        default=None,
        max_length=300,
        description="Additional staff notes about the cancellation"
    )
    
    @field_validator('cancellation_reason')
    @classmethod
    def validate_cancellation_reason(cls, v: str) -> str:
        """Ensure cancellation reason is not empty"""
        if not v or not v.strip():
            raise ValueError('Cancellation reason is required')
        return v.strip()
    
    @field_validator('admin_pin')
    @classmethod
    def validate_admin_pin(cls, v: str) -> str:
        """Ensure admin PIN is 4 digits"""
        if not v or len(v) != 4 or not v.isdigit():
            raise ValueError('Admin PIN must be exactly 4 digits')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "cancellation_reason": "Customer changed mind about extension duration",
                "admin_pin": "6969",
                "staff_notes": "Customer wants to pay off loan instead of extending"
            }
        }


class ExtensionCancellationResponse(BaseModel):
    """Response schema for successful extension cancellation"""
    
    extension_id: str = Field(..., description="Cancelled extension ID")
    transaction_id: str = Field(..., description="Associated transaction ID")
    extension_fee_refunded: int = Field(..., description="Extension fee amount refunded")
    maturity_date_reverted: datetime = Field(..., description="Maturity date reverted to original date")
    cancellation_date: datetime = Field(..., description="Date/time of cancellation")
    cancelled_by_user_id: str = Field(..., description="User who performed the cancellation")
    cancellation_reason: str = Field(..., description="Reason for cancellation")
    
    class Config:
        json_schema_extra = {
            "example": {
                "extension_id": "98765432-9876-9876-9876-321098765432",
                "transaction_id": "87654321-4321-4321-4321-210987654321", 
                "extension_fee_refunded": 50,
                "maturity_date_reverted": "2025-02-15T00:00:00Z",
                "cancellation_date": "2025-01-13T11:15:00Z",
                "cancelled_by_user_id": "69",
                "cancellation_reason": "Customer changed mind"
            }
        }


class DailyReversalReportResponse(BaseModel):
    """Response schema for daily reversal reporting"""
    
    report_date: datetime = Field(..., description="Date of the report")
    total_payment_reversals: int = Field(..., description="Total payment reversals for the day")
    total_extension_cancellations: int = Field(..., description="Total extension cancellations for the day")
    total_amount_reversed: int = Field(..., description="Total dollar amount of payments reversed")
    total_fees_refunded: int = Field(..., description="Total extension fees refunded")
    
    class Config:
        json_schema_extra = {
            "example": {
                "report_date": "2025-01-13T00:00:00Z",
                "total_payment_reversals": 3,
                "total_extension_cancellations": 1,
                "total_amount_reversed": 450,
                "total_fees_refunded": 50
            }
        }


class TransactionReversalCountResponse(BaseModel):
    """Response schema for transaction reversal count"""
    
    transaction_id: str = Field(..., description="Transaction ID")
    daily_payment_reversals: int = Field(..., description="Payment reversals for this transaction today")
    daily_extension_cancellations: int = Field(..., description="Extension cancellations for this transaction today")
    max_daily_limit: int = Field(default=3, description="Maximum daily reversals per transaction")
    can_reverse_more: bool = Field(..., description="Whether more reversals are allowed today")
    
    class Config:
        json_schema_extra = {
            "example": {
                "transaction_id": "87654321-4321-4321-4321-210987654321",
                "daily_payment_reversals": 1,
                "daily_extension_cancellations": 0,
                "max_daily_limit": 3,
                "can_reverse_more": True
            }
        }