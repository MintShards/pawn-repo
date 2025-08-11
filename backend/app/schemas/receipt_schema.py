"""
Receipt Pydantic schemas for request/response validation.

This module defines all schemas used for receipt-related API operations,
including receipt generation, formatting, and summary responses.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class ReceiptItemResponse(BaseModel):
    """Schema for items in receipt responses"""
    number: int = Field(..., description="Item number within transaction")
    description: str = Field(..., description="Item description")
    serial_number: str = Field(..., description="Item serial number or 'None'")
    item_id: Optional[str] = Field(None, description="Internal item identifier")
    
    model_config = ConfigDict(from_attributes=True)


class ReceiptCustomerInfo(BaseModel):
    """Schema for customer information in receipts"""
    name: str = Field(..., description="Customer full name")
    phone: str = Field(..., description="Customer phone number")
    customer_id: str = Field(..., description="Customer identifier")
    status: Optional[str] = Field(None, description="Customer status")
    
    model_config = ConfigDict(from_attributes=True)


class ReceiptLoanTerms(BaseModel):
    """Schema for loan terms in initial pawn receipts"""
    loan_amount: str = Field(..., description="Formatted loan amount")
    monthly_interest: str = Field(..., description="Formatted monthly interest")
    maturity_date: str = Field(..., description="Loan maturity date")
    grace_period_ends: str = Field(..., description="Grace period end date")
    total_days: str = Field(..., description="Total loan period description")
    loan_amount_raw: int = Field(..., description="Raw loan amount in cents")
    monthly_interest_raw: int = Field(..., description="Raw monthly interest in cents")
    
    model_config = ConfigDict(from_attributes=True)


class ReceiptPaymentDetails(BaseModel):
    """Schema for payment details in payment receipts"""
    payment_amount: str = Field(..., description="Formatted payment amount")
    payment_date: str = Field(..., description="Formatted payment date")
    payment_method: str = Field(..., description="Payment method")
    remaining_balance: str = Field(..., description="Formatted remaining balance")
    status: str = Field(..., description="Payment status")
    receipt_number: Optional[str] = Field(None, description="Payment receipt number")
    
    model_config = ConfigDict(from_attributes=True)


class ReceiptBalanceBreakdown(BaseModel):
    """Schema for balance breakdown in payment receipts"""
    original_loan: str = Field(..., description="Formatted original loan amount")
    interest_accrued: str = Field(..., description="Formatted interest accrued")
    extension_fees: str = Field(..., description="Formatted extension fees")
    total_payments: str = Field(..., description="Formatted total payments made")
    current_balance: str = Field(..., description="Formatted current balance")
    
    model_config = ConfigDict(from_attributes=True)


class ReceiptExtensionDetails(BaseModel):
    """Schema for extension details in extension receipts"""
    months_extended: int = Field(..., description="Number of months extended")
    fee_per_month: str = Field(..., description="Formatted fee per month")
    total_extension_fee: str = Field(..., description="Formatted total extension fee")
    original_maturity: str = Field(..., description="Original maturity date")
    new_maturity_date: str = Field(..., description="New maturity date")
    new_grace_period_ends: str = Field(..., description="New grace period end date")
    extension_reason: Optional[str] = Field(None, description="Reason for extension")
    
    model_config = ConfigDict(from_attributes=True)


class InitialPawnReceiptResponse(BaseModel):
    """Schema for initial pawn receipt response"""
    receipt_id: str = Field(..., description="Unique receipt identifier")
    receipt_type: str = Field(..., description="Receipt type identifier")
    transaction_id: str = Field(..., description="Associated transaction ID")
    date: datetime = Field(..., description="Receipt generation date")
    customer: ReceiptCustomerInfo = Field(..., description="Customer information")
    items: List[ReceiptItemResponse] = Field(..., description="List of pawned items")
    storage_location: str = Field(..., description="Item storage location")
    loan_terms: ReceiptLoanTerms = Field(..., description="Loan terms details")
    staff_member: str = Field(..., description="Staff member name")
    staff_id: str = Field(..., description="Staff member ID")
    transaction_status: str = Field(..., description="Current transaction status")
    item_count: int = Field(..., description="Total number of items")
    important_notes: List[str] = Field(..., description="Important customer notes")
    internal_notes: Optional[str] = Field(None, description="Internal notes (storage receipts only)")
    storage_instructions: Optional[List[str]] = Field(None, description="Storage instructions")
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "receipt_id": "12345678-1234-1234-1234-123456789abc",
                "receipt_type": "INITIAL PAWN RECEIPT",
                "transaction_id": "87654321-4321-4321-4321-123456789abc",
                "date": "2025-01-10T10:00:00Z",
                "customer": {
                    "name": "John Doe",
                    "phone": "5551234567",
                    "customer_id": "5551234567",
                    "status": "active"
                },
                "items": [
                    {
                        "number": 1,
                        "description": "14k Gold Ring",
                        "serial_number": "GR-2025-001",
                        "item_id": "item-123-456"
                    }
                ],
                "storage_location": "Shelf A-5",
                "loan_terms": {
                    "loan_amount": "$500.00",
                    "monthly_interest": "$50.00",
                    "maturity_date": "April 10, 2025",
                    "grace_period_ends": "April 17, 2025",
                    "total_days": "97 days (90 + 7 grace period)",
                    "loan_amount_raw": 500,
                    "monthly_interest_raw": 50
                },
                "staff_member": "Jane Smith",
                "staff_id": "01",
                "transaction_status": "active",
                "item_count": 1,
                "important_notes": [
                    "Pick up anytime within 97 days",
                    "Make partial payments anytime"
                ]
            }
        }
    )


class PaymentReceiptResponse(BaseModel):
    """Schema for payment receipt response"""
    receipt_id: str = Field(..., description="Unique receipt identifier")
    receipt_type: str = Field(..., description="Receipt type identifier")
    transaction_id: str = Field(..., description="Associated transaction ID")
    payment_id: str = Field(..., description="Associated payment ID")
    date: datetime = Field(..., description="Payment date")
    customer: ReceiptCustomerInfo = Field(..., description="Customer information")
    items: List[ReceiptItemResponse] = Field(..., description="List of pawned items")
    payment_details: ReceiptPaymentDetails = Field(..., description="Payment details")
    balance_breakdown: ReceiptBalanceBreakdown = Field(..., description="Balance breakdown")
    staff_member: str = Field(..., description="Staff member name")
    staff_id: str = Field(..., description="Staff member ID")
    item_count: int = Field(..., description="Total number of items")
    transaction_status: str = Field(..., description="Current transaction status")
    redemption_note: Optional[str] = Field(None, description="Item redemption note")
    next_steps: List[str] = Field(..., description="Next steps for customer")
    storage_instructions: Optional[List[str]] = Field(None, description="Storage instructions")
    
    model_config = ConfigDict(from_attributes=True)


class ExtensionReceiptResponse(BaseModel):
    """Schema for extension receipt response"""
    receipt_id: str = Field(..., description="Unique receipt identifier")
    receipt_type: str = Field(..., description="Receipt type identifier")
    transaction_id: str = Field(..., description="Associated transaction ID")
    extension_id: str = Field(..., description="Associated extension ID")
    date: datetime = Field(..., description="Extension date")
    customer: ReceiptCustomerInfo = Field(..., description="Customer information")
    items: List[ReceiptItemResponse] = Field(..., description="List of pawned items")
    extension_details: ReceiptExtensionDetails = Field(..., description="Extension details")
    staff_member: str = Field(..., description="Staff member name")
    staff_id: str = Field(..., description="Staff member ID")
    item_count: int = Field(..., description="Total number of items")
    transaction_status: str = Field(..., description="Current transaction status")
    important_notes: List[str] = Field(..., description="Important extension notes")
    internal_notes: Optional[str] = Field(None, description="Internal notes")
    storage_instructions: Optional[List[str]] = Field(None, description="Storage instructions")
    
    model_config = ConfigDict(from_attributes=True)


class ReceiptTextResponse(BaseModel):
    """Schema for formatted text receipt response"""
    receipt_id: str = Field(..., description="Unique receipt identifier")
    receipt_type: str = Field(..., description="Receipt type identifier")
    transaction_id: str = Field(..., description="Associated transaction ID")
    formatted_receipt: str = Field(..., description="Formatted receipt text for printing")
    character_count: int = Field(..., description="Total character count")
    line_count: int = Field(..., description="Total line count")
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "receipt_id": "12345678-1234-1234-1234-123456789abc",
                "receipt_type": "INITIAL PAWN RECEIPT",
                "transaction_id": "87654321-4321-4321-4321-123456789abc",
                "formatted_receipt": "================================================\n                 PAWN SHOP RECEIPT\n================================================\n\nINITIAL PAWN RECEIPT...",
                "character_count": 1250,
                "line_count": 45
            }
        }
    )


class ReceiptSummaryResponse(BaseModel):
    """Schema for transaction receipt summary response"""
    transaction_id: str = Field(..., description="Transaction identifier")
    receipt_types_available: List[str] = Field(..., description="Available receipt types")
    total_payments: int = Field(..., description="Total number of payments")
    total_extensions: int = Field(..., description="Total number of extensions")
    item_count: int = Field(..., description="Number of items in transaction")
    transaction_status: str = Field(..., description="Current transaction status")
    receipts_generated: Dict[str, Any] = Field(..., description="Receipt generation summary")
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "transaction_id": "87654321-4321-4321-4321-123456789abc",
                "receipt_types_available": ["initial_pawn", "payment", "extension"],
                "total_payments": 2,
                "total_extensions": 1,
                "item_count": 3,
                "transaction_status": "extended",
                "receipts_generated": {
                    "initial_pawn": True,
                    "payments": 2,
                    "extensions": 1
                }
            }
        }
    )


class ReceiptGenerationRequest(BaseModel):
    """Schema for receipt generation requests"""
    format: str = Field(
        default="json",
        description="Receipt format: 'json' or 'text'"
    )
    receipt_type: str = Field(
        default="customer",
        description="Receipt variant: 'customer' or 'storage'"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "format": "json",
                "receipt_type": "customer"
            }
        }
    )