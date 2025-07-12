# backend/app/services/reports_service.py - FIXED VERSION
from typing import Dict, List, Any, Optional
from datetime import date, datetime, timedelta
from app.models.customer_model import Customer
from app.models.item_model import Item, ItemStatus
from app.models.transaction_model import Transaction, TransactionType, TransactionStatus, LoanStatus
from app.models.user_model import User
from beanie.operators import And
import csv
import io
import logging
from decimal import Decimal
from ..services.receipt_service import receipt_service

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

    @staticmethod
    async def get_daily_summary_report(report_date: date) -> Dict[str, Any]:
        """Get comprehensive daily operations summary"""
        try:
            start_datetime = datetime.combine(report_date, datetime.min.time())
            end_datetime = datetime.combine(report_date, datetime.max.time())
            
            # Get all transactions for the day
            daily_transactions = await Transaction.find(
                And(
                    Transaction.transaction_date >= start_datetime,
                    Transaction.transaction_date <= end_datetime,
                    Transaction.status == TransactionStatus.COMPLETED
                )
            ).to_list()
            
            # Calculate daily metrics
            loans_issued = [t for t in daily_transactions if t.transaction_type == TransactionType.PAWN]
            payments_received = [t for t in daily_transactions if t.transaction_type in [
                TransactionType.RENEWAL, TransactionType.REDEMPTION, TransactionType.PARTIAL_PAYMENT
            ]]
            redemptions = [t for t in daily_transactions if t.transaction_type == TransactionType.REDEMPTION]
            
            total_loans_amount = sum(t.principal_amount or 0 for t in loans_issued)
            total_payments_amount = sum(t.total_amount for t in payments_received)
            total_interest_collected = sum(t.interest_amount or 0 for t in payments_received)
            
            # Cash flow calculations
            cash_out = total_loans_amount  # Money given to customers
            cash_in = total_payments_amount  # Money received from customers
            net_cash_flow = cash_in - cash_out
            
            # Outstanding loans at end of day
            active_items = await Item.find(Item.status == ItemStatus.ACTIVE).to_list()
            total_outstanding = sum(item.loan_amount for item in active_items)
            
            return {
                "report_date": report_date,
                "generated_at": datetime.now(),
                "daily_activity": {
                    "loans_issued": {
                        "count": len(loans_issued),
                        "total_amount": total_loans_amount,
                        "average_amount": total_loans_amount / len(loans_issued) if loans_issued else 0
                    },
                    "payments_received": {
                        "count": len(payments_received),
                        "total_amount": total_payments_amount,
                        "interest_collected": total_interest_collected
                    },
                    "redemptions": {
                        "count": len(redemptions),
                        "total_amount": sum(t.total_amount for t in redemptions)
                    }
                },
                "cash_flow": {
                    "cash_in": cash_in,
                    "cash_out": cash_out,
                    "net_flow": net_cash_flow,
                    "outstanding_loans": total_outstanding
                },
                "summary": {
                    "total_transactions": len(daily_transactions),
                    "unique_customers": len(set(t.customer_id for t in daily_transactions)),
                    "active_items_count": len(active_items)
                }
            }
        except Exception as e:
            logger.error(f"Error generating daily summary report: {str(e)}")
            raise

    @staticmethod
    async def get_performance_metrics(start_date: date, end_date: date) -> Dict[str, Any]:
        """Get business performance metrics"""
        try:
            start_datetime = datetime.combine(start_date, datetime.min.time())
            end_datetime = datetime.combine(end_date, datetime.max.time())
            
            # Get transactions for the period
            transactions = await Transaction.find(
                And(
                    Transaction.transaction_date >= start_datetime,
                    Transaction.transaction_date <= end_datetime,
                    Transaction.status == TransactionStatus.COMPLETED
                )
            ).to_list()
            
            # Calculate loan performance
            loans = [t for t in transactions if t.transaction_type == TransactionType.PAWN]
            payments = [t for t in transactions if t.transaction_type in [
                TransactionType.RENEWAL, TransactionType.REDEMPTION, TransactionType.PARTIAL_PAYMENT
            ]]
            redemptions = [t for t in transactions if t.transaction_type == TransactionType.REDEMPTION]
            
            # Revenue metrics
            total_revenue = sum(t.interest_amount or 0 for t in payments)
            average_interest_per_loan = total_revenue / len(loans) if loans else 0
            
            # Customer metrics
            unique_customers = len(set(t.customer_id for t in transactions))
            repeat_customers = len([cid for cid in set(t.customer_id for t in transactions) 
                                   if len([t for t in transactions if t.customer_id == cid]) > 1])
            
            # Loan lifecycle metrics
            redemption_rate = len(redemptions) / len(loans) if loans else 0
            average_loan_amount = sum(t.principal_amount or 0 for t in loans) / len(loans) if loans else 0
            
            # Period analysis
            days_in_period = (end_date - start_date).days + 1
            daily_average_revenue = total_revenue / days_in_period if days_in_period > 0 else 0
            
            return {
                "period": {
                    "start_date": start_date,
                    "end_date": end_date,
                    "days": days_in_period
                },
                "revenue_metrics": {
                    "total_revenue": total_revenue,
                    "average_interest_per_loan": average_interest_per_loan,
                    "daily_average_revenue": daily_average_revenue
                },
                "loan_metrics": {
                    "loans_issued": len(loans),
                    "total_loan_amount": sum(t.principal_amount or 0 for t in loans),
                    "average_loan_amount": average_loan_amount,
                    "redemption_rate": redemption_rate,
                    "redemptions_count": len(redemptions)
                },
                "customer_metrics": {
                    "unique_customers": unique_customers,
                    "repeat_customers": repeat_customers,
                    "repeat_customer_rate": repeat_customers / unique_customers if unique_customers > 0 else 0,
                    "average_transactions_per_customer": len(transactions) / unique_customers if unique_customers > 0 else 0
                },
                "activity_metrics": {
                    "total_transactions": len(transactions),
                    "payments_received": len(payments),
                    "daily_transaction_average": len(transactions) / days_in_period if days_in_period > 0 else 0
                }
            }
        except Exception as e:
            logger.error(f"Error generating performance metrics: {str(e)}")
            raise

    @staticmethod
    async def get_cash_flow_report(start_date: date, end_date: date) -> Dict[str, Any]:
        """Get detailed cash flow report"""
        try:
            start_datetime = datetime.combine(start_date, datetime.min.time())
            end_datetime = datetime.combine(end_date, datetime.max.time())
            
            # Get all transactions for the period
            transactions = await Transaction.find(
                And(
                    Transaction.transaction_date >= start_datetime,
                    Transaction.transaction_date <= end_datetime,
                    Transaction.status == TransactionStatus.COMPLETED
                )
            ).sort(+Transaction.transaction_date).to_list()
            
            # Calculate daily cash flows
            daily_flows = {}
            current_date = start_date
            while current_date <= end_date:
                daily_flows[current_date.isoformat()] = {
                    "date": current_date,
                    "loans_disbursed": Decimal('0'),
                    "payments_received": Decimal('0'),
                    "net_flow": Decimal('0'),
                    "transaction_count": 0
                }
                current_date += timedelta(days=1)
            
            # Process transactions
            for transaction in transactions:
                tx_date = transaction.transaction_date.date()
                day_key = tx_date.isoformat()
                
                if day_key in daily_flows:
                    daily_flows[day_key]["transaction_count"] += 1
                    
                    if transaction.transaction_type == TransactionType.PAWN:
                        daily_flows[day_key]["loans_disbursed"] += Decimal(str(transaction.principal_amount or 0))
                    elif transaction.transaction_type in [
                        TransactionType.RENEWAL, TransactionType.REDEMPTION, TransactionType.PARTIAL_PAYMENT
                    ]:
                        daily_flows[day_key]["payments_received"] += Decimal(str(transaction.total_amount))
            
            # Calculate net flows
            for day_data in daily_flows.values():
                day_data["net_flow"] = day_data["payments_received"] - day_data["loans_disbursed"]
            
            # Summary calculations
            total_disbursed = sum(day["loans_disbursed"] for day in daily_flows.values())
            total_received = sum(day["payments_received"] for day in daily_flows.values())
            net_cash_flow = total_received - total_disbursed
            
            return {
                "period": {
                    "start_date": start_date,
                    "end_date": end_date
                },
                "summary": {
                    "total_loans_disbursed": float(total_disbursed),
                    "total_payments_received": float(total_received),
                    "net_cash_flow": float(net_cash_flow),
                    "total_transactions": sum(day["transaction_count"] for day in daily_flows.values())
                },
                "daily_flows": [
                    {
                        "date": day_data["date"],
                        "loans_disbursed": float(day_data["loans_disbursed"]),
                        "payments_received": float(day_data["payments_received"]),
                        "net_flow": float(day_data["net_flow"]),
                        "transaction_count": day_data["transaction_count"]
                    }
                    for day_data in daily_flows.values()
                ]
            }
        except Exception as e:
            logger.error(f"Error generating cash flow report: {str(e)}")
            raise

    @staticmethod
    async def get_audit_trail_report(
        start_date: date,
        end_date: date,
        user_id: Optional[str] = None,
        action_type: Optional[str] = None,
        entity_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get audit trail report (requires importing audit model when available)"""
        try:
            # This would be implemented when audit logging is available
            # For now, return transaction-based audit information
            start_datetime = datetime.combine(start_date, datetime.min.time())
            end_datetime = datetime.combine(end_date, datetime.max.time())
            
            transactions = await Transaction.find(
                And(
                    Transaction.created_at >= start_datetime,
                    Transaction.created_at <= end_datetime
                )
            ).sort(-Transaction.created_at).to_list()
            
            audit_entries = []
            for transaction in transactions:
                # Get user details
                user = await User.find_one(User.user_id == transaction.created_by) if transaction.created_by else None
                
                audit_entries.append({
                    "timestamp": transaction.created_at,
                    "user_id": str(transaction.created_by) if transaction.created_by else None,
                    "user_name": f"{user.first_name} {user.last_name}" if user else "System",
                    "action": f"CREATE_{transaction.transaction_type.value.upper()}",
                    "entity_type": "Transaction",
                    "entity_id": str(transaction.transaction_id),
                    "details": {
                        "transaction_type": transaction.transaction_type.value,
                        "amount": float(transaction.total_amount),
                        "customer_id": str(transaction.customer_id) if transaction.customer_id else None
                    }
                })
            
            return {
                "period": {
                    "start_date": start_date,
                    "end_date": end_date
                },
                "filters": {
                    "user_id": user_id,
                    "action_type": action_type,
                    "entity_type": entity_type
                },
                "summary": {
                    "total_entries": len(audit_entries),
                    "unique_users": len(set(entry["user_id"] for entry in audit_entries if entry["user_id"])),
                    "unique_actions": len(set(entry["action"] for entry in audit_entries))
                },
                "entries": audit_entries
            }
        except Exception as e:
            logger.error(f"Error generating audit trail report: {str(e)}")
            raise

    @staticmethod
    async def export_report_pdf(
        report_type: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        user: User = None
    ) -> io.BytesIO:
        """Export report as PDF using the receipt service"""
        try:
            # Generate report data based on type
            if report_type == "daily-summary":
                if not start_date:
                    start_date = date.today()
                report_data = await ReportsService.get_daily_summary_report(start_date)
            elif report_type == "financial":
                if not start_date or not end_date:
                    raise ValueError("Financial report requires start_date and end_date")
                report_data = await ReportsService.get_financial_report(start_date, end_date)
            elif report_type == "performance-metrics":
                if not start_date or not end_date:
                    raise ValueError("Performance metrics report requires start_date and end_date")
                report_data = await ReportsService.get_performance_metrics(start_date, end_date)
            elif report_type == "cash-flow":
                if not start_date or not end_date:
                    raise ValueError("Cash flow report requires start_date and end_date")
                report_data = await ReportsService.get_cash_flow_report(start_date, end_date)
            else:
                raise ValueError(f"Unsupported report type: {report_type}")
            
            # Generate PDF using report data
            pdf_buffer = await ReportsService._generate_report_pdf(report_type, report_data, user)
            return pdf_buffer
            
        except Exception as e:
            logger.error(f"Error exporting PDF report: {str(e)}")
            raise

    @staticmethod
    async def _generate_report_pdf(report_type: str, report_data: Dict[str, Any], user: User) -> io.BytesIO:
        """Generate PDF from report data (simplified implementation)"""
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib import colors
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        title = f"{report_type.replace('-', ' ').title()} Report"
        story.append(Paragraph(title, styles['Title']))
        story.append(Spacer(1, 12))
        
        # Report metadata
        if 'period' in report_data:
            period_text = f"Period: {report_data['period'].get('start_date', '')} to {report_data['period'].get('end_date', '')}"
            story.append(Paragraph(period_text, styles['Normal']))
        
        story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
        if user:
            story.append(Paragraph(f"Generated by: {user.first_name} {user.last_name}", styles['Normal']))
        story.append(Spacer(1, 12))
        
        # Report content (simplified - would be enhanced based on report type)
        if report_type == "daily-summary" and 'daily_activity' in report_data:
            activity = report_data['daily_activity']
            
            data = [
                ["Metric", "Count", "Amount"],
                ["Loans Issued", str(activity['loans_issued']['count']), f"${activity['loans_issued']['total_amount']:.2f}"],
                ["Payments Received", str(activity['payments_received']['count']), f"${activity['payments_received']['total_amount']:.2f}"],
                ["Redemptions", str(activity['redemptions']['count']), f"${activity['redemptions']['total_amount']:.2f}"]
            ]
            
            table = Table(data)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 14),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            story.append(table)
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer