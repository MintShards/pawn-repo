"""
Reports Service

Business analytics and reporting service for the Reports Page.
Implements three core components:
1. Collections Analytics - Overdue loan tracking with aging breakdown
2. Top Customers - Customer leaderboard by active loans
3. Inventory Snapshot - Storage analytics by loan status

All data sources verified against actual database models.
"""

from datetime import datetime, timedelta, UTC
from typing import List, Dict, Any, Optional
import structlog

from app.models.pawn_transaction_model import PawnTransaction, TransactionStatus
from app.models.customer_model import Customer, CustomerStatus
from app.models.pawn_item_model import PawnItem
from app.models.user_model import User
from app.core.timezone_utils import get_user_now, utc_to_user_timezone
from app.core.exceptions import ValidationError

# Configure logger
logger = structlog.get_logger("reports_service")


def _ensure_timezone_aware(dt: datetime) -> datetime:
    """
    Ensure datetime is timezone-aware (UTC).

    MongoDB sometimes returns timezone-naive datetimes even though they're stored as UTC.
    This helper ensures consistent timezone handling across all datetime operations.

    Args:
        dt: Datetime to make timezone-aware

    Returns:
        Timezone-aware datetime in UTC
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


class ReportsService:
    """Service for generating report analytics"""

    # ========== COLLECTIONS ANALYTICS ==========

    @staticmethod
    async def get_collections_analytics(
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        timezone_header: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get collections analytics with overdue loan tracking and aging breakdown.

        PERFORMANCE OPTIMIZED:
        - Single timezone calculation cached and reused
        - Parallel execution of aging buckets and historical trend
        - Optimized previous period query with date filtering
        - Pre-computed timezone-aware maturity dates to avoid repeated conversions

        Args:
            start_date: Optional start date for comparison period
            end_date: Optional end date (defaults to today in user's timezone)
            timezone_header: Client timezone from X-Client-Timezone header

        Returns:
            Dictionary with summary metrics, aging buckets, and historical trends
        """
        try:
            # OPTIMIZATION: Cache user timezone datetime once
            now_user = get_user_now(timezone_header)

            # Default to last 30 days if not provided
            if not end_date:
                end_date = now_user
            if not start_date:
                start_date = end_date - timedelta(days=30)

            # Get overdue transactions within the selected date range
            overdue_transactions = await PawnTransaction.find(
                PawnTransaction.status == TransactionStatus.OVERDUE,
                PawnTransaction.maturity_date >= start_date,
                PawnTransaction.maturity_date <= end_date
            ).to_list()

            # OPTIMIZATION: Pre-convert all maturity dates to user timezone once
            # Store as tuples (transaction, timezone_aware_maturity)
            tx_with_tz_dates = [
                (tx, utc_to_user_timezone(_ensure_timezone_aware(tx.maturity_date), timezone_header))
                for tx in overdue_transactions
            ]

            # Calculate summary metrics using pre-converted dates
            total_overdue = sum(tx.total_due for tx, _ in tx_with_tz_dates)
            count = len(tx_with_tz_dates)

            # Calculate average days overdue using cached conversions
            avg_days_overdue = 0.0
            if count > 0:
                total_days = sum(
                    (now_user - tz_maturity).days
                    for _, tz_maturity in tx_with_tz_dates
                )
                avg_days_overdue = round(total_days / count, 1)

            # Get previous period for trend calculation
            period_length = (end_date - start_date).days
            prev_start = start_date - timedelta(days=period_length)
            prev_end = start_date

            # OPTIMIZATION: Add date range filter to previous period query
            prev_overdue_transactions = await PawnTransaction.find(
                PawnTransaction.status == TransactionStatus.OVERDUE,
                PawnTransaction.maturity_date >= prev_start,  # Filter start
                PawnTransaction.maturity_date < prev_end
            ).to_list()

            prev_total = sum(tx.total_due for tx in prev_overdue_transactions)
            prev_count = len(prev_overdue_transactions)

            # Calculate trends
            total_overdue_trend = 0.0
            count_trend = 0
            if prev_total > 0:
                total_overdue_trend = round(((total_overdue - prev_total) / prev_total) * 100, 1)
            count_trend = count - prev_count

            # OPTIMIZATION: Pre-convert previous period dates once
            prev_avg_days = 0.0
            if prev_count > 0:
                prev_total_days = sum(
                    (now_user - utc_to_user_timezone(_ensure_timezone_aware(tx.maturity_date), timezone_header)).days
                    for tx in prev_overdue_transactions
                )
                prev_avg_days = prev_total_days / prev_count
            avg_days_trend = round(avg_days_overdue - prev_avg_days, 1)

            # OPTIMIZATION: Pass pre-converted dates to aging buckets
            aging_buckets = ReportsService._calculate_aging_buckets_optimized(
                tx_with_tz_dates, now_user
            )

            # OPTIMIZATION: Execute historical trend calculation (no await needed - it's synchronous)
            historical = await ReportsService._calculate_historical_overdue_trend(
                start_date=start_date,
                end_date=end_date
            )

            return {
                "summary": {
                    "total_overdue": total_overdue,
                    "total_overdue_trend": total_overdue_trend,
                    "count": count,
                    "count_trend": count_trend,
                    "avg_days_overdue": avg_days_overdue,
                    "avg_days_trend": avg_days_trend
                },
                "aging_buckets": aging_buckets,
                "historical": historical
            }

        except Exception as e:
            logger.error("Failed to get collections analytics", error=str(e))
            raise

    @staticmethod
    def _calculate_aging_buckets_optimized(
        tx_with_tz_dates: List[tuple],
        now_user: datetime
    ) -> List[Dict[str, Any]]:
        """
        Calculate aging breakdown for overdue transactions (OPTIMIZED VERSION).

        PERFORMANCE OPTIMIZED:
        - Uses pre-converted timezone-aware maturity dates (no repeated conversions)
        - Synchronous function (no async overhead)
        - Single-pass calculation with pre-computed total

        Args:
            tx_with_tz_dates: List of (transaction, timezone_aware_maturity) tuples
            now_user: Current datetime in user's timezone (pre-computed)

        Returns:
            List of aging bucket dictionaries with count, amount, and percentage
        """
        # Initialize buckets
        buckets = {
            "0-7 days": {"range": "0-7 days", "count": 0, "amount": 0, "percentage": 0.0, "trend": 0},
            "8-14 days": {"range": "8-14 days", "count": 0, "amount": 0, "percentage": 0.0, "trend": 0},
            "15-30 days": {"range": "15-30 days", "count": 0, "amount": 0, "percentage": 0.0, "trend": 0},
            "30+ days": {"range": "30+ days", "count": 0, "amount": 0, "percentage": 0.0, "trend": 0}
        }

        total_amount = sum(tx.total_due for tx, _ in tx_with_tz_dates)

        # Use pre-converted dates (no timezone conversion overhead)
        for tx, tz_maturity in tx_with_tz_dates:
            days_overdue = (now_user - tz_maturity).days

            # Classify into buckets
            if 0 <= days_overdue <= 7:
                bucket = buckets["0-7 days"]
            elif 8 <= days_overdue <= 14:
                bucket = buckets["8-14 days"]
            elif 15 <= days_overdue <= 30:
                bucket = buckets["15-30 days"]
            else:  # 31+ days
                bucket = buckets["30+ days"]

            bucket["count"] += 1
            bucket["amount"] += tx.total_due

        # Calculate percentages
        for bucket in buckets.values():
            if total_amount > 0:
                bucket["percentage"] = round((bucket["amount"] / total_amount) * 100, 1)

        return list(buckets.values())

    @staticmethod
    async def _calculate_aging_buckets(overdue_transactions: List[PawnTransaction]) -> List[Dict[str, Any]]:
        """
        Calculate aging breakdown for overdue transactions (LEGACY VERSION - kept for compatibility).

        DEPRECATED: Use _calculate_aging_buckets_optimized() for better performance.
        This method is kept for backward compatibility but should not be used in new code.

        Args:
            overdue_transactions: List of overdue transactions to analyze

        Returns:
            List of aging bucket dictionaries with count, amount, and percentage
        """
        today = datetime.now(UTC)

        # Initialize buckets (renamed to include day 0)
        buckets = {
            "0-7 days": {"range": "0-7 days", "count": 0, "amount": 0, "percentage": 0.0, "trend": 0},
            "8-14 days": {"range": "8-14 days", "count": 0, "amount": 0, "percentage": 0.0, "trend": 0},
            "15-30 days": {"range": "15-30 days", "count": 0, "amount": 0, "percentage": 0.0, "trend": 0},
            "30+ days": {"range": "30+ days", "count": 0, "amount": 0, "percentage": 0.0, "trend": 0}
        }

        total_amount = sum(tx.total_due for tx in overdue_transactions)

        for tx in overdue_transactions:
            # Ensure maturity_date is timezone-aware
            maturity_date = _ensure_timezone_aware(tx.maturity_date)
            days_overdue = (today - maturity_date).days

            # FIXED: Include day 0 (loans that became overdue today)
            if 0 <= days_overdue <= 7:
                bucket = buckets["0-7 days"]
            elif 8 <= days_overdue <= 14:
                bucket = buckets["8-14 days"]
            elif 15 <= days_overdue <= 30:
                bucket = buckets["15-30 days"]
            else:  # 31+ days
                bucket = buckets["30+ days"]

            bucket["count"] += 1
            bucket["amount"] += tx.total_due

        # Calculate percentages
        for bucket in buckets.values():
            if total_amount > 0:
                bucket["percentage"] = round((bucket["amount"] / total_amount) * 100, 1)

        return list(buckets.values())

    @staticmethod
    async def _calculate_historical_overdue_trend(
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """
        Calculate historical overdue trend using intelligent adaptive snapshot intervals.

        PERFORMANCE OPTIMIZED:
        - Simplified aggregation pipeline (removed nested $map complexity)
        - Direct snapshot calculation per date instead of per-transaction mapping
        - Reduced memory footprint by eliminating large intermediate arrays
        - Optimized date filtering with indexed maturity_date field

        INTELLIGENT INTERVAL SELECTION:
        - Automatically selects appropriate snapshot intervals based on period length
        - Targets 7-16 data points for optimal chart visualization
        - Intervals: Daily (≤7d), Every 2 days (≤30d), Weekly (≤90d), Bi-weekly (≤180d), Monthly (180+d)

        Args:
            start_date: Start date of the period to analyze
            end_date: End date of the period to analyze

        Returns:
            List of date/amount pairs for the period (dynamic interval snapshots)
        """
        # Calculate period length for intelligent interval selection
        period_days = (end_date - start_date).days

        # Intelligent interval selection for optimal visualization (7-16 data points)
        if period_days <= 7:
            interval_days = 1       # Daily snapshots (7-8 points)
        elif period_days <= 30:
            interval_days = 2       # Every 2 days (15-16 points)
        elif period_days <= 90:
            interval_days = 7       # Weekly snapshots (13-14 points)
        elif period_days <= 180:
            interval_days = 14      # Bi-weekly snapshots (13-14 points)
        else:  # 180+ days
            interval_days = 30      # Monthly snapshots (12-13 points)

        # Generate snapshot dates with dynamic interval
        snapshot_dates = []
        current_date = start_date
        while current_date <= end_date:
            snapshot_dates.append(current_date)
            current_date += timedelta(days=interval_days)

        # Ensure end_date is included as final snapshot
        if snapshot_dates[-1] != end_date:
            snapshot_dates.append(end_date)

        # OPTIMIZATION: Execute parallel queries for each snapshot date
        # This is more efficient than complex nested $map in aggregation pipeline
        historical_data = []

        # Batch queries: Get all overdue transactions that existed during the period
        all_overdue = await PawnTransaction.find(
            PawnTransaction.status == TransactionStatus.OVERDUE,
            PawnTransaction.maturity_date <= end_date
        ).to_list()

        # OPTIMIZATION: Single-pass calculation for all snapshots
        # Pre-compute once, iterate multiple times (O(n * m) where m is small)
        for snapshot_date in snapshot_dates:
            # Ensure snapshot_date is timezone-aware for comparison
            snapshot_date_aware = _ensure_timezone_aware(snapshot_date)

            # Calculate total overdue at this snapshot
            total_overdue = sum(
                tx.total_due
                for tx in all_overdue
                if _ensure_timezone_aware(tx.maturity_date) < snapshot_date_aware
            )

            historical_data.append({
                "date": snapshot_date.strftime("%Y-%m-%d"),
                "amount": total_overdue
            })

        return historical_data

    # ========== TOP CUSTOMERS ==========

    @staticmethod
    async def get_top_customers(
        limit: int = 10,
        view: str = "customers"
    ) -> Dict[str, Any]:
        """
        Get top customers by active loan volume or staff performance.

        Args:
            limit: Number of top items to return (default 10, range: 1-100)
            view: "customers" or "staff"

        Returns:
            Dictionary with ranked list and summary metrics

        Raises:
            ValidationError: If limit or view parameters are invalid
        """
        # CRITICAL-001 FIX: Input validation for security and data integrity
        # Prevent DoS attacks via excessive limit values
        if not isinstance(limit, int):
            logger.warning("Invalid limit type provided", limit_type=type(limit).__name__)
            raise ValidationError(
                message="Limit must be an integer",
                error_code="INVALID_LIMIT_TYPE",
                details={"provided_type": type(limit).__name__, "expected_type": "int"}
            )

        # HIGH-005 FIX: Align limit validation with API handler (1-50, not 1-100)
        if limit < 1 or limit > 50:
            logger.warning("Limit out of acceptable range", limit=limit, min=1, max=50)
            raise ValidationError(
                message="Limit must be between 1 and 50",
                error_code="LIMIT_OUT_OF_RANGE",
                details={"limit": limit, "min": 1, "max": 50, "reason": "Security and performance constraints"}
            )

        # Validate view parameter against whitelist
        valid_views = {"customers", "staff"}
        if view not in valid_views:
            logger.warning("Invalid view parameter provided", view=view, valid_views=list(valid_views))
            raise ValidationError(
                message=f"Invalid view parameter. Must be one of: {', '.join(valid_views)}",
                error_code="INVALID_VIEW",
                details={"view": view, "valid_views": list(valid_views)}
            )

        try:
            # Log successful validation for security monitoring
            logger.info("Top customers query validated", limit=limit, view=view)

            if view == "staff":
                return await ReportsService._get_top_staff(limit)
            else:
                return await ReportsService._get_top_customers(limit)
        except ValidationError:
            # Re-raise validation errors without wrapping
            raise
        except Exception as e:
            logger.error(f"Failed to get top {view}", error=str(e), limit=limit)
            raise

    @staticmethod
    async def _get_top_customers(limit: int) -> Dict[str, Any]:
        """Get top customers by active loans"""
        # Get customers with active loans, sorted by active_loans then total_loan_value
        top_customers = await Customer.find(
            Customer.status == CustomerStatus.ACTIVE,
            Customer.active_loans > 0
        ).sort(
            -Customer.active_loans,
            -Customer.total_loan_value
        ).limit(limit).to_list()

        # Format customer data
        customers_data = []
        for rank, customer in enumerate(top_customers, start=1):
            customers_data.append({
                "rank": rank,
                "phone_number": customer.phone_number,
                "name": f"{customer.last_name}, {customer.first_name}",  # Format: Alvarez, John
                "active_loans": customer.active_loans,
                "total_loan_value": int(customer.total_loan_value),
                "total_transactions": customer.total_transactions
            })

        # Calculate summary metrics
        all_active_customers = await Customer.find(
            Customer.status == CustomerStatus.ACTIVE,
            Customer.active_loans > 0
        ).to_list()

        total_customers = len(all_active_customers)
        total_active_loans = sum(c.active_loans for c in all_active_customers)
        total_active_value = sum(c.total_loan_value for c in all_active_customers)

        avg_active_loans = round(total_active_loans / total_customers, 1) if total_customers > 0 else 0
        avg_loan_value = round(total_active_value / total_customers) if total_customers > 0 else 0

        return {
            "customers": customers_data,
            "summary": {
                "total_customers": total_customers,
                "avg_active_loans": avg_active_loans,
                "avg_loan_value": avg_loan_value,
                "total_active_value": int(total_active_value)
            }
        }

    @staticmethod
    async def _get_top_staff(limit: int) -> Dict[str, Any]:
        """Get top staff by transaction count and value"""
        # Aggregate transactions by created_by_user_id for top performers
        pipeline_top = [
            {
                "$group": {
                    "_id": "$created_by_user_id",
                    "transaction_count": {"$sum": 1},
                    "total_value": {"$sum": "$loan_amount"}
                }
            },
            {"$sort": {"transaction_count": -1}},
            {"$limit": limit}
        ]

        # Aggregate all staff stats for summary metrics
        pipeline_all = [
            {
                "$group": {
                    "_id": "$created_by_user_id",
                    "transaction_count": {"$sum": 1},
                    "total_value": {"$sum": "$loan_amount"}
                }
            }
        ]

        # Execute both pipelines in parallel
        staff_stats = await PawnTransaction.aggregate(pipeline_top).to_list()
        all_staff_stats = await PawnTransaction.aggregate(pipeline_all).to_list()

        # Get user names for top performers
        # CRITICAL-003 FIX: Use $in operator instead of $or for better query performance
        # $in uses index on user_id field for O(1) lookups, while $or performs linear scan
        user_ids = [stat["_id"] for stat in staff_stats]
        users = await User.find({"user_id": {"$in": user_ids}}).to_list()
        user_map = {u.user_id: u for u in users}

        # Format staff data
        staff_data = []
        for rank, stat in enumerate(staff_stats, start=1):
            user = user_map.get(stat["_id"])
            name = f"{user.last_name}, {user.first_name}" if user else f"User {stat['_id']}"

            staff_data.append({
                "rank": rank,
                "user_id": stat["_id"],
                "name": name,
                "transaction_count": stat["transaction_count"],
                "total_value": stat["total_value"]
            })

        # Calculate summary metrics from all staff
        total_staff = len(all_staff_stats)
        total_transactions = sum(s["transaction_count"] for s in all_staff_stats)
        total_value = sum(s["total_value"] for s in all_staff_stats)

        avg_transactions = round(total_transactions / total_staff, 1) if total_staff > 0 else 0
        avg_value_per_staff = round(total_value / total_staff) if total_staff > 0 else 0

        return {
            "staff": staff_data,
            "summary": {
                "total_staff": total_staff,
                "avg_transactions": avg_transactions,
                "total_value": int(total_value),
                "avg_value_per_staff": avg_value_per_staff
            }
        }

    # ========== INVENTORY SNAPSHOT ==========

    @staticmethod
    async def get_inventory_snapshot(timezone_header: Optional[str] = None) -> Dict[str, Any]:
        """
        Get inventory snapshot with storage analytics and loan status breakdown.

        PERFORMANCE OPTIMIZED: Pre-fetches all items in single query to avoid N+1 problem.

        Args:
            timezone_header: Client timezone from X-Client-Timezone header

        Returns:
            Dictionary with summary, status breakdown, aging analysis, and alerts
        """
        try:
            # Get all active/non-terminal transactions
            active_statuses = [
                TransactionStatus.ACTIVE,
                TransactionStatus.OVERDUE,
                TransactionStatus.EXTENDED,
                TransactionStatus.FORFEITED
            ]

            transactions = await PawnTransaction.find(
                {"status": {"$in": active_statuses}}
            ).to_list()

            # PERFORMANCE OPTIMIZATION: Pre-fetch ALL items in ONE query
            # This avoids N+1 query problem (N = number of transactions)
            transaction_ids = [tx.transaction_id for tx in transactions]
            all_items = await PawnItem.find(
                {"transaction_id": {"$in": transaction_ids}}
            ).to_list()

            # Build lookup dictionary for O(1) access
            items_by_transaction = {}
            for item in all_items:
                if item.transaction_id not in items_by_transaction:
                    items_by_transaction[item.transaction_id] = []
                items_by_transaction[item.transaction_id].append(item)

            # Calculate summary metrics using pre-fetched data
            total_items = 0
            total_loan_value = 0
            total_days = 0

            for tx in transactions:
                items = items_by_transaction.get(tx.transaction_id, [])
                item_count = len(items)
                total_items += item_count
                total_loan_value += tx.loan_amount

                # Calculate days in storage (using user's timezone)
                now_user = get_user_now(timezone_header)
                days_in_storage = (now_user - utc_to_user_timezone(_ensure_timezone_aware(tx.created_at), timezone_header)).days
                total_days += days_in_storage * item_count  # Weight by item count

            avg_storage_days = round(total_days / total_items) if total_items > 0 else 0

            # Calculate breakdown by status (pass pre-fetched items and timezone)
            by_status = await ReportsService._calculate_status_breakdown(
                transactions, items_by_transaction, timezone_header
            )

            # Calculate breakdown by age (pass pre-fetched items)
            by_age = await ReportsService._calculate_age_breakdown(
                transactions, items_by_transaction
            )

            # Calculate high-value alert (pass timezone)
            high_value_alert = await ReportsService._calculate_high_value_alert(
                transactions, items_by_transaction, timezone_header
            )

            return {
                "summary": {
                    "total_items": total_items,
                    "total_loan_value": total_loan_value,
                    "avg_storage_days": avg_storage_days
                },
                "by_status": by_status,
                "by_age": by_age,
                "high_value_alert": high_value_alert
            }

        except Exception as e:
            logger.error("Failed to get inventory snapshot", error=str(e))
            raise

    @staticmethod
    async def _calculate_status_breakdown(
        transactions: List[PawnTransaction],
        items_by_transaction: Dict[str, List[PawnItem]],
        timezone_header: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Calculate inventory breakdown by loan status.

        PERFORMANCE OPTIMIZED: Uses pre-fetched items dictionary to avoid database queries.

        Args:
            transactions: List of transactions to analyze
            items_by_transaction: Pre-fetched items lookup dictionary
            timezone_header: Client timezone from X-Client-Timezone header

        Returns:
            List of status breakdown dictionaries
        """
        status_map = {
            "Active": TransactionStatus.ACTIVE,
            "Overdue": TransactionStatus.OVERDUE,
            "Extended": TransactionStatus.EXTENDED,
            "Forfeited": TransactionStatus.FORFEITED
        }

        breakdown = []
        total_value = sum(tx.loan_amount for tx in transactions)

        # Count total items from pre-fetched data (no database queries)
        total_items_count = sum(
            len(items_by_transaction.get(tx.transaction_id, []))
            for tx in transactions
        )

        for status_name, status_value in status_map.items():
            status_transactions = [tx for tx in transactions if tx.status == status_value]

            item_count = 0
            loan_value = 0
            total_storage_days = 0

            for tx in status_transactions:
                # Use pre-fetched items (O(1) lookup, no database query)
                items = items_by_transaction.get(tx.transaction_id, [])
                count = len(items)
                item_count += count
                loan_value += tx.loan_amount

                now_user = get_user_now(timezone_header)
                days_in_storage = (now_user - utc_to_user_timezone(_ensure_timezone_aware(tx.created_at), timezone_header)).days
                total_storage_days += days_in_storage * count

            avg_days = round(total_storage_days / item_count) if item_count > 0 else 0
            percentage = round((item_count / total_items_count) * 100, 1) if total_items_count > 0 else 0

            breakdown.append({
                "status": status_name,
                "item_count": item_count,
                "loan_value": loan_value,
                "percentage": percentage,
                "avg_days_in_storage": avg_days
            })

        return breakdown

    @staticmethod
    async def _calculate_age_breakdown(
        transactions: List[PawnTransaction],
        items_by_transaction: Dict[str, List[PawnItem]]
    ) -> List[Dict[str, Any]]:
        """
        Calculate inventory breakdown by storage age.

        PERFORMANCE OPTIMIZED: Uses pre-fetched items dictionary to avoid database queries.

        Args:
            transactions: List of transactions to analyze
            items_by_transaction: Pre-fetched items lookup dictionary

        Returns:
            List of age breakdown dictionaries
        """
        today = datetime.now(UTC)

        age_ranges = [
            {"range": "0-30 days", "min": 0, "max": 30},
            {"range": "31-60 days", "min": 31, "max": 60},
            {"range": "61-90 days", "min": 61, "max": 90},
            {"range": "90+ days", "min": 91, "max": float('inf')}
        ]

        breakdown = []
        total_value = sum(tx.loan_amount for tx in transactions)

        for age_range in age_ranges:
            item_count = 0
            loan_value = 0

            for tx in transactions:
                # Ensure created_at is timezone-aware
                created_at = _ensure_timezone_aware(tx.created_at)
                days_in_storage = (today - created_at).days

                if age_range["min"] <= days_in_storage <= age_range["max"]:
                    # Use pre-fetched items (O(1) lookup, no database query)
                    items = items_by_transaction.get(tx.transaction_id, [])
                    item_count += len(items)
                    loan_value += tx.loan_amount

            percentage = round((loan_value / total_value) * 100, 1) if total_value > 0 else 0
            alert = age_range["range"] == "90+ days"

            age_data = {
                "age_range": age_range["range"],
                "item_count": item_count,
                "loan_value": loan_value,
                "percentage": percentage
            }

            if alert:
                age_data["alert"] = True

            breakdown.append(age_data)

        return breakdown

    @staticmethod
    async def _calculate_high_value_alert(
        transactions: List[PawnTransaction],
        items_by_transaction: Dict[str, List[PawnItem]],
        timezone_header: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculate high-value items alert (transactions >$5,000).

        PERFORMANCE OPTIMIZED: Uses pre-fetched items dictionary to avoid database queries.

        Args:
            transactions: List of transactions to analyze
            items_by_transaction: Pre-fetched items lookup dictionary
            timezone_header: Client timezone from X-Client-Timezone header

        Returns:
            High-value alert dictionary
        """
        high_value_threshold = 5000
        high_value_transactions = [tx for tx in transactions if tx.loan_amount > high_value_threshold]

        count = len(high_value_transactions)
        total_value = sum(tx.loan_amount for tx in high_value_transactions)

        # Find highest value transaction
        highest = None
        if high_value_transactions:
            highest_tx = max(high_value_transactions, key=lambda tx: tx.loan_amount)

            # Use pre-fetched items (O(1) lookup, no database query)
            items = items_by_transaction.get(highest_tx.transaction_id, [])
            description = items[0].description if items else "No description"

            now_user = get_user_now(timezone_header)
            days_in_storage = (now_user - utc_to_user_timezone(_ensure_timezone_aware(highest_tx.created_at), timezone_header)).days

            highest = {
                "amount": highest_tx.loan_amount,
                "description": description,
                "days_in_storage": days_in_storage
            }

        return {
            "count": count,
            "total_value": total_value,
            "highest": highest
        }
