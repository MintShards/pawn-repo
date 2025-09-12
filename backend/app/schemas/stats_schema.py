"""
Pydantic schemas for stats API endpoints
Request/response models for transaction statistics
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from enum import Enum

from pydantic import BaseModel, Field, ConfigDict

from app.models.transaction_metrics import MetricType, TrendDirection


class MetricDetailResponse(BaseModel):
    """Response schema for individual metric details"""
    
    model_config = ConfigDict(
        str_strip_whitespace=True,
        use_enum_values=True
    )
    
    metric_type: MetricType = Field(description="Type of metric")
    value: float = Field(ge=0, description="Current metric value")
    previous_value: float = Field(ge=0, description="Previous value for comparison")
    trend_direction: TrendDirection = Field(description="Trend direction (up, down, stable)")
    trend_percentage: float = Field(description="Percentage change from previous value")
    last_updated: datetime = Field(description="When this metric was last calculated")
    display_value: str = Field(description="Formatted value for display (e.g., '15.6K')")
    description: str = Field(description="Human-readable description of the metric")
    triggered_by: Optional[str] = Field(default=None, description="Transaction ID that triggered update")
    calculation_duration_ms: Optional[float] = Field(default=None, description="Calculation time in milliseconds")
    
    # Enhanced trend context fields
    context_message: Optional[str] = Field(default=None, description="Business-friendly description of the trend (e.g., '5 more than yesterday')")
    trend_period: Optional[str] = Field(default=None, description="Period used for trend comparison (daily, weekly, hourly)")
    is_typical: Optional[bool] = Field(default=None, description="Whether this trend change is within typical ranges")
    count_difference: Optional[int] = Field(default=None, description="Absolute difference in count from previous value")


class AllMetricsResponse(BaseModel):
    """Response schema for all metrics endpoint"""
    
    model_config = ConfigDict(use_enum_values=True)
    
    metrics: Dict[str, MetricDetailResponse] = Field(description="All stat card metrics")
    timestamp: datetime = Field(description="Response generation timestamp")


class TrendPoint(BaseModel):
    """Individual trend data point"""
    
    date: datetime = Field(description="Date of the data point")
    value: float = Field(ge=0, description="Metric value at this date")


class TrendPeriod(str, Enum):
    """Valid trend period options"""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class TrendsResponse(BaseModel):
    """Response schema for trends endpoint"""
    
    model_config = ConfigDict(use_enum_values=True)
    
    period: TrendPeriod = Field(description="Time period for trends")
    trends: Dict[str, List[TrendPoint]] = Field(description="Trend data for each metric")
    timestamp: datetime = Field(description="Response generation timestamp")


class MetricsQueryParams(BaseModel):
    """Query parameters for metrics filtering"""
    
    metrics: Optional[str] = Field(
        default=None,
        description="Comma-separated list of metrics to include",
        examples=["active_loans,overdue_loans"]
    )


class TrendsQueryParams(BaseModel):
    """Query parameters for trends endpoint"""
    
    period: Optional[TrendPeriod] = Field(
        default=TrendPeriod.DAILY,
        description="Time period for trend analysis"
    )
    
    metrics: Optional[str] = Field(
        default=None,
        description="Comma-separated list of metrics to include",
        examples=["active_loans,todays_collection"]
    )


class StatsErrorResponse(BaseModel):
    """Error response schema for stats endpoints"""
    
    detail: str = Field(description="Error description")
    error_code: Optional[str] = Field(default=None, description="Specific error code")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Error timestamp")


class PartialMetricsResponse(BaseModel):
    """Response schema when some metrics fail to calculate"""
    
    model_config = ConfigDict(use_enum_values=True)
    
    metrics: Dict[str, MetricDetailResponse] = Field(description="Successfully calculated metrics")
    errors: List[Dict[str, str]] = Field(description="Errors for failed metrics")
    timestamp: datetime = Field(description="Response generation timestamp")
    partial: bool = Field(default=True, description="Indicates partial response")


class WebSocketStatsResponse(BaseModel):
    """Response schema for WebSocket connection statistics"""
    
    manager_stats: Dict[str, Any] = Field(description="WebSocket manager statistics")
    database_stats: Dict[str, Any] = Field(description="Database connection statistics")
    cache_stats: Dict[str, Any] = Field(description="Cache performance statistics")


class MetricCalculationRequest(BaseModel):
    """Request schema for manual metric recalculation"""
    
    metric_types: Optional[List[MetricType]] = Field(
        default=None,
        description="Specific metrics to recalculate (all if not specified)"
    )
    
    force_refresh: bool = Field(
        default=False,
        description="Force cache refresh before calculation"
    )
    
    triggered_by: Optional[str] = Field(
        default=None,
        description="Identifier for what triggered this calculation"
    )


class MetricCalculationResponse(BaseModel):
    """Response schema for metric calculation requests"""
    
    model_config = ConfigDict(use_enum_values=True)
    
    calculated_metrics: List[MetricDetailResponse] = Field(description="Recalculated metrics")
    total_duration_ms: float = Field(description="Total calculation time")
    cache_cleared: bool = Field(description="Whether cache was cleared")
    timestamp: datetime = Field(description="Calculation timestamp")


class CacheStatsResponse(BaseModel):
    """Response schema for cache statistics"""
    
    cache_enabled: bool = Field(description="Whether caching is enabled")
    cache_hit_rate: Optional[float] = Field(default=None, description="Cache hit rate percentage")
    total_requests: Optional[int] = Field(default=None, description="Total cache requests")
    cache_hits: Optional[int] = Field(default=None, description="Successful cache hits")
    cache_misses: Optional[int] = Field(default=None, description="Cache misses")
    average_calculation_time_ms: Optional[float] = Field(default=None, description="Average calculation time")
    metrics_status: Dict[str, Dict[str, Any]] = Field(description="Per-metric cache status")


# Health check schemas
class HealthCheckResponse(BaseModel):
    """Health check response for stats service"""
    
    status: str = Field(description="Service status (healthy, degraded, unhealthy)")
    timestamp: datetime = Field(description="Health check timestamp")
    components: Dict[str, Dict[str, Any]] = Field(description="Component health status")
    
    class ComponentStatus(BaseModel):
        status: str = Field(description="Component status")
        response_time_ms: Optional[float] = Field(default=None, description="Response time")
        error: Optional[str] = Field(default=None, description="Error message if unhealthy")
        details: Optional[Dict[str, Any]] = Field(default=None, description="Additional details")


# Validation helpers
def parse_metrics_list(metrics_param: Optional[str]) -> Optional[List[MetricType]]:
    """Parse comma-separated metrics parameter into MetricType list"""
    if not metrics_param:
        return None
    
    metric_types = []
    for metric_name in metrics_param.split(','):
        metric_name = metric_name.strip()
        try:
            metric_type = MetricType(metric_name)
            metric_types.append(metric_type)
        except ValueError:
            # Invalid metric names are ignored
            pass
    
    return metric_types if metric_types else None


def validate_trend_period(period: str) -> TrendPeriod:
    """Validate and convert trend period string"""
    try:
        return TrendPeriod(period)
    except ValueError:
        raise ValueError(f"Invalid trend period: {period}. Valid options: {[p.value for p in TrendPeriod]}")


# Example responses for API documentation
EXAMPLE_METRIC_RESPONSE = {
    "metric_type": "active_loans",
    "value": 156,
    "previous_value": 155,
    "trend_direction": "up",
    "trend_percentage": 0.64,
    "last_updated": "2025-01-11T15:30:00Z",
    "display_value": "156",
    "description": "Number of active loan transactions",
    "triggered_by": "507f1f77bcf86cd799439011",
    "calculation_duration_ms": 45.2,
    "context_message": "1 more than yesterday",
    "trend_period": "daily",
    "is_typical": True,
    "count_difference": 1
}

EXAMPLE_ALL_METRICS_RESPONSE = {
    "metrics": {
        "active_loans": EXAMPLE_METRIC_RESPONSE,
        "new_this_month": {
            "metric_type": "new_this_month",
            "value": 23,
            "previous_value": 20,
            "trend_direction": "up",
            "trend_percentage": 15.0,
            "last_updated": "2025-01-11T15:30:00Z",
            "display_value": "23",
            "description": "New transactions created this month",
            "context_message": "3 more than last month",
            "trend_period": "monthly",
            "is_typical": True,
            "count_difference": 3
        }
    },
    "timestamp": "2025-01-11T15:30:00Z"
}

EXAMPLE_TRENDS_RESPONSE = {
    "period": "daily",
    "trends": {
        "active_loans": [
            {"date": "2025-01-10T00:00:00Z", "value": 155},
            {"date": "2025-01-11T00:00:00Z", "value": 156}
        ]
    },
    "timestamp": "2025-01-11T15:30:00Z"
}