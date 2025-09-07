"""
Pawn Transaction Model

Core model for pawn transactions including loan amounts, interest calculations,
status tracking, and date management. Uses integer-only financial operations
for simplified calculation and accuracy.
"""

from beanie import Document, Indexed
from pydantic import Field, field_validator, ConfigDict
from datetime import datetime, timedelta, UTC
from typing import Optional, List
from uuid import uuid4
from enum import Enum

# Import the new AuditEntry model
from .audit_entry_model import AuditEntry


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
    formatted_id: Optional[Indexed(str)] = Field(
        default=None,
        description="Display-friendly transaction ID (e.g., 'PW000105') for fast lookups"
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
        description="Date when item was pawned"
    )
    maturity_date: datetime = Field(
        default=None,
        description="Date when loan matures (pawn_date + 3 months)"
    )
    grace_period_end: datetime = Field(
        default=None,
        description="End of grace period (maturity_date + 1 month, when item becomes eligible for forfeiture)"
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
    # Legacy combined notes field (maintained for backward compatibility)
    internal_notes: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Legacy combined notes field for backward compatibility"
    )
    
    # New separate notes architecture
    manual_notes: Optional[str] = Field(
        default=None,
        max_length=5000,
        description="Manual staff notes (preserved indefinitely, high character limit)"
    )
    
    system_audit_log: List[AuditEntry] = Field(
        default_factory=list,
        description="Structured system audit trail with unlimited entries"
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
                "internal_notes": "[2024-01-15 14:30 UTC by 01] Customer needs quick cash for rent",
                "manual_notes": "[2024-01-15 14:30 UTC by 01] Customer needs quick cash for rent. Called back next week to check on situation.",
                "system_audit_log": [
                    {
                        "action_type": "transaction_created",
                        "staff_member": "01",
                        "action_summary": "Transaction created",
                        "details": "Initial loan setup completed",
                        "amount": 500
                    }
                ]
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
            
            # Maturity is 3 months from pawn date (customer can redeem during this period)
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
            # Grace period is 4th month (when item becomes overdue and eligible for forfeiture)
            # Calculate 1 month after maturity date using same calendar arithmetic
            grace_year = self.maturity_date.year
            grace_month = self.maturity_date.month + 1
            grace_day = self.maturity_date.day
            
            # Handle month overflow
            if grace_month > 12:
                grace_year += grace_month // 12
                grace_month = grace_month % 12
                if grace_month == 0:
                    grace_month = 12
                    grace_year -= 1
            
            # Handle day overflow for shorter months
            try:
                self.grace_period_end = self.maturity_date.replace(year=grace_year, month=grace_month, day=grace_day)
            except ValueError:
                # Day doesn't exist in target month
                import calendar
                last_day = calendar.monthrange(grace_year, grace_month)[1]
                self.grace_period_end = self.maturity_date.replace(year=grace_year, month=grace_month, day=last_day)
    
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
            # Use logger instead of print for production code
            as_of_date = datetime.now(UTC)
        
        if not hasattr(self, 'pawn_date') or not self.pawn_date:
            # Use logger instead of print for production code
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
    
    # Notes Management Methods
    
    def add_manual_note(self, note: str, staff_member: str) -> None:
        """
        Add a manual staff note to the transaction.
        
        Manual notes are preserved indefinitely and have a high character limit.
        They are kept separate from system audit logs to prevent truncation.
        
        Args:
            note: The manual note to add
            staff_member: User ID of the staff member adding the note
        """
        if not note or not note.strip():
            return
        
        note = note.strip()
        timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
        formatted_note = f"[{timestamp} by {staff_member}] {note}"
        
        if self.manual_notes:
            self.manual_notes = f"{self.manual_notes}\n{formatted_note}".strip()
        else:
            self.manual_notes = formatted_note
        
        # Update legacy field for backward compatibility
        self._update_legacy_internal_notes()
    
    def add_system_audit_entry(self, audit_entry: AuditEntry) -> None:
        """
        Add a system audit entry to the structured audit log.
        
        System audit entries are stored as structured data with no character limits.
        They maintain full transaction history for compliance and debugging.
        
        Args:
            audit_entry: AuditEntry instance with system event details
        """
        if not self.system_audit_log:
            self.system_audit_log = []
        
        self.system_audit_log.append(audit_entry)
        
        # Update legacy field for backward compatibility
        self._update_legacy_internal_notes()
    
    def get_combined_notes_display(self, max_length: Optional[int] = None) -> str:
        """
        Generate a combined view of manual notes and system audit log for display.
        
        This method provides a unified view while keeping the underlying data separate.
        Used for UI display and backward compatibility.
        
        Args:
            max_length: Optional maximum length for truncation
            
        Returns:
            Combined notes string formatted for display
        """
        parts = []
        
        # Add manual notes first (highest priority)
        if self.manual_notes:
            parts.append("MANUAL NOTES:")
            parts.append(self.manual_notes)
            parts.append("")  # Add spacing
        
        # Add recent system audit entries
        if self.system_audit_log:
            parts.append("SYSTEM ACTIVITY:")
            # Show most recent entries first, limit to last 10 for display
            recent_entries = sorted(self.system_audit_log, key=lambda x: x.timestamp, reverse=True)[:10]
            
            for entry in recent_entries:
                parts.append(entry.to_legacy_string())
        
        combined = "\n".join(parts).strip()
        
        # Apply truncation if requested
        if max_length and len(combined) > max_length:
            # Always prioritize manual notes in truncation
            if self.manual_notes and len(self.manual_notes) < max_length - 100:
                # Keep all manual notes, truncate system entries
                manual_section = f"MANUAL NOTES:\n{self.manual_notes}"
                available_for_system = max_length - len(manual_section) - 20
                
                if available_for_system > 50 and self.system_audit_log:
                    system_preview = "\n\nSYSTEM ACTIVITY (recent):\n"
                    recent_entry = self.system_audit_log[-1] if self.system_audit_log else None
                    if recent_entry:
                        entry_text = recent_entry.to_legacy_string()
                        if len(entry_text) <= available_for_system - 20:
                            system_preview += entry_text
                            if len(self.system_audit_log) > 1:
                                system_preview += f"\n... and {len(self.system_audit_log) - 1} more entries"
                        else:
                            system_preview += f"... {len(self.system_audit_log)} system entries (see full log)"
                    
                    combined = manual_section + system_preview
                else:
                    combined = manual_section
            else:
                # Truncate entire combined view
                combined = combined[:max_length-3] + "..."
        
        return combined
    
    def _update_legacy_internal_notes(self) -> None:
        """
        Update the legacy internal_notes field for backward compatibility.
        
        This maintains compatibility with existing code that expects internal_notes
        while the new separate architecture is being adopted.
        """
        # Generate a combined view limited to the legacy 500-character limit
        combined = self.get_combined_notes_display(max_length=500)
        self.internal_notes = combined if combined else None
    
    def get_manual_notes_only(self) -> str:
        """
        Get only the manual staff notes without system entries.
        
        Returns:
            Manual notes string or empty string if none
        """
        return self.manual_notes or ""
    
    def get_system_audit_summary(self, limit: int = 20) -> List[str]:
        """
        Get a summary of recent system audit entries.
        
        Args:
            limit: Maximum number of entries to return
            
        Returns:
            List of formatted audit entry strings
        """
        if not self.system_audit_log:
            return []
        
        # Sort by timestamp (most recent first)
        recent_entries = sorted(self.system_audit_log, key=lambda x: x.timestamp, reverse=True)[:limit]
        
        return [entry.to_legacy_string() for entry in recent_entries]
    
    def count_audit_entries(self) -> int:
        """
        Count the total number of system audit entries.
        
        Returns:
            Number of audit entries
        """
        return len(self.system_audit_log) if self.system_audit_log else 0
    
    def update_status(self) -> None:
        """
        Update transaction status based on current date.
        Automatically transitions: active -> overdue (STOPS HERE - no automatic forfeiture).
        Staff/admin must manually change overdue to forfeited.
        """
        current_date = datetime.now(UTC)
        
        # Skip if already in terminal state or overdue (no automatic forfeiture)
        if self.status in [TransactionStatus.REDEEMED, TransactionStatus.SOLD, 
                          TransactionStatus.FORFEITED, TransactionStatus.DAMAGED, 
                          TransactionStatus.OVERDUE]:
            return
        
        # Ensure dates are timezone-aware before comparison
        maturity_date = self.maturity_date
        if maturity_date.tzinfo is None:
            maturity_date = maturity_date.replace(tzinfo=UTC)
        
        # Check if overdue (past maturity date)
        # Once overdue, stays overdue until manually changed by staff
        if current_date > maturity_date:
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
        
        # Update legacy internal_notes field for backward compatibility
        self._update_legacy_internal_notes()
        
        # Call parent save
        await super().save(*args, **kwargs)
    
    class Settings:
        """Beanie document settings"""
        name = "pawn_transactions"
        indexes = [
            "transaction_id",
            "formatted_id",  # Index for fast PW000105 lookups
            "customer_id",
            "status",
            "pawn_date",
            "maturity_date",
            [("status", 1), ("maturity_date", 1)],  # Compound index for queries
            [("pawn_date", 1), ("created_at", 1)],  # Compound index for chronological search ordering
        ]