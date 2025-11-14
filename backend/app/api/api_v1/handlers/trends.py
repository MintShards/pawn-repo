"""
REST API handlers for revenue and loan trend analytics
"""

from datetime import datetime, timedelta, UTC
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
import structlog

from app.core.auth import get_current_user
from app.core.timezone_utils import get_user_timezone, get_user_now, get_user_business_date, utc_to_user_timezone, user_timezone_to_utc
from app.models.user_model import User
from app.models.pawn_transaction_model import PawnTransaction
from app.models.payment_model import Payment
from app.models.extension_model import Extension
from beanie.operators import And, GTE, LTE

# Configure logger
logger = structlog.get_logger(__name__)

# Create router
router = APIRouter(prefix="/trends", tags=["trends"])


async def _get_date_range(period: str, timezone_header: Optional[str] = None):
    """
    Calculate date range based on period and user timezone

    Args:
        period: Time period (7d, 30d, 90d, 1y)
        timezone_header: Client timezone from X-Client-Timezone header

    Returns:
        Tuple of (start_date, end_date, date_format, interval_days)
    """
    now = get_user_now(timezone_header)

    # Determine date range based on period
    if period == "7d":
        start_date = now - timedelta(days=7)
        date_format = "%Y-%m-%d"
        interval_days = 1
    elif period == "30d":
        start_date = now - timedelta(days=30)
        date_format = "%Y-%m-%d"
        interval_days = 1
    elif period == "90d":
        start_date = now - timedelta(days=90)
        date_format = "%Y-%m-%d"
        interval_days = 3  # Group by 3-day intervals
    elif period == "1y":
        start_date = now - timedelta(days=365)
        date_format = "%Y-%m"
        interval_days = 30  # Group by month
    else:
        # Default to 30 days
        start_date = now - timedelta(days=30)
        date_format = "%Y-%m-%d"
        interval_days = 1

    return start_date, now, date_format, interval_days


@router.get("/revenue")
async def get_revenue_trends(
    request: Request,
    period: str = Query("30d", description="Time period: 7d, 30d, 90d, 1y"),
    current_user: User = Depends(get_current_user)
):
    """
    Get revenue trends data for specified time period

    Returns:
    - Total collections by date
    - Payment breakdown (principal vs interest)
    - Extension fees collected
    - Daily/weekly/monthly revenue trends
    """
    try:
        timezone_header = request.headers.get("X-Client-Timezone")

        logger.info("Getting revenue trends",
                   user_id=current_user.user_id,
                   period=period,
                   timezone=timezone_header)

        # Get date range
        start_date, end_date, date_format, interval_days = await _get_date_range(period, timezone_header)

        # Convert to UTC for database queries using project's timezone utilities
        start_date_utc = user_timezone_to_utc(start_date, timezone_header)
        end_date_utc = user_timezone_to_utc(end_date, timezone_header)

        # Convert to naive UTC for MongoDB queries (MongoDB may store/return naive datetimes)
        start_date_naive = start_date_utc.replace(tzinfo=None)
        end_date_naive = end_date_utc.replace(tzinfo=None)

        # Query payments in date range
        payments = await Payment.find(
            And(
                GTE(Payment.payment_date, start_date_naive),
                LTE(Payment.payment_date, end_date_naive)
            )
        ).to_list()

        # Query extensions in date range
        extensions = await Extension.find(
            And(
                GTE(Extension.extension_date, start_date_naive),
                LTE(Extension.extension_date, end_date_naive)
            )
        ).to_list()

        # Initialize data structure for daily/interval tracking
        revenue_by_date = {}

        # Process payments
        for payment in payments:
            # Convert payment date to user timezone using project's timezone utilities
            payment_date = utc_to_user_timezone(payment.payment_date, timezone_header)
            date_key = payment_date.strftime(date_format)

            if date_key not in revenue_by_date:
                revenue_by_date[date_key] = {
                    "date": date_key,
                    "total_revenue": 0,
                    "principal_collected": 0,
                    "interest_collected": 0,
                    "extension_fees": 0,
                    "payment_count": 0
                }

            revenue_by_date[date_key]["total_revenue"] += payment.payment_amount
            revenue_by_date[date_key]["principal_collected"] += payment.principal_portion
            revenue_by_date[date_key]["interest_collected"] += payment.interest_portion
            revenue_by_date[date_key]["payment_count"] += 1

        # Process extensions
        for extension in extensions:
            # Convert extension date to user timezone using project's timezone utilities
            extension_date = utc_to_user_timezone(extension.extension_date, timezone_header)
            date_key = extension_date.strftime(date_format)

            if date_key not in revenue_by_date:
                revenue_by_date[date_key] = {
                    "date": date_key,
                    "total_revenue": 0,
                    "principal_collected": 0,
                    "interest_collected": 0,
                    "extension_fees": 0,
                    "payment_count": 0
                }

            revenue_by_date[date_key]["extension_fees"] += extension.total_extension_fee
            revenue_by_date[date_key]["total_revenue"] += extension.total_extension_fee

        # Convert to sorted list
        revenue_data = sorted(revenue_by_date.values(), key=lambda x: x["date"])

        # Calculate summary statistics
        total_revenue = sum(d["total_revenue"] for d in revenue_data)
        total_principal = sum(d["principal_collected"] for d in revenue_data)
        total_interest = sum(d["interest_collected"] for d in revenue_data)
        total_extension_fees = sum(d["extension_fees"] for d in revenue_data)
        total_payments = sum(d["payment_count"] for d in revenue_data)

        # Calculate average daily revenue
        avg_daily_revenue = total_revenue / len(revenue_data) if revenue_data else 0

        logger.info("Revenue trends calculated successfully",
                   period=period,
                   data_points=len(revenue_data),
                   total_revenue=total_revenue)

        return {
            "period": period,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "data": revenue_data,
            "summary": {
                "total_revenue": round(total_revenue, 2),
                "total_principal": round(total_principal, 2),
                "total_interest": round(total_interest, 2),
                "total_extension_fees": round(total_extension_fees, 2),
                "total_payments": total_payments,
                "avg_daily_revenue": round(avg_daily_revenue, 2)
            },
            "timestamp": datetime.now(UTC).isoformat()
        }

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error("Failed to get revenue trends",
                    period=period,
                    error=str(e),
                    error_type=type(e).__name__,
                    traceback=error_details)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate revenue trends: {str(e)}"
        )


@router.get("/loans")
async def get_loan_trends(
    request: Request,
    period: str = Query("30d", description="Time period: 7d, 30d, 90d, 1y"),
    current_user: User = Depends(get_current_user)
):
    """
    Get loan trends data for specified time period

    Returns:
    - New loans created by date
    - Redemptions (fully paid loans) by date
    - Active loans count over time
    - Status distribution trends
    """
    try:
        timezone_header = request.headers.get("X-Client-Timezone")

        logger.info("Getting loan trends",
                   user_id=current_user.user_id,
                   period=period,
                   timezone=timezone_header)

        # Get date range
        start_date, end_date, date_format, interval_days = await _get_date_range(period, timezone_header)

        # Convert to UTC for database queries using project's timezone utilities
        start_date_utc = user_timezone_to_utc(start_date, timezone_header)
        end_date_utc = user_timezone_to_utc(end_date, timezone_header)

        # Convert to naive UTC for comparison (MongoDB may return naive datetimes)
        start_date_naive = start_date_utc.replace(tzinfo=None)
        end_date_naive = end_date_utc.replace(tzinfo=None)

        # Query transactions in date range (using GTE for compatibility)
        all_transactions = await PawnTransaction.find(
            GTE(PawnTransaction.created_at, start_date_naive)
        ).to_list()

        # Initialize data structure
        loan_by_date = {}

        # Process new loans
        new_loans = [t for t in all_transactions if t.created_at >= start_date_naive and t.created_at <= end_date_naive]

        for transaction in new_loans:
            # Convert transaction date to user timezone using project's timezone utilities
            created_date = utc_to_user_timezone(transaction.created_at, timezone_header)
            date_key = created_date.strftime(date_format)

            if date_key not in loan_by_date:
                loan_by_date[date_key] = {
                    "date": date_key,
                    "new_loans": 0,
                    "new_loans_amount": 0,
                    "redemptions": 0,
                    "redemptions_amount": 0,
                    "active_loans": 0
                }

            loan_by_date[date_key]["new_loans"] += 1
            loan_by_date[date_key]["new_loans_amount"] += transaction.loan_amount

        # Process redemptions (redeemed status transactions)
        for transaction in all_transactions:
            if transaction.status == "redeemed" and transaction.updated_at:
                # Convert to user timezone using project's timezone utilities
                updated_date = utc_to_user_timezone(transaction.updated_at, timezone_header)

                # Only count redemptions within date range (compare with naive datetimes)
                updated_at_naive = transaction.updated_at if transaction.updated_at.tzinfo is None else transaction.updated_at.replace(tzinfo=None)
                if start_date_naive <= updated_at_naive <= end_date_naive:
                    date_key = updated_date.strftime(date_format)

                    if date_key not in loan_by_date:
                        loan_by_date[date_key] = {
                            "date": date_key,
                            "new_loans": 0,
                            "new_loans_amount": 0,
                            "redemptions": 0,
                            "redemptions_amount": 0,
                            "active_loans": 0
                        }

                    loan_by_date[date_key]["redemptions"] += 1
                    loan_by_date[date_key]["redemptions_amount"] += transaction.loan_amount

        # Calculate active loans count for each date
        # Active = active, overdue, or extended status
        active_statuses = ["active", "overdue", "extended"]

        for date_key in loan_by_date.keys():
            # Count transactions that were active on this date
            active_count = sum(1 for t in all_transactions if t.status in active_statuses)
            loan_by_date[date_key]["active_loans"] = active_count

        # Convert to sorted list
        loan_data = sorted(loan_by_date.values(), key=lambda x: x["date"])

        # Calculate summary statistics
        total_new_loans = sum(d["new_loans"] for d in loan_data)
        total_new_loans_amount = sum(d["new_loans_amount"] for d in loan_data)
        total_redemptions = sum(d["redemptions"] for d in loan_data)
        total_redemptions_amount = sum(d["redemptions_amount"] for d in loan_data)

        # Current active loans
        current_active_loans = len([t for t in all_transactions if t.status in active_statuses])

        # Average loan amount
        avg_loan_amount = total_new_loans_amount / total_new_loans if total_new_loans > 0 else 0

        logger.info("Loan trends calculated successfully",
                   period=period,
                   data_points=len(loan_data),
                   total_new_loans=total_new_loans)

        return {
            "period": period,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "data": loan_data,
            "summary": {
                "total_new_loans": total_new_loans,
                "total_new_loans_amount": round(total_new_loans_amount, 2),
                "total_redemptions": total_redemptions,
                "total_redemptions_amount": round(total_redemptions_amount, 2),
                "current_active_loans": current_active_loans,
                "avg_loan_amount": round(avg_loan_amount, 2)
            },
            "timestamp": datetime.now(UTC).isoformat()
        }

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error("Failed to get loan trends",
                    period=period,
                    error=str(e),
                    error_type=type(e).__name__,
                    traceback=error_details)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate loan trends: {str(e)}"
        )
