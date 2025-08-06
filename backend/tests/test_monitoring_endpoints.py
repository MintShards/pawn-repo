"""
Tests for monitoring and system health endpoints.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.unit
class TestMonitoringEndpoints:
    """Test monitoring and system health endpoints."""

    async def test_system_health_admin(self, async_client: AsyncClient, auth_headers_admin):
        """Test system health check as admin."""
        response = await async_client.get("/api/v1/monitoring/system-health", headers=auth_headers_admin)
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "timestamp" in data
        # Should contain either full metrics or fallback message
        assert "system" in data or "message" in data

    async def test_system_health_staff_forbidden(self, async_client: AsyncClient, auth_headers_staff):
        """Test system health check as staff (should be forbidden)."""
        response = await async_client.get("/api/v1/monitoring/system-health", headers=auth_headers_staff)
        
        assert response.status_code == 403

    async def test_system_health_unauthorized(self, async_client: AsyncClient):
        """Test system health check without authentication."""
        response = await async_client.get("/api/v1/monitoring/system-health")
        
        assert response.status_code == 401

    async def test_performance_metrics_admin(self, async_client: AsyncClient, auth_headers_admin):
        """Test performance metrics as admin."""
        response = await async_client.get("/api/v1/monitoring/performance-metrics", headers=auth_headers_admin)
        
        # Should either return metrics or indicate monitoring not configured
        assert response.status_code in [200, 503]
        
        if response.status_code == 200:
            data = response.json()
            assert "timestamp" in data
            assert "performance" in data or "thresholds" in data

    async def test_performance_metrics_staff_forbidden(self, async_client: AsyncClient, auth_headers_staff):
        """Test performance metrics as staff (should be forbidden)."""
        response = await async_client.get("/api/v1/monitoring/performance-metrics", headers=auth_headers_staff)
        
        assert response.status_code == 403

    async def test_business_metrics_admin(self, async_client: AsyncClient, auth_headers_admin):
        """Test business metrics as admin."""
        response = await async_client.get("/api/v1/monitoring/business-metrics", headers=auth_headers_admin)
        
        # Should either return metrics or indicate monitoring not configured
        assert response.status_code in [200, 503]
        
        if response.status_code == 200:
            data = response.json()
            assert "timestamp" in data
            assert "business_metrics" in data

    async def test_business_metrics_staff_forbidden(self, async_client: AsyncClient, auth_headers_staff):
        """Test business metrics as staff (should be forbidden)."""
        response = await async_client.get("/api/v1/monitoring/business-metrics", headers=auth_headers_staff)
        
        assert response.status_code == 403

    async def test_security_events_admin(self, async_client: AsyncClient, auth_headers_admin):
        """Test security events summary as admin."""
        response = await async_client.get("/api/v1/monitoring/security-events", headers=auth_headers_admin)
        
        # Should either return events or indicate monitoring not configured
        assert response.status_code in [200, 503]
        
        if response.status_code == 200:
            data = response.json()
            assert "timestamp" in data
            assert "recent_events_count" in data
            assert "events_by_type" in data
            assert "events_by_severity" in data
            assert "latest_events" in data

    async def test_security_events_staff_forbidden(self, async_client: AsyncClient, auth_headers_staff):
        """Test security events summary as staff (should be forbidden)."""
        response = await async_client.get("/api/v1/monitoring/security-events", headers=auth_headers_staff)
        
        assert response.status_code == 403

    async def test_alerts_status_admin(self, async_client: AsyncClient, auth_headers_admin):
        """Test alerts status as admin."""
        response = await async_client.get("/api/v1/monitoring/alerts-status", headers=auth_headers_admin)
        
        assert response.status_code == 200
        data = response.json()
        assert "timestamp" in data
        assert "system_status" in data
        assert "active_alerts_count" in data
        assert "alerts" in data

    async def test_alerts_status_staff_forbidden(self, async_client: AsyncClient, auth_headers_staff):
        """Test alerts status as staff (should be forbidden)."""
        response = await async_client.get("/api/v1/monitoring/alerts-status", headers=auth_headers_staff)
        
        assert response.status_code == 403

    async def test_metrics_endpoint_prometheus(self, async_client: AsyncClient):
        """Test Prometheus metrics endpoint."""
        response = await async_client.get("/metrics")
        
        # Should either return metrics or not be configured
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            # Prometheus metrics should be in text format
            assert response.headers.get("content-type") is not None

    async def test_monitoring_endpoints_with_invalid_token(self, async_client: AsyncClient, invalid_auth_headers):
        """Test monitoring endpoints with invalid authentication."""
        endpoints = [
            "/api/v1/monitoring/system-health",
            "/api/v1/monitoring/performance-metrics",
            "/api/v1/monitoring/business-metrics", 
            "/api/v1/monitoring/security-events",
            "/api/v1/monitoring/alerts-status"
        ]
        
        for endpoint in endpoints:
            response = await async_client.get(endpoint, headers=invalid_auth_headers)
            assert response.status_code == 401

    async def test_monitoring_response_times(self, async_client: AsyncClient, auth_headers_admin):
        """Test that monitoring endpoints respond within reasonable time."""
        import time
        
        start_time = time.time()
        response = await async_client.get("/api/v1/monitoring/system-health", headers=auth_headers_admin)
        end_time = time.time()
        
        response_time = end_time - start_time
        
        # Should respond within 5 seconds (even with fallback)
        assert response_time < 5.0
        assert response.status_code in [200, 503]

    async def test_monitoring_error_handling(self, async_client: AsyncClient, auth_headers_admin):
        """Test error handling in monitoring endpoints."""
        # These tests verify that endpoints handle missing monitoring gracefully
        
        # System health should always return something
        response = await async_client.get("/api/v1/monitoring/system-health", headers=auth_headers_admin)
        assert response.status_code == 200
        
        # Performance metrics might not be configured
        response = await async_client.get("/api/v1/monitoring/performance-metrics", headers=auth_headers_admin)
        assert response.status_code in [200, 503]
        
        if response.status_code == 503:
            data = response.json()
            assert "detail" in data
            assert "monitoring not configured" in data["detail"].lower()

    async def test_alerts_thresholds(self, async_client: AsyncClient, auth_headers_admin):
        """Test that alert thresholds are properly configured."""
        response = await async_client.get("/api/v1/monitoring/performance-metrics", headers=auth_headers_admin)
        
        if response.status_code == 200:
            data = response.json()
            if "thresholds" in data:
                thresholds = data["thresholds"]
                assert "slow_request_ms" in thresholds
                assert "critical_request_ms" in thresholds
                assert "high_memory_mb" in thresholds
                assert "critical_memory_mb" in thresholds
                assert "high_cpu_percent" in thresholds
                assert "critical_cpu_percent" in thresholds
                
                # Verify threshold values are reasonable
                assert thresholds["slow_request_ms"] > 0
                assert thresholds["critical_request_ms"] > thresholds["slow_request_ms"]
                assert thresholds["high_memory_mb"] > 0
                assert thresholds["critical_memory_mb"] > thresholds["high_memory_mb"]
                assert 0 < thresholds["high_cpu_percent"] < 100
                assert thresholds["high_cpu_percent"] < thresholds["critical_cpu_percent"] < 100

    async def test_monitoring_data_structure(self, async_client: AsyncClient, auth_headers_admin):
        """Test monitoring data structure consistency."""
        response = await async_client.get("/api/v1/monitoring/system-health", headers=auth_headers_admin)
        
        assert response.status_code == 200
        data = response.json()
        
        # Basic structure
        assert isinstance(data["timestamp"], str)
        
        if "system" in data:
            # If monitoring is configured, verify structure
            system = data["system"]
            assert isinstance(system, dict)
        elif "message" in data:
            # If monitoring is not configured, should have fallback message
            assert isinstance(data["message"], str)

    async def test_security_events_structure(self, async_client: AsyncClient, auth_headers_admin):
        """Test security events data structure."""
        response = await async_client.get("/api/v1/monitoring/security-events", headers=auth_headers_admin)
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data["recent_events_count"], int)
            assert isinstance(data["events_by_type"], dict)
            assert isinstance(data["events_by_severity"], dict)
            assert isinstance(data["latest_events"], list)
            
            # Verify event structure if events exist
            for event in data["latest_events"]:
                assert "timestamp" in event
                assert "type" in event
                assert "severity" in event
                assert "details" in event