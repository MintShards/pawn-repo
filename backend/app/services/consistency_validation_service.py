"""
Customer Data Consistency Validation Service

This module provides comprehensive validation for customer counter consistency
to ensure data integrity between denormalized counters and actual transaction data.
"""

from typing import Dict, List, Optional
from datetime import datetime
import structlog

from app.models.customer_model import Customer
from app.models.pawn_transaction_model import PawnTransaction, TransactionStatus
from beanie.operators import In


class ConsistencyValidationService:
    """Service for validating and fixing customer counter consistency"""

    logger = structlog.get_logger(__name__)

    # Statuses that consume customer slots and credit
    SLOT_USING_STATUSES = [
        TransactionStatus.ACTIVE,
        TransactionStatus.EXTENDED,
        TransactionStatus.HOLD,
        TransactionStatus.OVERDUE,
        TransactionStatus.DAMAGED
    ]

    @staticmethod
    async def validate_customer_consistency(phone_number: str) -> Dict:
        """
        Validate consistency of customer counters against actual transaction data

        Args:
            phone_number: Customer's phone number

        Returns:
            Dict with validation results and discrepancies
        """
        customer = await Customer.find_one(Customer.phone_number == phone_number)
        if not customer:
            return {
                "error": "Customer not found",
                "phone_number": phone_number
            }

        # Get all transactions for this customer
        all_transactions = await PawnTransaction.find(
            PawnTransaction.customer_id == phone_number
        ).to_list()

        # Get active transactions (slot-using statuses)
        active_transactions = await PawnTransaction.find(
            PawnTransaction.customer_id == phone_number,
            In(PawnTransaction.status, ConsistencyValidationService.SLOT_USING_STATUSES)
        ).to_list()

        # Calculate actual values
        actual_total_transactions = len(all_transactions)
        actual_active_loans = len(active_transactions)
        actual_total_loan_value = sum(t.loan_amount for t in active_transactions)

        # Get last transaction date
        actual_last_transaction_date = None
        if all_transactions:
            sorted_transactions = sorted(all_transactions, key=lambda x: x.pawn_date, reverse=True)
            actual_last_transaction_date = sorted_transactions[0].pawn_date

        # Compare with customer counters
        discrepancies = []

        if customer.total_transactions != actual_total_transactions:
            discrepancies.append({
                "field": "total_transactions",
                "stored": customer.total_transactions,
                "actual": actual_total_transactions,
                "difference": actual_total_transactions - customer.total_transactions
            })

        if customer.active_loans != actual_active_loans:
            discrepancies.append({
                "field": "active_loans",
                "stored": customer.active_loans,
                "actual": actual_active_loans,
                "difference": actual_active_loans - customer.active_loans
            })

        # Allow small float differences (rounding errors)
        loan_value_diff = abs(customer.total_loan_value - actual_total_loan_value)
        if loan_value_diff > 0.01:
            discrepancies.append({
                "field": "total_loan_value",
                "stored": float(customer.total_loan_value),
                "actual": float(actual_total_loan_value),
                "difference": float(actual_total_loan_value - customer.total_loan_value)
            })

        # Last transaction date comparison
        if actual_last_transaction_date:
            if not customer.last_transaction_date:
                discrepancies.append({
                    "field": "last_transaction_date",
                    "stored": None,
                    "actual": actual_last_transaction_date.isoformat(),
                    "difference": "missing_date"
                })
            elif abs((customer.last_transaction_date - actual_last_transaction_date).total_seconds()) > 1:
                discrepancies.append({
                    "field": "last_transaction_date",
                    "stored": customer.last_transaction_date.isoformat(),
                    "actual": actual_last_transaction_date.isoformat(),
                    "difference": "date_mismatch"
                })

        return {
            "phone_number": phone_number,
            "customer_name": f"{customer.first_name} {customer.last_name}",
            "consistent": len(discrepancies) == 0,
            "discrepancies": discrepancies,
            "stored_values": {
                "total_transactions": customer.total_transactions,
                "active_loans": customer.active_loans,
                "total_loan_value": float(customer.total_loan_value),
                "last_transaction_date": customer.last_transaction_date.isoformat() if customer.last_transaction_date else None
            },
            "actual_values": {
                "total_transactions": actual_total_transactions,
                "active_loans": actual_active_loans,
                "total_loan_value": float(actual_total_loan_value),
                "last_transaction_date": actual_last_transaction_date.isoformat() if actual_last_transaction_date else None
            },
            "validated_at": datetime.utcnow().isoformat()
        }

    @staticmethod
    async def fix_customer_consistency(phone_number: str, admin_user_id: str) -> Dict:
        """
        Fix customer counter inconsistencies

        Args:
            phone_number: Customer's phone number
            admin_user_id: Admin user ID performing the fix

        Returns:
            Dict with fix results
        """
        # First validate to get discrepancies
        validation_result = await ConsistencyValidationService.validate_customer_consistency(phone_number)

        if "error" in validation_result:
            return validation_result

        if validation_result["consistent"]:
            return {
                "phone_number": phone_number,
                "status": "no_fix_needed",
                "message": "Customer counters are already consistent"
            }

        # Get customer
        customer = await Customer.find_one(Customer.phone_number == phone_number)

        # Apply fixes
        actual_values = validation_result["actual_values"]

        update_data = {
            "total_transactions": actual_values["total_transactions"],
            "active_loans": actual_values["active_loans"],
            "total_loan_value": actual_values["total_loan_value"],
            "updated_by": admin_user_id,
            "updated_at": datetime.utcnow()
        }

        if actual_values["last_transaction_date"]:
            update_data["last_transaction_date"] = datetime.fromisoformat(actual_values["last_transaction_date"])

        # Update customer
        await customer.update({"$set": update_data})

        # Log the fix
        ConsistencyValidationService.logger.info(
            "customer_consistency_fixed",
            phone_number=phone_number,
            admin_user_id=admin_user_id,
            discrepancies=validation_result["discrepancies"],
            fixed_values=actual_values
        )

        return {
            "phone_number": phone_number,
            "status": "fixed",
            "discrepancies_fixed": validation_result["discrepancies"],
            "new_values": actual_values,
            "fixed_by": admin_user_id,
            "fixed_at": datetime.utcnow().isoformat()
        }

    @staticmethod
    async def validate_all_customers(
        limit: Optional[int] = None,
        fix_automatically: bool = False,
        admin_user_id: Optional[str] = None
    ) -> Dict:
        """
        Validate consistency for all customers

        Args:
            limit: Optional limit on number of customers to check
            fix_automatically: If True, automatically fix discrepancies
            admin_user_id: Required if fix_automatically is True

        Returns:
            Dict with validation summary
        """
        if fix_automatically and not admin_user_id:
            return {
                "error": "admin_user_id required for automatic fixes"
            }

        # Get all customers (with optional limit)
        query = Customer.find()
        if limit:
            customers = await query.limit(limit).to_list()
        else:
            customers = await query.to_list()

        results = {
            "total_customers": len(customers),
            "consistent": 0,
            "inconsistent": 0,
            "fixed": 0,
            "errors": 0,
            "customers_with_discrepancies": [],
            "validation_started_at": datetime.utcnow().isoformat()
        }

        for customer in customers:
            try:
                validation = await ConsistencyValidationService.validate_customer_consistency(
                    customer.phone_number
                )

                if validation.get("consistent"):
                    results["consistent"] += 1
                else:
                    results["inconsistent"] += 1

                    discrepancy_info = {
                        "phone_number": customer.phone_number,
                        "customer_name": validation["customer_name"],
                        "discrepancies": validation["discrepancies"]
                    }

                    # Fix if requested
                    if fix_automatically:
                        fix_result = await ConsistencyValidationService.fix_customer_consistency(
                            customer.phone_number,
                            admin_user_id
                        )
                        if fix_result.get("status") == "fixed":
                            results["fixed"] += 1
                            discrepancy_info["fixed"] = True
                        else:
                            discrepancy_info["fix_error"] = fix_result.get("error", "Unknown error")

                    results["customers_with_discrepancies"].append(discrepancy_info)

            except Exception as e:
                results["errors"] += 1
                ConsistencyValidationService.logger.error(
                    "customer_validation_error",
                    phone_number=customer.phone_number,
                    error=str(e)
                )

        results["validation_completed_at"] = datetime.utcnow().isoformat()

        return results

    @staticmethod
    async def get_consistency_report() -> Dict:
        """
        Generate a comprehensive consistency report

        Returns:
            Dict with consistency statistics
        """
        # Run validation on all customers
        validation_results = await ConsistencyValidationService.validate_all_customers()

        # Calculate percentages
        total = validation_results["total_customers"]
        consistent_pct = (validation_results["consistent"] / total * 100) if total > 0 else 0
        inconsistent_pct = (validation_results["inconsistent"] / total * 100) if total > 0 else 0

        report = {
            "report_generated_at": datetime.utcnow().isoformat(),
            "total_customers": total,
            "consistent_customers": validation_results["consistent"],
            "inconsistent_customers": validation_results["inconsistent"],
            "consistency_percentage": round(consistent_pct, 2),
            "inconsistency_percentage": round(inconsistent_pct, 2),
            "errors": validation_results["errors"],
            "status": "healthy" if inconsistent_pct < 1 else "needs_attention" if inconsistent_pct < 5 else "critical",
            "discrepancies_by_field": {}
        }

        # Aggregate discrepancies by field
        for customer_disc in validation_results["customers_with_discrepancies"]:
            for disc in customer_disc["discrepancies"]:
                field = disc["field"]
                if field not in report["discrepancies_by_field"]:
                    report["discrepancies_by_field"][field] = {
                        "count": 0,
                        "total_difference": 0,
                        "affected_customers": []
                    }

                report["discrepancies_by_field"][field]["count"] += 1

                # Add numeric difference if available
                if isinstance(disc.get("difference"), (int, float)):
                    report["discrepancies_by_field"][field]["total_difference"] += disc["difference"]

                report["discrepancies_by_field"][field]["affected_customers"].append(
                    customer_disc["phone_number"]
                )

        return report
