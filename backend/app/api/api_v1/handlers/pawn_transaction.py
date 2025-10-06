"""
Pawn Transaction API handlers for FastAPI endpoints.

This module defines all pawn transaction-related API endpoints including
CRUD operations, payment processing, extensions, and financial calculations.
"""

# Standard library imports
from typing import Optional, List
from datetime import datetime, UTC

# Third-party imports
from fastapi import APIRouter, Depends, HTTPException, status, Query
import structlog

# Local imports
from app.api.deps.user_deps import get_current_user, get_staff_or_admin_user, get_admin_user
from app.api.deps.timezone_deps import get_client_timezone
from app.models.user_model import User
from app.models.pawn_transaction_model import TransactionStatus
from app.schemas.pawn_transaction_schema import (
    PawnTransactionCreate, PawnTransactionResponse, PawnTransactionListResponse,
    TransactionStatusUpdate, BalanceResponse, InterestBreakdownResponse,
    PayoffAmountResponse, TransactionSummaryResponse, TransactionSearchFilters,
    BulkStatusUpdateRequest, BulkStatusUpdateResponse, BulkNotesRequest, 
    BulkNotesResponse, BulkRedemptionRequest, BulkRedemptionResponse,
    TransactionVoidRequest, TransactionCancelRequest, 
    TransactionVoidResponse, UnifiedSearchRequest, UnifiedSearchResponse, 
    BatchStatusCountResponse, UnifiedSearchType
)
from app.schemas.receipt_schema import (
    InitialPawnReceiptResponse, PaymentReceiptResponse, ExtensionReceiptResponse,
    ReceiptTextResponse, ReceiptSummaryResponse, ReceiptGenerationRequest
)
from app.services.pawn_transaction_service import (
    PawnTransactionService, PawnTransactionError, 
    CustomerValidationError, StaffValidationError, TransactionStateError
)
from app.services.unified_search_service import UnifiedSearchService
from app.services.payment_service import PaymentService
from app.services.interest_calculation_service import (
    InterestCalculationService, InterestCalculationError
)
from app.services.receipt_service import ReceiptService, ReceiptGenerationError
from app.core.exceptions import (
    ValidationError, BusinessRuleError, TransactionNotFoundError,
    CustomerNotFoundError, DatabaseError, AuthorizationError, AuthenticationError
)
from app.models.customer_model import Customer
from app.models.pawn_transaction_model import PawnTransaction

# Configure logger
transaction_logger = structlog.get_logger("pawn_transaction_api")

# Create router
pawn_transaction_router = APIRouter()


@pawn_transaction_router.get("/debug/timezone")
async def debug_timezone(
    client_timezone: Optional[str] = Depends(get_client_timezone)
):
    """Debug endpoint to check timezone detection"""
    from app.core.timezone_utils import get_user_now, format_user_datetime
    
    utc_now = datetime.now(UTC)
    
    result = {
        "utc_time": utc_now.isoformat(),
        "client_timezone": client_timezone,
        "timezone_detected": client_timezone is not None
    }
    
    if client_timezone:
        local_now = get_user_now(client_timezone)
        result["local_time"] = local_now.isoformat()
        result["formatted_time"] = format_user_datetime(utc_now, client_timezone)
    
    return result


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
    current_user: User = Depends(get_staff_or_admin_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
) -> PawnTransactionResponse:
    """Create a new pawn transaction with comprehensive error handling"""
    
    try:
        # Input validation
        if not transaction_data.items:
            raise ValidationError(
                "At least one item is required for pawn transaction",
                error_code="NO_ITEMS_PROVIDED"
            )
        
        if len(transaction_data.items) > 10:
            raise ValidationError(
                "Maximum 10 items allowed per transaction",
                error_code="TOO_MANY_ITEMS",
                details={"max_items": 10, "provided_items": len(transaction_data.items)}
            )
        
        # Business rule validation
        if transaction_data.loan_amount <= 0:
            raise BusinessRuleError(
                "Loan amount must be greater than zero",
                error_code="INVALID_LOAN_AMOUNT"
            )
        
        if transaction_data.monthly_interest_amount < 0:
            raise BusinessRuleError(
                "Interest amount cannot be negative",
                error_code="INVALID_INTEREST_AMOUNT"
            )
        
        # Verify customer exists
        try:
            customer = await Customer.find_one(Customer.phone_number == transaction_data.customer_id)
            if not customer:
                raise CustomerNotFoundError(
                    transaction_data.customer_id,
                    error_code="CUSTOMER_NOT_FOUND"
                )
        except Exception as e:
            if isinstance(e, CustomerNotFoundError):
                raise
            raise DatabaseError(
                "Failed to verify customer information",
                error_code="DATABASE_ERROR"
            )
        
        # Validate items
        items_data = []
        for idx, item in enumerate(transaction_data.items, 1):
            if not item.description or not item.description.strip():
                raise ValidationError(
                    f"Item {idx} description is required",
                    error_code="MISSING_ITEM_DESCRIPTION",
                    details={"item_number": idx}
                )
            
            items_data.append({
                "description": item.description.strip(),
                "serial_number": item.serial_number.strip() if item.serial_number else None
            })
        
        # Log transaction creation
        transaction_logger.info(
            "Creating pawn transaction",
            customer_id=transaction_data.customer_id,
            loan_amount=transaction_data.loan_amount,
            items_count=len(items_data),
            created_by=current_user.user_id
        )
        
        # Create transaction
        transaction = await PawnTransactionService.create_transaction(
            customer_phone=transaction_data.customer_id,
            created_by_user_id=current_user.user_id,
            loan_amount=transaction_data.loan_amount,
            monthly_interest_amount=transaction_data.monthly_interest_amount,
            storage_location=transaction_data.storage_location.strip() if transaction_data.storage_location else None,
            items=items_data,
            internal_notes=transaction_data.internal_notes.strip() if transaction_data.internal_notes else None,
            client_timezone=client_timezone
        )
        
        transaction_logger.info(
            "Pawn transaction created successfully",
            transaction_id=transaction.transaction_id,
            customer_id=transaction_data.customer_id
        )
        
        return PawnTransactionResponse.model_validate(transaction.model_dump())
        
    except (ValidationError, BusinessRuleError, CustomerNotFoundError, DatabaseError):
        # Re-raise known exceptions to be handled by global handlers
        raise
    except (CustomerValidationError, StaffValidationError, PawnTransactionError) as e:
        # Convert legacy service exceptions to new exception types
        if isinstance(e, CustomerValidationError):
            if "not found" in str(e).lower():
                raise CustomerNotFoundError(transaction_data.customer_id)
            else:
                raise ValidationError(str(e), error_code="CUSTOMER_VALIDATION_ERROR")
        elif isinstance(e, StaffValidationError):
            raise AuthorizationError(f"Staff validation error: {str(e)}")
        else:
            raise BusinessRuleError(str(e), error_code="TRANSACTION_ERROR")
    except Exception as e:
        transaction_logger.error(
            "Unexpected error creating pawn transaction",
            customer_id=transaction_data.customer_id,
            error=str(e),
            exc_info=True
        )
        raise DatabaseError("Failed to create pawn transaction due to unexpected error")


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
    search_text: Optional[str] = Query(None, description="Search by transaction ID (PW000123) or customer phone number"),
    min_amount: Optional[int] = Query(None, description="Minimum loan amount filter"),
    max_amount: Optional[int] = Query(None, description="Maximum loan amount filter"),
    start_date: Optional[datetime] = Query(None, description="Start date filter (pawn date)"),
    end_date: Optional[datetime] = Query(None, description="End date filter (pawn date)"),
    maturity_date_from: Optional[datetime] = Query(None, description="Maturity date from filter"),
    maturity_date_to: Optional[datetime] = Query(None, description="Maturity date to filter"),
    min_days_overdue: Optional[int] = Query(None, description="Minimum days overdue filter"),
    max_days_overdue: Optional[int] = Query(None, description="Maximum days overdue filter"),
    storage_location: Optional[str] = Query(None, description="Storage location filter"),
    page: int = Query(1, description="Page number", ge=1),
    page_size: int = Query(20, description="Items per page", ge=1, le=100),
    sort_by: str = Query("updated_at", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_staff_or_admin_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
) -> PawnTransactionListResponse:
    """Get paginated list of pawn transactions with optional filtering"""
    try:
        # Create filter object
        filters = TransactionSearchFilters(
            status=status_filter,
            customer_id=customer_id,
            search_text=search_text,
            min_amount=min_amount,
            max_amount=max_amount,
            start_date=start_date,
            end_date=end_date,
            maturity_date_from=maturity_date_from,
            maturity_date_to=maturity_date_to,
            min_days_overdue=min_days_overdue,
            max_days_overdue=max_days_overdue,
            storage_location=storage_location,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        return await PawnTransactionService.get_transactions_list(filters, client_timezone)
    
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
        transaction_logger.error("Unexpected error in get_pawn_transactions_list", error=str(e), traceback=traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve transactions: {str(e)}"
        )


@pawn_transaction_router.post(
    "/search",
    response_model=UnifiedSearchResponse,
    summary="Unified search for pawn transactions",
    description="Intelligent search across all transaction data with auto-detection of search type (Staff and Admin access)",
    responses={
        200: {"description": "Search results retrieved successfully"},
        400: {"description": "Invalid search parameters"},
        401: {"description": "Authentication required"},
        403: {"description": "Staff or Admin access required"},
        500: {"description": "Internal server error"}
    }
)
async def unified_search_transactions(
    search_request: UnifiedSearchRequest,
    current_user: User = Depends(get_staff_or_admin_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
) -> UnifiedSearchResponse:
    """
    Unified search endpoint with intelligent search type detection and optimization.
    
    Supports searching by:
    - Transaction ID (PW000123)
    - Extension ID (EX000015)  
    - Customer phone number (1234567890)
    - Customer name (John Smith)
    - Loan amount ($500)
    - Storage location (shelf)
    - Full text search
    """
    try:
        transaction_logger.info("🔍 UNIFIED SEARCH: Processing search request",
                              search_text=search_request.search_text[:50],
                              search_type=search_request.search_type,
                              user_id=current_user.user_id)
        
        # Execute unified search
        search_result = await UnifiedSearchService.search_transactions(
            search_text=search_request.search_text,
            search_type=search_request.search_type,  # Already correct type from schema
            include_extensions=search_request.include_extensions,
            include_items=search_request.include_items,
            include_customer=search_request.include_customer,
            client_timezone=client_timezone,
            page=search_request.page,
            page_size=search_request.page_size
        )
        
        transaction_logger.info("✅ UNIFIED SEARCH: Search completed successfully",
                              results_count=len(search_result.transactions),
                              total_count=search_result.total_count,
                              execution_time=search_result.search_metadata.get("execution_time_ms", 0),
                              cache_hit=search_result.search_metadata.get("cache_hit", False))
        
        return UnifiedSearchResponse(
            transactions=search_result.transactions,
            total_count=search_result.total_count,
            search_metadata=search_result.search_metadata
        )
    
    except ValueError as e:
        transaction_logger.warning("❌ UNIFIED SEARCH: Invalid search parameters",
                                 search_text=search_request.search_text[:50],
                                 error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid search parameters: {str(e)}"
        )
    except Exception as e:
        transaction_logger.error("❌ UNIFIED SEARCH: Search failed unexpectedly",
                               search_text=search_request.search_text[:50],
                               error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )


@pawn_transaction_router.get(
    "/status-counts",
    response_model=BatchStatusCountResponse,
    summary="Get transaction status counts",
    description="Get counts for all transaction statuses in a single optimized query (Staff and Admin access)",
    responses={
        200: {"description": "Status counts retrieved successfully"},
        401: {"description": "Authentication required"},
        403: {"description": "Staff or Admin access required"},
        500: {"description": "Internal server error"}
    }
)
async def get_batch_status_counts(
    current_user: User = Depends(get_staff_or_admin_user)
) -> BatchStatusCountResponse:
    """
    Get all transaction status counts in a single optimized aggregation query.
    
    This endpoint replaces multiple individual status count queries with a single
    efficient batch operation, reducing API calls and improving performance.
    """
    start_time = datetime.now(UTC)
    
    try:
        from app.core.redis_cache import BusinessCache
        
        cache_key = "transaction_status_counts"
        
        # Check cache first
        cached_result = await BusinessCache.get(cache_key)
        if cached_result is not None:
            execution_time = (datetime.now(UTC) - start_time).total_seconds() * 1000
            transaction_logger.info("🎯 STATUS COUNTS: Cache hit",
                                  execution_time_ms=execution_time)
            return BatchStatusCountResponse(
                status_counts=cached_result["status_counts"],
                total_transactions=cached_result["total_transactions"], 
                cache_hit=True,
                execution_time_ms=execution_time
            )
        
        # Execute single aggregation query for all status counts
        from app.models.pawn_transaction_model import PawnTransaction
        
        pipeline = [
            {
                "$group": {
                    "_id": "$status",
                    "count": {"$sum": 1}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "status_counts": {
                        "$push": {
                            "k": "$_id",
                            "v": "$count"
                        }
                    },
                    "total": {"$sum": "$count"}
                }
            }
        ]
        
        result = await PawnTransaction.aggregate(pipeline).to_list()
        
        if result:
            # Convert to dictionary format
            status_counts = {item["k"]: item["v"] for item in result[0]["status_counts"]}
            total_transactions = result[0]["total"]
        else:
            status_counts = {}
            total_transactions = 0
        
        # Ensure all status types are present with 0 counts if missing
        all_statuses = ["active", "overdue", "extended", "redeemed", "forfeited", "sold", "hold", "voided", "canceled"]
        for status in all_statuses:
            if status not in status_counts:
                status_counts[status] = 0
        
        execution_time = (datetime.now(UTC) - start_time).total_seconds() * 1000
        
        # Cache the result for 60 seconds
        cache_data = {
            "status_counts": status_counts,
            "total_transactions": total_transactions
        }
        await BusinessCache.set(cache_key, cache_data, ttl_seconds=60)
        
        transaction_logger.info("✅ STATUS COUNTS: Query completed successfully",
                              total_transactions=total_transactions,
                              execution_time_ms=execution_time,
                              status_breakdown=list(status_counts.keys()))
        
        return BatchStatusCountResponse(
            status_counts=status_counts,
            total_transactions=total_transactions,
            cache_hit=False,
            execution_time_ms=round(execution_time, 2)
        )
    
    except Exception as e:
        execution_time = (datetime.now(UTC) - start_time).total_seconds() * 1000
        transaction_logger.error("❌ STATUS COUNTS: Query failed",
                               execution_time_ms=execution_time,
                               error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get status counts: {str(e)}"
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
        
        # Get transaction items
        from app.models.pawn_item_model import PawnItem
        from app.schemas.pawn_transaction_schema import PawnItemResponse
        
        items = await PawnItem.find(
            PawnItem.transaction_id == transaction_id
        ).sort(PawnItem.item_number).to_list()
        
        # Convert to response format
        transaction_dict = transaction.model_dump()
        transaction_dict['items'] = [PawnItemResponse.model_validate(item.model_dump()) for item in items]
        
        return PawnTransactionResponse.model_validate(transaction_dict)
        
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
        transaction_logger.error("Unexpected error in get_transaction_summary", error=str(e), traceback=traceback.format_exc())
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
        transaction_logger.error("Unexpected error in get_transaction_balance", error=str(e), traceback=traceback.format_exc())
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
        transaction_logger.error("Unexpected error in get_interest_breakdown", error=str(e), traceback=traceback.format_exc())
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
        transaction_logger.error("Unexpected error in get_payoff_amount", error=str(e), traceback=traceback.format_exc())
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
        transaction_logger.error("Unexpected error in update_transaction_status", error=str(e), traceback=traceback.format_exc())
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
        transaction_logger.error("Unexpected error in bulk_update_transaction_status", error=str(e), traceback=traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to perform bulk status update: {str(e)}"
        )


@pawn_transaction_router.post(
    "/bulk-add-notes",
    response_model=BulkNotesResponse,
    summary="Bulk add notes to transactions",
    description="Add the same note to multiple transactions (Staff and Admin access)",
    responses={
        200: {"description": "Bulk notes addition completed"},
        400: {"description": "Bad request - Invalid data"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
async def bulk_add_notes_to_transactions(
    bulk_notes: BulkNotesRequest,
    current_user: User = Depends(get_staff_or_admin_user)
) -> BulkNotesResponse:
    """Add the same note to multiple transactions"""
    try:
        result = await PawnTransactionService.bulk_add_notes(
            transaction_ids=bulk_notes.transaction_ids,
            note=bulk_notes.note,
            added_by_user_id=current_user.user_id
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
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Log unexpected errors for debugging
        import traceback
        transaction_logger.error("Unexpected error in bulk_add_notes_to_transactions", error=str(e), traceback=traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add notes to transactions: {str(e)}"
        )


@pawn_transaction_router.post(
    "/bulk-redemption",
    response_model=BulkRedemptionResponse,
    summary="Bulk process redemption payments",
    description="Process cash redemption payments for multiple transactions with validation (Staff and Admin access)",
    responses={
        200: {"description": "Bulk redemption completed"},
        400: {"description": "Bad request - Invalid transactions or payment data"},
        500: {"description": "Internal server error"}
    }
)
async def bulk_process_redemption(
    bulk_redemption: BulkRedemptionRequest,
    current_user: User = Depends(get_staff_or_admin_user)
) -> BulkRedemptionResponse:
    """
    Process cash redemption payments for multiple transactions.

    Performs pre-flight validation, processes payments sequentially,
    and provides detailed error reporting for each transaction.

    Valid statuses for redemption: Active, Overdue, Extended
    """
    try:
        # Pre-flight validation: Check all transactions before processing any
        validation_errors = []
        valid_transaction_ids = []
        redeemable_statuses = {TransactionStatus.ACTIVE, TransactionStatus.OVERDUE, TransactionStatus.EXTENDED}

        transaction_logger.info(
            "Starting bulk redemption pre-flight validation",
            transaction_count=len(bulk_redemption.transaction_ids),
            user_id=current_user.user_id
        )

        for transaction_id in bulk_redemption.transaction_ids:
            try:
                # Validate transaction exists
                transaction = await PawnTransactionService.get_transaction_by_id(transaction_id)
                if not transaction:
                    validation_errors.append(f"{transaction_id}: Transaction not found")
                    continue

                # Validate transaction status is redeemable
                if transaction.status not in redeemable_statuses:
                    validation_errors.append(
                        f"{transaction_id}: Cannot redeem '{transaction.status}' status (must be active, overdue, or extended)"
                    )
                    continue

                # Validate transaction has outstanding balance
                balance_info = await PawnTransactionService.calculate_current_balance(transaction_id)
                if balance_info["current_balance"] <= 0:
                    validation_errors.append(
                        f"{transaction_id}: Already paid off (balance: ${balance_info['current_balance']})"
                    )
                    continue

                # Transaction is valid for redemption
                valid_transaction_ids.append(transaction_id)

            except Exception as e:
                validation_errors.append(f"{transaction_id}: Validation failed - {str(e)}")

        # Log validation summary
        transaction_logger.info(
            "Bulk redemption validation complete",
            valid_count=len(valid_transaction_ids),
            invalid_count=len(validation_errors),
            total_requested=len(bulk_redemption.transaction_ids)
        )

        # Process payments for valid transactions
        results = []
        processing_errors = []
        total_amount = 0

        for transaction_id in valid_transaction_ids:
            try:
                # Get current balance for payment processing
                balance_info = await PawnTransactionService.calculate_current_balance(transaction_id)
                payoff_amount = balance_info["current_balance"]

                transaction_logger.info(
                    "Processing bulk redemption payment",
                    transaction_id=transaction_id,
                    payoff_amount=payoff_amount,
                    user_id=current_user.user_id
                )

                # Process payment (always cash for bulk redemption)
                payment_result = await PaymentService.process_payment(
                    transaction_id=transaction_id,
                    payment_amount=payoff_amount,
                    processed_by_user_id=current_user.user_id,
                    client_timezone=None  # Use UTC for bulk operations
                )

                # Add notes if provided (non-blocking)
                if bulk_redemption.notes and bulk_redemption.notes.strip():
                    try:
                        await PawnTransactionService.bulk_add_notes(
                            transaction_ids=[transaction_id],
                            note=f"Bulk redemption: {bulk_redemption.notes.strip()}",
                            added_by_user_id=current_user.user_id
                        )
                    except Exception as note_error:
                        # Log note failure but don't block redemption
                        transaction_logger.warning(
                            "Note addition failed for bulk redemption",
                            transaction_id=transaction_id,
                            error=str(note_error)
                        )

                # Track successful redemption
                results.append({
                    "transaction_id": transaction_id,
                    "payment_id": payment_result.payment_id,
                    "amount_paid": payoff_amount,
                    "status": "redeemed"
                })
                total_amount += payoff_amount

            except Exception as e:
                error_msg = f"{transaction_id}: Payment processing failed - {str(e)}"
                processing_errors.append(error_msg)
                transaction_logger.error(
                    "Bulk redemption payment failed",
                    transaction_id=transaction_id,
                    error=str(e)
                )

        # Combine all errors (validation + processing)
        all_errors = validation_errors + processing_errors

        # Log completion summary
        transaction_logger.info(
            "Bulk redemption operation complete",
            total_requested=len(bulk_redemption.transaction_ids),
            successful=len(results),
            failed=len(all_errors),
            total_amount=total_amount
        )

        return BulkRedemptionResponse(
            total_requested=len(bulk_redemption.transaction_ids),
            success_count=len(results),
            error_count=len(all_errors),
            total_amount_processed=total_amount,
            successful_redemptions=results,
            errors=all_errors
        )

    except HTTPException:
        raise
    except Exception as e:
        # Log unexpected errors for debugging
        import traceback
        transaction_logger.error(
            "Unexpected error in bulk_process_redemption",
            error=str(e),
            traceback=traceback.format_exc(),
            user_id=current_user.user_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process bulk redemption: {str(e)}"
        )


@pawn_transaction_router.post(
    "/update-all-statuses",
    summary="Update all transaction statuses",
    description="Update statuses for all transactions based on current date (Admin only)",
    responses={
        200: {"description": "Status update completed"},
        403: {"description": "Forbidden - Admin access required"},
        500: {"description": "Internal server error"}
    }
)
async def update_all_transaction_statuses(
    current_user: User = Depends(get_admin_user)
):
    """Update statuses for all transactions based on current date"""
    try:
        result = await PawnTransactionService.bulk_update_statuses()
        
        return {
            "message": "Transaction statuses updated successfully",
            "updated_counts": result,
            "timestamp": datetime.now(UTC).isoformat()
        }
        
    except PawnTransactionError as e:
        transaction_logger.error("PawnTransactionError in update_all_transaction_statuses", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update transaction statuses: {e}"
        )
    except Exception as e:
        transaction_logger.error("Unexpected error in update_all_transaction_statuses", error=str(e), traceback=traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update transaction statuses: {str(e)}"
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
    sort_by: str = Query("updated_at", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_staff_or_admin_user),
    client_timezone: Optional[str] = Depends(get_client_timezone)
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
        
        return await PawnTransactionService.get_transactions_list(filters, client_timezone)
        
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
        transaction_logger.error("Unexpected error in get_customer_transactions", error=str(e), traceback=traceback.format_exc())
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
        transaction_logger.error("Unexpected error in redeem_transaction", error=str(e), traceback=traceback.format_exc())
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
        transaction_logger.error("Unexpected error in forfeit_transaction", error=str(e), traceback=traceback.format_exc())
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
        transaction_logger.error("Unexpected error in get_initial_pawn_receipt", error=str(e), traceback=traceback.format_exc())
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
        transaction_logger.error("Unexpected error in get_payment_receipt", error=str(e), traceback=traceback.format_exc())
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
        transaction_logger.error("Unexpected error in get_extension_receipt", error=str(e), traceback=traceback.format_exc())
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
        transaction_logger.error("Unexpected error in get_receipt_summary", error=str(e), traceback=traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get receipt summary: {str(e)}"
        )


@pawn_transaction_router.post(
    "/{transaction_id}/void",
    response_model=TransactionVoidResponse,
    summary="Void pawn transaction",
    description="Void a pawn transaction (Admin only - for data entry mistakes and corrections)",
    responses={
        200: {"description": "Transaction voided successfully"},
        400: {"description": "Bad request - Cannot void transaction"},
        403: {"description": "Admin access required"},
        404: {"description": "Transaction not found"},
        500: {"description": "Internal server error"}
    }
)
async def void_transaction(
    transaction_id: str,
    void_request: TransactionVoidRequest,
    current_user: User = Depends(get_admin_user)
) -> TransactionVoidResponse:
    """
    Void a pawn transaction (Admin only).
    
    Use Cases:
    - Data entry mistakes
    - Customer changed mind immediately  
    - Items not actually accepted
    - Admin corrections
    
    Business Rules:
    - Only active, overdue, or extended transactions can be voided
    - Cannot void redeemed, forfeited, or sold transactions
    - Must provide void reason for audit trail
    - Admin access required
    - Cannot void transactions with payments (must handle refunds separately)
    
    Example Request:
    {
        "void_reason": "Customer changed mind, items not received",
        "admin_notes": "Called customer to confirm cancellation"
    }
    """
    try:
        # Input validation
        if not transaction_id or not transaction_id.strip():
            raise ValidationError("Transaction ID is required")
        
        if not void_request.void_reason or not void_request.void_reason.strip():
            raise ValidationError("Void reason is required")
        
        # Verify admin PIN (same validation as reversal operations)
        if not current_user.verify_pin(void_request.admin_pin):
            raise AuthenticationError("Invalid admin PIN")
        
        # Verify transaction exists with enhanced error handling
        try:
            transaction = await PawnTransactionService.get_transaction_by_id(transaction_id)
        except Exception as e:
            await transaction_logger.aerror(
                "Failed to retrieve transaction for void operation",
                transaction_id=transaction_id,
                user_id=current_user.user_id,
                error=str(e)
            )
            raise TransactionNotFoundError(
                transaction_id,
                error_code="TRANSACTION_NOT_FOUND"
            )
        
        if not transaction:
            raise TransactionNotFoundError(
                transaction_id,
                error_code="TRANSACTION_NOT_FOUND"
            )
        
        # Validate void eligibility with detailed error messages
        voidable_statuses = [TransactionStatus.ACTIVE, TransactionStatus.OVERDUE, 
                           TransactionStatus.EXTENDED, TransactionStatus.HOLD]
        if transaction.status not in voidable_statuses:
            raise BusinessRuleError(
                f"Cannot void transaction with status '{transaction.status}'. Only {[s.value for s in voidable_statuses]} transactions can be voided.",
                error_code="INVALID_TRANSACTION_STATUS_FOR_VOID"
            )
        
        # Check if any payments made (special handling needed)
        try:
            payment_summary = await PaymentService.get_payment_summary(transaction_id)
            total_payments = payment_summary.total_paid if payment_summary else 0
        except Exception:
            # If payment check fails, assume no payments for safety
            total_payments = 0
            
        if total_payments > 0:
            raise BusinessRuleError(
                f"Cannot void transaction with payments made (${total_payments:.2f}). Contact administrator for refund processing.",
                error_code="CANNOT_VOID_WITH_PAYMENTS",
                details={"total_payments": total_payments}
            )
        
        # Log void operation
        transaction_logger.info(
            "Voiding transaction",
            transaction_id=transaction_id,
            original_status=transaction.status,
            voided_by=current_user.user_id,
            void_reason=void_request.void_reason
        )
        
        # Process void
        original_status = transaction.status
        transaction.status = TransactionStatus.VOIDED
        transaction.updated_at = datetime.now(UTC)
        
        # Create structured audit entry for status change (THIS WAS MISSING!)
        from app.models.audit_entry_model import create_status_change_audit
        audit_entry = create_status_change_audit(
            staff_member=current_user.user_id,
            old_status=original_status.value if hasattr(original_status, 'value') else str(original_status),
            new_status=TransactionStatus.VOIDED.value,
            reason=f"VOIDED: {void_request.void_reason}" + (f" | Admin notes: {void_request.admin_notes}" if void_request.admin_notes else "")
        )
        transaction.add_system_audit_entry(audit_entry)
        
        # Add void information to internal notes (handle 500 char limit)
        void_info = f"\n--- VOIDED by {current_user.user_id} on {datetime.now(UTC).strftime('%Y-%m-%d %H:%M')} ---\nReason: {void_request.void_reason}"
        if void_request.admin_notes:
            void_info += f"\nAdmin notes: {void_request.admin_notes}"
        
        # Ensure we don't exceed 500 character limit
        if transaction.internal_notes:
            combined_notes = transaction.internal_notes + void_info
            if len(combined_notes) > 500:
                # Truncate original notes to make room for void info
                max_original_length = 500 - len(void_info) - 10  # Leave buffer
                if max_original_length > 0:
                    transaction.internal_notes = transaction.internal_notes[:max_original_length] + "..." + void_info
                else:
                    # Void info is too long, use shortened version
                    short_void_info = f"\n--- VOIDED by {current_user.user_id} ---\nReason: {void_request.void_reason[:200]}..."
                    transaction.internal_notes = short_void_info[:500]
            else:
                transaction.internal_notes = combined_notes
        else:
            transaction.internal_notes = void_info.strip()[:500]
        
        await transaction.save()
        
        # CRITICAL: Immediate comprehensive cache invalidation for real-time updates
        try:
            await PawnTransactionService._invalidate_all_transaction_caches()
        except Exception as cache_error:
            transaction_logger.warning("Cache invalidation failed after void", error=str(cache_error))
        
        # Create audit trail
        operation_datetime = datetime.now(UTC)
        original_status_str = original_status.value if hasattr(original_status, 'value') else str(original_status)
        audit_trail = {
            "performed_by_user_id": current_user.user_id,
            "operation_date": operation_datetime.isoformat(),
            "original_status": original_status_str,
            "void_reason": void_request.void_reason,
            "admin_notes": void_request.admin_notes,
            "total_payments_at_void": total_payments,
            "operation_type": "void"
        }
        
        transaction_logger.info(
            "Transaction voided successfully",
            transaction_id=transaction_id,
            original_status=original_status,
            voided_by=current_user.user_id
        )
        
        return TransactionVoidResponse(
            transaction_id=transaction_id,
            original_status=original_status_str,
            new_status=TransactionStatus.VOIDED.value,
            operation_type="void",
            performed_by=current_user.user_id,
            reason=void_request.void_reason,
            operation_date=operation_datetime,
            audit_trail=audit_trail
        )
        
    except AuthenticationError as e:
        transaction_logger.warning("Authentication error in transaction void", transaction_id=transaction_id, user=current_user.user_id, error=str(e))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except (ValidationError, BusinessRuleError, TransactionNotFoundError) as e:
        # Re-raise known exceptions to be handled by global handlers
        raise
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        transaction_logger.error(
            "Unexpected error voiding transaction",
            transaction_id=transaction_id,
            error=str(e),
            exc_info=True
        )
        raise DatabaseError("Failed to void transaction due to unexpected error")


@pawn_transaction_router.post(
    "/{transaction_id}/cancel",
    response_model=TransactionVoidResponse,
    summary="Cancel pawn transaction",
    description="Cancel a pawn transaction before processing is complete (Staff access)",
    responses={
        200: {"description": "Transaction canceled successfully"},
        400: {"description": "Bad request - Cannot cancel transaction"},
        404: {"description": "Transaction not found"},
        500: {"description": "Internal server error"}
    }
)
async def cancel_transaction(
    transaction_id: str,
    cancel_request: TransactionCancelRequest,
    current_user: User = Depends(get_current_user)
) -> TransactionVoidResponse:
    """
    Cancel a pawn transaction before processing is complete.
    
    Difference from Void:
    - Cancel: Transaction never fully processed (no payments, immediate reversal)
    - Void: Transaction was processed but needs administrative reversal
    
    Use Cases:
    - Customer changes mind before items stored
    - Data entry error caught immediately
    - Items rejected during inspection
    
    Business Rules:
    - Only active transactions with no payments can be canceled
    - Must be within same day as creation (configurable)
    - Regular staff can perform cancellations
    """
    try:
        # Verify transaction exists
        transaction = await PawnTransactionService.get_transaction_by_id(transaction_id)
        if not transaction:
            raise TransactionNotFoundError(
                transaction_id,
                error_code="TRANSACTION_NOT_FOUND"
            )
        
        # Validate cancel eligibility
        if transaction.status != TransactionStatus.ACTIVE:
            raise BusinessRuleError(
                f"Can only cancel active transactions. Current status: {transaction.status}",
                error_code="INVALID_TRANSACTION_STATUS_FOR_CANCEL"
            )
        
        # Check no payments made
        try:
            payment_summary = await PaymentService.get_payment_summary(transaction_id)
            total_payments = payment_summary.total_paid if payment_summary else 0
        except Exception:
            # If payment check fails, assume no payments for safety
            total_payments = 0
            
        if total_payments > 0:
            raise BusinessRuleError(
                "Cannot cancel transaction with payments. Use void instead.",
                error_code="CANNOT_CANCEL_WITH_PAYMENTS",
                details={"total_payments": total_payments}
            )
        
        # Check if within cancellation window (24 hours)
        creation_time = transaction.created_at
        if creation_time.tzinfo is None:
            creation_time = creation_time.replace(tzinfo=UTC)
        hours_since_creation = (datetime.now(UTC) - creation_time).total_seconds() / 3600
        if hours_since_creation > 24:  # 24 hour window
            raise BusinessRuleError(
                f"Cannot cancel transaction older than 24 hours ({hours_since_creation:.1f} hours old). Use void instead.",
                error_code="TRANSACTION_TOO_OLD_FOR_CANCEL",
                details={"hours_since_creation": hours_since_creation, "max_hours": 24}
            )
        
        # Log cancel operation
        transaction_logger.info(
            "Canceling transaction",
            transaction_id=transaction_id,
            original_status=transaction.status,
            canceled_by=current_user.user_id,
            cancel_reason=cancel_request.cancel_reason,
            hours_since_creation=hours_since_creation
        )
        
        # Process cancellation
        original_status = transaction.status
        transaction.status = TransactionStatus.CANCELED
        transaction.updated_at = datetime.now(UTC)
        
        # Create structured audit entry for status change
        from app.models.audit_entry_model import create_status_change_audit
        audit_entry = create_status_change_audit(
            staff_member=current_user.user_id,
            old_status=original_status.value if hasattr(original_status, 'value') else str(original_status),
            new_status=TransactionStatus.CANCELED.value,
            reason=f"CANCELED: {cancel_request.cancel_reason}" + (f" | Staff notes: {cancel_request.staff_notes}" if cancel_request.staff_notes else "")
        )
        transaction.add_system_audit_entry(audit_entry)
        
        # Add cancellation info (handle 500 char limit)
        cancel_info = f"\n--- CANCELED by {current_user.user_id} on {datetime.now(UTC).strftime('%Y-%m-%d %H:%M')} ---\nReason: {cancel_request.cancel_reason}"
        if cancel_request.staff_notes:
            cancel_info += f"\nStaff notes: {cancel_request.staff_notes}"
        
        # Ensure we don't exceed 500 character limit
        if transaction.internal_notes:
            combined_notes = transaction.internal_notes + cancel_info
            if len(combined_notes) > 500:
                # Truncate original notes to make room for cancel info
                max_original_length = 500 - len(cancel_info) - 10  # Leave buffer
                if max_original_length > 0:
                    transaction.internal_notes = transaction.internal_notes[:max_original_length] + "..." + cancel_info
                else:
                    # Cancel info is too long, use shortened version
                    short_cancel_info = f"\n--- CANCELED by {current_user.user_id} ---\nReason: {cancel_request.cancel_reason[:200]}..."
                    transaction.internal_notes = short_cancel_info[:500]
            else:
                transaction.internal_notes = combined_notes
        else:
            transaction.internal_notes = cancel_info.strip()[:500]
        
        await transaction.save()
        
        # CRITICAL: Immediate comprehensive cache invalidation for real-time updates
        try:
            await PawnTransactionService._invalidate_all_transaction_caches()
        except Exception as cache_error:
            transaction_logger.warning("Cache invalidation failed after cancel", error=str(cache_error))
        
        operation_datetime = datetime.now(UTC)
        original_status_str = original_status.value if hasattr(original_status, 'value') else str(original_status)
        audit_trail = {
            "performed_by_user_id": current_user.user_id,
            "operation_date": operation_datetime.isoformat(),
            "original_status": original_status_str,
            "cancel_reason": cancel_request.cancel_reason,
            "staff_notes": cancel_request.staff_notes,
            "hours_since_creation": hours_since_creation,
            "total_payments_at_cancel": total_payments,
            "operation_type": "cancel"
        }
        
        transaction_logger.info(
            "Transaction canceled successfully",
            transaction_id=transaction_id,
            original_status=original_status,
            canceled_by=current_user.user_id
        )
        
        return TransactionVoidResponse(
            transaction_id=transaction_id,
            original_status=original_status_str,
            new_status=TransactionStatus.CANCELED.value,
            operation_type="cancel",
            performed_by=current_user.user_id,
            reason=cancel_request.cancel_reason,
            operation_date=operation_datetime,
            audit_trail=audit_trail
        )
        
    except (ValidationError, BusinessRuleError, TransactionNotFoundError) as e:
        # Re-raise known exceptions to be handled by global handlers
        raise
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        transaction_logger.error(
            "Unexpected error canceling transaction",
            transaction_id=transaction_id,
            error=str(e),
            exc_info=True
        )
        raise DatabaseError("Failed to cancel transaction due to unexpected error")