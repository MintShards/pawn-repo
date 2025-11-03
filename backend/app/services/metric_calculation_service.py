"""
Metric calculation service for transaction statistics
Provides real-time calculation of all stat card metrics with caching
"""

import asyncio
import time
from datetime import datetime, timezone, timedelta
from app.core.timezone_utils import get_user_business_date
from typing import Dict, List, Optional, Any
import structlog

from app.models.pawn_transaction_model import PawnTransaction
from app.models.payment_model import Payment
from app.models.extension_model import Extension
from app.models.transaction_metrics import TransactionMetrics, MetricType
from app.core.redis_cache import get_cache_service
import json

# Configure logger
logger = structlog.get_logger(__name__)


class MetricCalculationService:
    """Service for calculating transaction metrics with caching and performance optimization"""
    
    def __init__(self):
        self.cache_ttl = 60  # Cache for 1 minute
        self.redis_client = None
        self._last_warning_logged = {}  # Track when warnings were last logged to prevent spam
        self._initialize_cache()
    
    def _initialize_cache(self):
        """Initialize Redis cache connection"""
        try:
            self.redis_client = get_cache_service()
            logger.info("MetricCalculationService initialized with Redis cache")
        except Exception as e:
            logger.warning("Redis cache not available, using in-memory cache", error=str(e))
            self.redis_client = None
    
    async def _get_cache_key(self, metric_type: str) -> str:
        """Generate cache key for metric"""
        return f"metric:{metric_type}:value"
    
    async def _get_cached_value(self, metric_type: str) -> Optional[float]:
        """Get cached metric value"""
        if not self.redis_client or not self.redis_client.is_available:
            return None
        
        try:
            cache_key = await self._get_cache_key(metric_type)
            cached_data = await self.redis_client.get(cache_key)
            
            if cached_data:
                # RedisCacheService already deserializes JSON
                if isinstance(cached_data, dict):
                    data = cached_data
                else:
                    data = json.loads(cached_data) if isinstance(cached_data, str) else cached_data
                
                # Check if cache is still valid
                cached_time = datetime.fromisoformat(data['cached_at'])
                if (datetime.now(timezone.utc) - cached_time).total_seconds() < self.cache_ttl:
                    logger.debug("Cache hit for metric", metric_type=metric_type)
                    return data['value']
            
            return None
        except Exception as e:
            logger.warning("Cache retrieval failed", metric_type=metric_type, error=str(e))
            return None
    
    def _calculate_trend_direction(self, percentage_change: float, threshold: float = 0.1) -> str:
        """Calculate trend direction based on percentage change and threshold"""
        if percentage_change > threshold:
            return "up"
        elif percentage_change < -threshold:
            return "down"
        else:
            return "stable"
    
    def _cap_trend_percentage(self, trend_percentage: float, current_count: float, previous_count: float, metric_name: str) -> float:
        """Cap extreme trend percentages to reasonable values"""
        if abs(trend_percentage) > 200:
            # Rate limit warnings to once per hour per metric to prevent log spam
            warning_key = f"extreme_trend_{metric_name}"
            current_time = time.time()
            last_logged = self._last_warning_logged.get(warning_key, 0)
            
            if current_time - last_logged > 3600:  # 1 hour = 3600 seconds
                logger.warning("Capping extreme trend percentage",
                           metric_name=metric_name,
                           current_count=current_count,
                           previous_count=previous_count,
                           calculated_percentage=trend_percentage)
                self._last_warning_logged[warning_key] = current_time
            else:
                # Use debug level for subsequent occurrences
                logger.debug("Capping extreme trend percentage (rate limited)",
                           metric_name=metric_name,
                           calculated_percentage=trend_percentage)
            
            # For small changes, cap at 100%
            if abs(current_count - previous_count) <= 2:
                trend_percentage = min(abs(trend_percentage), 100.0) * (1 if trend_percentage > 0 else -1)
            else:
                trend_percentage = min(abs(trend_percentage), 200.0) * (1 if trend_percentage > 0 else -1)
        
        return trend_percentage

    async def _cache_value(self, metric_type: str, value: float) -> None:
        """Cache metric value"""
        if not self.redis_client or not self.redis_client.is_available:
            return
        
        try:
            cache_key = await self._get_cache_key(metric_type)
            cache_data = {
                'value': value,
                'cached_at': datetime.now(timezone.utc).isoformat()
            }
            
            await self.redis_client.set(
                cache_key, 
                cache_data,
                self.cache_ttl
            )
            
            logger.debug("Cached metric value", metric_type=metric_type, value=value)
        except Exception as e:
            logger.warning("Cache storage failed", metric_type=metric_type, error=str(e))
    
    async def _get_all_transactions(self) -> List[Dict[str, Any]]:
        """Get all transactions for metric calculations"""
        try:
            # Use aggregation pipeline for better performance
            pipeline = [
                {
                    "$project": {
                        "status": 1,
                        "pawn_date": 1,
                        "created_at": 1,
                        "maturity_date": 1,
                        "loan_amount": 1
                    }
                }
            ]
            
            transactions = await PawnTransaction.aggregate(pipeline).to_list()
            return transactions
        except Exception as e:
            logger.error("Failed to fetch transactions", error=str(e))
            return []
    
    async def _get_todays_payments(self) -> List[Dict[str, Any]]:
        """Get today's payments for collection calculation"""
        try:
            # Calculate today's date range in UTC
            now = datetime.now(timezone.utc)
            start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = start_of_day + timedelta(days=1)
            
            # Query payments from today
            pipeline = [
                {
                    "$match": {
                        "payment_date": {
                            "$gte": start_of_day,
                            "$lt": end_of_day
                        }
                    }
                },
                {
                    "$project": {
                        "payment_amount": 1,
                        "payment_date": 1
                    }
                }
            ]
            
            payments = await Payment.aggregate(pipeline).to_list()
            return payments
        except Exception as e:
            logger.error("Failed to fetch today's payments", error=str(e))
            return []
    
    async def calculate_active_loans(self) -> float:
        """Calculate number of active loans"""
        # Check cache first
        cached_value = await self._get_cached_value("active_loans")
        if cached_value is not None:
            return cached_value
        
        start_time = time.time()
        
        try:
            # Count transactions with active status
            count = await PawnTransaction.find(
                PawnTransaction.status == "active"
            ).count()
            
            calculation_time = (time.time() - start_time) * 1000
            logger.info("Calculated active loans", count=count, duration_ms=calculation_time)
            
            # Cache the result
            await self._cache_value("active_loans", float(count))
            
            return float(count)
        except Exception as e:
            logger.error("Failed to calculate active loans", error=str(e))
            return 0.0
    
    async def _get_simple_active_loans_yesterday(self, timezone_header: Optional[str] = None) -> float:
        """Simple calculation for yesterday's active loans - just count what was active yesterday"""
        try:
            from app.core.timezone_utils import get_user_business_date, user_timezone_to_utc
            
            # Get yesterday's business date
            today = get_user_business_date(timezone_header)
            yesterday = today - timedelta(days=1)
            
            # Convert to UTC for database query
            yesterday_start_utc = user_timezone_to_utc(yesterday, timezone_header)
            yesterday_end_utc = yesterday_start_utc + timedelta(days=1)
            
            # Simple count: transactions that existed yesterday and weren't forfeited or redeemed by then
            count = await PawnTransaction.find({
                "pawn_date": {"$lt": yesterday_end_utc},  # Created before end of yesterday
                "$or": [
                    {"maturity_date": {"$gt": yesterday_start_utc}},  # Not yet matured yesterday
                    {"status": "active"}  # Or still active (covers edge cases)
                ],
                "status": {"$in": ["active", "overdue", "extended"]}  # Only active-type statuses
            }).count()
            
            return float(count)
        except Exception as e:
            logger.error("Failed to get simple yesterday active loans", error=str(e))
            return 0.0
    
    
    async def calculate_active_loans_trend(self, period: str = "daily", timezone_header: Optional[str] = None, existing_metric=None) -> Dict[str, Any]:
        """Calculate trend for active loans with meaningful time-based comparisons using business dates"""
        try:
            from app.core.timezone_utils import get_user_business_date
            
            # Get current active loans count with a direct database query (bypass cache for accuracy)
            current_count = await PawnTransaction.find(
                PawnTransaction.status == "active"
            ).count()
            current_count = float(current_count)
            
            # Calculate comparison date based on period using business dates
            current_business_date = get_user_business_date(timezone_header)
            
            if period == "daily":
                # Compare today's business date vs yesterday's business date
                compare_date = current_business_date - timedelta(days=1)
                period_label = "yesterday"
            elif period == "weekly":
                # Compare current business date vs same day last week
                compare_date = current_business_date - timedelta(days=7)
                period_label = "last week"
            elif period == "hourly":
                # For hourly, use current time instead of business date
                from app.core.timezone_utils import get_user_now
                current_time = get_user_now(timezone_header)
                compare_date = current_time - timedelta(hours=1)
                period_label = "last hour"
            else:
                # Default to daily business comparison
                compare_date = current_business_date - timedelta(days=1)
                period_label = "yesterday"
            
            # Get previous count using stored value or simple yesterday calculation
            from app.models.transaction_metrics import MetricType, TransactionMetrics
            
            # Use provided existing_metric if available, otherwise query database
            if existing_metric is None:
                existing_metric = await TransactionMetrics.find_one(
                    TransactionMetrics.metric_type == MetricType.ACTIVE_LOANS
                )
                logger.debug("Retrieved existing metric from database")
            else:
                logger.debug("Using provided existing_metric")
            
            if existing_metric:
                logger.debug("Using existing metric for trend calculation",
                           stored_current=existing_metric.current_value,
                           stored_previous=existing_metric.previous_value,
                           new_current=current_count)
            
            if existing_metric:
                # Check if the stored metric is recent (within last 5 minutes) to avoid stale comparisons
                # Ensure both datetimes are timezone-aware for comparison
                now_utc = datetime.now(timezone.utc)
                last_updated = existing_metric.last_updated
                if last_updated.tzinfo is None:
                    last_updated = last_updated.replace(tzinfo=timezone.utc)
                
                time_diff = now_utc - last_updated
                if time_diff.total_seconds() > 300:  # 5 minutes
                    logger.warning("Stored metric is stale, using yesterday baseline instead",
                                 stored_age_seconds=time_diff.total_seconds(),
                                 stored_value=existing_metric.current_value)
                    previous_count = await self._get_simple_active_loans_yesterday(timezone_header)
                    period_label = "yesterday"
                elif existing_metric.current_value != current_count:
                    # Value has changed - use the stored current value as previous
                    previous_count = existing_metric.current_value
                    period_label = "last update"
                    logger.info("Using stored metric current value as previous",
                               stored_current=existing_metric.current_value,
                               new_current=current_count)
                else:
                    # Value hasn't changed - but we should still check if the stored previous 
                    # makes sense. If stored previous is 0 and current is not, we might have
                    # missed an update cycle.
                    if existing_metric.previous_value == 0.0 and current_count > 0.0:
                        # This suggests we went from 0 to current count but missed recording it
                        previous_count = 0.0
                        period_label = "baseline"
                        logger.info("Detected transition from zero (missed update cycle)",
                                   stored_current=existing_metric.current_value,
                                   stored_previous=existing_metric.previous_value,
                                   current_count=current_count)
                    else:
                        # Normal case - use the stored previous value
                        previous_count = existing_metric.previous_value
                        period_label = "last update"
                        logger.info("Using stored metric previous value (no change in current)",
                                   stored_current=existing_metric.current_value,
                                   stored_previous=existing_metric.previous_value,
                                   current_count=current_count)
            else:
                # For first-time calculation, use yesterday baseline
                previous_count = await self._get_simple_active_loans_yesterday(timezone_header)
                period_label = "yesterday"
                logger.info("Using yesterday baseline for comparison (no existing metric)",
                           yesterday_count=previous_count,
                           current_count=current_count)
            
            # Debug the actual values being compared
            logger.info("Active loans trend calculation",
                       current_count=current_count,
                       previous_count=previous_count,
                       source="stored_metric" if existing_metric else "yesterday_baseline",
                       period_label=period_label,
                       both_zero=(current_count == 0 and previous_count == 0))
            
            # Calculate trend metrics with proper type conversion and logging
            current_count = float(current_count)
            previous_count = float(previous_count)
            
            logger.debug("Active loans trend calculation values",
                        current_count=current_count,
                        previous_count=previous_count,
                        current_type=type(current_count).__name__,
                        previous_type=type(previous_count).__name__)
            
            if previous_count == 0.0:
                if current_count > 0.0:
                    trend_direction = "up"
                    trend_percentage = 100.0
                    context_message = f"First active loans (was 0 {period_label})"
                    logger.info("ACTIVE LOANS TREND: 0 to positive - setting UP 100%", 
                               current=current_count, previous=previous_count)
                else:
                    # Both current and previous are 0
                    trend_direction = "stable"  
                    trend_percentage = 0.0
                    context_message = f"No active loans"
                    logger.info("ACTIVE LOANS TREND: both 0 - setting STABLE", 
                               current=current_count, previous=previous_count)
            else:
                percentage_change = ((current_count - previous_count) / previous_count) * 100
                count_difference = int(current_count - previous_count)
                
                # Determine trend direction with threshold matching frontend (0.1%)
                trend_direction = self._calculate_trend_direction(percentage_change)
                
                trend_percentage = abs(round(percentage_change, 1))
                
                # Generate business-friendly context message
                if count_difference == 0:
                    context_message = f"Same as {period_label} ({int(current_count)} loans)"
                elif count_difference > 0:
                    context_message = f"{count_difference} more than {period_label}"
                else:
                    context_message = f"{abs(count_difference)} fewer than {period_label}"
            
            # Determine if this change is typical (could be enhanced with historical analysis)
            is_typical = abs(trend_percentage) < 10  # Changes >10% are considered unusual
            
            # Final validation to prevent illogical results and ensure consistency
            # Note: Going FROM 0 to something is valid "up", only 0 CURRENT with "up" is illogical
            if current_count == 0.0 and previous_count == 0.0 and trend_direction == "up":
                logger.warning("Correcting illogical trend: 0 to 0 cannot trend up",
                             original_direction=trend_direction,
                             original_percentage=trend_percentage)
                trend_direction = "stable"
                trend_percentage = 0.0
                context_message = "No active loans"
            
            # Ensure trend percentage is reasonable (prevent extreme values from calculation errors)
            if trend_percentage > 200:  # Much lower cap - single loan changes shouldn't exceed 200%
                logger.error("EXTREME TREND PERCENTAGE DETECTED",
                           current_count=current_count,
                           previous_count=previous_count,
                           calculated_percentage=trend_percentage,
                           calculation_method=period_label,
                           count_difference=abs(current_count - previous_count))
                
                # For single transaction changes, cap at more reasonable values
                if abs(current_count - previous_count) <= 2:  # Small changes shouldn't be huge percentages
                    old_percentage = trend_percentage
                    trend_percentage = min(trend_percentage, 100.0)
                    logger.error("CAPPED SMALL CHANGE", 
                               old_percentage=old_percentage,
                               new_percentage=trend_percentage)
                else:
                    old_percentage = trend_percentage
                    trend_percentage = min(trend_percentage, 200.0)
                    logger.error("CAPPED LARGE CHANGE",
                               old_percentage=old_percentage, 
                               new_percentage=trend_percentage)
            
            trend_result = {
                "current_value": current_count,
                "previous_value": previous_count,
                "trend_direction": trend_direction,
                "trend_percentage": trend_percentage,
                "context_message": context_message,
                "period": period,
                "period_label": period_label,
                "is_typical": is_typical,
                "count_difference": int(current_count - previous_count)
            }
            
            logger.info("Calculated active loans trend using business dates",
                       period=period,
                       current_business_date=current_business_date.date().isoformat() if 'current_business_date' in locals() else None,
                       compare_business_date=compare_date.date().isoformat(),
                       current_count=current_count,
                       previous_count=previous_count,
                       trend_direction=trend_direction,
                       trend_percentage=trend_percentage,
                       context=context_message)
            
            return trend_result
            
        except Exception as e:
            logger.error("Failed to calculate active loans trend", 
                        period=period,
                        error=str(e))
            
            # Return safe default
            return {
                "current_value": current_count if 'current_count' in locals() else 0.0,
                "previous_value": 0.0,
                "trend_direction": "stable",
                "trend_percentage": 0.0,
                "context_message": "Trend calculation unavailable",
                "period": period,
                "period_label": period,
                "is_typical": True,
                "count_difference": 0
            }
    
    async def calculate_new_this_month(self) -> float:
        """Calculate number of new transactions this month"""
        cached_value = await self._get_cached_value("new_this_month")
        if cached_value is not None:
            return cached_value
        
        start_time = time.time()
        
        try:
            # Calculate start of current month
            now = datetime.now(timezone.utc)
            start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            # Count transactions created this month (prefer pawn_date, fallback to created_at)
            pipeline = [
                {
                    "$match": {
                        "$or": [
                            {"pawn_date": {"$gte": start_of_month}},
                            {
                                "pawn_date": {"$exists": False},
                                "created_at": {"$gte": start_of_month}
                            }
                        ]
                    }
                },
                {"$count": "total"}
            ]
            
            result = await PawnTransaction.aggregate(pipeline).to_list()
            count = result[0]["total"] if result else 0
            
            calculation_time = (time.time() - start_time) * 1000
            logger.info("Calculated new this month", count=count, duration_ms=calculation_time)
            
            await self._cache_value("new_this_month", float(count))
            return float(count)
        except Exception as e:
            logger.error("Failed to calculate new this month", error=str(e))
            return 0.0
    
    async def calculate_new_last_month(self, timezone_header: Optional[str] = None) -> float:
        """Calculate number of new transactions last month"""
        try:
            from app.core.timezone_utils import get_user_business_date, user_timezone_to_utc
            
            # Get current business date in user's timezone
            current_business_date = get_user_business_date(timezone_header)
            
            # Calculate last month's date range
            if current_business_date.month == 1:
                # January -> December of previous year
                last_month = current_business_date.replace(year=current_business_date.year - 1, month=12, day=1)
            else:
                # Any other month -> previous month
                last_month = current_business_date.replace(month=current_business_date.month - 1, day=1)
            
            # Calculate end of last month
            if last_month.month == 12:
                end_last_month = last_month.replace(year=last_month.year + 1, month=1, day=1)
            else:
                end_last_month = last_month.replace(month=last_month.month + 1, day=1)
            
            # Convert to UTC for database query
            start_last_month_utc = user_timezone_to_utc(last_month, timezone_header)
            end_last_month_utc = user_timezone_to_utc(end_last_month, timezone_header)
            
            # Count transactions created last month (prefer pawn_date, fallback to created_at)
            pipeline = [
                {
                    "$match": {
                        "$or": [
                            {
                                "pawn_date": {
                                    "$gte": start_last_month_utc,
                                    "$lt": end_last_month_utc
                                }
                            },
                            {
                                "pawn_date": {"$exists": False},
                                "created_at": {
                                    "$gte": start_last_month_utc,
                                    "$lt": end_last_month_utc
                                }
                            }
                        ]
                    }
                },
                {"$count": "total"}
            ]
            
            result = await PawnTransaction.aggregate(pipeline).to_list()
            count = result[0]["total"] if result else 0
            
            logger.info("Calculated new last month", 
                       last_month=last_month.strftime("%Y-%m"),
                       count=count)
            
            return float(count)
        except Exception as e:
            logger.error("Failed to calculate new last month", error=str(e))
            return 0.0
    
    async def calculate_new_this_month_trend(self, timezone_header: Optional[str] = None) -> Dict[str, Any]:
        """Calculate trend for new this month comparing with last month"""
        try:
            # Get current month's count
            current_count = await self.calculate_new_this_month()
            
            # Get last month's count
            previous_count = await self.calculate_new_last_month(timezone_header)
            
            # Debug the actual values being compared
            logger.info("New this month trend calculation",
                       current_count=current_count,
                       previous_count=previous_count)
            
            # Calculate trend metrics
            if previous_count == 0:
                if current_count > 0:
                    trend_direction = "up"
                    trend_percentage = 100.0
                    context_message = f"First transactions this month (was 0 last month)"
                else:
                    trend_direction = "stable"  
                    trend_percentage = 0.0
                    context_message = f"No transactions this month (same as last month)"
            else:
                percentage_change = ((current_count - previous_count) / previous_count) * 100
                count_difference = int(current_count - previous_count)
                
                # Determine trend direction with threshold matching frontend (0.1%)
                trend_direction = self._calculate_trend_direction(percentage_change)
                
                # Cap extreme percentages before rounding
                percentage_change = self._cap_trend_percentage(percentage_change, current_count, previous_count, "new_this_month")
                trend_percentage = round(percentage_change, 1)
                
                # Generate business-friendly context message
                if count_difference == 0:
                    context_message = f"Same as last month ({int(current_count)} transactions)"
                elif count_difference > 0:
                    context_message = f"{count_difference} more than last month"
                else:
                    context_message = f"{abs(count_difference)} fewer than last month"
            
            # Determine if this change is typical (could be enhanced with historical analysis)
            is_typical = abs(trend_percentage) < 20  # Changes >20% are considered unusual for monthly data
            
            trend_result = {
                "current_value": current_count,
                "previous_value": previous_count,
                "trend_direction": trend_direction,
                "trend_percentage": trend_percentage,
                "context_message": context_message,
                "period": "monthly",
                "period_label": "last month",
                "is_typical": is_typical,
                "count_difference": int(current_count - previous_count)
            }
            
            logger.info("Calculated new this month trend",
                       current_count=current_count,
                       previous_count=previous_count,
                       trend_direction=trend_direction,
                       trend_percentage=trend_percentage,
                       context=context_message)
            
            return trend_result
            
        except Exception as e:
            logger.error("Failed to calculate new this month trend", 
                        error=str(e))
            
            # Return safe default
            current_count = await self.calculate_new_this_month() if 'current_count' not in locals() else current_count
            return {
                "current_value": current_count,
                "previous_value": 0.0,
                "trend_direction": "stable",
                "trend_percentage": 0.0,
                "context_message": "Trend calculation unavailable",
                "period": "monthly",
                "period_label": "last month", 
                "is_typical": True,
                "count_difference": 0
            }
    
    async def calculate_overdue_loans(self) -> float:
        """Calculate number of overdue loans"""
        cached_value = await self._get_cached_value("overdue_loans")
        if cached_value is not None:
            return cached_value
        
        start_time = time.time()
        
        try:
            count = await PawnTransaction.find(
                PawnTransaction.status == "overdue"
            ).count()
            
            calculation_time = (time.time() - start_time) * 1000
            logger.info("Calculated overdue loans", count=count, duration_ms=calculation_time)
            
            await self._cache_value("overdue_loans", float(count))
            return float(count)
        except Exception as e:
            logger.error("Failed to calculate overdue loans", error=str(e))
            return 0.0
    
    async def calculate_overdue_loans_last_month_avg(self, timezone_header: Optional[str] = None) -> float:
        """Calculate average number of overdue loans from last month for trend comparison"""
        try:
            from app.core.timezone_utils import get_user_business_date, user_timezone_to_utc
            
            # Get current business date in user's timezone
            current_business_date = get_user_business_date(timezone_header)
            
            # Calculate last month's date range
            if current_business_date.month == 1:
                # January -> December of previous year
                last_month = current_business_date.replace(year=current_business_date.year - 1, month=12, day=1)
            else:
                # Any other month -> previous month
                last_month = current_business_date.replace(month=current_business_date.month - 1, day=1)
            
            # Calculate end of last month
            if last_month.month == 12:
                end_last_month = last_month.replace(year=last_month.year + 1, month=1, day=1)
            else:
                end_last_month = last_month.replace(month=last_month.month + 1, day=1)
            
            # Convert to UTC for database query
            start_last_month_utc = user_timezone_to_utc(last_month, timezone_header)
            end_last_month_utc = user_timezone_to_utc(end_last_month, timezone_header)
            
            # Simplified approach: Count loans that became overdue during last month
            # This matches the "new this month" pattern for consistency
            
            pipeline = [
                {
                    "$match": {
                        "$and": [
                            # Loan's maturity date was within last month (became overdue then)
                            {"maturity_date": {"$gte": start_last_month_utc, "$lt": end_last_month_utc}},
                            # Current status suggests it did become overdue (not immediately redeemed)
                            {"status": {"$in": ["overdue", "extended", "forfeited", "redeemed"]}}
                        ]
                    }
                },
                {"$count": "total"}
            ]
            
            result = await PawnTransaction.aggregate(pipeline).to_list()
            count = result[0]["total"] if result else 0
            
            # If no loans became overdue last month, provide a fallback
            # to ensure we can still show meaningful trend data
            if count == 0:
                # Alternative: check for any historical overdue loans as a baseline
                fallback_pipeline = [
                    {
                        "$match": {
                            "$and": [
                                # Any loan that was created before last month
                                {
                                    "$or": [
                                        {"pawn_date": {"$lt": start_last_month_utc}},
                                        {"created_at": {"$lt": start_last_month_utc}}
                                    ]
                                },
                                # And became overdue at some point (maturity before last month)
                                {"maturity_date": {"$lt": start_last_month_utc}},
                                # Check if it was likely overdue during last month
                                {"status": {"$in": ["overdue", "extended", "forfeited", "redeemed"]}}
                            ]
                        }
                    },
                    {"$count": "total"}
                ]
                
                fallback_result = await PawnTransaction.aggregate(fallback_pipeline).to_list()
                count = fallback_result[0]["total"] if fallback_result else 0
            
            # For simplicity, use the count as representative of last month's overdue level
            # In a more sophisticated system, we might sample multiple points during the month
            
            logger.debug("Overdue loans last month calculation", 
                       last_month=last_month.strftime("%Y-%m"),
                       start_last_month_utc=start_last_month_utc.isoformat(),
                       end_last_month_utc=end_last_month_utc.isoformat(),
                       count=count,
                       timezone=timezone_header)
            
            return float(count)
        except Exception as e:
            logger.error("Failed to calculate overdue loans last month average", error=str(e))
            return 0.0
    
    async def calculate_overdue_loans_trend(self, timezone_header: Optional[str] = None) -> Dict[str, Any]:
        """Calculate trend for overdue loans comparing current count with last month's level"""
        try:
            # Get current overdue count
            current_count = await self.calculate_overdue_loans()
            
            # Get last month's overdue level for comparison
            previous_count = await self.calculate_overdue_loans_last_month_avg(timezone_header)
            
            # Debug the actual values being compared
            logger.debug("Overdue loans trend calculation", 
                       current_count=current_count,
                       previous_count=previous_count,
                       has_timezone=timezone_header is not None,
                       timezone=timezone_header)
            
            # Calculate trend metrics
            if previous_count == 0:
                if current_count > 0:
                    trend_direction = "up"
                    trend_percentage = 100.0
                    context_message = f"{int(current_count)} overdue loans (none last month)"
                else:
                    trend_direction = "stable"  
                    trend_percentage = 0.0
                    context_message = f"No overdue loans (none last month either)"
            else:
                percentage_change = ((current_count - previous_count) / previous_count) * 100
                count_difference = int(current_count - previous_count)
                
                # Determine trend direction with threshold matching frontend (0.1%)
                trend_direction = self._calculate_trend_direction(percentage_change)
                
                # Cap extreme percentages before rounding
                percentage_change = self._cap_trend_percentage(percentage_change, current_count, previous_count, "trend_calculation")
                trend_percentage = round(percentage_change, 1)
                
                # Generate business-friendly context message
                if count_difference == 0:
                    context_message = f"Similar to last month ({int(current_count)} overdue)"
                elif count_difference > 0:
                    context_message = f"{count_difference} more than last month"
                else:
                    context_message = f"{abs(count_difference)} fewer than last month"
            
            # For overdue loans, increases are generally bad, decreases are good
            # Determine if this change is typical (20% threshold for monthly data)
            is_typical = abs(trend_percentage) < 20
            
            trend_result = {
                "current_value": current_count,
                "previous_value": previous_count,
                "trend_direction": trend_direction,
                "trend_percentage": trend_percentage,
                "context_message": context_message,
                "period": "monthly",
                "period_label": "last month",
                "is_typical": is_typical,
                "count_difference": int(current_count - previous_count)
            }
            
            logger.info("Calculated overdue loans trend",
                       current_count=current_count,
                       previous_count=previous_count,
                       trend_direction=trend_direction,
                       trend_percentage=trend_percentage,
                       context=context_message)
            
            return trend_result
            
        except Exception as e:
            logger.error("Failed to calculate overdue loans trend", 
                        error=str(e))
            
            # Return safe default
            current_count = await self.calculate_overdue_loans() if 'current_count' not in locals() else current_count
            return {
                "current_value": current_count,
                "previous_value": 0.0,
                "trend_direction": "stable",
                "trend_percentage": 0.0,
                "context_message": "Trend calculation unavailable",
                "period": "monthly",
                "period_label": "last month", 
                "is_typical": True,
                "count_difference": 0
            }
    
    async def calculate_maturity_this_week(self, timezone_header: Optional[str] = None) -> float:
        """Calculate number of loans maturing this week"""
        cached_value = await self._get_cached_value("maturity_this_week")
        if cached_value is not None:
            return cached_value
        
        start_time = time.time()
        
        try:
            from app.core.timezone_utils import get_user_business_date, user_timezone_to_utc
            
            # Calculate this week's date range in user's timezone
            business_date = get_user_business_date(timezone_header)
            start_of_week = business_date - timedelta(days=business_date.weekday())
            end_of_week = start_of_week + timedelta(days=7)
            
            # Convert to UTC for database query
            start_of_week_utc = user_timezone_to_utc(start_of_week, timezone_header)
            end_of_week_utc = user_timezone_to_utc(end_of_week, timezone_header)
            
            # Count transactions maturing this week with relevant statuses
            count = await PawnTransaction.find({
                "maturity_date": {"$gte": start_of_week_utc, "$lt": end_of_week_utc},
                "status": {"$in": ["active", "overdue", "extended"]}
            }).count()
            
            calculation_time = (time.time() - start_time) * 1000
            logger.info("Calculated maturity this week", count=count, duration_ms=calculation_time)
            
            await self._cache_value("maturity_this_week", float(count))
            return float(count)
        except Exception as e:
            logger.error("Failed to calculate maturity this week", error=str(e))
            return 0.0
    
    async def calculate_maturity_last_week(self, timezone_header: Optional[str] = None) -> float:
        """Calculate number of loans that matured last week for trend comparison"""
        try:
            from app.core.timezone_utils import get_user_business_date, user_timezone_to_utc
            
            # Calculate last week's date range in user's timezone
            business_date = get_user_business_date(timezone_header)
            current_week_start = business_date - timedelta(days=business_date.weekday())
            last_week_start = current_week_start - timedelta(days=7)
            last_week_end = current_week_start  # End of last week is start of current week
            
            # Convert to UTC for database query
            last_week_start_utc = user_timezone_to_utc(last_week_start, timezone_header)
            last_week_end_utc = user_timezone_to_utc(last_week_end, timezone_header)
            
            # Count transactions that matured last week
            count = await PawnTransaction.find({
                "maturity_date": {"$gte": last_week_start_utc, "$lt": last_week_end_utc},
                "status": {"$in": ["active", "overdue", "extended", "redeemed", "forfeited"]}
            }).count()
            
            logger.debug("Maturity last week calculation", 
                       last_week=last_week_start.strftime("%Y-%m-%d"),
                       start_utc=last_week_start_utc.isoformat(),
                       end_utc=last_week_end_utc.isoformat(),
                       count=count,
                       timezone=timezone_header)
            
            return float(count)
        except Exception as e:
            logger.error("Failed to calculate maturity last week", error=str(e))
            return 0.0
    
    async def calculate_maturity_this_week_trend(self, timezone_header: Optional[str] = None) -> Dict[str, Any]:
        """Calculate trend for maturity this week comparing current week with last week"""
        try:
            # Get current maturity this week count
            current_count = await self.calculate_maturity_this_week(timezone_header)
            
            # Get last week's maturity count for comparison
            previous_count = await self.calculate_maturity_last_week(timezone_header)
            
            # Debug the actual values being compared
            logger.debug("Maturity this week trend calculation", 
                       current_count=current_count,
                       previous_count=previous_count,
                       has_timezone=timezone_header is not None,
                       timezone=timezone_header)
            
            # Calculate trend metrics
            if previous_count == 0:
                if current_count > 0:
                    trend_direction = "up"
                    trend_percentage = 100.0
                    context_message = f"{int(current_count)} maturing this week (none last week)"
                else:
                    trend_direction = "stable"  
                    trend_percentage = 0.0
                    context_message = f"No loans maturing this week (none last week either)"
            else:
                percentage_change = ((current_count - previous_count) / previous_count) * 100
                count_difference = int(current_count - previous_count)
                
                # Determine trend direction with threshold matching frontend (0.1%)
                trend_direction = self._calculate_trend_direction(percentage_change)
                
                # Cap extreme percentages before rounding
                percentage_change = self._cap_trend_percentage(percentage_change, current_count, previous_count, "trend_calculation")
                trend_percentage = round(percentage_change, 1)
                
                # Generate business-friendly context message
                if count_difference == 0:
                    context_message = f"Similar to last week ({int(current_count)} maturing)"
                elif count_difference > 0:
                    context_message = f"{count_difference} more than last week"
                else:
                    context_message = f"{abs(count_difference)} fewer than last week"
            
            # For maturity, increases could indicate good business activity
            # Determine if this change is typical (30% threshold for weekly data)
            is_typical = abs(trend_percentage) < 30
            
            trend_result = {
                "current_value": current_count,
                "previous_value": previous_count,
                "trend_direction": trend_direction,
                "trend_percentage": trend_percentage,
                "context_message": context_message,
                "period": "weekly",
                "period_label": "last week",
                "is_typical": is_typical,
                "count_difference": int(current_count - previous_count)
            }
            
            logger.info("Calculated maturity this week trend",
                       current_count=current_count,
                       previous_count=previous_count,
                       trend_direction=trend_direction,
                       trend_percentage=trend_percentage,
                       context=context_message)
            
            return trend_result
            
        except Exception as e:
            logger.error("Failed to calculate maturity this week trend", 
                        error=str(e))
            
            # Return safe default
            current_count = await self.calculate_maturity_this_week(timezone_header) if 'current_count' not in locals() else current_count
            return {
                "current_value": current_count,
                "previous_value": 0.0,
                "trend_direction": "stable",
                "trend_percentage": 0.0,
                "context_message": "Trend calculation unavailable",
                "period": "weekly",
                "period_label": "last week", 
                "is_typical": True,
                "count_difference": 0
            }
    
    async def calculate_todays_collection(self, timezone_header: Optional[str] = None) -> float:
        """Calculate total collection today (redeem payments + extension fees)"""
        cached_value = await self._get_cached_value("todays_collection")
        if cached_value is not None:
            return cached_value
        
        start_time = time.time()
        
        try:
            # Calculate today's date range in user's timezone
            business_date = get_user_business_date(timezone_header)
            # Convert to UTC for database query (payments and extensions stored in UTC)
            from app.core.timezone_utils import user_timezone_to_utc
            start_of_day_utc = user_timezone_to_utc(business_date, timezone_header)
            end_of_day_utc = start_of_day_utc + timedelta(days=1)
            
            # Calculate payments from today (redeem payments)
            payment_pipeline = [
                {
                    "$match": {
                        "payment_date": {
                            "$gte": start_of_day_utc,
                            "$lt": end_of_day_utc
                        }
                    }
                },
                {
                    "$group": {
                        "_id": None,
                        "total": {"$sum": "$payment_amount"}
                    }
                }
            ]
            
            payment_result = await Payment.aggregate(payment_pipeline).to_list()
            payment_total = payment_result[0]["total"] if payment_result else 0.0
            
            # Calculate extension fees from today (only paid extensions)
            extension_pipeline = [
                {
                    "$match": {
                        "created_at": {
                            "$gte": start_of_day_utc,
                            "$lt": end_of_day_utc
                        },
                        "fee_paid": True,
                        "is_cancelled": False
                    }
                },
                {
                    "$group": {
                        "_id": None,
                        "total": {"$sum": "$total_extension_fee"}
                    }
                }
            ]
            
            extension_result = await Extension.aggregate(extension_pipeline).to_list()
            extension_total = extension_result[0]["total"] if extension_result else 0.0
            
            # Total collection = payments + extension fees
            total_collection = payment_total + extension_total
            
            calculation_time = (time.time() - start_time) * 1000
            logger.info("Calculated todays collection", 
                       payment_total=payment_total,
                       extension_total=extension_total,
                       total_collection=total_collection,
                       duration_ms=calculation_time)
            
            await self._cache_value("todays_collection", total_collection)
            return int(total_collection)
        except Exception as e:
            logger.error("Failed to calculate today's collection", error=str(e))
            return 0
    
    async def calculate_new_today(self, timezone_header: Optional[str] = None) -> float:
        """Calculate number of new transactions created today"""
        cached_value = await self._get_cached_value("new_today")
        if cached_value is not None:
            return cached_value
        
        start_time = time.time()
        
        try:
            # Calculate today's date range in user's timezone
            business_date = get_user_business_date(timezone_header)
            # Convert to UTC for database query
            from app.core.timezone_utils import user_timezone_to_utc
            start_of_day_utc = user_timezone_to_utc(business_date, timezone_header)
            end_of_day_utc = start_of_day_utc + timedelta(days=1)
            
            # Count new transactions created today
            pipeline = [
                {
                    "$match": {
                        "created_at": {
                            "$gte": start_of_day_utc,
                            "$lt": end_of_day_utc
                        }
                    }
                },
                {"$count": "total"}
            ]
            
            result = await PawnTransaction.aggregate(pipeline).to_list()
            count = result[0]["total"] if result else 0
            
            calculation_time = (time.time() - start_time) * 1000
            logger.info("Calculated new today", count=count, duration_ms=calculation_time)
            
            await self._cache_value("new_today", float(count))
            return float(count)
        except Exception as e:
            logger.error("Failed to calculate new today", error=str(e))
            return 0.0
    
    async def calculate_yesterdays_collection(self, timezone_header: Optional[str] = None) -> float:
        """Calculate total collection yesterday (redeem payments + extension fees)"""
        cached_value = await self._get_cached_value("yesterdays_collection")
        if cached_value is not None:
            return cached_value
        
        start_time = time.time()
        
        try:
            # Calculate yesterday's date range in user's timezone
            business_date = get_user_business_date(timezone_header)
            yesterday_date = business_date - timedelta(days=1)
            
            # Convert to UTC for database query (payments and extensions stored in UTC)
            from app.core.timezone_utils import user_timezone_to_utc
            start_of_yesterday_utc = user_timezone_to_utc(yesterday_date, timezone_header)
            end_of_yesterday_utc = start_of_yesterday_utc + timedelta(days=1)
            
            # Calculate payments from yesterday (redeem payments)
            payment_pipeline = [
                {
                    "$match": {
                        "payment_date": {
                            "$gte": start_of_yesterday_utc,
                            "$lt": end_of_yesterday_utc
                        }
                    }
                },
                {
                    "$group": {
                        "_id": None,
                        "total": {"$sum": "$payment_amount"}
                    }
                }
            ]
            
            payment_result = await Payment.aggregate(payment_pipeline).to_list()
            payment_total = payment_result[0]["total"] if payment_result else 0.0
            
            # Calculate extension fees from yesterday (only paid extensions)
            extension_pipeline = [
                {
                    "$match": {
                        "created_at": {
                            "$gte": start_of_yesterday_utc,
                            "$lt": end_of_yesterday_utc
                        },
                        "fee_paid": True,
                        "is_cancelled": False
                    }
                },
                {
                    "$group": {
                        "_id": None,
                        "total": {"$sum": "$total_extension_fee"}
                    }
                }
            ]
            
            extension_result = await Extension.aggregate(extension_pipeline).to_list()
            extension_total = extension_result[0]["total"] if extension_result else 0.0
            
            # Total collection = payments + extension fees
            total_collection = payment_total + extension_total
            
            calculation_time = (time.time() - start_time) * 1000
            logger.info("Calculated yesterdays collection", 
                       payment_total=payment_total,
                       extension_total=extension_total,
                       total_collection=total_collection,
                       duration_ms=calculation_time)
            
            await self._cache_value("yesterdays_collection", total_collection)
            return int(total_collection)
        except Exception as e:
            logger.error("Failed to calculate yesterday's collection", error=str(e))
            return 0
    
    async def calculate_yesterdays_new(self, timezone_header: Optional[str] = None) -> float:
        """Calculate number of new transactions created yesterday"""
        try:
            # Calculate yesterday's date range in user's timezone
            today_business_date = get_user_business_date(timezone_header)
            yesterday_business_date = today_business_date - timedelta(days=1)
            
            # Convert to UTC for database query
            from app.core.timezone_utils import user_timezone_to_utc
            start_of_day_utc = user_timezone_to_utc(yesterday_business_date, timezone_header)
            end_of_day_utc = start_of_day_utc + timedelta(days=1)
            
            # Count new transactions created yesterday
            pipeline = [
                {
                    "$match": {
                        "created_at": {
                            "$gte": start_of_day_utc,
                            "$lt": end_of_day_utc
                        }
                    }
                },
                {"$count": "total"}
            ]
            
            result = await PawnTransaction.aggregate(pipeline).to_list()
            count = result[0]["total"] if result else 0
            
            logger.info("Calculated yesterdays new", count=count)
            return float(count)
        except Exception as e:
            logger.error("Failed to calculate yesterday's new", error=str(e))
            return 0.0
    
    async def calculate_new_today_trend(self, timezone_header: Optional[str] = None) -> Dict[str, Any]:
        """Calculate trend for new today comparing with yesterday"""
        try:
            # Get today's and yesterday's counts
            todays_count = await self.calculate_new_today(timezone_header)
            yesterdays_count = await self.calculate_yesterdays_new(timezone_header)
            
            # Calculate trend metrics
            count_difference = todays_count - yesterdays_count
            
            if yesterdays_count == 0:
                if todays_count > 0:
                    trend_direction = "up"
                    trend_percentage = 100.0
                    context_message = f"First loans today ({int(todays_count)} vs 0 yesterday)"
                else:
                    trend_direction = "stable"
                    trend_percentage = 0.0
                    context_message = "No new loans today or yesterday"
            else:
                percentage_change = (count_difference / yesterdays_count) * 100
                
                # Determine trend direction with threshold matching frontend (0.1%)
                trend_direction = self._calculate_trend_direction(percentage_change)
                
                # Cap extreme percentages before rounding
                percentage_change = self._cap_trend_percentage(percentage_change, todays_count, yesterdays_count, "new_today_trend")
                trend_percentage = round(percentage_change, 1)
                
                # Generate business-friendly context message
                if count_difference == 0:
                    context_message = f"Same as yesterday ({int(todays_count)} loans)"
                elif count_difference > 0:
                    context_message = f"{int(count_difference)} more than yesterday"
                else:
                    context_message = f"{int(abs(count_difference))} fewer than yesterday"
            
            # Determine if this change is typical (daily new loans can be volatile)
            is_typical = abs(trend_percentage) < 75  # Changes >75% are considered unusual
            
            trend_result = {
                "current_value": todays_count,
                "previous_value": yesterdays_count,
                "trend_direction": trend_direction,
                "trend_percentage": trend_percentage,
                "context_message": context_message,
                "period": "daily",
                "period_label": "yesterday",
                "is_typical": is_typical,
                "count_difference": int(count_difference)
            }
            
            logger.info("Calculated new today trend",
                       todays_count=todays_count,
                       yesterdays_count=yesterdays_count,
                       trend_direction=trend_direction,
                       trend_percentage=trend_percentage,
                       context=context_message)
            
            return trend_result
            
        except Exception as e:
            logger.error("Failed to calculate new today trend", error=str(e))
            
            # Return safe default
            todays_count = await self.calculate_new_today(timezone_header) if 'todays_count' not in locals() else 0.0
            return {
                "current_value": todays_count,
                "previous_value": 0.0,
                "trend_direction": "stable",
                "trend_percentage": 0.0,
                "context_message": "Trend calculation unavailable",
                "period": "daily",
                "period_label": "yesterday",
                "is_typical": True,
                "count_difference": 0
            }
    
    async def calculate_todays_collection_trend(self, timezone_header: Optional[str] = None) -> Dict[str, Any]:
        """Calculate enhanced trend data for today's collection"""
        try:
            logger.info("Calculating today's collection trend with timezone awareness")
            
            # Get today's and yesterday's collection amounts
            todays_amount = await self.calculate_todays_collection(timezone_header)
            yesterdays_amount = await self.calculate_yesterdays_collection(timezone_header)
            
            # Calculate trend metrics
            count_difference = todays_amount - yesterdays_amount
            
            if yesterdays_amount == 0:
                if todays_amount > 0:
                    trend_direction = "up"
                    trend_percentage = 100.0
                    context_message = f"First collections today (${todays_amount:.0f} vs $0 yesterday)"
                else:
                    trend_direction = "stable"
                    trend_percentage = 0.0
                    context_message = "No collections today or yesterday"
            else:
                percentage_change = (count_difference / yesterdays_amount) * 100
                
                # Determine trend direction with threshold matching frontend (0.1%)
                trend_direction = self._calculate_trend_direction(percentage_change)
                
                # Cap extreme percentages before rounding
                percentage_change = self._cap_trend_percentage(percentage_change, todays_amount, yesterdays_amount, "todays_collection_trend")
                trend_percentage = round(percentage_change, 1)
                
                # Generate business-friendly context message with currency formatting
                if abs(count_difference) < 0.01:  # Less than 1 cent difference
                    context_message = f"Same as yesterday (${todays_amount:.0f})"
                elif count_difference > 0:
                    context_message = f"${count_difference:.0f} more than yesterday"
                else:
                    context_message = f"${abs(count_difference):.0f} less than yesterday"
            
            # Determine if this change is typical (daily collection changes can be more volatile than counts)
            is_typical = abs(trend_percentage) < 50  # Changes >50% are considered unusual for daily collections
            
            trend_result = {
                "current_value": todays_amount,
                "previous_value": yesterdays_amount,
                "trend_direction": trend_direction,
                "trend_percentage": trend_percentage,
                "context_message": context_message,
                "period": "daily",
                "period_label": "yesterday",
                "is_typical": is_typical,
                "count_difference": int(count_difference)  # Amount difference, not count
            }
            
            logger.info("Calculated today's collection trend",
                       todays_amount=todays_amount,
                       yesterdays_amount=yesterdays_amount,
                       trend_direction=trend_direction,
                       trend_percentage=trend_percentage,
                       context=context_message)
            
            return trend_result
            
        except Exception as e:
            logger.error("Failed to calculate today's collection trend", 
                        error=str(e))
            
            # Return safe default
            todays_amount = await self.calculate_todays_collection(timezone_header) if 'todays_amount' not in locals() else 0.0
            return {
                "current_value": todays_amount,
                "previous_value": 0.0,
                "trend_direction": "stable",
                "trend_percentage": 0.0,
                "context_message": "Trend calculation unavailable",
                "period": "daily",
                "period_label": "yesterday",
                "is_typical": True,
                "count_difference": 0
            }
    
    async def calculate_all_metrics(self, timezone_header: Optional[str] = None) -> Dict[str, float]:
        """Calculate all metrics concurrently"""
        logger.info("Starting calculation of all metrics")
        
        start_time = time.time()
        
        # Calculate all metrics concurrently for better performance
        results = await asyncio.gather(
            self.calculate_active_loans(),
            self.calculate_new_this_month(),
            self.calculate_new_today(timezone_header),
            self.calculate_overdue_loans(),
            self.calculate_maturity_this_week(timezone_header),
            self.calculate_todays_collection(timezone_header),
            self.calculate_yesterdays_collection(timezone_header),
            self.calculate_new_last_month(timezone_header),
            self.calculate_yesterdays_new(timezone_header),
            return_exceptions=True
        )
        
        total_time = (time.time() - start_time) * 1000
        
        # Handle any exceptions
        metrics = {}
        metric_names = ["active_loans", "new_this_month", "new_today", "overdue_loans", "maturity_this_week", "todays_collection", "yesterdays_collection", "new_last_month", "yesterdays_new"]
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Failed to calculate {metric_names[i]}", error=str(result))
                metrics[metric_names[i]] = 0.0
            else:
                metrics[metric_names[i]] = result
        
        logger.info("Completed all metric calculations", 
                   total_duration_ms=total_time, 
                   metrics=metrics)
        
        return metrics
    
    async def update_all_metrics(self, triggered_by: Optional[str] = None) -> List[TransactionMetrics]:
        """Calculate and update all metrics in database"""
        logger.info("Updating all metrics", triggered_by=triggered_by)
        
        start_time = time.time()
        
        # Calculate all current values
        current_values = await self.calculate_all_metrics()
        
        # Update each metric
        updated_metrics = []
        
        for metric_name, value in current_values.items():
            try:
                metric_type = MetricType(metric_name)
                calculation_time = (time.time() - start_time) * 1000
                
                metric = await TransactionMetrics.update_metric(
                    metric_type=metric_type,
                    new_value=value,
                    triggered_by=triggered_by,
                    calculation_duration_ms=calculation_time
                )
                
                updated_metrics.append(metric)
                
            except Exception as e:
                logger.error("Failed to update metric", 
                           metric=metric_name, 
                           value=value, 
                           error=str(e))
        
        total_time = (time.time() - start_time) * 1000
        logger.info("Updated all metrics", 
                   count=len(updated_metrics), 
                   total_duration_ms=total_time)
        
        return updated_metrics
    
    async def get_metric_by_type(self, metric_type: MetricType) -> Optional[TransactionMetrics]:
        """Get current metric value by type"""
        try:
            return await TransactionMetrics.find_one(
                TransactionMetrics.metric_type == metric_type
            )
        except Exception as e:
            logger.error("Failed to get metric", metric_type=metric_type, error=str(e))
            return None
    
    async def recalculate_specific_metric(self, metric_type: MetricType, 
                                        triggered_by: Optional[str] = None) -> Optional[TransactionMetrics]:
        """Recalculate and update a specific metric"""
        logger.info("Recalculating specific metric", metric_type=metric_type)
        
        start_time = time.time()
        
        try:
            # Clear cache for this metric
            if self.redis_client and self.redis_client.is_available:
                cache_key = await self._get_cache_key(metric_type.value)
                await self.redis_client.delete(cache_key)
            
            # Calculate new value based on metric type
            if metric_type == MetricType.ACTIVE_LOANS:
                new_value = await self.calculate_active_loans()
            elif metric_type == MetricType.NEW_THIS_MONTH:
                new_value = await self.calculate_new_this_month()
            elif metric_type == MetricType.NEW_TODAY:
                new_value = await self.calculate_new_today()
            elif metric_type == MetricType.OVERDUE_LOANS:
                new_value = await self.calculate_overdue_loans()
            elif metric_type == MetricType.MATURITY_THIS_WEEK:
                new_value = await self.calculate_maturity_this_week()
            elif metric_type == MetricType.TODAYS_COLLECTION:
                new_value = await self.calculate_todays_collection()
            else:
                logger.error("Unknown metric type", metric_type=metric_type)
                return None
            
            calculation_time = (time.time() - start_time) * 1000
            
            # Update the metric
            metric = await TransactionMetrics.update_metric(
                metric_type=metric_type,
                new_value=new_value,
                triggered_by=triggered_by,
                calculation_duration_ms=calculation_time
            )
            
            logger.info("Recalculated specific metric", 
                       metric_type=metric_type, 
                       new_value=new_value,
                       duration_ms=calculation_time)
            
            return metric
            
        except Exception as e:
            logger.error("Failed to recalculate metric", 
                        metric_type=metric_type, 
                        error=str(e))
            return None
    
    async def get_cache_statistics(self) -> Dict[str, Any]:
        """Get cache performance statistics"""
        if not self.redis_client or not self.redis_client.is_available:
            return {"cache_enabled": False}
        
        try:
            # Get cache service statistics
            cache_stats = self.redis_client.get_stats()
            stats = {
                "cache_enabled": True,
                "cache_hit_rate": cache_stats.get("hit_rate_percent", 0),
                "total_requests": cache_stats.get("total_requests", 0),
                "cache_hits": cache_stats.get("hits", 0),
                "cache_misses": cache_stats.get("misses", 0),
            }
            
            # Check cache status for each metric
            metrics_status = {}
            for metric_type in MetricType:
                cache_key = await self._get_cache_key(metric_type.value)
                cached_data = await self.redis_client.get(cache_key)
                
                if cached_data:
                    # RedisCacheService already deserializes
                    if isinstance(cached_data, dict):
                        data = cached_data
                    else:
                        data = json.loads(cached_data) if isinstance(cached_data, str) else cached_data
                    
                    cached_time = datetime.fromisoformat(data['cached_at'])
                    age_seconds = (datetime.now(timezone.utc) - cached_time).total_seconds()
                    
                    metrics_status[metric_type.value] = {
                        "cached": True,
                        "age_seconds": age_seconds,
                        "valid": age_seconds < self.cache_ttl
                    }
                else:
                    metrics_status[metric_type.value] = {"cached": False}
            
            stats["metrics_status"] = metrics_status
            return stats
            
        except Exception as e:
            logger.error("Failed to get cache statistics", error=str(e))
            return {"cache_enabled": False, "error": str(e)}