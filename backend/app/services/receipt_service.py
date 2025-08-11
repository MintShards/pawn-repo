"""
Receipt Generation Service

Comprehensive receipt system for all pawn transaction scenarios including
initial pawn receipts, payment receipts, extension receipts, and final receipts.
Supports 1-10 items per transaction with customer and storage receipt types.
"""

# Standard library imports
from datetime import datetime, timedelta, UTC
from typing import Dict, List, Optional, Any
import uuid

# Third-party imports
from fastapi import HTTPException, status

# Local imports
from app.models.pawn_transaction_model import PawnTransaction, TransactionStatus
from app.models.pawn_item_model import PawnItem
from app.models.payment_model import Payment
from app.models.extension_model import Extension
from app.models.customer_model import Customer
from app.models.user_model import User
from app.services.interest_calculation_service import InterestCalculationService
from app.services.pawn_transaction_service import PawnTransactionService


class ReceiptGenerationError(Exception):
    """Base exception for receipt generation operations"""
    pass


class TransactionNotFoundError(ReceiptGenerationError):
    """Transaction not found error"""
    pass


class ReceiptService:
    """
    Comprehensive receipt generation service for pawn transactions.
    
    Handles all receipt types:
    - Initial pawn receipts (transaction creation)
    - Payment receipts (partial and full payments)  
    - Extension receipts (loan extensions)
    - Final receipts (redemption/completion)
    
    Supports 1-10 items per transaction with customer/storage variants.
    """
    
    @staticmethod
    async def generate_initial_pawn_receipt(
        transaction_id: str,
        receipt_type: str = "customer"
    ) -> Dict[str, Any]:
        """
        Generate receipt for new pawn transaction.
        
        Args:
            transaction_id: Unique transaction identifier
            receipt_type: "customer" or "storage" (affects content detail)
            
        Returns:
            Dictionary with formatted receipt data
            
        Raises:
            TransactionNotFoundError: If transaction doesn't exist
        """
        try:
            # Fetch transaction
            transaction = await PawnTransaction.find_one(
                PawnTransaction.transaction_id == transaction_id
            )
            if not transaction:
                raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
            
            # Fetch related items (1-10 items supported)
            items = await PawnItem.find(
                PawnItem.transaction_id == transaction_id
            ).sort("item_number").to_list()
            
            if not items:
                raise ReceiptGenerationError("No items found for transaction")
            
            # Fetch customer information
            customer = await Customer.find_one(
                Customer.phone_number == transaction.customer_id
            )
            if not customer:
                raise ReceiptGenerationError("Customer information not found")
            
            # Fetch staff member information
            staff = await User.find_one(User.user_id == transaction.created_by_user_id)
            if not staff:
                raise ReceiptGenerationError("Staff member information not found")
            
            # Build receipt data structure
            receipt_data = {
                "receipt_id": str(uuid.uuid4()),
                "receipt_type": "INITIAL PAWN RECEIPT",
                "transaction_id": transaction.transaction_id,
                "date": transaction.pawn_date,
                "customer": {
                    "name": f"{customer.first_name} {customer.last_name}",
                    "phone": customer.phone_number,
                    "customer_id": customer.phone_number,
                    "status": customer.status.value
                },
                "items": [
                    {
                        "number": item.item_number,
                        "description": item.description,
                        "serial_number": item.serial_number or "None",
                        "item_id": item.item_id
                    }
                    for item in items
                ],
                "storage_location": transaction.storage_location,
                "loan_terms": {
                    "loan_amount": f"${transaction.loan_amount}.00",
                    "monthly_interest": f"${transaction.monthly_interest_amount}.00",
                    "maturity_date": transaction.maturity_date.strftime("%B %d, %Y"),
                    "grace_period_ends": transaction.grace_period_end.strftime("%B %d, %Y"),
                    "total_days": "97 days (90 + 7 grace period)",
                    "loan_amount_raw": transaction.loan_amount,
                    "monthly_interest_raw": transaction.monthly_interest_amount
                },
                "staff_member": f"{staff.first_name} {staff.last_name}",
                "staff_id": staff.user_id,
                "transaction_status": transaction.status.value,
                "item_count": len(items),
                "important_notes": [
                    "Pick up anytime within 97 days",
                    "Make partial payments anytime",
                    "Extend loan if needed (1-3 months)",
                    "Cash payments only",
                    "No action after 97 days = forfeiture",
                    "Bring this receipt for all transactions"
                ]
            }
            
            # Add internal notes for storage copies
            if receipt_type == "storage":
                receipt_data["internal_notes"] = transaction.internal_notes
                receipt_data["storage_instructions"] = [
                    f"Store in location: {transaction.storage_location}",
                    f"Items: {len(items)} pieces",
                    "Verify serial numbers if applicable",
                    "Check condition monthly"
                ]
            
            return receipt_data
            
        except Exception as e:
            if isinstance(e, (TransactionNotFoundError, ReceiptGenerationError)):
                raise
            raise ReceiptGenerationError(f"Failed to generate initial receipt: {str(e)}")
    
    @staticmethod
    async def generate_payment_receipt(
        transaction_id: str,
        payment_id: str,
        receipt_type: str = "customer"
    ) -> Dict[str, Any]:
        """
        Generate receipt for payment transaction.
        
        Args:
            transaction_id: Unique transaction identifier
            payment_id: Unique payment identifier
            receipt_type: "customer" or "storage"
            
        Returns:
            Dictionary with formatted receipt data
        """
        try:
            # Fetch transaction and payment
            transaction = await PawnTransaction.find_one(
                PawnTransaction.transaction_id == transaction_id
            )
            if not transaction:
                raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
                
            payment = await Payment.find_one(Payment.payment_id == payment_id)
            if not payment:
                raise ReceiptGenerationError(f"Payment {payment_id} not found")
            
            # Fetch related items
            items = await PawnItem.find(
                PawnItem.transaction_id == transaction_id
            ).sort("item_number").to_list()
            
            # Fetch customer and staff information
            customer = await Customer.find_one(
                Customer.phone_number == transaction.customer_id
            )
            staff = await User.find_one(User.user_id == payment.processed_by_user_id)
            
            # Get current balance information
            try:
                balance_info = await PawnTransactionService.calculate_current_balance(transaction_id)
            except Exception:
                # Fallback calculation if service fails
                balance_info = {
                    "current_balance": payment.balance_after_payment,
                    "loan_amount": transaction.loan_amount,
                    "interest_accrued": transaction.total_due - transaction.loan_amount,
                    "extension_fees": 0,
                    "total_payments": payment.payment_amount
                }
            
            # Determine payment status
            is_full_payment = balance_info["current_balance"] == 0
            
            receipt_data = {
                "receipt_id": str(uuid.uuid4()),
                "receipt_type": "FULL PAYMENT RECEIPT" if is_full_payment else "PARTIAL PAYMENT RECEIPT",
                "transaction_id": transaction.transaction_id,
                "payment_id": payment.payment_id,
                "date": payment.payment_date,
                "customer": {
                    "name": f"{customer.first_name} {customer.last_name}",
                    "phone": customer.phone_number,
                    "customer_id": customer.phone_number
                },
                "items": [
                    {
                        "number": item.item_number,
                        "description": item.description,
                        "serial_number": item.serial_number or "None"
                    }
                    for item in items
                ],
                "payment_details": {
                    "payment_amount": f"${payment.payment_amount}.00",
                    "payment_date": payment.payment_date.strftime("%B %d, %Y at %I:%M %p"),
                    "payment_method": payment.payment_method,
                    "remaining_balance": f"${balance_info['current_balance']}.00",
                    "status": "PAID IN FULL - ITEMS RELEASED" if is_full_payment else "PARTIAL PAYMENT APPLIED",
                    "receipt_number": payment.receipt_number
                },
                "balance_breakdown": {
                    "original_loan": f"${balance_info['loan_amount']}.00",
                    "interest_accrued": f"${balance_info['interest_accrued']}.00", 
                    "extension_fees": f"${balance_info['extension_fees']}.00",
                    "total_payments": f"${balance_info['total_payments']}.00",
                    "current_balance": f"${balance_info['current_balance']}.00"
                },
                "staff_member": f"{staff.first_name} {staff.last_name}",
                "staff_id": staff.user_id,
                "item_count": len(items),
                "transaction_status": "redeemed" if is_full_payment else transaction.status.value
            }
            
            # Add appropriate next steps
            if is_full_payment:
                receipt_data["redemption_note"] = "Items ready for pickup - Bring this receipt"
                receipt_data["next_steps"] = [
                    "Bring this receipt to retrieve items",
                    "Items released from storage",
                    "Transaction completed successfully"
                ]
            else:
                receipt_data["next_steps"] = [
                    f"Remaining balance: ${balance_info['current_balance']}.00",
                    "Interest continues on remaining balance",
                    "Make additional payments anytime",
                    "Full payment required for item release"
                ]
            
            # Add storage instructions for storage receipts
            if receipt_type == "storage":
                if is_full_payment:
                    receipt_data["storage_instructions"] = [
                        "RELEASE ITEMS TO CUSTOMER",
                        "Verify customer identity",
                        "Check receipt authenticity",
                        "Update storage records"
                    ]
                else:
                    receipt_data["storage_instructions"] = [
                        "Items remain in storage",
                        f"Balance: ${balance_info['current_balance']}.00",
                        "Continue monthly condition checks"
                    ]
            
            return receipt_data
            
        except Exception as e:
            if isinstance(e, (TransactionNotFoundError, ReceiptGenerationError)):
                raise
            raise ReceiptGenerationError(f"Failed to generate payment receipt: {str(e)}")
    
    @staticmethod
    async def generate_extension_receipt(
        transaction_id: str,
        extension_id: str,
        receipt_type: str = "customer"
    ) -> Dict[str, Any]:
        """
        Generate receipt for loan extension.
        
        Args:
            transaction_id: Unique transaction identifier
            extension_id: Unique extension identifier  
            receipt_type: "customer" or "storage"
            
        Returns:
            Dictionary with formatted receipt data
        """
        try:
            # Fetch transaction and extension
            transaction = await PawnTransaction.find_one(
                PawnTransaction.transaction_id == transaction_id
            )
            if not transaction:
                raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
                
            extension = await Extension.find_one(Extension.extension_id == extension_id)
            if not extension:
                raise ReceiptGenerationError(f"Extension {extension_id} not found")
            
            # Fetch related items
            items = await PawnItem.find(
                PawnItem.transaction_id == transaction_id
            ).sort("item_number").to_list()
            
            # Fetch customer and staff information
            customer = await Customer.find_one(
                Customer.phone_number == transaction.customer_id
            )
            staff = await User.find_one(User.user_id == extension.processed_by_user_id)
            
            receipt_data = {
                "receipt_id": str(uuid.uuid4()),
                "receipt_type": "LOAN EXTENSION RECEIPT",
                "transaction_id": transaction.transaction_id,
                "extension_id": extension.extension_id,
                "date": extension.extension_date,
                "customer": {
                    "name": f"{customer.first_name} {customer.last_name}",
                    "phone": customer.phone_number,
                    "customer_id": customer.phone_number
                },
                "items": [
                    {
                        "number": item.item_number,
                        "description": item.description,
                        "serial_number": item.serial_number or "None"
                    }
                    for item in items
                ],
                "extension_details": {
                    "months_extended": extension.extension_months,
                    "fee_per_month": f"${extension.extension_fee_per_month}.00",
                    "total_extension_fee": f"${extension.total_extension_fee}.00",
                    "original_maturity": extension.original_maturity_date.strftime("%B %d, %Y"),
                    "new_maturity_date": extension.new_maturity_date.strftime("%B %d, %Y"),
                    "new_grace_period_ends": extension.new_grace_period_end.strftime("%B %d, %Y"),
                    "extension_reason": extension.extension_reason
                },
                "staff_member": f"{staff.first_name} {staff.last_name}",
                "staff_id": staff.user_id,
                "item_count": len(items),
                "transaction_status": transaction.status.value,
                "important_notes": [
                    f"Loan extended for {extension.extension_months} month{'s' if extension.extension_months > 1 else ''}",
                    f"New pickup deadline: {extension.new_maturity_date.strftime('%B %d, %Y')}",
                    "Monthly interest continues as normal",
                    f"Extension fee of ${extension.total_extension_fee}.00 paid in full",
                    "Items remain in secure storage"
                ]
            }
            
            # Add storage instructions for storage receipts
            if receipt_type == "storage":
                receipt_data["internal_notes"] = extension.internal_notes
                receipt_data["storage_instructions"] = [
                    f"Extension processed: {extension.extension_months} months",
                    f"New maturity: {extension.new_maturity_date.strftime('%B %d, %Y')}",
                    f"Fee collected: ${extension.total_extension_fee}.00",
                    "Update storage tags with new dates"
                ]
            
            return receipt_data
            
        except Exception as e:
            if isinstance(e, (TransactionNotFoundError, ReceiptGenerationError)):
                raise
            raise ReceiptGenerationError(f"Failed to generate extension receipt: {str(e)}")
    
    @staticmethod
    async def format_receipt_for_printing(receipt_data: Dict[str, Any]) -> str:
        """
        Format receipt data as printable text.
        
        Handles 1-10 items with consistent formatting and professional layout.
        
        Args:
            receipt_data: Receipt data dictionary
            
        Returns:
            Formatted receipt text ready for printing
        """
        receipt_text = f"""
================================================
                 PAWN SHOP RECEIPT
================================================

{receipt_data['receipt_type']}
Receipt ID: {receipt_data['receipt_id']}
Transaction ID: {receipt_data['transaction_id']}
Date: {receipt_data['date'].strftime('%B %d, %Y at %I:%M %p')}

CUSTOMER INFORMATION:
Name: {receipt_data['customer']['name']}
Phone: {receipt_data['customer']['phone']}
Customer ID: {receipt_data['customer']['customer_id']}

ITEMS PAWNED ({receipt_data['item_count']} item{'s' if receipt_data['item_count'] > 1 else ''}):
"""
        
        # Add items (handle 1-10 items with consistent formatting)
        for item in receipt_data['items']:
            receipt_text += f"   {item['number']}. {item['description']}"
            if item['serial_number'] != "None":
                receipt_text += f" (SN: {item['serial_number']})"
            receipt_text += "\n"
        
        # Add storage location if present
        if 'storage_location' in receipt_data:
            receipt_text += f"\nStorage Location: {receipt_data['storage_location']}\n"
        
        # Add loan terms for initial receipts
        if 'loan_terms' in receipt_data:
            receipt_text += f"""
LOAN TERMS:
Loan Amount: {receipt_data['loan_terms']['loan_amount']}
Monthly Interest: {receipt_data['loan_terms']['monthly_interest']}
Maturity Date: {receipt_data['loan_terms']['maturity_date']}
Grace Period Ends: {receipt_data['loan_terms']['grace_period_ends']}
Total Term: {receipt_data['loan_terms']['total_days']}
"""
        
        # Add payment details for payment receipts
        if 'payment_details' in receipt_data:
            receipt_text += f"""
PAYMENT DETAILS:
Payment Amount: {receipt_data['payment_details']['payment_amount']}
Payment Date: {receipt_data['payment_details']['payment_date']}
Remaining Balance: {receipt_data['payment_details']['remaining_balance']}
Status: {receipt_data['payment_details']['status']}
"""
            if receipt_data['payment_details']['receipt_number']:
                receipt_text += f"Receipt Number: {receipt_data['payment_details']['receipt_number']}\n"
        
        # Add extension details for extension receipts
        if 'extension_details' in receipt_data:
            receipt_text += f"""
EXTENSION DETAILS:
Months Extended: {receipt_data['extension_details']['months_extended']}
Extension Fee: {receipt_data['extension_details']['total_extension_fee']}
Original Maturity: {receipt_data['extension_details']['original_maturity']}
New Maturity Date: {receipt_data['extension_details']['new_maturity_date']}
New Grace Period Ends: {receipt_data['extension_details']['new_grace_period_ends']}
"""
        
        # Add important notes
        if 'important_notes' in receipt_data:
            receipt_text += "\nIMPORTANT NOTES:\n"
            for note in receipt_data['important_notes']:
                receipt_text += f"   • {note}\n"
        
        # Add next steps if present
        if 'next_steps' in receipt_data:
            receipt_text += "\nNEXT STEPS:\n"
            for step in receipt_data['next_steps']:
                receipt_text += f"   • {step}\n"
        
        receipt_text += f"""
Staff Member: {receipt_data['staff_member']}
Transaction Status: {receipt_data['transaction_status'].upper()}

================================================
              Thank you for your business!
================================================
        """
        
        return receipt_text.strip()
    
    @staticmethod
    async def get_transaction_receipt_summary(transaction_id: str) -> Dict[str, Any]:
        """
        Get summary of all receipts generated for a transaction.
        
        Args:
            transaction_id: Unique transaction identifier
            
        Returns:
            Summary of receipt generation activity
        """
        try:
            transaction = await PawnTransaction.find_one(
                PawnTransaction.transaction_id == transaction_id
            )
            if not transaction:
                raise TransactionNotFoundError(f"Transaction {transaction_id} not found")
            
            # Count related records
            payments = await Payment.find(Payment.transaction_id == transaction_id).to_list()
            extensions = await Extension.find(Extension.transaction_id == transaction_id).to_list()
            items = await PawnItem.find(PawnItem.transaction_id == transaction_id).to_list()
            
            summary = {
                "transaction_id": transaction_id,
                "receipt_types_available": [
                    "initial_pawn",
                    "payment" if payments else None,
                    "extension" if extensions else None
                ],
                "total_payments": len(payments),
                "total_extensions": len(extensions), 
                "item_count": len(items),
                "transaction_status": transaction.status.value,
                "receipts_generated": {
                    "initial_pawn": True,  # Always available
                    "payments": len(payments),
                    "extensions": len(extensions)
                }
            }
            
            # Remove None values
            summary["receipt_types_available"] = [r for r in summary["receipt_types_available"] if r]
            
            return summary
            
        except Exception as e:
            if isinstance(e, TransactionNotFoundError):
                raise
            raise ReceiptGenerationError(f"Failed to get receipt summary: {str(e)}")