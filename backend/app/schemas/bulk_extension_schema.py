"""
Bulk Extension Payment Pydantic schemas for request/response validation.

This module defines schemas for bulk extension payment operations,
allowing multiple extension payments to be processed in a single request.
"""

from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class ExtensionPaymentItem(BaseModel):
    """Individual extension payment within a bulk request"""
    transaction_id: str = Field(..., description="Transaction ID to extend")
    extension_fee: float = Field(..., ge=0, description="Extension fee amount")
    overdue_fee: float = Field(default=0, ge=0, description="Overdue fee amount (if applicable)")
    discount: float = Field(default=0, ge=0, description="Discount amount")
    reason: Optional[str] = Field(None, max_length=200, description="Discount reason (required if discount > 0)")
    payment_method: str = Field(default="cash", description="Payment method")
    total_amount: float = Field(..., ge=0, description="Total amount to collect")

    @field_validator('reason')
    @classmethod
    def validate_reason_when_discount(cls, v, info):
        """Ensure reason is provided when discount is applied"""
        if info.data.get('discount', 0) > 0 and not v:
            raise ValueError('Discount reason is required when discount is applied')
        return v


class BulkExtensionPaymentRequest(BaseModel):
    """Schema for bulk extension payment request"""
    payments: List[ExtensionPaymentItem] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="List of extension payments to process (max 50)"
    )
    batch_notes: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional notes for the entire batch"
    )
    admin_pin: Optional[str] = Field(
        None,
        min_length=4,
        max_length=4,
        description="Admin PIN (required when discounts are applied)"
    )

    @field_validator('admin_pin')
    @classmethod
    def validate_admin_pin_when_discounts(cls, v, info):
        """Ensure admin PIN is provided when any discount is applied"""
        payments = info.data.get('payments', [])
        has_discounts = any(p.discount > 0 for p in payments if hasattr(p, 'discount'))

        if has_discounts and not v:
            raise ValueError('Admin PIN is required when discounts are applied')

        return v


class BulkExtensionPaymentResponse(BaseModel):
    """Schema for bulk extension payment response"""
    success_count: int = Field(..., description="Number of successfully processed payments")
    error_count: int = Field(..., description="Number of failed payments")
    total_requested: int = Field(..., description="Total number of payments requested")
    total_amount_processed: float = Field(..., description="Total amount successfully processed")
    errors: List[str] = Field(default_factory=list, description="List of error messages for failed payments")

    # Detailed breakdown (optional)
    successful_transaction_ids: List[str] = Field(
        default_factory=list,
        description="List of successfully processed transaction IDs"
    )
    failed_transaction_ids: List[str] = Field(
        default_factory=list,
        description="List of failed transaction IDs"
    )
