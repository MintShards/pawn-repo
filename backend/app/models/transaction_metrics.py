"""
Transaction metrics model for real-time stat card data
Stores aggregated metrics with trend information
"""

from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from beanie import Document, Indexed
from pydantic import Field, ConfigDict


class MetricType(str, Enum):
    """Valid metric types for stat cards"""
    ACTIVE_LOANS = "active_loans"
    NEW_THIS_MONTH = "new_this_month"
    NEW_TODAY = "new_today"
    OVERDUE_LOANS = "overdue_loans"
    MATURITY_THIS_WEEK = "maturity_this_week"
    TODAYS_COLLECTION = "todays_collection"
    # New metrics
    THIS_MONTH_REVENUE = "this_month_revenue"
    NEW_CUSTOMERS_THIS_MONTH = "new_customers_this_month"
    WENT_OVERDUE_TODAY = "went_overdue_today"


class TrendDirection(str, Enum):
    """Trend direction indicators"""
    UP = "up"
    DOWN = "down"
    STABLE = "stable"


class TransactionMetrics(Document):
    """
    Aggregated transaction metrics for stat cards
    Stores current values with trend information
    """
    
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        use_enum_values=True
    )
    
    # Metric identification
    metric_type: MetricType = Field(
        description="Type of metric (active_loans, new_this_month, etc.)"
    )
    
    # Current values
    current_value: float = Field(
        ge=0,
        description="Current metric value"
    )
    
    previous_value: float = Field(
        ge=0,
        default=0,
        description="Previous value for trend calculation"
    )
    
    # Trend analysis
    trend_direction: TrendDirection = Field(
        default=TrendDirection.STABLE,
        description="Direction of trend (up, down, stable)"
    )
    
    trend_percentage: float = Field(
        default=0.0,
        description="Percentage change from previous value"
    )
    
    # Enhanced trend context
    context_message: Optional[str] = Field(
        default=None,
        description="Business-friendly description of the trend (e.g., '5 more than yesterday')"
    )
    
    trend_period: Optional[str] = Field(
        default="calculation",
        description="Period used for trend comparison (daily, weekly, hourly, calculation)"
    )
    
    is_typical: Optional[bool] = Field(
        default=True,
        description="Whether this trend change is within typical ranges"
    )
    
    count_difference: Optional[int] = Field(
        default=0,
        description="Absolute difference in count from previous value"
    )
    
    # Metadata
    last_updated: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="When this metric was last calculated"
    )
    
    triggered_by: Optional[str] = Field(
        default=None,
        description="Transaction ID that triggered this update"
    )
    
    calculation_duration_ms: Optional[float] = Field(
        default=None,
        description="Time taken to calculate this metric in milliseconds"
    )
    
    # Display formatting
    display_value: Optional[str] = Field(
        default=None,
        description="Formatted value for display (e.g., '15.6K')"
    )
    
    description: Optional[str] = Field(
        default=None,
        description="Human-readable description of this metric"
    )
    
    # Audit fields
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    
    class Settings:
        name = "transaction_metrics"
        indexes = [
            "metric_type",
            "last_updated",
            [("metric_type", 1), ("last_updated", -1)]
        ]
    
    def calculate_trend(self) -> None:
        """Calculate trend direction and percentage"""
        if self.previous_value == 0:
            if self.current_value > 0:
                self.trend_direction = TrendDirection.UP
                self.trend_percentage = 100.0
            else:
                self.trend_direction = TrendDirection.STABLE
                self.trend_percentage = 0.0
        else:
            percentage_change = ((self.current_value - self.previous_value) / self.previous_value) * 100
            
            if percentage_change > 0.1:  # Small threshold for "stable"
                self.trend_direction = TrendDirection.UP
            elif percentage_change < -0.1:
                self.trend_direction = TrendDirection.DOWN
            else:
                self.trend_direction = TrendDirection.STABLE
            
            # Cap extreme percentages using the same logic as in service for consistency
            if abs(percentage_change) > 200:
                if abs(self.current_value - self.previous_value) <= 2:
                    percentage_change = min(abs(percentage_change), 100.0) * (1 if percentage_change > 0 else -1)
                else:
                    percentage_change = min(abs(percentage_change), 200.0) * (1 if percentage_change > 0 else -1)
            
            # Use same rounding precision as service (1 decimal place) for consistency
            self.trend_percentage = round(percentage_change, 1)
    
    def format_display_value(self) -> str:
        """Format the current value for display"""
        value = self.current_value
        
        if self.metric_type == MetricType.TODAYS_COLLECTION:
            # Format as currency
            if value >= 1_000_000:
                return f"${value/1_000_000:.1f}M"
            elif value >= 10_000:
                return f"${value/1_000:.0f}K"
            elif value >= 1_000:
                return f"${value/1_000:.1f}K"
            else:
                return f"${value:.0f}"
        else:
            # Format as count
            if value >= 1_000_000:
                return f"{value/1_000_000:.1f}M"
            elif value >= 10_000:
                return f"{value/1_000:.0f}K"
            elif value >= 1_000:
                return f"{value/1_000:.1f}K"
            else:
                return f"{int(value)}"
    
    def get_description(self) -> str:
        """Get human-readable description for this metric"""
        descriptions = {
            MetricType.ACTIVE_LOANS: "Number of active loan transactions",
            MetricType.NEW_THIS_MONTH: "New transactions created this month",
            MetricType.NEW_TODAY: "New transactions created today",
            MetricType.OVERDUE_LOANS: "Transactions past their maturity date",
            MetricType.MATURITY_THIS_WEEK: "Transactions maturing within this week",
            MetricType.TODAYS_COLLECTION: "Total payments collected today"
        }
        return descriptions.get(self.metric_type, "Transaction metric")
    
    def update_value(self, new_value: float, triggered_by: Optional[str] = None, 
                    trend_data: Optional[dict] = None) -> None:
        """Update metric value and recalculate trends"""
        # Update enhanced trend data if provided (includes correct previous_value)
        if trend_data:
            # Use the calculated previous value from trend_data for accuracy
            self.previous_value = trend_data.get("previous_value", self.current_value)
            self.current_value = new_value
            self.trend_direction = TrendDirection(trend_data.get("trend_direction", "stable"))
            self.trend_percentage = trend_data.get("trend_percentage", 0.0)
            self.context_message = trend_data.get("context_message")
            self.trend_period = trend_data.get("period", "calculation")
            self.is_typical = trend_data.get("is_typical", True)
            self.count_difference = trend_data.get("count_difference", 0)
        else:
            # Default behavior: use current as previous, then recalculate basic trend
            self.previous_value = self.current_value
            self.current_value = new_value
            self.calculate_trend()
        
        self.triggered_by = triggered_by
        self.last_updated = datetime.now(timezone.utc)
        self.updated_at = self.last_updated
        
        # Update derived fields
        self.display_value = self.format_display_value()
        self.description = self.get_description()
    
    @classmethod
    async def get_or_create_metric(cls, metric_type: MetricType, initial_value: float = 0.0) -> "TransactionMetrics":
        """Get existing metric or create new one"""
        metric = await cls.find_one(cls.metric_type == metric_type)
        
        if not metric:
            metric = cls(
                metric_type=metric_type,
                current_value=initial_value,
                previous_value=0.0
            )
            metric.calculate_trend()
            metric.display_value = metric.format_display_value()
            metric.description = metric.get_description()
            await metric.save()
        
        return metric
    
    @classmethod
    async def get_all_metrics(cls) -> List["TransactionMetrics"]:
        """Get all current metrics"""
        metrics = {}
        
        # Ensure all metric types exist
        for metric_type in MetricType:
            metric = await cls.get_or_create_metric(metric_type)
            metrics[metric_type.value] = metric
        
        return list(metrics.values())
    
    @classmethod
    async def update_metric(cls, metric_type: MetricType, new_value: float, 
                           triggered_by: Optional[str] = None, 
                           calculation_duration_ms: Optional[float] = None) -> "TransactionMetrics":
        """Update or create a metric with new value"""
        metric = await cls.get_or_create_metric(metric_type)
        
        metric.update_value(new_value, triggered_by)
        if calculation_duration_ms is not None:
            metric.calculation_duration_ms = calculation_duration_ms
        
        await metric.save()
        return metric
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API responses"""
        return {
            "metric_type": self.metric_type,
            "value": self.current_value,
            "previous_value": self.previous_value,
            "trend_direction": self.trend_direction,
            "trend_percentage": self.trend_percentage,
            "context_message": self.context_message,
            "trend_period": self.trend_period,
            "is_typical": self.is_typical,
            "count_difference": self.count_difference,
            "last_updated": self.last_updated.isoformat(),
            "display_value": self.display_value,
            "description": self.description,
            "triggered_by": self.triggered_by,
            "calculation_duration_ms": self.calculation_duration_ms
        }