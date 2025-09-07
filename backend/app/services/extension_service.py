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
from app.models.audit_entry_model import AuditActionType
from app.core.timezone_utils import utc_to_user_timezone, get_user_now, user_timezone_to_utc
from app.core.transaction_notes import safe_append_transaction_notes, format_system_note  # Legacy compatibility
from app.services.notes_service import notes_service
from app.services.formatted_id_service import FormattedIdService


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
    def _ensure_timezone_aware(dt: datetime) -> datetime:
        """Helper method to ensure datetime is timezone-aware"""
        if dt.tzinfo is None:
            return dt.replace(tzinfo=UTC)
        return dt
    
    @staticmethod
    async def process_extension(
        transaction_id: str,
        extension_months: int,
        extension_fee_per_month: int,
        processed_by_user_id: str,
        extension_reason: Optional[str] = None,
        client_timezone: Optional[str] = None
    ) -> Extension:
        """
        Process a loan extension for a pawn transaction with atomic operations.
        
        Args:
            transaction_id: Transaction to extend
            extension_months: Number of months to extend (1, 2, or 3)
            extension_fee_per_month: Fee per month in whole dollars (staff-adjustable)
            processed_by_user_id: Staff member processing extension
            extension_reason: Optional reason for extension
            
        Returns:
            Extension: Created extension record with updated transaction
            
        Raises:
            TransactionNotFoundError: Transaction not found
            StaffValidationError: Staff user not found or insufficient permissions
            ExtensionValidationError: Invalid extension parameters
            ExtensionNotAllowedError: Extension not allowed due to business rules
            DatabaseTransactionError: Database transaction failed
        """
        # Pre-validation outside transaction
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
        
        # Check if within extension window (business rule: can extend anytime within 3 months)
        current_time = datetime.now(UTC)
        
        # Ensure grace_period_end is timezone-aware for comparison
        grace_period_end = ExtensionService._ensure_timezone_aware(transaction.grace_period_end)
        
        # Allow extensions anytime before grace period ends (within 3 months + 7 days)
        if current_time > grace_period_end:
            raise ExtensionNotAllowedError(
                f"Cannot extend - extension window has closed. Extension deadline was "
                f"{grace_period_end.strftime('%Y-%m-%d %H:%M:%S UTC')}. Current time: {current_time.strftime('%Y-%m-%d %H:%M:%S UTC')}"
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
        
        # Execute atomic extension processing
        async def extension_operations(session):
            # Get fresh transaction record within transaction
            fresh_transaction = await PawnTransaction.find_one(
                PawnTransaction.transaction_id == transaction_id,
                session=session
            )
            
            # Get current timestamp in user's timezone for business date
            if client_timezone:
                local_now = get_user_now(client_timezone)
                extension_date_utc = user_timezone_to_utc(local_now, client_timezone)
            else:
                extension_date_utc = datetime.now(UTC)
            
            # Generate formatted ID for the extension
            extension_formatted_id = await FormattedIdService.get_next_extension_formatted_id()
            
            # Create extension record with atomic session
            extension = Extension(
                transaction_id=transaction_id,
                formatted_id=extension_formatted_id,
                processed_by_user_id=processed_by_user_id,
                extension_months=extension_months,
                extension_fee_per_month=extension_fee_per_month,
                total_extension_fee=total_extension_fee,
                original_maturity_date=fresh_transaction.maturity_date,
                extension_date=extension_date_utc,
                extension_reason=extension_reason
            )
            
            # Calculate dates before saving (needed for audit entry)
            if not extension.new_maturity_date:
                extension.new_maturity_date = extension.calculate_new_maturity_date()
            if not extension.new_grace_period_end:
                extension.new_grace_period_end = extension.calculate_new_grace_period_end()
            
            # Save extension within transaction session
            if session:
                await extension.save(session=session)
            else:
                await extension.save()
            
            # Update transaction with new dates and status atomically
            await ExtensionService._update_transaction_for_extension_atomic(
                fresh_transaction, extension, processed_by_user_id, session
            )
            
            return extension
        
        # Execute extension operations without transaction wrapper
        # Note: Transaction support disabled due to Beanie/Motor compatibility
        try:
            extension = await extension_operations(session=None)
            
            # PERFORMANCE: Invalidate search cache after extension is processed
            try:
                from app.core.redis_cache import BusinessCache
                await BusinessCache.invalidate_by_pattern("transactions_list_*")
                # Log successful cache invalidation but don't fail if cache unavailable
            except Exception as cache_e:
                pass  # Continue even if cache invalidation fails
            
            return extension
        except Exception as e:
            raise ExtensionValidationError(f"Extension processing failed: {str(e)}")
    
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
        
        # Add extension audit entry using new notes service
        await notes_service.add_extension_audit(
            transaction=transaction,
            staff_member=processed_by_user_id,
            months=extension.extension_months,
            new_maturity=extension.new_maturity_date.strftime('%Y-%m-%d'),
            extension_id=extension.extension_id,
            fee=extension.total_extension_fee if extension.total_extension_fee > 0 else None,
            save_immediately=False  # We'll save separately
        )
        
        # Save transaction
        await transaction.save()
    
    @staticmethod
    async def _update_transaction_for_extension_atomic(
        transaction: PawnTransaction,
        extension: Extension,
        processed_by_user_id: str,
        session
    ) -> None:
        """
        Update transaction with extension details atomically within session.
        Internal method to keep transaction updates consistent.
        """
        # Update transaction dates
        transaction.maturity_date = extension.new_maturity_date
        transaction.grace_period_end = extension.new_grace_period_end
        
        # Update status to extended
        old_status = transaction.status
        transaction.status = TransactionStatus.EXTENDED
        
        # Add extension audit entry using new notes service with error handling
        # Temporarily disabled to debug extension issues
        # try:
        #     await notes_service.add_extension_audit(
        #         transaction=transaction,
        #         staff_member=processed_by_user_id,
        #         months=extension.extension_months,
        #         new_maturity=extension.new_maturity_date.strftime('%Y-%m-%d'),
        #         extension_id=extension.extension_id,
        #         fee=extension.total_extension_fee if extension.total_extension_fee > 0 else None,
        #         save_immediately=False  # Save with session
        #     )
        # except Exception as e:
        #     # Log audit entry error but don't fail the extension
        #     # Continue with extension processing
        #     pass
        
        # Save transaction within session
        if session:
            await transaction.save(session=session)
        else:
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
        
        # Check eligibility (can extend anytime before grace period ends)
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
        
        # Ensure grace_period_end is timezone-aware for comparison
        grace_period_end = ExtensionService._ensure_timezone_aware(transaction.grace_period_end)
        
        # Check if within extension window (can extend anytime before grace period ends)
        is_eligible = current_time <= grace_period_end
        
        # Calculate time remaining
        if is_eligible:
            time_remaining = grace_period_end - current_time
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
        
        # Ensure dates are timezone-aware for isoformat
        maturity_date = ExtensionService._ensure_timezone_aware(transaction.maturity_date)
        
        return {
            "transaction_id": transaction_id,
            "is_eligible": is_eligible and status_allows_extension,
            "current_status": transaction.status,
            "maturity_date": maturity_date.isoformat(),
            "grace_period_end": grace_period_end.isoformat(),
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
            return "Cannot extend - extension window has closed"
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
    
    @staticmethod
    async def get_extension_history(transaction_id: str, client_timezone: Optional[str] = None) -> 'ExtensionHistoryResponse':
        """
        Get comprehensive extension history for a transaction.
        
        Args:
            transaction_id: Transaction identifier
            
        Returns:
            ExtensionHistoryResponse with extension history and summary
            
        Raises:
            TransactionNotFoundError: Transaction not found
        """
        from app.schemas.extension_schema import ExtensionHistoryResponse, ExtensionResponse
        
        # Verify transaction exists
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        # Get all extensions
        extensions = await Extension.find(
            Extension.transaction_id == transaction_id
        ).sort(-Extension.extension_date).to_list()
        
        # Convert to response format with timezone conversion
        extension_responses = []
        for extension in extensions:
            extension_dict = extension.model_dump()
            
            # Convert UTC dates to user timezone for display
            if client_timezone:
                if extension_dict.get('extension_date'):
                    extension_dict['extension_date'] = utc_to_user_timezone(
                        extension.extension_date, client_timezone
                    ).isoformat()
                if extension_dict.get('original_maturity_date'):
                    extension_dict['original_maturity_date'] = utc_to_user_timezone(
                        extension.original_maturity_date, client_timezone
                    ).isoformat()
                if extension_dict.get('new_maturity_date'):
                    extension_dict['new_maturity_date'] = utc_to_user_timezone(
                        extension.new_maturity_date, client_timezone
                    ).isoformat()
                if extension_dict.get('created_at'):
                    extension_dict['created_at'] = utc_to_user_timezone(
                        extension.created_at, client_timezone
                    ).isoformat()
            
            extension_responses.append(ExtensionResponse.model_validate(extension_dict))
        
        # Get extension summary
        summary = await ExtensionService.get_extension_summary(transaction_id)
        
        # Create transaction details
        transaction_details = {
            "transaction_id": transaction_id,
            "status": transaction.status,
            "original_maturity_date": transaction.maturity_date.isoformat(),
            "current_grace_period_end": transaction.grace_period_end.isoformat()
        }
        
        return ExtensionHistoryResponse(
            transaction_id=transaction_id,
            extensions=extension_responses,
            summary=summary,
            transaction_details=transaction_details
        )
    
    @staticmethod
    async def get_extension_summary(transaction_id: str, client_timezone: Optional[str] = None) -> 'ExtensionSummaryResponse':
        """
        Get extension summary for a transaction.
        
        Args:
            transaction_id: Transaction identifier
            
        Returns:
            ExtensionSummaryResponse with extension totals and breakdown
            
        Raises:
            TransactionNotFoundError: Transaction not found
        """
        from app.schemas.extension_schema import ExtensionSummaryResponse
        
        # Verify transaction exists
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        # Get all extensions
        extensions = await Extension.find(
            Extension.transaction_id == transaction_id
        ).sort(-Extension.extension_date).to_list()
        
        # Calculate totals
        total_fees = sum(extension.total_extension_fee for extension in extensions)
        total_months = sum(extension.extension_months for extension in extensions)
        
        # Calculate last extension date with timezone conversion
        last_extension_date = None
        if extensions:
            last_extension_date = extensions[0].extension_date
            if client_timezone and last_extension_date:
                last_extension_date = utc_to_user_timezone(last_extension_date, client_timezone)
        
        # Convert transaction dates to user timezone for display
        current_maturity_date = transaction.maturity_date
        current_grace_period_end = transaction.grace_period_end
        if client_timezone:
            current_maturity_date = utc_to_user_timezone(current_maturity_date, client_timezone)
            current_grace_period_end = utc_to_user_timezone(current_grace_period_end, client_timezone)
        
        return ExtensionSummaryResponse(
            transaction_id=transaction_id,
            total_extensions=len(extensions),
            total_extension_fees=total_fees,
            total_months_extended=total_months,
            last_extension_date=last_extension_date,
            average_fee_per_month=total_fees // total_months if total_months > 0 else 0,
            current_maturity_date=current_maturity_date,
            current_grace_period_end=current_grace_period_end
        )
    
    @staticmethod
    async def check_extension_eligibility(
        transaction_id: str, 
        extension_months: Optional[int] = None
    ) -> 'ExtensionEligibilityResponse':
        """
        Check extension eligibility for a transaction.
        
        Args:
            transaction_id: Transaction identifier
            extension_months: Optional extension months to check
            
        Returns:
            ExtensionEligibilityResponse with eligibility status
            
        Raises:
            TransactionNotFoundError: Transaction not found
        """
        from app.schemas.extension_schema import ExtensionEligibilityResponse
        
        # Get transaction details
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        # Get eligibility data
        eligibility_data = await ExtensionService.validate_extension_eligibility(transaction_id)
        
        # Get current balance
        from app.services.pawn_transaction_service import PawnTransactionService
        balance_info = await PawnTransactionService.calculate_current_balance(transaction_id)
        
        # Get extension history
        extensions = await Extension.find(
            Extension.transaction_id == transaction_id
        ).to_list()
        
        # Calculate if overdue (ensure timezone-aware comparison)
        current_time = datetime.now(UTC)
        maturity_date = ExtensionService._ensure_timezone_aware(transaction.maturity_date)
        
        is_overdue = current_time > maturity_date
        days_overdue = max(0, (current_time - maturity_date).days) if is_overdue else 0
        
        # Build eligibility reasons
        eligibility_reasons = []
        if eligibility_data["is_eligible"]:
            eligibility_reasons.append("Transaction is eligible for extension")
            eligibility_reasons.append(f"Extension window closes on {eligibility_data['grace_period_end']}")
        else:
            if eligibility_data.get("reason"):
                eligibility_reasons.append(eligibility_data["reason"])
        
        return ExtensionEligibilityResponse(
            transaction_id=transaction_id,
            is_eligible=eligibility_data["is_eligible"],
            eligibility_reasons=eligibility_reasons,
            current_status=str(eligibility_data["current_status"]),
            current_balance=balance_info["current_balance"],
            maturity_date=maturity_date,
            is_overdue=is_overdue,
            days_overdue=days_overdue,
            previous_extensions=len(extensions),
            can_extend_months=[1, 2, 3] if eligibility_data["is_eligible"] else [],
            recommended_fee_per_month=50,
            min_fee_per_month=25,
            max_fee_per_month=100
        )
    
    @staticmethod
    async def generate_extension_receipt(extension_id: str) -> 'ExtensionReceiptResponse':
        """
        Generate extension receipt for printing/display.
        
        Args:
            extension_id: Extension identifier
            
        Returns:
            ExtensionReceiptResponse with receipt data
            
        Raises:
            ExtensionError: Extension not found
        """
        from app.schemas.extension_schema import ExtensionReceiptResponse
        from app.services.receipt_service import ReceiptService
        
        # Get extension
        extension = await ExtensionService.get_extension_by_id(extension_id)
        if not extension:
            raise ExtensionError(f"Extension {extension_id} not found")
        
        # Generate comprehensive receipt data using ReceiptService
        receipt_data = await ReceiptService.generate_extension_receipt(
            transaction_id=extension.transaction_id,
            extension_id=extension_id,
            receipt_type="customer"
        )
        
        # Transform to ExtensionReceiptResponse format
        customer = receipt_data.get("customer", {})
        extension_details = receipt_data.get("extension_details", {})
        
        return ExtensionReceiptResponse(
            extension_id=extension_id,
            transaction_id=extension.transaction_id,
            customer_name=customer.get("name", ""),
            customer_phone=customer.get("phone", ""),
            extension_months=extension.extension_months,
            extension_fee_per_month=extension.extension_fee_per_month,
            extension_fee_per_month_formatted=extension_details.get("fee_per_month", f"${extension.extension_fee_per_month}.00"),
            total_extension_fee=extension.total_extension_fee,
            total_extension_fee_formatted=extension_details.get("total_extension_fee", f"${extension.total_extension_fee}.00"),
            original_maturity_date=extension_details.get("original_maturity", extension.original_maturity_date.strftime("%B %d, %Y")),
            new_maturity_date=extension_details.get("new_maturity_date", extension.new_maturity_date.strftime("%B %d, %Y")),
            new_grace_period_end=extension_details.get("new_grace_period_ends", extension.new_grace_period_end.strftime("%B %d, %Y")),
            extension_date=extension.extension_date.strftime("%B %d, %Y at %I:%M %p"),
            processed_by=receipt_data.get("staff_member", extension.processed_by_user_id),
            extension_reason=extension.extension_reason,
            notes=extension.internal_notes,
            transaction_status=receipt_data.get("transaction_status", "extended"),
            item_count=receipt_data.get("item_count", 0)
        )
    
    @staticmethod
    async def validate_extension_request(
        transaction_id: str,
        extension_months: int,
        extension_fee_per_month: int
    ) -> 'ExtensionValidationResponse':
        """
        Validate extension request and return validation response.
        
        Args:
            transaction_id: Transaction identifier
            extension_months: Requested extension months
            extension_fee_per_month: Requested fee per month
            
        Returns:
            ExtensionValidationResponse with validation results
            
        Raises:
            TransactionNotFoundError: Transaction not found
        """
        from app.schemas.extension_schema import ExtensionValidationResponse
        
        try:
            preview_data = await ExtensionService.calculate_extension_preview(
                transaction_id=transaction_id,
                extension_months=extension_months,
                extension_fee_per_month=extension_fee_per_month
            )
            
            return ExtensionValidationResponse(
                is_valid=preview_data["is_valid"],
                can_process=preview_data["can_process"],
                validation_errors=list(filter(None, preview_data.get("warnings", []))),
                current_maturity_date=preview_data["current_maturity_date"],
                new_maturity_date=preview_data["new_maturity_date"],
                new_grace_period_end=preview_data["new_grace_period_end"],
                total_extension_fee=preview_data["total_extension_fee"],
                days_added=extension_months * 30,  # Approximate
                will_extend_grace_period=True,
                recommended_fee=50  # Default recommendation
            )
            
        except (TransactionNotFoundError, ExtensionValidationError):
            raise
        except Exception as e:
            raise ExtensionValidationError(f"Validation failed: {str(e)}")
    
    @staticmethod
    async def get_extensions_list(
        transaction_id: Optional[str] = None,
        processed_by: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        extension_months: Optional[int] = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "extension_date",
        sort_order: str = "desc",
        client_timezone: Optional[str] = None
    ) -> 'ExtensionListResponse':
        """
        Get paginated list of extensions with optional filtering.
        
        Returns:
            ExtensionListResponse with paginated extension data
        """
        from app.schemas.extension_schema import ExtensionListResponse, ExtensionResponse
        
        # Build query filters
        query_filters = []
        
        if transaction_id:
            query_filters.append(Extension.transaction_id == transaction_id)
        
        if processed_by:
            query_filters.append(Extension.processed_by_user_id == processed_by)
        
        if start_date:
            query_filters.append(Extension.extension_date >= start_date)
        
        if end_date:
            query_filters.append(Extension.extension_date <= end_date)
        
        if extension_months is not None:
            query_filters.append(Extension.extension_months == extension_months)
        
        # Build base query
        if query_filters:
            query = Extension.find(*query_filters)
        else:
            query = Extension.find()
        
        # Apply sorting
        sort_field = getattr(Extension, sort_by, Extension.extension_date)
        if sort_order.lower() == "asc":
            query = query.sort(sort_field)
        else:
            query = query.sort(-sort_field)
        
        # Get total count
        total_count = await query.count()
        
        # Apply pagination
        skip = (page - 1) * page_size
        extensions = await query.skip(skip).limit(page_size).to_list()
        
        # Convert to response format with timezone conversion
        extension_responses = []
        for extension in extensions:
            extension_dict = extension.model_dump()
            
            # Convert UTC dates to user timezone for display
            if client_timezone:
                if extension_dict.get('extension_date'):
                    extension_dict['extension_date'] = utc_to_user_timezone(
                        extension.extension_date, client_timezone
                    ).isoformat()
                if extension_dict.get('original_maturity_date'):
                    extension_dict['original_maturity_date'] = utc_to_user_timezone(
                        extension.original_maturity_date, client_timezone
                    ).isoformat()
                if extension_dict.get('new_maturity_date'):
                    extension_dict['new_maturity_date'] = utc_to_user_timezone(
                        extension.new_maturity_date, client_timezone
                    ).isoformat()
                if extension_dict.get('created_at'):
                    extension_dict['created_at'] = utc_to_user_timezone(
                        extension.created_at, client_timezone
                    ).isoformat()
            
            extension_responses.append(ExtensionResponse.model_validate(extension_dict))
        
        return ExtensionListResponse(
            extensions=extension_responses,
            total_count=total_count,
            page=page,
            page_size=page_size,
            has_next=skip + page_size < total_count
        )
    
    @staticmethod
    async def cancel_extension(
        extension_id: str,
        cancelled_by_user_id: str,
        cancellation_reason: Optional[str] = None
    ) -> Extension:
        """
        Cancel an extension (admin only operation).
        
        Args:
            extension_id: Extension to cancel
            cancelled_by_user_id: User cancelling the extension
            cancellation_reason: Optional reason for cancellation
            
        Returns:
            Extension: The cancelled extension
            
        Raises:
            ExtensionError: Extension not found or cannot be cancelled
        """
        # Get extension
        extension = await Extension.find_one(Extension.extension_id == extension_id)
        if not extension:
            raise ExtensionError(f"Extension {extension_id} not found")
        
        # Get transaction
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == extension.transaction_id
        )
        if not transaction:
            raise ExtensionError(f"Transaction {extension.transaction_id} not found")
        
        # Business rule: Cannot cancel if transaction is completed
        if transaction.status in [TransactionStatus.SOLD, TransactionStatus.REDEEMED, TransactionStatus.FORFEITED]:
            raise ExtensionError(f"Cannot cancel extension - transaction is {transaction.status}")
        
        # Revert transaction dates to original maturity date
        transaction.maturity_date = extension.original_maturity_date
        
        # Recalculate grace period from original maturity (1 month, not 7 days)
        # Use same calendar arithmetic as main transaction model
        grace_year = extension.original_maturity_date.year
        grace_month = extension.original_maturity_date.month + 1
        grace_day = extension.original_maturity_date.day
        
        # Handle month overflow
        if grace_month > 12:
            grace_year += grace_month // 12
            grace_month = grace_month % 12
            if grace_month == 0:
                grace_month = 12
                grace_year -= 1
        
        # Handle day overflow for shorter months
        try:
            transaction.grace_period_end = extension.original_maturity_date.replace(year=grace_year, month=grace_month, day=grace_day)
        except ValueError:
            # Day doesn't exist in target month
            import calendar
            last_day = calendar.monthrange(grace_year, grace_month)[1]
            transaction.grace_period_end = extension.original_maturity_date.replace(year=grace_year, month=grace_month, day=last_day)
        
        # Revert status if it was extended
        if transaction.status == TransactionStatus.EXTENDED:
            # Determine appropriate status based on current date
            current_time = datetime.now(UTC)
            # Ensure maturity_date is timezone-aware for comparison
            maturity_date = transaction.maturity_date
            if maturity_date.tzinfo is None:
                maturity_date = maturity_date.replace(tzinfo=UTC)
            
            if current_time <= maturity_date:
                transaction.status = TransactionStatus.ACTIVE
            else:
                transaction.status = TransactionStatus.OVERDUE
        
        # Add cancellation note
        cancellation_note = (
            f"[{datetime.now(UTC).isoformat()}] Extension {extension_id} cancelled by {cancelled_by_user_id}. "
            f"Reverted to original maturity: {extension.original_maturity_date.strftime('%Y-%m-%d')}."
        )
        
        if cancellation_reason:
            cancellation_note += f" Reason: {cancellation_reason}"
        
        # Smart truncation to respect 500 character limit
        current_notes = transaction.internal_notes or ""
        new_notes = f"{current_notes}\n{cancellation_note}".strip()
        
        # Truncate if necessary (500 char limit)
        if len(new_notes) > 500:
            # Calculate how much space we have for existing notes
            available_space = 500 - len(cancellation_note) - 1  # -1 for newline
            if available_space > 0:
                # Truncate existing notes and add ellipsis
                truncated_current = current_notes[:available_space-3] + "..."
                transaction.internal_notes = f"{truncated_current}\n{cancellation_note}".strip()
            else:
                # If cancellation note itself is too long, just use truncated cancellation note
                transaction.internal_notes = cancellation_note[:500]
        else:
            transaction.internal_notes = new_notes
        
        # Mark extension as cancelled (we'll add these fields to the Extension model)
        extension.is_cancelled = True
        extension.cancelled_date = datetime.now(UTC)
        extension.cancelled_by_user_id = cancelled_by_user_id
        extension.cancellation_reason = cancellation_reason
        
        # Save both records
        await extension.save()
        await transaction.save()
        
        return extension