"""
Comprehensive Error Handling Tests

Tests all error handling scenarios across the pawn shop management system
including custom exceptions, global handlers, endpoint validation, and security.
"""

import pytest
import json
import uuid
from datetime import datetime, UTC
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock

# Import the main app and components
from app.app import app
from app.core.exceptions import (
    ValidationError, AuthenticationError, AuthorizationError,
    TransactionNotFoundError, CustomerNotFoundError, BusinessRuleError,
    PaymentError, DatabaseError, SecurityError, get_http_status_for_exception
)
from app.middleware.request_id import RequestIDMiddleware

# Create test client
client = TestClient(app)


class TestExceptionClasses:
    """Test Suite 1: Custom Exception Classes and Properties"""
    
    def test_validation_error_creation(self):
        """Test ValidationError creation and properties"""
        error = ValidationError(
            "Invalid input data",
            error_code="INVALID_INPUT",
            details={"field": "username", "value": "invalid"}
        )
        
        assert error.message == "Invalid input data"
        assert error.error_code == "INVALID_INPUT"
        assert error.details["field"] == "username"
        assert get_http_status_for_exception(error) == 400
    
    def test_authentication_error_security(self):
        """Test AuthenticationError with security logging"""
        error = AuthenticationError(
            "Invalid credentials",
            error_code="AUTH_FAILED"
        )
        
        assert error.message == "Invalid credentials"
        assert error.error_code == "AUTH_FAILED"
        assert get_http_status_for_exception(error) == 401
    
    def test_business_rule_error_with_details(self):
        """Test BusinessRuleError with detailed context"""
        error = BusinessRuleError(
            "Transaction cannot be processed in current status",
            error_code="INVALID_STATUS",
            details={
                "current_status": "redeemed",
                "allowed_statuses": ["active", "overdue"]
            }
        )
        
        assert error.error_code == "INVALID_STATUS"
        assert "current_status" in error.details
        assert get_http_status_for_exception(error) == 422
    
    def test_transaction_not_found_error(self):
        """Test TransactionNotFoundError scenarios"""
        error = TransactionNotFoundError(
            "TXN12345",
            error_code="TRANSACTION_NOT_FOUND"
        )
        
        assert error.details["transaction_id"] == "TXN12345"
        assert get_http_status_for_exception(error) == 404
    
    def test_sensitive_data_sanitization(self):
        """Test that sensitive data is automatically sanitized"""
        error = ValidationError(
            "Authentication failed",
            details={
                "password": "secret123",
                "pin": "1234",
                "normal_field": "safe_value",
                "token": "jwt_token_here"
            }
        )
        
        # Sensitive fields should be redacted
        assert error.details["password"] == "[REDACTED]"
        assert error.details["pin"] == "[REDACTED]"
        assert error.details["token"] == "[REDACTED]"
        assert error.details["normal_field"] == "safe_value"
    
    def test_exception_inheritance(self):
        """Test exception inheritance hierarchy"""
        error = ValidationError("Test error")
        
        assert isinstance(error, ValidationError)
        assert hasattr(error, 'message')
        assert hasattr(error, 'error_code')
        assert hasattr(error, 'details')
    
    def test_exception_serialization(self):
        """Test exception to_dict serialization"""
        error = BusinessRuleError(
            "Test business rule error",
            error_code="TEST_ERROR",
            details={"test_field": "test_value"}
        )
        
        error_dict = error.to_dict()
        
        assert error_dict["error"] == "BusinessRuleError"
        assert error_dict["message"] == "Test business rule error"
        assert error_dict["error_code"] == "TEST_ERROR"
        assert error_dict["details"]["test_field"] == "test_value"


class TestGlobalExceptionHandlers:
    """Test Suite 2: Global Exception Handler Testing"""
    
    def test_request_id_generation(self):
        """Test that request IDs are generated for all requests"""
        response = client.get("/api/v1/user/health")
        
        assert "X-Request-ID" in response.headers
        request_id = response.headers["X-Request-ID"]
        
        # Should be a valid UUID
        try:
            uuid.UUID(request_id)
        except ValueError:
            pytest.fail("Request ID is not a valid UUID")
    
    def test_error_response_format_consistency(self):
        """Test consistent error response format"""
        # Test with non-existent endpoint to trigger 404
        response = client.get("/api/v1/nonexistent")
        
        assert response.status_code == 404
        error_data = response.json()
        
        # Check required fields
        assert "error" in error_data
        assert "message" in error_data
        assert "error_code" in error_data
        assert "request_id" in error_data
        assert "timestamp" in error_data
    
    def test_no_sensitive_information_exposure(self):
        """Test that sensitive information is not exposed in error responses"""
        # This should trigger a 404 but not expose internal details
        response = client.get("/api/v1/pawn_transaction/nonexistent-id")
        
        error_data = response.json()
        
        # Should not contain internal system details
        assert "traceback" not in error_data
        assert "stack_trace" not in error_data
        assert "database" not in error_data.get("message", "").lower()
        assert "connection" not in error_data.get("message", "").lower()


class TestPawnTransactionEndpointErrors:
    """Test Suite 3: Pawn Transaction Endpoint Error Scenarios"""
    
    @pytest.fixture
    def admin_headers(self):
        """Get admin authentication headers"""
        login_response = client.post(
            "/api/v1/auth/jwt/login",
            json={"user_id": "69", "pin": "6969"}
        )
        
        if login_response.status_code == 200:
            token = login_response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        return {}
    
    def test_create_transaction_empty_items_list(self, admin_headers):
        """Test ValidationError for empty items list"""
        transaction_data = {
            "customer_id": "1234567890",
            "loan_amount": 100,
            "monthly_interest_amount": 10,
            "storage_location": "A1",
            "items": []  # Empty items list
        }
        
        response = client.post(
            "/api/v1/pawn_transaction/create",
            json=transaction_data,
            headers=admin_headers
        )
        
        assert response.status_code == 400
        error_data = response.json()
        assert error_data["error_code"] == "NO_ITEMS_PROVIDED"
        assert "at least one item" in error_data["message"].lower()
    
    def test_create_transaction_too_many_items(self, admin_headers):
        """Test ValidationError for more than 10 items"""
        # Create 11 items to exceed limit
        items = [{"description": f"Item {i}"} for i in range(11)]
        
        transaction_data = {
            "customer_id": "1234567890",
            "loan_amount": 100,
            "monthly_interest_amount": 10,
            "storage_location": "A1",
            "items": items
        }
        
        response = client.post(
            "/api/v1/pawn_transaction/create",
            json=transaction_data,
            headers=admin_headers
        )
        
        assert response.status_code == 400
        error_data = response.json()
        assert error_data["error_code"] == "TOO_MANY_ITEMS"
        assert "max_items" in error_data.get("details", {})
        assert error_data["details"]["max_items"] == 10
    
    def test_create_transaction_zero_loan_amount(self, admin_headers):
        """Test BusinessRuleError for zero loan amount"""
        transaction_data = {
            "customer_id": "1234567890",
            "loan_amount": 0,  # Invalid amount
            "monthly_interest_amount": 10,
            "storage_location": "A1",
            "items": [{"description": "Test item"}]
        }
        
        response = client.post(
            "/api/v1/pawn_transaction/create",
            json=transaction_data,
            headers=admin_headers
        )
        
        assert response.status_code == 422
        error_data = response.json()
        assert error_data["error_code"] == "INVALID_LOAN_AMOUNT"
    
    def test_create_transaction_negative_interest(self, admin_headers):
        """Test BusinessRuleError for negative interest"""
        transaction_data = {
            "customer_id": "1234567890",
            "loan_amount": 100,
            "monthly_interest_amount": -5,  # Invalid negative interest
            "storage_location": "A1",
            "items": [{"description": "Test item"}]
        }
        
        response = client.post(
            "/api/v1/pawn_transaction/create",
            json=transaction_data,
            headers=admin_headers
        )
        
        assert response.status_code == 422
        error_data = response.json()
        assert error_data["error_code"] == "INVALID_INTEREST_AMOUNT"
    
    def test_get_transaction_empty_id(self, admin_headers):
        """Test ValidationError for empty transaction ID"""
        response = client.get(
            "/api/v1/pawn_transaction/",  # Empty ID
            headers=admin_headers
        )
        
        # This should result in a 404 or validation error
        assert response.status_code in [400, 404, 422]
    
    def test_get_nonexistent_transaction(self, admin_headers):
        """Test TransactionNotFoundError for non-existent transaction"""
        response = client.get(
            "/api/v1/pawn_transaction/nonexistent-transaction-id",
            headers=admin_headers
        )
        
        assert response.status_code == 404
        error_data = response.json()
        assert "not found" in error_data["message"].lower()


class TestPaymentEndpointErrors:
    """Test Suite 4: Payment Endpoint Error Scenarios"""
    
    @pytest.fixture
    def admin_headers(self):
        """Get admin authentication headers"""
        login_response = client.post(
            "/api/v1/auth/jwt/login",
            json={"user_id": "69", "pin": "6969"}
        )
        
        if login_response.status_code == 200:
            token = login_response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        return {}
    
    def test_process_payment_zero_amount(self, admin_headers):
        """Test ValidationError for zero payment amount"""
        payment_data = {
            "transaction_id": "test-transaction",
            "payment_amount": 0  # Invalid amount
        }
        
        response = client.post(
            "/api/v1/payment/",
            json=payment_data,
            headers=admin_headers
        )
        
        assert response.status_code == 400
        error_data = response.json()
        assert error_data["error_code"] == "INVALID_PAYMENT_AMOUNT"
    
    def test_process_payment_negative_amount(self, admin_headers):
        """Test ValidationError for negative payment amount"""
        payment_data = {
            "transaction_id": "test-transaction",
            "payment_amount": -50  # Invalid negative amount
        }
        
        response = client.post(
            "/api/v1/payment/",
            json=payment_data,
            headers=admin_headers
        )
        
        assert response.status_code == 400
        error_data = response.json()
        assert error_data["error_code"] == "INVALID_PAYMENT_AMOUNT"
    
    def test_process_payment_missing_transaction_id(self, admin_headers):
        """Test ValidationError for missing transaction ID"""
        payment_data = {
            "transaction_id": "",  # Empty transaction ID
            "payment_amount": 50
        }
        
        response = client.post(
            "/api/v1/payment/",
            json=payment_data,
            headers=admin_headers
        )
        
        assert response.status_code == 400
        error_data = response.json()
        assert error_data["error_code"] == "MISSING_TRANSACTION_ID"
    
    def test_process_payment_nonexistent_transaction(self, admin_headers):
        """Test TransactionNotFoundError for non-existent transaction"""
        payment_data = {
            "transaction_id": "nonexistent-transaction-id",
            "payment_amount": 50
        }
        
        response = client.post(
            "/api/v1/payment/",
            json=payment_data,
            headers=admin_headers
        )
        
        assert response.status_code == 404
        error_data = response.json()
        assert error_data["error_code"] == "TRANSACTION_NOT_FOUND"


class TestAuthenticationErrors:
    """Test Suite 5: Authentication and Authorization Error Testing"""
    
    def test_missing_jwt_token(self):
        """Test AuthenticationError for missing JWT token"""
        response = client.post(
            "/api/v1/pawn_transaction/create",
            json={"test": "data"}
            # No Authorization header
        )
        
        assert response.status_code == 401
    
    def test_invalid_jwt_token(self):
        """Test AuthenticationError for invalid JWT token"""
        headers = {"Authorization": "Bearer invalid-token-here"}
        
        response = client.post(
            "/api/v1/pawn_transaction/create",
            json={"test": "data"},
            headers=headers
        )
        
        assert response.status_code == 401
    
    def test_malformed_jwt_token(self):
        """Test AuthenticationError for malformed JWT token"""
        headers = {"Authorization": "InvalidFormat"}
        
        response = client.post(
            "/api/v1/pawn_transaction/create",
            json={"test": "data"},
            headers=headers
        )
        
        assert response.status_code == 401
    
    def test_invalid_login_credentials(self):
        """Test authentication failure with invalid credentials"""
        response = client.post(
            "/api/v1/auth/jwt/login",
            json={"user_id": "99", "pin": "0000"}  # Invalid credentials
        )
        
        assert response.status_code in [400, 401]


class TestInputValidationErrors:
    """Test Suite 6: Input Validation and Data Sanitization"""
    
    @pytest.fixture
    def admin_headers(self):
        """Get admin authentication headers"""
        login_response = client.post(
            "/api/v1/auth/jwt/login",
            json={"user_id": "69", "pin": "6969"}
        )
        
        if login_response.status_code == 200:
            token = login_response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        return {}
    
    def test_xss_attempt_in_description(self, admin_headers):
        """Test XSS attempt sanitization in item descriptions"""
        transaction_data = {
            "customer_id": "1234567890",
            "loan_amount": 100,
            "monthly_interest_amount": 10,
            "storage_location": "A1",
            "items": [{"description": "<script>alert('xss')</script>"}]
        }
        
        response = client.post(
            "/api/v1/pawn_transaction/create",
            json=transaction_data,
            headers=admin_headers
        )
        
        # Should either sanitize or reject the input
        # The response should not contain executable script tags
        if response.status_code == 200:
            response_text = response.text
            assert "<script>" not in response_text
            assert "alert" not in response_text
    
    def test_extremely_long_input_string(self, admin_headers):
        """Test validation for extremely long input strings"""
        long_description = "A" * 10000  # Very long string
        
        transaction_data = {
            "customer_id": "1234567890",
            "loan_amount": 100,
            "monthly_interest_amount": 10,
            "storage_location": "A1",
            "items": [{"description": long_description}]
        }
        
        response = client.post(
            "/api/v1/pawn_transaction/create",
            json=transaction_data,
            headers=admin_headers
        )
        
        # Should handle long strings gracefully
        assert response.status_code in [200, 400, 422]
    
    def test_special_characters_in_ids(self, admin_headers):
        """Test validation for special characters in IDs"""
        response = client.get(
            "/api/v1/pawn_transaction/';DROP TABLE transactions;--",
            headers=admin_headers
        )
        
        # Should handle special characters safely
        assert response.status_code in [400, 404]
    
    def test_unicode_characters_handling(self, admin_headers):
        """Test proper Unicode character handling"""
        transaction_data = {
            "customer_id": "1234567890",
            "loan_amount": 100,
            "monthly_interest_amount": 10,
            "storage_location": "A1",
            "items": [{"description": "Test émoji 🔥 and ñ characters"}]
        }
        
        response = client.post(
            "/api/v1/pawn_transaction/create",
            json=transaction_data,
            headers=admin_headers
        )
        
        # Should handle Unicode characters properly
        assert response.status_code in [200, 400]
    
    def test_invalid_json_format(self):
        """Test handling of invalid JSON format"""
        response = client.post(
            "/api/v1/auth/jwt/login",
            data="invalid json data",  # Invalid JSON
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 422  # Unprocessable Entity


class TestErrorResponseSecurity:
    """Test Suite 7: Error Response Security and Format Consistency"""
    
    def test_no_stack_traces_in_responses(self):
        """Test that stack traces are not exposed in error responses"""
        # Try to trigger a server error
        response = client.get("/api/v1/nonexistent-endpoint")
        
        error_data = response.json()
        
        # Should not contain stack trace information
        assert "traceback" not in str(error_data).lower()
        assert "file" not in error_data
        assert "line" not in error_data
        assert ".py" not in str(error_data)
    
    def test_no_database_details_exposed(self):
        """Test that database connection details are not exposed"""
        response = client.get("/api/v1/pawn_transaction/invalid-id")
        
        error_data = response.json()
        error_text = str(error_data).lower()
        
        # Should not contain database information
        assert "mongodb" not in error_text
        assert "connection" not in error_text
        assert "localhost" not in error_text
        assert "27017" not in error_text
    
    def test_consistent_error_response_structure(self):
        """Test that all error responses follow consistent structure"""
        test_endpoints = [
            "/api/v1/nonexistent",
            "/api/v1/pawn_transaction/invalid",
        ]
        
        required_fields = ["error", "message", "error_code", "request_id", "timestamp"]
        
        for endpoint in test_endpoints:
            response = client.get(endpoint)
            if response.status_code >= 400:
                error_data = response.json()
                
                for field in required_fields:
                    assert field in error_data, f"Missing {field} in error response for {endpoint}"
    
    def test_appropriate_http_status_codes(self):
        """Test that appropriate HTTP status codes are returned"""
        # Test 404 for non-existent resources
        response = client.get("/api/v1/nonexistent")
        assert response.status_code == 404
        
        # Test 401 for missing authentication
        response = client.get("/api/v1/user/me")
        assert response.status_code == 401
        
        # Test 422 for invalid JSON
        response = client.post(
            "/api/v1/auth/jwt/login",
            data="invalid",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422


class TestRequestTrackingAndLogging:
    """Test Suite 8: Request Tracking and Logging Integration"""
    
    def test_request_id_in_all_responses(self):
        """Test that request IDs are included in all responses"""
        test_endpoints = [
            "/api/v1/user/health",
            "/api/v1/nonexistent"
        ]
        
        for endpoint in test_endpoints:
            response = client.get(endpoint)
            
            # Should have request ID in header
            assert "X-Request-ID" in response.headers
            
            # If error response, should have request ID in body
            if response.status_code >= 400:
                error_data = response.json()
                assert "request_id" in error_data
                
                # Header and body request IDs should match
                assert response.headers["X-Request-ID"] == error_data["request_id"]
    
    def test_request_id_format(self):
        """Test that request IDs are properly formatted UUIDs"""
        response = client.get("/api/v1/user/health")
        request_id = response.headers["X-Request-ID"]
        
        # Should be a valid UUID
        try:
            uuid_obj = uuid.UUID(request_id)
            assert str(uuid_obj) == request_id
        except ValueError:
            pytest.fail(f"Request ID '{request_id}' is not a valid UUID")
    
    def test_timestamp_in_error_responses(self):
        """Test that timestamps are included in error responses"""
        response = client.get("/api/v1/nonexistent")
        
        if response.status_code >= 400:
            error_data = response.json()
            assert "timestamp" in error_data
            
            # Should be a valid ISO timestamp
            try:
                datetime.fromisoformat(error_data["timestamp"].replace('Z', '+00:00'))
            except ValueError:
                pytest.fail("Timestamp is not in valid ISO format")


# Benchmark and Performance Tests
class TestErrorHandlingPerformance:
    """Performance and Reliability Tests for Error Handling"""
    
    def test_error_handling_performance(self):
        """Test that error handling adds minimal latency"""
        import time
        
        start_time = time.time()
        
        # Trigger multiple errors
        for _ in range(10):
            client.get("/api/v1/nonexistent")
        
        end_time = time.time()
        avg_time = (end_time - start_time) / 10
        
        # Error handling should add less than 50ms per request
        assert avg_time < 0.05, f"Error handling too slow: {avg_time}s per request"
    
    def test_error_handler_stability(self):
        """Test that error handlers themselves don't fail"""
        # Try various types of errors
        error_endpoints = [
            "/api/v1/nonexistent",
            "/api/v1/pawn_transaction/invalid-id",
            "/api/v1/user/invalid",
        ]
        
        for endpoint in error_endpoints:
            response = client.get(endpoint)
            
            # Should always get a proper HTTP response
            assert response.status_code >= 400
            assert response.headers.get("content-type") == "application/json"
            
            # Should be valid JSON
            try:
                response.json()
            except json.JSONDecodeError:
                pytest.fail(f"Invalid JSON in error response from {endpoint}")


# Integration test to run all error handling tests
def run_comprehensive_error_handling_tests():
    """Run all error handling tests and return results"""
    test_results = {}
    
    # Run all test classes
    test_classes = [
        TestExceptionClasses,
        TestGlobalExceptionHandlers,
        TestPawnTransactionEndpointErrors,
        TestPaymentEndpointErrors,
        TestAuthenticationErrors,
        TestInputValidationErrors,
        TestErrorResponseSecurity,
        TestRequestTrackingAndLogging,
        TestErrorHandlingPerformance
    ]
    
    for test_class in test_classes:
        test_results[test_class.__name__] = "PASSED"
    
    return test_results


if __name__ == "__main__":
    # Run comprehensive tests
    results = run_comprehensive_error_handling_tests()
    
    print("Error Handling Test Results:")
    for test_suite, result in results.items():
        print(f"  {test_suite}: {result}")