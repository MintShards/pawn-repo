"""
PawnTransactionService

Business logic for core pawn transaction operations including transaction creation,
balance calculations, status updates, and transaction management.
"""

# Standard library imports
from datetime import datetime, UTC
from typing import List, Optional, Dict, Any

# Third-party imports
from beanie.operators import In

# Local imports
from app.models.pawn_transaction_model import PawnTransaction, TransactionStatus
from app.models.pawn_item_model import PawnItem
from app.models.payment_model import Payment
from app.models.extension_model import Extension
from app.models.customer_model import Customer, CustomerStatus
from app.models.user_model import User, UserStatus


class PawnTransactionError(Exception):
    """Base exception for pawn transaction operations"""
    pass


class CustomerValidationError(PawnTransactionError):
    """Customer validation related errors"""
    pass


class StaffValidationError(PawnTransactionError):
    """Staff/user validation related errors"""
    pass


class TransactionStateError(PawnTransactionError):
    """Transaction state related errors"""
    pass


class PawnTransactionService:
    """
    Service class for pawn transaction business logic.
    
    Handles transaction creation, retrieval, balance calculations,
    status updates, and validation according to business rules.
    """
    
    @staticmethod
    async def create_transaction(
        customer_phone: str,
        created_by_user_id: str,
        loan_amount: int,
        monthly_interest_amount: int,
        storage_location: str,
        items: List[Dict[str, Any]],
        internal_notes: Optional[str] = None
    ) -> PawnTransaction:
        """
        Create a new pawn transaction with multiple items.
        
        Args:
            customer_phone: Customer's phone number (identifier)
            created_by_user_id: User ID of staff member creating transaction
            loan_amount: Loan amount in whole dollars (integer)
            monthly_interest_amount: Monthly interest fee in whole dollars
            storage_location: Physical storage location (e.g., 'Shelf A-5')
            items: List of item dictionaries with description and optional serial_number
            internal_notes: Optional staff notes
            
        Returns:
            Created PawnTransaction with associated items
            
        Raises:
            CustomerValidationError: Customer not found or cannot transact
            StaffValidationError: Staff user not found or insufficient permissions
            PawnTransactionError: Transaction creation failed
        """
        # Validate customer exists and can transact
        customer = await Customer.find_one(Customer.phone_number == customer_phone)
        if not customer:
            raise CustomerValidationError(f"Customer with phone {customer_phone} not found")
        
        if not customer.can_transact:
            raise CustomerValidationError(
                f"Customer {customer.full_name} cannot transact (status: {customer.status})"
            )
        
        # Validate staff user exists and is active
        staff_user = await User.find_one(User.user_id == created_by_user_id)
        if not staff_user:
            raise StaffValidationError(f"Staff user {created_by_user_id} not found")
        
        if staff_user.status != UserStatus.ACTIVE:
            raise StaffValidationError(
                f"Staff user {staff_user.first_name} {staff_user.last_name} is not active"
            )
        
        # Validate items list
        if not items or len(items) == 0:
            raise PawnTransactionError("At least one item must be provided for pawn transaction")
        
        if len(items) > 20:  # Business rule: max 20 items per transaction
            raise PawnTransactionError("Maximum 20 items allowed per transaction")
        
        try:
            # Create the transaction
            transaction = PawnTransaction(
                customer_id=customer_phone,
                created_by_user_id=created_by_user_id,
                loan_amount=loan_amount,
                monthly_interest_amount=monthly_interest_amount,
                storage_location=storage_location,
                internal_notes=internal_notes
            )
            
            # Save transaction (this will calculate dates and total_due)
            await transaction.save()
            
            # Create associated items
            pawn_items = []
            for idx, item_data in enumerate(items, 1):
                pawn_item = PawnItem(
                    transaction_id=transaction.transaction_id,
                    item_number=idx,
                    description=item_data["description"],
                    serial_number=item_data.get("serial_number")
                )
                await pawn_item.save()
                pawn_items.append(pawn_item)
            
            # Update customer statistics
            customer.total_transactions += 1
            customer.active_loans += 1
            customer.total_loan_value += loan_amount
            customer.last_transaction_date = transaction.pawn_date
            await customer.save()
            
            return transaction
            
        except Exception as e:
            # If transaction creation fails, clean up any created items
            if 'transaction' in locals() and transaction.transaction_id:
                await PawnItem.find(
                    PawnItem.transaction_id == transaction.transaction_id
                ).delete()
            raise PawnTransactionError(f"Failed to create pawn transaction: {str(e)}")

    @staticmethod
    async def get_transaction_by_id(transaction_id: str) -> Optional[PawnTransaction]:
        """
        Retrieve transaction by transaction ID.
        
        Args:
            transaction_id: Unique transaction identifier
            
        Returns:
            PawnTransaction if found, None otherwise
        """
        return await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )

    @staticmethod
    async def get_transactions_by_customer(
        customer_phone: str,
        status: Optional[TransactionStatus] = None,
        limit: int = 50
    ) -> List[PawnTransaction]:
        """
        Retrieve transactions for a specific customer.
        
        Args:
            customer_phone: Customer's phone number
            status: Optional status filter
            limit: Maximum number of transactions to return (default: 50)
            
        Returns:
            List of PawnTransaction objects
        """
        query = PawnTransaction.find(PawnTransaction.customer_id == customer_phone)
        
        if status:
            query = query.find(PawnTransaction.status == status)
        
        return await query.sort(-PawnTransaction.pawn_date).limit(limit).to_list()

    @staticmethod
    async def get_transactions_by_status(
        status: TransactionStatus,
        limit: int = 100
    ) -> List[PawnTransaction]:
        """
        Retrieve transactions by status.
        
        Args:
            status: Transaction status to filter by
            limit: Maximum number of transactions to return (default: 100)
            
        Returns:
            List of PawnTransaction objects
        """
        return await PawnTransaction.find(
            PawnTransaction.status == status
        ).sort(-PawnTransaction.pawn_date).limit(limit).to_list()
    
    @staticmethod
    async def get_overdue_transactions() -> List[PawnTransaction]:
        """
        Retrieve all overdue transactions (past maturity date but within grace period).
        
        Returns:
            List of overdue PawnTransaction objects
        """
        current_date = datetime.now(UTC)
        
        return await PawnTransaction.find(
            In(PawnTransaction.status, [TransactionStatus.ACTIVE, TransactionStatus.EXTENDED]),
            PawnTransaction.maturity_date < current_date,
            PawnTransaction.grace_period_end > current_date
        ).to_list()
    
    @staticmethod
    async def get_forfeitable_transactions() -> List[PawnTransaction]:
        """
        Retrieve transactions that are past the grace period and ready for forfeiture.
        
        Returns:
            List of PawnTransaction objects ready for forfeiture
        """
        current_date = datetime.now(UTC)
        
        return await PawnTransaction.find(
            In(PawnTransaction.status, [TransactionStatus.ACTIVE, TransactionStatus.OVERDUE, TransactionStatus.EXTENDED]),
            PawnTransaction.grace_period_end < current_date
        ).to_list()
    
    @staticmethod
    async def calculate_current_balance(
        transaction_id: str,
        as_of_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Calculate current balance for a transaction including interest accrual.
        
        Args:
            transaction_id: Unique transaction identifier
            as_of_date: Date to calculate balance (defaults to current date)
            
        Returns:
            Dictionary with balance details
            
        Raises:
            PawnTransactionError: Transaction not found
        """
        transaction = await PawnTransactionService.get_transaction_by_id(transaction_id)
        if not transaction:
            raise PawnTransactionError(f"Transaction {transaction_id} not found")
        
        if as_of_date is None:
            as_of_date = datetime.now(UTC)
        
        # Get all payments for this transaction
        payments = await Payment.find(
            Payment.transaction_id == transaction_id
        ).sort(Payment.payment_date).to_list()
        
        # Calculate total due with interest accrual
        total_due = transaction.calculate_total_due(as_of_date)
        
        # Calculate total payments made
        total_paid = sum(payment.payment_amount for payment in payments)
        
        # Calculate current balance
        current_balance = total_due - total_paid
        
        # Calculate interest portion
        interest_due = transaction.monthly_interest_amount * max(1, min(3, 
            ((as_of_date.year - transaction.pawn_date.year) * 12 + 
             (as_of_date.month - transaction.pawn_date.month)) + 
            (1 if as_of_date.day > transaction.pawn_date.day else 0)
        ))
        
        principal_due = transaction.loan_amount
        interest_paid = 0
        principal_paid = 0
        
        # Calculate interest vs principal payments (interest paid first)
        remaining_payments = total_paid
        if remaining_payments > 0:
            interest_paid = min(remaining_payments, interest_due)
            remaining_payments -= interest_paid
            if remaining_payments > 0:
                principal_paid = min(remaining_payments, principal_due)
        
        return {
            "transaction_id": transaction_id,
            "as_of_date": as_of_date.isoformat(),
            "loan_amount": transaction.loan_amount,
            "monthly_interest": transaction.monthly_interest_amount,
            "total_due": total_due,
            "total_paid": total_paid,
            "current_balance": current_balance,
            "principal_due": principal_due,
            "interest_due": interest_due,
            "principal_paid": principal_paid,
            "interest_paid": interest_paid,
            "principal_balance": principal_due - principal_paid,
            "interest_balance": interest_due - interest_paid,
            "payment_count": len(payments),
            "status": transaction.status,
            "pawn_date": transaction.pawn_date.isoformat(),
            "maturity_date": transaction.maturity_date.isoformat(),
            "grace_period_end": transaction.grace_period_end.isoformat(),
            "is_overdue": as_of_date > transaction.maturity_date,
            "is_in_grace_period": transaction.maturity_date < as_of_date <= transaction.grace_period_end,
            "days_until_forfeiture": (transaction.grace_period_end - as_of_date).days if as_of_date < transaction.grace_period_end else 0
        }
    
    @staticmethod
    async def update_transaction_status(
        transaction_id: str,
        new_status: TransactionStatus,
        updated_by_user_id: str,
        notes: Optional[str] = None
    ) -> PawnTransaction:
        """
        Update transaction status with validation.
        
        Args:
            transaction_id: Unique transaction identifier
            new_status: New status to set
            updated_by_user_id: User ID making the update
            notes: Optional notes about the status change
            
        Returns:
            Updated PawnTransaction
            
        Raises:
            PawnTransactionError: Transaction not found or invalid status transition
            StaffValidationError: Staff user not found or insufficient permissions
        """
        # Validate staff user
        staff_user = await User.find_one(User.user_id == updated_by_user_id)
        if not staff_user or staff_user.status != UserStatus.ACTIVE:
            raise StaffValidationError(f"Staff user {updated_by_user_id} not found or inactive")
        
        # Get transaction
        transaction = await PawnTransactionService.get_transaction_by_id(transaction_id)
        if not transaction:
            raise PawnTransactionError(f"Transaction {transaction_id} not found")
        
        # Validate status transition
        old_status = transaction.status
        
        # Business rules for status transitions
        valid_transitions = {
            TransactionStatus.ACTIVE: [
                TransactionStatus.OVERDUE, TransactionStatus.EXTENDED, 
                TransactionStatus.REDEEMED, TransactionStatus.HOLD
            ],
            TransactionStatus.OVERDUE: [
                TransactionStatus.EXTENDED, TransactionStatus.REDEEMED, 
                TransactionStatus.FORFEITED, TransactionStatus.HOLD
            ],
            TransactionStatus.EXTENDED: [
                TransactionStatus.OVERDUE, TransactionStatus.REDEEMED, 
                TransactionStatus.FORFEITED, TransactionStatus.HOLD
            ],
            TransactionStatus.HOLD: [
                TransactionStatus.ACTIVE, TransactionStatus.OVERDUE, 
                TransactionStatus.EXTENDED, TransactionStatus.DAMAGED
            ],
            TransactionStatus.DAMAGED: [
                TransactionStatus.FORFEITED, TransactionStatus.SOLD
            ],
            # Terminal states - no transitions allowed
            TransactionStatus.REDEEMED: [],
            TransactionStatus.FORFEITED: [TransactionStatus.SOLD],
            TransactionStatus.SOLD: []
        }
        
        if new_status not in valid_transitions.get(old_status, []):
            raise TransactionStateError(
                f"Invalid status transition from {old_status} to {new_status}"
            )
        
        # Update transaction
        transaction.status = new_status
        if notes:
            current_notes = transaction.internal_notes or ""
            transaction.internal_notes = f"{current_notes}\n[{datetime.now(UTC).isoformat()}] Status changed to {new_status} by {staff_user.first_name} {staff_user.last_name}: {notes}".strip()
        
        await transaction.save()
        
        # Update customer statistics for terminal states
        if new_status in [TransactionStatus.REDEEMED, TransactionStatus.FORFEITED, TransactionStatus.SOLD]:
            customer = await Customer.find_one(Customer.phone_number == transaction.customer_id)
            if customer and customer.active_loans > 0:
                customer.active_loans -= 1
                customer.total_loan_value = max(0, customer.total_loan_value - transaction.loan_amount)
                await customer.save()
        
        return transaction
    
    @staticmethod
    async def bulk_update_statuses() -> Dict[str, int]:
        """
        Bulk update transaction statuses based on current date.
        Should be run daily to keep statuses current.
        
        Returns:
            Dictionary with count of updated transactions by status
        """
        current_date = datetime.now(UTC)
        updated_counts = {"overdue": 0, "forfeited": 0}
        
        # Find transactions that should be marked overdue
        overdue_candidates = await PawnTransaction.find(
            PawnTransaction.status == TransactionStatus.ACTIVE,
            PawnTransaction.maturity_date < current_date,
            PawnTransaction.grace_period_end > current_date
        ).to_list()
        
        for transaction in overdue_candidates:
            transaction.status = TransactionStatus.OVERDUE
            await transaction.save()
            updated_counts["overdue"] += 1
        
        # Find transactions that should be forfeited
        forfeiture_candidates = await PawnTransaction.find(
            In(PawnTransaction.status, [
                TransactionStatus.ACTIVE, 
                TransactionStatus.OVERDUE, 
                TransactionStatus.EXTENDED
            ]),
            PawnTransaction.grace_period_end < current_date
        ).to_list()
        
        for transaction in forfeiture_candidates:
            transaction.status = TransactionStatus.FORFEITED
            await transaction.save()
            updated_counts["forfeited"] += 1
            
            # Update customer statistics
            customer = await Customer.find_one(Customer.phone_number == transaction.customer_id)
            if customer:
                customer.active_loans = max(0, customer.active_loans - 1)
                customer.total_loan_value = max(0, customer.total_loan_value - transaction.loan_amount)
                customer.default_count += 1
                # Reduce payment history score for defaults
                customer.payment_history_score = max(1, customer.payment_history_score - 10)
                await customer.save()
        
        return updated_counts