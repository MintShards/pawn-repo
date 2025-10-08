"""
Discount Schemas

Pydantic schemas for payment discount approval system.
Matches reversal/voiding approval pattern.
"""

from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional


class DiscountValidationRequest(BaseModel):
    """Request schema for validating discount eligibility"""

    transaction_id: str = Field(..., description="Transaction ID")
    payment_amount: int = Field(..., gt=0, description="Payment amount")
    discount_amount: int = Field(..., gt=0, le=10000, description="Proposed discount amount")

    class Config:
        json_schema_extra = {
            "example": {
                "transaction_id": "87654321-4321-4321-4321-210987654321",
                "payment_amount": 100,
                "discount_amount": 15
            }
        }


class DiscountValidationResponse(BaseModel):
    """Response schema for discount validation"""

    is_valid: bool = Field(..., description="Whether discount can be applied")
    reason: Optional[str] = Field(default=None, description="Reason if not valid")

    # Transaction context
    transaction_id: str = Field(..., description="Transaction ID")
    current_balance: int = Field(..., description="Current balance before payment")
    is_final_payment: bool = Field(..., description="Whether this is a final redemption payment")

    # Discount breakdown
    discount_amount: int = Field(..., description="Proposed discount amount")
    discount_on_interest: int = Field(..., description="Discount applied to interest")
    discount_on_principal: int = Field(..., description="Discount applied to principal")

    # Effective payment calculation
    cash_payment: int = Field(..., description="Cash payment amount")
    effective_payment: int = Field(..., description="Cash + discount = total effective payment")
    new_balance: int = Field(..., description="Balance after payment + discount")

    class Config:
        json_schema_extra = {
            "example": {
                "is_valid": True,
                "reason": None,
                "transaction_id": "87654321-4321-4321-4321-210987654321",
                "current_balance": 115,
                "is_final_payment": True,
                "discount_amount": 15,
                "discount_on_interest": 15,
                "discount_on_principal": 0,
                "cash_payment": 100,
                "effective_payment": 115,
                "new_balance": 0
            }
        }


class PaymentWithDiscountRequest(BaseModel):
    """Request schema for creating payment with discount"""

    transaction_id: str = Field(..., description="Transaction ID")
    payment_amount: int = Field(..., gt=0, description="Cash payment amount")
    discount_amount: int = Field(..., gt=0, le=10000, description="Discount amount")
    discount_reason: str = Field(..., min_length=1, max_length=200, description="Discount reason")
    admin_pin: str = Field(..., min_length=4, max_length=4, description="Admin PIN")

    @field_validator('discount_reason')
    @classmethod
    def validate_discount_reason(cls, v: str) -> str:
        """Ensure discount reason is not empty"""
        if not v or not v.strip():
            raise ValueError('Discount reason is required')
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
                "transaction_id": "87654321-4321-4321-4321-210987654321",
                "payment_amount": 100,
                "discount_amount": 15,
                "discount_reason": "Customer loyalty discount",
                "admin_pin": "6969"
            }
        }


class DailyDiscountReportResponse(BaseModel):
    """Response schema for daily discount reporting"""

    report_date: datetime = Field(..., description="Report date")
    total_discounts_given: int = Field(..., description="Total number of discounts")
    total_discount_amount: int = Field(..., description="Total dollar amount discounted")
    average_discount: int = Field(..., description="Average discount amount")
    discounts_by_staff: dict = Field(..., description="Breakdown by staff member")

    class Config:
        json_schema_extra = {
            "example": {
                "report_date": "2025-01-13T00:00:00Z",
                "total_discounts_given": 5,
                "total_discount_amount": 75,
                "average_discount": 15,
                "discounts_by_staff": {
                    "69": {"count": 3, "total": 45},
                    "02": {"count": 2, "total": 30}
                }
            }
        }
