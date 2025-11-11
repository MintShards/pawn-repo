"""
Payment Filter Constants

Standardized payment filtering to ensure voided payments are excluded consistently
across all services. This prevents financial calculation errors.

CRITICAL: Always use these constants when querying payments to avoid including
voided payments in balance calculations.
"""

from typing import Dict, Any

# CRITICAL: Standard filter to exclude voided payments from all financial calculations
# Use this constant in ALL Payment.find() queries to ensure consistency
ACTIVE_PAYMENT_FILTER: Dict[str, Any] = {
    "is_voided": {"$ne": True}  # Exclude payments where is_voided is True
}

# Alternative for Beanie query syntax (use with Payment.find())
# Example: Payment.find(Payment.transaction_id == txn_id, Payment.is_voided != True)
EXCLUDE_VOIDED = {"is_voided": {"$ne": True}}


def get_active_payments_query(transaction_id: str) -> Dict[str, Any]:
    """
    Get MongoDB query dict for active (non-voided) payments of a transaction.

    Args:
        transaction_id: Transaction identifier

    Returns:
        MongoDB query dictionary excluding voided payments

    Example:
        query = get_active_payments_query("TXN123")
        payments = await Payment.find(query).to_list()
    """
    return {
        "transaction_id": transaction_id,
        **ACTIVE_PAYMENT_FILTER
    }


# DOCUMENTATION: Where voided payment filtering is REQUIRED
CRITICAL_FILTER_LOCATIONS = """
Required Locations for Voided Payment Filtering:
=================================================

1. Balance Calculations (CRITICAL)
   - InterestCalculationService.calculate_current_balance()
   - PawnTransactionService.calculate_current_balance()
   - PaymentService.get_payment_summary()

2. Payment Totals (CRITICAL)
   - PaymentService.get_total_payments()
   - PaymentService.get_payment_history()
   - PaymentService.get_payment_history_summary()

3. Payment Allocation (CRITICAL)
   - All interest/principal/extension fee calculations
   - Payment portion breakdowns
   - Remaining balance calculations

4. Financial Reports (HIGH PRIORITY)
   - Daily payment summaries
   - Monthly reconciliation
   - Customer payment history

5. UI Display (MEDIUM PRIORITY)
   - Transaction payment lists
   - Customer payment history
   - Payment timeline displays

IMPLEMENTATION:
Use Payment.is_voided != True in Beanie queries
OR
Use ACTIVE_PAYMENT_FILTER for raw MongoDB queries
"""
