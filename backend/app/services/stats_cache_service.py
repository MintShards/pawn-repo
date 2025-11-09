"""
Stats cache management service
Handles cache invalidation after transaction operations
"""

from typing import Optional, List
import structlog

from app.services.metric_calculation_service import MetricCalculationService
from app.models.transaction_metrics import MetricType

# Configure logger
logger = structlog.get_logger("stats_cache")


class StatsCacheService:
    """Service for managing stats cache invalidation"""
    
    def __init__(self):
        self.metric_service = MetricCalculationService()
    
    async def invalidate_all_metrics(self, triggered_by: Optional[str] = None) -> bool:
        """
        Invalidate all metric caches
        
        Args:
            triggered_by: Description of what triggered the invalidation
            
        Returns:
            bool: True if cache was cleared, False if no cache available
        """
        try:
            logger.info("Invalidating all metric caches", triggered_by=triggered_by)
            
            if not self.metric_service.redis_client or not self.metric_service.redis_client.is_available:
                logger.warning("No cache available for invalidation")
                return False
            
            # Clear all metric caches
            for metric_type in MetricType:
                cache_key = await self.metric_service._get_cache_key(metric_type.value)
                await self.metric_service.redis_client.delete(cache_key)
            
            logger.info("Successfully invalidated all metric caches", triggered_by=triggered_by)
            return True
            
        except Exception as e:
            logger.error("Failed to invalidate metric caches", 
                        triggered_by=triggered_by, 
                        error=str(e))
            return False
    
    async def invalidate_specific_metrics(self, metric_types: List[MetricType], 
                                        triggered_by: Optional[str] = None) -> bool:
        """
        Invalidate specific metric caches
        
        Args:
            metric_types: List of metric types to invalidate
            triggered_by: Description of what triggered the invalidation
            
        Returns:
            bool: True if cache was cleared, False if no cache available
        """
        try:
            logger.info("Invalidating specific metric caches", 
                       metric_types=[mt.value for mt in metric_types],
                       triggered_by=triggered_by)
            
            if not self.metric_service.redis_client or not self.metric_service.redis_client.is_available:
                logger.warning("No cache available for invalidation")
                return False
            
            # Clear specific metric caches
            for metric_type in metric_types:
                cache_key = await self.metric_service._get_cache_key(metric_type.value)
                await self.metric_service.redis_client.delete(cache_key)
            
            logger.info("Successfully invalidated specific metric caches",
                       metric_types=[mt.value for mt in metric_types], 
                       triggered_by=triggered_by)
            return True
            
        except Exception as e:
            logger.error("Failed to invalidate specific metric caches", 
                        metric_types=[mt.value for mt in metric_types],
                        triggered_by=triggered_by, 
                        error=str(e))
            return False
    
    async def invalidate_after_transaction_creation(self, transaction_id: str) -> None:
        """Invalidate relevant caches after transaction creation"""
        await self.invalidate_specific_metrics([
            MetricType.ACTIVE_LOANS,
            MetricType.NEW_THIS_MONTH
        ], triggered_by=f"transaction_creation:{transaction_id}")
    
    async def invalidate_after_transaction_status_change(self, transaction_id: str, 
                                                        old_status: str, new_status: str) -> None:
        """Invalidate relevant caches after transaction status change"""
        affected_metrics = []
        
        # Determine which metrics are affected by the status change
        if old_status in ['active', 'overdue', 'extended'] or new_status in ['active', 'overdue', 'extended']:
            affected_metrics.extend([
                MetricType.ACTIVE_LOANS,
                MetricType.OVERDUE_LOANS,
                MetricType.MATURITY_THIS_WEEK
            ])
        
        if affected_metrics:
            await self.invalidate_specific_metrics(
                affected_metrics,
                triggered_by=f"status_change:{transaction_id}:{old_status}→{new_status}"
            )
    
    async def invalidate_after_payment(self, transaction_id: str, payment_amount: float) -> None:
        """Invalidate relevant caches after payment processing"""
        await self.invalidate_specific_metrics([
            MetricType.TODAYS_COLLECTION,
            MetricType.ACTIVE_LOANS,  # Status might change if fully paid
            MetricType.OVERDUE_LOANS
        ], triggered_by=f"payment:{transaction_id}:${payment_amount}")
    
    async def invalidate_after_extension(self, transaction_id: str, extension_months: int) -> None:
        """Invalidate relevant caches after loan extension"""
        await self.invalidate_specific_metrics([
            MetricType.MATURITY_THIS_WEEK,
            MetricType.OVERDUE_LOANS,  # Extension might change overdue status
            MetricType.ACTIVE_LOANS
        ], triggered_by=f"extension:{transaction_id}:{extension_months}mo")
    
    async def invalidate_after_bulk_operations(self, operation_type: str,
                                             affected_count: int) -> None:
        """Invalidate all caches after bulk operations"""
        await self.invalidate_all_metrics(
            triggered_by=f"bulk_operation:{operation_type}:count_{affected_count}"
        )

    async def invalidate_after_service_alert_creation(self, customer_phone: str) -> None:
        """Invalidate service alerts cache after alert creation"""
        await self.invalidate_specific_metrics([
            MetricType.SERVICE_ALERTS
        ], triggered_by=f"alert_creation:{customer_phone}")

    async def invalidate_after_service_alert_resolution(self, customer_phone: str) -> None:
        """Invalidate service alerts cache after alert resolution"""
        await self.invalidate_specific_metrics([
            MetricType.SERVICE_ALERTS
        ], triggered_by=f"alert_resolution:{customer_phone}")

    async def invalidate_after_service_alert_update(self, customer_phone: str) -> None:
        """Invalidate service alerts cache after alert update"""
        await self.invalidate_specific_metrics([
            MetricType.SERVICE_ALERTS
        ], triggered_by=f"alert_update:{customer_phone}")


# Global instance
stats_cache_service = StatsCacheService()