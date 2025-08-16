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
import structlog

# Local imports
from app.api.deps.user_deps import get_staff_or_admin_user
from app.models.user_model import User
from app.schemas.payment_schema import (
    PaymentCreate, PaymentResponse, PaymentListResponse,
    PaymentSummaryResponse, PaymentReceiptResponse, PaymentHistoryResponse,
    PaymentValidationResponse
)
from app.services.payment_service import (
    PaymentService, PaymentError, PaymentValidationError, 
    TransactionNotFoundError as ServiceTransactionNotFoundError, StaffValidationError
)
from app.core.exceptions import (
    ValidationError, BusinessRuleError, TransactionNotFoundError,
    PaymentError as CorePaymentError, DatabaseError, AuthorizationError
)
from app.services.pawn_transaction_service import PawnTransactionService
from app.services.interest_calculation_service import InterestCalculationService

# Configure logger
payment_logger = structlog.get_logger("payment_api")

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
        # Input validation
        if not payment_data.transaction_id or not payment_data.transaction_id.strip():
            raise ValidationError(
                "Transaction ID is required",
                error_code="MISSING_TRANSACTION_ID"
            )
        
        if payment_data.payment_amount <= 0:
            raise ValidationError(
                "Payment amount must be greater than zero",
                error_code="INVALID_PAYMENT_AMOUNT",
                details={"payment_amount": payment_data.payment_amount}
            )
        
        # Verify transaction exists and is valid for payments
        try:
            transaction = await PawnTransactionService.get_transaction_by_id(payment_data.transaction_id.strip())
            if not transaction:
                raise TransactionNotFoundError(
                    payment_data.transaction_id,
                    error_code="TRANSACTION_NOT_FOUND"
                )
        except Exception as e:
            if isinstance(e, TransactionNotFoundError):
                raise
            raise DatabaseError(
                "Failed to verify transaction information",
                error_code="DATABASE_ERROR"
            )
        
        # Business rule validation
        invalid_statuses = ["redeemed", "forfeited", "sold"]
        if transaction.status.value if hasattr(transaction.status, 'value') else str(transaction.status) in invalid_statuses:
            raise BusinessRuleError(
                f"Cannot process payment - transaction status is '{transaction.status}'",
                error_code="INVALID_TRANSACTION_STATUS",
                details={
                    "current_status": str(transaction.status),
                    "allowed_statuses": ["active", "overdue", "extended", "hold"]
                }
            )
        
        # Validate payment amount against current balance
        try:
            balance_response = await InterestCalculationService.calculate_current_balance(payment_data.transaction_id)
            # balance_response is a BalanceResponse object, not a dict
            current_balance_amount = balance_response.current_balance
            max_allowed_payment = current_balance_amount + 100  # Allow $1 overpayment
            
            if payment_data.payment_amount > max_allowed_payment:
                raise BusinessRuleError(
                    "Payment amount exceeds current balance plus allowable overpayment",
                    error_code="EXCESSIVE_PAYMENT",
                    details={
                        "current_balance": current_balance_amount,
                        "payment_amount": payment_data.payment_amount,
                        "max_allowed": max_allowed_payment
                    }
                )
        except BusinessRuleError:
            raise
        except Exception as e:
            payment_logger.warning(
                "Could not validate payment amount against balance",
                transaction_id=payment_data.transaction_id,
                error=str(e)
            )
        
        # Log payment processing
        payment_logger.info(
            "Processing payment",
            transaction_id=payment_data.transaction_id,
            payment_amount=payment_data.payment_amount,
            processed_by=current_user.user_id
        )
        
        # Process payment
        payment = await PaymentService.process_payment(
            transaction_id=payment_data.transaction_id.strip(),
            payment_amount=payment_data.payment_amount,
            processed_by_user_id=current_user.user_id,
            receipt_number=payment_data.receipt_number.strip() if payment_data.receipt_number else None,
            internal_notes=payment_data.internal_notes.strip() if payment_data.internal_notes else None
        )
        
        payment_logger.info(
            "Payment processed successfully",
            payment_id=payment.payment_id,
            transaction_id=payment_data.transaction_id,
            amount=payment_data.payment_amount
        )
        
        # Convert payment to dict and ensure all required fields are present
        payment_dict = payment.model_dump()
        
        # Ensure payment_type is included (Payment model uses payment_method)
        if 'payment_type' not in payment_dict:
            payment_dict['payment_type'] = payment.payment_type  # Uses the property
        
        # Ensure void fields have default values if missing (new payments won't be voided)
        if 'is_voided' not in payment_dict:
            payment_dict['is_voided'] = False
        if 'voided_date' not in payment_dict:
            payment_dict['voided_date'] = None
        if 'voided_by_user_id' not in payment_dict:
            payment_dict['voided_by_user_id'] = None
        if 'void_reason' not in payment_dict:
            payment_dict['void_reason'] = None
        
        return PaymentResponse.model_validate(payment_dict)
        
    except (ValidationError, BusinessRuleError, TransactionNotFoundError, CorePaymentError, DatabaseError):
        # Re-raise known exceptions to be handled by global handlers
        raise
    except (PaymentValidationError, StaffValidationError, ServiceTransactionNotFoundError, PaymentError) as e:
        # Convert legacy service exceptions to new exception types
        if isinstance(e, ServiceTransactionNotFoundError):
            raise TransactionNotFoundError(payment_data.transaction_id)
        elif isinstance(e, PaymentValidationError):
            raise ValidationError(str(e), error_code="PAYMENT_VALIDATION_ERROR")
        elif isinstance(e, StaffValidationError):
            raise AuthorizationError(f"Staff validation error: {str(e)}")
        else:
            raise CorePaymentError(str(e), error_code="PAYMENT_PROCESSING_ERROR")
    except Exception as e:
        payment_logger.error(
            "Unexpected error processing payment",
            transaction_id=payment_data.transaction_id,
            payment_amount=payment_data.payment_amount,
            error=str(e),
            exc_info=True
        )
        raise CorePaymentError("Failed to process payment due to unexpected error")


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
    except TransactionNotFoundError as e:
        # Handle transaction not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        # Log unexpected errors for debugging
        payment_logger.error(
            "Unexpected error in get_payment_history",
            transaction_id=transaction_id,
            error=str(e),
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve payment history: {str(e)}"
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
    except TransactionNotFoundError as e:
        # Handle transaction not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        # Log unexpected errors for debugging
        payment_logger.error(
            "Unexpected error in get_payment_summary",
            transaction_id=transaction_id,
            error=str(e),
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve payment summary: {str(e)}"
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
        
        # Convert payment to dict and ensure all required fields are present
        payment_dict = payment.model_dump()
        
        # Ensure new fields have default values if missing (for backward compatibility)
        if 'principal_portion' not in payment_dict or payment_dict['principal_portion'] is None:
            payment_dict['principal_portion'] = 0
        if 'interest_portion' not in payment_dict or payment_dict['interest_portion'] is None:
            payment_dict['interest_portion'] = 0
        if 'payment_type' not in payment_dict:
            payment_dict['payment_type'] = payment_dict.get('payment_method', 'cash')
        
        # Ensure void fields have default values if missing
        if 'is_voided' not in payment_dict:
            payment_dict['is_voided'] = False
        if 'voided_date' not in payment_dict:
            payment_dict['voided_date'] = None
        if 'voided_by_user_id' not in payment_dict:
            payment_dict['voided_by_user_id'] = None
        if 'void_reason' not in payment_dict:
            payment_dict['void_reason'] = None
            
        return PaymentResponse.model_validate(payment_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        # Log unexpected errors for debugging
        payment_logger.error(
            "Unexpected error in get_payment_by_id",
            payment_id=payment_id,
            error=str(e),
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve payment: {str(e)}"
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
        # First get the payment to find the transaction_id
        payment = await PaymentService.get_payment_by_id(payment_id)
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found"
            )
        
        # Import ReceiptService locally to avoid circular imports
        from app.services.receipt_service import ReceiptService
        receipt_data = await ReceiptService.generate_payment_receipt(
            transaction_id=payment.transaction_id,
            payment_id=payment_id,
            receipt_type="customer"
        )
        
        # Transform receipt data to PaymentReceiptResponse format
        payment_details = receipt_data.get("payment_details", {})
        balance_breakdown = receipt_data.get("balance_breakdown", {})
        customer = receipt_data.get("customer", {})
        
        # Determine if transaction is paid off
        is_paid_off = payment_details.get("status") == "PAID IN FULL - ITEMS RELEASED"
        
        # Create PaymentReceiptResponse
        payment_receipt = PaymentReceiptResponse(
            payment_id=payment_id,
            receipt_number=payment_details.get("receipt_number"),
            
            # Transaction details
            transaction_id=receipt_data.get("transaction_id"),
            customer_name=customer.get("name", ""),
            customer_phone=customer.get("phone", ""),
            
            # Payment details
            payment_amount=payment.payment_amount,
            payment_amount_formatted=payment_details.get("payment_amount", f"${payment.payment_amount}.00"),
            payment_date=payment_details.get("payment_date", payment.payment_date.strftime("%B %d, %Y at %I:%M %p")),
            payment_type=payment.payment_method,
            
            # Balance information
            balance_before=payment.balance_before_payment,
            balance_after=payment.balance_after_payment,
            balance_before_formatted=f"${payment.balance_before_payment}.00",
            balance_after_formatted=payment_details.get("remaining_balance", f"${payment.balance_after_payment}.00"),
            
            # Payment allocation
            principal_portion=getattr(payment, 'principal_portion', 0),
            interest_portion=getattr(payment, 'interest_portion', 0),
            principal_portion_formatted=f"${getattr(payment, 'principal_portion', 0)}.00",
            interest_portion_formatted=f"${getattr(payment, 'interest_portion', 0)}.00",
            
            # Staff information
            processed_by=receipt_data.get("staff_member", payment.processed_by_user_id),
            
            # Additional information
            notes=payment.internal_notes,
            
            # Transaction status
            transaction_status=receipt_data.get("transaction_status", "active"),
            is_paid_off=is_paid_off
        )
        
        return payment_receipt
        
    except HTTPException:
        raise
    except Exception as e:
        # Log unexpected errors for debugging
        payment_logger.error(
            "Unexpected error in get_payment_receipt",
            payment_id=payment_id,
            error=str(e),
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate payment receipt: {str(e)}"
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
        
        # Convert payment to dict and ensure all required fields are present
        payment_dict = payment.model_dump()
        
        # Ensure payment_type is included (Payment model uses payment_method)
        if 'payment_type' not in payment_dict:
            payment_dict['payment_type'] = getattr(payment, 'payment_method', 'cash')
        
        # Ensure backward compatibility for older fields
        if 'principal_portion' not in payment_dict or payment_dict['principal_portion'] is None:
            payment_dict['principal_portion'] = getattr(payment, 'principal_portion', 0)
        if 'interest_portion' not in payment_dict or payment_dict['interest_portion'] is None:
            payment_dict['interest_portion'] = getattr(payment, 'interest_portion', 0)
        
        # Ensure void fields have values (they should be set after voiding)
        if 'is_voided' not in payment_dict:
            payment_dict['is_voided'] = getattr(payment, 'is_voided', False)
        if 'voided_date' not in payment_dict:
            payment_dict['voided_date'] = getattr(payment, 'voided_date', None)
        if 'voided_by_user_id' not in payment_dict:
            payment_dict['voided_by_user_id'] = getattr(payment, 'voided_by_user_id', None)
        if 'void_reason' not in payment_dict:
            payment_dict['void_reason'] = getattr(payment, 'void_reason', None)
        
        return PaymentResponse.model_validate(payment_dict)
        
    except HTTPException:
        raise
    except (PaymentError, StaffValidationError, PaymentValidationError) as e:
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
        # Log the actual error for debugging
        import traceback
        import structlog
        logger = structlog.get_logger("payment_void")
        logger.error(
            "Unexpected error in void_payment",
            payment_id=payment_id,
            user_id=current_user.user_id,
            error=str(e),
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to void payment. Please try again later."
        )