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
from app.schemas.payment_schema import (
    PaymentHistoryResponse, PaymentResponse, PaymentSummaryResponse,
    PaymentListResponse, PaymentValidationResponse
)
from app.core.utils import get_enum_value


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
    async def _get_balance_info(transaction_id: str) -> Dict[str, Any]:
        """Helper method to get balance info without circular import"""
        from app.services.pawn_transaction_service import PawnTransactionService
        return await PawnTransactionService.calculate_current_balance(transaction_id)
    
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
        balance_info = await PaymentService._get_balance_info(transaction_id)
        current_balance = balance_info["current_balance"]
        
        # Validate payment amount
        if payment_amount <= 0:
            raise PaymentValidationError("Payment amount must be greater than 0")
        
        if payment_amount > 50000:  # Business rule: max payment $50,000
            raise PaymentValidationError("Payment amount cannot exceed $50,000")
        
        # Allow overpayments but warn
        balance_after_payment = max(0, current_balance - payment_amount)
        is_overpayment = payment_amount > current_balance
        
        # Calculate payment allocation (priority: interest → extension fees → principal)
        interest_due = balance_info.get("interest_balance", 0)
        extension_fees_due = balance_info.get("extension_fees_balance", 0)
        principal_due = balance_info.get("principal_balance", 0)
        
        # 1. Apply payment to interest first
        interest_portion = min(payment_amount, interest_due)
        remaining_payment = payment_amount - interest_portion
        
        # 2. Apply remaining to extension fees
        extension_fees_portion = min(remaining_payment, extension_fees_due)
        remaining_payment -= extension_fees_portion
        
        # 3. Apply remaining to principal last
        principal_portion = min(remaining_payment, principal_due)
        
        # Create payment record
        payment = Payment(
            transaction_id=transaction_id,
            processed_by_user_id=processed_by_user_id,
            payment_amount=payment_amount,
            balance_before_payment=current_balance,
            balance_after_payment=balance_after_payment,
            principal_portion=principal_portion,
            interest_portion=interest_portion,
            extension_fees_portion=extension_fees_portion,
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
    async def get_payment_history(transaction_id: str) -> Dict[str, Any]:
        """
        Get comprehensive payment history for a transaction.
        
        Args:
            transaction_id: Transaction identifier
            
        Returns:
            Dictionary containing payment history and summary
            
        Raises:
            TransactionNotFoundError: Transaction not found
        """
        # Verify transaction exists
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        # Get all non-voided payments
        payments = await Payment.find(
            Payment.transaction_id == transaction_id,
            Payment.is_voided != True  # Exclude voided payments
        ).sort(-Payment.payment_date).to_list()
        
        # Convert to response format
        payment_responses = []
        for payment in payments:
            payment_dict = payment.model_dump()
            # Ensure payment_type is included
            if 'payment_type' not in payment_dict:
                payment_dict['payment_type'] = payment.payment_type
            payment_responses.append(PaymentResponse.model_validate(payment_dict))
        
        # Calculate totals
        total_paid = sum(payment.payment_amount for payment in payments)
        
        # Get current balance
        balance_info = await PaymentService._get_balance_info(transaction_id)
        
        # Create payment summary
        
        # Calculate last payment date
        last_payment_date = payments[0].payment_date if payments else None
        
        # Create payment summary
        payment_summary = PaymentSummaryResponse(
            transaction_id=transaction_id,
            total_payments=total_paid,
            payment_count=len(payments),
            last_payment_date=last_payment_date,
            total_principal_paid=balance_info.get("principal_paid", 0),
            total_interest_paid=balance_info.get("interest_paid", 0),
            total_extension_fees_paid=balance_info.get("extension_fees_paid", 0),
            current_balance=balance_info.get("current_balance", 0),
            principal_balance=balance_info.get("principal_balance", 0),
            interest_balance=balance_info.get("interest_balance", 0),
            extension_fees_balance=balance_info.get("extension_fees_balance", 0)
        )
        
        # Create transaction details (ensure dates are timezone-aware)
        pawn_date = transaction.pawn_date
        if pawn_date.tzinfo is None:
            pawn_date = pawn_date.replace(tzinfo=UTC)
        
        maturity_date = transaction.maturity_date  
        if maturity_date.tzinfo is None:
            maturity_date = maturity_date.replace(tzinfo=UTC)
        
        transaction_details = {
            "transaction_id": transaction_id,
            "status": get_enum_value(transaction.status),
            "loan_amount": transaction.loan_amount,
            "pawn_date": pawn_date.isoformat(),
            "maturity_date": maturity_date.isoformat()
        }
        
        return PaymentHistoryResponse(
            transaction_id=transaction_id,
            payments=payment_responses,
            summary=payment_summary,
            transaction_details=transaction_details
        )
    
    @staticmethod
    async def get_payment_summary(transaction_id: str) -> 'PaymentSummaryResponse':
        """
        Get payment summary for a transaction.
        
        Args:
            transaction_id: Transaction identifier
            
        Returns:
            PaymentSummaryResponse with payment totals and breakdown
            
        Raises:
            TransactionNotFoundError: Transaction not found
        """
        # Verify transaction exists
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        if not transaction:
            raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
        
        # Get all non-voided payments
        payments = await Payment.find(
            Payment.transaction_id == transaction_id,
            Payment.is_voided != True  # Exclude voided payments
        ).sort(-Payment.payment_date).to_list()
        
        # Calculate totals
        total_payments = sum(payment.payment_amount for payment in payments)
        total_principal_paid = sum(payment.principal_portion for payment in payments)
        total_interest_paid = sum(payment.interest_portion for payment in payments)
        total_extension_fees_paid = sum(getattr(payment, 'extension_fees_portion', 0) for payment in payments)
        
        # Get current balance info
        balance_info = await PaymentService._get_balance_info(transaction_id)
        
        # Calculate last payment date
        last_payment_date = payments[0].payment_date if payments else None
        
        return PaymentSummaryResponse(
            transaction_id=transaction_id,
            total_payments=total_payments,
            payment_count=len(payments),
            last_payment_date=last_payment_date,
            total_principal_paid=total_principal_paid,
            total_interest_paid=total_interest_paid,
            total_extension_fees_paid=total_extension_fees_paid,
            current_balance=balance_info.get("current_balance", 0),
            principal_balance=balance_info.get("principal_balance", 0),
            interest_balance=balance_info.get("interest_balance", 0),
            extension_fees_balance=balance_info.get("extension_fees_balance", 0)
        )
    
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
        query = Payment.find(
            Payment.transaction_id == transaction_id,
            Payment.is_voided != True  # Exclude voided payments
        ).sort(-Payment.payment_date)
        
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
        balance_info = await PaymentService._get_balance_info(transaction_id)
        current_balance = balance_info["current_balance"]
        
        # Calculate projected balance
        projected_balance = max(0, current_balance - payment_amount)
        is_overpayment = payment_amount > current_balance
        will_be_paid_off = projected_balance == 0
        
        # Calculate payment breakdown (priority: interest → extension fees → principal)
        interest_balance = balance_info["interest_balance"]
        extension_fees_balance = balance_info.get("extension_fees_balance", 0)
        principal_balance = balance_info["principal_balance"]
        
        # Apply payment with proper priority
        interest_payment = min(payment_amount, interest_balance)
        remaining_after_interest = payment_amount - interest_payment
        
        extension_fees_payment = min(remaining_after_interest, extension_fees_balance)
        remaining_after_extensions = remaining_after_interest - extension_fees_payment
        
        principal_payment = min(remaining_after_extensions, principal_balance)
        
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
                "extension_fees_payment": extension_fees_payment,
                "principal_payment": principal_payment,
                "interest_balance_after": max(0, interest_balance - interest_payment),
                "extension_fees_balance_after": max(0, extension_fees_balance - extension_fees_payment),
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
    
    @staticmethod
    async def void_payment(
        payment_id: str,
        voided_by_user_id: str,
        void_reason: Optional[str] = None
    ) -> Payment:
        """
        Void a payment (reverses payment and restores balance).
        
        Args:
            payment_id: Unique payment identifier
            voided_by_user_id: User ID who is voiding the payment
            void_reason: Optional reason for voiding
            
        Returns:
            Payment: The voided payment record
            
        Raises:
            PaymentError: Payment not found or cannot be voided
            StaffValidationError: Staff user not found or insufficient permissions
        """
        # Validate payment exists
        payment = await Payment.find_one(Payment.payment_id == payment_id)
        if not payment:
            raise PaymentError(f"Payment {payment_id} not found")
        
        # Check if payment is already voided
        if payment.is_voided:
            raise PaymentError(f"Payment {payment_id} is already voided")
        
        # Validate staff user
        staff_user = await User.find_one(User.user_id == voided_by_user_id)
        if not staff_user:
            raise StaffValidationError(f"Staff user {voided_by_user_id} not found")
        
        if staff_user.status != UserStatus.ACTIVE:
            raise StaffValidationError(
                f"Staff user {staff_user.first_name} {staff_user.last_name} is not active"
            )
        
        # Get transaction to check current status
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == payment.transaction_id
        )
        if not transaction:
            raise PaymentError(f"Transaction {payment.transaction_id} not found")
        
        # Business rule: Cannot void payments on sold transactions
        if transaction.status == TransactionStatus.SOLD:
            raise PaymentError("Cannot void payments on sold transactions")
        
        # Check if this was the payment that marked the transaction as redeemed
        was_redemption_payment = (
            transaction.status == TransactionStatus.REDEEMED and 
            payment.balance_after_payment == 0
        )
        
        # Void the payment
        payment.void_payment(voided_by_user_id, void_reason)
        await payment.save()
        
        # If this payment caused redemption, revert transaction status
        if was_redemption_payment:
            from app.services.pawn_transaction_service import PawnTransactionService
            
            # Calculate new status based on current date and balance
            balance_info = await PawnTransactionService.calculate_current_balance(
                payment.transaction_id
            )
            
            # Since we voided a payment, the balance is now positive again  
            new_balance = balance_info.get("current_balance", 0) + payment.payment_amount
            
            # Determine appropriate status
            import datetime
            current_date = datetime.datetime.now(datetime.UTC)
            
            # Ensure dates are timezone-aware
            grace_period_end = transaction.grace_period_end
            if grace_period_end.tzinfo is None:
                grace_period_end = grace_period_end.replace(tzinfo=datetime.UTC)
            
            maturity_date = transaction.maturity_date
            if maturity_date.tzinfo is None:
                maturity_date = maturity_date.replace(tzinfo=datetime.UTC)
            
            if current_date <= grace_period_end:
                # Still within grace period
                if current_date <= maturity_date:
                    new_status = TransactionStatus.ACTIVE
                else:
                    new_status = TransactionStatus.OVERDUE
            else:
                # Past grace period, should be forfeited but we'll mark as overdue
                # since the payment void might be correcting an error
                new_status = TransactionStatus.OVERDUE
            
            await PawnTransactionService.update_transaction_status(
                transaction_id=payment.transaction_id,
                new_status=new_status,
                updated_by_user_id=voided_by_user_id,
                notes=f"Status reverted due to payment {payment_id} being voided. New balance: ${new_balance}"
            )
        
        return payment
    
    @staticmethod
    async def validate_payment_request(
        transaction_id: str,
        payment_amount: int
    ) -> 'PaymentValidationResponse':
        """
        Validate payment request and return validation response.
        
        Args:
            transaction_id: Transaction identifier
            payment_amount: Proposed payment amount
            
        Returns:
            PaymentValidationResponse with validation results
            
        Raises:
            TransactionNotFoundError: Transaction not found
            PaymentValidationError: Invalid payment parameters
        """
        try:
            validation_data = await PaymentService.validate_payment_amount(
                transaction_id=transaction_id,
                payment_amount=payment_amount
            )
            
            return PaymentValidationResponse(
                is_valid=validation_data["is_valid"],
                validation_errors=list(filter(None, validation_data.get("warnings", []))),
                current_balance=validation_data["current_balance"],
                new_balance=validation_data["projected_balance"],
                principal_allocation=validation_data["payment_breakdown"]["principal_payment"],
                interest_allocation=validation_data["payment_breakdown"]["interest_payment"],
                will_be_paid_off=validation_data["will_be_paid_off"],
                recommended_amount=validation_data["current_balance"] if validation_data["current_balance"] > 0 else None
            )
            
        except (TransactionNotFoundError, PaymentValidationError):
            raise
        except Exception as e:
            raise PaymentValidationError(f"Validation failed: {str(e)}")
    
    @staticmethod
    async def get_payments_list(
        transaction_id: Optional[str] = None,
        processed_by: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        min_amount: Optional[int] = None,
        max_amount: Optional[int] = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "payment_date",
        sort_order: str = "desc"
    ) -> 'PaymentListResponse':
        """
        Get paginated list of payments with optional filtering.
        
        Returns:
            PaymentListResponse with paginated payment data
        """
        # Build query filters
        query_filters = []
        
        if transaction_id:
            query_filters.append(Payment.transaction_id == transaction_id)
        
        if processed_by:
            query_filters.append(Payment.processed_by_user_id == processed_by)
        
        if start_date:
            query_filters.append(Payment.payment_date >= start_date)
        
        if end_date:
            query_filters.append(Payment.payment_date <= end_date)
        
        if min_amount is not None:
            query_filters.append(Payment.payment_amount >= min_amount)
        
        if max_amount is not None:
            query_filters.append(Payment.payment_amount <= max_amount)
        
        # Build base query
        if query_filters:
            query = Payment.find(*query_filters)
        else:
            query = Payment.find()
        
        # Apply sorting
        sort_field = getattr(Payment, sort_by, Payment.payment_date)
        if sort_order.lower() == "asc":
            query = query.sort(sort_field)
        else:
            query = query.sort(-sort_field)
        
        # Get total count
        total_count = await query.count()
        
        # Apply pagination
        skip = (page - 1) * page_size
        payments = await query.skip(skip).limit(page_size).to_list()
        
        # Convert to response format
        payment_responses = []
        for payment in payments:
            payment_dict = payment.model_dump()
            # Ensure backward compatibility
            if 'principal_portion' not in payment_dict:
                payment_dict['principal_portion'] = 0
            if 'interest_portion' not in payment_dict:
                payment_dict['interest_portion'] = 0
            if 'payment_type' not in payment_dict:
                payment_dict['payment_type'] = payment_dict.get('payment_method', 'cash')
            
            payment_responses.append(PaymentResponse.model_validate(payment_dict))
        
        return PaymentListResponse(
            payments=payment_responses,
            total_count=total_count,
            page=page,
            page_size=page_size,
            has_next=skip + page_size < total_count
        )