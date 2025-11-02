"""
Overdue Fee API Handler

Endpoints for managing manually-entered overdue fees on overdue transactions.
Staff/admin can set, retrieve, and clear overdue fees that are added to redemption amounts.
"""

from fastapi import APIRouter, Depends, HTTPException
import structlog

from app.schemas.overdue_fee_schema import (
    OverdueFeeSetRequest,
    OverdueFeeResponse,
    OverdueFeeInfoResponse,
    OverdueFeeTotalResponse,
    OverdueFeeValidationRequest,
    OverdueFeeValidationResponse,
    OverdueFeeClearRequest
)
from app.services.overdue_fee_service import (
    OverdueFeeService,
    OverdueFeeError,
    TransactionNotFoundError,
    StaffValidationError,
    OverdueFeeValidationError
)
from app.core.auth import get_current_user
from app.models.user_model import User

# Configure logger
logger = structlog.get_logger("overdue_fee_api")

# Create router
router = APIRouter(prefix="/overdue-fee", tags=["overdue_fee"])


@router.post("/{transaction_id}/set", response_model=OverdueFeeResponse)
async def set_overdue_fee(
    transaction_id: str,
    request: OverdueFeeSetRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Set or update overdue fee for a transaction (staff/admin only).

    **Business Rules:**
    - Only applicable to transactions with OVERDUE status
    - Fee amount is manually entered by staff
    - Maximum fee: $10,000
    - Requires active staff/admin user

    **Returns:**
    - Updated transaction with overdue fee set
    - Audit trail entry created
    """
    try:
        user_id = current_user.user_id

        transaction = await OverdueFeeService.set_overdue_fee(
            transaction_id=transaction_id,
            overdue_fee=request.overdue_fee,
            set_by_user_id=user_id,
            notes=request.notes
        )

        return OverdueFeeResponse(
            success=True,
            message=f"Overdue fee: ${request.overdue_fee}",
            transaction_id=transaction_id,
            overdue_fee=transaction.overdue_fee,
            status=transaction.status
        )

    except TransactionNotFoundError as e:
        logger.error(f"Transaction not found: {transaction_id}")
        raise HTTPException(status_code=404, detail=str(e))

    except StaffValidationError as e:
        logger.error(f"Staff validation failed: {str(e)}")
        raise HTTPException(status_code=403, detail=str(e))

    except OverdueFeeValidationError as e:
        logger.error(f"Overdue fee validation failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error(f"Error setting overdue fee: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to set overdue fee: {str(e)}")


@router.post("/{transaction_id}/clear", response_model=OverdueFeeResponse)
async def clear_overdue_fee(
    transaction_id: str,
    request: OverdueFeeClearRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Clear/remove overdue fee from a transaction (staff/admin only).

    **Business Rules:**
    - Can only clear if overdue fee exists
    - Requires active staff/admin user
    - Audit trail entry created

    **Returns:**
    - Updated transaction with overdue fee cleared
    """
    try:
        user_id = current_user.user_id

        transaction = await OverdueFeeService.clear_overdue_fee(
            transaction_id=transaction_id,
            cleared_by_user_id=user_id,
            reason=request.reason
        )

        return OverdueFeeResponse(
            success=True,
            message="Overdue fee cleared",
            transaction_id=transaction_id,
            overdue_fee=0,
            status=transaction.status
        )

    except TransactionNotFoundError as e:
        logger.error(f"Transaction not found: {transaction_id}", error=str(e))
        raise HTTPException(status_code=404, detail=str(e))

    except StaffValidationError as e:
        logger.error(f"Staff validation failed", error=str(e))
        raise HTTPException(status_code=403, detail=str(e))

    except OverdueFeeValidationError as e:
        logger.error(f"Overdue fee validation failed", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error(f"Error clearing overdue fee", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to clear overdue fee: {str(e)}")


@router.get("/{transaction_id}/info", response_model=OverdueFeeInfoResponse)
async def get_overdue_fee_info(
    transaction_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get overdue fee information for a transaction.

    **Returns:**
    - Current overdue fee amount
    - Transaction status
    - Days overdue
    - Eligibility for setting fee
    """
    try:
        info = await OverdueFeeService.get_overdue_fee_info(transaction_id)

        return OverdueFeeInfoResponse(**info)

    except TransactionNotFoundError as e:
        logger.error(f"Transaction not found: {transaction_id}", error=str(e))
        raise HTTPException(status_code=404, detail=str(e))

    except Exception as e:
        logger.error(f"Error getting overdue fee info", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get overdue fee info: {str(e)}")


@router.get("/{transaction_id}/total", response_model=OverdueFeeTotalResponse)
async def get_total_with_overdue_fee(
    transaction_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Calculate total redemption amount including overdue fee.

    **Returns:**
    - Base balance (principal + interest + extension fees)
    - Overdue fee amount
    - Total redemption amount
    - Detailed breakdown
    """
    try:
        total_info = await OverdueFeeService.calculate_total_with_overdue_fee(transaction_id)

        return OverdueFeeTotalResponse(**total_info)

    except TransactionNotFoundError as e:
        logger.error(f"Transaction not found: {transaction_id}", error=str(e))
        raise HTTPException(status_code=404, detail=str(e))

    except Exception as e:
        logger.error(f"Error calculating total with overdue fee", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to calculate total: {str(e)}")


@router.post("/{transaction_id}/validate", response_model=OverdueFeeValidationResponse)
async def validate_overdue_fee(
    transaction_id: str,
    request: OverdueFeeValidationRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Validate proposed overdue fee amount before setting.

    **Returns:**
    - Validation result (valid/invalid)
    - Validation errors and warnings
    - Impact on total balance
    """
    try:
        validation = await OverdueFeeService.validate_overdue_fee_amount(
            transaction_id=transaction_id,
            proposed_fee=request.proposed_fee
        )

        return OverdueFeeValidationResponse(**validation)

    except TransactionNotFoundError as e:
        logger.error(f"Transaction not found: {transaction_id}", error=str(e))
        raise HTTPException(status_code=404, detail=str(e))

    except Exception as e:
        logger.error(f"Error validating overdue fee", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to validate overdue fee: {str(e)}")
