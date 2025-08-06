"""
Integration tests for the pawnshop API.
"""

import pytest
from httpx import AsyncClient
import asyncio


@pytest.mark.integration
class TestIntegrationFlows:
    """Test complete user workflows and integration scenarios."""

    async def test_complete_admin_workflow(self, async_client: AsyncClient, created_admin_user, admin_user_data):
        """Test complete admin workflow from login to user management."""
        # 1. Admin login
        login_response = await async_client.post("/api/v1/auth/jwt/login", json={
            "user_id": admin_user_data["user_id"],
            "pin": admin_user_data["pin"]
        })
        
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get own profile
        profile_response = await async_client.get("/api/v1/user/me", headers=headers)
        assert profile_response.status_code == 200
        assert profile_response.json()["role"] == "admin"
        
        # 3. Create a new staff user
        new_user_data = {
            "user_id": "20",
            "pin": "8888",
            "first_name": "Integration",
            "last_name": "Test",
            "email": "integration@test.com",
            "role": "staff"
        }
        
        create_response = await async_client.post("/api/v1/user/create", 
                                                json=new_user_data, headers=headers)
        assert create_response.status_code == 200
        created_user = create_response.json()
        
        # 4. Get users list and verify new user
        list_response = await async_client.get("/api/v1/user/list", headers=headers)
        assert list_response.status_code == 200
        users_list = list_response.json()["users"]
        user_ids = [user["user_id"] for user in users_list]
        assert "20" in user_ids
        
        # 5. Get specific user details
        user_detail_response = await async_client.get("/api/v1/user/20", headers=headers)
        assert user_detail_response.status_code == 200
        assert user_detail_response.json()["user_id"] == "20"
        
        # 6. Update user information
        update_data = {
            "first_name": "Updated Integration",
            "status": "active"
        }
        update_response = await async_client.put("/api/v1/user/20", 
                                               json=update_data, headers=headers)
        assert update_response.status_code == 200
        assert update_response.json()["first_name"] == "Updated Integration"
        
        # 7. Reset user PIN
        reset_response = await async_client.post("/api/v1/user/20/reset-pin", headers=headers)
        assert reset_response.status_code == 200
        temp_pin = reset_response.json()["temporary_pin"]
        
        # 8. Test new user can login with temporary PIN
        new_user_login = await async_client.post("/api/v1/auth/jwt/login", json={
            "user_id": "20",
            "pin": temp_pin
        })
        assert new_user_login.status_code == 200
        
        # 9. Get user statistics
        stats_response = await async_client.get("/api/v1/user/stats", headers=headers)
        assert stats_response.status_code == 200
        stats = stats_response.json()
        assert stats["total_users"] >= 2  # At least admin and new user
        
        # 10. Check system health
        health_response = await async_client.get("/api/v1/monitoring/system-health", headers=headers)
        assert health_response.status_code == 200
        
        # 11. Logout
        logout_response = await async_client.post("/api/v1/user/logout", headers=headers)
        assert logout_response.status_code == 200

    async def test_complete_staff_workflow(self, async_client: AsyncClient, created_staff_user, staff_user_data):
        """Test complete staff workflow with limited permissions."""
        # 1. Staff login
        login_response = await async_client.post("/api/v1/auth/jwt/login", json={
            "user_id": staff_user_data["user_id"],
            "pin": staff_user_data["pin"]
        })
        
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get own profile
        profile_response = await async_client.get("/api/v1/user/me", headers=headers)
        assert profile_response.status_code == 200
        assert profile_response.json()["role"] == "staff"
        
        # 3. Update own profile
        update_data = {
            "first_name": "Updated Staff",
            "email": "updated_staff@test.com"
        }
        update_response = await async_client.put("/api/v1/user/me", 
                                               json=update_data, headers=headers)
        assert update_response.status_code == 200
        
        # 4. Change own PIN
        pin_data = {
            "current_pin": staff_user_data["pin"],
            "new_pin": "9999",
            "confirm_pin": "9999"
        }
        pin_response = await async_client.post("/api/v1/user/me/change-pin", 
                                             json=pin_data, headers=headers)
        assert pin_response.status_code == 200
        
        # 5. Get users list (limited view for staff)
        list_response = await async_client.get("/api/v1/user/list", headers=headers)
        assert list_response.status_code == 200
        
        # 6. Try to access admin-only features (should fail)
        admin_endpoints = [
            ("/api/v1/user/create", "post", {"user_id": "99", "pin": "1111", "first_name": "Test", "last_name": "User", "email": "test@test.com", "role": "staff"}),
            ("/api/v1/user/stats", "get", None),
            ("/api/v1/monitoring/system-health", "get", None),
        ]
        
        for endpoint, method, data in admin_endpoints:
            if method == "post":
                response = await async_client.post(endpoint, json=data, headers=headers)
            else:
                response = await async_client.get(endpoint, headers=headers)
            
            assert response.status_code == 403
        
        # 7. Logout
        logout_response = await async_client.post("/api/v1/user/logout", headers=headers)
        assert response.status_code == 200

    async def test_jwt_token_lifecycle(self, async_client: AsyncClient, created_admin_user, admin_user_data):
        """Test complete JWT token lifecycle with refresh."""
        # 1. Login with refresh token
        login_response = await async_client.post("/api/v1/auth/jwt/login-with-refresh", json={
            "user_id": admin_user_data["user_id"],
            "pin": admin_user_data["pin"]
        })
        
        assert login_response.status_code == 200
        tokens = login_response.json()
        access_token = tokens["access_token"]
        refresh_token = tokens["refresh_token"]
        
        # 2. Use access token
        headers = {"Authorization": f"Bearer {access_token}"}
        profile_response = await async_client.get("/api/v1/user/me", headers=headers)
        assert profile_response.status_code == 200
        
        # 3. Verify access token
        verify_response = await async_client.get(f"/api/v1/auth/jwt/verify?token={access_token}")
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data["valid"] is True
        
        # 4. Use refresh token to get new access token
        refresh_response = await async_client.post("/api/v1/auth/jwt/refresh", json={
            "refresh_token": refresh_token
        })
        assert refresh_response.status_code == 200
        new_access_token = refresh_response.json()["access_token"]
        
        # 5. Use new access token
        new_headers = {"Authorization": f"Bearer {new_access_token}"}
        new_profile_response = await async_client.get("/api/v1/user/me", headers=new_headers)
        assert new_profile_response.status_code == 200

    async def test_concurrent_user_operations(self, async_client: AsyncClient, created_admin_user, admin_user_data):
        """Test concurrent operations by multiple users."""
        # Get admin token
        login_response = await async_client.post("/api/v1/auth/jwt/login", json={
            "user_id": admin_user_data["user_id"],
            "pin": admin_user_data["pin"]
        })
        admin_token = login_response.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create multiple staff users concurrently
        async def create_user(user_id):
            user_data = {
                "user_id": f"{user_id:02d}",
                "pin": "1111",
                "first_name": f"Concurrent{user_id}",
                "last_name": "User",
                "email": f"concurrent{user_id}@test.com",
                "role": "staff"
            }
            
            response = await async_client.post("/api/v1/user/create", 
                                             json=user_data, headers=admin_headers)
            return response
        
        # Create users concurrently
        tasks = [create_user(i) for i in range(10, 15)]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Check results
        successful_creates = 0
        for response in responses:
            if hasattr(response, 'status_code') and response.status_code == 200:
                successful_creates += 1
        
        # Should have created some users successfully
        assert successful_creates > 0

    async def test_error_recovery_workflow(self, async_client: AsyncClient, created_admin_user, admin_user_data):
        """Test error recovery and graceful handling."""
        # Get admin token
        login_response = await async_client.post("/api/v1/auth/jwt/login", json={
            "user_id": admin_user_data["user_id"],
            "pin": admin_user_data["pin"]
        })
        admin_token = login_response.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # 1. Try to create user with existing ID (should fail)
        existing_user_data = {
            "user_id": admin_user_data["user_id"],  # Already exists
            "pin": "1111",
            "first_name": "Duplicate",
            "last_name": "User",
            "email": "duplicate@test.com",
            "role": "staff"
        }
        
        create_response = await async_client.post("/api/v1/user/create", 
                                                json=existing_user_data, headers=admin_headers)
        assert create_response.status_code in [400, 409, 422]
        
        # 2. Try to access non-existent user
        nonexistent_response = await async_client.get("/api/v1/user/999", headers=admin_headers)
        assert nonexistent_response.status_code == 404
        
        # 3. Try to update non-existent user
        update_response = await async_client.put("/api/v1/user/999", 
                                               json={"first_name": "Updated"}, headers=admin_headers)
        assert update_response.status_code == 404
        
        # 4. Try malformed requests
        malformed_response = await async_client.post("/api/v1/user/create", 
                                                   json={"invalid": "data"}, headers=admin_headers)
        assert malformed_response.status_code == 422
        
        # 5. Verify system still works after errors
        profile_response = await async_client.get("/api/v1/user/me", headers=admin_headers)
        assert profile_response.status_code == 200

    async def test_api_health_monitoring_integration(self, async_client: AsyncClient, created_admin_user, admin_user_data):
        """Test API health and monitoring integration."""
        # Get admin token
        login_response = await async_client.post("/api/v1/auth/jwt/login", json={
            "user_id": admin_user_data["user_id"],
            "pin": admin_user_data["pin"]
        })
        admin_token = login_response.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # 1. Check basic health
        health_response = await async_client.get("/api/v1/user/health")
        assert health_response.status_code == 200
        health_data = health_response.json()
        assert health_data["status"] == "healthy"
        
        # 2. Check system health (admin only)
        system_health_response = await async_client.get("/api/v1/monitoring/system-health", 
                                                       headers=admin_headers)
        assert system_health_response.status_code == 200
        
        # 3. Check alerts status
        alerts_response = await async_client.get("/api/v1/monitoring/alerts-status", 
                                                headers=admin_headers)
        assert alerts_response.status_code == 200
        alerts_data = alerts_response.json()
        assert "system_status" in alerts_data
        
        # 4. Make some API calls to generate activity
        for _ in range(5):
            await async_client.get("/api/v1/user/me", headers=admin_headers)
        
        # 5. Check performance metrics (may not be available)
        perf_response = await async_client.get("/api/v1/monitoring/performance-metrics", 
                                             headers=admin_headers)
        assert perf_response.status_code in [200, 503]

    async def test_authentication_flow_variations(self, async_client: AsyncClient, created_admin_user, admin_user_data):
        """Test different authentication flow variations."""
        # 1. Standard login
        standard_response = await async_client.post("/api/v1/user/login", json={
            "user_id": admin_user_data["user_id"],
            "pin": admin_user_data["pin"]
        })
        assert standard_response.status_code == 200
        
        # 2. JWT login
        jwt_response = await async_client.post("/api/v1/auth/jwt/login", json={
            "user_id": admin_user_data["user_id"],
            "pin": admin_user_data["pin"]
        })
        assert jwt_response.status_code == 200
        
        # 3. OAuth2-style token endpoint
        token_response = await async_client.post("/api/v1/auth/jwt/token", json={
            "user_id": admin_user_data["user_id"],
            "pin": admin_user_data["pin"]
        })
        assert token_response.status_code == 200
        
        # 4. Login with refresh token
        refresh_response = await async_client.post("/api/v1/auth/jwt/login-with-refresh", json={
            "user_id": admin_user_data["user_id"],
            "pin": admin_user_data["pin"]
        })
        assert refresh_response.status_code == 200
        
        # All should return tokens
        for response in [standard_response, jwt_response, token_response, refresh_response]:
            data = response.json()
            assert "access_token" in data
            assert data["token_type"] == "bearer"

    async def test_edge_case_handling(self, async_client: AsyncClient, created_admin_user, admin_user_data):
        """Test edge cases and boundary conditions."""
        # Get admin token
        login_response = await async_client.post("/api/v1/auth/jwt/login", json={
            "user_id": admin_user_data["user_id"],
            "pin": admin_user_data["pin"]
        })
        admin_token = login_response.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # 1. Empty search query
        empty_search_response = await async_client.get("/api/v1/user/list?search=", 
                                                      headers=admin_headers)
        assert empty_search_response.status_code == 200
        
        # 2. Maximum page size
        max_page_response = await async_client.get("/api/v1/user/list?per_page=100", 
                                                  headers=admin_headers)
        assert max_page_response.status_code == 200
        
        # 3. Boundary page numbers
        zero_page_response = await async_client.get("/api/v1/user/list?page=0", 
                                                   headers=admin_headers)
        assert zero_page_response.status_code in [200, 422]  # Depends on validation
        
        large_page_response = await async_client.get("/api/v1/user/list?page=999999", 
                                                    headers=admin_headers)
        assert large_page_response.status_code == 200  # Should handle gracefully
        
        # 4. Invalid sort parameters
        invalid_sort_response = await async_client.get("/api/v1/user/list?sort_by=invalid_field", 
                                                      headers=admin_headers)
        assert invalid_sort_response.status_code in [200, 400, 422]  # Should handle gracefully