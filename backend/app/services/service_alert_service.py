"""
Service Alert service layer for business logic.

This module handles all service alert-related business operations including
CRUD operations, customer alert management, and resolution tracking.
"""

from typing import Optional, List
from datetime import datetime

from beanie import PydanticObjectId

from app.models.service_alert_model import ServiceAlert, AlertStatus, AlertType
from app.models.customer_model import Customer
from app.models.pawn_transaction_model import PawnTransaction
from app.models.pawn_item_model import PawnItem
from app.core.redis_cache import BusinessCache
from app.schemas.service_alert_schema import (
    ServiceAlertCreate, ServiceAlertUpdate, ServiceAlertResolve,
    ServiceAlertResponse, ServiceAlertListResponse, ServiceAlertCountResponse,
    CustomerItemResponse
)
from app.core.exceptions import (
    ValidationError, NotFoundError
)


class ServiceAlertService:
    """Service class for service alert operations"""
    
    @staticmethod
    async def create_alert(
        alert_data: ServiceAlertCreate,
        created_by: str
    ) -> ServiceAlertResponse:
        """
        Create a new service alert.
        
        Args:
            alert_data: Service alert creation data
            created_by: User ID creating the alert
            
        Returns:
            Created service alert response
            
        Raises:
            ValidationError: If customer doesn't exist
        """
        # Verify customer exists
        customer = await Customer.find_one(Customer.phone_number == alert_data.customer_phone)
        if not customer:
            raise ValidationError(f"Customer with phone {alert_data.customer_phone} not found")
        
        # Create new service alert
        new_alert = ServiceAlert(
            customer_phone=alert_data.customer_phone,
            alert_type=alert_data.alert_type,
            description=alert_data.description,
            item_reference=alert_data.item_reference,
            created_by=created_by,
            updated_by=created_by
        )
        
        await new_alert.insert()

        # Invalidate customer stats cache since alert count changed
        await BusinessCache.invalidate_by_pattern("stats:customer:*")

        alert_dict = new_alert.model_dump()
        alert_dict['id'] = str(new_alert.id)
        return ServiceAlertResponse.model_validate(alert_dict)
    
    @staticmethod
    async def get_customer_alerts(
        customer_phone: str,
        status: Optional[AlertStatus] = None,
        page: int = 1,
        per_page: int = 50
    ) -> ServiceAlertListResponse:
        """
        Get alerts for a specific customer with pagination.
        
        Args:
            customer_phone: Customer phone number
            status: Optional status filter
            page: Page number (1-based)
            per_page: Items per page
            
        Returns:
            Paginated list of customer alerts
        """
        # Build query conditions for count
        if status:
            # Multiple conditions: customer phone and status
            count_query = ServiceAlert.find(
                ServiceAlert.customer_phone == customer_phone,
                ServiceAlert.status == status
            )
            alerts_query = ServiceAlert.find(
                ServiceAlert.customer_phone == customer_phone,
                ServiceAlert.status == status
            )
        else:
            # Single condition: customer phone only  
            count_query = ServiceAlert.find(
                ServiceAlert.customer_phone == customer_phone
            )
            alerts_query = ServiceAlert.find(
                ServiceAlert.customer_phone == customer_phone
            )
        
        # Get total count
        total = await count_query.count()
        
        # Calculate skip
        skip = (page - 1) * per_page
        
        # Get alerts with pagination
        alerts = await alerts_query.sort([("created_at", -1)]).skip(skip).limit(per_page).to_list()
        
        # Convert to response models
        alert_responses = []
        for alert in alerts:
            alert_dict = alert.model_dump()
            alert_dict['id'] = str(alert.id)
            alert_responses.append(ServiceAlertResponse.model_validate(alert_dict))
        
        return ServiceAlertListResponse(
            alerts=alert_responses,
            total=total,
            page=page,
            per_page=per_page,
            has_next=skip + len(alerts) < total,
            has_prev=page > 1
        )
    
    @staticmethod
    async def get_customer_alert_count(customer_phone: str) -> ServiceAlertCountResponse:
        """
        Get alert count for a customer.

        Args:
            customer_phone: Customer phone number

        Returns:
            Alert count response
        """
        # PERFORMANCE OPTIMIZATION: Use single aggregation instead of 2 separate count queries
        pipeline = [
            {"$match": {"customer_phone": customer_phone}},
            {
                "$facet": {
                    "active": [
                        {"$match": {"status": AlertStatus.ACTIVE.value}},
                        {"$count": "count"}
                    ],
                    "resolved": [
                        {"$match": {"status": AlertStatus.RESOLVED.value}},
                        {"$count": "count"}
                    ],
                    "total": [
                        {"$count": "count"}
                    ]
                }
            }
        ]

        result = await ServiceAlert.aggregate(pipeline).to_list()
        stats = result[0] if result else {}

        # Extract counts from aggregation result - safely handle empty lists
        active_list = stats.get("active", [])
        resolved_list = stats.get("resolved", [])
        total_list = stats.get("total", [])

        active_count = active_list[0].get("count", 0) if active_list else 0
        resolved_count = resolved_list[0].get("count", 0) if resolved_list else 0
        total_count = total_list[0].get("count", 0) if total_list else 0

        return ServiceAlertCountResponse(
            customer_phone=customer_phone,
            active_count=active_count,
            resolved_count=resolved_count,
            total_count=total_count
        )
    
    @staticmethod
    async def get_alert_by_id(alert_id: str) -> ServiceAlertResponse:
        """
        Get a specific alert by ID.
        
        Args:
            alert_id: Alert ID
            
        Returns:
            Service alert response
            
        Raises:
            NotFoundError: If alert not found
        """
        try:
            alert_oid = PydanticObjectId(alert_id)
        except Exception:
            raise ValidationError("Invalid alert ID format")
        
        alert = await ServiceAlert.get(alert_oid)
        if not alert:
            raise NotFoundError(f"Alert {alert_id} not found")
        
        alert_dict = alert.model_dump()
        alert_dict['id'] = str(alert.id)
        return ServiceAlertResponse.model_validate(alert_dict)
    
    @staticmethod
    async def update_alert(
        alert_id: str,
        alert_data: ServiceAlertUpdate,
        updated_by: str
    ) -> ServiceAlertResponse:
        """
        Update an existing service alert.
        
        Args:
            alert_id: Alert ID to update
            alert_data: Update data
            updated_by: User ID performing update
            
        Returns:
            Updated service alert response
            
        Raises:
            NotFoundError: If alert not found
        """
        try:
            alert_oid = PydanticObjectId(alert_id)
        except Exception:
            raise ValidationError("Invalid alert ID format")
        
        alert = await ServiceAlert.get(alert_oid)
        if not alert:
            raise NotFoundError(f"Alert {alert_id} not found")
        
        # Update fields if provided
        update_data = alert_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(alert, field, value)
        
        # Update audit fields
        alert.updated_by = updated_by
        alert.updated_at = datetime.utcnow()

        await alert.replace()

        # Invalidate customer stats cache if status was changed
        if 'status' in update_data:
            await BusinessCache.invalidate_by_pattern("stats:customer:*")

        alert_dict = alert.model_dump()
        alert_dict['id'] = str(alert.id)
        return ServiceAlertResponse.model_validate(alert_dict)
    
    @staticmethod
    async def resolve_alert(
        alert_id: str,
        resolve_data: ServiceAlertResolve,
        resolved_by: str
    ) -> ServiceAlertResponse:
        """
        Resolve a service alert.
        
        Args:
            alert_id: Alert ID to resolve
            resolve_data: Resolution data
            resolved_by: User ID resolving the alert
            
        Returns:
            Resolved service alert response
            
        Raises:
            NotFoundError: If alert not found
            ValidationError: If alert already resolved
        """
        try:
            alert_oid = PydanticObjectId(alert_id)
        except Exception:
            raise ValidationError("Invalid alert ID format")
        
        alert = await ServiceAlert.get(alert_oid)
        if not alert:
            raise NotFoundError(f"Alert {alert_id} not found")
        
        if alert.status == AlertStatus.RESOLVED:
            raise ValidationError("Alert is already resolved")
        
        # Resolve the alert
        alert.resolve(resolved_by, resolve_data.resolution_notes)
        alert.updated_by = resolved_by
        alert.updated_at = datetime.utcnow()

        await alert.replace()

        # Invalidate customer stats cache since alert count changed
        await BusinessCache.invalidate_by_pattern("stats:customer:*")

        alert_dict = alert.model_dump()
        alert_dict['id'] = str(alert.id)
        return ServiceAlertResponse.model_validate(alert_dict)
    
    @staticmethod
    async def resolve_all_customer_alerts(
        customer_phone: str,
        resolve_data: ServiceAlertResolve,
        resolved_by: str
    ) -> int:
        """
        Resolve all active alerts for a customer.
        
        Args:
            customer_phone: Customer phone number
            resolve_data: Resolution data
            resolved_by: User ID resolving alerts
            
        Returns:
            Number of alerts resolved
        """
        # Find all active alerts for customer
        active_alerts = await ServiceAlert.find(
            ServiceAlert.customer_phone == customer_phone,
            ServiceAlert.status == AlertStatus.ACTIVE
        ).to_list()
        
        resolved_count = 0
        for alert in active_alerts:
            alert.resolve(resolved_by, resolve_data.resolution_notes)
            alert.updated_by = resolved_by
            alert.updated_at = datetime.utcnow()
            await alert.replace()
            resolved_count += 1

        # Invalidate customer stats cache if any alerts were resolved
        if resolved_count > 0:
            await BusinessCache.invalidate_by_pattern("stats:customer:*")

        return resolved_count
    
    @staticmethod
    async def get_customer_items(customer_phone: str) -> List[CustomerItemResponse]:
        """
        Get customer's pawn items for alert item selection.
        
        Args:
            customer_phone: Customer phone number
            
        Returns:
            List of customer pawn items
        """
        # Find transactions for customer (all statuses for comprehensive view)
        transactions = await PawnTransaction.find(
            PawnTransaction.customer_id == customer_phone
        ).sort(-PawnTransaction.pawn_date).to_list()  # Most recent first
        
        transaction_items = []
        for transaction in transactions:
            # Find items for this transaction
            pawn_items = await PawnItem.find(
                PawnItem.transaction_id == transaction.transaction_id
            ).sort(PawnItem.item_number).to_list()
            
            if not pawn_items:
                continue  # Skip transactions with no items
            
            # Create a summary description of all items in the transaction
            item_descriptions = [item.description for item in pawn_items]
            if len(item_descriptions) == 1:
                combined_description = item_descriptions[0]
            elif len(item_descriptions) <= 3:
                combined_description = ", ".join(item_descriptions)
            else:
                combined_description = f"{', '.join(item_descriptions[:2])}, and {len(item_descriptions) - 2} more items"
            
            transaction_items.append(CustomerItemResponse(
                id=str(transaction.transaction_id),  # Use transaction ID as the identifier
                description=combined_description,
                status=transaction.status.value if hasattr(transaction.status, 'value') else str(transaction.status),
                transaction_id=transaction.formatted_id or f"PW{str(transaction.transaction_id)[:6].upper()}",
                loan_date=transaction.pawn_date,
                maturity_date=transaction.maturity_date
            ))
        
        return transaction_items
    
    @staticmethod
    async def delete_alert(alert_id: str) -> bool:
        """
        Delete a service alert.
        
        Args:
            alert_id: Alert ID to delete
            
        Returns:
            True if deleted successfully
            
        Raises:
            NotFoundError: If alert not found
        """
        try:
            alert_oid = PydanticObjectId(alert_id)
        except Exception:
            raise ValidationError("Invalid alert ID format")
        
        alert = await ServiceAlert.get(alert_oid)
        if not alert:
            raise NotFoundError(f"Alert {alert_id} not found")
        
        await alert.delete()
        return True
    
    @staticmethod
    async def get_unique_customer_alert_count() -> dict:
        """
        Get count of unique customers with active service alerts.
        
        Returns:
            Dictionary with unique customer count and total alert count
        """
        # Get all active alerts
        active_alerts = await ServiceAlert.find(
            ServiceAlert.status == AlertStatus.ACTIVE
        ).to_list()
        
        # Count unique customers
        unique_customers = set()
        for alert in active_alerts:
            unique_customers.add(alert.customer_phone)
        
        return {
            "unique_customer_count": len(unique_customers),
            "total_alert_count": len(active_alerts),
            "customers_with_alerts": list(unique_customers)
        }