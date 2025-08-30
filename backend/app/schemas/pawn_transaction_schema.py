"""
Pawn Transaction Pydantic schemas for request/response validation.

This module defines all schemas used for pawn transaction-related API operations,
including transaction creation, updates, responses, and balance calculations.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict, field_validator
from enum import Enum

from app.models.pawn_transaction_model import TransactionStatus


class TransactionSortField(str, Enum):
    """Allowed sort fields for transaction queries"""
    PAWN_DATE = "pawn_date"
    MATURITY_DATE = "maturity_date"
    LOAN_AMOUNT = "loan_amount"
    INTEREST_RATE = "interest_rate"
    STATUS = "status"
    STORAGE_LOCATION = "storage_location"
    CUSTOMER_ID = "customer_id"
    UPDATED_AT = "updated_at"
    CREATED_AT = "created_at"


class SortOrder(str, Enum):
    """Sort order options"""
    ASC = "asc"
    DESC = "desc"


class PawnItemBase(BaseModel):
    """Base pawn item schema"""
    description: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Item description (required)"
    )
    serial_number: Optional[str] = Field(
        None,
        max_length=50,
        description="Item serial number (optional)"
    )


class PawnItemCreate(PawnItemBase):
    """Schema for creating a pawn item"""
    model_config = ConfigDict(extra='forbid')


class PawnItemResponse(PawnItemBase):
    """Schema for pawn item response"""
    item_id: str = Field(..., description="Unique item identifier")
    transaction_id: str = Field(..., description="Associated transaction ID")
    item_number: int = Field(..., description="Item number within transaction")
    created_at: datetime = Field(..., description="Item creation timestamp")
    updated_at: datetime = Field(..., description="Item last update timestamp")
    
    model_config = ConfigDict(from_attributes=True)


class PawnTransactionBase(BaseModel):
    """Base pawn transaction schema"""
    loan_amount: int = Field(
        ...,
        gt=0,
        le=10000,
        description="Loan amount in whole dollars (max $10,000)"
    )
    monthly_interest_amount: int = Field(
        ...,
        ge=0,
        le=1000,
        description="Fixed monthly interest fee in whole dollars (max $1,000)"
    )
    storage_location: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Physical storage location (e.g., 'Shelf A-5')"
    )
    internal_notes: Optional[str] = Field(
        None,
        max_length=500,
        description="Internal staff notes"
    )


class PawnTransactionCreate(PawnTransactionBase):
    """Schema for creating a new pawn transaction"""
    customer_id: str = Field(
        ...,
        min_length=10,
        max_length=10,
        description="Customer phone number (10 digits)"
    )
    items: List[PawnItemCreate] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="List of items being pawned (1-20 items)"
    )


class PawnTransactionResponse(PawnTransactionBase):
    """Schema for pawn transaction response"""
    transaction_id: str = Field(..., description="Unique transaction identifier")
    customer_id: str = Field(..., description="Customer phone number")
    created_by_user_id: str = Field(..., description="Staff member who created transaction")
    
    # Calculated dates
    pawn_date: datetime = Field(..., description="Date when item was pawned")
    maturity_date: datetime = Field(..., description="Loan maturity date (3 months)")
    grace_period_end: datetime = Field(..., description="Grace period end (maturity + 7 days)")
    
    # Financial fields
    total_due: int = Field(..., description="Current total amount due")
    
    # Status and metadata
    status: TransactionStatus = Field(..., description="Current transaction status")
    
    # Timestamps
    created_at: datetime = Field(..., description="Transaction creation timestamp")
    updated_at: datetime = Field(..., description="Transaction last update timestamp")
    
    model_config = ConfigDict(from_attributes=True)


class PawnTransactionListResponse(BaseModel):
    """Schema for paginated transaction list"""
    transactions: List[PawnTransactionResponse]
    total_count: int = Field(..., description="Total number of transactions")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Items per page")
    has_next: bool = Field(..., description="Whether there are more pages")


class TransactionStatusUpdate(BaseModel):
    """Schema for updating transaction status"""
    new_status: TransactionStatus = Field(..., description="New transaction status")
    notes: Optional[str] = Field(
        None,
        max_length=200,
        description="Optional notes about status change"
    )


class BalanceResponse(BaseModel):
    """Schema for transaction balance response"""
    transaction_id: str = Field(..., description="Transaction identifier")
    as_of_date: str = Field(..., description="Balance calculation date (ISO format)")
    
    # Main balance components
    loan_amount: int = Field(..., description="Original loan amount")
    monthly_interest: int = Field(..., description="Monthly interest fee")
    total_due: int = Field(..., description="Total amount due with interest and extension fees")
    total_paid: int = Field(..., description="Total payments made")
    current_balance: int = Field(..., description="Remaining balance")
    
    # Payment allocation breakdown
    principal_due: int = Field(..., description="Total principal due")
    interest_due: int = Field(..., description="Total interest due")
    extension_fees_due: int = Field(default=0, description="Total extension fees due")
    principal_paid: int = Field(..., description="Principal payments made")
    interest_paid: int = Field(..., description="Interest payments made")
    extension_fees_paid: int = Field(default=0, description="Extension fee payments made")
    principal_balance: int = Field(..., description="Remaining principal balance")
    interest_balance: int = Field(..., description="Remaining interest balance")
    extension_fees_balance: int = Field(default=0, description="Remaining extension fees balance")
    
    # Transaction details
    payment_count: int = Field(..., description="Number of payments made")
    status: TransactionStatus = Field(..., description="Current transaction status")
    
    # Date information
    pawn_date: str = Field(..., description="Pawn date (ISO format)")
    maturity_date: str = Field(..., description="Maturity date (ISO format)")
    grace_period_end: str = Field(..., description="Grace period end (ISO format)")
    
    # Status flags
    is_overdue: bool = Field(..., description="Whether transaction is overdue")
    is_in_grace_period: bool = Field(..., description="Whether in grace period")
    days_until_forfeiture: int = Field(..., description="Days until forfeiture (0 if past)")


class InterestBreakdownResponse(BaseModel):
    """Schema for detailed interest breakdown"""
    transaction_id: str = Field(..., description="Transaction identifier")
    calculation_date: str = Field(..., description="Calculation date (ISO format)")
    monthly_interest_amount: int = Field(..., description="Fixed monthly interest fee")
    months_calculated: int = Field(..., description="Number of months calculated")
    total_months_elapsed: int = Field(..., description="Total months since pawn date")
    grace_period_months: int = Field(..., description="Months past maturity (grace period)")
    final_balance: int = Field(..., description="Final calculated balance")
    interest_cap_applied: bool = Field(..., description="Whether 3-month cap was applied")
    
    monthly_progression: List[Dict[str, Any]] = Field(..., description="Month-by-month breakdown")
    
    summary: Dict[str, Any] = Field(..., description="Summary statistics")


class PayoffAmountResponse(BaseModel):
    """Schema for payoff amount calculation"""
    transaction_id: str = Field(..., description="Transaction identifier")
    payoff_amount: int = Field(..., description="Total amount needed to pay off loan")
    payoff_amount_formatted: str = Field(..., description="Formatted payoff amount")
    as_of_date: str = Field(..., description="Payoff calculation date (ISO format)")
    
    components: Dict[str, int] = Field(..., description="Breakdown of remaining components")
    note: str = Field(..., description="Important note about payoff")


class TransactionSummaryResponse(BaseModel):
    """Schema for comprehensive transaction summary"""
    transaction: PawnTransactionResponse = Field(..., description="Transaction details")
    items: List[PawnItemResponse] = Field(..., description="Transaction items")
    balance: BalanceResponse = Field(..., description="Current balance information")
    
    summary: Dict[str, Any] = Field(..., description="Summary statistics")


class TransactionSearchFilters(BaseModel):
    """Schema for transaction search filters"""
    status: Optional[TransactionStatus] = Field(None, description="Filter by transaction status")
    customer_id: Optional[str] = Field(None, description="Filter by customer phone number")
    min_amount: Optional[int] = Field(None, ge=0, description="Minimum loan amount filter")
    max_amount: Optional[int] = Field(None, ge=0, description="Maximum loan amount filter")
    start_date: Optional[datetime] = Field(None, description="Start date filter")
    end_date: Optional[datetime] = Field(None, description="End date filter")
    storage_location: Optional[str] = Field(None, description="Storage location filter")
    
    # Pagination
    page: int = Field(1, ge=1, description="Page number (starts at 1)")
    page_size: int = Field(20, ge=1, le=100, description="Items per page (1-100)")
    sort_by: TransactionSortField = Field(TransactionSortField.PAWN_DATE, description="Sort field")
    sort_order: SortOrder = Field(SortOrder.DESC, description="Sort order: 'asc' or 'desc'")
    
    @field_validator('sort_by')
    @classmethod
    def validate_sort_field(cls, v):
        """Validate sort field is allowed"""
        if isinstance(v, str):
            # Convert string to enum if needed
            try:
                return TransactionSortField(v)
            except ValueError:
                raise ValueError(f"Invalid sort field '{v}'. Allowed fields: {[field.value for field in TransactionSortField]}")
        return v
    
    @field_validator('sort_order')
    @classmethod
    def validate_sort_order(cls, v):
        """Validate sort order"""
        if isinstance(v, str):
            try:
                return SortOrder(v)
            except ValueError:
                raise ValueError(f"Invalid sort order '{v}'. Allowed values: {[order.value for order in SortOrder]}")
        return v


class BulkStatusUpdateRequest(BaseModel):
    """Schema for bulk status updates"""
    transaction_ids: List[str] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="List of transaction IDs to update (1-100)"
    )
    new_status: TransactionStatus = Field(..., description="New status to apply")
    notes: Optional[str] = Field(
        None,
        max_length=200,
        description="Optional notes for all updates"
    )


class BulkStatusUpdateResponse(BaseModel):
    """Schema for bulk status update results"""
    success_count: int = Field(..., description="Number of successfully updated transactions")
    error_count: int = Field(..., description="Number of failed updates")
    total_requested: int = Field(..., description="Total number of transactions requested")
    
    successful_updates: List[str] = Field(..., description="Transaction IDs that were updated")
    failed_updates: List[Dict[str, str]] = Field(..., description="Failed updates with error messages")


class TransactionVoidRequest(BaseModel):
    """Schema for voiding a transaction (Admin only)"""
    void_reason: str = Field(
        ..., 
        min_length=1, 
        max_length=500,
        description="Reason for voiding transaction (required for audit trail)"
    )
    admin_notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="Additional admin notes about the void operation"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "void_reason": "Customer changed mind, items not received",
                "admin_notes": "Called customer to confirm cancellation"
            }
        }
    )


class TransactionCancelRequest(BaseModel):
    """Schema for canceling a transaction (Staff access)"""
    cancel_reason: str = Field(
        ..., 
        min_length=1, 
        max_length=500,
        description="Reason for canceling transaction (required for audit trail)"
    )
    staff_notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="Additional staff notes about the cancellation"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "cancel_reason": "Customer changed mind before items were stored",
                "staff_notes": "Items rejected during inspection"
            }
        }
    )


class TransactionVoidResponse(BaseModel):
    """Schema for void/cancel transaction response"""
    transaction_id: str = Field(..., description="Transaction identifier")
    original_status: str = Field(..., description="Status before void/cancel operation")
    new_status: str = Field(..., description="Status after void/cancel operation")
    operation_type: str = Field(..., description="Type of operation (void or cancel)")
    performed_by: str = Field(..., description="User ID who performed the operation")
    reason: str = Field(..., description="Reason for the operation")
    operation_date: datetime = Field(..., description="When the operation was performed")
    audit_trail: Dict[str, Any] = Field(..., description="Complete audit information")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
                "original_status": "active",
                "new_status": "voided",
                "operation_type": "void",
                "performed_by": "69",
                "reason": "Customer changed mind, items not received",
                "operation_date": "2025-08-15T16:30:00Z",
                "audit_trail": {
                    "performed_by_user_id": "69",
                    "operation_date": "2025-08-15T16:30:00Z",
                    "original_status": "active",
                    "reason": "Customer changed mind, items not received",
                    "admin_notes": "Called customer to confirm cancellation",
                    "total_payments_at_operation": 0
                }
            }
        }
    )