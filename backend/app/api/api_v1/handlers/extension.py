"""
Extension API handlers for FastAPI endpoints.

This module defines all extension-related API endpoints including
extension processing, history, eligibility checks, and receipts.
"""

# Standard library imports
from typing import Optional
from datetime import datetime

# Third-party imports
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
import structlog

# Local imports
from app.api.deps.user_deps import get_staff_or_admin_user
from app.api.deps.timezone_deps import get_client_timezone
from app.core.security_middleware import strict_rate_limit
from app.models.user_model import User
from app.schemas.extension_schema import (
    ExtensionCreate, ExtensionResponse, ExtensionListResponse,
    ExtensionEligibilityResponse, ExtensionSummaryResponse,
    ExtensionReceiptResponse, ExtensionHistoryResponse,
    ExtensionValidationResponse
)
from app.services.extension_service import (
    ExtensionService, ExtensionError, ExtensionValidationError, 
    TransactionNotFoundError, StaffValidationError, ExtensionNotAllowedError
)

# Configure logger
extension_logger = structlog.get_logger("extension_api")

# Create router
extension_router = APIRouter()


@extension_router.post(
    "/",
    response_model=ExtensionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Process extension",
    description="Process a loan extension for a pawn transaction (Staff and Admin access)",
    responses={
        201: {"description": "Extension processed successfully"},
        400: {"description": "Bad request - Invalid extension data or ineligible"},
        404: {"description": "Transaction not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
@strict_rate_limit()
async def process_extension(
    request: Request,
    extension_data: ExtensionCreate,
    current_user: User = Depends(get_staff_or_admin_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
) -> ExtensionResponse:
    """Process a loan extension with comprehensive error handling"""
    try:
        extension = await ExtensionService.process_extension(
            transaction_id=extension_data.transaction_id,
            extension_months=extension_data.extension_months,
            extension_fee_per_month=extension_data.extension_fee_per_month,
            processed_by_user_id=current_user.user_id,
            extension_reason=extension_data.extension_reason,
            internal_notes=extension_data.internal_notes,
            client_timezone=client_timezone
        )
        
        return ExtensionResponse.model_validate(extension.model_dump())
    
    except HTTPException:
        # Re-raise HTTP exceptions from service layer
        raise
    except TransactionNotFoundError as e:
        # Handle transaction not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except (ExtensionValidationError, StaffValidationError, ExtensionNotAllowedError) as e:
        # Handle business rule violations and validation errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ValueError as e:
        # Handle general validation errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Log unexpected errors for debugging
        extension_logger.error(
            "Unexpected error in process_extension",
            transaction_id=extension_data.transaction_id,
            error=str(e),
            exc_info=True
        )
        
        # Include the actual error in development
        error_detail = str(e) if str(e) else "Failed to process extension. Please try again later."
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extension processing failed: {error_detail}"
        )


@extension_router.get(
    "/transaction/{transaction_id}",
    response_model=ExtensionHistoryResponse,
    summary="Get extension history",
    description="Get complete extension history for a transaction (Staff and Admin access)",
    responses={
        200: {"description": "Extension history retrieved successfully"},
        404: {"description": "Transaction not found"},
        500: {"description": "Internal server error"}
    }
)
async def get_extension_history(
    transaction_id: str,
    current_user: User = Depends(get_staff_or_admin_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
) -> ExtensionHistoryResponse:
    """Get complete extension history for a transaction"""
    try:
        history = await ExtensionService.get_extension_history(transaction_id, client_timezone)
        return history
        
    except HTTPException:
        raise
    except TransactionNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        # Log unexpected errors for debugging
        extension_logger.error(
            "Unexpected error in get_extension_history",
            transaction_id=transaction_id,
            error=str(e),
            exc_info=True
        )
        
        # Include the actual error in development
        error_detail = str(e) if str(e) else "Failed to retrieve extension history. Please try again later."
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extension history retrieval failed: {error_detail}"
        )


@extension_router.get(
    "/transaction/{transaction_id}/summary",
    response_model=ExtensionSummaryResponse,
    summary="Get extension summary",
    description="Get extension summary for a transaction (Staff and Admin access)",
    responses={
        200: {"description": "Extension summary retrieved successfully"},
        404: {"description": "Transaction not found"},
        500: {"description": "Internal server error"}
    }
)
async def get_extension_summary(
    transaction_id: str,
    current_user: User = Depends(get_staff_or_admin_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
) -> ExtensionSummaryResponse:
    """Get extension summary for a transaction"""
    try:
        summary = await ExtensionService.get_extension_summary(transaction_id, client_timezone)
        return summary
        
    except HTTPException:
        raise
    except TransactionNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        # Log unexpected errors for debugging
        extension_logger.error(
            "Unexpected error in get_extension_summary",
            transaction_id=transaction_id,
            error=str(e),
            exc_info=True
        )
        
        # Include the actual error in development
        error_detail = str(e) if str(e) else "Failed to retrieve extension summary. Please try again later."
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extension summary retrieval failed: {error_detail}"
        )


@extension_router.get(
    "/transaction/{transaction_id}/eligibility",
    response_model=ExtensionEligibilityResponse,
    summary="Check extension eligibility",
    description="Check if transaction is eligible for extension (Staff and Admin access)",
    responses={
        200: {"description": "Extension eligibility checked successfully"},
        404: {"description": "Transaction not found"},
        500: {"description": "Internal server error"}
    }
)
async def check_extension_eligibility(
    transaction_id: str,
    extension_months: Optional[int] = Query(None, description="Requested extension months (1-3)"),
    current_user: User = Depends(get_staff_or_admin_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
) -> ExtensionEligibilityResponse:
    """Check if transaction is eligible for extension"""
    try:
        eligibility = await ExtensionService.check_extension_eligibility(
            transaction_id, extension_months
        )
        return eligibility
        
    except HTTPException:
        raise
    except TransactionNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        # Log unexpected errors for debugging
        extension_logger.error(
            "Unexpected error in check_extension_eligibility",
            transaction_id=transaction_id,
            error=str(e),
            exc_info=True
        )
        
        # Include the actual error in development
        error_detail = str(e) if str(e) else "Failed to check extension eligibility. Please try again later."
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extension eligibility check failed: {error_detail}"
        )


@extension_router.get(
    "/{extension_id}",
    response_model=ExtensionResponse,
    summary="Get extension by ID",
    description="Get extension details by ID (Staff and Admin access)",
    responses={
        200: {"description": "Extension details retrieved successfully"},
        404: {"description": "Extension not found"},
        500: {"description": "Internal server error"}
    }
)
async def get_extension_by_id(
    extension_id: str,
    current_user: User = Depends(get_staff_or_admin_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
) -> ExtensionResponse:
    """Get extension details by ID"""
    try:
        extension = await ExtensionService.get_extension_by_id(extension_id)
        if not extension:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Extension not found"
            )
        
        return ExtensionResponse.model_validate(extension.model_dump())
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve extension. Please try again later."
        )


@extension_router.get(
    "/{extension_id}/receipt",
    response_model=ExtensionReceiptResponse,
    summary="Get extension receipt",
    description="Get extension receipt data for printing/display (Staff and Admin access)",
    responses={
        200: {"description": "Extension receipt retrieved successfully"},
        404: {"description": "Extension not found"},
        500: {"description": "Internal server error"}
    }
)
async def get_extension_receipt(
    extension_id: str,
    current_user: User = Depends(get_staff_or_admin_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
) -> ExtensionReceiptResponse:
    """Get extension receipt data for printing/display"""
    try:
        receipt = await ExtensionService.generate_extension_receipt(extension_id)
        return receipt
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate extension receipt. Please try again later."
        )


@extension_router.post(
    "/validate",
    response_model=ExtensionValidationResponse,
    summary="Validate extension",
    description="Validate extension before processing (Staff and Admin access)",
    responses={
        200: {"description": "Extension validation completed"},
        404: {"description": "Transaction not found"},
        500: {"description": "Internal server error"}
    }
)
async def validate_extension(
    extension_data: ExtensionCreate,
    current_user: User = Depends(get_staff_or_admin_user)
) -> ExtensionValidationResponse:
    """Validate extension before processing"""
    try:
        validation = await ExtensionService.validate_extension_request(
            transaction_id=extension_data.transaction_id,
            extension_months=extension_data.extension_months,
            extension_fee_per_month=extension_data.extension_fee_per_month
        )
        return validation
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate extension. Please try again later."
        )


@extension_router.get(
    "/",
    response_model=ExtensionListResponse,
    summary="Get extensions list",
    description="Get paginated list of extensions with filtering (Staff and Admin access)",
    responses={
        200: {"description": "Extensions list retrieved successfully"},
        400: {"description": "Bad request - Invalid parameters"},
        500: {"description": "Internal server error"}
    }
)
async def get_extensions_list(
    transaction_id: Optional[str] = Query(None, description="Filter by transaction ID"),
    processed_by: Optional[str] = Query(None, description="Filter by staff member"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    extension_months: Optional[int] = Query(None, description="Filter by extension duration"),
    page: int = Query(1, description="Page number", ge=1),
    page_size: int = Query(20, description="Items per page", ge=1, le=100),
    sort_by: str = Query("extension_date", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order", pattern="^(asc|desc)$"),
    client_timezone: Optional[str] = Depends(get_client_timezone),
    current_user: User = Depends(get_staff_or_admin_user)
) -> ExtensionListResponse:
    """Get paginated list of extensions with optional filtering"""
    try:
        return await ExtensionService.get_extensions_list(
            transaction_id=transaction_id,
            processed_by=processed_by,
            start_date=start_date,
            end_date=end_date,
            extension_months=extension_months,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
            client_timezone=client_timezone
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve extensions. Please try again later."
        )


@extension_router.post(
    "/{extension_id}/cancel",
    response_model=ExtensionResponse,
    summary="Cancel extension",
    description="Cancel an extension (reverses extension and restores original date) (Admin only)",
    responses={
        200: {"description": "Extension cancelled successfully"},
        400: {"description": "Bad request - Cannot cancel extension"},
        403: {"description": "Admin access required"},
        404: {"description": "Extension not found"},
        500: {"description": "Internal server error"}
    }
)
async def cancel_extension(
    extension_id: str,
    reason: Optional[str] = Query(None, description="Reason for cancelling extension"),
    current_user: User = Depends(get_staff_or_admin_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
) -> ExtensionResponse:
    """Cancel an extension (reverses extension and restores original date)"""
    try:
        # Check if user has admin privileges for cancelling extensions
        is_admin = (current_user.role == "admin" or 
                   (hasattr(current_user.role, 'value') and current_user.role.value == "admin"))
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin privileges required to cancel extensions"
            )
        
        extension = await ExtensionService.cancel_extension(
            extension_id=extension_id,
            cancelled_by_user_id=current_user.user_id,
            cancellation_reason=reason
        )
        
        return ExtensionResponse.model_validate(extension.model_dump())
        
    except HTTPException:
        raise
    except ExtensionError as e:
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
        extension_logger.error(
            "Unexpected error in cancel_extension",
            extension_id=extension_id,
            error=str(e),
            exc_info=True
        )
        
        # Include the actual error in development
        error_detail = str(e) if str(e) else "Failed to cancel extension. Please try again later."
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extension cancellation failed: {error_detail}"
        )