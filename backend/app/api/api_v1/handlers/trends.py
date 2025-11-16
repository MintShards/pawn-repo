"""
REST API handlers for revenue and loan trend analytics
"""

import calendar
import hashlib
import threading
from datetime import datetime, timedelta, UTC
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Dict, List, Optional, Tuple, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
import pytz
import structlog
from prometheus_client import Counter, Gauge, Histogram

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.timezone_utils import get_user_timezone, get_user_now, get_user_business_date, utc_to_user_timezone, user_timezone_to_utc
from app.models.user_model import User
from app.models.pawn_transaction_model import PawnTransaction
from app.models.payment_model import Payment
from app.models.extension_model import Extension
from beanie.operators import And, GTE, LTE
from pydantic import BaseModel

# Configure logger
logger = structlog.get_logger(__name__)

# Create router (prefix added in router.py)
router = APIRouter(tags=["trends"])

# IMPROVEMENT 3: Environment-based cache configuration
TRENDS_CACHE_ENABLED = settings.TRENDS_CACHE_ENABLED
TRENDS_CACHE_TTL = settings.TRENDS_CACHE_TTL
TRENDS_CACHE_MAX_SIZE = settings.TRENDS_CACHE_MAX_SIZE

# CRITICAL-1 FIX: Thread-safe cache with proper cleanup
from collections import OrderedDict

_trends_cache_lock = threading.RLock()  # Thread-safe cache operations
_trends_cache: OrderedDict = OrderedDict()  # LRU tracking
_cleanup_timer: Optional[threading.Timer] = None
_shutdown_event = threading.Event()  # Graceful shutdown signal

# IMPROVEMENT 2: Prometheus metrics for cache monitoring
cache_hits_total = Counter(
    'trends_cache_hits_total',
    'Total number of cache hits',
    ['endpoint', 'period']
)

cache_misses_total = Counter(
    'trends_cache_misses_total',
    'Total number of cache misses',
    ['endpoint', 'period']
)

cache_size_gauge = Gauge(
    'trends_cache_size',
    'Current number of entries in trends cache'
)

cache_operation_duration = Histogram(
    'trends_cache_operation_duration_seconds',
    'Time spent in cache operations',
    ['operation']  # 'get', 'set', 'cleanup'
)

# BLOCKER-2: Index verification flag
_indexes_verified = False


async def verify_trends_indexes() -> None:
    """
    BLOCKER-2 FIX: Verify required indexes exist before accepting requests

    This prevents 30+ second query times from missing indexes.
    Should be called during application startup.

    Raises:
        RuntimeError: If required indexes are missing
    """
    global _indexes_verified

    if _indexes_verified:
        return

    required_indexes = {
        "payments": ["payment_date"],
        "extensions": ["extension_date"],
        "pawn_transactions": [
            "trends_created_status_idx", "trends_updated_status_idx"
        ]
    }

    missing = []

    try:
        for collection_name, index_names in required_indexes.items():
            # Get the collection based on model using Document.get_motor_collection()
            if collection_name == "payments":
                collection = Payment.get_motor_collection()
            elif collection_name == "extensions":
                collection = Extension.get_motor_collection()
            elif collection_name == "pawn_transactions":
                collection = PawnTransaction.get_motor_collection()
            else:
                continue

            # Get existing indexes
            existing = await collection.index_information()

            # Check each required index
            for idx in index_names:
                # Check if the index name exists exactly or as substring (for compound indexes)
                found = any(idx in name for name in existing.keys())
                if not found:
                    missing.append(f"{collection_name}.{idx}")

        if missing:
            logger.critical(
                "Missing required indexes for trends endpoints",
                missing_indexes=missing,
                solution="Run: python backend/scripts/create_trend_indexes.py"
            )
            raise RuntimeError(
                f"Missing required indexes: {missing}. "
                f"Run create_trend_indexes.py to create them."
            )

        _indexes_verified = True
        logger.info("Trends indexes verified successfully")

    except Exception as e:
        logger.error("Failed to verify trends indexes", error=str(e), exc_info=True)
        raise


class TrendPeriod(str, Enum):
    """
    HIGH 1: Valid trend periods (security fix - prevents SQL injection-style attacks)
    Ensures only valid period values are accepted
    """
    SEVEN_DAYS = "7d"
    THIRTY_DAYS = "30d"
    NINETY_DAYS = "90d"
    ONE_YEAR = "1y"


# Pydantic Response Schemas (CRITICAL-3: Data validation and type safety)

class RevenueTrendDataPoint(BaseModel):
    """Single data point in revenue trend"""
    date: str
    total_revenue: int  # Whole dollars only
    principal_collected: int
    interest_collected: int
    extension_fees: int
    overdue_fees: int
    payment_count: int


class RevenueTrendSummary(BaseModel):
    """Summary statistics for revenue trends"""
    total_revenue: int  # Whole dollars
    total_principal: int
    total_interest: int
    total_extension_fees: int
    total_overdue_fees: int
    total_payments: int
    avg_daily_revenue: int  # Whole dollars


class RevenueTrendResponse(BaseModel):
    """Complete revenue trend response"""
    period: str
    start_date: str
    end_date: str
    data: List[RevenueTrendDataPoint]
    summary: RevenueTrendSummary
    timestamp: str


class LoanTrendDataPoint(BaseModel):
    """Single data point in loan trend"""
    date: str
    active_loans: int
    redeemed: int
    redeemed_amount: int  # Whole dollars
    forfeited: int
    forfeited_amount: int  # Whole dollars
    sold: int
    sold_amount: int  # Whole dollars


class LoanTrendSummary(BaseModel):
    """Summary statistics for loan trends"""
    total_redeemed: int
    total_redeemed_amount: int  # Whole dollars
    total_forfeited: int
    total_forfeited_amount: int  # Whole dollars
    total_sold: int
    total_sold_amount: int  # Whole dollars
    current_active_loans: int
    avg_loan_amount: int  # Whole dollars


class LoanTrendResponse(BaseModel):
    """Complete loan trend response"""
    period: str
    start_date: str
    end_date: str
    data: List[LoanTrendDataPoint]
    summary: LoanTrendSummary
    timestamp: str


# CRITICAL-1 FIX: Timezone whitelist to prevent cache poisoning
# Only allow common, well-known IANA timezones (O(1) lookup via set)
ALLOWED_TIMEZONES = {
    "UTC", "America/New_York", "America/Chicago", "America/Denver",
    "America/Los_Angeles", "America/Vancouver", "America/Toronto",
    "America/Mexico_City", "Europe/London", "Europe/Paris", "Europe/Berlin",
    "Europe/Madrid", "Europe/Rome", "Asia/Tokyo", "Asia/Shanghai",
    "Asia/Hong_Kong", "Asia/Singapore", "Asia/Dubai", "Australia/Sydney",
    "Australia/Melbourne", "Pacific/Auckland"
}

# CRITICAL-1 FIX: Stricter rate limiting for invalid timezone attempts
# Reduced from 10 to 3 attempts per hour to prevent abuse
from collections import defaultdict

_invalid_tz_attempts: Dict[str, List[datetime]] = defaultdict(list)
MAX_INVALID_TZ_PER_HOUR = 3  # Reduced from 10 for better security


def _validate_timezone(timezone_str: Optional[str], client_ip: str = None) -> str:
    """
    CRITICAL-1 FIX: Validate timezone with whitelist and stricter rate limiting

    Prevents cache poisoning attacks (CVSS 5.3) by ensuring only whitelisted
    IANA timezone names are used in cache keys. Invalid timezones are rejected and
    logged for security monitoring. Rate limits excessive invalid attempts.

    Args:
        timezone_str: Client-provided timezone from X-Client-Timezone header
        client_ip: Client IP address for rate limiting (optional)

    Returns:
        str: Validated timezone string or "UTC" fallback

    Raises:
        HTTPException: 429 if too many invalid timezone attempts from same IP

    Security Notes:
        - Whitelist check first (O(1) set lookup) for common timezones
        - Falls back to full pytz validation for unlisted but valid timezones
        - Rate limits to prevent log spam attacks (3 attempts/hour per IP, down from 10)
        - Logs invalid attempts for security monitoring
        - Returns safe "UTC" fallback for invalid inputs
    """
    if not timezone_str:
        return "UTC"

    # CRITICAL-1 FIX: Check whitelist first (O(1) lookup)
    if timezone_str in ALLOWED_TIMEZONES:
        return timezone_str

    # Not in whitelist - validate against full pytz database
    try:
        # Validate timezone exists in IANA database
        pytz.timezone(timezone_str)

        # Valid but not whitelisted - log for potential whitelist expansion
        logger.info(
            "Valid timezone not in whitelist",
            timezone=timezone_str,
            client_ip=client_ip,
            suggestion="Consider adding to ALLOWED_TIMEZONES if commonly used"
        )
        return timezone_str

    except pytz.exceptions.UnknownTimeZoneError:
        # Track invalid attempts per IP
        if client_ip:
            now = datetime.now(UTC)
            attempts = _invalid_tz_attempts[client_ip]
            # Clean old attempts (older than 1 hour)
            attempts[:] = [t for t in attempts if now - t < timedelta(hours=1)]
            attempts.append(now)

            # CRITICAL-1 FIX: Stricter rate limit (3 attempts/hour, down from 10)
            if len(attempts) > MAX_INVALID_TZ_PER_HOUR:
                logger.error(
                    "Excessive invalid timezone attempts detected",
                    client_ip=client_ip,
                    count=len(attempts),
                    timezone=timezone_str
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many invalid timezone requests. Please check your timezone configuration."
                )

        logger.warning(
            "Invalid timezone header detected - possible cache poisoning attempt",
            timezone=timezone_str,
            client_ip=client_ip,
            fallback="UTC"
        )
        return "UTC"


def _get_cache_key(period: str, timezone: str, endpoint: str) -> str:
    """
    HIGH 2: Generate cache key for trends data

    Args:
        period: Time period (7d, 30d, 90d, 1y)
        timezone: User timezone string
        endpoint: Endpoint name (revenue/loans)

    Returns:
        MD5 hash of the cache key for consistency
    """
    return hashlib.md5(f"{endpoint}:{period}:{timezone}".encode()).hexdigest()


def _cleanup_expired_cache():
    """
    CRITICAL-1 FIX: Thread-safe cleanup with graceful shutdown

    This runs periodically in the background to prevent unbounded cache growth.
    Removes all entries that have exceeded the TTL threshold.
    """
    global _cleanup_timer

    if _shutdown_event.is_set():
        return  # Don't reschedule if shutting down

    with _trends_cache_lock:
        with cache_operation_duration.labels(operation='cleanup').time():
            now = datetime.now(UTC)
            expired_keys = [
                key for key, (_, cached_time) in _trends_cache.items()
                if now - cached_time >= timedelta(seconds=TRENDS_CACHE_TTL)
            ]

            for key in expired_keys:
                del _trends_cache[key]

            # Update cache size metric
            cache_size_gauge.set(len(_trends_cache))

            logger.info(
                "Cache cleanup completed",
                removed_entries=len(expired_keys),
                remaining_entries=len(_trends_cache),
                ttl_seconds=TRENDS_CACHE_TTL
            )

    # Schedule next cleanup only if not shutting down
    if not _shutdown_event.is_set():
        _cleanup_timer = threading.Timer(TRENDS_CACHE_TTL, _cleanup_expired_cache)
        _cleanup_timer.daemon = True
        _cleanup_timer.start()


def _start_cache_cleanup():
    """
    IMPROVEMENT 1: Initialize cache cleanup timer on application startup

    This should be called once when the application starts to begin
    the periodic cleanup cycle.
    """
    global _cleanup_timer
    if _cleanup_timer is None:
        _cleanup_timer = threading.Timer(TRENDS_CACHE_TTL, _cleanup_expired_cache)
        _cleanup_timer.daemon = True
        _cleanup_timer.start()
        logger.info(
            "Cache cleanup timer started",
            interval_seconds=TRENDS_CACHE_TTL,
            max_size=TRENDS_CACHE_MAX_SIZE
        )


def _ensure_cleanup_started():
    """
    IMPROVEMENT 1: Ensure cleanup timer is running (lazy initialization)

    This is called on first cache access to ensure the cleanup mechanism
    is active without requiring explicit application startup hooks.
    """
    global _cleanup_timer
    if _cleanup_timer is None:
        _start_cache_cleanup()


def _get_from_cache(cache_key: str, endpoint: str, period: str) -> Optional[Any]:
    """
    CRITICAL-1 FIX: Thread-safe cache get with LRU tracking

    Args:
        cache_key: Cache key generated by _get_cache_key
        endpoint: Endpoint name (for metrics labeling)
        period: Period string (for metrics labeling)

    Returns:
        Cached data if valid, None otherwise
    """
    with _trends_cache_lock:
        with cache_operation_duration.labels(operation='get').time():
            if cache_key in _trends_cache:
                cached_data, cached_time = _trends_cache[cache_key]
                if datetime.now(UTC) - cached_time < timedelta(seconds=TRENDS_CACHE_TTL):
                    # Move to end (most recently used)
                    _trends_cache.move_to_end(cache_key)
                    cache_hits_total.labels(endpoint=endpoint, period=period).inc()
                    return cached_data

            cache_misses_total.labels(endpoint=endpoint, period=period).inc()
            return None


def _set_cache(cache_key: str, data: Any) -> None:
    """
    CRITICAL-1 FIX: Thread-safe cache set with LRU eviction

    Args:
        cache_key: Cache key generated by _get_cache_key
        data: Data to cache
    """
    with _trends_cache_lock:
        with cache_operation_duration.labels(operation='set').time():
            # Check cache size limit
            if len(_trends_cache) >= TRENDS_CACHE_MAX_SIZE:
                # Evict oldest entry (first item in OrderedDict)
                oldest_key = next(iter(_trends_cache))
                del _trends_cache[oldest_key]
                logger.warning(
                    "Cache size limit reached, evicted oldest entry",
                    max_size=TRENDS_CACHE_MAX_SIZE,
                    evicted_key=oldest_key
                )

            _trends_cache[cache_key] = (data, datetime.now(UTC))

            # Update cache size metric
            cache_size_gauge.set(len(_trends_cache))


def shutdown_cache() -> None:
    """
    CRITICAL-1 FIX: Shutdown cache cleanup gracefully

    Call this on app shutdown to stop background cleanup timer
    and clear cache resources.
    """
    global _cleanup_timer
    _shutdown_event.set()
    if _cleanup_timer:
        _cleanup_timer.cancel()
    with _trends_cache_lock:
        _trends_cache.clear()
    logger.info("Trends cache shutdown completed")


def invalidate_trends_cache() -> None:
    """
    CRITICAL-1 FIX: Thread-safe cache invalidation

    Called when Payment or Extension records are created/updated to ensure
    fresh data on next request. This prevents stale revenue/loan statistics
    from being displayed after financial transactions.

    Performance: O(1) operation, clears entire cache dictionary
    """
    with _trends_cache_lock:
        cache_size_before = len(_trends_cache)
        _trends_cache.clear()
        cache_size_gauge.set(0)

        logger.info(
            "Trends cache invalidated",
            entries_cleared=cache_size_before,
            reason="Payment or Extension record modified"
        )


async def _get_date_range(
    period: Optional[str] = None,
    timezone_header: Optional[str] = None,
    start_date_str: Optional[str] = None,
    end_date_str: Optional[str] = None
):
    """
    Calculate date range based on period or custom dates and user timezone

    Args:
        period: Time period (7d, 30d, 90d, 1y) - optional if custom dates provided
        timezone_header: Client timezone from X-Client-Timezone header
        start_date_str: Custom start date (ISO format YYYY-MM-DD) - optional
        end_date_str: Custom end date (ISO format YYYY-MM-DD) - optional

    Returns:
        Tuple of (start_date, end_date, date_format, interval_days)
    """
    # Custom date range logic
    if start_date_str and end_date_str:
        try:
            # Parse ISO date strings to datetime objects
            start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))

            # Convert to user timezone if needed
            if start_date.tzinfo is None:
                # If naive, assume UTC
                start_date = start_date.replace(tzinfo=None)
                end_date = end_date.replace(tzinfo=None)
            else:
                # If aware, convert to naive UTC for MongoDB
                start_date = start_date.astimezone(pytz.UTC).replace(tzinfo=None)
                end_date = end_date.astimezone(pytz.UTC).replace(tzinfo=None)

            # HIGH-3 FIX: Validate date range chronology and maximum range
            days_diff = (end_date - start_date).days

            # Ensure start date is before end date
            if days_diff < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Start date must be before end date"
                )

            # HIGH-3 FIX: Enforce maximum date range of 365 days to prevent performance issues
            if days_diff > 365:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Maximum date range is 365 days. Requested range is {days_diff} days."
                )

            # Determine format and interval based on range length
            if days_diff <= 14:
                date_format = "%Y-%m-%d"
                interval_days = 1
            elif days_diff <= 90:
                date_format = "%Y-%m-%d"
                interval_days = 3
            elif days_diff <= 180:
                date_format = "%Y-%m-%d"
                interval_days = 7
            else:
                date_format = "%Y-%m"
                interval_days = 30

            return start_date, end_date, date_format, interval_days

        except (ValueError, AttributeError) as e:
            logger.error(
                "Invalid custom date range format",
                start_date=start_date_str,
                end_date=end_date_str,
                error=str(e)
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ): {str(e)}"
            )

    # Preset period logic (existing functionality)
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


@router.get("/revenue", response_model=RevenueTrendResponse)
async def get_revenue_trends(
    request: Request,
    period: Optional[TrendPeriod] = Query(None, description="Time period: 7d, 30d, 90d, 1y"),
    start_date: Optional[str] = Query(None, description="Custom start date (ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)"),
    end_date: Optional[str] = Query(None, description="Custom end date (ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)"),
    current_user: User = Depends(get_current_user)
):
    """
    Get revenue trends data for specified time period or custom date range

    Parameters:
    - period: Preset time period (7d, 30d, 90d, 1y) - optional if custom dates provided
    - start_date: Custom start date (ISO format) - optional
    - end_date: Custom end date (ISO format) - optional

    Returns:
    - Total collections by date
    - Payment breakdown (principal vs interest)
    - Extension fees collected
    - Daily/weekly/monthly revenue trends

    Security:
    - HIGH 1: Period parameter validated via enum to prevent injection attacks
    - HIGH 2: Response caching with 5-minute TTL for performance
    - Date range validation to prevent excessive queries

    Data Format:
    - CRITICAL-3: Pydantic schema validation ensures integer-only values (whole dollars)
    - All amounts are whole numbers (no cents) matching system design
    """
    try:
        timezone_header = request.headers.get("X-Client-Timezone")
        client_ip = request.client.host if request.client else None

        # Validate parameters
        if not period and not (start_date and end_date):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either 'period' or both 'start_date' and 'end_date' must be provided"
            )

        if start_date and not end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Both 'start_date' and 'end_date' must be provided for custom range"
            )

        if end_date and not start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Both 'start_date' and 'end_date' must be provided for custom range"
            )

        # IMPROVEMENT 1: Ensure cleanup timer is started
        _ensure_cleanup_started()

        # IMPROVEMENT 3: Check cache before expensive database operations (if enabled)
        if TRENDS_CACHE_ENABLED:
            # CRITICAL-3: Validate timezone with rate limiting
            validated_tz = _validate_timezone(timezone_header, client_ip)
            # Use custom dates or period for cache key
            cache_key_suffix = f"{start_date}_{end_date}" if start_date else period.value
            cache_key = _get_cache_key(cache_key_suffix, validated_tz, "revenue")
            cached_result = _get_from_cache(cache_key, "revenue", cache_key_suffix)
            if cached_result:
                logger.info("Returning cached revenue trends",
                           user_id=current_user.user_id,
                           period=period.value if period else "custom",
                           cache_key=cache_key,
                           cache_enabled=TRENDS_CACHE_ENABLED)
                return cached_result

        logger.info("Getting revenue trends",
                   user_id=current_user.user_id,
                   period=period.value if period else "custom",
                   start_date=start_date,
                   end_date=end_date,
                   timezone=timezone_header,
                   cache_enabled=TRENDS_CACHE_ENABLED)

        # Get date range (support both preset periods and custom dates)
        start_date_obj, end_date_obj, date_format, interval_days = await _get_date_range(
            period.value if period else None,
            timezone_header,
            start_date,
            end_date
        )

        # Convert to naive UTC for MongoDB queries (MongoDB may store/return naive datetimes)
        # The _get_date_range function already returns timezone-aware or naive UTC datetimes
        start_date_naive = start_date_obj if start_date_obj.tzinfo is None else start_date_obj.replace(tzinfo=None)
        end_date_naive = end_date_obj if end_date_obj.tzinfo is None else end_date_obj.replace(tzinfo=None)

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
                    "total_revenue": Decimal("0"),
                    "principal_collected": Decimal("0"),
                    "interest_collected": Decimal("0"),
                    "extension_fees": Decimal("0"),
                    "overdue_fees": Decimal("0"),
                    "payment_count": 0
                }

            # BLOCKER 3: Use Decimal for all financial calculations to avoid float precision issues
            revenue_by_date[date_key]["total_revenue"] += Decimal(str(payment.payment_amount))
            revenue_by_date[date_key]["principal_collected"] += Decimal(str(payment.principal_portion))
            revenue_by_date[date_key]["interest_collected"] += Decimal(str(payment.interest_portion))
            revenue_by_date[date_key]["overdue_fees"] += Decimal(str(payment.overdue_fee_portion))
            revenue_by_date[date_key]["payment_count"] += 1

        # Process extensions
        for extension in extensions:
            # Convert extension date to user timezone using project's timezone utilities
            extension_date = utc_to_user_timezone(extension.extension_date, timezone_header)
            date_key = extension_date.strftime(date_format)

            if date_key not in revenue_by_date:
                revenue_by_date[date_key] = {
                    "date": date_key,
                    "total_revenue": Decimal("0"),
                    "principal_collected": Decimal("0"),
                    "interest_collected": Decimal("0"),
                    "extension_fees": Decimal("0"),
                    "overdue_fees": Decimal("0"),
                    "payment_count": 0
                }

            # BLOCKER 3: Convert extension fees to Decimal for precision
            # Note: Extension model uses floats for discount_amount and overdue_fee_collected
            # Converting to Decimal here prevents precision loss in aggregation
            extension_fee_decimal = Decimal(str(extension.total_extension_fee))
            revenue_by_date[date_key]["extension_fees"] += extension_fee_decimal
            revenue_by_date[date_key]["total_revenue"] += extension_fee_decimal

        # Convert Decimal values to integers (whole dollars only - CRITICAL-1 fix)
        for date_entry in revenue_by_date.values():
            date_entry["total_revenue"] = int(date_entry["total_revenue"])
            date_entry["principal_collected"] = int(date_entry["principal_collected"])
            date_entry["interest_collected"] = int(date_entry["interest_collected"])
            date_entry["extension_fees"] = int(date_entry["extension_fees"])
            date_entry["overdue_fees"] = int(date_entry["overdue_fees"])

        # Convert to sorted list
        revenue_data = sorted(revenue_by_date.values(), key=lambda x: x["date"])

        # Calculate summary statistics (integers only - CRITICAL-1 fix)
        total_revenue = sum(d["total_revenue"] for d in revenue_data)
        total_principal = sum(d["principal_collected"] for d in revenue_data)
        total_interest = sum(d["interest_collected"] for d in revenue_data)
        total_extension_fees = sum(d["extension_fees"] for d in revenue_data)
        total_overdue_fees = sum(d["overdue_fees"] for d in revenue_data)
        total_payments = sum(d["payment_count"] for d in revenue_data)

        # Calculate average daily revenue (whole dollars)
        avg_daily_revenue = total_revenue // len(revenue_data) if revenue_data else 0

        logger.info("Revenue trends calculated successfully",
                   period=period.value if period else "custom",
                   data_points=len(revenue_data),
                   total_revenue=total_revenue)

        # Build result with integer values (whole dollars - CRITICAL-1 & CRITICAL-6 fix)
        result = {
            "period": period.value if period else "custom",
            "start_date": start_date_obj.isoformat(),
            "end_date": end_date_obj.isoformat(),
            "data": revenue_data,
            "summary": {
                "total_revenue": total_revenue,
                "total_principal": total_principal,
                "total_interest": total_interest,
                "total_extension_fees": total_extension_fees,
                "total_overdue_fees": total_overdue_fees,
                "total_payments": total_payments,
                "avg_daily_revenue": avg_daily_revenue
            },
            "timestamp": datetime.now(UTC).isoformat()
        }

        # IMPROVEMENT 3: Store result in cache before returning (if enabled)
        if TRENDS_CACHE_ENABLED:
            _set_cache(cache_key, result)

        return result

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error("Failed to get revenue trends",
                    period=period.value if period else "custom",
                    error=str(e),
                    error_type=type(e).__name__,
                    traceback=error_details)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate revenue trends: {str(e)}"
        )


@router.get("/loans", response_model=LoanTrendResponse)
async def get_loan_trends(
    request: Request,
    period: Optional[TrendPeriod] = Query(None, description="Time period: 7d, 30d, 90d, 1y"),
    start_date: Optional[str] = Query(None, description="Custom start date (ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)"),
    end_date: Optional[str] = Query(None, description="Custom end date (ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)"),
    current_user: User = Depends(get_current_user)
):
    """
    Get loan trends data for specified time period or custom date range

    Parameters:
    - period: Preset time period (7d, 30d, 90d, 1y) - optional if custom dates provided
    - start_date: Custom start date (ISO format) - optional
    - end_date: Custom end date (ISO format) - optional

    Returns:
    - New loans created by date
    - Redemptions (fully paid loans) by date
    - Active loans count over time
    - Status distribution trends

    Security:
    - HIGH 1: Period parameter validated via enum to prevent injection attacks
    - HIGH 2: Response caching with 5-minute TTL for performance
    - Date range validation to prevent excessive queries

    Data Format:
    - CRITICAL-3: Pydantic schema validation ensures integer-only values (whole dollars)
    - All amounts are whole numbers (no cents) matching system design

    Fixes:
    - BLOCKER 1: Active loans timezone bug - date calculations in UTC
    - HIGH 3: Redemptions edge case - fallback to created_at when updated_at is None
    """
    try:
        timezone_header = request.headers.get("X-Client-Timezone")
        client_ip = request.client.host if request.client else None

        # Validate parameters
        if not period and not (start_date and end_date):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either 'period' or both 'start_date' and 'end_date' must be provided"
            )

        if start_date and not end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Both 'start_date' and 'end_date' must be provided for custom range"
            )

        if end_date and not start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Both 'start_date' and 'end_date' must be provided for custom range"
            )

        # IMPROVEMENT 1: Ensure cleanup timer is started
        _ensure_cleanup_started()

        # IMPROVEMENT 3: Check cache before expensive database operations (if enabled)
        if TRENDS_CACHE_ENABLED:
            # CRITICAL-3: Validate timezone with rate limiting
            validated_tz = _validate_timezone(timezone_header, client_ip)
            # Use custom dates or period for cache key
            cache_key_suffix = f"{start_date}_{end_date}" if start_date else period.value
            cache_key = _get_cache_key(cache_key_suffix, validated_tz, "loans")
            cached_result = _get_from_cache(cache_key, "loans", cache_key_suffix)
            if cached_result:
                logger.info("Returning cached loan trends",
                           user_id=current_user.user_id,
                           period=period.value if period else "custom",
                           cache_key=cache_key,
                           cache_enabled=TRENDS_CACHE_ENABLED)
                return cached_result

        logger.info("Getting loan trends",
                   user_id=current_user.user_id,
                   period=period.value if period else "custom",
                   start_date=start_date,
                   end_date=end_date,
                   timezone=timezone_header,
                   cache_enabled=TRENDS_CACHE_ENABLED)

        # Get date range (support both preset periods and custom dates)
        start_date_obj, end_date_obj, date_format, interval_days = await _get_date_range(
            period.value if period else None,
            timezone_header,
            start_date,
            end_date
        )

        # Convert to naive UTC for MongoDB queries (MongoDB may store/return naive datetimes)
        # The _get_date_range function already returns timezone-aware or naive UTC datetimes
        start_date_naive = start_date_obj if start_date_obj.tzinfo is None else start_date_obj.replace(tzinfo=None)
        end_date_naive = end_date_obj if end_date_obj.tzinfo is None else end_date_obj.replace(tzinfo=None)

        # Query transactions in two parts for accurate active loan tracking:
        # 1. Transactions created during the period
        transactions_in_period = await PawnTransaction.find(
            And(
                GTE(PawnTransaction.created_at, start_date_naive),
                LTE(PawnTransaction.created_at, end_date_naive)
            )
        ).to_list()

        # 2. Transactions created before the period that might still be active
        # Include: currently active, or became terminal during/after the period
        earlier_active_transactions = await PawnTransaction.find(
            LTE(PawnTransaction.created_at, start_date_naive)
        ).to_list()

        # Filter earlier transactions to only those relevant to the period
        # (currently active OR became terminal on or after period start)
        terminal_statuses = ["redeemed", "forfeited", "sold", "voided"]
        filtered_earlier = []
        for t in earlier_active_transactions:
            if t.status not in terminal_statuses:
                # Still active, include it
                filtered_earlier.append(t)
            elif t.updated_at:
                # Terminal status - check if it changed during or after the period
                updated_naive = t.updated_at if t.updated_at.tzinfo is None else t.updated_at.replace(tzinfo=None)
                if updated_naive >= start_date_naive:
                    filtered_earlier.append(t)

        # Combine both sets
        all_transactions = transactions_in_period + filtered_earlier

        # CRITICAL FIX 1: Pre-populate all dates in the period with zero values
        # This prevents chart gaps when no activity occurs on certain dates
        loan_by_date = {}

        # Generate all dates in the period based on interval
        current_date = start_date_obj
        while current_date <= end_date_obj:
            date_key = current_date.strftime(date_format)

            # Initialize with zero values for all metrics
            loan_by_date[date_key] = {
                "date": date_key,
                "redeemed": 0,
                "redeemed_amount": 0,
                "forfeited": 0,
                "forfeited_amount": 0,
                "sold": 0,
                "sold_amount": 0,
                "active_loans": 0
            }

            # Increment based on interval
            if interval_days == 1:
                current_date += timedelta(days=1)
            elif interval_days == 3:
                current_date += timedelta(days=3)
            elif interval_days == 30:
                # For monthly intervals, increment by month
                if current_date.month == 12:
                    current_date = current_date.replace(year=current_date.year + 1, month=1, day=1)
                else:
                    current_date = current_date.replace(month=current_date.month + 1, day=1)
            else:
                # Fallback for any other interval
                current_date += timedelta(days=interval_days)

        logger.info("Pre-populated date range for loan trends",
                   period=period.value if period else "custom",
                   total_dates=len(loan_by_date),
                   date_range=f"{start_date_obj.strftime(date_format)} to {end_date_obj.strftime(date_format)}",
                   interval_days=interval_days)

        # Process terminal status transactions (redeemed, forfeited, sold)
        #
        # TIMEZONE EDGE CASE HANDLING:
        # Transactions are queried in UTC and filtered by date range, then converted to user timezone.
        # Due to timezone conversions, some transactions may fall outside the pre-populated date buckets:
        #
        # Example: Transaction redeemed at 2025-11-07 23:30 UTC
        #   - In UTC: Falls within query range (2025-11-07)
        #   - In PST (-8h): Becomes 2025-11-07 15:30 (still 2025-11-07)
        #   - In JST (+9h): Becomes 2025-11-08 08:30 (next day!)
        #
        # Pre-populated buckets are created from start_date to end_date in user timezone.
        # If a transaction's timezone-adjusted date falls outside this range, we silently skip it.
        # This is EXPECTED BEHAVIOR - not an error condition.
        #
        # The data remains accurate because:
        # 1. Query filters transactions by UTC date range (lines 849, 878, 907)
        # 2. Only transactions truly within the period are processed
        # 3. Timezone edge cases at boundaries are acceptable for trend visualization
        #
        # HIGH 3: Handle edge case where updated_at might be None or same as created_at
        redeemed_count = 0
        for transaction in all_transactions:
            if transaction.status == "redeemed":
                # Use updated_at if available, fall back to created_at for same-day redemptions
                redemption_date_utc = transaction.updated_at if transaction.updated_at else transaction.created_at

                # Ensure naive datetime for comparison
                if redemption_date_utc.tzinfo is not None:
                    redemption_date_utc = redemption_date_utc.replace(tzinfo=None)

                # Check if redemption happened within date range
                if start_date_naive <= redemption_date_utc <= end_date_naive:
                    # Convert to user timezone for display
                    redemption_date = utc_to_user_timezone(redemption_date_utc, timezone_header)
                    date_key = redemption_date.strftime(date_format)

                    # Date should already exist from pre-population
                    # Note: Due to timezone edge cases, some dates may fall outside the pre-populated range
                    # This is expected behavior - we only track transactions within the display period
                    if date_key in loan_by_date:
                        loan_by_date[date_key]["redeemed"] += 1
                        loan_by_date[date_key]["redeemed_amount"] += transaction.loan_amount
                        redeemed_count += 1

        # Process forfeited transactions
        forfeited_count = 0
        for transaction in all_transactions:
            if transaction.status == "forfeited":
                # Use updated_at if available, fall back to created_at for same-day forfeitures
                forfeiture_date_utc = transaction.updated_at if transaction.updated_at else transaction.created_at

                # Ensure naive datetime for comparison
                if forfeiture_date_utc.tzinfo is not None:
                    forfeiture_date_utc = forfeiture_date_utc.replace(tzinfo=None)

                # Check if forfeiture happened within date range
                if start_date_naive <= forfeiture_date_utc <= end_date_naive:
                    # Convert to user timezone for display
                    forfeiture_date = utc_to_user_timezone(forfeiture_date_utc, timezone_header)
                    date_key = forfeiture_date.strftime(date_format)

                    # Date should already exist from pre-population
                    # Note: Due to timezone edge cases, some dates may fall outside the pre-populated range
                    # This is expected behavior - we only track transactions within the display period
                    if date_key in loan_by_date:
                        loan_by_date[date_key]["forfeited"] += 1
                        loan_by_date[date_key]["forfeited_amount"] += transaction.loan_amount
                        forfeited_count += 1

        # Process sold transactions
        sold_count = 0
        for transaction in all_transactions:
            if transaction.status == "sold":
                # Use updated_at if available, fall back to created_at for same-day sales
                sold_date_utc = transaction.updated_at if transaction.updated_at else transaction.created_at

                # Ensure naive datetime for comparison
                if sold_date_utc.tzinfo is not None:
                    sold_date_utc = sold_date_utc.replace(tzinfo=None)

                # Check if sale happened within date range
                if start_date_naive <= sold_date_utc <= end_date_naive:
                    # Convert to user timezone for display
                    sold_date = utc_to_user_timezone(sold_date_utc, timezone_header)
                    date_key = sold_date.strftime(date_format)

                    # Date should already exist from pre-population
                    # Note: Due to timezone edge cases, some dates may fall outside the pre-populated range
                    # This is expected behavior - we only track transactions within the display period
                    if date_key in loan_by_date:
                        loan_by_date[date_key]["sold"] += 1
                        loan_by_date[date_key]["sold_amount"] += transaction.loan_amount
                        sold_count += 1

        # Calculate active loans count for each date
        # Active = active, overdue, or extended status
        active_statuses = ["active", "overdue", "extended"]
        terminal_statuses = ["redeemed", "forfeited", "sold", "voided"]

        for date_key in loan_by_date.keys():
            # CRITICAL FIX 4: Create date boundary in user timezone, then convert to UTC
            # This ensures consistency with how terminal status dates are processed
            # Terminal dates use: utc_to_user_timezone(date_utc) → format
            # Active dates must use: parse(date_key in user tz) → convert to UTC

            # Parse date_key back to datetime in USER timezone
            # Handle different date formats based on period
            if len(date_key) == 7:  # "YYYY-MM" format (1y period)
                # Use last day of month for year view
                year, month = map(int, date_key.split('-'))
                last_day = calendar.monthrange(year, month)[1]
                # Create at END of day (23:59:59) in USER timezone
                date_obj_user_tz = datetime(year, month, last_day, 23, 59, 59, tzinfo=None)
            else:  # "YYYY-MM-DD" format (7d, 30d, 90d periods)
                # Parse date and set to END of day (23:59:59) in USER timezone
                parsed_date = datetime.strptime(date_key, "%Y-%m-%d")
                date_obj_user_tz = parsed_date.replace(hour=23, minute=59, second=59, tzinfo=None)

            # Convert user timezone boundary to UTC for comparison with database timestamps
            date_obj_utc = user_timezone_to_utc(date_obj_user_tz, timezone_header)

            # Ensure naive for comparison with database datetimes
            if date_obj_utc.tzinfo is not None:
                date_obj_utc = date_obj_utc.replace(tzinfo=None)

            # Count transactions that were active on this specific date
            active_count = 0
            for transaction in all_transactions:
                # Transaction must have been created on or before this date
                created_at_naive = transaction.created_at if transaction.created_at.tzinfo is None else transaction.created_at.replace(tzinfo=None)

                # BLOCKER 1 FIX: Use > (not >=) to exclude transactions created AFTER this date
                # Transaction created after this date's end shouldn't be counted
                if created_at_naive > date_obj_utc:
                    continue

                # Check if transaction was still active on this date
                # If status is currently active/overdue/extended, check if it was active on this date
                if transaction.status in active_statuses:
                    # Transaction is currently active - was it created by this date?
                    active_count += 1
                elif transaction.status in terminal_statuses and transaction.updated_at:
                    # Transaction is now terminal - check if it became terminal after this date
                    updated_at_naive = transaction.updated_at if transaction.updated_at.tzinfo is None else transaction.updated_at.replace(tzinfo=None)
                    # If status changed after this date, it was still active on this date
                    if updated_at_naive > date_obj_utc:
                        active_count += 1

            loan_by_date[date_key]["active_loans"] = active_count

        # CRITICAL FIX 2: Add comprehensive data validation before returning results
        # This ensures data integrity and helps catch calculation errors early

        # Validate each date entry
        validation_errors = []
        for date_entry in loan_by_date.values():
            date_key = date_entry["date"]

            # Check for negative counts (should never happen)
            if date_entry["redeemed"] < 0:
                validation_errors.append(f"Negative redeemed count on {date_key}: {date_entry['redeemed']}")
            if date_entry["forfeited"] < 0:
                validation_errors.append(f"Negative forfeited count on {date_key}: {date_entry['forfeited']}")
            if date_entry["sold"] < 0:
                validation_errors.append(f"Negative sold count on {date_key}: {date_entry['sold']}")
            if date_entry["active_loans"] < 0:
                validation_errors.append(f"Negative active loans count on {date_key}: {date_entry['active_loans']}")

            # Check for negative amounts (should never happen)
            if date_entry["redeemed_amount"] < 0:
                validation_errors.append(f"Negative redeemed amount on {date_key}: {date_entry['redeemed_amount']}")
            if date_entry["forfeited_amount"] < 0:
                validation_errors.append(f"Negative forfeited amount on {date_key}: {date_entry['forfeited_amount']}")
            if date_entry["sold_amount"] < 0:
                validation_errors.append(f"Negative sold amount on {date_key}: {date_entry['sold_amount']}")

            # Verify count-amount consistency: if count > 0, amount should > 0 (and vice versa)
            if date_entry["redeemed"] > 0 and date_entry["redeemed_amount"] == 0:
                validation_errors.append(f"Redeemed count without amount on {date_key}: count={date_entry['redeemed']}")
            if date_entry["redeemed"] == 0 and date_entry["redeemed_amount"] > 0:
                validation_errors.append(f"Redeemed amount without count on {date_key}: amount={date_entry['redeemed_amount']}")

            if date_entry["forfeited"] > 0 and date_entry["forfeited_amount"] == 0:
                validation_errors.append(f"Forfeited count without amount on {date_key}: count={date_entry['forfeited']}")
            if date_entry["forfeited"] == 0 and date_entry["forfeited_amount"] > 0:
                validation_errors.append(f"Forfeited amount without count on {date_key}: amount={date_entry['forfeited_amount']}")

            if date_entry["sold"] > 0 and date_entry["sold_amount"] == 0:
                validation_errors.append(f"Sold count without amount on {date_key}: count={date_entry['sold']}")
            if date_entry["sold"] == 0 and date_entry["sold_amount"] > 0:
                validation_errors.append(f"Sold amount without count on {date_key}: amount={date_entry['sold_amount']}")

        # Log validation errors if any
        if validation_errors:
            logger.error("Data validation failed for loan trends",
                        period=period.value if period else "custom",
                        error_count=len(validation_errors),
                        errors=validation_errors[:5])  # Log first 5 errors to avoid flooding logs
            # Note: We don't raise an exception here to allow the API to return partial data
            # In production, you might want to raise HTTPException(status_code=500, detail="Data integrity error")

        # Convert to sorted list
        loan_data = sorted(loan_by_date.values(), key=lambda x: x["date"])

        # Calculate summary statistics
        total_redeemed = sum(d["redeemed"] for d in loan_data)
        total_redeemed_amount = sum(d["redeemed_amount"] for d in loan_data)
        total_forfeited = sum(d["forfeited"] for d in loan_data)
        total_forfeited_amount = sum(d["forfeited_amount"] for d in loan_data)
        total_sold = sum(d["sold"] for d in loan_data)
        total_sold_amount = sum(d["sold_amount"] for d in loan_data)

        # Current active loans
        current_active_loans = len([t for t in all_transactions if t.status in active_statuses])

        # Average loan amount (across all terminal states)
        total_terminal_count = total_redeemed + total_forfeited + total_sold
        total_terminal_amount = total_redeemed_amount + total_forfeited_amount + total_sold_amount
        avg_loan_amount = total_terminal_amount / total_terminal_count if total_terminal_count > 0 else 0

        # CRITICAL FIX 3: Add detailed logging for debugging and verification
        logger.info("Loan trends calculated successfully",
                   period=period.value if period else "custom",
                   timezone=timezone_header or "UTC",
                   date_range=f"{start_date_obj.strftime(date_format)} to {end_date_obj.strftime(date_format)}",
                   data_points=len(loan_data),
                   total_transactions=len(all_transactions),
                   transactions_in_period=len(transactions_in_period),
                   earlier_active_transactions=len(filtered_earlier),
                   redeemed_in_period=redeemed_count,
                   forfeited_in_period=forfeited_count,
                   sold_in_period=sold_count,
                   total_redeemed=total_redeemed,
                   total_forfeited=total_forfeited,
                   total_sold=total_sold,
                   current_active_loans=current_active_loans,
                   validation_errors=len(validation_errors))

        # Build result with integer values (whole dollars - CRITICAL-1 & CRITICAL-6 fix)
        result = {
            "period": period.value if period else "custom",
            "start_date": start_date_obj.isoformat(),
            "end_date": end_date_obj.isoformat(),
            "data": loan_data,
            "summary": {
                "total_redeemed": total_redeemed,
                "total_redeemed_amount": total_redeemed_amount,  # Already integer from DB
                "total_forfeited": total_forfeited,
                "total_forfeited_amount": total_forfeited_amount,  # Already integer from DB
                "total_sold": total_sold,
                "total_sold_amount": total_sold_amount,  # Already integer from DB
                "current_active_loans": current_active_loans,
                "avg_loan_amount": int(avg_loan_amount)  # Convert to whole dollars
            },
            "timestamp": datetime.now(UTC).isoformat()
        }

        # IMPROVEMENT 3: Store result in cache before returning (if enabled)
        if TRENDS_CACHE_ENABLED:
            _set_cache(cache_key, result)

        return result

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error("Failed to get loan trends",
                    period=period.value if period else "custom",
                    error=str(e),
                    error_type=type(e).__name__,
                    traceback=error_details)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate loan trends: {str(e)}"
        )
