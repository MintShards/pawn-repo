"""
Pawn Transaction API handlers for FastAPI endpoints.

This module defines all pawn transaction-related API endpoints including
CRUD operations, payment processing, extensions, and financial calculations.
"""

# Standard library imports
from typing import Optional, List
from datetime import datetime

# Third-party imports
from fastapi import APIRouter, Depends, HTTPException, status, Query

# Local imports
from app.api.deps.user_deps import get_current_user, get_staff_or_admin_user
from app.models.user_model import User
from app.models.pawn_transaction_model import TransactionStatus
from app.schemas.pawn_transaction_schema import (
    PawnTransactionCreate, PawnTransactionResponse, PawnTransactionListResponse,
    TransactionStatusUpdate, BalanceResponse, InterestBreakdownResponse,
    PayoffAmountResponse, TransactionSummaryResponse, TransactionSearchFilters,
    BulkStatusUpdateRequest, BulkStatusUpdateResponse
)
from app.schemas.receipt_schema import (
    InitialPawnReceiptResponse, PaymentReceiptResponse, ExtensionReceiptResponse,
    ReceiptTextResponse, ReceiptSummaryResponse, ReceiptGenerationRequest
)
from app.services.pawn_transaction_service import (
    PawnTransactionService, PawnTransactionError, 
    CustomerValidationError, StaffValidationError, TransactionStateError
)
from app.services.interest_calculation_service import (
    InterestCalculationService, TransactionNotFoundError, InterestCalculationError
)
from app.services.receipt_service import ReceiptService, ReceiptGenerationError

# Create router
pawn_transaction_router = APIRouter()


@pawn_transaction_router.post(
    "/",
    response_model=PawnTransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create new pawn transaction",
    description="Create a new pawn transaction with items (Staff and Admin access)",
    responses={
        201: {"description": "Pawn transaction created successfully"},
        400: {"description": "Bad request - Invalid data"},
        404: {"description": "Customer not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
async def create_pawn_transaction(
    transaction_data: PawnTransactionCreate,
    current_user: User = Depends(get_staff_or_admin_user)
) -> PawnTransactionResponse:
    """Create a new pawn transaction with comprehensive error handling"""
    try:
        # Extract items data for service call
        items_data = [item.model_dump() for item in transaction_data.items]
        
        transaction = await PawnTransactionService.create_transaction(
            customer_phone=transaction_data.customer_id,
            created_by_user_id=current_user.user_id,
            loan_amount=transaction_data.loan_amount,
            monthly_interest_amount=transaction_data.monthly_interest_amount,
            storage_location=transaction_data.storage_location,
            items=items_data,
            internal_notes=transaction_data.internal_notes
        )
        
        return PawnTransactionResponse.model_validate(transaction.model_dump())
    
    except HTTPException:
        # Re-raise HTTP exceptions from service layer
        raise
    except CustomerValidationError as e:
        # Customer-related validation errors (404 or 400)
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    except StaffValidationError as e:
        # Staff user validation errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Staff validation error: {str(e)}"
        )
    except PawnTransactionError as e:
        # General transaction business logic errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ValueError as e:
        # Handle validation errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Log unexpected errors for debugging
        import traceback
        print(f"Unexpected error in create_pawn_transaction: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create pawn transaction: {str(e)}"
        )


@pawn_transaction_router.get(
    "/",
    response_model=PawnTransactionListResponse,
    summary="Get pawn transactions list",
    description="Get paginated list of pawn transactions with filtering (Staff and Admin access)",
    responses={
        200: {"description": "Transactions list retrieved successfully"},
        400: {"description": "Bad request - Invalid parameters"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
async def get_pawn_transactions_list(
    status_filter: Optional[TransactionStatus] = Query(None, alias="status", description="Filter by transaction status"),
    customer_id: Optional[str] = Query(None, description="Filter by customer phone number"),
    min_amount: Optional[int] = Query(None, description="Minimum loan amount filter"),
    max_amount: Optional[int] = Query(None, description="Maximum loan amount filter"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    storage_location: Optional[str] = Query(None, description="Storage location filter"),
    page: int = Query(1, description="Page number", ge=1),
    page_size: int = Query(20, description="Items per page", ge=1, le=100),
    sort_by: str = Query("pawn_date", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_staff_or_admin_user)
) -> PawnTransactionListResponse:
    """Get paginated list of pawn transactions with optional filtering"""
    try:
        # Create filter object
        filters = TransactionSearchFilters(
            status=status_filter,
            customer_id=customer_id,
            min_amount=min_amount,
            max_amount=max_amount,
            start_date=start_date,
            end_date=end_date,
            storage_location=storage_location,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        return await PawnTransactionService.get_transactions_list(filters)
    
    except PawnTransactionError as e:
        # Service-specific transaction errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Log unexpected errors for debugging
        import traceback
        print(f"Unexpected error in get_pawn_transactions_list: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve transactions: {str(e)}"
        )


@pawn_transaction_router.get(
    "/{transaction_id}",
    response_model=PawnTransactionResponse,
    summary="Get transaction by ID",
    description="Get pawn transaction details by ID (Staff and Admin access)",
    responses={
        200: {"description": "Transaction details retrieved successfully"},
        400: {"description": "Bad request - Invalid transaction ID format"},
        404: {"description": "Transaction not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
async def get_pawn_transaction_by_id(
    transaction_id: str,
    current_user: User = Depends(get_staff_or_admin_user)
) -> PawnTransactionResponse:
    """Get pawn transaction details by ID"""
    try:
        transaction = await PawnTransactionService.get_transaction_by_id(transaction_id)
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )
        
        return PawnTransactionResponse.model_validate(transaction.model_dump())
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve transaction. Please try again later."
        )


@pawn_transaction_router.get(
    "/{transaction_id}/summary",
    response_model=TransactionSummaryResponse,
    summary="Get transaction summary",
    description="Get comprehensive transaction summary with items and balance (Staff and Admin access)",
    responses={
        200: {"description": "Transaction summary retrieved successfully"},
        404: {"description": "Transaction not found"},
        500: {"description": "Internal server error"}
    }
)
async def get_transaction_summary(
    transaction_id: str,
    current_user: User = Depends(get_staff_or_admin_user)
) -> TransactionSummaryResponse:
    """Get comprehensive transaction summary with items and balance"""
    try:
        summary = await PawnTransactionService.get_transaction_summary(transaction_id)
        return summary
        
    except HTTPException:
        raise
    except PawnTransactionError as e:
        # Handle transaction not found specifically
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    except Exception as e:
        # Log unexpected errors for debugging
        import traceback
        print(f"Unexpected error in get_transaction_summary: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve transaction summary: {str(e)}"
        )


@pawn_transaction_router.get(
    "/{transaction_id}/balance",
    response_model=BalanceResponse,
    summary="Get transaction balance",
    description="Get current balance and payment breakdown for transaction (Staff and Admin access)",
    responses={
        200: {"description": "Balance information retrieved successfully"},
        404: {"description": "Transaction not found"},
        500: {"description": "Internal server error"}
    }
)
async def get_transaction_balance(
    transaction_id: str,
    as_of_date: Optional[datetime] = Query(None, description="Balance calculation date (defaults to now)"),
    current_user: User = Depends(get_staff_or_admin_user)
) -> BalanceResponse:
    """Get current balance and payment breakdown for transaction"""
    try:
        balance_info = await InterestCalculationService.calculate_current_balance(
            transaction_id, as_of_date
        )
        return balance_info
        
    except HTTPException:
        raise
    except TransactionNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except InterestCalculationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Log unexpected errors for debugging
        import traceback
        print(f"Unexpected error in get_transaction_balance: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate balance: {str(e)}"
        )


@pawn_transaction_router.get(
    "/{transaction_id}/interest-breakdown",
    response_model=InterestBreakdownResponse,
    summary="Get interest calculation breakdown",
    description="Get detailed interest calculation breakdown (Staff and Admin access)",
    responses={
        200: {"description": "Interest breakdown retrieved successfully"},
        404: {"description": "Transaction not found"},
        500: {"description": "Internal server error"}
    }
)
async def get_interest_breakdown(
    transaction_id: str,
    as_of_date: Optional[datetime] = Query(None, description="Calculation date (defaults to now)"),
    current_user: User = Depends(get_staff_or_admin_user)
) -> InterestBreakdownResponse:
    """Get detailed interest calculation breakdown"""
    try:
        breakdown = await InterestCalculationService.calculate_accrued_interest(
            transaction_id, as_of_date
        )
        return breakdown
        
    except HTTPException:
        raise
    except TransactionNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except InterestCalculationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Log unexpected errors for debugging
        import traceback
        print(f"Unexpected error in get_interest_breakdown: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate interest breakdown: {str(e)}"
        )


@pawn_transaction_router.get(
    "/{transaction_id}/payoff-amount",
    response_model=PayoffAmountResponse,
    summary="Get payoff amount",
    description="Get total amount needed to pay off the loan (Staff and Admin access)",
    responses={
        200: {"description": "Payoff amount calculated successfully"},
        404: {"description": "Transaction not found"},
        500: {"description": "Internal server error"}
    }
)
async def get_payoff_amount(
    transaction_id: str,
    as_of_date: Optional[datetime] = Query(None, description="Payoff calculation date (defaults to now)"),
    current_user: User = Depends(get_staff_or_admin_user)
) -> PayoffAmountResponse:
    """Get total amount needed to pay off the loan"""
    try:
        payoff_info = await InterestCalculationService.calculate_payoff_amount(
            transaction_id, as_of_date
        )
        return payoff_info
        
    except HTTPException:
        raise
    except TransactionNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except InterestCalculationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Log unexpected errors for debugging
        import traceback
        print(f"Unexpected error in get_payoff_amount: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate payoff amount: {str(e)}"
        )


@pawn_transaction_router.put(
    "/{transaction_id}/status",
    response_model=PawnTransactionResponse,
    summary="Update transaction status",
    description="Update pawn transaction status (Staff and Admin access)",
    responses={
        200: {"description": "Transaction status updated successfully"},
        400: {"description": "Bad request - Invalid status transition"},
        404: {"description": "Transaction not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
async def update_transaction_status(
    transaction_id: str,
    status_update: TransactionStatusUpdate,
    current_user: User = Depends(get_staff_or_admin_user)
) -> PawnTransactionResponse:
    """Update pawn transaction status with comprehensive validation"""
    try:
        transaction = await PawnTransactionService.update_transaction_status(
            transaction_id=transaction_id,
            new_status=status_update.new_status,
            updated_by_user_id=current_user.user_id,
            notes=status_update.notes
        )
        
        return PawnTransactionResponse.model_validate(transaction.model_dump())
        
    except HTTPException:
        raise
    except PawnTransactionError as e:
        # Handle transaction not found specifically
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    except StaffValidationError as e:
        # Staff user validation errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Staff validation error: {str(e)}"
        )
    except TransactionStateError as e:
        # Invalid status transition errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition: {str(e)}"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Log unexpected errors for debugging
        import traceback
        print(f"Unexpected error in update_transaction_status: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update transaction status: {str(e)}"
        )


@pawn_transaction_router.post(
    "/bulk-status-update",
    response_model=BulkStatusUpdateResponse,
    summary="Bulk update transaction statuses",
    description="Update status for multiple transactions (Staff and Admin access)",
    responses={
        200: {"description": "Bulk status update completed"},
        400: {"description": "Bad request - Invalid data"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
async def bulk_update_transaction_status(
    bulk_update: BulkStatusUpdateRequest,
    current_user: User = Depends(get_staff_or_admin_user)
) -> BulkStatusUpdateResponse:
    """Update status for multiple transactions"""
    try:
        result = await PawnTransactionService.bulk_update_status(
            transaction_ids=bulk_update.transaction_ids,
            new_status=bulk_update.new_status,
            updated_by_user_id=current_user.user_id,
            notes=bulk_update.notes
        )
        
        return result
        
    except HTTPException:
        raise
    except PawnTransactionError as e:
        # Handle transaction not found or business logic errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except StaffValidationError as e:
        # Staff user validation errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Staff validation error: {str(e)}"
        )
    except TransactionStateError as e:
        # Invalid status transition errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition: {str(e)}"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Log unexpected errors for debugging
        import traceback
        print(f"Unexpected error in bulk_update_transaction_status: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to perform bulk status update: {str(e)}"
        )


@pawn_transaction_router.get(
    "/customer/{customer_phone}/transactions",
    response_model=PawnTransactionListResponse,
    summary="Get customer's transactions",
    description="Get all transactions for a specific customer (Staff and Admin access)",
    responses={
        200: {"description": "Customer transactions retrieved successfully"},
        400: {"description": "Bad request - Invalid phone number"},
        404: {"description": "Customer not found"},
        500: {"description": "Internal server error"}
    }
)
async def get_customer_transactions(
    customer_phone: str,
    status_filter: Optional[TransactionStatus] = Query(None, alias="status", description="Filter by transaction status"),
    page: int = Query(1, description="Page number", ge=1),
    page_size: int = Query(20, description="Items per page", ge=1, le=100),
    sort_by: str = Query("pawn_date", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_staff_or_admin_user)
) -> PawnTransactionListResponse:
    """Get all transactions for a specific customer"""
    try:
        # Validate phone number format
        if not customer_phone.isdigit() or len(customer_phone) != 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid phone number format. Must be 10 digits."
            )
        
        # Create filter object
        filters = TransactionSearchFilters(
            status=status_filter,
            customer_id=customer_phone,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        return await PawnTransactionService.get_transactions_list(filters)
        
    except HTTPException:
        raise
    except PawnTransactionError as e:
        # Service-specific transaction errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Log unexpected errors for debugging
        import traceback
        print(f"Unexpected error in get_customer_transactions: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve customer transactions: {str(e)}"
        )


@pawn_transaction_router.post(
    "/{transaction_id}/redeem",
    response_model=PawnTransactionResponse,
    summary="Redeem transaction",
    description="Mark transaction as redeemed (full payoff) (Staff and Admin access)",
    responses={
        200: {"description": "Transaction redeemed successfully"},
        400: {"description": "Bad request - Cannot redeem transaction"},
        404: {"description": "Transaction not found"},
        500: {"description": "Internal server error"}
    }
)
async def redeem_transaction(
    transaction_id: str,
    current_user: User = Depends(get_staff_or_admin_user)
) -> PawnTransactionResponse:
    """Mark transaction as redeemed (full payoff)"""
    try:
        transaction = await PawnTransactionService.redeem_transaction(
            transaction_id=transaction_id,
            redeemed_by_user_id=current_user.user_id
        )
        
        return PawnTransactionResponse.model_validate(transaction.model_dump())
        
    except HTTPException:
        raise
    except PawnTransactionError as e:
        # Handle transaction not found specifically
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    except StaffValidationError as e:
        # Staff user validation errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Staff validation error: {str(e)}"
        )
    except TransactionStateError as e:
        # Invalid status transition errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot redeem transaction: {str(e)}"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Log unexpected errors for debugging
        import traceback
        print(f"Unexpected error in redeem_transaction: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to redeem transaction: {str(e)}"
        )


@pawn_transaction_router.post(
    "/{transaction_id}/forfeit",
    response_model=PawnTransactionResponse,
    summary="Forfeit transaction",
    description="Mark transaction as forfeited (Staff and Admin access)",
    responses={
        200: {"description": "Transaction forfeited successfully"},
        400: {"description": "Bad request - Cannot forfeit transaction"},
        404: {"description": "Transaction not found"},
        500: {"description": "Internal server error"}
    }
)
async def forfeit_transaction(
    transaction_id: str,
    reason: Optional[str] = Query(None, description="Reason for forfeiture"),
    current_user: User = Depends(get_staff_or_admin_user)
) -> PawnTransactionResponse:
    """Mark transaction as forfeited"""
    try:
        transaction = await PawnTransactionService.forfeit_transaction(
            transaction_id=transaction_id,
            forfeited_by_user_id=current_user.user_id,
            reason=reason
        )
        
        return PawnTransactionResponse.model_validate(transaction.model_dump())
        
    except HTTPException:
        raise
    except PawnTransactionError as e:
        # Handle transaction not found specifically
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    except StaffValidationError as e:
        # Staff user validation errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Staff validation error: {str(e)}"
        )
    except TransactionStateError as e:
        # Invalid status transition errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot forfeit transaction: {str(e)}"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Log unexpected errors for debugging
        import traceback
        print(f"Unexpected error in forfeit_transaction: {e}")
        print(f"Traceback: {traceback.format_exc()}") 
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to forfeit transaction: {str(e)}"
        )


# Receipt Generation Endpoints

@pawn_transaction_router.get(
    "/{transaction_id}/receipt/initial",
    response_model=InitialPawnReceiptResponse,
    summary="Generate initial pawn receipt",
    description="Generate receipt for initial pawn transaction (Staff and Admin access)",
    responses={
        200: {"description": "Initial pawn receipt generated successfully"},
        404: {"description": "Transaction not found"},
        400: {"description": "Bad request - Invalid receipt parameters"},
        500: {"description": "Internal server error"}
    }
)
async def get_initial_pawn_receipt(
    transaction_id: str,
    format: str = Query("json", description="Receipt format: 'json' or 'text'"),
    receipt_type: str = Query("customer", description="Receipt type: 'customer' or 'storage'"),
    current_user: User = Depends(get_current_user)
) -> InitialPawnReceiptResponse:
    """Generate initial pawn transaction receipt"""
    try:
        if format == "text":
            receipt_data = await ReceiptService.generate_initial_pawn_receipt(
                transaction_id=transaction_id,
                receipt_type=receipt_type
            )
            formatted_text = await ReceiptService.format_receipt_for_printing(receipt_data)
            return ReceiptTextResponse(
                receipt_id=receipt_data["receipt_id"],
                receipt_type=receipt_data["receipt_type"],
                transaction_id=transaction_id,
                formatted_receipt=formatted_text,
                character_count=len(formatted_text),
                line_count=len(formatted_text.split('\n'))
            )
        
        receipt_data = await ReceiptService.generate_initial_pawn_receipt(
            transaction_id=transaction_id,
            receipt_type=receipt_type
        )
        
        return InitialPawnReceiptResponse.model_validate(receipt_data)
        
    except HTTPException:
        raise
    except ReceiptGenerationError as e:
        # Handle transaction not found or receipt generation errors
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    except ValueError as e:
        # Invalid format or receipt type parameters
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid parameters: {str(e)}"
        )
    except Exception as e:
        # Log unexpected errors for debugging
        import traceback
        print(f"Unexpected error in get_initial_pawn_receipt: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate initial pawn receipt: {str(e)}"
        )


@pawn_transaction_router.get(
    "/{transaction_id}/receipt/payment/{payment_id}",
    response_model=PaymentReceiptResponse,
    summary="Generate payment receipt",
    description="Generate receipt for payment transaction (Staff and Admin access)",
    responses={
        200: {"description": "Payment receipt generated successfully"},
        404: {"description": "Transaction or payment not found"},
        400: {"description": "Bad request - Invalid receipt parameters"},
        500: {"description": "Internal server error"}
    }
)
async def get_payment_receipt(
    transaction_id: str,
    payment_id: str,
    format: str = Query("json", description="Receipt format: 'json' or 'text'"),
    receipt_type: str = Query("customer", description="Receipt type: 'customer' or 'storage'"),
    current_user: User = Depends(get_current_user)
) -> PaymentReceiptResponse:
    """Generate payment receipt"""
    try:
        if format == "text":
            receipt_data = await ReceiptService.generate_payment_receipt(
                transaction_id=transaction_id,
                payment_id=payment_id,
                receipt_type=receipt_type
            )
            formatted_text = await ReceiptService.format_receipt_for_printing(receipt_data)
            return ReceiptTextResponse(
                receipt_id=receipt_data["receipt_id"],
                receipt_type=receipt_data["receipt_type"],
                transaction_id=transaction_id,
                formatted_receipt=formatted_text,
                character_count=len(formatted_text),
                line_count=len(formatted_text.split('\n'))
            )
        
        receipt_data = await ReceiptService.generate_payment_receipt(
            transaction_id=transaction_id,
            payment_id=payment_id,
            receipt_type=receipt_type
        )
        
        return PaymentReceiptResponse.model_validate(receipt_data)
        
    except HTTPException:
        raise
    except ReceiptGenerationError as e:
        # Handle transaction/payment not found or receipt generation errors
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    except ValueError as e:
        # Invalid format or receipt type parameters
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid parameters: {str(e)}"
        )
    except Exception as e:
        # Log unexpected errors for debugging
        import traceback
        print(f"Unexpected error in get_payment_receipt: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate payment receipt: {str(e)}"
        )


@pawn_transaction_router.get(
    "/{transaction_id}/receipt/extension/{extension_id}",
    response_model=ExtensionReceiptResponse,
    summary="Generate extension receipt",
    description="Generate receipt for loan extension (Staff and Admin access)",
    responses={
        200: {"description": "Extension receipt generated successfully"},
        404: {"description": "Transaction or extension not found"},
        400: {"description": "Bad request - Invalid receipt parameters"},
        500: {"description": "Internal server error"}
    }
)
async def get_extension_receipt(
    transaction_id: str,
    extension_id: str,
    format: str = Query("json", description="Receipt format: 'json' or 'text'"),
    receipt_type: str = Query("customer", description="Receipt type: 'customer' or 'storage'"),
    current_user: User = Depends(get_current_user)
) -> ExtensionReceiptResponse:
    """Generate extension receipt"""
    try:
        if format == "text":
            receipt_data = await ReceiptService.generate_extension_receipt(
                transaction_id=transaction_id,
                extension_id=extension_id,
                receipt_type=receipt_type
            )
            formatted_text = await ReceiptService.format_receipt_for_printing(receipt_data)
            return ReceiptTextResponse(
                receipt_id=receipt_data["receipt_id"],
                receipt_type=receipt_data["receipt_type"],
                transaction_id=transaction_id,
                formatted_receipt=formatted_text,
                character_count=len(formatted_text),
                line_count=len(formatted_text.split('\n'))
            )
        
        receipt_data = await ReceiptService.generate_extension_receipt(
            transaction_id=transaction_id,
            extension_id=extension_id,
            receipt_type=receipt_type
        )
        
        return ExtensionReceiptResponse.model_validate(receipt_data)
        
    except HTTPException:
        raise
    except ReceiptGenerationError as e:
        # Handle transaction/extension not found or receipt generation errors
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    except ValueError as e:
        # Invalid format or receipt type parameters
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid parameters: {str(e)}"
        )
    except Exception as e:
        # Log unexpected errors for debugging
        import traceback
        print(f"Unexpected error in get_extension_receipt: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate extension receipt: {str(e)}"
        )


@pawn_transaction_router.get(
    "/{transaction_id}/receipt/summary",
    response_model=ReceiptSummaryResponse,
    summary="Get receipt summary",
    description="Get summary of all available receipts for transaction (Staff and Admin access)",
    responses={
        200: {"description": "Receipt summary retrieved successfully"},
        404: {"description": "Transaction not found"},
        500: {"description": "Internal server error"}
    }
)
async def get_receipt_summary(
    transaction_id: str,
    current_user: User = Depends(get_current_user)
) -> ReceiptSummaryResponse:
    """Get summary of all receipts available for a transaction"""
    try:
        summary = await ReceiptService.get_transaction_receipt_summary(transaction_id)
        return ReceiptSummaryResponse.model_validate(summary)
        
    except HTTPException:
        raise
    except ReceiptGenerationError as e:
        # Handle transaction not found or receipt generation errors
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    except ValueError as e:
        # Invalid parameters
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid parameters: {str(e)}"
        )
    except Exception as e:
        # Log unexpected errors for debugging
        import traceback
        print(f"Unexpected error in get_receipt_summary: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get receipt summary: {str(e)}"
        )