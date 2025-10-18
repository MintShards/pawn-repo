"""
Customer Consistency Validation API Endpoints

Admin-only endpoints for validating and fixing customer data consistency.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel

from app.core.auth import get_admin_user
from app.models.user_model import User
from app.services.consistency_validation_service import ConsistencyValidationService


consistency_router = APIRouter()


class ValidateCustomerRequest(BaseModel):
    """Request schema for customer validation"""
    phone_number: str


class FixCustomerRequest(BaseModel):
    """Request schema for fixing customer consistency"""
    phone_number: str


@consistency_router.get(
    "/validate/{phone_number}",
    summary="Validate customer consistency",
    description="Validate customer counter consistency against actual transaction data (Admin only)",
    responses={
        200: {"description": "Validation completed"},
        403: {"description": "Admin access required"},
        404: {"description": "Customer not found"},
        500: {"description": "Internal server error"}
    }
)
async def validate_customer_consistency(
    phone_number: str,
    current_user: User = Depends(get_admin_user)
) -> dict:
    """Validate consistency for a specific customer"""
    try:
        result = await ConsistencyValidationService.validate_customer_consistency(phone_number)

        if "error" in result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result["error"]
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate customer consistency"
        )


@consistency_router.post(
    "/fix/{phone_number}",
    summary="Fix customer consistency",
    description="Fix customer counter inconsistencies (Admin only)",
    responses={
        200: {"description": "Consistency fixed or not needed"},
        403: {"description": "Admin access required"},
        404: {"description": "Customer not found"},
        500: {"description": "Internal server error"}
    }
)
async def fix_customer_consistency(
    phone_number: str,
    current_user: User = Depends(get_admin_user)
) -> dict:
    """Fix consistency issues for a specific customer"""
    try:
        result = await ConsistencyValidationService.fix_customer_consistency(
            phone_number=phone_number,
            admin_user_id=current_user.user_id
        )

        if "error" in result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result["error"]
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fix customer consistency"
        )


@consistency_router.get(
    "/validate-all",
    summary="Validate all customers",
    description="Validate consistency for all customers (Admin only)",
    responses={
        200: {"description": "Validation completed"},
        403: {"description": "Admin access required"},
        500: {"description": "Internal server error"}
    }
)
async def validate_all_customers(
    limit: Optional[int] = Query(None, description="Limit number of customers to validate", ge=1, le=1000),
    fix_automatically: bool = Query(False, description="Automatically fix discrepancies"),
    current_user: User = Depends(get_admin_user)
) -> dict:
    """Validate consistency for all customers with optional auto-fix"""
    try:
        result = await ConsistencyValidationService.validate_all_customers(
            limit=limit,
            fix_automatically=fix_automatically,
            admin_user_id=current_user.user_id if fix_automatically else None
        )

        if "error" in result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate all customers"
        )


@consistency_router.get(
    "/report",
    summary="Get consistency report",
    description="Generate comprehensive consistency report (Admin only)",
    responses={
        200: {"description": "Report generated"},
        403: {"description": "Admin access required"},
        500: {"description": "Internal server error"}
    }
)
async def get_consistency_report(
    current_user: User = Depends(get_admin_user)
) -> dict:
    """Generate comprehensive consistency report"""
    try:
        return await ConsistencyValidationService.get_consistency_report()

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate consistency report"
        )
