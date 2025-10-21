"""
Customer API handlers for FastAPI endpoints.

This module defines all customer-related API endpoints including
CRUD operations, search, statistics, and status management.
"""

# Standard library imports
from typing import Optional
from enum import Enum

# Third-party imports
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body, Request

# Local imports
from app.api.deps.user_deps import get_current_user
from app.core.auth import get_admin_user
from app.core.security_middleware import api_rate_limit, strict_rate_limit
from app.models.customer_model import CustomerStatus
from app.models.user_model import User
from app.schemas.customer_schema import (
    CustomerCreate, CustomerUpdate, CustomerResponse, CustomerListResponse,
    CustomerStatsResponse, CustomerArchiveRequest, LoanLimitUpdateRequest, LoanLimitResponse
)
from app.services.customer_service import CustomerService
from app.core.redis_cache import BusinessCache, cached_result, CacheConfig


# Create router
customer_router = APIRouter()


# Customer sort field enum for API validation
class CustomerSortField(str, Enum):
    """Valid sort fields for customer queries"""
    CREATED_AT = "created_at"
    UPDATED_AT = "updated_at"
    LAST_ACCESSED_AT = "last_accessed_at"
    FIRST_NAME = "first_name"
    LAST_NAME = "last_name"
    PHONE_NUMBER = "phone_number"
    EMAIL = "email"
    ACTIVE_LOANS = "active_loans"
    TOTAL_LOAN_VALUE = "total_loan_value"
    CREDIT_LIMIT = "credit_limit"
    LAST_TRANSACTION_DATE = "last_transaction_date"
    STATUS = "status"


@customer_router.post(
    "/",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create new customer",
    description="Create a new customer profile (Staff and Admin access)",
    responses={
        201: {"description": "Customer created successfully"},
        400: {"description": "Bad request - Invalid data"},
        403: {"description": "CSRF token required or invalid"},
        409: {"description": "Phone number already exists"},
        422: {"description": "Validation error"},
        429: {"description": "Rate limit exceeded"},
        500: {"description": "Internal server error"}
    }
)
@customer_router.post(
    "/create",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create new customer (alias)",
    description="Create a new customer profile - alias for POST / (Staff and Admin access)",
    responses={
        201: {"description": "Customer created successfully"},
        403: {"description": "CSRF token required or invalid"},
        400: {"description": "Bad request - Invalid data"},
        409: {"description": "Phone number already exists"},
        422: {"description": "Validation error"},
        429: {"description": "Rate limit exceeded"},
        500: {"description": "Internal server error"}
    }
)
@api_rate_limit()
async def create_customer(
    request: Request,
    customer_data: CustomerCreate,
    current_user: User = Depends(get_current_user)
) -> CustomerResponse:
    """Create a new customer profile with comprehensive error handling"""
    try:
        customer = await CustomerService.create_customer(
            customer_data=customer_data,
            created_by=current_user.user_id
        )
        
        # Add computed properties before response
        customer_dict = customer.model_dump()
        customer_dict["can_borrow_amount"] = customer.can_borrow_amount
        return CustomerResponse.model_validate(customer_dict)
    
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
            detail="Failed to create customer. Please try again later."
        )


@customer_router.get(
    "/",
    response_model=CustomerListResponse,
    summary="Get customers list",
    description="Get paginated list of customers with filtering (Staff and Admin access)",
    responses={
        200: {"description": "Customers list retrieved successfully"},
        400: {"description": "Bad request - Invalid parameters"},
        422: {"description": "Validation error"},
        429: {"description": "Rate limit exceeded"},
        500: {"description": "Internal server error"}
    }
)
@api_rate_limit()
async def get_customers_list(
    request: Request,
    status_filter: Optional[CustomerStatus] = Query(None, alias="status", description="Filter by customer status"),
    search: Optional[str] = Query(None, description="Search in name and phone number", max_length=100),
    vip_only: bool = Query(False, description="Filter VIP customers only (total_loan_value >= $5,000)"),
    alerts_only: bool = Query(False, description="Filter customers with active service alerts only"),
    follow_up_only: bool = Query(False, description="Filter customers needing follow-up (customers with overdue transactions)"),
    new_this_month: bool = Query(False, description="Filter customers created in current calendar month"),
    # NEW: Advanced filters
    active_loans_min: Optional[int] = Query(None, ge=0, description="Minimum number of active loans"),
    active_loans_max: Optional[int] = Query(None, ge=0, description="Maximum number of active loans"),
    loan_value_min: Optional[float] = Query(None, ge=0, description="Minimum total loan value"),
    loan_value_max: Optional[float] = Query(None, ge=0, description="Maximum total loan value"),
    last_activity_days: Optional[int] = Query(None, ge=0, description="Active within last N days"),
    inactive_days: Optional[int] = Query(None, ge=0, description="Inactive for N or more days"),
    credit_utilization: Optional[str] = Query(None, regex="^(high|medium|low|none)$", description="Credit utilization level: high (>80%), medium (50-80%), low (<50%), none (0%)"),
    transaction_frequency: Optional[str] = Query(None, regex="^(one_time|occasional|regular|frequent|vip)$", description="Transaction frequency: one_time (1), occasional (2-5), regular (6-10), frequent (11-20), vip (20+)"),
    page: int = Query(1, description="Page number", ge=1),
    per_page: int = Query(10, description="Items per page", ge=1, le=100),
    sort_by: CustomerSortField = Query(CustomerSortField.LAST_ACCESSED_AT, description="Sort field - defaults to recently accessed first"),
    sort_order: str = Query("desc", description="Sort order", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_user)
) -> CustomerListResponse:
    """Get paginated list of customers with optional filtering"""
    try:
        return await CustomerService.get_customers_list(
            status=status_filter,
            search=search,
            vip_only=vip_only,
            alerts_only=alerts_only,
            follow_up_only=follow_up_only,
            new_this_month=new_this_month,
            # Advanced filters
            active_loans_min=active_loans_min,
            active_loans_max=active_loans_max,
            loan_value_min=loan_value_min,
            loan_value_max=loan_value_max,
            last_activity_days=last_activity_days,
            inactive_days=inactive_days,
            credit_utilization=credit_utilization,
            transaction_frequency=transaction_frequency,
            page=page,
            per_page=per_page,
            sort_by=sort_by.value,  # Convert enum to string value
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
            detail="Failed to retrieve customers. Please try again later."
        )


@customer_router.get(
    "/stats",
    response_model=CustomerStatsResponse,
    summary="Get customer statistics",
    description="Get customer statistics for dashboard (Staff and Admin access)",
    responses={
        200: {"description": "Customer statistics retrieved successfully"},
        401: {"description": "Authentication required"},
        403: {"description": "Forbidden"}
    }
)
async def get_customer_statistics(
    current_user: User = Depends(get_current_user)
) -> CustomerStatsResponse:
    """Get customer statistics for dashboard - real-time (no cache for accurate follow-up counts)"""
    return await CustomerService.get_customer_statistics()


@customer_router.get(
    "/loan-limit-config",
    response_model=LoanLimitResponse,
    summary="Get current loan limit configuration",
    description="Get the current maximum active loans limit configuration (Staff and Admin access)",
    responses={
        200: {"description": "Loan limit configuration retrieved successfully"},
        401: {"description": "Authentication required"},
        403: {"description": "Staff or Admin access required"}
    }
)
async def get_loan_limit_config(
    current_user: User = Depends(get_current_user)
) -> LoanLimitResponse:
    """Get current loan limit configuration"""
    try:
        return await CustomerService.get_loan_limit_config()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve loan limit configuration. Please try again later."
        )


@customer_router.put(
    "/loan-limit-config",
    response_model=LoanLimitResponse,
    summary="Update loan limit configuration",
    description="Update the maximum active loans limit configuration (Admin access only)",
    responses={
        200: {"description": "Loan limit configuration updated successfully"},
        400: {"description": "Bad request - Invalid data"},
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        422: {"description": "Validation error"}
    }
)
async def update_loan_limit_config(
    request: LoanLimitUpdateRequest,
    current_user: User = Depends(get_admin_user)
) -> LoanLimitResponse:
    """Update loan limit configuration (Admin only)"""
    try:
        return await CustomerService.update_loan_limit_config(
            request=request,
            admin_user_id=current_user.user_id
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update loan limit configuration. Please try again later."
        )


@customer_router.get(
    "/{phone_number}",
    response_model=CustomerResponse,
    summary="Get customer by phone number",
    description="Get customer details by phone number (Staff and Admin access)",
    responses={
        200: {"description": "Customer details retrieved successfully"},
        400: {"description": "Bad request - Invalid phone number format"},
        404: {"description": "Customer not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
@cached_result(prefix="customer:", ttl=CacheConfig.LONG_TTL)
async def get_customer_by_phone(
    phone_number: str,
    current_user: User = Depends(get_current_user)
) -> CustomerResponse:
    """Get customer details by phone number with caching"""
    try:
        # Validate phone number format
        if not phone_number.isdigit() or len(phone_number) != 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid phone number format. Must be 10 digits."
            )
        
        # Try cache first
        cached_customer = await BusinessCache.get_customer(phone_number)
        if cached_customer:
            # Ensure cached data has computed properties
            if "can_borrow_amount" not in cached_customer:
                # Cache is stale, fetch fresh data
                customer = await CustomerService.get_customer_by_phone(phone_number)
                if customer:
                    customer_dict = customer.model_dump()
                    customer_dict["can_borrow_amount"] = customer.can_borrow_amount
                    await BusinessCache.set_customer(phone_number, customer_dict)
                    return CustomerResponse.model_validate(customer_dict)
            return CustomerResponse.model_validate(cached_customer)
        
        customer = await CustomerService.get_customer_by_phone(phone_number)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )
        
        # Add computed properties before response
        customer_dict = customer.model_dump()
        customer_dict["can_borrow_amount"] = customer.can_borrow_amount
        
        # Cache the result
        await BusinessCache.set_customer(phone_number, customer_dict)
        
        return CustomerResponse.model_validate(customer_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve customer. Please try again later."
        )


@customer_router.post(
    "/{phone_number}/mark-accessed",
    response_model=CustomerResponse,
    summary="Mark customer as accessed",
    description="Update customer's last_accessed_at timestamp (Staff and Admin access)",
    responses={
        200: {"description": "Customer access timestamp updated successfully"},
        400: {"description": "Bad request - Invalid phone number format"},
        404: {"description": "Customer not found"},
        500: {"description": "Internal server error"}
    }
)
async def mark_customer_accessed(
    phone_number: str,
    current_user: User = Depends(get_current_user)
) -> CustomerResponse:
    """Mark customer as accessed/viewed"""
    try:
        # Validate phone number format
        if not phone_number.isdigit() or len(phone_number) != 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid phone number format. Must be 10 digits."
            )

        customer = await CustomerService.mark_customer_accessed(phone_number)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )

        # Add computed properties before response
        customer_dict = customer.model_dump()
        customer_dict["can_borrow_amount"] = customer.can_borrow_amount

        return CustomerResponse.model_validate(customer_dict)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update customer access timestamp. Please try again later."
        )


@customer_router.put(
    "/{phone_number}",
    response_model=CustomerResponse,
    summary="Update customer",
    description="Update customer information (Staff can update basic info, Admin can update status)",
    responses={
        200: {"description": "Customer updated successfully"},
        400: {"description": "Bad request - Invalid data or phone number"},
        403: {"description": "Forbidden - Insufficient permissions"},
        404: {"description": "Customer not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
async def update_customer(
    phone_number: str,
    customer_data: CustomerUpdate,
    current_user: User = Depends(get_current_user)
) -> CustomerResponse:
    """Update customer information with comprehensive error handling"""
    try:
        # Validate phone number format
        if not phone_number.isdigit() or len(phone_number) != 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid phone number format. Must be 10 digits."
            )
        
        is_admin = (current_user.role == "admin" or 
                   (hasattr(current_user.role, 'value') and current_user.role.value == "admin"))
        
        # Check if non-admin is trying to update status
        if not is_admin and customer_data.status is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can update customer status"
            )
        
        customer = await CustomerService.update_customer(
            phone_number=phone_number,
            update_data=customer_data,
            updated_by=current_user.user_id,
            is_admin=is_admin
        )
        
        # Invalidate cache after update
        await BusinessCache.invalidate_customer(phone_number)
        
        # Add computed properties before response
        customer_dict = customer.model_dump()
        customer_dict["can_borrow_amount"] = customer.can_borrow_amount
        return CustomerResponse.model_validate(customer_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update customer. Please try again later."
        )


@customer_router.post(
    "/{phone_number}/deactivate",
    response_model=CustomerResponse,
    status_code=status.HTTP_200_OK,
    summary="Deactivate customer account",
    description="Deactivate customer account (customer-requested closure). Admin only.",
    responses={
        200: {"description": "Customer deactivated successfully"},
        400: {"description": "Cannot deactivate customer with active loans"},
        403: {"description": "Admin access required"},
        404: {"description": "Customer not found"},
        500: {"description": "Internal server error"}
    }
)
async def deactivate_customer(
    phone_number: str,
    reason: str = "Customer requested account closure",
    current_user: User = Depends(get_admin_user)
) -> CustomerResponse:
    """Deactivate customer account (customer-requested closure)"""
    try:
        # Validate phone number format
        if not phone_number.isdigit() or len(phone_number) != 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid phone number format. Must be 10 digits."
            )
        
        customer = await CustomerService.get_customer_by_phone(phone_number)
        
        # Check for active loans
        if customer.active_loans > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate customer with active loans"
            )
        
        # Deactivate the customer
        customer.deactivate(reason, current_user.user_id)
        await customer.save()

        # Invalidate customer stats cache for real-time updates
        await BusinessCache.invalidate_by_pattern("stats:customer:*")
        await BusinessCache.invalidate_customer(phone_number)

        # Add computed properties before response
        customer_dict = customer.model_dump()
        customer_dict["can_borrow_amount"] = customer.can_borrow_amount
        return CustomerResponse.model_validate(customer_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deactivate customer. Please try again later."
        )


@customer_router.post(
    "/{phone_number}/archive",
    response_model=CustomerResponse,
    status_code=status.HTTP_200_OK,
    summary="Archive customer account",
    description="Archive customer account (long-term inactive, compliance preservation). Admin only.",
    responses={
        200: {"description": "Customer archived successfully"},
        400: {"description": "Cannot archive customer with active loans"},
        403: {"description": "Admin access required"},
        404: {"description": "Customer not found"},
        500: {"description": "Internal server error"}
    }
)
async def archive_customer(
    phone_number: str,
    archive_request: CustomerArchiveRequest = Body(...),
    current_user: User = Depends(get_admin_user)
) -> CustomerResponse:
    """Archive customer account (long-term inactive, compliance preservation)"""
    try:
        # Validate phone number format
        if not phone_number.isdigit() or len(phone_number) != 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid phone number format. Must be 10 digits."
            )
        
        customer = await CustomerService.get_customer_by_phone(phone_number)
        
        # Check for active loans
        if customer.active_loans > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot archive customer with active loans"
            )
        
        # Archive the customer
        customer.archive(archive_request.reason, current_user.user_id)
        await customer.save()

        # Invalidate customer stats cache for real-time updates
        await BusinessCache.invalidate_by_pattern("stats:customer:*")
        await BusinessCache.invalidate_customer(phone_number)

        # Add computed properties before response
        customer_dict = customer.model_dump()
        customer_dict["can_borrow_amount"] = customer.can_borrow_amount
        return CustomerResponse.model_validate(customer_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to archive customer. Please try again later."
        )


@customer_router.get(
    "/{phone_number}/loan-eligibility",
    summary="Check loan eligibility",
    description="Check if customer is eligible for a new loan (Staff and Admin access)",
    responses={
        200: {"description": "Eligibility check completed"},
        404: {"description": "Customer not found"},
        429: {"description": "Rate limit exceeded"},
        500: {"description": "Internal server error"}
    }
)
@strict_rate_limit()
async def check_loan_eligibility(
    request: Request,
    phone_number: str,
    loan_amount: Optional[float] = Query(None, description="Optional loan amount to validate"),
    current_user: User = Depends(get_current_user)
) -> dict:
    """Check customer's loan eligibility with comprehensive validation"""
    try:
        # Validate phone number format
        if not phone_number.isdigit() or len(phone_number) != 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid phone number format. Must be 10 digits."
            )
        
        eligibility = await CustomerService.validate_loan_eligibility(
            phone_number=phone_number,
            loan_amount=loan_amount
        )
        
        return eligibility
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check loan eligibility. Please try again later."
        )


