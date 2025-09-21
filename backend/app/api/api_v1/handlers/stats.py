"""
REST API handlers for transaction statistics
"""

import time
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
import structlog
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.auth import get_current_user
from app.models.user_model import User
from app.models.transaction_metrics import TransactionMetrics, MetricType, TrendDirection
from app.services.metric_calculation_service import MetricCalculationService
from app.schemas.stats_schema import (
    AllMetricsResponse,
    MetricDetailResponse,
    TrendsResponse,
    StatsErrorResponse,
    PartialMetricsResponse,
    TrendPeriod,
    MetricCalculationRequest,
    MetricCalculationResponse,
    CacheStatsResponse,
    HealthCheckResponse,
    parse_metrics_list
)

# Configure logger
logger = structlog.get_logger(__name__)

# Create limiter for rate limiting with user-based key
def get_user_id_or_ip(request: Request):
    """Get user ID for authenticated users, fallback to IP"""
    try:
        # Try to get user from request state (set by auth middleware)
        user = getattr(request.state, 'user', None)
        if user and hasattr(user, 'user_id'):
            return f"user:{user.user_id}"
    except:
        pass
    # Fallback to IP-based limiting
    return f"ip:{get_remote_address(request)}"

limiter = Limiter(key_func=get_user_id_or_ip)

# Create router
router = APIRouter(prefix="/stats", tags=["statistics"])

# Initialize service
metric_service = MetricCalculationService()


async def _update_or_create_metric(
    metric_type: MetricType,
    calculated_value: float,
    trend_data: Dict[str, Any],
    existing_metric: Optional[TransactionMetrics],
    timezone_header: Optional[str]
) -> TransactionMetrics:
    """Helper function to update or create a metric with trend data"""
    if existing_metric:
        # Update with enhanced trend data
        existing_metric.update_value(
            calculated_value,
            f"api_request_timezone_{timezone_header or 'utc'}",
            trend_data
        )
        await existing_metric.save()
        return existing_metric
    else:
        # Create new metric with trend data
        metric = TransactionMetrics(
            metric_type=metric_type,
            current_value=calculated_value,
            previous_value=trend_data["previous_value"],
            trend_direction=TrendDirection(trend_data["trend_direction"]),
            trend_percentage=trend_data["trend_percentage"],
            context_message=trend_data["context_message"],
            trend_period=trend_data["period"],
            is_typical=trend_data["is_typical"],
            count_difference=trend_data["count_difference"]
        )
        metric.display_value = metric.format_display_value()
        metric.description = metric.get_description()
        await metric.save()
        return metric


@router.get("/metrics", 
           response_model=AllMetricsResponse,
           responses={
               206: {"model": PartialMetricsResponse, "description": "Partial Content - Some metrics failed"},
               500: {"model": StatsErrorResponse, "description": "Internal Server Error"}
           })
@limiter.limit("120/minute")  # Increased limit: 120 requests per minute per user (accounts for multiple tabs)
async def get_all_metrics(
    request: Request,
    metrics: Optional[str] = Query(None, description="Comma-separated list of metrics to include"),
    current_user: User = Depends(get_current_user)
):
    """
    Get current values for all or specified transaction metrics
    
    Returns real-time statistics for pawn shop operations including:
    - Active loans count
    - New transactions this month
    - Overdue loans count  
    - Loans maturing this week
    - Today's cash collection total
    
    Supports filtering via metrics query parameter.
    """
    start_time = time.time()
    
    try:
        # Check cache first
        cache_key = f"stats:all_metrics:{current_user.user_id}"
        if metric_service.redis_client:
            try:
                cached_data = await metric_service.redis_client.get(cache_key)
                if cached_data:
                    logger.info("Returned cached metrics", 
                               user_id=current_user.user_id,
                               response_time_ms=(time.time() - start_time) * 1000)
                    return JSONResponse(content=json.loads(cached_data))
            except Exception as e:
                logger.warning("Cache read failed", error=str(e))
        
        # Get timezone header for proper date calculations
        timezone_header = request.headers.get("X-Client-Timezone")
        
        # Parse requested metrics
        requested_metric_types = parse_metrics_list(metrics)
        
        if requested_metric_types:
            # Get specific metrics
            results = {}
            errors = []
            
            for metric_type in requested_metric_types:
                try:
                    metric = await metric_service.get_metric_by_type(metric_type)
                    if not metric:
                        # Recalculate if not found
                        metric = await metric_service.recalculate_specific_metric(metric_type)
                    
                    if metric:
                        results[metric_type.value] = MetricDetailResponse(**metric.to_dict())
                    else:
                        errors.append({
                            "metric": metric_type.value,
                            "error": "Failed to calculate metric"
                        })
                        
                except Exception as e:
                    logger.error("Failed to get specific metric", 
                               metric_type=metric_type, 
                               error=str(e))
                    errors.append({
                        "metric": metric_type.value,
                        "error": str(e)
                    })
            
            response_time = (time.time() - start_time) * 1000
            logger.info("Completed specific metrics request", 
                       requested_count=len(requested_metric_types),
                       successful_count=len(results),
                       error_count=len(errors),
                       response_time_ms=response_time)
            
            if errors and not results:
                # All metrics failed
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to calculate any requested metrics"
                )
            elif errors:
                # Partial success
                return JSONResponse(
                    status_code=status.HTTP_206_PARTIAL_CONTENT,
                    content=PartialMetricsResponse(
                        metrics=results,
                        errors=errors,
                        timestamp=datetime.now(timezone.utc)
                    ).model_dump()
                )
            else:
                # Full success
                return AllMetricsResponse(
                    metrics=results,
                    timestamp=datetime.now(timezone.utc)
                )
        
        else:
            # Calculate fresh metrics with timezone awareness
            calculated_metrics = await metric_service.calculate_all_metrics(timezone_header)
            
            
            # Update database metrics with calculated values
            results = {}
            for metric_name, calculated_value in calculated_metrics.items():
                try:
                    # Map metric names to MetricType enum
                    metric_type_map = {
                        "active_loans": MetricType.ACTIVE_LOANS,
                        "new_this_month": MetricType.NEW_THIS_MONTH,
                        "new_today": MetricType.NEW_TODAY,
                        "overdue_loans": MetricType.OVERDUE_LOANS,
                        "maturity_this_week": MetricType.MATURITY_THIS_WEEK,
                        "todays_collection": MetricType.TODAYS_COLLECTION
                    }
                    
                    if metric_name in metric_type_map:
                        metric_type = metric_type_map[metric_name]
                        
                        # Get existing metric first (without updating)
                        existing_metric = await TransactionMetrics.find_one(TransactionMetrics.metric_type == metric_type)
                        
                        # Handle metrics with enhanced trend calculations
                        if metric_name == "todays_collection":
                            # Calculate daily trend for today's collection
                            trend_data = await metric_service.calculate_todays_collection_trend(timezone_header)
                            metric = await _update_or_create_metric(
                                metric_type, calculated_value, trend_data, existing_metric, timezone_header
                            )
                        elif metric_name == "active_loans":
                                # Calculate daily trend for active loans
                                trend_data = await metric_service.calculate_active_loans_trend("daily", timezone_header, existing_metric)
                                metric = await _update_or_create_metric(
                                    metric_type, calculated_value, trend_data, existing_metric, timezone_header
                                )
                        elif metric_name == "new_this_month":
                                # Calculate monthly trend for new this month
                                trend_data = await metric_service.calculate_new_this_month_trend(timezone_header)
                                metric = await _update_or_create_metric(
                                    metric_type, calculated_value, trend_data, existing_metric, timezone_header
                                )
                        elif metric_name == "new_today":
                                # Calculate daily trend for new today
                                trend_data = await metric_service.calculate_new_today_trend(timezone_header)
                                metric = await _update_or_create_metric(
                                    metric_type, calculated_value, trend_data, existing_metric, timezone_header
                                )
                        elif metric_name == "overdue_loans":
                                # Calculate monthly trend for overdue loans
                                trend_data = await metric_service.calculate_overdue_loans_trend(timezone_header)
                                metric = await _update_or_create_metric(
                                    metric_type, calculated_value, trend_data, existing_metric, timezone_header
                                )
                        elif metric_name == "maturity_this_week":
                                # Calculate weekly trend for maturity this week
                                trend_data = await metric_service.calculate_maturity_this_week_trend(timezone_header)
                                metric = await _update_or_create_metric(
                                    metric_type, calculated_value, trend_data, existing_metric, timezone_header
                                )
                                
                        else:
                                # Handle other metrics normally
                                if existing_metric:
                                    # Compare with existing value and update if changed
                                    if existing_metric.current_value != calculated_value:
                                        existing_metric.update_value(calculated_value, f"api_request_timezone_{timezone_header or 'utc'}")
                                        await existing_metric.save()
                                    metric = existing_metric
                                else:
                                    # Create new metric with some initial previous value for trend
                                    metric = TransactionMetrics(
                                    metric_type=metric_type,
                                    current_value=calculated_value,
                                    previous_value=max(0, calculated_value - 1),  # Simulate some previous value for demo
                                )
                                metric.calculate_trend()
                                metric.display_value = metric.format_display_value()
                                metric.description = metric.get_description()
                                await metric.save()
                        
                        results[metric_name] = MetricDetailResponse(**metric.to_dict())
                    elif metric_name in ["yesterdays_collection", "new_last_month"]:
                        # Skip internal metrics - only used for trend calculations
                        continue
                        
                except Exception as e:
                    logger.error(f"Failed to update metric {metric_name}", error=str(e))
                    # Fallback to calculated value
                    results[metric_name] = MetricDetailResponse(
                        metric_type=metric_name,
                        value=calculated_value,
                        display_value=str(calculated_value)
                    )
            
            response_time = (time.time() - start_time) * 1000
            logger.info("Completed all metrics request", 
                       metric_count=len(results),
                       response_time_ms=response_time,
                       user_id=current_user.user_id,
                       cache_hit=False)
            
            response_data = AllMetricsResponse(
                metrics=results,
                timestamp=datetime.now(timezone.utc)
            )
            
            # Cache the response for 30 seconds
            if metric_service.redis_client:
                try:
                    await metric_service.redis_client.setex(
                        cache_key, 
                        30,  # 30 second cache
                        json.dumps(response_data.model_dump(), default=str)
                    )
                except Exception as e:
                    logger.warning("Cache write failed", error=str(e))
            
            return response_data
    
    except HTTPException:
        raise
    except Exception as e:
        response_time = (time.time() - start_time) * 1000
        logger.error("Failed to get metrics", 
                    user_id=current_user.user_id,
                    error=str(e),
                    response_time_ms=response_time)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while calculating metrics"
        )


@router.get("/metrics/{metric_type}",
           response_model=MetricDetailResponse,
           responses={
               404: {"model": StatsErrorResponse, "description": "Metric not found"},
               500: {"model": StatsErrorResponse, "description": "Internal Server Error"}
           })
async def get_specific_metric(
    metric_type: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get current value for a specific transaction metric
    
    Available metrics:
    - active_loans: Number of active loan transactions
    - new_this_month: New transactions created this month
    - overdue_loans: Transactions past their maturity date
    - maturity_this_week: Transactions maturing within this week
    - todays_collection: Total payments collected today
    """
    start_time = time.time()
    
    try:
        # Validate metric type
        try:
            metric_enum = MetricType(metric_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Metric type '{metric_type}' not found. Valid types: {[m.value for m in MetricType]}"
            )
        
        logger.info("Getting specific metric", 
                   user_id=current_user.user_id, 
                   metric_type=metric_type)
        
        # Get metric from database
        metric = await metric_service.get_metric_by_type(metric_enum)
        
        if not metric:
            # Try to calculate if not found
            metric = await metric_service.recalculate_specific_metric(metric_enum)
        
        if not metric:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Metric '{metric_type}' could not be calculated"
            )
        
        response_time = (time.time() - start_time) * 1000
        logger.info("Retrieved specific metric", 
                   metric_type=metric_type,
                   value=metric.current_value,
                   response_time_ms=response_time)
        
        return MetricDetailResponse(**metric.to_dict())
    
    except HTTPException:
        raise
    except Exception as e:
        response_time = (time.time() - start_time) * 1000
        logger.error("Failed to get specific metric", 
                    metric_type=metric_type,
                    user_id=current_user.user_id,
                    error=str(e),
                    response_time_ms=response_time)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate metric '{metric_type}'"
        )


@router.get("/trends",
           response_model=TrendsResponse,
           responses={
               400: {"model": StatsErrorResponse, "description": "Invalid parameters"},
               500: {"model": StatsErrorResponse, "description": "Internal Server Error"}
           })
async def get_trends(
    period: TrendPeriod = Query(TrendPeriod.DAILY, description="Time period for trend analysis"),
    metrics: Optional[str] = Query(None, description="Comma-separated list of metrics"),
    current_user: User = Depends(get_current_user)
):
    """
    Get historical trend data for transaction metrics
    
    Returns trend data points for the specified time period.
    Useful for displaying charts and historical analysis.
    
    Periods:
    - daily: Last 30 days of daily data points
    - weekly: Last 12 weeks of weekly data points  
    - monthly: Last 12 months of monthly data points
    """
    start_time = time.time()
    
    try:
        logger.info("Getting trends", 
                   user_id=current_user.user_id,
                   period=period,
                   requested_metrics=metrics)
        
        # Parse requested metrics
        requested_metric_types = parse_metrics_list(metrics)
        if not requested_metric_types:
            requested_metric_types = list(MetricType)
        
        # Calculate date range based on period
        end_date = datetime.now(timezone.utc)
        
        if period == TrendPeriod.DAILY:
            start_date = end_date - timedelta(days=30)
            date_format = "%Y-%m-%d"
        elif period == TrendPeriod.WEEKLY:
            start_date = end_date - timedelta(weeks=12)
            date_format = "%Y-W%U"  # Year-Week format
        else:  # MONTHLY
            start_date = end_date - timedelta(days=365)
            date_format = "%Y-%m"
        
        # For now, return mock trend data since we don't have historical storage
        # In a real implementation, you would query historical metrics data
        trends = {}
        
        for metric_type in requested_metric_types:
            # Get current metric for baseline
            current_metric = await metric_service.get_metric_by_type(metric_type)
            current_value = current_metric.current_value if current_metric else 0
            
            # Generate mock trend points (in real implementation, query historical data)
            trend_points = []
            
            if period == TrendPeriod.DAILY:
                for i in range(30):
                    date = end_date - timedelta(days=i)
                    # Mock data with some variation
                    variation = (i * 0.02) % 0.1 - 0.05  # Small random variation
                    value = max(0, current_value * (1 + variation))
                    
                    trend_points.append({
                        "date": date.replace(hour=0, minute=0, second=0, microsecond=0),
                        "value": round(value, 2)
                    })
            
            trend_points.reverse()  # Chronological order
            trends[metric_type.value] = trend_points
        
        response_time = (time.time() - start_time) * 1000
        logger.info("Generated trends data", 
                   period=period,
                   metric_count=len(trends),
                   response_time_ms=response_time)
        
        return TrendsResponse(
            period=period,
            trends=trends,
            timestamp=datetime.now(timezone.utc)
        )
    
    except Exception as e:
        response_time = (time.time() - start_time) * 1000
        logger.error("Failed to get trends", 
                    period=period,
                    user_id=current_user.user_id,
                    error=str(e),
                    response_time_ms=response_time)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate trends data"
        )


@router.post("/recalculate",
            response_model=MetricCalculationResponse,
            responses={
                500: {"model": StatsErrorResponse, "description": "Calculation failed"}
            })
async def recalculate_metrics(
    request: MetricCalculationRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Manually trigger metric recalculation
    
    Useful for:
    - Forcing cache refresh
    - Recalculating after data corrections
    - Testing metric calculations
    
    Admin-only endpoint for manual metric management.
    """
    # Check admin permissions
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required for manual recalculation"
        )
    
    start_time = time.time()
    
    try:
        logger.info("Manual metric recalculation requested", 
                   user_id=current_user.user_id,
                   metric_types=request.metric_types,
                   force_refresh=request.force_refresh)
        
        # Clear cache if requested
        cache_cleared = False
        if request.force_refresh and metric_service.redis_client:
            try:
                # Clear all metric caches
                for metric_type in MetricType:
                    cache_key = await metric_service._get_cache_key(metric_type.value)
                    await metric_service.redis_client.delete(cache_key)
                cache_cleared = True
                logger.info("Cleared metric caches")
            except Exception as e:
                logger.warning("Failed to clear cache", error=str(e))
        
        # Recalculate metrics
        if request.metric_types:
            # Recalculate specific metrics
            calculated_metrics = []
            
            for metric_type in request.metric_types:
                metric = await metric_service.recalculate_specific_metric(
                    metric_type, 
                    triggered_by=request.triggered_by or f"manual_recalc_by_{current_user.user_id}"
                )
                
                if metric:
                    calculated_metrics.append(MetricDetailResponse(**metric.to_dict()))
        else:
            # Recalculate all metrics
            all_metrics = await metric_service.update_all_metrics(
                triggered_by=request.triggered_by or f"manual_recalc_by_{current_user.user_id}"
            )
            
            calculated_metrics = [
                MetricDetailResponse(**metric.to_dict()) 
                for metric in all_metrics
            ]
        
        total_duration = (time.time() - start_time) * 1000
        
        logger.info("Completed manual recalculation", 
                   calculated_count=len(calculated_metrics),
                   total_duration_ms=total_duration,
                   cache_cleared=cache_cleared)
        
        return MetricCalculationResponse(
            calculated_metrics=calculated_metrics,
            total_duration_ms=total_duration,
            cache_cleared=cache_cleared,
            timestamp=datetime.now(timezone.utc)
        )
    
    except Exception as e:
        total_duration = (time.time() - start_time) * 1000
        logger.error("Manual recalculation failed", 
                    user_id=current_user.user_id,
                    error=str(e),
                    duration_ms=total_duration)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to recalculate metrics"
        )


@router.get("/cache",
           response_model=CacheStatsResponse)
async def get_cache_stats(current_user: User = Depends(get_current_user)):
    """
    Get cache performance statistics
    
    Shows cache hit rates, calculation times, and overall caching performance.
    Useful for monitoring and optimization.
    """
    try:
        cache_stats = await metric_service.get_cache_statistics()
        
        logger.info("Retrieved cache statistics", user_id=current_user.user_id)
        
        return CacheStatsResponse(**cache_stats)
    
    except Exception as e:
        logger.error("Failed to get cache statistics", 
                    user_id=current_user.user_id,
                    error=str(e))
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve cache statistics"
        )


@router.get("/active-loans/trend",
            responses={
                200: {"description": "Active loans trend data"},
                500: {"model": StatsErrorResponse, "description": "Failed to calculate trend"}
            })
async def get_active_loans_trend(
    request: Request,
    period: str = Query("daily", description="Trend period (daily, weekly, hourly)"),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed trend information for active loans
    
    Returns enhanced trend data including:
    - Current vs historical comparison
    - Business-friendly context message
    - Trend direction and percentage
    - Whether change is typical
    """
    try:
        timezone_header = request.headers.get("X-Client-Timezone")
        
        logger.info("Getting active loans trend", 
                   user_id=current_user.user_id, 
                   period=period,
                   timezone=timezone_header)
        
        # Calculate enhanced trend data
        trend_data = await metric_service.calculate_active_loans_trend(period, timezone_header)
        
        # Create response with enhanced information
        response_data = {
            "metric_type": "active_loans",
            "period": period,
            "current_value": trend_data["current_value"],
            "previous_value": trend_data["previous_value"],
            "trend_direction": trend_data["trend_direction"],
            "trend_percentage": trend_data["trend_percentage"],
            "context_message": trend_data["context_message"],
            "is_typical": trend_data["is_typical"],
            "count_difference": trend_data["count_difference"],
            "period_label": trend_data["period_label"],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        logger.info("Active loans trend calculated successfully",
                   current=trend_data["current_value"],
                   previous=trend_data["previous_value"], 
                   trend=trend_data["trend_direction"],
                   percentage=trend_data["trend_percentage"])
        
        return JSONResponse(content=response_data)
        
    except Exception as e:
        logger.error("Failed to get active loans trend", 
                    period=period,
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate active loans trend: {str(e)}"
        )


@router.post("/cache/invalidate",
            responses={
                200: {"description": "Cache cleared successfully"},
                500: {"model": StatsErrorResponse, "description": "Cache invalidation failed"}
            })
async def invalidate_cache(
    current_user: User = Depends(get_current_user)
):
    """
    Manually invalidate the stats cache
    
    Clears all cached metric values to force fresh calculation.
    Useful after transaction operations to ensure stats accuracy.
    
    Available to all authenticated users.
    """
    start_time = time.time()
    
    try:
        logger.info("Cache invalidation requested", user_id=current_user.user_id)
        
        cache_cleared = False
        if metric_service.redis_client and metric_service.redis_client.is_available:
            try:
                # Clear all metric caches
                for metric_type in MetricType:
                    cache_key = await metric_service._get_cache_key(metric_type.value)
                    await metric_service.redis_client.delete(cache_key)
                cache_cleared = True
                logger.info("Successfully cleared metric caches")
            except Exception as e:
                logger.warning("Failed to clear Redis cache", error=str(e))
        
        total_duration = (time.time() - start_time) * 1000
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "message": "Cache invalidated successfully",
                "cache_cleared": cache_cleared,
                "duration_ms": total_duration,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
    
    except Exception as e:
        total_duration = (time.time() - start_time) * 1000
        logger.error("Cache invalidation failed", 
                    user_id=current_user.user_id,
                    error=str(e),
                    duration_ms=total_duration)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to invalidate cache"
        )


@router.get("/health",
           response_model=HealthCheckResponse)
async def health_check():
    """
    Health check endpoint for stats service
    
    Verifies that all components are functioning properly:
    - Database connectivity
    - Cache availability  
    - Metric calculation performance
    """
    start_time = time.time()
    
    try:
        components = {}
        overall_status = "healthy"
        
        # Test database connectivity
        try:
            db_start = time.time()
            test_metrics = await TransactionMetrics.get_all_metrics()
            db_duration = (time.time() - db_start) * 1000
            
            components["database"] = {
                "status": "healthy",
                "response_time_ms": db_duration,
                "details": {"metrics_count": len(test_metrics)}
            }
        except Exception as e:
            components["database"] = {
                "status": "unhealthy",
                "error": str(e)
            }
            overall_status = "unhealthy"
        
        # Test cache availability
        try:
            cache_stats = await metric_service.get_cache_statistics()
            cache_status = "healthy" if cache_stats.get("cache_enabled") else "degraded"
            
            components["cache"] = {
                "status": cache_status,
                "details": cache_stats
            }
            
            if cache_status == "degraded" and overall_status == "healthy":
                overall_status = "degraded"
        except Exception as e:
            components["cache"] = {
                "status": "unhealthy",
                "error": str(e)
            }
            if overall_status == "healthy":
                overall_status = "degraded"
        
        # Test metric calculation performance
        try:
            calc_start = time.time()
            test_value = await metric_service.calculate_active_loans()
            calc_duration = (time.time() - calc_start) * 1000
            
            calc_status = "healthy" if calc_duration < 200 else "degraded"
            
            components["metric_calculation"] = {
                "status": calc_status,
                "response_time_ms": calc_duration,
                "details": {"test_value": test_value}
            }
            
            if calc_status == "degraded" and overall_status == "healthy":
                overall_status = "degraded"
        except Exception as e:
            components["metric_calculation"] = {
                "status": "unhealthy",
                "error": str(e)
            }
            overall_status = "unhealthy"
        
        
        total_duration = (time.time() - start_time) * 1000
        
        return HealthCheckResponse(
            status=overall_status,
            timestamp=datetime.now(timezone.utc),
            components=components
        )
    
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        
        return HealthCheckResponse(
            status="unhealthy",
            timestamp=datetime.now(timezone.utc),
            components={"error": {"status": "unhealthy", "error": str(e)}}
        )