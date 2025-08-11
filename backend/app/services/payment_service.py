"""
PaymentService

Business logic for processing cash payments on pawn transactions. Handles payment
validation, balance calculations, automatic status updates, and complete audit trails.
"""

# Standard library imports
from datetime import datetime, UTC
from typing import List, Optional, Dict, Any

# Local imports
from app.models.payment_model import Payment
from app.models.pawn_transaction_model import PawnTransaction, TransactionStatus
from app.models.user_model import User, UserStatus


class PaymentError(Exception):
    """Base exception for payment processing operations"""
    pass


class PaymentValidationError(PaymentError):
    """Payment validation related errors"""
    pass


class TransactionNotFoundError(PaymentError):
    """Transaction not found error"""
    pass


class StaffValidationError(PaymentError):
    """Staff user validation error"""
    pass


class PaymentService:
    """
    Service class for payment processing business logic.
    
    Handles cash payment processing, balance calculations, payment validation,
    audit trails, and automatic status updates for pawn transactions.
    """
    
    @staticmethod
    async def process_payment(
        transaction_id: str,
        payment_amount: int,
        processed_by_user_id: str,
        receipt_number: Optional[str] = None,
        internal_notes: Optional[str] = None
    ) -> Payment:
        """
        Process a cash payment on a pawn transaction.
        
        Args:
            transaction_id: Transaction to make payment on
            payment_amount: Amount paid in whole dollars (cash only)
            processed_by_user_id: Staff member processing payment
            receipt_number: Optional receipt number for tracking
            internal_notes: Optional internal notes about the payment
            
        Returns:
            Payment: Created payment record with updated balances
            
        Raises:
            TransactionNotFoundError: Transaction not found or cannot accept payments
            StaffValidationError: Staff user not found or insufficient permissions
            PaymentValidationError: Invalid payment amount or validation failed
        """
        # Validate transaction exists and can accept payments
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        # Check if transaction can accept payments
        if transaction.status in [TransactionStatus.SOLD, TransactionStatus.REDEEMED]:
            raise PaymentValidationError(
                f"Cannot process payment on {transaction.status} transaction"
            )
        
        # Validate staff user
        staff_user = await User.find_one(User.user_id == processed_by_user_id)
        if not staff_user:
            raise StaffValidationError(f"Staff user {processed_by_user_id} not found")
        
        if staff_user.status != UserStatus.ACTIVE:
            raise StaffValidationError(
                f"Staff user {staff_user.first_name} {staff_user.last_name} is not active"
            )
        
        # Calculate current balance
        from app.services.pawn_transaction_service import PawnTransactionService
        balance_info = await PawnTransactionService.calculate_current_balance(transaction_id)
        current_balance = balance_info["current_balance"]
        
        # Validate payment amount
        if payment_amount <= 0:
            raise PaymentValidationError("Payment amount must be greater than 0")
        
        if payment_amount > 50000:  # Business rule: max payment $50,000
            raise PaymentValidationError("Payment amount cannot exceed $50,000")
        
        # Allow overpayments but warn
        balance_after_payment = max(0, current_balance - payment_amount)
        is_overpayment = payment_amount > current_balance
        
        # Create payment record
        payment = Payment(
            transaction_id=transaction_id,
            processed_by_user_id=processed_by_user_id,
            payment_amount=payment_amount,
            balance_before_payment=current_balance,
            balance_after_payment=balance_after_payment,
            payment_method="cash",
            receipt_number=receipt_number,
            internal_notes=internal_notes
        )
        
        # Save payment (this will validate payment math)
        await payment.save()
        
        # Update transaction status if fully paid
        if balance_after_payment == 0:
            await PawnTransactionService.update_transaction_status(
                transaction_id=transaction_id,
                new_status=TransactionStatus.REDEEMED,
                updated_by_user_id=processed_by_user_id,
                notes=f"Transaction fully paid with payment {payment.payment_id}"
            )
        
        return payment
    
    @staticmethod
    async def get_transaction_payments(
        transaction_id: str,
        limit: Optional[int] = None
    ) -> List[Payment]:
        """
        Get all payments for a transaction, newest first.
        
        Args:
            transaction_id: Transaction identifier
            limit: Optional limit on number of payments returned
            
        Returns:
            List of Payment objects ordered by payment date (newest first)
        """
        query = Payment.find(Payment.transaction_id == transaction_id).sort(-Payment.payment_date)
        
        if limit:
            query = query.limit(limit)
            
        return await query.to_list()
    
    @staticmethod
    async def get_total_payments(transaction_id: str) -> int:
        """
        Get total amount of all payments made on a transaction.
        
        Args:
            transaction_id: Transaction identifier
            
        Returns:
            Total payment amount in whole dollars
        """
        payments = await PaymentService.get_transaction_payments(transaction_id)
        return sum(payment.payment_amount for payment in payments)
    
    @staticmethod
    async def get_payment_by_id(payment_id: str) -> Optional[Payment]:
        """
        Retrieve payment by payment ID.
        
        Args:
            payment_id: Unique payment identifier
            
        Returns:
            Payment if found, None otherwise
        """
        return await Payment.find_one(Payment.payment_id == payment_id)
    
    @staticmethod
    async def get_payments_by_staff(
        staff_user_id: str,
        limit: int = 100,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Payment]:
        """
        Get payments processed by a specific staff member.
        
        Args:
            staff_user_id: Staff user identifier
            limit: Maximum number of payments to return
            start_date: Optional start date filter
            end_date: Optional end date filter
            
        Returns:
            List of Payment objects
        """
        query = Payment.find(Payment.processed_by_user_id == staff_user_id)
        
        if start_date:
            query = query.find(Payment.payment_date >= start_date)
        
        if end_date:
            query = query.find(Payment.payment_date <= end_date)
        
        return await query.sort(-Payment.payment_date).limit(limit).to_list()
    
    @staticmethod
    async def get_payment_history_summary(transaction_id: str) -> Dict[str, Any]:
        """
        Get comprehensive payment history summary for a transaction.
        
        Args:
            transaction_id: Transaction identifier
            
        Returns:
            Dictionary with payment history details
            
        Raises:
            TransactionNotFoundError: Transaction not found
        """
        # Validate transaction exists
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        payments = await PaymentService.get_transaction_payments(transaction_id)
        
        if not payments:
            return {
                "transaction_id": transaction_id,
                "total_payments": 0,
                "payment_count": 0,
                "last_payment_date": None,
                "first_payment_date": None,
                "average_payment_amount": 0,
                "payments": []
            }
        
        # Create payment details
        payment_details = []
        for payment in payments:
            payment_details.append({
                "payment_id": payment.payment_id,
                "amount": payment.payment_amount,
                "amount_formatted": payment.payment_amount_dollars,
                "payment_date": payment.payment_date.isoformat(),
                "balance_before": payment.balance_before_payment,
                "balance_after": payment.balance_after_payment,
                "balance_after_formatted": payment.balance_after_dollars,
                "processed_by": payment.processed_by_user_id,
                "receipt_number": payment.receipt_number,
                "internal_notes": payment.internal_notes,
                "created_at": payment.created_at.isoformat()
            })
        
        total_payments = sum(p.payment_amount for p in payments)
        
        return {
            "transaction_id": transaction_id,
            "total_payments": total_payments,
            "total_payments_formatted": f"${total_payments:,}",
            "payment_count": len(payments),
            "last_payment_date": payments[0].payment_date.isoformat(),  # Newest first
            "first_payment_date": payments[-1].payment_date.isoformat(),  # Oldest last
            "average_payment_amount": total_payments // len(payments) if payments else 0,
            "payments": payment_details
        }
    
    @staticmethod
    async def validate_payment_amount(
        transaction_id: str,
        payment_amount: int
    ) -> Dict[str, Any]:
        """
        Validate payment amount and return payment preview.
        
        Args:
            transaction_id: Transaction identifier
            payment_amount: Proposed payment amount
            
        Returns:
            Dictionary with payment validation results and preview
            
        Raises:
            TransactionNotFoundError: Transaction not found
            PaymentValidationError: Invalid payment parameters
        """
        # Validate transaction exists
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        # Check if transaction can accept payments
        if transaction.status in [TransactionStatus.SOLD, TransactionStatus.REDEEMED]:
            raise PaymentValidationError(
                f"Cannot process payment on {transaction.status} transaction"
            )
        
        # Validate payment amount
        if payment_amount <= 0:
            raise PaymentValidationError("Payment amount must be greater than 0")
        
        if payment_amount > 50000:
            raise PaymentValidationError("Payment amount cannot exceed $50,000")
        
        # Get current balance
        from app.services.pawn_transaction_service import PawnTransactionService
        balance_info = await PawnTransactionService.calculate_current_balance(transaction_id)
        current_balance = balance_info["current_balance"]
        
        # Calculate projected balance
        projected_balance = max(0, current_balance - payment_amount)
        is_overpayment = payment_amount > current_balance
        will_be_paid_off = projected_balance == 0
        
        # Calculate payment breakdown (interest first, then principal)
        interest_balance = balance_info["interest_balance"]
        principal_balance = balance_info["principal_balance"]
        
        interest_payment = min(payment_amount, interest_balance)
        principal_payment = max(0, payment_amount - interest_payment)
        
        return {
            "transaction_id": transaction_id,
            "current_balance": current_balance,
            "current_balance_formatted": f"${current_balance:,}",
            "payment_amount": payment_amount,
            "payment_amount_formatted": f"${payment_amount:,}",
            "projected_balance": projected_balance,
            "projected_balance_formatted": f"${projected_balance:,}",
            "is_overpayment": is_overpayment,
            "will_be_paid_off": will_be_paid_off,
            "overpayment_amount": payment_amount - current_balance if is_overpayment else 0,
            "payment_breakdown": {
                "interest_payment": interest_payment,
                "principal_payment": principal_payment,
                "interest_balance_after": max(0, interest_balance - interest_payment),
                "principal_balance_after": max(0, principal_balance - principal_payment)
            },
            "status_after_payment": "redeemed" if will_be_paid_off else transaction.status,
            "warnings": [
                "Payment exceeds current balance" if is_overpayment else None,
                "Transaction will be marked as redeemed" if will_be_paid_off else None
            ],
            "is_valid": True,
            "can_process": True
        }
    
    @staticmethod
    async def get_daily_payment_summary(
        date: datetime,
        staff_user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get daily payment summary for cash reporting.
        
        Args:
            date: Date to get summary for
            staff_user_id: Optional filter by staff member
            
        Returns:
            Dictionary with daily payment summary
        """
        # Set date range for the entire day
        start_date = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Build query
        query = Payment.find(
            Payment.payment_date >= start_date,
            Payment.payment_date <= end_date
        )
        
        if staff_user_id:
            query = query.find(Payment.processed_by_user_id == staff_user_id)
        
        payments = await query.sort(Payment.payment_date).to_list()
        
        if not payments:
            return {
                "date": date.strftime("%Y-%m-%d"),
                "staff_user_id": staff_user_id,
                "total_payments": 0,
                "payment_count": 0,
                "total_cash_collected": 0,
                "average_payment": 0,
                "staff_breakdown": {},
                "payments": []
            }
        
        # Calculate totals
        total_cash = sum(p.payment_amount for p in payments)
        payment_count = len(payments)
        
        # Staff breakdown
        staff_breakdown = {}
        for payment in payments:
            staff_id = payment.processed_by_user_id
            if staff_id not in staff_breakdown:
                staff_breakdown[staff_id] = {
                    "payment_count": 0,
                    "total_amount": 0
                }
            staff_breakdown[staff_id]["payment_count"] += 1
            staff_breakdown[staff_id]["total_amount"] += payment.payment_amount
        
        # Payment details
        payment_details = [
            {
                "payment_id": p.payment_id,
                "transaction_id": p.transaction_id,
                "amount": p.payment_amount,
                "payment_date": p.payment_date.isoformat(),
                "processed_by": p.processed_by_user_id,
                "receipt_number": p.receipt_number
            }
            for p in payments
        ]
        
        return {
            "date": date.strftime("%Y-%m-%d"),
            "staff_user_id": staff_user_id,
            "total_payments": payment_count,
            "total_cash_collected": total_cash,
            "total_cash_formatted": f"${total_cash:,}",
            "average_payment": total_cash // payment_count if payment_count > 0 else 0,
            "staff_breakdown": staff_breakdown,
            "payments": payment_details
        }