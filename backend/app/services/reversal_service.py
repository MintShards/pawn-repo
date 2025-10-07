"""
Reversal Service

Business logic for payment reversals and extension cancellations.
Handles same-day mistake correction with comprehensive validation and audit trails.
"""

import structlog
from datetime import datetime, UTC
from typing import Optional, Tuple
from app.models.payment_model import Payment
from app.models.extension_model import Extension
from app.models.pawn_transaction_model import PawnTransaction, TransactionStatus
from app.models.user_model import User
from app.core.exceptions import BusinessRuleError, ValidationError, AuthenticationError
from app.core.timezone_utils import get_user_now, utc_to_user_timezone

logger = structlog.get_logger(__name__)


class ReversalService:
    """Service for handling payment reversals and extension cancellations"""
    
    # Business rules
    MAX_HOURS_FOR_REVERSAL = 24  # Same-day window
    MAX_DAILY_REVERSALS_PER_TRANSACTION = 3  # Prevent abuse
    
    @classmethod
    async def check_payment_reversal_eligibility(
        cls, 
        payment_id: str,
        current_user: User,
        client_timezone: Optional[str] = None
    ) -> Tuple[bool, Optional[str], Optional[float]]:
        """
        Check if a payment can be reversed.
        
        Args:
            payment_id: Payment to check
            current_user: User requesting the check
            
        Returns:
            Tuple of (is_eligible, reason_if_not, hours_since_payment)
            
        Raises:
            ValidationError: If payment not found
        """
        # Find the payment
        payment = await Payment.find_one(Payment.payment_id == payment_id)
        if not payment:
            raise ValidationError(f"Payment {payment_id} not found")
        
        # Check if already voided
        if payment.is_voided:
            return False, "Payment is already voided", None
        
        # Check timing - must be within same business day using user's timezone
        current_time = get_user_now(client_timezone)
        # Convert payment date to user timezone for comparison
        payment_date_user_tz = utc_to_user_timezone(payment.payment_date, client_timezone)
        hours_since_payment = (current_time - payment_date_user_tz).total_seconds() / 3600
        
        if hours_since_payment > cls.MAX_HOURS_FOR_REVERSAL:
            return False, f"Payment is too old for reversal ({hours_since_payment:.1f} hours old, max {cls.MAX_HOURS_FOR_REVERSAL} hours)", hours_since_payment
        
        # Check daily reversal limit for this transaction
        transaction = await PawnTransaction.find_one(PawnTransaction.transaction_id == payment.transaction_id)
        if not transaction:
            return False, "Associated transaction not found", hours_since_payment
        
        daily_count = await cls._get_daily_reversal_count(payment.transaction_id)
        if daily_count >= cls.MAX_DAILY_REVERSALS_PER_TRANSACTION:
            return False, f"Maximum daily reversals ({cls.MAX_DAILY_REVERSALS_PER_TRANSACTION}) reached for this transaction", hours_since_payment
        
        # Check if transaction is in a valid state for reversal
        valid_statuses = [TransactionStatus.ACTIVE, TransactionStatus.OVERDUE, TransactionStatus.EXTENDED, TransactionStatus.REDEEMED]
        if transaction.status not in valid_statuses:
            return False, f"Cannot reverse payment for transaction with status: {transaction.status}", hours_since_payment
        
        logger.info(
            "Payment reversal eligibility check passed",
            payment_id=payment_id,
            transaction_id=payment.transaction_id,
            hours_since_payment=hours_since_payment,
            current_user=current_user.user_id
        )
        
        return True, None, hours_since_payment
    
    @classmethod
    async def reverse_payment(
        cls,
        payment_id: str,
        reversal_reason: str,
        admin_pin: str,
        current_user: User,
        staff_notes: Optional[str] = None,
        client_timezone: Optional[str] = None
    ) -> dict:
        """
        Reverse a payment (admin only, same-day).
        
        Args:
            payment_id: Payment to reverse
            reversal_reason: Reason for reversal
            admin_pin: Admin PIN for authorization
            current_user: User performing reversal
            staff_notes: Optional additional notes
            
        Returns:
            Dict with reversal details
            
        Raises:
            AuthenticationError: If admin PIN invalid
            BusinessRuleError: If reversal not allowed
            ValidationError: If payment not found
        """
        # Verify admin permissions
        if current_user.role != "admin":
            raise AuthenticationError("Only administrators can reverse payments")
        
        # Verify admin PIN
        if not current_user.verify_pin(admin_pin):
            raise AuthenticationError("Invalid admin PIN")
        
        # Check eligibility
        is_eligible, reason, hours_since = await cls.check_payment_reversal_eligibility(payment_id, current_user, client_timezone)
        if not is_eligible:
            raise BusinessRuleError(f"Payment reversal not allowed: {reason}")
        
        # Get payment and transaction
        payment = await Payment.find_one(Payment.payment_id == payment_id)
        transaction = await PawnTransaction.find_one(PawnTransaction.transaction_id == payment.transaction_id)
        
        start_time = datetime.now(UTC)
        logger.info(
            "Starting payment reversal",
            payment_id=payment_id,
            transaction_id=payment.transaction_id,
            original_amount=payment.payment_amount,
            hours_since_payment=hours_since,
            reversed_by=current_user.user_id,
            reason=reversal_reason
        )
        
        # Store original values for response
        original_amount = payment.payment_amount
        overdue_fee_portion = payment.overdue_fee_portion or 0

        # Void the payment directly (bypass heavy PaymentService.void_payment for performance)
        payment.void_payment(
            voided_by_user_id=current_user.user_id,
            void_reason=f"REVERSAL: {reversal_reason}"
        )

        # Restore overdue fee if payment included overdue fee portion
        if overdue_fee_portion > 0:
            transaction.overdue_fee = transaction.overdue_fee + overdue_fee_portion
            logger.info(
                "Restoring overdue fee during payment reversal",
                payment_id=payment_id,
                transaction_id=transaction.transaction_id,
                overdue_fee_restored=overdue_fee_portion,
                new_overdue_fee_balance=transaction.overdue_fee
            )

        # Update transaction notes
        reversal_note = f"\n--- PAYMENT REVERSED by {current_user.user_id} on {datetime.now(UTC).strftime('%Y-%m-%d %H:%M')} ---\nAmount: ${original_amount}"
        if overdue_fee_portion > 0:
            reversal_note += f"\nOverdue fee restored: ${overdue_fee_portion}"
        reversal_note += f"\nReason: {reversal_reason}"
        if staff_notes:
            reversal_note += f"\nStaff notes: {staff_notes}"
        
        # Ensure notes don't exceed limit
        if transaction.internal_notes:
            combined_notes = transaction.internal_notes + reversal_note
            if len(combined_notes) > 500:
                max_original_length = 500 - len(reversal_note) - 10
                if max_original_length > 0:
                    transaction.internal_notes = transaction.internal_notes[:max_original_length] + "..." + reversal_note
                else:
                    transaction.internal_notes = reversal_note[:500]
            else:
                transaction.internal_notes = combined_notes
        else:
            transaction.internal_notes = reversal_note.strip()[:500]
        
        # If transaction was redeemed, revert status (since we voided a payment, it's no longer fully paid)
        if transaction.status == TransactionStatus.REDEEMED:
            # Check if transaction has active extensions first
            from app.models.extension_model import Extension
            active_extensions = await Extension.find(
                Extension.transaction_id == transaction.transaction_id,
                Extension.is_cancelled != True
            ).to_list()
            
            if active_extensions:
                # Transaction has active extensions, set to EXTENDED
                transaction.status = TransactionStatus.EXTENDED
            else:
                # No active extensions, determine status based on maturity date using user's timezone (system standard)
                current_time = get_user_now(client_timezone)
                
                # Convert maturity date to user timezone for proper business logic comparison
                maturity_date_user_tz = utc_to_user_timezone(transaction.maturity_date, client_timezone)
                
                if current_time > maturity_date_user_tz:
                    transaction.status = TransactionStatus.OVERDUE
                else:
                    transaction.status = TransactionStatus.ACTIVE
        
        # Save changes
        await payment.save()
        await transaction.save()
        
        # CRITICAL: Invalidate transaction cache to ensure fresh status reads
        try:
            from app.core.redis_cache import get_cache_service
            cache = get_cache_service()
            if cache and cache.is_available:
                # Clear specific transaction cache
                transaction_cache_key = f"transaction:{payment.transaction_id}"
                await cache.delete(transaction_cache_key)
                logger.info(f"🚀 CACHE CLEARED: Transaction cache invalidated for {payment.transaction_id}")
        except Exception as e:
            logger.warning(f"Failed to invalidate transaction cache for {payment.transaction_id}: {str(e)}")
        
        end_time = datetime.now(UTC)
        duration_ms = (end_time - start_time).total_seconds() * 1000
        logger.info(
            "Payment reversal completed successfully",
            payment_id=payment_id,
            transaction_id=transaction.transaction_id,
            amount_reversed=original_amount,
            status_after_reversal=transaction.status,
            reversed_by=current_user.user_id,
            duration_ms=duration_ms
        )
        
        return {
            "payment_id": payment_id,
            "transaction_id": payment.transaction_id,
            "original_amount": original_amount,
            "balance_restored": original_amount,
            "overdue_fee_restored": overdue_fee_portion,
            "reversal_date": datetime.now(UTC),
            "reversed_by_user_id": current_user.user_id,
            "reversal_reason": reversal_reason
        }
    
    @classmethod
    async def check_extension_cancellation_eligibility(
        cls,
        extension_id: str,
        current_user: User,
        client_timezone: Optional[str] = None
    ) -> Tuple[bool, Optional[str], Optional[float]]:
        """
        Check if an extension can be cancelled.
        
        Args:
            extension_id: Extension to check
            current_user: User requesting the check
            
        Returns:
            Tuple of (is_eligible, reason_if_not, hours_since_extension)
            
        Raises:
            ValidationError: If extension not found
        """
        # Find the extension
        extension = await Extension.find_one(Extension.extension_id == extension_id)
        if not extension:
            raise ValidationError(f"Extension {extension_id} not found")
        
        # Check if already cancelled
        if extension.is_cancelled:
            return False, "Extension is already cancelled", None
        
        # Check timing - must be within same business day using user's timezone
        current_time = get_user_now(client_timezone)
        # Convert extension date to user timezone for comparison
        extension_date_user_tz = utc_to_user_timezone(extension.extension_date, client_timezone)
        hours_since_extension = (current_time - extension_date_user_tz).total_seconds() / 3600
        
        if hours_since_extension > cls.MAX_HOURS_FOR_REVERSAL:
            return False, f"Extension is too old for cancellation ({hours_since_extension:.1f} hours old, max {cls.MAX_HOURS_FOR_REVERSAL} hours)", hours_since_extension
        
        # Check daily reversal limit for this transaction
        daily_count = await cls._get_daily_reversal_count(extension.transaction_id)
        if daily_count >= cls.MAX_DAILY_REVERSALS_PER_TRANSACTION:
            return False, f"Maximum daily reversals ({cls.MAX_DAILY_REVERSALS_PER_TRANSACTION}) reached for this transaction", hours_since_extension
        
        # Check if transaction is in a valid state for cancellation
        transaction = await PawnTransaction.find_one(PawnTransaction.transaction_id == extension.transaction_id)
        if not transaction:
            return False, "Associated transaction not found", hours_since_extension
        
        valid_statuses = [TransactionStatus.ACTIVE, TransactionStatus.OVERDUE, TransactionStatus.EXTENDED]
        if transaction.status not in valid_statuses:
            return False, f"Cannot cancel extension for transaction with status: {transaction.status}", hours_since_extension
        
        logger.info(
            "Extension cancellation eligibility check passed",
            extension_id=extension_id,
            transaction_id=extension.transaction_id,
            hours_since_extension=hours_since_extension,
            current_user=current_user.user_id
        )
        
        return True, None, hours_since_extension
    
    @classmethod
    async def cancel_extension(
        cls,
        extension_id: str,
        cancellation_reason: str,
        admin_pin: str,
        current_user: User,
        staff_notes: Optional[str] = None,
        client_timezone: Optional[str] = None
    ) -> dict:
        """
        Cancel an extension (admin only, same-day).
        
        Args:
            extension_id: Extension to cancel
            cancellation_reason: Reason for cancellation
            admin_pin: Admin PIN for authorization
            current_user: User performing cancellation
            staff_notes: Optional additional notes
            
        Returns:
            Dict with cancellation details
            
        Raises:
            AuthenticationError: If admin PIN invalid
            BusinessRuleError: If cancellation not allowed
            ValidationError: If extension not found
        """
        # Verify admin permissions
        if current_user.role != "admin":
            raise AuthenticationError("Only administrators can cancel extensions")
        
        # Verify admin PIN
        if not current_user.verify_pin(admin_pin):
            raise AuthenticationError("Invalid admin PIN")
        
        # Check eligibility
        is_eligible, reason, hours_since = await cls.check_extension_cancellation_eligibility(extension_id, current_user, client_timezone)
        if not is_eligible:
            raise BusinessRuleError(f"Extension cancellation not allowed: {reason}")
        
        # Get extension and transaction
        extension = await Extension.find_one(Extension.extension_id == extension_id)
        transaction = await PawnTransaction.find_one(PawnTransaction.transaction_id == extension.transaction_id)
        
        start_time = datetime.now(UTC)
        logger.info(
            "Starting extension cancellation",
            extension_id=extension_id,
            transaction_id=extension.transaction_id,
            extension_fee=extension.total_extension_fee,
            hours_since_extension=hours_since,
            cancelled_by=current_user.user_id,
            reason=cancellation_reason
        )
        
        # Store original values for response
        fee_to_refund = extension.total_extension_fee
        original_maturity = extension.original_maturity_date
        
        # Mark extension as cancelled
        extension.is_cancelled = True
        extension.cancelled_date = datetime.now(UTC)
        extension.cancelled_by_user_id = current_user.user_id
        extension.cancellation_reason = cancellation_reason
        
        # Revert transaction maturity date to original
        transaction.maturity_date = original_maturity
        
        # Revert transaction status if it was extended
        if transaction.status == TransactionStatus.EXTENDED:
            # Determine appropriate status based on original maturity date using user's timezone (system standard)
            current_time = get_user_now(client_timezone)
            
            # Convert original maturity to user timezone for proper business logic comparison
            original_maturity_user_tz = utc_to_user_timezone(original_maturity, client_timezone)
            
            if current_time > original_maturity_user_tz:
                transaction.status = TransactionStatus.OVERDUE
            else:
                transaction.status = TransactionStatus.ACTIVE
        
        # Update transaction notes
        cancellation_note = f"\n--- EXTENSION CANCELLED by {current_user.user_id} on {datetime.now(UTC).strftime('%Y-%m-%d %H:%M')} ---\nFee refunded: ${fee_to_refund}\nMaturity reverted to: {original_maturity.strftime('%Y-%m-%d')}\nReason: {cancellation_reason}"
        if staff_notes:
            cancellation_note += f"\nStaff notes: {staff_notes}"
        
        # Ensure notes don't exceed limit
        if transaction.internal_notes:
            combined_notes = transaction.internal_notes + cancellation_note
            if len(combined_notes) > 500:
                max_original_length = 500 - len(cancellation_note) - 10
                if max_original_length > 0:
                    transaction.internal_notes = transaction.internal_notes[:max_original_length] + "..." + cancellation_note
                else:
                    transaction.internal_notes = cancellation_note[:500]
            else:
                transaction.internal_notes = combined_notes
        else:
            transaction.internal_notes = cancellation_note.strip()[:500]
        
        # Save changes
        await extension.save()
        await transaction.save()
        
        # CRITICAL: Invalidate transaction cache to ensure fresh status reads
        try:
            from app.core.redis_cache import get_cache_service
            cache = get_cache_service()
            if cache and cache.is_available:
                # Clear specific transaction cache
                transaction_cache_key = f"transaction:{extension.transaction_id}"
                await cache.delete(transaction_cache_key)
                logger.info(f"🚀 CACHE CLEARED: Transaction cache invalidated for {extension.transaction_id}")
        except Exception as e:
            logger.warning(f"Failed to invalidate transaction cache for {extension.transaction_id}: {str(e)}")
        
        end_time = datetime.now(UTC)
        duration_ms = (end_time - start_time).total_seconds() * 1000
        logger.info(
            "Extension cancellation completed successfully",
            extension_id=extension_id,
            transaction_id=extension.transaction_id,
            fee_refunded=fee_to_refund,
            maturity_reverted_to=original_maturity,
            cancelled_by=current_user.user_id,
            duration_ms=duration_ms
        )
        
        return {
            "extension_id": extension_id,
            "transaction_id": extension.transaction_id,
            "extension_fee_refunded": fee_to_refund,
            "maturity_date_reverted": original_maturity,
            "cancellation_date": datetime.now(UTC),
            "cancelled_by_user_id": current_user.user_id,
            "cancellation_reason": cancellation_reason
        }
    
    @classmethod
    async def get_daily_reversal_report(cls, report_date: Optional[datetime] = None) -> dict:
        """
        Get daily reversal report for a specific date.
        
        Args:
            report_date: Date for report (defaults to today)
            
        Returns:
            Dict with daily reversal statistics
        """
        if not report_date:
            report_date = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Calculate date range for the day
        start_of_day = report_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Count payment reversals
        payment_reversals = await Payment.find({
            "is_voided": True,
            "voided_date": {"$gte": start_of_day, "$lte": end_of_day}
        }).to_list()
        
        # Count extension cancellations
        extension_cancellations = await Extension.find({
            "is_cancelled": True,
            "cancelled_date": {"$gte": start_of_day, "$lte": end_of_day}
        }).to_list()
        
        # Calculate totals
        total_amount_reversed = sum(p.payment_amount for p in payment_reversals)
        total_fees_refunded = sum(e.total_extension_fee for e in extension_cancellations)
        
        return {
            "report_date": report_date,
            "total_payment_reversals": len(payment_reversals),
            "total_extension_cancellations": len(extension_cancellations),
            "total_amount_reversed": total_amount_reversed,
            "total_fees_refunded": total_fees_refunded
        }
    
    @classmethod
    async def get_transaction_reversal_count(cls, transaction_id: str) -> dict:
        """
        Get reversal count for a specific transaction for today.
        
        Args:
            transaction_id: Transaction to check
            
        Returns:
            Dict with reversal counts and limits
        """
        daily_count = await cls._get_daily_reversal_count(transaction_id)
        
        # Get breakdown by type
        current_date = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = current_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        payment_reversals = await Payment.find({
            "transaction_id": transaction_id,
            "is_voided": True,
            "voided_date": {"$gte": current_date, "$lte": end_of_day}
        }).count()
        
        extension_cancellations = await Extension.find({
            "transaction_id": transaction_id,
            "is_cancelled": True,
            "cancelled_date": {"$gte": current_date, "$lte": end_of_day}
        }).count()
        
        return {
            "transaction_id": transaction_id,
            "daily_payment_reversals": payment_reversals,
            "daily_extension_cancellations": extension_cancellations,
            "max_daily_limit": cls.MAX_DAILY_REVERSALS_PER_TRANSACTION,
            "can_reverse_more": daily_count < cls.MAX_DAILY_REVERSALS_PER_TRANSACTION
        }
    
    @classmethod
    async def _get_daily_reversal_count(cls, transaction_id: str) -> int:
        """
        Get total daily reversal count for a transaction (payments + extensions).
        
        Args:
            transaction_id: Transaction to check
            
        Returns:
            Total count of reversals today
        """
        current_date = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = current_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Count payment reversals
        payment_count = await Payment.find({
            "transaction_id": transaction_id,
            "is_voided": True,
            "voided_date": {"$gte": current_date, "$lte": end_of_day}
        }).count()
        
        # Count extension cancellations
        extension_count = await Extension.find({
            "transaction_id": transaction_id,
            "is_cancelled": True,
            "cancelled_date": {"$gte": current_date, "$lte": end_of_day}
        }).count()
        
        return payment_count + extension_count