"""
Extension Model

Model for loan extensions on pawn transactions. Allows customers to extend
loan maturity dates for additional time, with flexible duration (1-3 months)
and customizable fees per month.
"""

from beanie import Document, Indexed
from pydantic import Field, field_validator, ConfigDict
from datetime import datetime, timedelta, UTC
from typing import Optional
from uuid import uuid4
import calendar


class Extension(Document):
    """
    Extension document model.
    
    Represents loan extensions with flexible duration, customizable fees,
    and automatic date calculations from original maturity date.
    """
    
    # Identifiers
    extension_id: Indexed(str) = Field(
        default_factory=lambda: str(uuid4()),
        description="Unique extension identifier"
    )
    transaction_id: Indexed(str) = Field(
        ...,
        description="Reference to PawnTransaction document via transaction_id"
    )
    processed_by_user_id: Indexed(str) = Field(
        ...,
        description="Reference to User document (staff member who processed extension)"
    )
    
    # Extension details
    extension_months: int = Field(
        ...,
        ge=1,
        le=3,
        description="Number of months to extend (1, 2, or 3)"
    )
    extension_fee_per_month: int = Field(
        ...,
        ge=0,
        description="Fee per month in whole dollars (staff-adjustable)"
    )
    total_extension_fee: int = Field(
        ...,
        ge=0,
        description="Total extension fee (extension_months × extension_fee_per_month)"
    )
    fee_paid: bool = Field(
        default=True,
        description="Whether extension fee has been paid (assumed paid at processing time)"
    )
    
    # Date calculations
    original_maturity_date: datetime = Field(
        ...,
        description="Original maturity date before extension"
    )
    new_maturity_date: Optional[datetime] = Field(
        default=None,
        description="New maturity date after extension (calculated from original)"
    )
    new_grace_period_end: Optional[datetime] = Field(
        default=None,
        description="New grace period end date (new_maturity_date + 7 days)"
    )
    
    # Extension metadata
    extension_reason: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Optional reason for extension"
    )
    internal_notes: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Internal staff notes about this extension"
    )
    
    # Cancellation functionality
    is_cancelled: bool = Field(
        default=False,
        description="Whether this extension has been cancelled"
    )
    cancelled_date: Optional[datetime] = Field(
        default=None,
        description="Date/time when extension was cancelled"
    )
    cancelled_by_user_id: Optional[str] = Field(
        default=None,
        description="User ID who cancelled this extension"
    )
    cancellation_reason: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Reason for cancelling extension"
    )
    
    # Timestamps
    extension_date: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Date/time when extension was processed"
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
                "extension_months": 2,
                "extension_fee_per_month": 25,
                "total_extension_fee": 50,
                "original_maturity_date": "2025-03-15T00:00:00Z",
                "new_maturity_date": "2025-05-15T00:00:00Z",
                "extension_reason": "Customer requested additional time"
            }
        }
    )
    
    @field_validator('extension_months')
    @classmethod
    def validate_extension_months(cls, v: int) -> int:
        """Ensure extension is 1, 2, or 3 months only"""
        if v not in [1, 2, 3]:
            raise ValueError('Extension months must be 1, 2, or 3')
        return v
    
    @field_validator('extension_fee_per_month')
    @classmethod
    def validate_extension_fee_per_month(cls, v: int) -> int:
        """Ensure extension fee is non-negative and reasonable"""
        if v < 0:
            raise ValueError('Extension fee per month cannot be negative')
        if v > 1000:  # Business rule: max extension fee $1,000/month
            raise ValueError('Extension fee per month cannot exceed $1,000')
        return v
    
    @field_validator('total_extension_fee')
    @classmethod
    def validate_total_extension_fee(cls, v: int) -> int:
        """Ensure total extension fee is non-negative"""
        if v < 0:
            raise ValueError('Total extension fee cannot be negative')
        return v
    
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
    
    @field_validator('extension_reason', mode='before')
    @classmethod
    def validate_extension_reason(cls, v) -> Optional[str]:
        """Handle empty strings and normalize extension reason"""
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
    
    def validate_extension_math(self) -> None:
        """
        Validate that extension fee math is correct.
        extension_months × extension_fee_per_month should equal total_extension_fee
        """
        expected_total = self.extension_months * self.extension_fee_per_month
        if self.total_extension_fee != expected_total:
            raise ValueError(
                f'Extension fee math incorrect: {self.extension_months} × ${self.extension_fee_per_month} '
                f'should equal ${expected_total}, but total_extension_fee is ${self.total_extension_fee}'
            )
    
    def calculate_new_maturity_date(self) -> datetime:
        """
        Calculate new maturity date from original maturity date + extension months.
        Uses calendar month arithmetic (same as PawnTransaction model).
        """
        if not self.original_maturity_date:
            raise ValueError('Original maturity date is required for calculation')
        
        return self._add_calendar_months(self.original_maturity_date, self.extension_months)
    
    def calculate_new_grace_period_end(self) -> datetime:
        """Calculate new grace period end date (new maturity + 1 month)"""
        if not self.new_maturity_date:
            raise ValueError('New maturity date is required for grace period calculation')
        
        return self._add_calendar_months(self.new_maturity_date, 1)
    
    def _add_calendar_months(self, start_date: datetime, months: int) -> datetime:
        """
        Helper method to add calendar months to a date.
        Consolidates duplicate calendar arithmetic logic.
        """
        year = start_date.year
        month = start_date.month + months
        day = start_date.day
        
        # Handle month overflow
        if month > 12:
            year += month // 12
            month = month % 12
            if month == 0:
                month = 12
                year -= 1
        
        # Handle day overflow for shorter months
        try:
            return start_date.replace(year=year, month=month, day=day)
        except ValueError:
            # Day doesn't exist in target month (e.g., Jan 31 → Feb 31)
            # Move to last day of the month
            last_day = calendar.monthrange(year, month)[1]
            return start_date.replace(year=year, month=month, day=last_day)
    
    def validate_extension_timing(self) -> None:
        """
        Validate that extension is being processed before forfeiture.
        This is a business rule check.
        """
        current_date = datetime.now(UTC)
        
        # Calculate original grace period end (1 month after original maturity)
        original_grace_end = self._add_calendar_months(self.original_maturity_date, 1)
        
        if current_date > original_grace_end:
            raise ValueError(
                f'Extension cannot be processed after grace period ended on '
                f'{original_grace_end.strftime("%Y-%m-%d")}. Item may be forfeited.'
            )
    
    async def save(self, *args, **kwargs) -> None:
        """Override save to validate calculations and update timestamps"""
        # Validate extension math
        self.validate_extension_math()
        
        # Calculate dates if not set
        if not self.new_maturity_date:
            self.new_maturity_date = self.calculate_new_maturity_date()
        
        if not self.new_grace_period_end:
            self.new_grace_period_end = self.calculate_new_grace_period_end()
        
        # Validate extension timing (business rule check)
        # Timing validation is handled at service level to allow late extensions
        
        # Update timestamp
        self.updated_at = datetime.now(UTC)
        
        # Call parent save
        await super().save(*args, **kwargs)
    
    def __str__(self) -> str:
        """Human-readable string representation."""
        return f"Extension({self.extension_months} months, ${self.total_extension_fee} on {self.extension_date.strftime('%Y-%m-%d')})"
    
    def __repr__(self) -> str:
        """Detailed string representation with all key fields."""
        return (f"Extension(extension_id='{self.extension_id}', "
                f"transaction_id='{self.transaction_id}', "
                f"months={self.extension_months}, "
                f"total_fee=${self.total_extension_fee})")
    
    @property
    def total_extension_fee_dollars(self) -> str:
        """Format total extension fee as currency string"""
        return f"${self.total_extension_fee:,}"
    
    @property
    def extension_fee_per_month_dollars(self) -> str:
        """Format monthly extension fee as currency string"""
        return f"${self.extension_fee_per_month:,}"
    
    @property
    def extension_duration_text(self) -> str:
        """Human-readable extension duration"""
        if self.extension_months == 1:
            return "1 month"
        else:
            return f"{self.extension_months} months"
    
    class Settings:
        """Beanie document settings"""
        name = "extensions"
        indexes = [
            "extension_id",
            "transaction_id",
            "processed_by_user_id",
            "extension_date",
            "original_maturity_date",
            "new_maturity_date",
            # Compound indexes for efficient queries
            [("transaction_id", 1), ("extension_date", -1)],  # Extension history (newest first)
            [("processed_by_user_id", 1), ("extension_date", -1)],  # Staff extension history
            [("new_maturity_date", 1)],  # Upcoming maturity dates
        ]