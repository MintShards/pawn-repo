"""
InterestCalculationService

Business logic for handling fixed monthly interest calculations, staff adjustments,
and detailed interest progression tracking on pawn transactions.
"""

# Standard library imports
from datetime import datetime, UTC
from typing import Dict, List, Optional, Any
import structlog

# Local imports
from app.models.pawn_transaction_model import PawnTransaction, TransactionStatus
from app.models.payment_model import Payment
from app.models.extension_model import Extension
from app.models.user_model import User, UserStatus
from app.schemas.pawn_transaction_schema import BalanceResponse
from app.core.transaction_notes import safe_append_transaction_notes, format_system_note
from app.core.timezone_utils import get_months_between_user_timezone, get_user_now

# Configure logger
logger = structlog.get_logger("interest_calculation")


class InterestCalculationError(Exception):
    """Base exception for interest calculation operations"""
    pass


class TransactionNotFoundError(InterestCalculationError):
    """Transaction not found error"""
    pass


class StaffValidationError(InterestCalculationError):
    """Staff user validation error"""
    pass


class InterestValidationError(InterestCalculationError):
    """Interest validation error"""
    pass


class InterestCalculationService:
    """
    Service class for interest calculation business logic.
    
    Handles fixed monthly interest calculations, staff adjustments,
    detailed progression tracking, and payoff calculations using
    calendar month arithmetic established in the transaction model.
    """
    
    @staticmethod
    async def calculate_accrued_interest(
        transaction_id: str,
        as_of_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Calculate accrued interest for a transaction using calendar month logic.
        
        Args:
            transaction_id: Transaction to calculate interest for
            as_of_date: Date to calculate interest (defaults to current date)
            
        Returns:
            Dictionary with interest calculation breakdown
            
        Raises:
            TransactionNotFoundError: Transaction not found
        """
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        if as_of_date is None:
            as_of_date = datetime.now(UTC)
        
        # Use the existing calendar month logic from the transaction model
        total_due = transaction.calculate_total_due(as_of_date)
        interest_accrued = total_due - transaction.loan_amount
        
        # Calculate months elapsed using same logic as transaction model
        months_elapsed = ((as_of_date.year - transaction.pawn_date.year) * 12 + 
                         (as_of_date.month - transaction.pawn_date.month))
        
        if as_of_date.day > transaction.pawn_date.day:
            months_elapsed += 1
        
        # Apply 3-month cap and minimum 1 month
        months_elapsed = max(1, min(months_elapsed, 3))
        
        return {
            "transaction_id": transaction_id,
            "pawn_date": transaction.pawn_date.isoformat(),
            "calculation_date": as_of_date.isoformat(),
            "months_elapsed": months_elapsed,
            "monthly_interest_amount": transaction.monthly_interest_amount,
            "total_interest_accrued": interest_accrued,
            "original_loan_amount": transaction.loan_amount,
            "is_capped_at_maturity": months_elapsed >= 3,
            "maturity_date": transaction.maturity_date.isoformat(),
            "grace_period_end": transaction.grace_period_end.isoformat(),
            "calculation_method": "calendar_months_with_3_month_cap"
        }
    
    @staticmethod
    async def calculate_comprehensive_balance(
        transaction_id: str,
        as_of_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive balance including all components.
        
        Args:
            transaction_id: Transaction identifier
            as_of_date: Date for calculation (defaults to current date)
            
        Returns:
            Dictionary with complete balance breakdown
            
        Raises:
            TransactionNotFoundError: Transaction not found
        """
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        if as_of_date is None:
            as_of_date = datetime.now(UTC)
        
        # Get interest calculation
        interest_info = await InterestCalculationService.calculate_accrued_interest(
            transaction_id, as_of_date
        )
        
        # Get all payments
        payments = await Payment.find(
            Payment.transaction_id == transaction_id
        ).sort(Payment.payment_date).to_list()
        
        # Only count non-voided payments
        total_payments = sum(
            payment.payment_amount 
            for payment in payments 
            if not getattr(payment, 'is_voided', False)
        )
        
        # Get all extensions
        extensions = await Extension.find(
            Extension.transaction_id == transaction_id
        ).to_list()
        
        total_extension_fees = sum(extension.total_extension_fee for extension in extensions)
        
        # Calculate components
        loan_amount = transaction.loan_amount
        interest_accrued = interest_info["total_interest_accrued"]
        
        total_due = loan_amount + interest_accrued + total_extension_fees
        current_balance = max(0, total_due - total_payments)
        
        # Calculate payment allocation (interest paid first)
        interest_paid = min(total_payments, interest_accrued)
        remaining_payments = total_payments - interest_paid
        principal_paid = min(remaining_payments, loan_amount)
        extension_fees_paid = total_payments - interest_paid - principal_paid
        
        return {
            "transaction_id": transaction_id,
            "calculation_date": as_of_date.isoformat(),
            "loan_amount": loan_amount,
            "interest_accrued": interest_accrued,
            "extension_fees": total_extension_fees,
            "total_due": total_due,
            "total_payments": total_payments,
            "current_balance": current_balance,
            "is_paid_off": current_balance == 0,
            "payment_allocation": {
                "interest_paid": interest_paid,
                "principal_paid": principal_paid,
                "extension_fees_paid": extension_fees_paid,
                "interest_remaining": max(0, interest_accrued - interest_paid),
                "principal_remaining": max(0, loan_amount - principal_paid),
                "extension_fees_remaining": max(0, total_extension_fees - extension_fees_paid)
            },
            "breakdown": {
                "principal": loan_amount,
                "interest": interest_accrued,
                "extension_fees": total_extension_fees,
                "payments_made": total_payments
            },
            "interest_details": interest_info
        }
    
    @staticmethod
    async def calculate_monthly_progression(transaction_id: str) -> Dict[str, Any]:
        """
        Calculate month-by-month interest progression with payment history.
        
        Args:
            transaction_id: Transaction identifier
            
        Returns:
            Dictionary with monthly progression details
            
        Raises:
            TransactionNotFoundError: Transaction not found
        """
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        # Get all payments ordered by date
        payments = await Payment.find(
            Payment.transaction_id == transaction_id
        ).sort(Payment.payment_date).to_list()
        
        # Calculate current months elapsed
        current_date = datetime.now(UTC)
        months_elapsed = ((current_date.year - transaction.pawn_date.year) * 12 + 
                         (current_date.month - transaction.pawn_date.month))
        
        if current_date.day > transaction.pawn_date.day:
            months_elapsed += 1
        
        # Cap at 3 months for interest calculation
        months_for_calculation = max(1, min(months_elapsed, 3))
        
        # Group payments by month from pawn date (exclude voided payments)
        payments_by_month = {}
        for payment in payments:
            # Skip voided payments
            if getattr(payment, 'is_voided', False):
                continue
            payment_months = ((payment.payment_date.year - transaction.pawn_date.year) * 12 + 
                             (payment.payment_date.month - transaction.pawn_date.month))
            if payment.payment_date.day > transaction.pawn_date.day:
                payment_months += 1
            
            # Ensure month is at least 1
            payment_month = max(1, payment_months + 1)  # +1 to make it 1-based
            
            if payment_month not in payments_by_month:
                payments_by_month[payment_month] = []
            payments_by_month[payment_month].append(payment)
        
        # Build monthly progression
        monthly_breakdown = []
        running_balance = transaction.loan_amount
        
        for month in range(1, months_for_calculation + 1):
            # Interest is added each month (fixed amount)
            month_interest = transaction.monthly_interest_amount
            
            # Get payments made during this month
            month_payments = payments_by_month.get(month, [])
            month_payment_total = sum(p.payment_amount for p in month_payments)
            
            # Calculate balances
            balance_before_interest = running_balance
            balance_after_interest = balance_before_interest + month_interest
            balance_after_payments = max(0, balance_after_interest - month_payment_total)
            
            monthly_breakdown.append({
                "month": month,
                "month_description": f"Month {month} ({InterestCalculationService._get_month_name(transaction.pawn_date, month-1)})",
                "starting_balance": balance_before_interest,
                "interest_added": month_interest,
                "balance_after_interest": balance_after_interest,
                "payments_made": month_payment_total,
                "payment_count": len(month_payments),
                "ending_balance": balance_after_payments,
                "payment_details": [
                    {
                        "payment_id": p.payment_id,
                        "amount": p.payment_amount,
                        "date": p.payment_date.isoformat(),
                        "processed_by": p.processed_by_user_id
                    }
                    for p in month_payments
                ]
            })
            
            running_balance = balance_after_payments
        
        # If we're past month 3, show note about interest cap
        grace_period_months = max(0, months_elapsed - 3)
        
        return {
            "transaction_id": transaction_id,
            "pawn_date": transaction.pawn_date.isoformat(),
            "calculation_date": current_date.isoformat(),
            "monthly_interest_amount": transaction.monthly_interest_amount,
            "months_calculated": months_for_calculation,
            "total_months_elapsed": months_elapsed,
            "grace_period_months": grace_period_months,
            "final_balance": running_balance,
            "interest_cap_applied": months_elapsed > 3,
            "monthly_progression": monthly_breakdown,
            "summary": {
                "total_interest_charged": months_for_calculation * transaction.monthly_interest_amount,
                "total_payments_made": sum(sum(p.payment_amount for p in payments_by_month.get(m, [])) for m in range(1, months_for_calculation + 1)),
                "average_payment_per_month": sum(sum(p.payment_amount for p in payments_by_month.get(m, [])) for m in range(1, months_for_calculation + 1)) / months_for_calculation if months_for_calculation > 0 else 0
            }
        }
    
    @staticmethod
    def _get_month_name(pawn_date: datetime, month_offset: int) -> str:
        """Get month name for display purposes"""
        target_month = pawn_date.month + month_offset
        target_year = pawn_date.year
        
        while target_month > 12:
            target_month -= 12
            target_year += 1
        
        month_names = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ]
        
        return f"{month_names[target_month - 1]} {target_year}"
    
    @staticmethod
    async def calculate_payoff_amount(
        transaction_id: str,
        as_of_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Calculate total amount needed to pay off loan as of specific date.
        
        Args:
            transaction_id: Transaction identifier
            as_of_date: Date for payoff calculation (defaults to current date)
            
        Returns:
            Dictionary with payoff amount breakdown
            
        Raises:
            TransactionNotFoundError: Transaction not found
        """
        if as_of_date is None:
            as_of_date = datetime.now(UTC)
        
        balance_info = await InterestCalculationService.calculate_comprehensive_balance(
            transaction_id, as_of_date
        )
        
        return {
            "transaction_id": transaction_id,
            "payoff_amount": balance_info["current_balance"],
            "payoff_amount_formatted": f"${balance_info['current_balance']:,}",
            "as_of_date": as_of_date.isoformat(),
            "breakdown": balance_info["breakdown"],
            "payment_allocation": balance_info["payment_allocation"],
            "note": "Interest stops accruing once paid in full",
            "components": {
                "remaining_principal": balance_info["payment_allocation"]["principal_remaining"],
                "remaining_interest": balance_info["payment_allocation"]["interest_remaining"],
                "remaining_extension_fees": balance_info["payment_allocation"]["extension_fees_remaining"]
            }
        }
    
    @staticmethod
    async def preview_interest_adjustment(
        transaction_id: str,
        new_monthly_interest: int,
        as_of_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Preview what happens if staff adjusts the monthly interest amount.
        
        Args:
            transaction_id: Transaction to adjust
            new_monthly_interest: New monthly interest amount
            as_of_date: Date for calculation (defaults to current date)
            
        Returns:
            Dictionary with comparison of current vs new interest calculation
            
        Raises:
            TransactionNotFoundError: Transaction not found
            InterestValidationError: Invalid interest amount
        """
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        if new_monthly_interest < 0:
            raise InterestValidationError("Monthly interest cannot be negative")
        
        if new_monthly_interest > 1000:
            raise InterestValidationError("Monthly interest cannot exceed $1,000")
        
        if as_of_date is None:
            as_of_date = datetime.now(UTC)
        
        # Current calculation
        current_calculation = await InterestCalculationService.calculate_comprehensive_balance(
            transaction_id, as_of_date
        )
        
        # Temporarily update interest amount for new calculation
        original_interest = transaction.monthly_interest_amount
        transaction.monthly_interest_amount = new_monthly_interest
        
        # Calculate with new interest rate
        new_total_due = transaction.calculate_total_due(as_of_date)
        new_interest_accrued = new_total_due - transaction.loan_amount
        
        # Restore original interest
        transaction.monthly_interest_amount = original_interest
        
        # Get extension fees and payments
        total_payments = current_calculation["total_payments"]
        extension_fees = current_calculation["extension_fees"]
        
        # Calculate new balance
        new_total_with_extensions = new_total_due + extension_fees
        new_current_balance = max(0, new_total_with_extensions - total_payments)
        
        # Calculate differences
        balance_difference = new_current_balance - current_calculation["current_balance"]
        interest_difference = new_interest_accrued - current_calculation["interest_accrued"]
        
        # Determine impact type
        if balance_difference < 0:
            impact_type = "customer_saves"
            impact_description = f"Customer saves ${abs(balance_difference):,}"
        elif balance_difference > 0:
            impact_type = "customer_pays_more"
            impact_description = f"Customer pays ${balance_difference:,} more"
        else:
            impact_type = "no_change"
            impact_description = "No change to current balance"
        
        adjustment_type = "staff_discount" if new_monthly_interest < original_interest else \
                         "interest_increase" if new_monthly_interest > original_interest else \
                         "no_change"
        
        return {
            "transaction_id": transaction_id,
            "calculation_date": as_of_date.isoformat(),
            "current_monthly_interest": original_interest,
            "new_monthly_interest": new_monthly_interest,
            "months_elapsed": current_calculation["interest_details"]["months_elapsed"],
            "current_balance": current_calculation["current_balance"],
            "new_balance": new_current_balance,
            "balance_difference": balance_difference,
            "interest_difference": interest_difference,
            "impact_type": impact_type,
            "impact_description": impact_description,
            "adjustment_type": adjustment_type,
            "can_apply": True,
            "recommendations": InterestCalculationService._get_adjustment_recommendations(
                original_interest, new_monthly_interest, balance_difference
            )
        }
    
    @staticmethod
    def _get_adjustment_recommendations(
        original_interest: int,
        new_interest: int,
        balance_difference: int
    ) -> List[str]:
        """Generate recommendations for interest adjustments"""
        recommendations = []
        
        if new_interest < original_interest:
            recommendations.append("This is a customer discount - ensure proper authorization")
            if balance_difference < -100:
                recommendations.append("Significant discount - consider management approval")
        
        if new_interest > original_interest:
            recommendations.append("Interest increase - ensure customer is notified")
            
        if new_interest == 0:
            recommendations.append("Zero interest - this is a substantial customer benefit")
        
        if abs(balance_difference) > 500:
            recommendations.append("Large balance impact - double-check calculation")
            
        return recommendations
    
    @staticmethod
    async def apply_interest_adjustment(
        transaction_id: str,
        new_monthly_interest: int,
        adjusted_by_user_id: str,
        reason: str = "Staff adjustment",
        internal_notes: Optional[str] = None
    ) -> PawnTransaction:
        """
        Apply staff adjustment to monthly interest amount.
        
        Args:
            transaction_id: Transaction to adjust
            new_monthly_interest: New monthly interest amount
            adjusted_by_user_id: Staff member making adjustment
            reason: Reason for adjustment
            internal_notes: Optional internal notes
            
        Returns:
            Updated PawnTransaction
            
        Raises:
            TransactionNotFoundError: Transaction not found
            StaffValidationError: Staff user validation failed
            InterestValidationError: Invalid interest amount
        """
        # Validate staff user
        staff_user = await User.find_one(User.user_id == adjusted_by_user_id)
        if not staff_user:
            raise StaffValidationError(f"Staff user {adjusted_by_user_id} not found")
        
        if staff_user.status != UserStatus.ACTIVE:
            raise StaffValidationError(f"Staff user {staff_user.first_name} {staff_user.last_name} is not active")
        
        # Validate transaction
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        # Validate new interest amount
        if new_monthly_interest < 0:
            raise InterestValidationError("Monthly interest cannot be negative")
        
        if new_monthly_interest > 1000:
            raise InterestValidationError("Monthly interest cannot exceed $1,000")
        
        # Update interest amount
        old_interest = transaction.monthly_interest_amount
        transaction.monthly_interest_amount = new_monthly_interest
        
        # Create adjustment note
        adjustment_timestamp = datetime.now(UTC).isoformat()
        adjustment_note = (
            f"[{adjustment_timestamp}] Interest adjusted from ${old_interest} to ${new_monthly_interest} "
            f"by {staff_user.first_name} {staff_user.last_name} ({adjusted_by_user_id}). Reason: {reason}"
        )
        
        if internal_notes:
            adjustment_note += f". Notes: {internal_notes}"
        
        # Update transaction notes
        current_notes = transaction.internal_notes or ""
        transaction.internal_notes = f"{current_notes}\n{adjustment_note}".strip()
        
        # Save transaction
        await transaction.save()
        
        return transaction
    
    @staticmethod
    async def get_interest_adjustment_history(transaction_id: str) -> Dict[str, Any]:
        """
        Get history of interest adjustments for a transaction.
        
        Args:
            transaction_id: Transaction identifier
            
        Returns:
            Dictionary with adjustment history
            
        Raises:
            TransactionNotFoundError: Transaction not found
        """
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        # Parse internal notes for interest adjustments
        adjustments = []
        if transaction.internal_notes:
            lines = transaction.internal_notes.split('\n')
            for line in lines:
                if 'Interest adjusted' in line:
                    adjustments.append(line.strip())
        
        return {
            "transaction_id": transaction_id,
            "current_monthly_interest": transaction.monthly_interest_amount,
            "current_monthly_interest_formatted": f"${transaction.monthly_interest_amount:,}",
            "adjustment_count": len(adjustments),
            "adjustment_history": adjustments,
            "has_been_adjusted": len(adjustments) > 0
        }
    
    @staticmethod
    async def calculate_current_balance(
        transaction_id: str,
        as_of_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Calculate current balance for a transaction including interest accrual.
        
        Args:
            transaction_id: Unique transaction identifier
            as_of_date: Balance calculation date (defaults to now)
            
        Returns:
            Dictionary containing balance information
        """
        
        if as_of_date is None:
            as_of_date = datetime.now(UTC)
        
        # Get transaction
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        # Get all payments for this transaction
        payments = await Payment.find(
            Payment.transaction_id == transaction_id
        ).sort(Payment.payment_date).to_list()
        
        # Calculate basic balance components
        loan_amount = transaction.loan_amount
        monthly_interest = transaction.monthly_interest_amount

        # Calculate months elapsed using calendar month logic
        months_elapsed = transaction.calculate_months_elapsed(as_of_date)

        # Apply 3-month interest cap (business rule)
        capped_months = min(months_elapsed, 3)
        total_interest_due = monthly_interest * capped_months

        # Extension fees are handled separately by the extension system
        # Regular payments only cover principal + interest
        total_extension_fees = 0

        # Get manually-entered overdue fee
        overdue_fee = getattr(transaction, 'overdue_fee', 0)

        # Calculate total due INCLUDING overdue fee (principal + interest + overdue fee)
        total_due = loan_amount + total_interest_due + overdue_fee
        
        # Calculate total payments (defensive programming) - exclude voided payments
        try:
            # Only count non-voided payments
            total_paid = sum(
                payment.payment_amount 
                for payment in payments 
                if not getattr(payment, 'is_voided', False)
            ) if payments else 0
        except (AttributeError, TypeError) as e:
            logger.warning(
                "Error calculating total payments for transaction",
                transaction_id=transaction_id,
                error=str(e)
            )
            total_paid = 0
        
        # Calculate current balance
        current_balance = max(0, total_due - total_paid)

        # Payment allocation (priority: interest → overdue fee → principal)
        # Extension fees are handled separately by the extension system
        remaining_payments = total_paid

        # 1. Pay interest first
        interest_paid = min(remaining_payments, total_interest_due)
        remaining_payments -= interest_paid

        # 2. Pay overdue fee second
        overdue_fee_paid = min(remaining_payments, overdue_fee)
        remaining_payments -= overdue_fee_paid

        # 3. Pay principal third (extension fees not included)
        principal_paid = min(remaining_payments, loan_amount)

        # Extension fees are handled by extension system, not regular payments
        extension_fees_paid = 0

        # Remaining balances (extension fees not included in payment balance)
        interest_balance = max(0, total_interest_due - interest_paid)
        overdue_fee_balance = max(0, overdue_fee - overdue_fee_paid)
        extension_fees_balance = 0  # Extension fees handled separately
        principal_balance = max(0, loan_amount - principal_paid)
        
        # Status checks (defensive programming)
        try:
            # Ensure dates are timezone-aware for comparison
            maturity_date = transaction.maturity_date
            if maturity_date.tzinfo is None:
                maturity_date = maturity_date.replace(tzinfo=UTC)
            
            grace_period_end = transaction.grace_period_end
            if grace_period_end.tzinfo is None:
                grace_period_end = grace_period_end.replace(tzinfo=UTC)
            
            is_overdue = as_of_date > maturity_date
            is_in_grace_period = (
                as_of_date > maturity_date and 
                as_of_date <= grace_period_end
            )
            days_until_forfeiture = max(0, (grace_period_end - as_of_date).days)
        except (AttributeError, TypeError) as e:
            logger.warning(
                "Error calculating date status for transaction",
                transaction_id=transaction_id,
                error=str(e)
            )
            # Default to safe values
            is_overdue = False
            is_in_grace_period = False
            days_until_forfeiture = 0
        
        return BalanceResponse(
            transaction_id=transaction_id,
            as_of_date=as_of_date.date().isoformat(),

            # Main balance components
            loan_amount=loan_amount,
            monthly_interest=monthly_interest,
            total_due=total_due,
            total_paid=total_paid,
            current_balance=current_balance,

            # Payment allocation breakdown
            principal_due=loan_amount,
            interest_due=total_interest_due,
            extension_fees_due=total_extension_fees,
            overdue_fee_due=overdue_fee,
            principal_paid=principal_paid,
            interest_paid=interest_paid,
            extension_fees_paid=extension_fees_paid,
            overdue_fee_paid=overdue_fee_paid,
            principal_balance=principal_balance,
            interest_balance=interest_balance,
            extension_fees_balance=extension_fees_balance,
            overdue_fee_balance=overdue_fee_balance,

            # Transaction details
            payment_count=len(payments),
            status=transaction.status,

            # Date information
            pawn_date=transaction.pawn_date.date().isoformat() if transaction.pawn_date else None,
            maturity_date=maturity_date.date().isoformat() if maturity_date else None,
            grace_period_end=grace_period_end.date().isoformat() if grace_period_end else None,

            # Status flags
            is_overdue=is_overdue,
            is_in_grace_period=is_in_grace_period,
            days_until_forfeiture=days_until_forfeiture
        )