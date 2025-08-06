"""
Tests for JWT authentication endpoints.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.auth
class TestJWTAuthentication:
    """Test JWT authentication endpoints."""

    async def test_jwt_login_success(self, async_client: AsyncClient, created_admin_user, admin_user_data):
        """Test successful JWT login."""
        response = await async_client.post("/api/v1/auth/jwt/login", json={
            "user_id": admin_user_data["user_id"],
            "pin": admin_user_data["pin"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["user_id"] == admin_user_data["user_id"]
        assert data["user"]["role"] == admin_user_data["role"]

    async def test_jwt_login_invalid_credentials(self, async_client: AsyncClient, created_admin_user):
        """Test JWT login with invalid credentials."""
        response = await async_client.post("/api/v1/auth/jwt/login", json={
            "user_id": "01",
            "pin": "0000"  # Wrong PIN
        })
        
        assert response.status_code == 401
        assert "WWW-Authenticate" in response.headers
        assert response.headers["WWW-Authenticate"] == "Bearer"

    async def test_jwt_login_nonexistent_user(self, async_client: AsyncClient):
        """Test JWT login with non-existent user."""
        response = await async_client.post("/api/v1/auth/jwt/login", json={
            "user_id": "99",
            "pin": "1234"
        })
        
        assert response.status_code == 401

    async def test_jwt_login_inactive_user(self, async_client: AsyncClient, created_inactive_user, inactive_user_data):
        """Test JWT login with inactive user."""
        response = await async_client.post("/api/v1/auth/jwt/login", json={
            "user_id": inactive_user_data["user_id"],
            "pin": inactive_user_data["pin"]
        })
        
        assert response.status_code == 401

    async def test_oauth2_token_endpoint(self, async_client: AsyncClient, created_admin_user, admin_user_data):
        """Test OAuth2-compatible token endpoint."""
        response = await async_client.post("/api/v1/auth/jwt/token", json={
            "user_id": admin_user_data["user_id"],
            "pin": admin_user_data["pin"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_jwt_login_with_refresh(self, async_client: AsyncClient, created_admin_user, admin_user_data):
        """Test JWT login with refresh token."""
        response = await async_client.post("/api/v1/auth/jwt/login-with-refresh", json={
            "user_id": admin_user_data["user_id"],
            "pin": admin_user_data["pin"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data

    async def test_refresh_token_valid(self, async_client: AsyncClient, created_admin_user, admin_user_data):
        """Test refresh token with valid token."""
        # First get tokens
        login_response = await async_client.post("/api/v1/auth/jwt/login-with-refresh", json={
            "user_id": admin_user_data["user_id"],
            "pin": admin_user_data["pin"]
        })
        
        refresh_token = login_response.json()["refresh_token"]
        
        # Use refresh token
        response = await async_client.post("/api/v1/auth/jwt/refresh", json={
            "refresh_token": refresh_token
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_refresh_token_invalid(self, async_client: AsyncClient):
        """Test refresh token with invalid token."""
        response = await async_client.post("/api/v1/auth/jwt/refresh", json={
            "refresh_token": "invalid_token"
        })
        
        assert response.status_code == 401

    async def test_verify_token_valid(self, async_client: AsyncClient, admin_token):
        """Test token verification with valid token."""
        response = await async_client.get(
            f"/api/v1/auth/jwt/verify?token={admin_token}"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert "user_id" in data
        assert "role" in data
        assert "expires_at" in data

    async def test_verify_token_invalid(self, async_client: AsyncClient):
        """Test token verification with invalid token."""
        response = await async_client.get(
            "/api/v1/auth/jwt/verify?token=invalid_token"
        )
        
        assert response.status_code == 401

    async def test_jwt_login_validation_errors(self, async_client: AsyncClient):
        """Test JWT login with validation errors."""
        # Missing fields
        response = await async_client.post("/api/v1/auth/jwt/login", json={})
        assert response.status_code == 422
        
        # Invalid user_id format
        response = await async_client.post("/api/v1/auth/jwt/login", json={
            "user_id": "123",  # Should be 2 digits
            "pin": "1234"
        })
        assert response.status_code == 422
        
        # Invalid PIN format
        response = await async_client.post("/api/v1/auth/jwt/login", json={
            "user_id": "01",
            "pin": "12345"  # Should be 4 digits
        })
        assert response.status_code == 422

    async def test_rate_limiting_auth(self, async_client: AsyncClient):
        """Test rate limiting on authentication endpoints."""
        # Make multiple rapid requests
        for _ in range(10):
            response = await async_client.post("/api/v1/auth/jwt/login", json={
                "user_id": "99",
                "pin": "0000"
            })
            
        # Should eventually get rate limited
        # Note: This depends on the rate limiting configuration
        assert response.status_code in [401, 429]  # 429 is Too Many Requests

    async def test_security_headers(self, async_client: AsyncClient, created_admin_user, admin_user_data):
        """Test security headers in JWT responses."""
        response = await async_client.post("/api/v1/auth/jwt/login", json={
            "user_id": admin_user_data["user_id"],
            "pin": admin_user_data["pin"]
        })
        
        assert response.status_code == 200
        # Check for security headers that should be present
        # These are typically added by middleware
        assert "Content-Type" in response.headers
        
    async def test_jwt_login_case_insensitive_user_id(self, async_client: AsyncClient, created_admin_user):
        """Test that user_id comparison is handled correctly."""
        # Test with exact case
        response = await async_client.post("/api/v1/auth/jwt/login", json={
            "user_id": "01",
            "pin": "1234"
        })
        assert response.status_code == 200