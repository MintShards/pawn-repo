"""
ExtensionService

Business logic for processing loan extensions on pawn transactions. Handles extension
validation, calendar month calculations, fee processing, and automatic status updates.
"""

# Standard library imports
from datetime import datetime, UTC, timedelta
from typing import List, Optional, Dict, Any

# Local imports
from app.models.extension_model import Extension
from app.models.pawn_transaction_model import PawnTransaction, TransactionStatus
from app.models.user_model import User, UserStatus


class ExtensionError(Exception):
    """Base exception for extension processing operations"""
    pass


class ExtensionValidationError(ExtensionError):
    """Extension validation related errors"""
    pass


class TransactionNotFoundError(ExtensionError):
    """Transaction not found error"""
    pass


class StaffValidationError(ExtensionError):
    """Staff user validation error"""
    pass


class ExtensionNotAllowedError(ExtensionError):
    """Extension not allowed due to business rules"""
    pass


class ExtensionService:
    """
    Service class for loan extension processing business logic.
    
    Handles extension validation, calendar month calculations, fee processing,
    automatic status updates, and comprehensive extension tracking.
    """
    
    @staticmethod
    async def process_extension(
        transaction_id: str,
        extension_months: int,
        extension_fee_per_month: int,
        processed_by_user_id: str,
        extension_reason: Optional[str] = None,
        internal_notes: Optional[str] = None
    ) -> Extension:
        """
        Process a loan extension for a pawn transaction.
        
        Args:
            transaction_id: Transaction to extend
            extension_months: Number of months to extend (1, 2, or 3)
            extension_fee_per_month: Fee per month in whole dollars (staff-adjustable)
            processed_by_user_id: Staff member processing extension
            extension_reason: Optional reason for extension
            internal_notes: Optional internal staff notes
            
        Returns:
            Extension: Created extension record with updated transaction
            
        Raises:
            TransactionNotFoundError: Transaction not found
            StaffValidationError: Staff user not found or insufficient permissions
            ExtensionValidationError: Invalid extension parameters
            ExtensionNotAllowedError: Extension not allowed due to business rules
        """
        # Validate transaction exists and can be extended
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        # Check if transaction can accept extensions
        if transaction.status in [TransactionStatus.SOLD, TransactionStatus.REDEEMED, TransactionStatus.FORFEITED]:
            raise ExtensionNotAllowedError(
                f"Cannot extend {transaction.status} transaction"
            )
        
        # Check if within grace period (business rule)
        current_time = datetime.now(UTC)
        if current_time > transaction.grace_period_end:
            raise ExtensionNotAllowedError(
                f"Cannot extend - transaction past grace period. Grace period ended on "
                f"{transaction.grace_period_end.strftime('%Y-%m-%d %H:%M:%S UTC')}"
            )
        
        # Validate staff user
        staff_user = await User.find_one(User.user_id == processed_by_user_id)
        if not staff_user:
            raise StaffValidationError(f"Staff user {processed_by_user_id} not found")
        
        if staff_user.status != UserStatus.ACTIVE:
            raise StaffValidationError(
                f"Staff user {staff_user.first_name} {staff_user.last_name} is not active"
            )
        
        # Validate extension parameters
        if extension_months not in [1, 2, 3]:
            raise ExtensionValidationError("Extension months must be 1, 2, or 3")
        
        if extension_fee_per_month < 0:
            raise ExtensionValidationError("Extension fee per month cannot be negative")
        
        if extension_fee_per_month > 1000:
            raise ExtensionValidationError("Extension fee per month cannot exceed $1,000")
        
        # Calculate total extension fee
        total_extension_fee = extension_months * extension_fee_per_month
        
        # Get current maturity date for extension calculation
        current_maturity = transaction.maturity_date
        
        # Create extension record (this will calculate new dates using calendar months)
        extension = Extension(
            transaction_id=transaction_id,
            processed_by_user_id=processed_by_user_id,
            extension_months=extension_months,
            extension_fee_per_month=extension_fee_per_month,
            total_extension_fee=total_extension_fee,
            original_maturity_date=current_maturity,
            new_maturity_date=None,  # Will be calculated in save()
            new_grace_period_end=None,  # Will be calculated in save()
            extension_reason=extension_reason,
            internal_notes=internal_notes
        )
        
        # Save extension (this will validate and calculate dates)
        await extension.save()
        
        # Update transaction with new dates and status
        await ExtensionService._update_transaction_for_extension(
            transaction, extension, processed_by_user_id
        )
        
        return extension
    
    @staticmethod
    async def _update_transaction_for_extension(
        transaction: PawnTransaction,
        extension: Extension,
        processed_by_user_id: str
    ) -> None:
        """
        Update transaction with extension details.
        Internal method to keep transaction updates consistent.
        """
        # Update transaction dates
        transaction.maturity_date = extension.new_maturity_date
        transaction.grace_period_end = extension.new_grace_period_end
        
        # Update status to extended
        old_status = transaction.status
        transaction.status = TransactionStatus.EXTENDED
        
        # Add extension note to internal notes
        extension_note = (
            f"[{datetime.now(UTC).isoformat()}] Extended {extension.extension_months} months "
            f"by {processed_by_user_id}. Fee: ${extension.total_extension_fee}. "
            f"New maturity: {extension.new_maturity_date.strftime('%Y-%m-%d')}."
        )
        
        if extension.extension_reason:
            extension_note += f" Reason: {extension.extension_reason}"
        
        current_notes = transaction.internal_notes or ""
        transaction.internal_notes = f"{current_notes}\n{extension_note}".strip()
        
        # Save transaction
        await transaction.save()
    
    @staticmethod
    async def get_transaction_extensions(
        transaction_id: str,
        limit: Optional[int] = None
    ) -> List[Extension]:
        """
        Get all extensions for a transaction, newest first.
        
        Args:
            transaction_id: Transaction identifier
            limit: Optional limit on number of extensions returned
            
        Returns:
            List of Extension objects ordered by extension date (newest first)
        """
        query = Extension.find(Extension.transaction_id == transaction_id).sort(-Extension.extension_date)
        
        if limit:
            query = query.limit(limit)
            
        return await query.to_list()
    
    @staticmethod
    async def get_extension_by_id(extension_id: str) -> Optional[Extension]:
        """
        Retrieve extension by extension ID.
        
        Args:
            extension_id: Unique extension identifier
            
        Returns:
            Extension if found, None otherwise
        """
        return await Extension.find_one(Extension.extension_id == extension_id)
    
    @staticmethod
    async def get_total_extension_fees(transaction_id: str) -> int:
        """
        Get total amount of all extension fees for a transaction.
        
        Args:
            transaction_id: Transaction identifier
            
        Returns:
            Total extension fees in whole dollars
        """
        extensions = await ExtensionService.get_transaction_extensions(transaction_id)
        return sum(extension.total_extension_fee for extension in extensions)
    
    @staticmethod
    async def get_extensions_by_staff(
        staff_user_id: str,
        limit: int = 100,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Extension]:
        """
        Get extensions processed by a specific staff member.
        
        Args:
            staff_user_id: Staff user identifier
            limit: Maximum number of extensions to return
            start_date: Optional start date filter
            end_date: Optional end date filter
            
        Returns:
            List of Extension objects
        """
        query = Extension.find(Extension.processed_by_user_id == staff_user_id)
        
        if start_date:
            query = query.find(Extension.extension_date >= start_date)
        
        if end_date:
            query = query.find(Extension.extension_date <= end_date)
        
        return await query.sort(-Extension.extension_date).limit(limit).to_list()
    
    @staticmethod
    async def calculate_extension_preview(
        transaction_id: str,
        extension_months: int,
        extension_fee_per_month: int
    ) -> Dict[str, Any]:
        """
        Calculate extension preview without processing.
        
        Args:
            transaction_id: Transaction identifier
            extension_months: Proposed extension months (1, 2, or 3)
            extension_fee_per_month: Proposed fee per month
            
        Returns:
            Dictionary with extension preview details
            
        Raises:
            TransactionNotFoundError: Transaction not found
            ExtensionValidationError: Invalid extension parameters
        """
        # Validate transaction exists
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        # Validate parameters
        if extension_months not in [1, 2, 3]:
            raise ExtensionValidationError("Extension months must be 1, 2, or 3")
        
        if extension_fee_per_month < 0:
            raise ExtensionValidationError("Extension fee per month cannot be negative")
        
        if extension_fee_per_month > 1000:
            raise ExtensionValidationError("Extension fee per month cannot exceed $1,000")
        
        # Create temporary extension object to calculate dates
        temp_extension = Extension(
            transaction_id=transaction_id,
            processed_by_user_id="preview",  # Temporary value
            extension_months=extension_months,
            extension_fee_per_month=extension_fee_per_month,
            total_extension_fee=extension_months * extension_fee_per_month,
            original_maturity_date=transaction.maturity_date,
            new_maturity_date=None,
            new_grace_period_end=None
        )
        
        # Calculate dates using model logic
        new_maturity_date = temp_extension.calculate_new_maturity_date()
        new_grace_period_end = temp_extension.calculate_new_grace_period_end()
        
        # Check eligibility
        current_time = datetime.now(UTC)
        can_extend = current_time <= transaction.grace_period_end
        
        if can_extend:
            time_remaining = transaction.grace_period_end - current_time
            days_remaining = time_remaining.days
            hours_remaining = time_remaining.seconds // 3600
        else:
            days_remaining = 0
            hours_remaining = 0
        
        # Check status restrictions
        status_allows_extension = transaction.status not in [
            TransactionStatus.SOLD, 
            TransactionStatus.REDEEMED, 
            TransactionStatus.FORFEITED
        ]
        
        return {
            "transaction_id": transaction_id,
            "current_status": transaction.status,
            "current_maturity_date": transaction.maturity_date.isoformat(),
            "current_grace_period_end": transaction.grace_period_end.isoformat(),
            "extension_months": extension_months,
            "extension_fee_per_month": extension_fee_per_month,
            "extension_fee_per_month_formatted": f"${extension_fee_per_month:,}",
            "total_extension_fee": extension_months * extension_fee_per_month,
            "total_extension_fee_formatted": f"${extension_months * extension_fee_per_month:,}",
            "new_maturity_date": new_maturity_date.isoformat(),
            "new_grace_period_end": new_grace_period_end.isoformat(),
            "can_extend": can_extend and status_allows_extension,
            "days_remaining_to_extend": days_remaining,
            "hours_remaining_to_extend": hours_remaining,
            "status_allows_extension": status_allows_extension,
            "warnings": [
                "Extension not allowed - past grace period" if not can_extend else None,
                f"Extension not allowed - transaction status is {transaction.status}" if not status_allows_extension else None,
                f"Less than 24 hours remaining to extend" if can_extend and days_remaining == 0 else None
            ],
            "is_valid": can_extend and status_allows_extension,
            "can_process": can_extend and status_allows_extension
        }
    
    @staticmethod
    async def validate_extension_eligibility(transaction_id: str) -> Dict[str, Any]:
        """
        Check if a transaction is eligible for extension.
        
        Args:
            transaction_id: Transaction identifier
            
        Returns:
            Dictionary with eligibility status and details
            
        Raises:
            TransactionNotFoundError: Transaction not found
        """
        # Validate transaction exists
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        current_time = datetime.now(UTC)
        
        # Check if within grace period
        is_eligible = current_time <= transaction.grace_period_end
        
        # Calculate time remaining
        if is_eligible:
            time_remaining = transaction.grace_period_end - current_time
            days_remaining = time_remaining.days
            hours_remaining = time_remaining.seconds // 3600
            minutes_remaining = (time_remaining.seconds % 3600) // 60
        else:
            days_remaining = 0
            hours_remaining = 0
            minutes_remaining = 0
        
        # Check status restrictions
        restricted_statuses = [TransactionStatus.REDEEMED, TransactionStatus.FORFEITED, TransactionStatus.SOLD]
        status_allows_extension = transaction.status not in restricted_statuses
        
        # Get reason for ineligibility
        ineligibility_reason = ExtensionService._get_ineligibility_reason(
            transaction, is_eligible, status_allows_extension
        )
        
        return {
            "transaction_id": transaction_id,
            "is_eligible": is_eligible and status_allows_extension,
            "current_status": transaction.status,
            "maturity_date": transaction.maturity_date.isoformat(),
            "grace_period_end": transaction.grace_period_end.isoformat(),
            "days_remaining": days_remaining,
            "hours_remaining": hours_remaining,
            "minutes_remaining": minutes_remaining,
            "status_allows_extension": status_allows_extension,
            "time_critical": is_eligible and days_remaining == 0,  # Less than 24 hours
            "reason": ineligibility_reason,
            "can_process": is_eligible and status_allows_extension
        }
    
    @staticmethod
    def _get_ineligibility_reason(
        transaction: PawnTransaction,
        is_eligible: bool,
        status_allows_extension: bool
    ) -> Optional[str]:
        """
        Get reason why extension is not eligible.
        Internal helper method.
        """
        if not status_allows_extension:
            return f"Cannot extend - transaction status is '{transaction.status}'"
        elif not is_eligible:
            return "Cannot extend - past grace period"
        else:
            return None
    
    @staticmethod
    async def get_extension_history_summary(transaction_id: str) -> Dict[str, Any]:
        """
        Get comprehensive extension history summary for a transaction.
        
        Args:
            transaction_id: Transaction identifier
            
        Returns:
            Dictionary with extension history details
            
        Raises:
            TransactionNotFoundError: Transaction not found
        """
        # Validate transaction exists
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        extensions = await ExtensionService.get_transaction_extensions(transaction_id)
        
        if not extensions:
            return {
                "transaction_id": transaction_id,
                "total_extensions": 0,
                "total_extension_fees": 0,
                "total_extension_fees_formatted": "$0",
                "total_months_extended": 0,
                "first_extension_date": None,
                "last_extension_date": None,
                "extensions": []
            }
        
        # Create extension details
        extension_details = []
        total_months = 0
        total_fees = 0
        
        for extension in extensions:
            total_months += extension.extension_months
            total_fees += extension.total_extension_fee
            
            extension_details.append({
                "extension_id": extension.extension_id,
                "extension_months": extension.extension_months,
                "extension_duration_text": extension.extension_duration_text,
                "extension_fee_per_month": extension.extension_fee_per_month,
                "extension_fee_per_month_formatted": extension.extension_fee_per_month_dollars,
                "total_extension_fee": extension.total_extension_fee,
                "total_extension_fee_formatted": extension.total_extension_fee_dollars,
                "original_maturity_date": extension.original_maturity_date.isoformat(),
                "new_maturity_date": extension.new_maturity_date.isoformat(),
                "new_grace_period_end": extension.new_grace_period_end.isoformat(),
                "extension_date": extension.extension_date.isoformat(),
                "processed_by": extension.processed_by_user_id,
                "extension_reason": extension.extension_reason,
                "internal_notes": extension.internal_notes,
                "created_at": extension.created_at.isoformat()
            })
        
        return {
            "transaction_id": transaction_id,
            "total_extensions": len(extensions),
            "total_extension_fees": total_fees,
            "total_extension_fees_formatted": f"${total_fees:,}",
            "total_months_extended": total_months,
            "average_fee_per_month": total_fees // total_months if total_months > 0 else 0,
            "first_extension_date": extensions[-1].extension_date.isoformat(),  # Oldest (last in sorted list)
            "last_extension_date": extensions[0].extension_date.isoformat(),   # Newest (first in sorted list)
            "extensions": extension_details
        }
    
    @staticmethod
    async def get_daily_extension_summary(
        date: datetime,
        staff_user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get daily extension summary for reporting.
        
        Args:
            date: Date to get summary for
            staff_user_id: Optional filter by staff member
            
        Returns:
            Dictionary with daily extension summary
        """
        # Set date range for the entire day
        start_date = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Build query
        query = Extension.find(
            Extension.extension_date >= start_date,
            Extension.extension_date <= end_date
        )
        
        if staff_user_id:
            query = query.find(Extension.processed_by_user_id == staff_user_id)
        
        extensions = await query.sort(Extension.extension_date).to_list()
        
        if not extensions:
            return {
                "date": date.strftime("%Y-%m-%d"),
                "staff_user_id": staff_user_id,
                "total_extensions": 0,
                "total_extension_fees": 0,
                "total_months_extended": 0,
                "average_fee_per_extension": 0,
                "staff_breakdown": {},
                "extensions": []
            }
        
        # Calculate totals
        total_fees = sum(ext.total_extension_fee for ext in extensions)
        total_months = sum(ext.extension_months for ext in extensions)
        extension_count = len(extensions)
        
        # Staff breakdown
        staff_breakdown = {}
        for extension in extensions:
            staff_id = extension.processed_by_user_id
            if staff_id not in staff_breakdown:
                staff_breakdown[staff_id] = {
                    "extension_count": 0,
                    "total_fees": 0,
                    "total_months": 0
                }
            staff_breakdown[staff_id]["extension_count"] += 1
            staff_breakdown[staff_id]["total_fees"] += extension.total_extension_fee
            staff_breakdown[staff_id]["total_months"] += extension.extension_months
        
        # Extension details
        extension_details = [
            {
                "extension_id": ext.extension_id,
                "transaction_id": ext.transaction_id,
                "extension_months": ext.extension_months,
                "total_fee": ext.total_extension_fee,
                "extension_date": ext.extension_date.isoformat(),
                "processed_by": ext.processed_by_user_id,
                "extension_reason": ext.extension_reason
            }
            for ext in extensions
        ]
        
        return {
            "date": date.strftime("%Y-%m-%d"),
            "staff_user_id": staff_user_id,
            "total_extensions": extension_count,
            "total_extension_fees": total_fees,
            "total_extension_fees_formatted": f"${total_fees:,}",
            "total_months_extended": total_months,
            "average_fee_per_extension": total_fees // extension_count if extension_count > 0 else 0,
            "staff_breakdown": staff_breakdown,
            "extensions": extension_details
        }