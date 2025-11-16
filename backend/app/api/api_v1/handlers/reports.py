"""
Reports API Handlers

API endpoints for business analytics and reporting.
Implements three core report components:
1. Collections Analytics - Overdue tracking with aging breakdown
2. Top Customers - Customer performance leaderboard
3. Inventory Snapshot - Storage analytics by loan status
"""

from fastapi import APIRouter, Depends, Query, status, Request
from datetime import datetime
from typing import Optional, Union

from app.api.deps.user_deps import get_current_user
from app.models.user_model import User
from app.schemas.reports_schema import (
    CollectionsAnalyticsResponse,
    TopCustomersResponse,
    TopStaffResponse,
    InventorySnapshotResponse
)
from app.services.reports_service import ReportsService
from app.core.security_middleware import api_rate_limit

# Create router
reports_router = APIRouter()


@reports_router.get(
    "/collections",
    response_model=CollectionsAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get collections analytics",
    description="Overdue loan tracking with aging breakdown and historical trends",
    responses={
        200: {"description": "Collections analytics data"},
        401: {"description": "Not authenticated"},
        429: {"description": "Rate limit exceeded"},
        500: {"description": "Internal server error"}
    }
)
@api_rate_limit()
async def get_collections_analytics(
    request: Request,
    start_date: Optional[str] = Query(
        None,
        description="Start date for comparison period (YYYY-MM-DD)",
        regex=r"^\d{4}-\d{2}-\d{2}$"
    ),
    end_date: Optional[str] = Query(
        None,
        description="End date for analysis (YYYY-MM-DD, defaults to today)",
        regex=r"^\d{4}-\d{2}-\d{2}$"
    ),
    current_user: User = Depends(get_current_user)
) -> CollectionsAnalyticsResponse:
    """
    Get collections analytics with overdue loan tracking.

    Returns:
        - Summary metrics (total overdue, count, average days)
        - Aging buckets (1-7d, 8-14d, 15-30d, 30+d)
        - Historical trend (90-day weekly data points)
    """
    # Parse dates if provided
    start_dt = None
    end_dt = None

    if end_date:
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    if start_date:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")

    # Get timezone from request header
    timezone_header = request.headers.get("X-Client-Timezone")

    analytics = await ReportsService.get_collections_analytics(
        start_date=start_dt,
        end_date=end_dt,
        timezone_header=timezone_header
    )

    return CollectionsAnalyticsResponse(**analytics)


@reports_router.get(
    "/top-customers",
    response_model=Union[TopCustomersResponse, TopStaffResponse],
    status_code=status.HTTP_200_OK,
    summary="Get top customers or staff performance",
    description="Customer leaderboard by active loans or staff performance by transaction count",
    responses={
        200: {"description": "Top customers or staff data"},
        401: {"description": "Not authenticated"},
        429: {"description": "Rate limit exceeded"},
        500: {"description": "Internal server error"}
    }
)
@api_rate_limit()
async def get_top_customers(
    request: Request,
    limit: int = Query(
        10,
        ge=1,
        le=50,
        description="Number of top items to return (1-50)"
    ),
    view: str = Query(
        "customers",
        description="View type: 'customers' or 'staff'",
        regex=r"^(customers|staff)$"
    ),
    current_user: User = Depends(get_current_user)
) -> Union[TopCustomersResponse, TopStaffResponse]:
    """
    Get top customers by active loan volume or staff by transaction count.

    Customer View:
        - Ranked list of customers by active loans
        - Summary metrics (total customers, averages)

    Staff View:
        - Ranked list of staff by transaction count
        - Transaction value totals
    """
    data = await ReportsService.get_top_customers(limit=limit, view=view)

    if view == "staff":
        return TopStaffResponse(**data)
    else:
        return TopCustomersResponse(**data)


@reports_router.get(
    "/inventory-snapshot",
    response_model=InventorySnapshotResponse,
    status_code=status.HTTP_200_OK,
    summary="Get inventory snapshot",
    description="Storage analytics by loan status and aging analysis",
    responses={
        200: {"description": "Inventory snapshot data"},
        401: {"description": "Not authenticated"},
        429: {"description": "Rate limit exceeded"},
        500: {"description": "Internal server error"}
    }
)
@api_rate_limit()
async def get_inventory_snapshot(
    request: Request,
    current_user: User = Depends(get_current_user)
) -> InventorySnapshotResponse:
    """
    Get inventory snapshot with storage analytics.

    Returns:
        - Summary (total items, value, avg storage days)
        - Breakdown by status (Active, Overdue, Extended, Forfeited)
        - Breakdown by age (0-30d, 31-60d, 61-90d, 90+d)
        - High-value items alert (>$5,000 transactions)
    """
    # Get timezone from request header
    timezone_header = request.headers.get("X-Client-Timezone")

    snapshot = await ReportsService.get_inventory_snapshot(timezone_header)

    return InventorySnapshotResponse(**snapshot)
