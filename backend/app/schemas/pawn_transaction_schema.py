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
    storage_location: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        description="Physical storage location (e.g., 'Shelf A-5', defaults to 'TBD')"
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
    formatted_id: Optional[str] = Field(None, description="Display-friendly transaction ID (e.g., 'PW000105')")
    customer_id: str = Field(..., description="Customer phone number")
    created_by_user_id: str = Field(..., description="Staff member who created transaction")
    
    # Items information
    items: Optional[List[PawnItemResponse]] = Field(
        default_factory=list,
        description="List of pawned items"
    )
    
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
    search_text: Optional[str] = Field(None, description="Search by transaction ID (PW000123) or customer phone number")
    min_amount: Optional[int] = Field(None, ge=0, le=10000, description="Minimum loan amount filter ($0-$10,000)")
    max_amount: Optional[int] = Field(None, ge=0, le=10000, description="Maximum loan amount filter ($0-$10,000)")
    start_date: Optional[datetime] = Field(None, description="Start date filter (pawn date)")
    end_date: Optional[datetime] = Field(None, description="End date filter (pawn date)")
    maturity_date_from: Optional[datetime] = Field(None, description="Maturity date from filter")
    maturity_date_to: Optional[datetime] = Field(None, description="Maturity date to filter")
    min_days_overdue: Optional[int] = Field(None, ge=0, le=10000, description="Minimum days overdue filter (0-10,000 days)")
    max_days_overdue: Optional[int] = Field(None, ge=0, le=10000, description="Maximum days overdue filter (0-10,000 days)")
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
    
    @field_validator('start_date', 'end_date', 'maturity_date_from', 'maturity_date_to')
    @classmethod
    def validate_dates(cls, v):
        """Validate date filters are not in the future and are reasonable"""
        if v is None:
            return v
        
        from datetime import datetime, UTC
        now = datetime.now(UTC)
        
        # Allow dates up to 1 year in the future for maturity dates
        max_future_date = now.replace(year=now.year + 1)
        
        # Allow dates back to 2020 for historical data
        min_past_date = now.replace(year=2020, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        
        if v > max_future_date:
            raise ValueError(f"Date cannot be more than 1 year in the future. Maximum allowed: {max_future_date.strftime('%Y-%m-%d')}")
        
        if v < min_past_date:
            raise ValueError(f"Date cannot be before 2020. Minimum allowed: {min_past_date.strftime('%Y-%m-%d')}")
        
        return v
    
    def model_post_init(self, __context) -> None:
        """Validate cross-field constraints after all fields are set"""
        # Validate loan amount range
        if self.min_amount is not None and self.max_amount is not None:
            if self.min_amount > self.max_amount:
                raise ValueError(f"Minimum loan amount (${self.min_amount}) cannot be greater than maximum loan amount (${self.max_amount})")
        
        # Validate days overdue range
        if self.min_days_overdue is not None and self.max_days_overdue is not None:
            if self.min_days_overdue > self.max_days_overdue:
                raise ValueError(f"Minimum days overdue ({self.min_days_overdue}) cannot be greater than maximum days overdue ({self.max_days_overdue})")
        
        # Validate pawn date range
        if self.start_date is not None and self.end_date is not None:
            if self.start_date > self.end_date:
                raise ValueError(f"Pawn date 'from' ({self.start_date.strftime('%Y-%m-%d')}) cannot be after 'to' date ({self.end_date.strftime('%Y-%m-%d')})")
        
        # Validate maturity date range
        if self.maturity_date_from is not None and self.maturity_date_to is not None:
            if self.maturity_date_from > self.maturity_date_to:
                raise ValueError(f"Maturity date 'from' ({self.maturity_date_from.strftime('%Y-%m-%d')}) cannot be after 'to' date ({self.maturity_date_to.strftime('%Y-%m-%d')})")


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
    admin_pin: str = Field(
        ..., 
        min_length=4, 
        max_length=4,
        description="Admin PIN for authorization (required for security)"
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
                "admin_pin": "1234",
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


# Unified Search Schemas

class UnifiedSearchType(str, Enum):
    """Search type classification for intelligent routing"""
    AUTO_DETECT = "auto_detect"
    TRANSACTION_ID = "transaction_id"
    EXTENSION_ID = "extension_id"
    PHONE_NUMBER = "phone_number"
    CUSTOMER_NAME = "customer_name"
    FULL_TEXT = "full_text"


class UnifiedSearchRequest(BaseModel):
    """Schema for unified search requests"""
    search_text: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Search text (transaction ID, customer name, phone, etc.)"
    )
    search_type: UnifiedSearchType = Field(
        default=UnifiedSearchType.AUTO_DETECT,
        description="Search type (auto-detected if not specified)"
    )
    include_extensions: bool = Field(
        default=True,
        description="Include extension data in results"
    )
    include_items: bool = Field(
        default=True,
        description="Include item data in results"
    )
    include_customer: bool = Field(
        default=True,
        description="Include customer data in results"
    )
    page: int = Field(
        default=1,
        ge=1,
        description="Page number for pagination"
    )
    page_size: int = Field(
        default=20,
        ge=1,
        le=100,
        description="Number of results per page (max 100)"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "search_text": "PW000123",
                    "search_type": "transaction_id"
                },
                {
                    "search_text": "EX000045", 
                    "search_type": "extension_id"
                },
                {
                    "search_text": "5551234567",
                    "search_type": "phone_number"
                },
                {
                    "search_text": "John Smith",
                    "search_type": "customer_name"
                }
            ]
        }
    )


class SearchMetadata(BaseModel):
    """Search execution metadata"""
    search_type: str = Field(..., description="Detected or specified search type")
    search_text: str = Field(..., description="Original search text")
    total_count: int = Field(..., description="Total number of results")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Results per page")
    has_more: bool = Field(..., description="Whether there are more pages")
    execution_time_ms: float = Field(..., description="Search execution time in milliseconds")
    cache_hit: bool = Field(..., description="Whether result was served from cache")
    pipeline_stages: int = Field(..., description="Number of aggregation pipeline stages")


class UnifiedSearchResponse(BaseModel):
    """Schema for unified search response"""
    transactions: List[Dict[str, Any]] = Field(
        ...,
        description="List of transactions with enriched data"
    )
    total_count: int = Field(
        ...,
        description="Total number of matching transactions"
    )
    search_metadata: SearchMetadata = Field(
        ...,
        description="Search execution metadata"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "transactions": [
                    {
                        "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
                        "formatted_id": "PW000123",
                        "customer_id": "5551234567",
                        "customer_name": "John Smith",
                        "loan_amount": 500,
                        "status": "active",
                        "pawn_date": "2025-01-15T10:00:00Z",
                        "extensions": [],
                        "items": [
                            {
                                "description": "Gold necklace",
                                "serial_number": "GN123456"
                            }
                        ]
                    }
                ],
                "total_count": 1,
                "search_metadata": {
                    "search_type": "transaction_id",
                    "search_text": "PW000123",
                    "total_count": 1,
                    "page": 1,
                    "page_size": 20,
                    "has_more": False,
                    "execution_time_ms": 45.2,
                    "cache_hit": False,
                    "pipeline_stages": 5
                }
            }
        }
    )


class BatchStatusCountResponse(BaseModel):
    """Schema for batch status count response"""
    status_counts: Dict[str, int] = Field(
        ...,
        description="Status counts for all transaction statuses"
    )
    total_transactions: int = Field(
        ...,
        description="Total number of transactions across all statuses"
    )
    cache_hit: bool = Field(
        ...,
        description="Whether result was served from cache"
    )
    execution_time_ms: float = Field(
        ...,
        description="Query execution time in milliseconds"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status_counts": {
                    "active": 1250,
                    "overdue": 85,
                    "extended": 42,
                    "redeemed": 3450,
                    "forfeited": 125,
                    "sold": 89
                },
                "total_transactions": 5041,
                "cache_hit": True,
                "execution_time_ms": 2.1
            }
        }
    )