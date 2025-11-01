"""
Discount API handlers for FastAPI endpoints.

This module defines all discount-related API endpoints including
discount validation and payment processing with admin-approved discounts.
"""

# Standard library imports
from typing import Optional

# Third-party imports
from fastapi import APIRouter, Depends, HTTPException, status, Request
import structlog

# Local imports
from app.api.deps.user_deps import get_staff_or_admin_user, get_admin_user
from app.api.deps.timezone_deps import get_client_timezone
from app.models.user_model import User
from app.models.user_activity_log_model import UserActivityType
from app.schemas.discount_schema import (
    DiscountValidationRequest,
    DiscountValidationResponse,
    PaymentWithDiscountRequest,
    DailyDiscountReportResponse
)
from app.schemas.payment_schema import PaymentResponse
from app.services.discount_service import DiscountService
from app.services.payment_service import (
    PaymentService,
    PaymentValidationError,
    StaffValidationError
)
from app.services.user_activity_service import UserActivityService
from app.core.exceptions import (
    ValidationError, BusinessRuleError, AuthenticationError,
    TransactionNotFoundError, DatabaseError
)

# Configure logger
discount_logger = structlog.get_logger("discount_api")

# Create router
discount_router = APIRouter()


@discount_router.post(
    "/validate",
    response_model=DiscountValidationResponse,
    status_code=status.HTTP_200_OK,
    summary="Validate discount eligibility",
    description="Validate if a discount can be applied to a payment (Staff and Admin access)",
    responses={
        200: {"description": "Validation completed successfully"},
        400: {"description": "Bad request - Invalid discount data"},
        404: {"description": "Transaction not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
async def validate_discount(
    request: DiscountValidationRequest,
    current_user: User = Depends(get_staff_or_admin_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
) -> DiscountValidationResponse:
    """
    Validate discount eligibility for a payment.

    Checks business rules:
    - Discount only allowed for final redemption payments
    - Discount cannot exceed balance
    - Transaction must be in valid status (active/overdue/extended)
    - Calculates discount allocation (interest first, then principal)
    """

    try:
        discount_logger.info(
            "Validating discount",
            transaction_id=request.transaction_id,
            payment_amount=request.payment_amount,
            discount_amount=request.discount_amount,
            user_id=current_user.user_id
        )

        # Input validation
        if not request.transaction_id or not request.transaction_id.strip():
            raise ValidationError(
                "Transaction ID is required",
                error_code="MISSING_TRANSACTION_ID"
            )

        if request.payment_amount <= 0:
            raise ValidationError(
                "Payment amount must be greater than zero",
                error_code="INVALID_PAYMENT_AMOUNT"
            )

        if request.discount_amount <= 0:
            raise ValidationError(
                "Discount amount must be greater than zero",
                error_code="INVALID_DISCOUNT_AMOUNT"
            )

        # Validate discount eligibility
        validation_result = await DiscountService.validate_discount(
            transaction_id=request.transaction_id.strip(),
            payment_amount=request.payment_amount,
            discount_amount=request.discount_amount,
            current_user=current_user
        )

        discount_logger.info(
            "Discount validation completed",
            transaction_id=request.transaction_id,
            is_valid=validation_result["is_valid"],
            reason=validation_result.get("reason")
        )

        return DiscountValidationResponse(**validation_result)

    except ValidationError:
        raise
    except TransactionNotFoundError:
        raise
    except BusinessRuleError:
        raise
    except Exception as e:
        discount_logger.error(
            "Discount validation failed",
            transaction_id=request.transaction_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate discount"
        )


@discount_router.post(
    "/apply",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Apply discount to payment",
    description="Process payment with admin-approved discount (Staff and Admin access)",
    responses={
        201: {"description": "Payment with discount processed successfully"},
        400: {"description": "Bad request - Invalid payment or discount data"},
        401: {"description": "Unauthorized - Invalid admin PIN"},
        403: {"description": "Forbidden - Admin approval required"},
        404: {"description": "Transaction not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
async def apply_discount(
    request: Request,
    discount_request: PaymentWithDiscountRequest,
    current_user: User = Depends(get_staff_or_admin_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
) -> PaymentResponse:
    """
    Process payment with admin-approved discount.

    Requires:
    - Admin PIN verification
    - Valid final redemption payment
    - Discount amount within limits
    - Discount reason provided

    Discount allocation priority:
    1. Interest first
    2. Overdue fees
    3. Principal
    """

    try:
        discount_logger.info(
            "Processing payment with discount",
            transaction_id=discount_request.transaction_id,
            payment_amount=discount_request.payment_amount,
            discount_amount=discount_request.discount_amount,
            user_id=current_user.user_id
        )

        # Input validation
        if not discount_request.transaction_id or not discount_request.transaction_id.strip():
            raise ValidationError(
                "Transaction ID is required",
                error_code="MISSING_TRANSACTION_ID"
            )

        if discount_request.payment_amount <= 0:
            raise ValidationError(
                "Payment amount must be greater than zero",
                error_code="INVALID_PAYMENT_AMOUNT"
            )

        if discount_request.discount_amount <= 0:
            raise ValidationError(
                "Discount amount must be greater than zero",
                error_code="INVALID_DISCOUNT_AMOUNT"
            )

        if not discount_request.discount_reason or not discount_request.discount_reason.strip():
            raise ValidationError(
                "Discount reason is required",
                error_code="MISSING_DISCOUNT_REASON"
            )

        if not discount_request.admin_pin or len(discount_request.admin_pin) != 4:
            raise ValidationError(
                "Admin PIN must be exactly 4 digits",
                error_code="INVALID_ADMIN_PIN"
            )

        # Verify discount is valid
        validation_result = await DiscountService.validate_discount(
            transaction_id=discount_request.transaction_id.strip(),
            payment_amount=discount_request.payment_amount,
            discount_amount=discount_request.discount_amount,
            current_user=current_user
        )

        if not validation_result["is_valid"]:
            raise BusinessRuleError(
                validation_result.get("reason", "Discount is not valid"),
                error_code="DISCOUNT_NOT_VALID"
            )

        # Verify admin approval (get admin user by PIN)
        from app.models.user_model import User as UserModel

        # Find admin user by PIN - check all admin users
        admin_user = None
        all_admins = await UserModel.find(UserModel.role == "admin").to_list()
        for user in all_admins:
            if user.verify_pin(discount_request.admin_pin):
                admin_user = user
                break

        if not admin_user:
            discount_logger.warning(
                "Invalid admin PIN for discount approval",
                user_id=current_user.user_id,
                transaction_id=discount_request.transaction_id
            )
            raise AuthenticationError(
                "Invalid admin PIN",
                error_code="INVALID_ADMIN_PIN"
            )

        # Verify admin approval with DiscountService
        await DiscountService.verify_admin_approval(
            admin_user=admin_user,
            admin_pin=discount_request.admin_pin,
            discount_amount=discount_request.discount_amount,
            discount_reason=discount_request.discount_reason.strip()
        )

        # Process payment with discount
        payment = await PaymentService.process_payment_with_discount(
            transaction_id=discount_request.transaction_id.strip(),
            payment_amount=discount_request.payment_amount,
            processed_by_user_id=current_user.user_id,
            discount_amount=discount_request.discount_amount,
            discount_reason=discount_request.discount_reason.strip(),
            discount_approved_by=admin_user.user_id,
            client_timezone=client_timezone
        )

        # Log payment with discount activity
        from app.services.pawn_transaction_service import PawnTransactionService
        transaction = await PawnTransactionService.get_transaction_by_id(discount_request.transaction_id.strip())
        transaction_formatted_id = transaction.formatted_id or transaction.transaction_id

        # Build user-friendly description with discount and overdue fee info
        description = f"Process ${int(discount_request.payment_amount)} payment on {transaction_formatted_id} - Discount: ${int(discount_request.discount_amount)}"
        if payment.overdue_fee_portion > 0:
            description += f", Overdue fee: ${int(payment.overdue_fee_portion)}"
        description += f" - Reason: {discount_request.discount_reason.strip()}"

        await UserActivityService.log_payment_action(
            user_id=current_user.user_id,
            activity_type=UserActivityType.PAYMENT_PROCESSED,
            payment_id=payment.payment_id,
            transaction_id=payment.transaction_id,
            amount=discount_request.payment_amount,
            description=description,
            request=request
        )

        discount_logger.info(
            "Payment with discount processed successfully",
            transaction_id=discount_request.transaction_id,
            payment_id=payment.payment_id,
            payment_amount=discount_request.payment_amount,
            discount_amount=discount_request.discount_amount,
            approved_by=admin_user.user_id
        )

        return PaymentResponse.model_validate(payment)

    except ValidationError:
        raise
    except AuthenticationError:
        raise
    except BusinessRuleError:
        raise
    except TransactionNotFoundError:
        raise
    except PaymentValidationError as e:
        discount_logger.error(
            "Payment validation failed",
            transaction_id=discount_request.transaction_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except StaffValidationError as e:
        discount_logger.error(
            "Staff validation failed",
            transaction_id=discount_request.transaction_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        discount_logger.error(
            "Failed to process payment with discount",
            transaction_id=discount_request.transaction_id,
            error=str(e),
            error_type=type(e).__name__
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process payment with discount: {str(e)}"
        )


@discount_router.get(
    "/report/daily",
    response_model=DailyDiscountReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Get daily discount report",
    description="Generate daily discount report (Admin only)",
    responses={
        200: {"description": "Report generated successfully"},
        403: {"description": "Forbidden - Admin access required"},
        500: {"description": "Internal server error"}
    }
)
async def get_daily_discount_report(
    report_date: Optional[str] = None,
    current_user: User = Depends(get_admin_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
) -> DailyDiscountReportResponse:
    """
    Generate daily discount report.

    Admin only. Shows all discounts given for a specific date with breakdown by staff.
    """

    try:
        from datetime import datetime
        from app.core.timezone_utils import get_user_now

        # Parse report date or use today
        if report_date:
            try:
                target_date = datetime.fromisoformat(report_date)
            except ValueError:
                raise ValidationError(
                    "Invalid date format. Use ISO format (YYYY-MM-DD)",
                    error_code="INVALID_DATE_FORMAT"
                )
        else:
            target_date = get_user_now(client_timezone)

        discount_logger.info(
            "Generating daily discount report",
            report_date=target_date.date(),
            user_id=current_user.user_id
        )

        # Generate report
        report = await DiscountService.get_daily_discount_report(
            report_date=target_date,
            admin_user=current_user
        )

        return DailyDiscountReportResponse(**report)

    except ValidationError:
        raise
    except AuthenticationError:
        raise
    except Exception as e:
        discount_logger.error(
            "Failed to generate daily discount report",
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate discount report"
        )
