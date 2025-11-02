"""
Payment Pydantic schemas for request/response validation.

This module defines all schemas used for payment-related API operations,
including payment processing, history, and receipt generation.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class PaymentBase(BaseModel):
    """Base payment schema"""
    payment_amount: int = Field(
        ...,
        gt=0,
        le=10000,
        description="Payment amount in whole dollars (max $10,000)"
    )


class PaymentCreate(PaymentBase):
    """Schema for creating a new payment"""
    transaction_id: str = Field(
        ...,
        description="ID of transaction receiving payment"
    )


class PaymentResponse(PaymentBase):
    """Schema for payment response"""
    payment_id: str = Field(..., description="Unique payment identifier")
    transaction_id: str = Field(..., description="Associated transaction ID")
    processed_by_user_id: str = Field(..., description="Staff member who processed payment")
    
    # Financial details
    balance_before_payment: int = Field(..., description="Balance before this payment")
    balance_after_payment: int = Field(..., description="Balance after this payment")
    principal_portion: int = Field(..., description="Amount applied to principal")
    interest_portion: int = Field(..., description="Amount applied to interest")
    extension_fees_portion: int = Field(default=0, description="Amount applied to extension fees")
    overdue_fee_portion: int = Field(default=0, description="Amount applied to overdue fees")
    
    # Payment details
    payment_type: str = Field(..., description="Payment type (always 'cash')")
    payment_date: datetime = Field(..., description="Date payment was processed")
    
    # Metadata
    created_at: datetime = Field(..., description="Payment creation timestamp")
    updated_at: datetime = Field(..., description="Payment last update timestamp")
    
    # Void functionality
    is_voided: bool = Field(default=False, description="Whether payment has been voided")
    voided_date: Optional[datetime] = Field(None, description="Date payment was voided")
    voided_by_user_id: Optional[str] = Field(None, description="User who voided payment")
    void_reason: Optional[str] = Field(None, description="Reason for voiding payment")

    # Discount functionality
    discount_amount: int = Field(default=0, description="Discount amount applied")
    discount_reason: Optional[str] = Field(None, description="Reason for discount")
    discount_approved_by: Optional[str] = Field(None, description="Admin who approved discount")
    discount_approved_at: Optional[datetime] = Field(None, description="Date discount was approved")

    model_config = ConfigDict(from_attributes=True)


class PaymentListResponse(BaseModel):
    """Schema for paginated payment list"""
    payments: List[PaymentResponse]
    total_count: int = Field(..., description="Total number of payments")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Items per page")
    has_next: bool = Field(..., description="Whether there are more pages")


class PaymentSummaryResponse(BaseModel):
    """Schema for payment summary"""
    transaction_id: str = Field(..., description="Transaction identifier")
    total_payments: int = Field(..., description="Total payment amount")
    payment_count: int = Field(..., description="Number of payments made")
    last_payment_date: Optional[datetime] = Field(None, description="Date of last payment")
    
    # Payment allocation breakdown
    total_principal_paid: int = Field(..., description="Total principal payments")
    total_interest_paid: int = Field(..., description="Total interest payments")
    total_extension_fees_paid: int = Field(default=0, description="Total extension fee payments")
    total_overdue_fees_paid: int = Field(default=0, description="Total overdue fee payments")

    # Current balance information
    current_balance: int = Field(..., description="Remaining balance")
    principal_balance: int = Field(..., description="Remaining principal balance")
    interest_balance: int = Field(..., description="Remaining interest balance")
    extension_fees_balance: int = Field(default=0, description="Remaining extension fees balance")
    overdue_fee_balance: int = Field(default=0, description="Remaining overdue fees balance")


class PaymentReceiptResponse(BaseModel):
    """Schema for payment receipt data"""
    payment_id: str = Field(..., description="Payment identifier")
    
    # Transaction details
    transaction_id: str = Field(..., description="Transaction identifier")
    customer_name: str = Field(..., description="Customer full name")
    customer_phone: str = Field(..., description="Customer phone number")
    
    # Payment details
    payment_amount: int = Field(..., description="Payment amount")
    payment_amount_formatted: str = Field(..., description="Formatted payment amount")
    payment_date: str = Field(..., description="Payment date (formatted)")
    payment_type: str = Field(..., description="Payment type")
    
    # Balance information
    balance_before: int = Field(..., description="Balance before payment")
    balance_after: int = Field(..., description="Balance after payment")
    balance_before_formatted: str = Field(..., description="Formatted balance before")
    balance_after_formatted: str = Field(..., description="Formatted balance after")
    
    # Payment allocation
    principal_portion: int = Field(..., description="Principal portion")
    interest_portion: int = Field(..., description="Interest portion")
    overdue_fee_portion: int = Field(default=0, description="Overdue fee portion")
    principal_portion_formatted: str = Field(..., description="Formatted principal portion")
    interest_portion_formatted: str = Field(..., description="Formatted interest portion")
    overdue_fee_portion_formatted: str = Field(default="$0", description="Formatted overdue fee portion")
    
    # Staff information
    processed_by: str = Field(..., description="Staff member who processed payment")
    
    # Additional information
    notes: Optional[str] = Field(None, description="Payment notes")
    
    # Transaction status
    transaction_status: str = Field(..., description="Current transaction status")
    is_paid_off: bool = Field(..., description="Whether transaction is fully paid")


class PaymentHistoryResponse(BaseModel):
    """Schema for payment history"""
    transaction_id: str = Field(..., description="Transaction identifier")
    payments: List[PaymentResponse] = Field(..., description="List of payments")
    summary: PaymentSummaryResponse = Field(..., description="Payment summary")
    
    # Additional context
    transaction_details: Dict[str, Any] = Field(..., description="Basic transaction info")


class PaymentValidationResponse(BaseModel):
    """Schema for payment validation"""
    is_valid: bool = Field(..., description="Whether payment is valid")
    validation_errors: List[str] = Field(..., description="List of validation errors")
    
    # Payment impact preview
    current_balance: int = Field(..., description="Current balance")
    new_balance: int = Field(..., description="Balance after payment")
    principal_allocation: int = Field(..., description="Amount going to principal")
    interest_allocation: int = Field(..., description="Amount going to interest")
    
    # Transaction status impact
    will_be_paid_off: bool = Field(..., description="Whether payment will pay off loan")
    recommended_amount: Optional[int] = Field(None, description="Recommended payment amount")