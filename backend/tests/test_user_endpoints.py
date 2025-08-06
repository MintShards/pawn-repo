"""
Tests for user management endpoints.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.unit
class TestUserEndpoints:
    """Test user management endpoints."""

    # Authentication endpoints
    async def test_user_login_success(self, async_client: AsyncClient, created_admin_user, admin_user_data):
        """Test successful user login."""
        response = await async_client.post("/api/v1/user/login", json={
            "user_id": admin_user_data["user_id"],
            "pin": admin_user_data["pin"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["user_id"] == admin_user_data["user_id"]

    async def test_user_logout(self, async_client: AsyncClient, auth_headers_admin):
        """Test user logout."""
        response = await async_client.post("/api/v1/user/logout", headers=auth_headers_admin)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "logged out" in data["message"].lower()

    # Profile management
    async def test_get_current_user_profile(self, async_client: AsyncClient, auth_headers_admin, admin_user_data):
        """Test getting current user's profile."""
        response = await async_client.get("/api/v1/user/me", headers=auth_headers_admin)
        
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == admin_user_data["user_id"]
        assert data["role"] == admin_user_data["role"]
        assert data["status"] == admin_user_data["status"]

    async def test_get_current_user_unauthorized(self, async_client: AsyncClient):
        """Test getting current user without authentication."""
        response = await async_client.get("/api/v1/user/me")
        
        assert response.status_code == 401

    async def test_update_current_user_profile(self, async_client: AsyncClient, auth_headers_admin):
        """Test updating current user's profile."""
        update_data = {
            "first_name": "Updated",
            "last_name": "Name",
            "email": "updated@test.com"
        }
        
        response = await async_client.put("/api/v1/user/me", json=update_data, headers=auth_headers_admin)
        
        assert response.status_code == 200
        data = response.json()
        assert data["first_name"] == "Updated"
        assert data["last_name"] == "Name"
        assert data["email"] == "updated@test.com"

    async def test_change_current_user_pin(self, async_client: AsyncClient, auth_headers_admin):
        """Test changing current user's PIN."""
        pin_data = {
            "current_pin": "1234",
            "new_pin": "5678",
            "confirm_pin": "5678"
        }
        
        response = await async_client.post("/api/v1/user/me/change-pin", json=pin_data, headers=auth_headers_admin)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    async def test_change_pin_wrong_current(self, async_client: AsyncClient, auth_headers_admin):
        """Test changing PIN with wrong current PIN."""
        pin_data = {
            "current_pin": "0000",  # Wrong current PIN
            "new_pin": "5678",
            "confirm_pin": "5678"
        }
        
        response = await async_client.post("/api/v1/user/me/change-pin", json=pin_data, headers=auth_headers_admin)
        
        assert response.status_code == 400

    async def test_change_pin_mismatch_confirm(self, async_client: AsyncClient, auth_headers_admin):
        """Test changing PIN with mismatched confirmation."""
        pin_data = {
            "current_pin": "1234",
            "new_pin": "5678",
            "confirm_pin": "9999"  # Doesn't match new_pin
        }
        
        response = await async_client.post("/api/v1/user/me/change-pin", json=pin_data, headers=auth_headers_admin)
        
        assert response.status_code == 400

    # User management (Admin only)
    async def test_create_user_admin(self, async_client: AsyncClient, auth_headers_admin):
        """Test creating user as admin."""
        user_data = {
            "user_id": "10",
            "pin": "9999",
            "first_name": "New",
            "last_name": "User",
            "email": "new@test.com",
            "role": "staff"
        }
        
        response = await async_client.post("/api/v1/user/create", json=user_data, headers=auth_headers_admin)
        
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == "10"
        assert data["role"] == "staff"

    async def test_create_user_staff_forbidden(self, async_client: AsyncClient, auth_headers_staff):
        """Test creating user as staff (should be forbidden)."""
        user_data = {
            "user_id": "11",
            "pin": "9999",
            "first_name": "New",
            "last_name": "User",
            "email": "new@test.com",
            "role": "staff"
        }
        
        response = await async_client.post("/api/v1/user/create", json=user_data, headers=auth_headers_staff)
        
        assert response.status_code == 403

    async def test_get_users_list_admin(self, async_client: AsyncClient, auth_headers_admin):
        """Test getting users list as admin."""
        response = await async_client.get("/api/v1/user/list", headers=auth_headers_admin)
        
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data

    async def test_get_users_list_staff(self, async_client: AsyncClient, auth_headers_staff):
        """Test getting users list as staff."""
        response = await async_client.get("/api/v1/user/list", headers=auth_headers_staff)
        
        assert response.status_code == 200  # Staff can see basic user list

    async def test_get_users_list_with_filters(self, async_client: AsyncClient, auth_headers_admin):
        """Test getting users list with filters."""
        params = {
            "role": "admin",
            "status": "active",
            "search": "admin",
            "page": 1,
            "per_page": 10,
            "sort_by": "created_at",
            "sort_order": "desc"
        }
        
        response = await async_client.get("/api/v1/user/list", params=params, headers=auth_headers_admin)
        
        assert response.status_code == 200

    async def test_get_user_stats_admin(self, async_client: AsyncClient, auth_headers_admin):
        """Test getting user statistics as admin."""
        response = await async_client.get("/api/v1/user/stats", headers=auth_headers_admin)
        
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "active_users" in data
        assert "users_by_role" in data

    async def test_get_user_stats_staff_forbidden(self, async_client: AsyncClient, auth_headers_staff):
        """Test getting user statistics as staff (should be forbidden)."""
        response = await async_client.get("/api/v1/user/stats", headers=auth_headers_staff)
        
        assert response.status_code == 403

    async def test_get_user_by_id_admin(self, async_client: AsyncClient, auth_headers_admin, admin_user_data):
        """Test getting user by ID as admin."""
        response = await async_client.get(f"/api/v1/user/{admin_user_data['user_id']}", headers=auth_headers_admin)
        
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == admin_user_data["user_id"]

    async def test_get_user_by_id_staff(self, async_client: AsyncClient, auth_headers_staff, created_admin_user, admin_user_data):
        """Test getting user by ID as staff (limited info)."""
        response = await async_client.get(f"/api/v1/user/{admin_user_data['user_id']}", headers=auth_headers_staff)
        
        assert response.status_code == 200  # Staff can see basic user info

    async def test_get_user_by_id_not_found(self, async_client: AsyncClient, auth_headers_admin):
        """Test getting non-existent user."""
        response = await async_client.get("/api/v1/user/99", headers=auth_headers_admin)
        
        assert response.status_code == 404

    async def test_update_user_admin(self, async_client: AsyncClient, auth_headers_admin, staff_user_data):
        """Test updating user as admin."""
        update_data = {
            "first_name": "Updated",
            "status": "inactive"
        }
        
        response = await async_client.put(f"/api/v1/user/{staff_user_data['user_id']}", 
                                        json=update_data, headers=auth_headers_admin)
        
        assert response.status_code == 200
        data = response.json()
        assert data["first_name"] == "Updated"

    async def test_update_user_staff_limited(self, async_client: AsyncClient, auth_headers_staff, created_staff_user, staff_user_data):
        """Test updating user as staff (limited permissions)."""
        update_data = {
            "first_name": "Updated",
            "role": "admin"  # Staff shouldn't be able to change role
        }
        
        response = await async_client.put(f"/api/v1/user/{staff_user_data['user_id']}", 
                                        json=update_data, headers=auth_headers_staff)
        
        # Should succeed but role shouldn't change
        assert response.status_code == 200

    async def test_deactivate_user_admin(self, async_client: AsyncClient, auth_headers_admin, created_staff_user, staff_user_data):
        """Test deactivating user as admin."""
        response = await async_client.delete(f"/api/v1/user/{staff_user_data['user_id']}", headers=auth_headers_admin)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    async def test_deactivate_self_forbidden(self, async_client: AsyncClient, auth_headers_admin, admin_user_data):
        """Test that admin cannot deactivate their own account."""
        response = await async_client.delete(f"/api/v1/user/{admin_user_data['user_id']}", headers=auth_headers_admin)
        
        assert response.status_code == 400

    async def test_deactivate_user_staff_forbidden(self, async_client: AsyncClient, auth_headers_staff, created_admin_user, admin_user_data):
        """Test deactivating user as staff (should be forbidden)."""
        response = await async_client.delete(f"/api/v1/user/{admin_user_data['user_id']}", headers=auth_headers_staff)
        
        assert response.status_code == 403

    # Admin-only user management
    async def test_reset_user_pin_admin(self, async_client: AsyncClient, auth_headers_admin, created_staff_user, staff_user_data):
        """Test resetting user PIN as admin."""
        response = await async_client.post(f"/api/v1/user/{staff_user_data['user_id']}/reset-pin", headers=auth_headers_admin)
        
        assert response.status_code == 200
        data = response.json()
        assert "temporary_pin" in data
        assert "message" in data

    async def test_reset_user_pin_staff_forbidden(self, async_client: AsyncClient, auth_headers_staff, admin_user_data):
        """Test resetting user PIN as staff (should be forbidden)."""
        response = await async_client.post(f"/api/v1/user/{admin_user_data['user_id']}/reset-pin", headers=auth_headers_staff)
        
        assert response.status_code == 403

    async def test_unlock_user_account_admin(self, async_client: AsyncClient, auth_headers_admin, created_staff_user, staff_user_data):
        """Test unlocking user account as admin."""
        response = await async_client.post(f"/api/v1/user/{staff_user_data['user_id']}/unlock", headers=auth_headers_admin)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    async def test_get_user_sessions_admin(self, async_client: AsyncClient, auth_headers_admin, created_staff_user, staff_user_data):
        """Test getting user sessions as admin."""
        response = await async_client.get(f"/api/v1/user/{staff_user_data['user_id']}/sessions", headers=auth_headers_admin)
        
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "active_sessions" in data
        assert "session_count" in data

    async def test_terminate_user_sessions_admin(self, async_client: AsyncClient, auth_headers_admin, created_staff_user, staff_user_data):
        """Test terminating user sessions as admin."""
        response = await async_client.delete(f"/api/v1/user/{staff_user_data['user_id']}/sessions", headers=auth_headers_admin)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    # Health check
    async def test_health_check(self, async_client: AsyncClient):
        """Test API health check."""
        response = await async_client.get("/api/v1/user/health")
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "database" in data
        assert "timestamp" in data

    # Error cases and edge cases
    async def test_invalid_user_id_format(self, async_client: AsyncClient, auth_headers_admin):
        """Test endpoints with invalid user ID format."""
        response = await async_client.get("/api/v1/user/invalid", headers=auth_headers_admin)
        
        # Should handle gracefully (404 or 400)
        assert response.status_code in [400, 404]

    async def test_concurrent_requests(self, async_client: AsyncClient, auth_headers_admin):
        """Test handling concurrent requests."""
        import asyncio
        
        # Make multiple concurrent requests
        tasks = []
        for _ in range(5):
            task = async_client.get("/api/v1/user/me", headers=auth_headers_admin)
            tasks.append(task)
        
        responses = await asyncio.gather(*tasks)
        
        # All should succeed
        for response in responses:
            assert response.status_code == 200