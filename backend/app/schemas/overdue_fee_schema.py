"""
Overdue Fee Schemas

Pydantic models for overdue fee API request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class OverdueFeeSetRequest(BaseModel):
    """Request to set overdue fee on a transaction"""
    overdue_fee: int = Field(
        ...,
        ge=0,
        le=10000,
        description="Overdue fee amount in whole dollars (0-10000)"
    )
    notes: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional notes about why the fee is being set"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "overdue_fee": 50,
                "notes": "Customer is 30 days overdue, standard fee applied"
            }
        }
    }


class OverdueFeeClearRequest(BaseModel):
    """Request to clear overdue fee from a transaction"""
    reason: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional reason for clearing the fee"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "reason": "Customer discount approved by manager"
            }
        }
    }


class OverdueFeeResponse(BaseModel):
    """Response after setting or clearing overdue fee"""
    success: bool = Field(..., description="Operation success status")
    message: str = Field(..., description="Success or error message")
    transaction_id: str = Field(..., description="Transaction identifier")
    overdue_fee: int = Field(..., description="Current overdue fee amount")
    status: str = Field(..., description="Current transaction status")

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "message": "Overdue fee set to $50",
                "transaction_id": "abc123",
                "overdue_fee": 50,
                "status": "overdue"
            }
        }
    }


class OverdueFeeInfoResponse(BaseModel):
    """Overdue fee information for a transaction"""
    transaction_id: str = Field(..., description="Transaction identifier")
    status: str = Field(..., description="Current transaction status")
    is_overdue: bool = Field(..., description="Whether transaction is overdue")
    is_eligible_for_fee: bool = Field(..., description="Whether fee can be set")
    current_overdue_fee: int = Field(..., description="Current overdue fee amount")
    current_overdue_fee_formatted: str = Field(..., description="Formatted fee amount")
    has_overdue_fee: bool = Field(..., description="Whether fee is set")
    days_overdue: int = Field(..., description="Days past maturity date")
    maturity_date: Optional[str] = Field(None, description="Transaction maturity date")
    can_set_fee: bool = Field(..., description="Whether fee can be set")
    can_clear_fee: bool = Field(..., description="Whether fee can be cleared")

    model_config = {
        "json_schema_extra": {
            "example": {
                "transaction_id": "abc123",
                "status": "overdue",
                "is_overdue": True,
                "is_eligible_for_fee": True,
                "current_overdue_fee": 50,
                "current_overdue_fee_formatted": "$50",
                "has_overdue_fee": True,
                "days_overdue": 15,
                "maturity_date": "2024-01-15T00:00:00Z",
                "can_set_fee": True,
                "can_clear_fee": True
            }
        }
    }


class OverdueFeeTotalResponse(BaseModel):
    """Total redemption amount including overdue fee"""
    transaction_id: str = Field(..., description="Transaction identifier")
    base_balance: int = Field(..., description="Base balance without overdue fee")
    base_balance_formatted: str = Field(..., description="Formatted base balance")
    overdue_fee: int = Field(..., description="Overdue fee amount")
    overdue_fee_formatted: str = Field(..., description="Formatted overdue fee")
    total_redemption_amount: int = Field(..., description="Total amount needed to redeem")
    total_redemption_amount_formatted: str = Field(..., description="Formatted total")
    has_overdue_fee: bool = Field(..., description="Whether overdue fee exists")
    breakdown: Dict[str, int] = Field(..., description="Detailed balance breakdown")

    model_config = {
        "json_schema_extra": {
            "example": {
                "transaction_id": "abc123",
                "base_balance": 550,
                "base_balance_formatted": "$550",
                "overdue_fee": 50,
                "overdue_fee_formatted": "$50",
                "total_redemption_amount": 600,
                "total_redemption_amount_formatted": "$600",
                "has_overdue_fee": True,
                "breakdown": {
                    "principal_balance": 400,
                    "interest_balance": 100,
                    "extension_fees_balance": 50,
                    "overdue_fee": 50,
                    "total": 600
                }
            }
        }
    }


class OverdueFeeValidationRequest(BaseModel):
    """Request to validate proposed overdue fee"""
    proposed_fee: int = Field(
        ...,
        ge=0,
        description="Proposed overdue fee amount"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "proposed_fee": 75
            }
        }
    }


class OverdueFeeValidationResponse(BaseModel):
    """Validation result for proposed overdue fee"""
    transaction_id: str = Field(..., description="Transaction identifier")
    is_valid: bool = Field(..., description="Whether proposed fee is valid")
    validation_errors: list[str] = Field(default_factory=list, description="Validation errors")
    warnings: list[str] = Field(default_factory=list, description="Warnings")
    proposed_fee: int = Field(..., description="Proposed fee amount")
    current_fee: int = Field(..., description="Current fee amount")
    fee_difference: int = Field(..., description="Difference between proposed and current")
    current_total_due: int = Field(..., description="Current total due with current fee")
    new_total_due: int = Field(..., description="New total due with proposed fee")
    impact: str = Field(..., description="Impact type: increase, decrease, or no_change")
    can_proceed: bool = Field(..., description="Whether operation can proceed")

    model_config = {
        "json_schema_extra": {
            "example": {
                "transaction_id": "abc123",
                "is_valid": True,
                "validation_errors": [],
                "warnings": ["Large overdue fee - ensure proper authorization"],
                "proposed_fee": 150,
                "current_fee": 50,
                "fee_difference": 100,
                "current_total_due": 600,
                "new_total_due": 700,
                "impact": "increase",
                "can_proceed": True
            }
        }
    }
