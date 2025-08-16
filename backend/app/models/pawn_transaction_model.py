"""
Pawn Transaction Model

Core model for pawn transactions including loan amounts, interest calculations,
status tracking, and date management. Uses integer-only financial operations
for simplified calculation and accuracy.
"""

from beanie import Document, Indexed
from pydantic import Field, field_validator, ConfigDict
from datetime import datetime, timedelta, UTC
from typing import Optional
from uuid import uuid4
from enum import Enum


class TransactionStatus(str, Enum):
    """Valid transaction statuses for pawn items"""
    ACTIVE = "active"
    OVERDUE = "overdue"
    EXTENDED = "extended"
    REDEEMED = "redeemed"
    FORFEITED = "forfeited"
    SOLD = "sold"
    HOLD = "hold"
    DAMAGED = "damaged"
    VOIDED = "voided"      # Admin-voided transaction
    CANCELED = "canceled"  # Staff-canceled transaction


class PawnTransaction(Document):
    """
    Pawn transaction document model.
    
    Represents a pawn transaction with integer-only financial calculations,
    automatic date calculations, and comprehensive status tracking.
    """
    
    # Identifiers
    transaction_id: Indexed(str) = Field(
        default_factory=lambda: str(uuid4()),
        description="Unique transaction identifier"
    )
    customer_id: Indexed(str) = Field(
        ...,
        description="Reference to Customer document via phone_number"
    )
    created_by_user_id: str = Field(
        ...,
        description="Reference to User document via user_id"
    )
    
    # Dates (calculated automatically)
    pawn_date: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Date when item was pawned"
    )
    maturity_date: datetime = Field(
        default=None,
        description="Date when loan matures (pawn_date + 90 days)"
    )
    grace_period_end: datetime = Field(
        default=None,
        description="End of grace period (pawn_date + 97 days)"
    )
    
    # Financial fields (integers only - whole dollars)
    loan_amount: int = Field(
        ...,
        gt=0,
        description="Loan amount in whole dollars"
    )
    monthly_interest_amount: int = Field(
        ...,
        ge=0,
        description="Fixed monthly interest fee in whole dollars"
    )
    total_due: int = Field(
        default=0,
        description="Total amount due (calculated field)"
    )
    
    # Transaction metadata
    status: TransactionStatus = Field(
        default=TransactionStatus.ACTIVE,
        description="Current transaction status"
    )
    storage_location: str = Field(
        ...,
        min_length=1,
        description="Physical storage location (e.g., 'Shelf A-5')"
    )
    internal_notes: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Internal staff notes about the transaction"
    )
    
    # Timestamps
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
        use_enum_values=True,
        json_schema_extra={
            "example": {
                "customer_id": "5551234567",
                "created_by_user_id": "01",
                "loan_amount": 500,
                "monthly_interest_amount": 50,
                "storage_location": "Shelf A-5",
                "internal_notes": "Customer needs quick cash for rent"
            }
        }
    )
    
    @field_validator('loan_amount')
    @classmethod
    def validate_loan_amount(cls, v: int) -> int:
        """Validate loan amount is within acceptable range ($1-$10,000)."""
        if v <= 0:
            raise ValueError('Loan amount must be greater than 0')
        if v > 10000:  # Business rule: max loan $10,000
            raise ValueError('Loan amount cannot exceed $10,000')
        return v
    
    @field_validator('monthly_interest_amount')
    @classmethod
    def validate_interest_amount(cls, v: int) -> int:
        """Validate monthly interest amount is within acceptable range ($0-$1,000)."""
        if v < 0:
            raise ValueError('Interest amount cannot be negative')
        if v > 1000:  # Business rule: max interest $1,000/month
            raise ValueError('Monthly interest cannot exceed $1,000')
        return v
    
    def calculate_dates(self) -> None:
        """
        Calculate maturity and grace period end dates based on pawn date.
        Uses calendar month arithmetic (not fixed 30-day periods).
        """
        if not self.maturity_date:
            # Ensure pawn_date is timezone-aware
            pawn_date = self.pawn_date
            if pawn_date.tzinfo is None:
                pawn_date = pawn_date.replace(tzinfo=UTC)
            
            # Maturity is 3 months from pawn date (calendar months, not days)
            year = pawn_date.year
            month = pawn_date.month + 3
            day = pawn_date.day
            
            # Handle month overflow
            if month > 12:
                year += month // 12
                month = month % 12
                if month == 0:
                    month = 12
                    year -= 1
            
            # Handle day overflow for shorter months
            try:
                self.maturity_date = pawn_date.replace(year=year, month=month, day=day)
            except ValueError:
                # Day doesn't exist in target month (e.g., Jan 31 -> Apr 31)
                # Move to last day of the month
                import calendar
                last_day = calendar.monthrange(year, month)[1]
                self.maturity_date = pawn_date.replace(year=year, month=month, day=last_day)
        
        if not self.grace_period_end:
            # Grace period is 7 days after maturity date
            self.grace_period_end = self.maturity_date + timedelta(days=7)
    
    def calculate_total_due(self, as_of_date: Optional[datetime] = None) -> int:
        """
        Calculate total amount due including interest.
        
        Args:
            as_of_date: Date to calculate total due (defaults to current date)
            
        Returns:
            Total amount due in whole dollars
        """
        # Use the new calculate_months_elapsed method
        months_elapsed = self.calculate_months_elapsed(as_of_date)
        
        # Total due = principal + (monthly interest * months)
        self.total_due = self.loan_amount + (self.monthly_interest_amount * months_elapsed)
        return self.total_due
    
    def calculate_months_elapsed(self, as_of_date: Optional[datetime] = None) -> int:
        """
        Calculate months elapsed since pawn date using calendar month arithmetic.
        
        Args:
            as_of_date: Date to calculate from (defaults to now)
            
        Returns:
            Number of months elapsed (capped at 3 for interest calculation)
        """
        if as_of_date is None:
            as_of_date = datetime.now(UTC)
        
        # Defensive programming - ensure valid dates
        if not isinstance(as_of_date, datetime):
            print(f"Warning: Invalid as_of_date type {type(as_of_date)}, using current date")
            as_of_date = datetime.now(UTC)
        
        if not hasattr(self, 'pawn_date') or not self.pawn_date:
            print(f"Warning: Invalid pawn_date for transaction, defaulting to 1 month")
            return 1
        
        # Calculate months completed based on calendar months
        # Jan 23 → Feb 23 = 1 month completed (Feb is 1 month after Jan)
        # Feb 23 → Mar 23 = 2 months completed (Mar is 2 months after Jan)  
        # Mar 23 → Apr 23 = 3 months completed (Apr is 3 months after Jan)
        
        # Ensure pawn_date is timezone-aware
        pawn_date = self.pawn_date
        if pawn_date.tzinfo is None:
            pawn_date = pawn_date.replace(tzinfo=UTC)
        
        months_elapsed = ((as_of_date.year - pawn_date.year) * 12 + 
                         (as_of_date.month - pawn_date.month))
        
        # Only add 1 if we've passed the pawn day (not on the exact day)
        # This handles partial months - if we're past the pawn day in the current month,
        # we've completed another month
        if as_of_date.day > pawn_date.day:
            months_elapsed += 1
        
        # IMPORTANT: Cap at maturity period (3 months)
        # Grace period does not incur additional interest charges
        if hasattr(self, 'maturity_date') and self.maturity_date:
            # Business rule: Maximum 3 months of interest, period
            # During grace period, interest stops accumulating at maturity
            months_elapsed = min(months_elapsed, 3)
        
        # Minimum 1 month of interest always applies
        months_elapsed = max(1, months_elapsed)
        
        return months_elapsed
    
    def update_status(self) -> None:
        """
        Update transaction status based on current date.
        Automatically transitions: active -> overdue -> forfeited.
        """
        current_date = datetime.now(UTC)
        
        # Skip if already in terminal state
        if self.status in [TransactionStatus.REDEEMED, TransactionStatus.SOLD, 
                          TransactionStatus.FORFEITED, TransactionStatus.DAMAGED]:
            return
        
        # Ensure dates are timezone-aware before comparison
        grace_period_end = self.grace_period_end
        if grace_period_end.tzinfo is None:
            grace_period_end = grace_period_end.replace(tzinfo=UTC)
            
        maturity_date = self.maturity_date
        if maturity_date.tzinfo is None:
            maturity_date = maturity_date.replace(tzinfo=UTC)
        
        # Check if forfeited (past grace period)
        if current_date > grace_period_end:
            self.status = TransactionStatus.FORFEITED
        # Check if overdue (past maturity but within grace period)
        elif current_date > maturity_date:
            self.status = TransactionStatus.OVERDUE
        # Otherwise keep current status (active, extended, hold)
    
    async def save(self, *args, **kwargs) -> None:
        """
        Override save to update timestamps and calculate fields.
        Ensures data consistency before persisting to database.
        """
        # Update timestamp
        self.updated_at = datetime.now(UTC)
        
        # Calculate dates if not set
        self.calculate_dates()
        
        # Update status
        self.update_status()
        
        # Calculate total due
        self.calculate_total_due()
        
        # Call parent save
        await super().save(*args, **kwargs)
    
    class Settings:
        """Beanie document settings"""
        name = "pawn_transactions"
        indexes = [
            "transaction_id",
            "customer_id",
            "status",
            "pawn_date",
            "maturity_date",
            [("status", 1), ("maturity_date", 1)],  # Compound index for queries
        ]