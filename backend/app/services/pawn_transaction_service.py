"""
PawnTransactionService

Business logic for core pawn transaction operations including transaction creation,
balance calculations, status updates, and transaction management.
"""

# Standard library imports
from datetime import datetime, UTC
from typing import List, Optional, Dict, Any
import structlog
import re

# Third-party imports
from beanie.operators import In, Or, RegEx

# Local imports
from app.models.pawn_transaction_model import PawnTransaction, TransactionStatus
from app.models.pawn_item_model import PawnItem
from app.models.payment_model import Payment
from app.models.extension_model import Extension
from app.models.customer_model import Customer, CustomerStatus
from app.models.user_model import User, UserStatus
from app.models.audit_entry_model import create_status_change_audit
from app.core.transaction_notes import safe_append_transaction_notes, format_system_note
from app.core.timezone_utils import utc_to_user_timezone, format_user_datetime, get_user_now, get_user_business_date, user_timezone_to_utc, add_months_user_timezone
from app.core.redis_cache import BusinessCache, cached_result, CacheConfig

# Configure logger
logger = structlog.get_logger("pawn_transaction")

# Import cache invalidation utility (avoid circular import by importing at module level)
def _invalidate_search_caches():
    """Helper function to invalidate search-related caches when transaction data changes"""
    try:
        # Import here to avoid circular imports
        import asyncio
        from app.services.unified_search_service import UnifiedSearchService
        
        # Create async context for cache invalidation
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Schedule as a task in the running loop
            asyncio.create_task(UnifiedSearchService.invalidate_search_caches())
        else:
            # Run directly if no loop is running
            asyncio.run(UnifiedSearchService.invalidate_search_caches())
            
        logger.info("🗑️ CACHE: Search caches invalidated after transaction change")
    except Exception as e:
        logger.error("❌ CACHE: Failed to invalidate search caches", error=str(e))

async def _invalidate_all_transaction_caches():
    """CRITICAL: Comprehensive cache invalidation for real-time updates"""
    try:
        from app.core.redis_cache import get_cache_service
        cache = get_cache_service()
        
        if cache and cache.is_available:
            # Clear all transaction list caches
            cache_patterns = [
                "transactions_list_*",      # All transaction lists
                "transaction:*",            # Individual transaction caches
                "balance:*",                # Balance calculation caches
                "customer_stats_*",         # Customer statistics
                "business_stats_*",         # Business statistics
                "stats:customer:*"          # Customer stats for follow-up counts
            ]
            
            for pattern in cache_patterns:
                await cache.delete_pattern(pattern)
            
            logger.info("🚀 CACHE CLEARED: All transaction caches invalidated for real-time updates")
        
        # Also invalidate search caches
        _invalidate_search_caches()
        
    except Exception as e:
        logger.error("❌ CACHE ERROR: Failed to invalidate transaction caches", error=str(e))


def ensure_timezone_aware(dt: datetime) -> datetime:
    """
    Ensure a datetime object is timezone-aware (UTC).
    
    Args:
        dt: Datetime object that may or may not have timezone info
        
    Returns:
        Timezone-aware datetime object in UTC
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


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
        internal_notes: Optional[str] = None,
        client_timezone: Optional[str] = None
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
            # Get current business date in user's timezone
            if client_timezone:
                # Use user's business date (start of day in their timezone)
                business_date_local = get_user_business_date(client_timezone)
                pawn_date_utc = user_timezone_to_utc(business_date_local, client_timezone)
                logger.info(f"Creating transaction with timezone {client_timezone}: business_date={business_date_local}, utc={pawn_date_utc}")
            else:
                # Fallback to UTC start of day
                utc_now = datetime.now(UTC)
                pawn_date_utc = utc_now.replace(hour=0, minute=0, second=0, microsecond=0)
                logger.warning("No client timezone provided, using UTC business date")
            
            # Get the next formatted ID for this transaction
            from app.services.formatted_id_service import FormattedIdService
            formatted_id = await FormattedIdService.get_next_formatted_id()
            
            # Create the transaction with explicit pawn_date and formatted_id
            # Apply default for storage_location if not provided
            final_storage_location = storage_location if storage_location and storage_location.strip() else "TBD"
            
            transaction = PawnTransaction(
                customer_id=customer_phone,
                created_by_user_id=created_by_user_id,
                loan_amount=loan_amount,
                monthly_interest_amount=monthly_interest_amount,
                storage_location=final_storage_location,
                internal_notes=internal_notes,
                pawn_date=pawn_date_utc,
                formatted_id=formatted_id
            )
            
            # If initial notes were provided, also add them to the new notes architecture
            if internal_notes and internal_notes.strip():
                # Format the note with timestamp and user ID for the new system
                from datetime import datetime, UTC
                now_utc = datetime.now(UTC)
                formatted_note = f"[{now_utc.strftime('%Y-%m-%d %H:%M UTC')} by {created_by_user_id}] {internal_notes.strip()}"
                transaction.manual_notes = formatted_note
            
            # Calculate maturity date using user's timezone calendar
            if client_timezone:
                transaction.maturity_date = add_months_user_timezone(pawn_date_utc, 3, client_timezone)
                transaction.grace_period_end = add_months_user_timezone(transaction.maturity_date, 1, client_timezone)
            else:
                # Fallback: calculate dates normally
                transaction.calculate_dates()
            
            # Save transaction (this will calculate total_due)
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
            
            # CRITICAL: Immediate cache invalidation for real-time updates
            await _invalidate_all_transaction_caches()
            
            # CRITICAL: Load all relationships for complete response
            await transaction.fetch_all_links()
            
            # LOG: Success with timing for monitoring
            logger.info(f"✅ TRANSACTION CREATED: {transaction.transaction_id} with complete data and cache cleared")
            
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
        Retrieve transaction by transaction ID with caching.
        
        Args:
            transaction_id: Unique transaction identifier
            
        Returns:
            PawnTransaction if found, None otherwise
        """
        # Try cache first for frequently accessed transactions
        cache_key = f"transaction:{transaction_id}"
        from app.core.redis_cache import get_cache_service
        cache = get_cache_service()
        
        if cache and cache.is_available:
            cached_data = await cache.get(cache_key)
            if cached_data:
                # Reconstruct PawnTransaction from cached data
                try:
                    return PawnTransaction.model_validate(cached_data)
                except Exception as e:
                    logger.warning("Failed to reconstruct transaction from cache", 
                                  transaction_id=transaction_id, error=str(e))
        
        # Fetch from database
        transaction = await PawnTransaction.find_one(
            PawnTransaction.transaction_id == transaction_id
        )
        
        # Cache the result if found
        if transaction and cache and cache.is_available:
            await cache.set(cache_key, transaction.model_dump(), CacheConfig.MEDIUM_TTL)
        
        return transaction

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
        
        return await query.sort(-PawnTransaction.updated_at).limit(limit).to_list()

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
        ).sort(-PawnTransaction.updated_at).limit(limit).to_list()
    
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
        Calculate current balance for a transaction including interest accrual with caching.
        
        Args:
            transaction_id: Unique transaction identifier
            as_of_date: Date to calculate balance (defaults to current date)
            
        Returns:
            Dictionary with balance details
            
        Raises:
            PawnTransactionError: Transaction not found
        """
        # For current date calculations, use short-term cache
        if as_of_date is None:
            cached_balance = await BusinessCache.get_transaction_balance(transaction_id)
            if cached_balance:
                return cached_balance
        transaction = await PawnTransactionService.get_transaction_by_id(transaction_id)
        if not transaction:
            raise PawnTransactionError(f"Transaction {transaction_id} not found")
        
        if as_of_date is None:
            as_of_date = datetime.now(UTC)
        
        # Get all non-voided payments for this transaction
        payments = await Payment.find(
            Payment.transaction_id == transaction_id,
            Payment.is_voided != True  # Include payments where is_voided is False or doesn't exist
        ).sort(Payment.payment_date).to_list()
        
        # Calculate total due with interest accrual
        total_due = transaction.calculate_total_due(as_of_date)
        
        # Calculate total payments made and payment portions (defensive programming)
        # Exclude voided payments from all calculations
        try:
            total_paid = sum(
                payment.payment_amount
                for payment in payments
                if not getattr(payment, 'is_voided', False)
            ) if payments else 0

            # Sum up payment portions from actual payment records
            interest_paid = sum(
                getattr(payment, 'interest_portion', 0)
                for payment in payments
                if not getattr(payment, 'is_voided', False)
            ) if payments else 0

            overdue_fee_paid = sum(
                getattr(payment, 'overdue_fee_portion', 0)
                for payment in payments
                if not getattr(payment, 'is_voided', False)
            ) if payments else 0

            principal_paid = sum(
                getattr(payment, 'principal_portion', 0)
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
            interest_paid = 0
            overdue_fee_paid = 0
            principal_paid = 0

        # Calculate current balance
        current_balance = total_due - total_paid

        # Calculate interest portion
        pawn_date_aware = ensure_timezone_aware(transaction.pawn_date)
        interest_due = transaction.monthly_interest_amount * max(1, min(3,
            ((as_of_date.year - pawn_date_aware.year) * 12 +
             (as_of_date.month - pawn_date_aware.month)) +
            (1 if as_of_date.day > pawn_date_aware.day else 0)
        ))

        principal_due = transaction.loan_amount

        balance_data = {
            "transaction_id": transaction_id,
            "as_of_date": as_of_date.isoformat(),
            "loan_amount": transaction.loan_amount,
            "monthly_interest": transaction.monthly_interest_amount,
            "total_due": total_due,
            "total_paid": total_paid,
            "current_balance": current_balance,
            "principal_due": principal_due,
            "interest_due": interest_due,
            "overdue_fee_due": transaction.overdue_fee,
            "principal_paid": principal_paid,
            "interest_paid": interest_paid,
            "overdue_fee_paid": overdue_fee_paid,
            "principal_balance": principal_due - principal_paid,
            "interest_balance": interest_due - interest_paid,
            "overdue_fee_balance": transaction.overdue_fee - overdue_fee_paid,
            "payment_count": len(payments),
            "status": transaction.status,
            "pawn_date": ensure_timezone_aware(transaction.pawn_date).isoformat(),
            "maturity_date": ensure_timezone_aware(transaction.maturity_date).isoformat(),
            "grace_period_end": ensure_timezone_aware(transaction.grace_period_end).isoformat(),
            "is_overdue": as_of_date > ensure_timezone_aware(transaction.maturity_date),
            "is_in_grace_period": ensure_timezone_aware(transaction.maturity_date) < as_of_date <= ensure_timezone_aware(transaction.grace_period_end),
            "days_until_forfeiture": (ensure_timezone_aware(transaction.grace_period_end) - as_of_date).days if as_of_date < ensure_timezone_aware(transaction.grace_period_end) else 0
        }
        
        # Cache current balance calculations for short term
        if as_of_date is None or (datetime.now(UTC) - as_of_date).total_seconds() < 3600:
            await BusinessCache.set_transaction_balance(transaction_id, balance_data)
        
        return balance_data
    
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
                TransactionStatus.FORFEITED, TransactionStatus.HOLD
            ],
            TransactionStatus.OVERDUE: [
                TransactionStatus.EXTENDED, TransactionStatus.FORFEITED, 
                TransactionStatus.HOLD
            ],
            TransactionStatus.EXTENDED: [
                TransactionStatus.OVERDUE, TransactionStatus.FORFEITED, 
                TransactionStatus.HOLD
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
        
        # Create structured audit entry for status change
        audit_entry = create_status_change_audit(
            staff_member=updated_by_user_id,
            old_status=str(old_status),
            new_status=str(new_status),
            reason=notes
        )
        transaction.add_system_audit_entry(audit_entry)
        
        if notes:
            # Use shared notes utility for consistent formatting and truncation
            status_note = format_system_note(
                action=f"Status changed to {new_status}",
                details=notes,
                user_id=updated_by_user_id
            )
            transaction.internal_notes = safe_append_transaction_notes(
                transaction.internal_notes,
                status_note,
                add_timestamp=False  # Already formatted by format_system_note
            )
        
        await transaction.save()
        
        # CRITICAL: Immediate comprehensive cache invalidation for real-time updates
        await _invalidate_all_transaction_caches()
        
        # LOG: Status change success for monitoring
        logger.info(f"✅ STATUS UPDATED: {transaction_id} changed from {old_status} to {new_status} with cache cleared")
        
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
        
        ONLY moves active/extended transactions to overdue.
        NO automatic forfeiture - staff must manually change overdue to forfeited.
        
        Returns:
            Dictionary with count of updated transactions by status
        """
        current_date = datetime.now(UTC)
        updated_counts = {"overdue": 0}
        
        # Find transactions that should be marked overdue
        # Only move ACTIVE or EXTENDED transactions past maturity date to OVERDUE
        overdue_candidates = await PawnTransaction.find(
            In(PawnTransaction.status, [TransactionStatus.ACTIVE, TransactionStatus.EXTENDED]),
            PawnTransaction.maturity_date < current_date
        ).to_list()
        
        for transaction in overdue_candidates:
            transaction.status = TransactionStatus.OVERDUE
            await transaction.save()
            updated_counts["overdue"] += 1
        
        # NO AUTOMATIC FORFEITURE - removed this section
        # Staff/admin must manually change overdue to forfeited via UI
        
        return updated_counts
    

    @staticmethod
    def _generate_filters_hash(filters) -> str:
        """Generate a consistent hash for filters to use as cache key."""
        import hashlib
        import json
        
        # Convert filters to a consistent string representation
        filter_dict = {
            'search_text': filters.search_text,
            'status': str(filters.status) if filters.status else None,
            'customer_id': filters.customer_id,
            'min_amount': filters.min_amount,
            'max_amount': filters.max_amount,
            'start_date': filters.start_date.isoformat() if filters.start_date else None,
            'end_date': filters.end_date.isoformat() if filters.end_date else None,
            'maturity_date_from': getattr(filters, 'maturity_date_from', None).isoformat() if getattr(filters, 'maturity_date_from', None) else None,
            'maturity_date_to': getattr(filters, 'maturity_date_to', None).isoformat() if getattr(filters, 'maturity_date_to', None) else None,
            'min_days_overdue': getattr(filters, 'min_days_overdue', None),
            'max_days_overdue': getattr(filters, 'max_days_overdue', None),
            'storage_location': filters.storage_location,
            'page': filters.page,
            'page_size': filters.page_size,
            'sort_by': str(filters.sort_by),
            'sort_order': str(filters.sort_order)
        }
        
        # Sort keys for consistent hashing
        filter_str = json.dumps(filter_dict, sort_keys=True)
        return hashlib.md5(filter_str.encode()).hexdigest()[:12]

    @staticmethod
    async def get_transactions_list(filters, client_timezone: Optional[str] = None) -> Dict[str, Any]:
        """
        Get paginated list of transactions with filtering (with caching for performance).
        
        Args:
            filters: TransactionSearchFilters object with pagination and filter options
            client_timezone: Client timezone for date formatting
            
        Returns:
            Dictionary containing transactions list and pagination info
        """
        from app.schemas.pawn_transaction_schema import PawnTransactionListResponse, PawnTransactionResponse
        
        # Simple cache implementation
        cache_key = f"transactions_list_{PawnTransactionService._generate_filters_hash(filters)}_{client_timezone or 'UTC'}"
        
        # Check cache first (using BusinessCache if available)
        try:
            cached_result = await BusinessCache.get(cache_key)
            if cached_result is not None:
                logger.info(f"🚀 CACHE HIT: Returning cached transaction list for key {cache_key[:20]}...")
                return cached_result
        except Exception as e:
            logger.debug(f"Cache read failed, proceeding without cache: {e}")
        
        try:
            # Build query
            query = PawnTransaction.find()
            
            # Apply filters
            if filters.status:
                query = query.find(PawnTransaction.status == filters.status)
                
            if filters.customer_id:
                query = query.find(PawnTransaction.customer_id == filters.customer_id)
            
            # Handle search with improved logic
            if filters.search_text:
                search_term = filters.search_text.strip()
                logger.info(f"🔍 SEARCH START: Processing search term '{search_term}'")
                
                # Check if it's a transaction ID pattern (PW000123, #PW000123, #123, or 123 - max 6 digits)
                if re.match(r'^#?(PW)?\d{1,6}$', search_term, re.IGNORECASE):
                    logger.info(f"✅ SEARCH PATTERN: Detected transaction ID pattern for '{search_term}'")
                    
                    # Extract the number from search term and format as PW000123
                    number_match = re.search(r'\d+', search_term)
                    if number_match:
                        target_number = int(number_match.group())
                        formatted_search_id = f"PW{target_number:06d}"
                        logger.info(f"🎯 SEARCH TARGET: Looking for formatted ID {formatted_search_id}")
                        
                        # Use indexed lookup for exact match
                        from app.services.formatted_id_service import FormattedIdService
                        transaction = await FormattedIdService.find_by_formatted_id(formatted_search_id)
                        
                        if transaction:
                            logger.info(f"✅ SEARCH SUCCESS: Found transaction {formatted_search_id} via indexed lookup")
                            query = query.find(PawnTransaction.transaction_id == transaction.transaction_id)
                        else:
                            logger.warning(f"❌ SEARCH NOT FOUND: No transaction found for formatted ID {formatted_search_id}")
                            query = query.find(PawnTransaction.transaction_id == "nonexistent")
                    else:
                        # Shouldn't happen with regex, but fallback
                        logger.warning(f"⚠️ SEARCH WARNING: Could not extract number from '{search_term}'")
                        query = query.find(PawnTransaction.transaction_id == "nonexistent")
                
                # Check if it's an extension ID pattern (EX000123, #EX000123)
                elif re.match(r'^#?(EX)\d+$', search_term, re.IGNORECASE):
                    logger.info(f"📋 SEARCH PATTERN: Detected extension ID pattern for '{search_term}'")
                    
                    # Try direct extension lookup first
                    try:
                        from app.services.formatted_id_service import FormattedIdService
                        
                        # Extract and normalize the search term
                        formatted_search_id = search_term.upper()
                        if not formatted_search_id.startswith('EX'):
                            # Handle cases like "#123" or "123" for extension IDs
                            number_match = re.search(r'\d+', formatted_search_id)
                            if number_match:
                                extension_number = int(number_match.group())
                                formatted_search_id = f"EX{extension_number:06d}"
                        
                        # Search for extension by formatted ID
                        extension = await FormattedIdService.find_extension_by_formatted_id(formatted_search_id)
                        
                        if extension:
                            logger.info(f"✅ EXTENSION SEARCH: Found extension {formatted_search_id}, searching for transaction {extension.transaction_id}")
                            # Search for the transaction that has this extension
                            query = query.find(PawnTransaction.transaction_id == extension.transaction_id)
                        else:
                            logger.info(f"❌ EXTENSION SEARCH: Extension {formatted_search_id} not found, checking transactions with any extensions")
                            # Fallback: search for transactions with extensions
                            query = query.find({"extensions.0": {"$exists": True}})
                            filters.page_size = 200  # Load more transactions for extension search
                            
                    except Exception as e:
                        logger.warning(f"⚠️ EXTENSION SEARCH ERROR: {e}, falling back to extension array search")
                        # Fallback to finding transactions with extensions
                        query = query.find({"extensions.0": {"$exists": True}})
                        filters.page_size = 200
                    
                    logger.info(f"📊 SEARCH SCOPE: Extension search for '{search_term}'")
                
                # Check if it's an item ID pattern (IT000123, #IT000123)  
                elif re.match(r'^#?(IT)\d+$', search_term, re.IGNORECASE):
                    logger.info(f"📦 SEARCH PATTERN: Detected item ID pattern for '{search_term}'")
                    # Similar to extension, items don't have direct lookup
                    # Will need to search within transactions
                    query = query  # Keep query as-is
                    filters.page_size = 200  # Load more transactions
                    logger.info(f"📊 SEARCH SCOPE: Item search - page size increased to {filters.page_size}")
                
                # Check if it's a loan amount (pure number less than 7 digits)
                elif search_term.isdigit() and len(search_term) < 7:
                    logger.info(f"💰 SEARCH PATTERN: Detected loan amount pattern for '{search_term}'")
                    amount_value = int(search_term)
                    # Search for exact amount match
                    query = query.find(PawnTransaction.loan_amount == amount_value)
                    # Use normal pagination for amount searches
                    logger.info(f"📊 SEARCH SCOPE: Amount search for ${amount_value} - using normal pagination")
                
                # Check if it's a phone number (7+ digits) - customer search 
                elif search_term.isdigit() and len(search_term) >= 7:
                    logger.info(f"📞 SEARCH PATTERN: Detected customer phone number pattern for '{search_term}'")
                    # Search for phone number in customer_id field (exact match or contains)
                    query = query.find(RegEx(PawnTransaction.customer_id, f".*{search_term}.*"))
                    # Respect normal pagination for phone searches
                    logger.info(f"📊 SEARCH SCOPE: Phone search for '{search_term}' - using normal pagination")
                
                # For any other search terms, treat as customer/general search
                else:
                    logger.info(f"🔤 SEARCH PATTERN: Treating as general customer/name search for '{search_term}'")
                    
                    # For customer name searches, we need to search in the Customer collection first
                    # Then find transactions matching those customer phone numbers
                    try:
                        from app.models.customer_model import Customer
                        
                        # Search for customers matching the name pattern
                        matching_customers = await Customer.find({
                            "$or": [
                                {"first_name": RegEx(f".*{search_term}.*", "i")},
                                {"last_name": RegEx(f".*{search_term}.*", "i")},
                                # Also search in combined name (first + last)
                                {"$expr": {
                                    "$regexMatch": {
                                        "input": {"$concat": ["$first_name", " ", "$last_name"]},
                                        "regex": search_term,
                                        "options": "i"
                                    }
                                }}
                            ]
                        }).to_list()
                        
                        if matching_customers:
                            # Get phone numbers of matching customers
                            customer_phones = [customer.phone_number for customer in matching_customers]
                            logger.info(f"🔍 CUSTOMER NAME SEARCH: Found {len(matching_customers)} customers matching '{search_term}', phones: {customer_phones}")
                            
                            # Search for transactions with those customer phone numbers
                            query = query.find({"customer_id": {"$in": customer_phones}})
                        else:
                            logger.info(f"🔍 CUSTOMER NAME SEARCH: No customers found matching '{search_term}'")
                            # No matching customers, return empty result
                            query = query.find({"customer_id": "no-match-found"})
                            
                    except Exception as e:
                        logger.warning(f"⚠️ CUSTOMER NAME SEARCH ERROR: {e}, falling back to customer_id search")
                        # Fallback to searching in customer_id (phone) field
                        query = query.find(RegEx(PawnTransaction.customer_id, f".*{search_term}.*", "i"))
                    
                    # Use normal pagination for general searches
                    logger.info(f"📊 SEARCH SCOPE: General search for '{search_term}' - using normal pagination")
                
            if filters.min_amount is not None:
                query = query.find(PawnTransaction.loan_amount >= filters.min_amount)
                
            if filters.max_amount is not None:
                query = query.find(PawnTransaction.loan_amount <= filters.max_amount)
                
            if filters.start_date:
                query = query.find(PawnTransaction.pawn_date >= filters.start_date)
                
            if filters.end_date:
                query = query.find(PawnTransaction.pawn_date <= filters.end_date)
                
            if getattr(filters, 'maturity_date_from', None):
                query = query.find(PawnTransaction.maturity_date >= filters.maturity_date_from)
                
            if getattr(filters, 'maturity_date_to', None):
                query = query.find(PawnTransaction.maturity_date <= filters.maturity_date_to)
                
            # Days overdue filter - requires special handling
            min_days = getattr(filters, 'min_days_overdue', None)
            max_days = getattr(filters, 'max_days_overdue', None)
            if min_days is not None or max_days is not None:
                from datetime import timedelta
                current_datetime = get_user_now(client_timezone)
                
                if min_days is not None:
                    # Calculate the maturity date that would result in at least min_days_overdue
                    # Days overdue starts 1 day after maturity, so we subtract (min_days_overdue + 1)
                    max_maturity_datetime = current_datetime - timedelta(days=min_days + 1)
                    query = query.find(PawnTransaction.maturity_date <= max_maturity_datetime)
                    # Also need to be overdue status
                    if not filters.status or filters.status != TransactionStatus.OVERDUE:
                        query = query.find(PawnTransaction.status == TransactionStatus.OVERDUE)
                
                if max_days is not None:
                    # Calculate the maturity date that would result in at most max_days_overdue
                    min_maturity_datetime = current_datetime - timedelta(days=max_days + 1)
                    query = query.find(PawnTransaction.maturity_date >= min_maturity_datetime)
                
            if filters.storage_location:
                query = query.find(PawnTransaction.storage_location.contains(filters.storage_location, case_insensitive=True))
            
            # Get total count before pagination
            total_count = await query.count()
            
            # Apply sorting with enum value extraction - REAL-TIME FIX: Ensure newest first
            sort_direction = 1 if filters.sort_order.value == "asc" else -1
            sort_field_name = filters.sort_by.value if hasattr(filters.sort_by, 'value') else str(filters.sort_by)
            
            if hasattr(PawnTransaction, sort_field_name):
                sort_field = getattr(PawnTransaction, sort_field_name)
                query = query.sort([(sort_field, sort_direction)])
            else:
                # CRITICAL FIX: Default sort by creation date DESC for newest transactions first
                query = query.sort([
                    (PawnTransaction.pawn_date, -1),    # Primary: newest pawn date first
                    (PawnTransaction.created_at, -1),   # Secondary: newest creation time first
                    (PawnTransaction.transaction_id, -1) # Tertiary: newest transaction ID first
                ])
            
            # Apply pagination
            skip = (filters.page - 1) * filters.page_size
            transactions = await query.skip(skip).limit(filters.page_size).to_list()
            
            # PERFORMANCE OPTIMIZATION: Batch fetch all items for all transactions (fix N+1 problem)
            transaction_ids = [t.transaction_id for t in transactions]
            all_items = []
            if transaction_ids:
                all_items = await PawnItem.find(
                    {"transaction_id": {"$in": transaction_ids}}
                ).sort(PawnItem.item_number).to_list()
            
            # Group items by transaction_id for O(1) lookup
            items_by_transaction = {}
            for item in all_items:
                if item.transaction_id not in items_by_transaction:
                    items_by_transaction[item.transaction_id] = []
                items_by_transaction[item.transaction_id].append(item.model_dump())
            
            # Convert to response format with timezone-aware dates and items
            transaction_responses = []
            for transaction in transactions:
                transaction_dict = transaction.model_dump()
                
                # Get pre-fetched items for this transaction
                transaction_dict['items'] = items_by_transaction.get(transaction.transaction_id, [])
                
                # Convert UTC dates to user timezone for display
                if client_timezone:
                    if transaction_dict.get('pawn_date'):
                        transaction_dict['pawn_date'] = utc_to_user_timezone(
                            transaction.pawn_date, client_timezone
                        ).isoformat()
                    if transaction_dict.get('maturity_date'):
                        transaction_dict['maturity_date'] = utc_to_user_timezone(
                            transaction.maturity_date, client_timezone
                        ).isoformat()
                    if transaction_dict.get('created_at'):
                        transaction_dict['created_at'] = utc_to_user_timezone(
                            transaction.created_at, client_timezone
                        ).isoformat()
                    if transaction_dict.get('updated_at'):
                        transaction_dict['updated_at'] = utc_to_user_timezone(
                            transaction.updated_at, client_timezone
                        ).isoformat()
                
                transaction_responses.append(PawnTransactionResponse.model_validate(transaction_dict))
            
            # Calculate pagination info
            has_next = (skip + filters.page_size) < total_count
            
            # Final search result logging
            if filters.search_text:
                logger.info(f"🏁 SEARCH COMPLETE: Returning {len(transaction_responses)} transactions for '{filters.search_text}' (total: {total_count})")
                if transaction_responses:
                    first_txn_id = transaction_responses[0].transaction_id
                    logger.info(f"📄 FIRST RESULT: Transaction ID {first_txn_id}")
            
            result = PawnTransactionListResponse(
                transactions=transaction_responses,
                total_count=total_count,
                page=filters.page,
                page_size=filters.page_size,
                has_next=has_next
            )
            
            # Cache the result for future requests (60 second TTL)
            try:
                await BusinessCache.set(cache_key, result, ttl_seconds=60)
                logger.debug(f"💾 CACHE SET: Cached transaction list for key {cache_key[:20]}...")
            except Exception as e:
                logger.debug(f"Cache write failed, continuing without cache: {e}")
            
            return result
            
        except Exception as e:
            raise PawnTransactionError(f"Failed to retrieve transactions list: {str(e)}")
    
    @staticmethod
    async def get_transaction_summary(transaction_id: str) -> Dict[str, Any]:
        """
        Get comprehensive transaction summary with items and balance.
        
        Args:
            transaction_id: Unique transaction identifier
            
        Returns:
            Dictionary containing transaction, items, balance, and summary info
        """
        from app.schemas.pawn_transaction_schema import (
            TransactionSummaryResponse, PawnTransactionResponse, PawnItemResponse
        )
        from app.schemas.pawn_transaction_schema import BalanceResponse
        from app.models.pawn_item_model import PawnItem
        from app.services.interest_calculation_service import InterestCalculationService
        
        try:
            # Get transaction
            transaction = await PawnTransaction.find_one(
                PawnTransaction.transaction_id == transaction_id
            )
            if not transaction:
                raise PawnTransactionError(f"Transaction {transaction_id} not found")

            # Get customer information
            from app.models.customer_model import Customer
            customer = await Customer.find_one(Customer.phone_number == transaction.customer_id)

            # Get transaction items
            items = await PawnItem.find(
                PawnItem.transaction_id == transaction_id
            ).sort(PawnItem.item_number).to_list()

            # Convert to response schemas
            transaction_dict = transaction.model_dump()

            # Add customer name to transaction dict if customer found
            if customer:
                transaction_dict['customer_first_name'] = customer.first_name
                transaction_dict['customer_last_name'] = customer.last_name
                transaction_dict['customer_name'] = f"{customer.first_name} {customer.last_name}"

            item_responses = []
            for item in items:
                item_dict = item.model_dump()
                item_responses.append(PawnItemResponse.model_validate(item_dict))

            # Add items to transaction response
            transaction_dict['items'] = item_responses
            transaction_response = PawnTransactionResponse.model_validate(transaction_dict)
            
            # Get current balance (using a simplified version for now)
            balance_info = await InterestCalculationService.calculate_current_balance(
                transaction_id
            )
            
            # Calculate summary statistics
            current_date = datetime.now(UTC)
            
            # Ensure transaction dates are timezone-aware
            pawn_date = ensure_timezone_aware(transaction.pawn_date)
            maturity_date = ensure_timezone_aware(transaction.maturity_date)
            grace_period_end = ensure_timezone_aware(transaction.grace_period_end)
            
            days_since_pawn = (current_date.date() - pawn_date.date()).days
            days_to_maturity = (maturity_date.date() - current_date.date()).days
            
            summary_stats = {
                "total_items": len(items),
                "days_since_pawn": days_since_pawn,
                "days_to_maturity": days_to_maturity,
                "is_overdue": current_date > maturity_date,
                "is_in_grace_period": (
                    current_date > maturity_date and 
                    current_date <= grace_period_end
                ),
                "loan_to_value_ratio": None,  # Could be calculated if item values were stored
                "payment_count": 0,  # Will be updated when payment system is integrated
            }
            
            return TransactionSummaryResponse(
                transaction=transaction_response,
                items=item_responses,
                balance=balance_info,
                summary=summary_stats
            )
            
        except PawnTransactionError:
            # Re-raise our own errors
            raise
        except Exception as e:
            raise PawnTransactionError(f"Failed to get transaction summary: {str(e)}")
    
    @staticmethod
    async def bulk_update_status(
        transaction_ids: List[str],
        new_status: TransactionStatus,
        updated_by_user_id: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Bulk update status for multiple transactions.
        
        Args:
            transaction_ids: List of transaction IDs to update
            new_status: New status to apply
            updated_by_user_id: User ID making the updates
            notes: Optional notes about the updates
            
        Returns:
            Dictionary with update results
        """
        from app.schemas.pawn_transaction_schema import BulkStatusUpdateResponse
        
        success_count = 0
        error_count = 0
        successful_updates = []
        failed_updates = []
        
        for transaction_id in transaction_ids:
            try:
                await PawnTransactionService.update_transaction_status(
                    transaction_id=transaction_id,
                    new_status=new_status,
                    updated_by_user_id=updated_by_user_id,
                    notes=notes
                )
                success_count += 1
                successful_updates.append(transaction_id)
            except Exception as e:
                error_count += 1
                failed_updates.append({
                    "transaction_id": transaction_id,
                    "error": str(e)
                })
        
        return BulkStatusUpdateResponse(
            success_count=success_count,
            error_count=error_count,
            total_requested=len(transaction_ids),
            successful_updates=successful_updates,
            failed_updates=failed_updates
        )
    
    @staticmethod
    async def bulk_add_notes(
        transaction_ids: List[str],
        note: str,
        added_by_user_id: str
    ) -> Dict[str, Any]:
        """
        Add the same note to multiple transactions.
        
        Args:
            transaction_ids: List of transaction IDs to add notes to
            note: Note text to add
            added_by_user_id: User ID adding the notes
            
        Returns:
            Dictionary with update results
        """
        from app.schemas.pawn_transaction_schema import BulkNotesResponse
        
        success_count = 0
        error_count = 0
        successful_updates = []
        failed_updates = []
        
        # Validate user
        staff_user = await User.find_one(User.user_id == added_by_user_id)
        if not staff_user or staff_user.status != UserStatus.ACTIVE:
            raise StaffValidationError(f"Staff user {added_by_user_id} not found or inactive")
        
        for transaction_id in transaction_ids:
            try:
                # Get transaction
                transaction = await PawnTransaction.find_one(PawnTransaction.transaction_id == transaction_id)
                if not transaction:
                    error_count += 1
                    failed_updates.append({
                        "transaction_id": transaction_id,
                        "error": "Transaction not found"
                    })
                    continue
                
                # Add note to transaction using the new manual notes system
                transaction.add_manual_note(note, added_by_user_id)
                
                await transaction.save()
                
                success_count += 1
                successful_updates.append(transaction_id)
                
                # Log successful note addition
                logger.info(f"✅ BULK NOTE: Added note to transaction {transaction_id} by user {added_by_user_id}")
                
            except Exception as e:
                error_count += 1
                failed_updates.append({
                    "transaction_id": transaction_id,
                    "error": str(e)
                })
                logger.error(f"❌ BULK NOTE ERROR: Failed to add note to {transaction_id}", error=str(e))
        
        # Clear caches after bulk note addition
        await _invalidate_all_transaction_caches()
        
        return BulkNotesResponse(
            success_count=success_count,
            error_count=error_count,
            total_requested=len(transaction_ids),
            successful_updates=successful_updates,
            failed_updates=failed_updates
        )
    
    @staticmethod
    async def redeem_transaction(
        transaction_id: str,
        redeemed_by_user_id: str
    ) -> PawnTransaction:
        """
        Mark transaction as redeemed (full payoff).
        
        Args:
            transaction_id: Unique transaction identifier
            redeemed_by_user_id: User ID who processed the redemption
            
        Returns:
            Updated PawnTransaction
        """
        # Validate staff user
        staff_user = await User.find_one(User.user_id == redeemed_by_user_id)
        if not staff_user or staff_user.status != UserStatus.ACTIVE:
            raise StaffValidationError(f"Staff user {redeemed_by_user_id} not found or inactive")
        
        # Get transaction
        transaction = await PawnTransactionService.get_transaction_by_id(transaction_id)
        if not transaction:
            raise PawnTransactionError(f"Transaction {transaction_id} not found")
        
        # Check if transaction can be redeemed
        valid_statuses = [TransactionStatus.ACTIVE, TransactionStatus.OVERDUE, TransactionStatus.EXTENDED]
        if transaction.status not in valid_statuses:
            raise TransactionStateError(f"Cannot redeem transaction with status {transaction.status}")
        
        # Invalidate transaction cache before status update
        await BusinessCache.invalidate_transaction_data(transaction_id)
        
        # Update transaction status
        return await PawnTransactionService.update_transaction_status(
            transaction_id=transaction_id,
            new_status=TransactionStatus.REDEEMED,
            updated_by_user_id=redeemed_by_user_id,
            notes=f"Transaction redeemed by {staff_user.first_name} {staff_user.last_name}"
        )
    
    @staticmethod
    async def forfeit_transaction(
        transaction_id: str,
        forfeited_by_user_id: str,
        reason: Optional[str] = None
    ) -> PawnTransaction:
        """
        Mark transaction as forfeited.
        
        Args:
            transaction_id: Unique transaction identifier
            forfeited_by_user_id: User ID who processed the forfeiture
            reason: Optional reason for forfeiture
            
        Returns:
            Updated PawnTransaction
        """
        # Validate staff user
        staff_user = await User.find_one(User.user_id == forfeited_by_user_id)
        if not staff_user or staff_user.status != UserStatus.ACTIVE:
            raise StaffValidationError(f"Staff user {forfeited_by_user_id} not found or inactive")
        
        # Get transaction
        transaction = await PawnTransactionService.get_transaction_by_id(transaction_id)
        if not transaction:
            raise PawnTransactionError(f"Transaction {transaction_id} not found")
        
        # Check if transaction can be forfeited
        valid_statuses = [TransactionStatus.ACTIVE, TransactionStatus.OVERDUE, TransactionStatus.EXTENDED]
        if transaction.status not in valid_statuses:
            raise TransactionStateError(f"Cannot forfeit transaction with status {transaction.status}")
        
        # Prepare notes
        forfeit_notes = f"Transaction forfeited by {staff_user.first_name} {staff_user.last_name}"
        if reason:
            forfeit_notes += f". Reason: {reason}"
        
        # Invalidate transaction cache before status update
        await BusinessCache.invalidate_transaction_data(transaction_id)
        
        # Update transaction status
        return await PawnTransactionService.update_transaction_status(
            transaction_id=transaction_id,
            new_status=TransactionStatus.FORFEITED,
            updated_by_user_id=forfeited_by_user_id,
            notes=forfeit_notes
        )
    
    @staticmethod
    async def get_voidable_transactions() -> List[PawnTransaction]:
        """
        Get transactions that can be voided.
        
        Returns:
            List of transactions that can be voided (active, overdue, extended, hold)
        """
        voidable_statuses = [TransactionStatus.ACTIVE, TransactionStatus.OVERDUE, 
                           TransactionStatus.EXTENDED, TransactionStatus.HOLD]
        return await PawnTransaction.find(
            In(PawnTransaction.status, voidable_statuses)
        ).to_list()
    
    @staticmethod
    async def get_cancelable_transactions() -> List[PawnTransaction]:
        """
        Get transactions that can be canceled (active, no payments, recent).
        
        Returns:
            List of transactions that can be canceled (active status, created within 24 hours)
        """
        from datetime import timedelta
        cutoff_date = datetime.utcnow() - timedelta(hours=24)
        return await PawnTransaction.find(
            PawnTransaction.status == TransactionStatus.ACTIVE,
            PawnTransaction.created_at >= cutoff_date
        ).to_list()