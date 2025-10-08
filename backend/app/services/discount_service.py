"""
Discount Service

Business logic for payment discount approval system.
Handles admin authorization, validation, and interest-first allocation.
"""

import structlog
from datetime import datetime, UTC
from typing import Optional, Dict, Any
from app.models.payment_model import Payment
from app.models.pawn_transaction_model import PawnTransaction, TransactionStatus
from app.models.user_model import User
from app.core.exceptions import BusinessRuleError, ValidationError, AuthenticationError

logger = structlog.get_logger(__name__)


class DiscountService:
    """Service for handling payment discount approvals"""

    @classmethod
    async def validate_discount(
        cls,
        transaction_id: str,
        payment_amount: int,
        discount_amount: int,
        current_user: User
    ) -> Dict[str, Any]:
        """
        Validate if discount can be applied to payment.

        Args:
            transaction_id: Transaction to apply discount to
            payment_amount: Cash payment amount
            discount_amount: Proposed discount amount
            current_user: User requesting validation

        Returns:
            Dict with validation results and payment breakdown

        Raises:
            ValidationError: If validation fails
            BusinessRuleError: If business rules violated
        """
        # Get transaction
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise ValidationError(f"Transaction {transaction_id} not found")

        # Get balance info
        from app.services.pawn_transaction_service import PawnTransactionService
        balance_info = await PawnTransactionService.calculate_current_balance(transaction_id)
        current_balance = balance_info["current_balance"]

        effective_payment = payment_amount + discount_amount
        is_final_payment = effective_payment >= current_balance

        # Base response dict for validation failures (performance optimization)
        base_response = {
            "is_valid": False,
            "transaction_id": transaction_id,
            "current_balance": current_balance,
            "is_final_payment": is_final_payment,
            "discount_amount": discount_amount,
            "discount_on_interest": 0,
            "discount_on_principal": 0,
            "cash_payment": payment_amount,
            "effective_payment": effective_payment
        }

        # Rule 1: Discount only allowed for final payments (redemption)
        if not is_final_payment:
            return {
                **base_response,
                "is_final_payment": False,
                "reason": "Discounts can only be applied to final redemption payments",
                "new_balance": current_balance - effective_payment
            }

        # Rule 2: Discount cannot exceed balance
        if discount_amount > current_balance:
            return {
                **base_response,
                "reason": f"Discount ${discount_amount} exceeds balance ${current_balance}",
                "new_balance": 0
            }

        # Rule 3: Transaction must be active/overdue/extended (not redeemed/sold/forfeited)
        valid_statuses = [TransactionStatus.ACTIVE, TransactionStatus.OVERDUE, TransactionStatus.EXTENDED]
        if transaction.status not in valid_statuses:
            return {
                **base_response,
                "reason": f"Cannot apply discount to transaction with status: {transaction.status}",
                "new_balance": 0
            }

        # Calculate discount allocation (interest first!)
        interest_balance = balance_info.get("interest_balance", 0)
        principal_balance = balance_info.get("principal_balance", 0)

        # Apply discount to interest first
        discount_on_interest = min(discount_amount, interest_balance)
        remaining_discount = discount_amount - discount_on_interest
        discount_on_principal = min(remaining_discount, principal_balance)

        logger.info(
            "Discount validation passed",
            transaction_id=transaction_id,
            payment_amount=payment_amount,
            discount_amount=discount_amount,
            discount_on_interest=discount_on_interest,
            discount_on_principal=discount_on_principal,
            effective_payment=effective_payment,
            validated_by=current_user.user_id
        )

        return {
            "is_valid": True,
            "reason": None,
            "transaction_id": transaction_id,
            "current_balance": current_balance,
            "is_final_payment": is_final_payment,
            "discount_amount": discount_amount,
            "discount_on_interest": discount_on_interest,
            "discount_on_principal": discount_on_principal,
            "cash_payment": payment_amount,
            "effective_payment": effective_payment,
            "new_balance": max(0, current_balance - effective_payment)
        }

    @classmethod
    async def verify_admin_approval(
        cls,
        admin_user: User,
        admin_pin: str,
        discount_amount: int,
        discount_reason: str
    ) -> None:
        """
        Verify admin PIN and authorization for discount.

        Args:
            admin_user: Admin user approving discount
            admin_pin: Admin PIN for verification
            discount_amount: Discount amount
            discount_reason: Reason for discount

        Raises:
            AuthenticationError: If admin verification fails
            BusinessRuleError: If business rules violated
        """
        # Verify admin role
        if admin_user.role != "admin":
            raise AuthenticationError("Only administrators can approve discounts")

        # Verify admin PIN
        if not admin_user.verify_pin(admin_pin):
            logger.warning(
                "Invalid admin PIN for discount approval",
                admin_user_id=admin_user.user_id,
                discount_amount=discount_amount
            )
            raise AuthenticationError("Invalid admin PIN")

        # Verify discount reason provided
        if not discount_reason or not discount_reason.strip():
            raise BusinessRuleError("Discount reason is required")

        logger.info(
            "Admin discount approval verified",
            admin_user_id=admin_user.user_id,
            discount_amount=discount_amount,
            discount_reason=discount_reason
        )

    @classmethod
    async def get_daily_discount_report(
        cls,
        report_date: datetime,
        admin_user: User
    ) -> Dict[str, Any]:
        """
        Generate daily discount report.

        Args:
            report_date: Date for report
            admin_user: Admin user requesting report

        Returns:
            Dict with discount summary
        """
        if admin_user.role != "admin":
            raise AuthenticationError("Only administrators can view discount reports")

        # Set date range for the entire day
        start_date = report_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = report_date.replace(hour=23, minute=59, second=59, microsecond=999999)

        # Find all payments with discounts for the day
        payments = await Payment.find(
            Payment.payment_date >= start_date,
            Payment.payment_date <= end_date,
            Payment.discount_amount > 0
        ).to_list()

        if not payments:
            return {
                "report_date": report_date,
                "total_discounts_given": 0,
                "total_discount_amount": 0,
                "average_discount": 0,
                "discounts_by_staff": {}
            }

        # Calculate totals
        total_discount_amount = sum(p.discount_amount for p in payments)
        total_discounts = len(payments)

        # Breakdown by staff
        discounts_by_staff = {}
        for payment in payments:
            staff_id = payment.processed_by_user_id
            if staff_id not in discounts_by_staff:
                discounts_by_staff[staff_id] = {
                    "count": 0,
                    "total": 0,
                    "approved_by": payment.discount_approved_by
                }
            discounts_by_staff[staff_id]["count"] += 1
            discounts_by_staff[staff_id]["total"] += payment.discount_amount

        return {
            "report_date": report_date,
            "total_discounts_given": total_discounts,
            "total_discount_amount": total_discount_amount,
            "average_discount": total_discount_amount // total_discounts if total_discounts > 0 else 0,
            "discounts_by_staff": discounts_by_staff
        }
