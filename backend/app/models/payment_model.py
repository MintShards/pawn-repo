"""
Payment Model

Model for cash payments made on pawn transactions. Handles partial payments,
tracks balance changes, and maintains complete audit trail for all financial
transactions in the pawn system.
"""

from beanie import Document, Indexed
from pydantic import Field, field_validator, ConfigDict
from datetime import datetime, UTC
from typing import Optional
from uuid import uuid4


class Payment(Document):
    """
    Payment document model.
    
    Represents cash payments made on pawn transactions with comprehensive
    tracking, validation, and audit trail capabilities.
    """
    
    # Identifiers
    payment_id: Indexed(str) = Field(
        default_factory=lambda: str(uuid4()),
        description="Unique payment identifier"
    )
    transaction_id: Indexed(str) = Field(
        ...,
        description="Reference to PawnTransaction document via transaction_id"
    )
    processed_by_user_id: Indexed(str) = Field(
        ...,
        description="Reference to User document (staff member who processed payment)"
    )
    
    # Payment details (integers only - whole dollars, cash only)
    payment_amount: int = Field(
        ...,
        gt=0,
        description="Amount paid in cash (whole dollars only)"
    )
    balance_before_payment: int = Field(
        ...,
        ge=0,
        description="Balance before this payment was applied"
    )
    balance_after_payment: int = Field(
        ...,
        ge=0,
        description="Remaining balance after this payment"
    )
    principal_portion: int = Field(
        default=0,
        ge=0,
        description="Amount of payment applied to principal"
    )
    interest_portion: int = Field(
        default=0,
        ge=0,
        description="Amount of payment applied to interest"
    )
    
    # Payment metadata
    payment_method: str = Field(
        default="cash",
        description="Payment method (cash only for pawn transactions)"
    )
    receipt_number: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Optional receipt number for tracking"
    )
    internal_notes: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Internal notes about this payment"
    )
    
    # Void functionality
    is_voided: bool = Field(
        default=False,
        description="Whether this payment has been voided"
    )
    voided_date: Optional[datetime] = Field(
        default=None,
        description="Date/time when payment was voided"
    )
    voided_by_user_id: Optional[str] = Field(
        default=None,
        description="User ID who voided this payment"
    )
    void_reason: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Reason for voiding payment"
    )
    
    # Timestamps
    payment_date: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Date/time when payment was made"
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Record creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Record last update timestamp"
    )
    
    # Pydantic v2 configuration
    model_config = ConfigDict(
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "transaction_id": "12345678-1234-1234-1234-123456789abc",
                "processed_by_user_id": "01",
                "payment_amount": 50,
                "balance_before_payment": 115,
                "balance_after_payment": 65,
                "payment_method": "cash",
                "internal_notes": "Partial payment - customer returning next week"
            }
        }
    )
    
    @field_validator('payment_amount')
    @classmethod
    def validate_payment_amount(cls, v: int) -> int:
        """Ensure payment amount is positive and reasonable"""
        if v <= 0:
            raise ValueError('Payment amount must be greater than 0')
        if v > 50000:  # Business rule: max payment $50,000
            raise ValueError('Payment amount cannot exceed $50,000')
        return v
    
    @field_validator('balance_before_payment')
    @classmethod
    def validate_balance_before_payment(cls, v: int) -> int:
        """Ensure balance before payment is non-negative"""
        if v < 0:
            raise ValueError('Balance before payment cannot be negative')
        return v
    
    @field_validator('balance_after_payment')
    @classmethod
    def validate_balance_after_payment(cls, v: int) -> int:
        """Ensure balance after payment is non-negative"""
        if v < 0:
            raise ValueError('Balance after payment cannot be negative')
        return v
    
    @field_validator('payment_method')
    @classmethod
    def validate_payment_method(cls, v: str) -> str:
        """Ensure payment method is cash only for pawn transactions"""
        allowed_methods = ["cash"]
        if v.lower() not in allowed_methods:
            raise ValueError(f'Payment method must be one of: {allowed_methods}')
        return v.lower()
    
    @field_validator('transaction_id')
    @classmethod
    def validate_transaction_id(cls, v: str) -> str:
        """Ensure transaction_id is not empty"""
        if not v or not v.strip():
            raise ValueError('Transaction ID is required and cannot be empty')
        return v.strip()
    
    @field_validator('processed_by_user_id')
    @classmethod
    def validate_processed_by_user_id(cls, v: str) -> str:
        """Ensure processed_by_user_id is not empty"""
        if not v or not v.strip():
            raise ValueError('Processed by user ID is required and cannot be empty')
        return v.strip()
    
    @field_validator('receipt_number', mode='before')
    @classmethod
    def validate_receipt_number(cls, v) -> Optional[str]:
        """Handle empty strings and normalize receipt numbers"""
        if v == "" or v is None:
            return None
        if isinstance(v, str):
            normalized = v.strip()
            return normalized if normalized else None
        return v
    
    @field_validator('internal_notes', mode='before')
    @classmethod
    def validate_internal_notes(cls, v) -> Optional[str]:
        """Handle empty strings and normalize internal notes"""
        if v == "" or v is None:
            return None
        if isinstance(v, str):
            normalized = v.strip()
            return normalized if normalized else None
        return v
    
    @field_validator('void_reason', mode='before')
    @classmethod
    def validate_void_reason(cls, v) -> Optional[str]:
        """Handle empty strings and normalize void reason"""
        if v == "" or v is None:
            return None
        if isinstance(v, str):
            normalized = v.strip()
            return normalized if normalized else None
        return v
    
    @property
    def payment_type(self) -> str:
        """Return payment_method as payment_type for schema compatibility"""
        return self.payment_method
    
    def validate_payment_math(self) -> None:
        """
        Validate that payment math is correct.
        balance_before_payment - payment_amount should equal balance_after_payment
        """
        expected_balance = self.balance_before_payment - self.payment_amount
        if self.balance_after_payment != expected_balance:
            raise ValueError(
                f'Payment math incorrect: {self.balance_before_payment} - {self.payment_amount} '
                f'should equal {expected_balance}, but balance_after_payment is {self.balance_after_payment}'
            )
    
    def void_payment(self, voided_by_user_id: str, void_reason: Optional[str] = None) -> None:
        """
        Mark this payment as voided.
        
        Args:
            voided_by_user_id: User ID who is voiding the payment
            void_reason: Optional reason for voiding
            
        Raises:
            ValueError: If payment is already voided
        """
        if self.is_voided:
            raise ValueError(f"Payment {self.payment_id} is already voided")
        
        self.is_voided = True
        self.voided_date = datetime.now(UTC)
        self.voided_by_user_id = voided_by_user_id
        self.void_reason = void_reason
    
    async def save(self, *args, **kwargs) -> None:
        """Override save to validate payment math and update timestamps"""
        # Validate payment math before saving
        self.validate_payment_math()
        
        # Update timestamp
        self.updated_at = datetime.now(UTC)
        
        # Call parent save
        await super().save(*args, **kwargs)
    
    def __str__(self) -> str:
        """Human-readable string representation."""
        return f"Payment(${self.payment_amount} on {self.payment_date.strftime('%Y-%m-%d')})"
    
    def __repr__(self) -> str:
        """Detailed string representation with all key fields."""
        return (f"Payment(payment_id='{self.payment_id}', "
                f"transaction_id='{self.transaction_id}', "
                f"amount=${self.payment_amount}, "
                f"balance_after=${self.balance_after_payment})")
    
    @property
    def payment_amount_dollars(self) -> str:
        """Format payment amount as currency string"""
        return f"${self.payment_amount:,}"
    
    @property
    def balance_after_dollars(self) -> str:
        """Format remaining balance as currency string"""
        return f"${self.balance_after_payment:,}"
    
    class Settings:
        """Beanie document settings"""
        name = "payments"
        indexes = [
            "payment_id",
            "transaction_id",
            "processed_by_user_id",
            "payment_date",
            "payment_method",
            # Compound indexes for efficient queries
            [("transaction_id", 1), ("payment_date", -1)],  # Payment history (newest first)
            [("processed_by_user_id", 1), ("payment_date", -1)],  # Staff payment history
            [("payment_date", -1), ("payment_amount", -1)],  # Daily cash reports
        ]