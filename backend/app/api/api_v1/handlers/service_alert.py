"""
Service Alert API handlers for FastAPI endpoints.

This module defines all service alert-related API endpoints including
CRUD operations, customer alert management, and resolution tracking.
"""

# Standard library imports
from typing import Optional, List

# Third-party imports
from fastapi import APIRouter, Depends, HTTPException, status, Query

# Local imports
from app.api.deps.user_deps import get_current_user
from app.models.user_model import User
from app.models.service_alert_model import AlertStatus
from app.schemas.service_alert_schema import (
    ServiceAlertCreate, ServiceAlertUpdate, ServiceAlertResolve,
    ServiceAlertResponse, ServiceAlertListResponse, ServiceAlertCountResponse,
    CustomerItemResponse
)
from app.services.service_alert_service import ServiceAlertService
from app.core.exceptions import ValidationError, NotFoundError


# Create router
service_alert_router = APIRouter()


@service_alert_router.post(
    "/",
    response_model=ServiceAlertResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create new service alert",
    description="Create a new service alert for customer tracking (Staff and Admin access)",
    responses={
        201: {"description": "Service alert created successfully"},
        400: {"description": "Bad request - Invalid data"},
        404: {"description": "Customer not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
async def create_service_alert(
    alert_data: ServiceAlertCreate,
    current_user: User = Depends(get_current_user)
) -> ServiceAlertResponse:
    """Create a new service alert"""
    try:
        return await ServiceAlertService.create_alert(alert_data, current_user.user_id)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create service alert: {str(e)}"
        )


@service_alert_router.get(
    "/customer/{customer_phone}",
    response_model=ServiceAlertListResponse,
    summary="Get customer service alerts",
    description="Get all service alerts for a specific customer with optional status filter",
    responses={
        200: {"description": "Customer alerts retrieved successfully"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
async def get_customer_alerts(
    customer_phone: str,
    status_filter: Optional[AlertStatus] = Query(None, alias="status"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    per_page: int = Query(50, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user)
) -> ServiceAlertListResponse:
    """Get service alerts for a specific customer"""
    try:
        return await ServiceAlertService.get_customer_alerts(
            customer_phone, status_filter, page, per_page
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve customer alerts: {str(e)}"
        )


@service_alert_router.get(
    "/customer/{customer_phone}/count",
    response_model=ServiceAlertCountResponse,
    summary="Get customer alert count",
    description="Get the count of service alerts for a specific customer (for badge display)",
    responses={
        200: {"description": "Alert count retrieved successfully"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
async def get_customer_alert_count(
    customer_phone: str,
    current_user: User = Depends(get_current_user)
) -> ServiceAlertCountResponse:
    """Get alert count for badge display"""
    try:
        return await ServiceAlertService.get_customer_alert_count(customer_phone)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve alert count: {str(e)}"
        )


@service_alert_router.get(
    "/{alert_id}",
    response_model=ServiceAlertResponse,
    summary="Get service alert by ID",
    description="Get a specific service alert by its ID",
    responses={
        200: {"description": "Service alert retrieved successfully"},
        400: {"description": "Invalid alert ID format"},
        404: {"description": "Service alert not found"},
        500: {"description": "Internal server error"}
    }
)
async def get_service_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user)
) -> ServiceAlertResponse:
    """Get a specific service alert by ID"""
    try:
        return await ServiceAlertService.get_alert_by_id(alert_id)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve service alert: {str(e)}"
        )


@service_alert_router.put(
    "/{alert_id}",
    response_model=ServiceAlertResponse,
    summary="Update service alert",
    description="Update an existing service alert",
    responses={
        200: {"description": "Service alert updated successfully"},
        400: {"description": "Bad request - Invalid data"},
        404: {"description": "Service alert not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
async def update_service_alert(
    alert_id: str,
    alert_data: ServiceAlertUpdate,
    current_user: User = Depends(get_current_user)
) -> ServiceAlertResponse:
    """Update an existing service alert"""
    try:
        return await ServiceAlertService.update_alert(alert_id, alert_data, current_user.user_id)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update service alert: {str(e)}"
        )


@service_alert_router.put(
    "/{alert_id}/resolve",
    response_model=ServiceAlertResponse,
    summary="Resolve service alert",
    description="Mark a service alert as resolved",
    responses={
        200: {"description": "Service alert resolved successfully"},
        400: {"description": "Bad request - Alert already resolved"},
        404: {"description": "Service alert not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
async def resolve_service_alert(
    alert_id: str,
    resolve_data: ServiceAlertResolve,
    current_user: User = Depends(get_current_user)
) -> ServiceAlertResponse:
    """Resolve a specific service alert"""
    try:
        return await ServiceAlertService.resolve_alert(alert_id, resolve_data, current_user.user_id)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resolve service alert: {str(e)}"
        )


@service_alert_router.put(
    "/customer/{customer_phone}/resolve-all",
    summary="Resolve all customer alerts",
    description="Resolve all active service alerts for a customer",
    responses={
        200: {"description": "Customer alerts resolved successfully"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
async def resolve_all_customer_alerts(
    customer_phone: str,
    resolve_data: ServiceAlertResolve,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Resolve all active alerts for a customer"""
    try:
        resolved_count = await ServiceAlertService.resolve_all_customer_alerts(
            customer_phone, resolve_data, current_user.user_id
        )
        return {
            "message": f"Successfully resolved {resolved_count} alerts for customer {customer_phone}",
            "resolved_count": resolved_count,
            "customer_phone": customer_phone
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resolve customer alerts: {str(e)}"
        )


@service_alert_router.get(
    "/customer/{customer_phone}/items",
    response_model=List[CustomerItemResponse],
    summary="Get customer items",
    description="Get customer's pawn items for alert item selection dropdown",
    responses={
        200: {"description": "Customer items retrieved successfully"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
async def get_customer_items(
    customer_phone: str,
    current_user: User = Depends(get_current_user)
) -> List[CustomerItemResponse]:
    """Get customer's pawn items for alert creation"""
    try:
        return await ServiceAlertService.get_customer_items(customer_phone)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve customer items: {str(e)}"
        )


@service_alert_router.delete(
    "/{alert_id}",
    summary="Delete service alert",
    description="Delete a service alert (admin only)",
    responses={
        200: {"description": "Service alert deleted successfully"},
        400: {"description": "Invalid alert ID format"},
        403: {"description": "Admin access required"},
        404: {"description": "Service alert not found"},
        500: {"description": "Internal server error"}
    }
)
async def delete_service_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Delete a service alert (admin only)"""
    # Check admin access
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    try:
        success = await ServiceAlertService.delete_alert(alert_id)
        if success:
            return {"message": f"Service alert {alert_id} deleted successfully"}
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete service alert: {str(e)}"
        )


@service_alert_router.get(
    "/stats/unique-customers",
    summary="Get unique customer alert stats",
    description="Get count of unique customers with active service alerts",
    responses={
        200: {"description": "Stats retrieved successfully"},
        500: {"description": "Internal server error"}
    }
)
async def get_unique_customer_alert_stats(
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get unique customer count with active alerts"""
    try:
        return await ServiceAlertService.get_unique_customer_alert_count()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve alert stats: {str(e)}"
        )