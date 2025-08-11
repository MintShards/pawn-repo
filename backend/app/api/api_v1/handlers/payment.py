"""
Payment API handlers for FastAPI endpoints.

This module defines all payment-related API endpoints including
payment processing, history, receipts, and validation.
"""

# Standard library imports
from typing import Optional
from datetime import datetime

# Third-party imports
from fastapi import APIRouter, Depends, HTTPException, status, Query

# Local imports
from app.api.deps.user_deps import get_staff_or_admin_user
from app.models.user_model import User
from app.schemas.payment_schema import (
    PaymentCreate, PaymentResponse, PaymentListResponse,
    PaymentSummaryResponse, PaymentReceiptResponse, PaymentHistoryResponse,
    PaymentValidationResponse
)
from app.services.payment_service import PaymentService

# Create router
payment_router = APIRouter()


@payment_router.post(
    "/",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Process payment",
    description="Process a cash payment for a pawn transaction (Staff and Admin access)",
    responses={
        201: {"description": "Payment processed successfully"},
        400: {"description": "Bad request - Invalid payment data"},
        404: {"description": "Transaction not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
async def process_payment(
    payment_data: PaymentCreate,
    current_user: User = Depends(get_staff_or_admin_user)
) -> PaymentResponse:
    """Process a cash payment with comprehensive error handling"""
    try:
        payment = await PaymentService.process_payment(
            transaction_id=payment_data.transaction_id,
            payment_amount=payment_data.payment_amount,
            processed_by_user_id=current_user.user_id,
            receipt_number=payment_data.receipt_number,
            internal_notes=payment_data.internal_notes
        )
        
        return PaymentResponse.model_validate(payment.model_dump())
    
    except HTTPException:
        # Re-raise HTTP exceptions from service layer
        raise
    except ValueError as e:
        # Handle validation errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Log unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process payment. Please try again later."
        )


@payment_router.get(
    "/transaction/{transaction_id}",
    response_model=PaymentHistoryResponse,
    summary="Get payment history",
    description="Get complete payment history for a transaction (Staff and Admin access)",
    responses={
        200: {"description": "Payment history retrieved successfully"},
        404: {"description": "Transaction not found"},
        500: {"description": "Internal server error"}
    }
)
async def get_payment_history(
    transaction_id: str,
    current_user: User = Depends(get_staff_or_admin_user)
) -> PaymentHistoryResponse:
    """Get complete payment history for a transaction"""
    try:
        history = await PaymentService.get_payment_history(transaction_id)
        return history
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve payment history. Please try again later."
        )


@payment_router.get(
    "/transaction/{transaction_id}/summary",
    response_model=PaymentSummaryResponse,
    summary="Get payment summary",
    description="Get payment summary for a transaction (Staff and Admin access)",
    responses={
        200: {"description": "Payment summary retrieved successfully"},
        404: {"description": "Transaction not found"},
        500: {"description": "Internal server error"}
    }
)
async def get_payment_summary(
    transaction_id: str,
    current_user: User = Depends(get_staff_or_admin_user)
) -> PaymentSummaryResponse:
    """Get payment summary for a transaction"""
    try:
        summary = await PaymentService.get_payment_summary(transaction_id)
        return summary
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve payment summary. Please try again later."
        )


@payment_router.get(
    "/{payment_id}",
    response_model=PaymentResponse,
    summary="Get payment by ID",
    description="Get payment details by ID (Staff and Admin access)",
    responses={
        200: {"description": "Payment details retrieved successfully"},
        404: {"description": "Payment not found"},
        500: {"description": "Internal server error"}
    }
)
async def get_payment_by_id(
    payment_id: str,
    current_user: User = Depends(get_staff_or_admin_user)
) -> PaymentResponse:
    """Get payment details by ID"""
    try:
        payment = await PaymentService.get_payment_by_id(payment_id)
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found"
            )
        
        return PaymentResponse.model_validate(payment.model_dump())
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve payment. Please try again later."
        )


@payment_router.get(
    "/{payment_id}/receipt",
    response_model=PaymentReceiptResponse,
    summary="Get payment receipt",
    description="Get payment receipt data for printing/display (Staff and Admin access)",
    responses={
        200: {"description": "Payment receipt retrieved successfully"},
        404: {"description": "Payment not found"},
        500: {"description": "Internal server error"}
    }
)
async def get_payment_receipt(
    payment_id: str,
    current_user: User = Depends(get_staff_or_admin_user)
) -> PaymentReceiptResponse:
    """Get payment receipt data for printing/display"""
    try:
        receipt = await PaymentService.generate_payment_receipt(payment_id)
        return receipt
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate payment receipt. Please try again later."
        )


@payment_router.post(
    "/validate",
    response_model=PaymentValidationResponse,
    summary="Validate payment",
    description="Validate payment before processing (Staff and Admin access)",
    responses={
        200: {"description": "Payment validation completed"},
        404: {"description": "Transaction not found"},
        500: {"description": "Internal server error"}
    }
)
async def validate_payment(
    payment_data: PaymentCreate,
    current_user: User = Depends(get_staff_or_admin_user)
) -> PaymentValidationResponse:
    """Validate payment before processing"""
    try:
        validation = await PaymentService.validate_payment_request(
            transaction_id=payment_data.transaction_id,
            payment_amount=payment_data.payment_amount
        )
        return validation
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate payment. Please try again later."
        )


@payment_router.get(
    "/",
    response_model=PaymentListResponse,
    summary="Get payments list",
    description="Get paginated list of payments with filtering (Staff and Admin access)",
    responses={
        200: {"description": "Payments list retrieved successfully"},
        400: {"description": "Bad request - Invalid parameters"},
        500: {"description": "Internal server error"}
    }
)
async def get_payments_list(
    transaction_id: Optional[str] = Query(None, description="Filter by transaction ID"),
    processed_by: Optional[str] = Query(None, description="Filter by staff member"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    min_amount: Optional[int] = Query(None, description="Minimum payment amount filter"),
    max_amount: Optional[int] = Query(None, description="Maximum payment amount filter"),
    page: int = Query(1, description="Page number", ge=1),
    page_size: int = Query(20, description="Items per page", ge=1, le=100),
    sort_by: str = Query("payment_date", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_staff_or_admin_user)
) -> PaymentListResponse:
    """Get paginated list of payments with optional filtering"""
    try:
        return await PaymentService.get_payments_list(
            transaction_id=transaction_id,
            processed_by=processed_by,
            start_date=start_date,
            end_date=end_date,
            min_amount=min_amount,
            max_amount=max_amount,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve payments. Please try again later."
        )


@payment_router.post(
    "/{payment_id}/void",
    response_model=PaymentResponse,
    summary="Void payment",
    description="Void a payment (reverses payment and restores balance) (Admin only)",
    responses={
        200: {"description": "Payment voided successfully"},
        400: {"description": "Bad request - Cannot void payment"},
        403: {"description": "Admin access required"},
        404: {"description": "Payment not found"},
        500: {"description": "Internal server error"}
    }
)
async def void_payment(
    payment_id: str,
    reason: Optional[str] = Query(None, description="Reason for voiding payment"),
    current_user: User = Depends(get_staff_or_admin_user)
) -> PaymentResponse:
    """Void a payment (reverses payment and restores balance)"""
    try:
        # Check if user has admin privileges for voiding
        is_admin = current_user.role == "admin" or (hasattr(current_user.role, 'value') and current_user.role.value == "admin")
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin privileges required to void payments"
            )
        
        payment = await PaymentService.void_payment(
            payment_id=payment_id,
            voided_by_user_id=current_user.user_id,
            void_reason=reason
        )
        
        return PaymentResponse.model_validate(payment.model_dump())
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to void payment. Please try again later."
        )