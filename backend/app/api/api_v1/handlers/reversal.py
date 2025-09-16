"""
Reversal API Handler

FastAPI endpoints for payment reversals and extension cancellations.
Provides same-day mistake correction functionality with admin authorization.
"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from typing import Optional

from app.models.user_model import User
from app.services.reversal_service import ReversalService
from app.schemas.reversal_schema import (
    PaymentReversalEligibilityResponse,
    PaymentReversalRequest,
    PaymentReversalResponse,
    ExtensionCancellationEligibilityResponse,
    ExtensionCancellationRequest,
    ExtensionCancellationResponse,
    DailyReversalReportResponse,
    TransactionReversalCountResponse
)
from app.core.auth import get_current_user
from app.api.deps.timezone_deps import get_client_timezone
from app.core.exceptions import BusinessRuleError, ValidationError, AuthenticationError

logger = structlog.get_logger(__name__)

# Create the router
reversal_router = APIRouter()


@reversal_router.get(
    "/payment/{payment_id}/validate",
    response_model=PaymentReversalEligibilityResponse,
    summary="Check payment reversal eligibility",
    description="Check if a payment can be reversed (admin only, same-day)",
    responses={
        200: {"description": "Eligibility check completed"},
        403: {"description": "Admin access required"},
        404: {"description": "Payment not found"},
        500: {"description": "Internal server error"}
    }
)
async def validate_payment_reversal(
    payment_id: str,
    current_user: User = Depends(get_current_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
) -> PaymentReversalEligibilityResponse:
    """
    Check if a payment can be reversed.
    
    Business Rules:
    - Only admin users can check eligibility
    - Must be within 24 hours of payment
    - Maximum 3 reversals per transaction per day
    - Transaction must be in valid state
    """
    try:
        # Only admins can check reversal eligibility
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can check payment reversal eligibility"
            )
        
        is_eligible, reason, hours_since = await ReversalService.check_payment_reversal_eligibility(
            payment_id, current_user, client_timezone
        )
        
        logger.info(
            "Payment reversal eligibility checked",
            payment_id=payment_id,
            is_eligible=is_eligible,
            reason=reason,
            hours_since_payment=hours_since,
            checked_by=current_user.user_id
        )
        
        return PaymentReversalEligibilityResponse(
            payment_id=payment_id,
            is_eligible=is_eligible,
            reason=reason,
            hours_since_payment=hours_since,
            max_hours_allowed=ReversalService.MAX_HOURS_FOR_REVERSAL
        )
        
    except ValidationError as e:
        logger.warning("Payment not found for reversal check", payment_id=payment_id, error=str(e))
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error checking payment reversal eligibility", payment_id=payment_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to check reversal eligibility")


@reversal_router.post(
    "/payment/{payment_id}/reverse",
    response_model=PaymentReversalResponse,
    summary="Reverse a payment",
    description="Reverse a payment (admin only, same-day with PIN authorization)",
    responses={
        200: {"description": "Payment reversed successfully"},
        400: {"description": "Invalid request or business rule violation"},
        401: {"description": "Invalid admin PIN"},
        403: {"description": "Admin access required"},
        404: {"description": "Payment not found"},
        500: {"description": "Internal server error"}
    }
)
async def reverse_payment(
    payment_id: str,
    reversal_request: PaymentReversalRequest,
    current_user: User = Depends(get_current_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
) -> PaymentReversalResponse:
    """
    Reverse a payment with admin PIN authorization.
    
    Business Rules:
    - Only admin users can reverse payments
    - Must provide valid admin PIN
    - Must be within 24 hours of payment
    - Maximum 3 reversals per transaction per day
    - Creates complete audit trail
    """
    try:
        reversal_result = await ReversalService.reverse_payment(
            payment_id=payment_id,
            reversal_reason=reversal_request.reversal_reason,
            admin_pin=reversal_request.admin_pin,
            current_user=current_user,
            staff_notes=reversal_request.staff_notes,
            client_timezone=client_timezone
        )
        
        return PaymentReversalResponse(**reversal_result)
        
    except AuthenticationError as e:
        logger.warning("Authentication error in payment reversal", payment_id=payment_id, user=current_user.user_id, error=str(e))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except BusinessRuleError as e:
        logger.warning("Business rule violation in payment reversal", payment_id=payment_id, error=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ValidationError as e:
        logger.warning("Payment not found for reversal", payment_id=payment_id, error=str(e))
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error reversing payment", payment_id=payment_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reverse payment")


@reversal_router.get(
    "/extension/{extension_id}/validate",
    response_model=ExtensionCancellationEligibilityResponse,
    summary="Check extension cancellation eligibility",
    description="Check if an extension can be cancelled (admin only, same-day)",
    responses={
        200: {"description": "Eligibility check completed"},
        403: {"description": "Admin access required"},
        404: {"description": "Extension not found"},
        500: {"description": "Internal server error"}
    }
)
async def validate_extension_cancellation(
    extension_id: str,
    current_user: User = Depends(get_current_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
) -> ExtensionCancellationEligibilityResponse:
    """
    Check if an extension can be cancelled.
    
    Business Rules:
    - Only admin users can check eligibility
    - Must be within 24 hours of extension
    - Maximum 3 reversals per transaction per day
    - Transaction must be in valid state
    """
    try:
        # Only admins can check cancellation eligibility
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can check extension cancellation eligibility"
            )
        
        is_eligible, reason, hours_since = await ReversalService.check_extension_cancellation_eligibility(
            extension_id, current_user, client_timezone
        )
        
        logger.info(
            "Extension cancellation eligibility checked",
            extension_id=extension_id,
            is_eligible=is_eligible,
            reason=reason,
            hours_since_extension=hours_since,
            checked_by=current_user.user_id
        )
        
        return ExtensionCancellationEligibilityResponse(
            extension_id=extension_id,
            is_eligible=is_eligible,
            reason=reason,
            hours_since_extension=hours_since,
            max_hours_allowed=ReversalService.MAX_HOURS_FOR_REVERSAL
        )
        
    except ValidationError as e:
        logger.warning("Extension not found for cancellation check", extension_id=extension_id, error=str(e))
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error checking extension cancellation eligibility", extension_id=extension_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to check cancellation eligibility")


@reversal_router.post(
    "/extension/{extension_id}/cancel",
    response_model=ExtensionCancellationResponse,
    summary="Cancel an extension",
    description="Cancel an extension (admin only, same-day with PIN authorization)",
    responses={
        200: {"description": "Extension cancelled successfully"},
        400: {"description": "Invalid request or business rule violation"},
        401: {"description": "Invalid admin PIN"},
        403: {"description": "Admin access required"},
        404: {"description": "Extension not found"},
        500: {"description": "Internal server error"}
    }
)
async def cancel_extension(
    extension_id: str,
    cancellation_request: ExtensionCancellationRequest,
    current_user: User = Depends(get_current_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
) -> ExtensionCancellationResponse:
    """
    Cancel an extension with admin PIN authorization.
    
    Business Rules:
    - Only admin users can cancel extensions
    - Must provide valid admin PIN
    - Must be within 24 hours of extension
    - Maximum 3 reversals per transaction per day
    - Reverts maturity date to original
    - Creates complete audit trail
    """
    try:
        cancellation_result = await ReversalService.cancel_extension(
            extension_id=extension_id,
            cancellation_reason=cancellation_request.cancellation_reason,
            admin_pin=cancellation_request.admin_pin,
            current_user=current_user,
            staff_notes=cancellation_request.staff_notes,
            client_timezone=client_timezone
        )
        
        return ExtensionCancellationResponse(**cancellation_result)
        
    except AuthenticationError as e:
        logger.warning("Authentication error in extension cancellation", extension_id=extension_id, user=current_user.user_id, error=str(e))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except BusinessRuleError as e:
        logger.warning("Business rule violation in extension cancellation", extension_id=extension_id, error=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ValidationError as e:
        logger.warning("Extension not found for cancellation", extension_id=extension_id, error=str(e))
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error cancelling extension", extension_id=extension_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to cancel extension")


@reversal_router.get(
    "/report/daily",
    response_model=DailyReversalReportResponse,
    summary="Get daily reversal report",
    description="Get reversal statistics for a specific date (admin only)",
    responses={
        200: {"description": "Report generated successfully"},
        403: {"description": "Admin access required"},
        500: {"description": "Internal server error"}
    }
)
async def get_daily_reversal_report(
    date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
) -> DailyReversalReportResponse:
    """
    Get daily reversal report for monitoring and audit purposes.
    
    Args:
        date: Date in YYYY-MM-DD format (defaults to today)
        
    Returns:
        Daily reversal statistics
    """
    try:
        # Only admins can view reversal reports
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can view reversal reports"
            )
        
        # Parse date if provided
        report_date = None
        if date:
            try:
                report_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=datetime.now().astimezone().tzinfo)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date format. Use YYYY-MM-DD"
                )
        
        report_data = await ReversalService.get_daily_reversal_report(report_date)
        
        return DailyReversalReportResponse(**report_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Unexpected error generating daily reversal report", date=date, error=str(e), exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate report")


@reversal_router.get(
    "/transaction/{transaction_id}/count",
    response_model=TransactionReversalCountResponse,
    summary="Get transaction reversal count",
    description="Get daily reversal count for a specific transaction (admin only)",
    responses={
        200: {"description": "Count retrieved successfully"},
        403: {"description": "Admin access required"},
        500: {"description": "Internal server error"}
    }
)
async def get_transaction_reversal_count(
    transaction_id: str,
    current_user: User = Depends(get_current_user)
) -> TransactionReversalCountResponse:
    """
    Get reversal count for a specific transaction for monitoring daily limits.
    
    Args:
        transaction_id: Transaction to check
        
    Returns:
        Reversal counts and limit status
    """
    try:
        # Only admins can check reversal counts
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can check reversal counts"
            )
        
        count_data = await ReversalService.get_transaction_reversal_count(transaction_id)
        
        return TransactionReversalCountResponse(**count_data)
        
    except Exception as e:
        logger.error("Unexpected error getting transaction reversal count", transaction_id=transaction_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get reversal count")