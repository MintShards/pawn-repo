"""
Manual API tests using requests to test actual endpoints.
"""

import pytest
import requests
import time
from urllib.parse import urljoin


class TestManualAPI:
    """Test API endpoints using manual HTTP requests."""
    
    BASE_URL = "http://localhost:8000"
    
    def _make_request(self, method, endpoint, **kwargs):
        """Make HTTP request with error handling."""
        url = urljoin(self.BASE_URL, endpoint)
        try:
            response = requests.request(method, url, timeout=5, **kwargs)
            return response
        except requests.ConnectionError:
            pytest.skip("API server is not running")
        except requests.Timeout:
            pytest.skip("API server timeout")
    
    def test_api_server_running(self):
        """Test if the API server is running and responding."""
        response = self._make_request("GET", "/")
        # Should return something, even 404 is fine (server is running)
        assert response.status_code in [200, 404, 422]
    
    def test_openapi_docs_available(self):
        """Test OpenAPI documentation is available."""
        response = self._make_request("GET", "/docs")
        # Should either show docs or redirect
        assert response.status_code in [200, 307, 422]
        
    def test_openapi_json_available(self):
        """Test OpenAPI JSON schema is available."""
        response = self._make_request("GET", "/api/v1/openapi.json")
        assert response.status_code == 200
        
        data = response.json()
        assert "openapi" in data
        assert "info" in data
        assert "paths" in data
    
    def test_health_endpoint_without_auth(self):
        """Test health endpoint (should work without auth)."""
        response = self._make_request("GET", "/api/v1/user/health")
        
        # Should either work or fail due to database issues
        assert response.status_code in [200, 500, 503]
        
        if response.status_code == 200:
            data = response.json()
            assert "status" in data
    
    def test_protected_endpoint_requires_auth(self):
        """Test that protected endpoints require authentication."""
        protected_endpoints = [
            "/api/v1/user/me",
            "/api/v1/user/create", 
            "/api/v1/user/stats",
            "/api/v1/monitoring/system-health"
        ]
        
        for endpoint in protected_endpoints:
            response = self._make_request("GET", endpoint)
            # Should require authentication
            assert response.status_code == 401
    
    def test_invalid_login_attempt(self):
        """Test invalid login attempt."""
        response = self._make_request("POST", "/api/v1/auth/jwt/login", json={
            "user_id": "99",
            "pin": "0000"
        })
        
        # Should fail with 401 (invalid credentials) or 500 (database error)
        assert response.status_code in [401, 500]
    
    def test_login_validation_errors(self):
        """Test login request validation."""
        # Empty request
        response = self._make_request("POST", "/api/v1/auth/jwt/login", json={})
        assert response.status_code == 422  # Validation error
        
        # Invalid data types
        response = self._make_request("POST", "/api/v1/auth/jwt/login", json={
            "user_id": 123,   # Should be string
            "pin": 6969       # Should be string
        })
        assert response.status_code == 422
        
        # Invalid formats
        response = self._make_request("POST", "/api/v1/auth/jwt/login", json={
            "user_id": "123",  # Should be 2 digits
            "pin": "99999"     # Should be 4 digits
        })
        assert response.status_code == 422
    
    def test_cors_headers(self):
        """Test CORS headers."""
        response = self._make_request("OPTIONS", "/api/v1/user/health")
        # Should handle CORS preflight
        assert response.status_code in [200, 204, 405]
    
    def test_rate_limiting_behavior(self):
        """Test rate limiting behavior."""
        # Make multiple requests quickly
        responses = []
        for i in range(10):
            response = self._make_request("POST", "/api/v1/auth/jwt/login", json={
                "user_id": "99",
                "pin": "0000"
            })
            responses.append(response.status_code)
            
        # Should handle gracefully - either all 401s or eventual 429 (rate limited)
        assert all(code in [401, 429, 500] for code in responses)
    
    def test_jwt_endpoint_variations(self):
        """Test different JWT endpoint variations."""
        endpoints = [
            "/api/v1/user/login",
            "/api/v1/auth/jwt/login", 
            "/api/v1/auth/jwt/token"
        ]
        
        for endpoint in endpoints:
            response = self._make_request("POST", endpoint, json={
                "user_id": "99",
                "pin": "0000"
            })
            # All should handle the request (fail with 401 or 500)
            assert response.status_code in [401, 500]
    
    def test_monitoring_endpoints_require_admin(self):
        """Test monitoring endpoints require admin access."""
        monitoring_endpoints = [
            "/api/v1/monitoring/system-health",
            "/api/v1/monitoring/performance-metrics",
            "/api/v1/monitoring/business-metrics",
            "/api/v1/monitoring/security-events",
            "/api/v1/monitoring/alerts-status"
        ]
        
        for endpoint in monitoring_endpoints:
            response = self._make_request("GET", endpoint)
            # Should require authentication
            assert response.status_code == 401
    
    def test_user_endpoints_structure(self):
        """Test user endpoints respond correctly."""
        # Test various user endpoints without auth
        user_endpoints = [
            ("/api/v1/user/me", "GET"),
            ("/api/v1/user/create", "POST"),
            ("/api/v1/user/list", "GET"),
            ("/api/v1/user/stats", "GET"),
        ]
        
        for endpoint, method in user_endpoints:
            response = self._make_request(method, endpoint)
            # Should require authentication
            assert response.status_code in [401, 422]  # 422 for POST without data
    
    def test_invalid_http_methods(self):
        """Test invalid HTTP methods."""
        # POST to GET-only endpoint
        response = self._make_request("POST", "/api/v1/user/health")
        assert response.status_code == 405  # Method not allowed
        
        # DELETE to POST-only endpoint
        response = self._make_request("DELETE", "/api/v1/auth/jwt/login")
        assert response.status_code == 405  # Method not allowed
    
    def test_malformed_requests(self):
        """Test handling of malformed requests."""
        # Invalid JSON
        response = self._make_request("POST", "/api/v1/auth/jwt/login", 
                                    data="invalid json",
                                    headers={"Content-Type": "application/json"})
        assert response.status_code == 422
        
        # Missing content type for JSON data
        response = self._make_request("POST", "/api/v1/auth/jwt/login", 
                                    data='{"user_id": "69", "pin": "6969"}')
        # Should handle gracefully
        assert response.status_code in [422, 415]
    
    def test_security_headers(self):
        """Test basic security headers."""
        response = self._make_request("GET", "/api/v1/user/health")
        
        # Should have content-type
        assert "content-type" in response.headers
        
        # Should not expose sensitive server info
        server_header = response.headers.get("server", "").lower()
        assert "uvicorn" not in server_header or server_header == ""
    
    def test_metrics_endpoint(self):
        """Test Prometheus metrics endpoint."""
        response = self._make_request("GET", "/metrics")
        
        # Should either return metrics or not be configured
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            # Should be text format for Prometheus
            content_type = response.headers.get("content-type", "")
            assert "text" in content_type or content_type == ""


@pytest.mark.slow
class TestAPIPerformance:
    """Test API performance characteristics."""
    
    BASE_URL = "http://localhost:8000"
    
    def _make_request(self, method, endpoint, **kwargs):
        """Make HTTP request with error handling."""
        url = urljoin(self.BASE_URL, endpoint)
        try:
            response = requests.request(method, url, timeout=10, **kwargs)
            return response
        except requests.ConnectionError:
            pytest.skip("API server is not running")
        except requests.Timeout:
            pytest.skip("API server timeout")
    
    def test_response_times(self):
        """Test API response times."""
        endpoints = [
            "/api/v1/user/health",
            "/api/v1/openapi.json",
        ]
        
        for endpoint in endpoints:
            start_time = time.time()
            response = self._make_request("GET", endpoint)
            end_time = time.time()
            
            response_time = end_time - start_time
            
            # Should respond within reasonable time
            assert response_time < 5.0  # 5 seconds max
            
            # Health check should be fast
            if "health" in endpoint:
                assert response_time < 2.0  # 2 seconds max
    
    def test_concurrent_requests(self):
        """Test handling concurrent requests."""
        import threading
        import queue
        
        results = queue.Queue()
        
        def make_request():
            response = self._make_request("GET", "/api/v1/user/health")
            results.put(response.status_code)
        
        # Create multiple threads
        threads = []
        for i in range(5):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads
        for thread in threads:
            thread.join()
        
        # Collect results
        status_codes = []
        while not results.empty():
            status_codes.append(results.get())
        
        # All requests should be handled
        assert len(status_codes) == 5
        # Should either succeed or fail gracefully
        for code in status_codes:
            assert code in [200, 500, 503]


if __name__ == "__main__":
    # Run tests manually
    pytest.main([__file__, "-v"])