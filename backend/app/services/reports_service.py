# backend/app/services/reports_service.py - FIXED VERSION
from typing import Dict, List, Any, Optional
from datetime import date, datetime, timedelta
from app.models.customer_model import Customer
from app.models.item_model import Item, ItemStatus
from app.models.transaction_model import Transaction, TransactionType, TransactionStatus, LoanStatus
from beanie.operators import And
import csv
import io
import logging

logger = logging.getLogger(__name__)

class ReportsService:
    @staticmethod
    async def get_transaction_report(
        start_date: date, 
        end_date: date, 
        transaction_type: Optional[TransactionType] = None
    ) -> Dict[str, Any]:
        """Get detailed transaction report"""
        try:
            start_datetime = datetime.combine(start_date, datetime.min.time())
            end_datetime = datetime.combine(end_date, datetime.max.time())
            
            query_conditions = [
                Transaction.transaction_date >= start_datetime,
                Transaction.transaction_date <= end_datetime,
                Transaction.status == TransactionStatus.COMPLETED
            ]
            
            if transaction_type:
                query_conditions.append(Transaction.transaction_type == transaction_type)
            
            transactions = await Transaction.find(And(*query_conditions)).sort(-Transaction.transaction_date).to_list()
            
            # Calculate summary statistics
            total_amount = sum(t.total_amount for t in transactions)
            total_interest = sum(t.interest_amount or 0 for t in transactions)
            
            # Group by transaction type
            type_breakdown = {}
            for transaction in transactions:
                tx_type = transaction.transaction_type.value
                if tx_type not in type_breakdown:
                    type_breakdown[tx_type] = {"count": 0, "total_amount": 0}
                
                type_breakdown[tx_type]["count"] += 1
                type_breakdown[tx_type]["total_amount"] += transaction.total_amount
            
            # Group by payment method
            payment_method_breakdown = {}
            for transaction in transactions:
                method = transaction.payment_method.value
                if method not in payment_method_breakdown:
                    payment_method_breakdown[method] = {"count": 0, "total_amount": 0}
                
                payment_method_breakdown[method]["count"] += 1
                payment_method_breakdown[method]["total_amount"] += transaction.total_amount
            
            return {
                "period": {
                    "start_date": start_date,
                    "end_date": end_date
                },
                "summary": {
                    "total_transactions": len(transactions),
                    "total_amount": total_amount,
                    "total_interest": total_interest,
                    "average_transaction": total_amount / len(transactions) if transactions else 0
                },
                "breakdown": {
                    "by_type": type_breakdown,
                    "by_payment_method": payment_method_breakdown
                },
                "transactions": [
                    {
                        "transaction_id": str(t.transaction_id),
                        "type": t.transaction_type.value,
                        "amount": t.total_amount,
                        "interest": t.interest_amount or 0,
                        "payment_method": t.payment_method.value,
                        "date": t.transaction_date,
                        "receipt_number": t.receipt_number,
                        "customer_id": str(t.customer_id)
                    }
                    for t in transactions
                ]
            }
        except Exception as e:
            logger.error(f"Error generating transaction report: {str(e)}")
            raise

    @staticmethod
    async def get_transaction_report_csv(
        start_date: date, 
        end_date: date, 
        transaction_type: Optional[TransactionType] = None
    ) -> str:
        """Get transaction report as CSV"""
        report = await ReportsService.get_transaction_report(start_date, end_date, transaction_type)
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write headers
        writer.writerow([
            "Transaction ID", "Type", "Amount", "Interest", "Payment Method", 
            "Date", "Receipt Number", "Customer ID"
        ])
        
        # Write data
        for transaction in report["transactions"]:
            writer.writerow([
                transaction["transaction_id"],
                transaction["type"],
                transaction["amount"],
                transaction["interest"],
                transaction["payment_method"],
                transaction["date"],
                transaction["receipt_number"],
                transaction["customer_id"]
            ])
        
        return output.getvalue()

    @staticmethod
    async def get_inventory_report() -> Dict[str, Any]:
        """Get current inventory report"""
        try:
            items = await Item.find().to_list()
            
            # Group by status
            status_breakdown = {}
            total_loan_amount = 0
            
            for item in items:
                status = item.status.value
                if status not in status_breakdown:
                    status_breakdown[status] = {"count": 0, "loan_amount": 0}
                
                status_breakdown[status]["count"] += 1
                status_breakdown[status]["loan_amount"] += item.loan_amount
                
                total_loan_amount += item.loan_amount
            
            return {
                "generated_at": datetime.now(),
                "summary": {
                    "total_items": len(items),
                    "total_loan_amount": total_loan_amount,
                    "average_loan_amount": total_loan_amount / len(items) if items else 0
                },
                "breakdown": {
                    "by_status": status_breakdown
                },
                "items": [
                    {
                        "item_id": str(item.item_id),
                        "description": item.description,
                        "status": item.status.value,
                        "loan_amount": item.loan_amount,
                        "storage_location": item.storage_location,
                        "created_at": item.created_at,
                        "customer_id": str(item.customer_id)
                    }
                    for item in items
                ]
            }
        except Exception as e:
            logger.error(f"Error generating inventory report: {str(e)}")
            raise

    @staticmethod
    async def get_inventory_report_csv() -> str:
        """Get inventory report as CSV"""
        report = await ReportsService.get_inventory_report()
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write headers
        writer.writerow([
            "Item ID", "Description", "Status", "Loan Amount", 
            "Storage Location", "Created Date", "Customer ID"
        ])
        
        # Write data
        for item in report["items"]:
            writer.writerow([
                item["item_id"],
                item["description"],
                item["status"],
                item["loan_amount"],
                item["storage_location"],
                item["created_at"],
                item["customer_id"]
            ])
        
        return output.getvalue()

    @staticmethod
    async def get_financial_report(start_date: date, end_date: date) -> Dict[str, Any]:
        """Get financial summary report"""
        try:
            start_datetime = datetime.combine(start_date, datetime.min.time())
            end_datetime = datetime.combine(end_date, datetime.max.time())
            
            transactions = await Transaction.find(
                And(
                    Transaction.transaction_date >= start_datetime,
                    Transaction.transaction_date <= end_datetime,
                    Transaction.status == TransactionStatus.COMPLETED
                )
            ).to_list()
            
            # Calculate financial metrics
            total_loans_issued = sum(t.principal_amount or 0 for t in transactions if t.transaction_type == TransactionType.PAWN)
            total_interest_collected = sum(t.interest_amount or 0 for t in transactions if t.transaction_type in [TransactionType.RENEWAL, TransactionType.REDEMPTION, TransactionType.PARTIAL_PAYMENT])
            
            # Cash flow analysis
            cash_in = sum(t.total_amount for t in transactions if t.transaction_type in [TransactionType.RENEWAL, TransactionType.REDEMPTION, TransactionType.PARTIAL_PAYMENT])
            cash_out = sum(t.principal_amount or 0 for t in transactions if t.transaction_type == TransactionType.PAWN)
            net_cash_flow = cash_in - cash_out
            
            # Outstanding loans
            active_loans = await Item.find(Item.status == ItemStatus.ACTIVE).to_list()
            total_outstanding = sum(item.loan_amount for item in active_loans)
            
            return {
                "period": {
                    "start_date": start_date,
                    "end_date": end_date
                },
                "revenue": {
                    "interest_collected": total_interest_collected,
                    "total_revenue": total_interest_collected
                },
                "loans": {
                    "total_issued": total_loans_issued,
                    "total_outstanding": total_outstanding,
                    "active_loan_count": len(active_loans)
                },
                "cash_flow": {
                    "cash_in": cash_in,
                    "cash_out": cash_out,
                    "net_cash_flow": net_cash_flow
                },
                "ratios": {
                    "average_loan_amount": total_loans_issued / len([t for t in transactions if t.transaction_type == TransactionType.PAWN]) if any(t.transaction_type == TransactionType.PAWN for t in transactions) else 0
                }
            }
        except Exception as e:
            logger.error(f"Error generating financial report: {str(e)}")
            raise

    @staticmethod
    async def get_customer_activity_report(
        start_date: date, 
        end_date: date, 
        min_transactions: int = 1
    ) -> List[Dict[str, Any]]:
        """Get customer activity report"""
        try:
            start_datetime = datetime.combine(start_date, datetime.min.time())
            end_datetime = datetime.combine(end_date, datetime.max.time())
            
            transactions = await Transaction.find(
                And(
                    Transaction.transaction_date >= start_datetime,
                    Transaction.transaction_date <= end_datetime,
                    Transaction.status == TransactionStatus.COMPLETED
                )
            ).to_list()
            
            # Group transactions by customer
            customer_activity = {}
            for transaction in transactions:
                customer_id = transaction.customer_id
                if customer_id not in customer_activity:
                    customer_activity[customer_id] = {
                        "transaction_count": 0,
                        "total_amount": 0,
                        "loans_taken": 0,
                        "payments_made": 0,
                        "redemptions": 0,
                        "last_transaction": None
                    }
                
                activity = customer_activity[customer_id]
                activity["transaction_count"] += 1
                activity["total_amount"] += transaction.total_amount
                
                if transaction.transaction_type == TransactionType.PAWN:
                    activity["loans_taken"] += 1
                elif transaction.transaction_type in [TransactionType.RENEWAL, TransactionType.PARTIAL_PAYMENT]:
                    activity["payments_made"] += 1
                elif transaction.transaction_type == TransactionType.REDEMPTION:
                    activity["redemptions"] += 1
                
                if not activity["last_transaction"] or transaction.transaction_date > activity["last_transaction"]:
                    activity["last_transaction"] = transaction.transaction_date
            
            # Filter by minimum transactions and get customer details
            result = []
            for customer_id, activity in customer_activity.items():
                if activity["transaction_count"] >= min_transactions:
                    customer = await Customer.find_one(Customer.customer_id == customer_id)
                    if customer:
                        result.append({
                            "customer_id": str(customer_id),
                            "customer_name": f"{customer.first_name} {customer.last_name}",
                            "customer_phone": customer.phone,
                            "customer_email": customer.email,
                            "transaction_count": activity["transaction_count"],
                            "total_amount": activity["total_amount"],
                            "loans_taken": activity["loans_taken"],
                            "payments_made": activity["payments_made"],
                            "redemptions": activity["redemptions"],
                            "last_transaction": activity["last_transaction"],
                            "average_transaction": activity["total_amount"] / activity["transaction_count"]
                        })
            
            # Sort by transaction count (most active first)
            result.sort(key=lambda x: x["transaction_count"], reverse=True)
            return result
        except Exception as e:
            logger.error(f"Error generating customer activity report: {str(e)}")
            raise

    @staticmethod
    async def get_aged_loans_report() -> List[Dict[str, Any]]:
        """Get aged loans report showing how long loans have been outstanding"""
        try:
            # Get all active pawn transactions
            pawn_transactions = await Transaction.find(
                And(
                    Transaction.transaction_type == TransactionType.PAWN,
                    Transaction.loan_status == LoanStatus.ACTIVE
                )
            ).to_list()
            
            result = []
            today = date.today()
            
            for transaction in pawn_transactions:
                # Check if item is still active
                if transaction.item_id:
                    item = await Item.find_one(Item.item_id == transaction.item_id)
                    if item and item.status == ItemStatus.ACTIVE:
                        customer = await Customer.find_one(Customer.customer_id == transaction.customer_id)
                        
                        if customer:
                            days_outstanding = (today - transaction.transaction_date.date()).days
                            days_until_due = (transaction.current_due_date - today).days if transaction.current_due_date else None
                            days_until_forfeit = (transaction.final_forfeit_date - today).days if transaction.final_forfeit_date else None
                            
                            result.append({
                                "transaction_id": str(transaction.transaction_id),
                                "customer_name": f"{customer.first_name} {customer.last_name}",
                                "customer_phone": customer.phone,
                                "item_description": item.description,
                                "loan_amount": transaction.principal_amount or 0,
                                "current_balance": transaction.current_balance or 0,
                                "monthly_interest": transaction.monthly_interest_fee or 0,
                                "loan_date": transaction.transaction_date.date(),
                                "due_date": transaction.current_due_date,
                                "forfeit_date": transaction.final_forfeit_date,
                                "days_outstanding": days_outstanding,
                                "days_until_due": days_until_due,
                                "days_until_forfeit": days_until_forfeit,
                                "status": "overdue" if days_until_due and days_until_due < 0 else "current"
                            })
            
            # Sort by days outstanding (oldest first)
            result.sort(key=lambda x: x["days_outstanding"], reverse=True)
            return result
        except Exception as e:
            logger.error(f"Error generating aged loans report: {str(e)}")
            raise