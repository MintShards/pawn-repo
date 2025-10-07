"""
OverdueFeeService

Business logic for managing manually-entered overdue fees on overdue transactions.
Staff/admin can set custom overdue fees that are added to the redemption amount.
"""

# Standard library imports
from datetime import datetime, UTC
from typing import Optional, Dict, Any
import structlog

# Local imports
from app.models.pawn_transaction_model import PawnTransaction, TransactionStatus
from app.models.user_model import User, UserStatus
from app.models.audit_entry_model import AuditActionType, create_audit_entry
from app.core.redis_cache import BusinessCache

# Configure logger
logger = structlog.get_logger("overdue_fee")


class OverdueFeeError(Exception):
    """Base exception for overdue fee operations"""
    pass


class TransactionNotFoundError(OverdueFeeError):
    """Transaction not found error"""
    pass


class StaffValidationError(OverdueFeeError):
    """Staff user validation error"""
    pass


class OverdueFeeValidationError(OverdueFeeError):
    """Overdue fee validation error"""
    pass


class OverdueFeeService:
    """
    Service class for overdue fee management.

    Handles manual overdue fee entry, validation, balance calculations,
    and integration with the payment/redemption system.
    """

    @staticmethod
    async def set_overdue_fee(
        transaction_id: str,
        overdue_fee: int,
        set_by_user_id: str,
        notes: Optional[str] = None
    ) -> PawnTransaction:
        """
        Set or update the overdue fee for a transaction.

        Args:
            transaction_id: Transaction identifier
            overdue_fee: Overdue fee amount in whole dollars
            set_by_user_id: Staff/admin user setting the fee
            notes: Optional notes about why the fee is being set

        Returns:
            Updated PawnTransaction

        Raises:
            TransactionNotFoundError: Transaction not found
            StaffValidationError: Staff user validation failed
            OverdueFeeValidationError: Invalid fee amount or transaction status
        """
        # Validate staff user
        staff_user = await User.find_one(User.user_id == set_by_user_id)
        if not staff_user:
            raise StaffValidationError(f"Staff user {set_by_user_id} not found")

        if staff_user.status != UserStatus.ACTIVE:
            raise StaffValidationError(
                f"Staff user {staff_user.first_name} {staff_user.last_name} is not active"
            )

        # Get transaction
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")

        # Validate transaction status - only allow for overdue transactions
        if transaction.status != TransactionStatus.OVERDUE:
            raise OverdueFeeValidationError(
                f"Overdue fees can only be set on OVERDUE transactions. "
                f"Current status: {transaction.status}"
            )

        # Validate fee amount
        if overdue_fee < 0:
            raise OverdueFeeValidationError("Overdue fee cannot be negative")

        if overdue_fee > 10000:  # Business rule: max overdue fee $10,000
            raise OverdueFeeValidationError("Overdue fee cannot exceed $10,000")

        # Store old fee for audit trail
        old_fee = transaction.overdue_fee

        # Update overdue fee
        transaction.overdue_fee = overdue_fee

        # Create audit entry
        audit_entry = create_audit_entry(
            action_type=AuditActionType.OVERDUE_FEE_SET,
            staff_member=set_by_user_id,
            action_summary=f"Overdue fee: ${overdue_fee}",
            details=None,  # No details section for cleaner timeline
            amount=overdue_fee
        )
        transaction.add_system_audit_entry(audit_entry)

        # Add manual note if provided
        if notes:
            transaction.add_manual_note(
                f"Overdue fee: ${overdue_fee}. {notes}",
                set_by_user_id
            )

        # Save transaction
        await transaction.save()

        # Invalidate caches
        await BusinessCache.invalidate_transaction_data(transaction_id)

        logger.info(
            f"✅ OVERDUE FEE SET: ${overdue_fee} on {transaction_id} by {set_by_user_id}"
        )

        return transaction

    @staticmethod
    async def clear_overdue_fee(
        transaction_id: str,
        cleared_by_user_id: str,
        reason: Optional[str] = None
    ) -> PawnTransaction:
        """
        Clear/remove the overdue fee from a transaction.

        Args:
            transaction_id: Transaction identifier
            cleared_by_user_id: Staff/admin user clearing the fee
            reason: Optional reason for clearing the fee

        Returns:
            Updated PawnTransaction

        Raises:
            TransactionNotFoundError: Transaction not found
            StaffValidationError: Staff user validation failed
        """
        # Validate staff user
        staff_user = await User.find_one(User.user_id == cleared_by_user_id)
        if not staff_user:
            raise StaffValidationError(f"Staff user {cleared_by_user_id} not found")

        if staff_user.status != UserStatus.ACTIVE:
            raise StaffValidationError(
                f"Staff user {staff_user.first_name} {staff_user.last_name} is not active"
            )

        # Get transaction
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")

        # Store old fee for audit trail
        old_fee = transaction.overdue_fee

        if old_fee == 0:
            raise OverdueFeeValidationError("No overdue fee to clear")

        # Clear overdue fee
        transaction.overdue_fee = 0

        # Create audit entry
        audit_entry = create_audit_entry(
            action_type=AuditActionType.OVERDUE_FEE_CLEARED,
            staff_member=cleared_by_user_id,
            action_summary=f"Overdue fee cleared (was ${old_fee})",
            details=None,  # No details section for cleaner timeline
            amount=0
        )
        transaction.add_system_audit_entry(audit_entry)

        # Add manual note if provided
        if reason:
            transaction.add_manual_note(
                f"Overdue fee cleared (was ${old_fee}). Reason: {reason}",
                cleared_by_user_id
            )

        # Save transaction
        await transaction.save()

        # Invalidate caches
        await BusinessCache.invalidate_transaction_data(transaction_id)

        logger.info(
            f"✅ OVERDUE FEE CLEARED: ${old_fee} on {transaction_id} by {cleared_by_user_id}"
        )

        return transaction

    @staticmethod
    async def get_overdue_fee_info(transaction_id: str) -> Dict[str, Any]:
        """
        Get overdue fee information for a transaction.

        Args:
            transaction_id: Transaction identifier

        Returns:
            Dictionary with overdue fee details

        Raises:
            TransactionNotFoundError: Transaction not found
        """
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")

        # Check if transaction is eligible for overdue fees
        is_eligible = transaction.status == TransactionStatus.OVERDUE

        # Calculate days overdue if applicable
        days_overdue = 0
        if transaction.maturity_date:
            current_date = datetime.now(UTC)
            maturity_date = transaction.maturity_date
            if maturity_date.tzinfo is None:
                maturity_date = maturity_date.replace(tzinfo=UTC)

            if current_date > maturity_date:
                days_overdue = (current_date - maturity_date).days

        return {
            "transaction_id": transaction_id,
            "status": transaction.status,
            "is_overdue": transaction.status == TransactionStatus.OVERDUE,
            "is_eligible_for_fee": is_eligible,
            "current_overdue_fee": transaction.overdue_fee,
            "current_overdue_fee_formatted": f"${transaction.overdue_fee:,}",
            "has_overdue_fee": transaction.overdue_fee > 0,
            "days_overdue": days_overdue,
            "maturity_date": transaction.maturity_date.isoformat() if transaction.maturity_date else None,
            "can_set_fee": is_eligible,
            "can_clear_fee": transaction.overdue_fee > 0
        }

    @staticmethod
    async def calculate_total_with_overdue_fee(transaction_id: str) -> Dict[str, Any]:
        """
        Calculate total redemption amount including overdue fee.

        Args:
            transaction_id: Transaction identifier

        Returns:
            Dictionary with total calculation breakdown

        Raises:
            TransactionNotFoundError: Transaction not found
        """
        # Get balance info from InterestCalculationService
        from app.services.interest_calculation_service import InterestCalculationService

        balance_info = await InterestCalculationService.calculate_current_balance(
            transaction_id
        )

        # Get transaction for overdue fee
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")

        # Calculate total including overdue fee (balance_info is a BalanceResponse object)
        base_balance = balance_info.current_balance
        overdue_fee = transaction.overdue_fee
        total_redemption_amount = base_balance + overdue_fee

        return {
            "transaction_id": transaction_id,
            "base_balance": base_balance,
            "base_balance_formatted": f"${base_balance:,}",
            "overdue_fee": overdue_fee,
            "overdue_fee_formatted": f"${overdue_fee:,}",
            "total_redemption_amount": total_redemption_amount,
            "total_redemption_amount_formatted": f"${total_redemption_amount:,}",
            "has_overdue_fee": overdue_fee > 0,
            "breakdown": {
                "principal_balance": balance_info.principal_balance,
                "interest_balance": balance_info.interest_balance,
                "extension_fees_balance": balance_info.extension_fees_balance,
                "overdue_fee": overdue_fee,
                "total": total_redemption_amount
            }
        }

    @staticmethod
    async def validate_overdue_fee_amount(
        transaction_id: str,
        proposed_fee: int
    ) -> Dict[str, Any]:
        """
        Validate proposed overdue fee amount.

        Args:
            transaction_id: Transaction identifier
            proposed_fee: Proposed overdue fee amount

        Returns:
            Dictionary with validation results

        Raises:
            TransactionNotFoundError: Transaction not found
        """
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")

        validation_errors = []
        warnings = []

        # Check transaction status
        if transaction.status != TransactionStatus.OVERDUE:
            validation_errors.append(
                f"Transaction must be OVERDUE to set overdue fee (current: {transaction.status})"
            )

        # Check fee amount
        if proposed_fee < 0:
            validation_errors.append("Overdue fee cannot be negative")

        if proposed_fee > 10000:
            validation_errors.append("Overdue fee cannot exceed $10,000")

        # Warnings
        if proposed_fee > 1000:
            warnings.append("Large overdue fee - ensure proper authorization")

        if proposed_fee == 0 and transaction.overdue_fee > 0:
            warnings.append("This will clear the existing overdue fee")

        # Calculate impact on total balance
        current_fee = transaction.overdue_fee
        fee_difference = proposed_fee - current_fee

        # Get current balance
        from app.services.interest_calculation_service import InterestCalculationService
        balance_info = await InterestCalculationService.calculate_current_balance(transaction_id)

        current_total = balance_info.current_balance + current_fee
        new_total = balance_info.current_balance + proposed_fee

        return {
            "transaction_id": transaction_id,
            "is_valid": len(validation_errors) == 0,
            "validation_errors": validation_errors,
            "warnings": warnings,
            "proposed_fee": proposed_fee,
            "current_fee": current_fee,
            "fee_difference": fee_difference,
            "current_total_due": current_total,
            "new_total_due": new_total,
            "impact": "increase" if fee_difference > 0 else "decrease" if fee_difference < 0 else "no_change",
            "can_proceed": len(validation_errors) == 0
        }
