# backend/app/api/api_v1/handlers/transaction.py - SIMPLIFIED VERSION 1
from fastapi import APIRouter, HTTPException, status, Depends, Query
from fastapi.responses import StreamingResponse
from typing import List, Optional
from uuid import UUID
from datetime import date
from decimal import Decimal
from app.schemas.transaction_schema import (
    PawnTransactionCreate, PaymentCreate, PaymentResultOut, LoanStatusOut, 
    LoanScenarioOut, StoreScenarioResponse, TransactionOut, TransactionSearch
)
from app.models.transaction_model import TransactionType, LoanStatus
from app.services.transaction_service import TransactionService
from app.services.receipt_service import receipt_service
from app.api.deps.user_deps import get_current_user
from app.models.user_model import User
import logging

logger = logging.getLogger(__name__)
transaction_router = APIRouter()

# ========== PAWN LOAN CREATION ==========

@transaction_router.post("/pawn", summary="Create a new pawn loan", response_model=TransactionOut)
async def create_pawn_loan(
    pawn_data: PawnTransactionCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Create a new pawn loan transaction.
    
    **Store Policy Implementation (Simplified Version 1):**
    - 1-month initial term
    - Cash only
    - Principal amount goes to customer
    - Monthly interest fee for renewals
    - 3-month + 1-week grace period before forfeiture
    
    **Example:**
    Customer pawns ring for $100 with $15/month interest.
    Due: 30 days from today. Forfeit: 97 days from today.
    """
    try:
        transaction = await TransactionService.create_pawn_loan(pawn_data, current_user.user_id)
        return transaction
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating pawn loan: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create pawn loan"
        )

# ========== SMART PAYMENT PROCESSING ==========

@transaction_router.post("/payment", summary="Process any payment with smart allocation", response_model=PaymentResultOut)
async def process_payment(
    payment_data: PaymentCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Process any payment with intelligent allocation.
    
    **Smart Payment Logic:**
    - Automatically determines if renewal, partial payment, or full redemption
    - Applies interest first, then principal
    - Calculates new due dates from original due date (store policy)
    - Handles overpayments appropriately
    
    **Store Scenarios Supported:**
    - **Interest-only renewal**: Pay monthly fee to extend
    - **Partial payment**: Pay toward principal + interest 
    - **Full redemption**: Pay complete balance
    - **Advance payment**: Pay multiple months ahead
    """
    try:
        result = await TransactionService.process_payment(payment_data, current_user.user_id)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error processing payment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process payment"
        )

# ========== LOAN STATUS & SCENARIOS ==========

@transaction_router.get("/loan/{loan_id}/status", summary="Get comprehensive loan status", response_model=LoanStatusOut)
async def get_loan_status(
    loan_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """
    Get complete loan status including all financial details and available actions.
    
    **Returns:**
    - Current balance and amount owed
    - Payment history and renewal count
    - Grace period status
    - Available payment options
    - Forfeiture eligibility
    """
    try:
        status_info = await TransactionService.get_loan_status(loan_id)
        return status_info
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting loan status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get loan status"
        )

@transaction_router.get("/loan/{loan_id}/scenarios", summary="Get payment scenarios", response_model=List[LoanScenarioOut])
async def get_payment_scenarios(
    loan_id: UUID,
    payment_date: Optional[date] = Query(None, description="Date to calculate scenarios for"),
    current_user: User = Depends(get_current_user)
):
    """
    Get payment scenarios showing customer options.
    
    **Scenarios Include:**
    - **Interest Only**: Minimum payment to extend loan
    - **Interest + Partial Principal**: Reduce balance while extending
    - **Full Redemption**: Pay off loan completely
    
    **Shows for each scenario:**
    - Exact payment amount required
    - How payment is allocated (interest/principal)
    - Resulting balance after payment
    - New due date
    """
    try:
        scenarios = await TransactionService.get_payment_scenarios(loan_id, payment_date)
        return scenarios
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting payment scenarios: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get payment scenarios"
        )

# ========== TRANSACTION SEARCH ==========

@transaction_router.post("/search", summary="Search transactions with filters", response_model=List[TransactionOut])
async def search_transactions(
    search_params: TransactionSearch,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Number of records to return"),
    current_user: User = Depends(get_current_user)
):
    """
    Search transactions based on various criteria.
    
    **Search Parameters:**
    - **customer_id**: Filter by specific customer
    - **transaction_type**: Filter by transaction type (pawn, payment, etc.)
    - **loan_status**: Filter by loan status (active, overdue, etc.)
    - **start_date/end_date**: Filter by date range
    - **is_overdue**: Filter overdue transactions
    
    **Returns:**
    List of matching transactions with all details
    """
    try:
        transactions = await TransactionService.search_transactions(search_params, skip, limit)
        return transactions
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error searching transactions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search transactions"
        )

@transaction_router.get("/customer/{customer_id}/active", summary="Get active loans for customer", response_model=List[TransactionOut])
async def get_customer_active_loans(
    customer_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """
    Get all active loans for a specific customer.
    
    **Returns:**
    List of active pawn transactions for the customer
    """
    try:
        search_params = TransactionSearch(
            customer_id=customer_id,
            transaction_type=TransactionType.PAWN,
            loan_status=LoanStatus.ACTIVE
        )
        transactions = await TransactionService.search_transactions(search_params, 0, 100)
        return transactions
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting customer active loans: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get customer loans"
        )

# ========== STORE SCENARIO TESTING ==========

@transaction_router.post("/test-scenario/{scenario_name}", summary="Test store scenarios", response_model=StoreScenarioResponse)
async def test_store_scenario(
    scenario_name: str,
    customer_id: UUID,
    item_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """
    Test specific store scenarios for validation.
    
    **Available Scenarios:**
    - **simple_redemption**: Pawn $100, redeem for $115 after 15 days
    - **extension_by_interest**: Borrow $500, pay $75 to extend, owe $575
    - **partial_payment_rollover**: Owe $1150, pay $500, $650 rolls over
    
    **Returns:**
    - Success/failure status
    - All transactions created
    - Final loan balance and status
    - Detailed breakdown of scenario
    """
    try:
        result = await TransactionService.test_store_scenario(
            scenario_name=scenario_name,
            customer_id=customer_id,
            item_id=item_id,
            created_by=current_user.user_id
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error testing scenario: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to test scenario"
        )

# ========== FORFEITURE ==========

@transaction_router.post("/forfeit/{loan_id}", summary="Mark loan as forfeited", response_model=TransactionOut)
async def mark_loan_forfeited(
    loan_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """
    Mark a loan as forfeited (item becomes shop property).
    Only allowed after 3+ months without payment + 1 week grace.
    """
    try:
        transaction = await TransactionService.mark_loan_forfeited(loan_id, current_user.user_id)
        return transaction
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error marking loan forfeited: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark loan as forfeited"
        )

# ========== STORE POLICY HELPERS ==========

@transaction_router.get("/policy/payment-rules", summary="Get store payment rules")
async def get_payment_rules(
    current_user: User = Depends(get_current_user)
):
    """
    Get store payment policy rules for staff reference.
    """
    return {
        "payment_method": "Cash only",
        "minimum_payment": "Monthly interest fee",
        "extension_period": "Full months only (30, 60, 90 days)",
        "grace_period": "1 week after 3 months no activity",
        "forfeiture": "3 months + 1 week from original due date",
        "renewal_calculation": "Always from original due date",
        "advance_payments": "Allowed - pay multiple months ahead",
        "partial_payments": "Allowed - applied to principal after interest",
        "overpayments": "Noted but not applied to loan terms"
    }

@transaction_router.get("/policy/scenarios", summary="Get store scenario examples")
async def get_scenario_examples(
    current_user: User = Depends(get_current_user)
):
    """
    Get examples of common store scenarios for staff training.
    """
    return {
        "scenarios": [
            {
                "name": "Simple Redemption",
                "description": "Customer pawns item Jan 1, redeems Jan 15",
                "example": "Pawn $100 + $15 interest = $115 to redeem"
            },
            {
                "name": "Interest Extension", 
                "description": "Customer pays interest to extend loan",
                "example": "Owe $575, pay $75 interest, still owe $575 next month"
            },
            {
                "name": "Partial Payment",
                "description": "Customer pays part of what's owed",
                "example": "Owe $1150, pay $500, remaining $650 + interest rolls over"
            },
            {
                "name": "Advance Payment",
                "description": "Customer pays multiple months ahead",
                "example": "Pay $225 (3 months interest) extends 3 months from original due"
            }
        ],
        "key_rules": [
            "Renewals always calculated from original due date",
            "Interest paid first, then principal",
            "Grace period = 1 week after 3 months no activity",
            "Forfeiture = 3 months + 1 week from original due"
        ]
    }

# ========== RECEIPT GENERATION ==========

@transaction_router.get("/loan/{loan_id}/receipt", summary="Generate transaction receipt PDF")
async def generate_transaction_receipt(
    loan_id: UUID,
    receipt_type: str = Query("customer", description="Type of receipt: 'customer' or 'storage'"),
    current_user: User = Depends(get_current_user)
):
    """
    Generate a PDF receipt for a pawn transaction.
    
    **Receipt Types:**
    - **customer**: Receipt for customer copy
    - **storage**: Receipt for storage/internal copy
    
    **Returns:** PDF file for download/printing
    """
    try:
        # Get transaction data
        from app.services.customer_service import CustomerService
        from app.services.item_service import ItemService
        
        # Get transaction details
        transaction = await TransactionService.get_transaction_by_id(loan_id)
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )
        
        # Get related data
        customer = await CustomerService.get_customer_by_id(transaction.customer_id)
        items = await ItemService.get_items_by_transaction_id(loan_id)
        
        # Generate PDF
        pdf_buffer = await receipt_service.generate_transaction_receipt(
            transaction=transaction,
            customer=customer,
            items=items,
            user=current_user,
            receipt_type=receipt_type
        )
        
        # Return as streaming response
        filename = f"receipt_{transaction.transaction_number}_{receipt_type}.pdf"
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error generating receipt: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate receipt"
        )

@transaction_router.post("/payment-receipt", summary="Generate payment receipt PDF")
async def generate_payment_receipt(
    loan_id: UUID,
    payment_amount: Decimal,
    current_user: User = Depends(get_current_user)
):
    """
    Generate a PDF receipt for a payment transaction.
    
    **Use after processing payment to provide customer receipt.**
    """
    try:
        # Get transaction data
        from app.services.customer_service import CustomerService
        
        transaction = await TransactionService.get_transaction_by_id(loan_id)
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )
        
        customer = await CustomerService.get_customer_by_id(transaction.customer_id)
        
        # Calculate new balance (simplified - in real implementation this would come from payment processing)
        new_balance = transaction.current_balance - payment_amount
        if new_balance < 0:
            new_balance = Decimal('0.00')
        
        # Generate payment receipt
        pdf_buffer = await receipt_service.generate_payment_receipt(
            transaction=transaction,
            customer=customer,
            payment_amount=payment_amount,
            new_balance=new_balance,
            user=current_user
        )
        
        # Return as streaming response
        filename = f"payment_receipt_{transaction.transaction_number}.pdf"
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error generating payment receipt: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate payment receipt"
        )