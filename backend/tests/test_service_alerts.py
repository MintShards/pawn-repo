"""
Test suite for Service Alert API endpoints
"""

import pytest
from httpx import AsyncClient
from fastapi import status
from datetime import datetime
from typing import Dict

from app.models.service_alert_model import AlertType, AlertPriority, AlertStatus
from app.models.customer_model import Customer
from app.models.user_model import User


class TestServiceAlertAPI:
    """Test class for Service Alert endpoints"""
    
    # Test data
    test_customer_phone = "1234567890"
    test_user_id = "69"
    
    @pytest.fixture
    async def test_customer(self):
        """Create a test customer"""
        customer = Customer(
            phone_number=self.test_customer_phone,
            first_name="Test",
            last_name="Customer",
            email="test@example.com",
            created_by=self.test_user_id
        )
        await customer.insert()
        yield customer
        await customer.delete()
    
    @pytest.fixture
    async def auth_headers(self, client: AsyncClient):
        """Get authentication headers for testing"""
        login_data = {
            "user_id": "69",
            "pin": "6969"
        }
        response = await client.post("/api/v1/auth/jwt/login", json=login_data)
        assert response.status_code == 200
        tokens = response.json()
        return {"Authorization": f"Bearer {tokens['access_token']}"}
    
    @pytest.mark.asyncio
    async def test_create_service_alert(self, client: AsyncClient, auth_headers: Dict, test_customer):
        """Test creating a new service alert"""
        alert_data = {
            "customer_phone": self.test_customer_phone,
            "alert_type": "hold_request",
            "priority": "high",
            "title": "Customer wants to hold item",
            "description": "Customer called and requested to hold gold ring for 3 days",
            "item_reference": "Gold Ring - 14K"
        }
        
        response = await client.post(
            "/api/v1/service-alert/",
            json=alert_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["customer_phone"] == self.test_customer_phone
        assert data["alert_type"] == "hold_request"
        assert data["priority"] == "high"
        assert data["status"] == "active"
        assert data["title"] == alert_data["title"]
        assert "id" in data
        assert "created_at" in data
        assert data["created_by"] == self.test_user_id
    
    @pytest.mark.asyncio
    async def test_create_alert_invalid_customer(self, client: AsyncClient, auth_headers: Dict):
        """Test creating alert for non-existent customer"""
        alert_data = {
            "customer_phone": "9999999999",
            "alert_type": "general_note",
            "priority": "low",
            "title": "Test alert",
            "description": "This should fail"
        }
        
        response = await client.post(
            "/api/v1/service-alert/",
            json=alert_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "not found" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_get_customer_alerts(self, client: AsyncClient, auth_headers: Dict, test_customer):
        """Test retrieving customer alerts"""
        # Create multiple alerts first
        alert_types = ["hold_request", "payment_arrangement", "extension_request"]
        created_alerts = []
        
        for alert_type in alert_types:
            alert_data = {
                "customer_phone": self.test_customer_phone,
                "alert_type": alert_type,
                "priority": "medium",
                "title": f"Test {alert_type}",
                "description": f"Testing {alert_type} functionality"
            }
            response = await client.post(
                "/api/v1/service-alert/",
                json=alert_data,
                headers=auth_headers
            )
            assert response.status_code == status.HTTP_201_CREATED
            created_alerts.append(response.json())
        
        # Get all alerts for customer
        response = await client.get(
            f"/api/v1/service-alert/customer/{self.test_customer_phone}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "alerts" in data
        assert len(data["alerts"]) >= len(alert_types)
        assert data["total"] >= len(alert_types)
        assert data["page"] == 1
        
        # Test with status filter
        response = await client.get(
            f"/api/v1/service-alert/customer/{self.test_customer_phone}?status=active",
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert all(alert["status"] == "active" for alert in data["alerts"])
    
    @pytest.mark.asyncio
    async def test_get_customer_alert_count(self, client: AsyncClient, auth_headers: Dict, test_customer):
        """Test getting alert count for badge display"""
        # Create alerts
        for i in range(3):
            alert_data = {
                "customer_phone": self.test_customer_phone,
                "alert_type": "general_note",
                "priority": "low",
                "title": f"Alert {i+1}",
                "description": f"Test alert number {i+1}"
            }
            response = await client.post(
                "/api/v1/service-alert/",
                json=alert_data,
                headers=auth_headers
            )
            assert response.status_code == status.HTTP_201_CREATED
        
        # Get count
        response = await client.get(
            f"/api/v1/service-alert/customer/{self.test_customer_phone}/count",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["customer_phone"] == self.test_customer_phone
        assert data["active_count"] >= 3
        assert data["total_count"] >= 3
        assert data["resolved_count"] >= 0
    
    @pytest.mark.asyncio
    async def test_resolve_single_alert(self, client: AsyncClient, auth_headers: Dict, test_customer):
        """Test resolving a single alert"""
        # Create an alert
        alert_data = {
            "customer_phone": self.test_customer_phone,
            "alert_type": "item_inquiry",
            "priority": "medium",
            "title": "Customer inquiry about watch",
            "description": "Customer called asking about their Rolex"
        }
        create_response = await client.post(
            "/api/v1/service-alert/",
            json=alert_data,
            headers=auth_headers
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        alert_id = create_response.json()["id"]
        
        # Resolve the alert
        resolve_data = {
            "resolution_notes": "Informed customer that watch is safe in vault"
        }
        response = await client.put(
            f"/api/v1/service-alert/{alert_id}/resolve",
            json=resolve_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "resolved"
        assert data["resolution_notes"] == resolve_data["resolution_notes"]
        assert data["resolved_by"] == self.test_user_id
        assert "resolved_at" in data
    
    @pytest.mark.asyncio
    async def test_resolve_all_customer_alerts(self, client: AsyncClient, auth_headers: Dict, test_customer):
        """Test bulk resolution of all customer alerts"""
        # Create multiple alerts
        for i in range(5):
            alert_data = {
                "customer_phone": self.test_customer_phone,
                "alert_type": "general_note",
                "priority": "low",
                "title": f"Bulk test alert {i+1}",
                "description": f"Alert to be bulk resolved {i+1}"
            }
            response = await client.post(
                "/api/v1/service-alert/",
                json=alert_data,
                headers=auth_headers
            )
            assert response.status_code == status.HTTP_201_CREATED
        
        # Resolve all alerts
        resolve_data = {
            "resolution_notes": "All alerts handled in phone conversation"
        }
        response = await client.put(
            f"/api/v1/service-alert/customer/{self.test_customer_phone}/resolve-all",
            json=resolve_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["resolved_count"] >= 5
        assert "successfully resolved" in data["message"].lower()
        
        # Verify all are resolved
        count_response = await client.get(
            f"/api/v1/service-alert/customer/{self.test_customer_phone}/count",
            headers=auth_headers
        )
        assert count_response.status_code == status.HTTP_200_OK
        assert count_response.json()["active_count"] == 0
    
    @pytest.mark.asyncio
    async def test_update_alert(self, client: AsyncClient, auth_headers: Dict, test_customer):
        """Test updating an existing alert"""
        # Create an alert
        alert_data = {
            "customer_phone": self.test_customer_phone,
            "alert_type": "payment_arrangement",
            "priority": "low",
            "title": "Payment discussion",
            "description": "Customer wants to discuss payment"
        }
        create_response = await client.post(
            "/api/v1/service-alert/",
            json=alert_data,
            headers=auth_headers
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        alert_id = create_response.json()["id"]
        
        # Update the alert
        update_data = {
            "priority": "high",
            "title": "URGENT: Payment discussion needed",
            "description": "Customer called multiple times - needs immediate attention"
        }
        response = await client.put(
            f"/api/v1/service-alert/{alert_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["priority"] == "high"
        assert data["title"] == update_data["title"]
        assert data["description"] == update_data["description"]
        assert data["updated_by"] == self.test_user_id
    
    @pytest.mark.asyncio
    async def test_delete_alert_admin_only(self, client: AsyncClient, auth_headers: Dict, test_customer):
        """Test that only admins can delete alerts"""
        # Create an alert
        alert_data = {
            "customer_phone": self.test_customer_phone,
            "alert_type": "general_note",
            "priority": "low",
            "title": "Test delete",
            "description": "Alert to be deleted"
        }
        create_response = await client.post(
            "/api/v1/service-alert/",
            json=alert_data,
            headers=auth_headers
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        alert_id = create_response.json()["id"]
        
        # Try to delete as admin (user 69 is admin in test data)
        response = await client.delete(
            f"/api/v1/service-alert/{alert_id}",
            headers=auth_headers
        )
        
        # Should succeed for admin
        assert response.status_code == status.HTTP_200_OK
        assert "deleted successfully" in response.json()["message"]
    
    @pytest.mark.asyncio
    async def test_invalid_alert_type(self, client: AsyncClient, auth_headers: Dict, test_customer):
        """Test creating alert with invalid type"""
        alert_data = {
            "customer_phone": self.test_customer_phone,
            "alert_type": "invalid_type",
            "priority": "medium",
            "title": "Invalid alert",
            "description": "This should fail validation"
        }
        
        response = await client.post(
            "/api/v1/service-alert/",
            json=alert_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    @pytest.mark.asyncio
    async def test_missing_required_fields(self, client: AsyncClient, auth_headers: Dict, test_customer):
        """Test creating alert with missing required fields"""
        # Missing title
        alert_data = {
            "customer_phone": self.test_customer_phone,
            "alert_type": "general_note",
            "priority": "low",
            "description": "Missing title field"
        }
        
        response = await client.post(
            "/api/v1/service-alert/",
            json=alert_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    @pytest.mark.asyncio
    async def test_unauthorized_access(self, client: AsyncClient, test_customer):
        """Test accessing endpoints without authentication"""
        response = await client.get(
            f"/api/v1/service-alert/customer/{self.test_customer_phone}/count"
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_concurrent_alert_operations(client: AsyncClient, auth_headers: Dict):
    """Test concurrent alert creation and resolution"""
    # This would test race conditions and concurrent access scenarios
    # Implementation depends on your specific concurrency requirements
    pass


@pytest.mark.asyncio 
async def test_alert_performance_metrics(client: AsyncClient, auth_headers: Dict):
    """Test API response times and performance"""
    import time
    
    # Create customer
    customer = Customer(
        phone_number="9876543210",
        first_name="Perf",
        last_name="Test",
        created_by="69"
    )
    await customer.insert()
    
    try:
        # Test alert creation performance
        start_time = time.time()
        alert_data = {
            "customer_phone": customer.phone_number,
            "alert_type": "general_note",
            "priority": "low",
            "title": "Performance test",
            "description": "Testing response time"
        }
        response = await client.post(
            "/api/v1/service-alert/",
            json=alert_data,
            headers=auth_headers
        )
        create_time = time.time() - start_time
        
        assert response.status_code == status.HTTP_201_CREATED
        assert create_time < 0.5  # Should complete in under 500ms
        
        # Test count retrieval performance
        start_time = time.time()
        response = await client.get(
            f"/api/v1/service-alert/customer/{customer.phone_number}/count",
            headers=auth_headers
        )
        count_time = time.time() - start_time
        
        assert response.status_code == status.HTTP_200_OK
        assert count_time < 0.2  # Should complete in under 200ms
        
    finally:
        await customer.delete()