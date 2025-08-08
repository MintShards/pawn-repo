"""
Customer endpoints testing.

Tests customer CRUD operations, authentication, and search functionality.
"""

import pytest
from httpx import AsyncClient
from fastapi import status

from app.models.customer_model import Customer, CustomerStatus


@pytest.mark.asyncio
async def test_create_customer_admin(async_client: AsyncClient, auth_headers_admin, clean_db):
    """Test customer creation by admin user"""
    customer_data = {
        "phone_number": "5551234567",
        "first_name": "John",
        "last_name": "Smith",
        "email": "john.smith@email.com",
        "notes": "Test customer"
    }
    
    response = await async_client.post(
        "/api/v1/customer/",
        json=customer_data,
        headers=auth_headers_admin
    )
    
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["phone_number"] == customer_data["phone_number"]
    assert data["first_name"] == customer_data["first_name"]
    assert data["status"] == "active"
    assert data["total_transactions"] == 0


@pytest.mark.asyncio
async def test_create_customer_staff(async_client: AsyncClient, auth_headers_staff, clean_db):
    """Test customer creation by staff user"""
    customer_data = {
        "phone_number": "5559876543",
        "first_name": "Jane",
        "last_name": "Doe"
    }
    
    response = await async_client.post(
        "/api/v1/customer/",
        json=customer_data,
        headers=auth_headers_staff
    )
    
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["phone_number"] == customer_data["phone_number"]
    assert data["status"] == "active"


@pytest.mark.asyncio
async def test_create_customer_duplicate_phone(async_client: AsyncClient, auth_headers_admin, clean_db):
    """Test duplicate phone number rejection"""
    customer_data = {
        "phone_number": "5551234567",
        "first_name": "John",
        "last_name": "Smith"
    }
    
    # Create first customer
    response1 = await async_client.post(
        "/api/v1/customer/",
        json=customer_data,
        headers=auth_headers_admin
    )
    assert response1.status_code == status.HTTP_201_CREATED
    
    # Try to create duplicate
    response2 = await async_client.post(
        "/api/v1/customer/",
        json=customer_data,
        headers=auth_headers_admin
    )
    assert response2.status_code == status.HTTP_409_CONFLICT
    assert "already exists" in response2.json()["detail"]


@pytest.mark.asyncio 
async def test_create_customer_no_auth(async_client: AsyncClient, clean_db):
    """Test customer creation without authentication"""
    customer_data = {
        "phone_number": "5551234567",
        "first_name": "John",
        "last_name": "Smith"
    }
    
    response = await async_client.post("/api/v1/customer/", json=customer_data)
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_get_customers_list(async_client: AsyncClient, auth_headers_admin, clean_db):
    """Test getting customers list"""
    # Create test customers
    customers = [
        {"phone_number": "5551234567", "first_name": "John", "last_name": "Smith"},
        {"phone_number": "5559876543", "first_name": "Jane", "last_name": "Doe"}
    ]
    
    for customer_data in customers:
        await async_client.post("/api/v1/customer/", json=customer_data, headers=auth_headers_admin)
    
    # Get customers list
    response = await async_client.get("/api/v1/customer/", headers=auth_headers_admin)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "customers" in data
    assert data["total"] == 2
    assert len(data["customers"]) == 2


@pytest.mark.asyncio
async def test_get_customer_by_phone(async_client: AsyncClient, auth_headers_admin, clean_db):
    """Test getting customer by phone number"""
    customer_data = {
        "phone_number": "5551234567",
        "first_name": "John",
        "last_name": "Smith"
    }
    
    # Create customer
    await async_client.post("/api/v1/customer/", json=customer_data, headers=auth_headers_admin)
    
    # Get customer by phone
    response = await async_client.get(
        f"/api/v1/customer/{customer_data['phone_number']}",
        headers=auth_headers_admin
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["phone_number"] == customer_data["phone_number"]
    assert data["first_name"] == customer_data["first_name"]


@pytest.mark.asyncio
async def test_get_customer_not_found(async_client: AsyncClient, auth_headers_admin, clean_db):
    """Test getting non-existent customer"""
    response = await async_client.get("/api/v1/customer/9999999999", headers=auth_headers_admin)
    
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_update_customer_admin(async_client: AsyncClient, auth_headers_admin, clean_db):
    """Test updating customer as admin"""
    customer_data = {
        "phone_number": "5551234567",
        "first_name": "John",
        "last_name": "Smith"
    }
    
    # Create customer
    await async_client.post("/api/v1/customer/", json=customer_data, headers=auth_headers_admin)
    
    # Update customer
    update_data = {
        "first_name": "Updated John",
        "status": "suspended"
    }
    
    response = await async_client.put(
        f"/api/v1/customer/{customer_data['phone_number']}",
        json=update_data,
        headers=auth_headers_admin
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["first_name"] == "Updated John"
    assert data["status"] == "suspended"


@pytest.mark.asyncio
async def test_update_customer_staff_no_status_change(async_client: AsyncClient, auth_headers_admin, auth_headers_staff, clean_db):
    """Test staff cannot change customer status"""
    customer_data = {
        "phone_number": "5551234567",
        "first_name": "John",
        "last_name": "Smith"
    }
    
    # Create customer as admin
    await async_client.post("/api/v1/customer/", json=customer_data, headers=auth_headers_admin)
    
    # Try to update status as staff
    update_data = {
        "first_name": "Updated John",
        "status": "suspended"
    }
    
    response = await async_client.put(
        f"/api/v1/customer/{customer_data['phone_number']}",
        json=update_data,
        headers=auth_headers_staff
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["first_name"] == "Updated John"
    assert data["status"] == "active"  # Status unchanged


@pytest.mark.asyncio
async def test_customer_search(async_client: AsyncClient, auth_headers_admin, clean_db):
    """Test customer search functionality"""
    customers = [
        {"phone_number": "5551234567", "first_name": "John", "last_name": "Smith"},
        {"phone_number": "5559876543", "first_name": "Jane", "last_name": "Doe"},
        {"phone_number": "5555555555", "first_name": "Bob", "last_name": "Johnson"}
    ]
    
    # Create customers
    for customer_data in customers:
        await async_client.post("/api/v1/customer/", json=customer_data, headers=auth_headers_admin)
    
    # Search by first name
    response = await async_client.get("/api/v1/customer/?search=John", headers=auth_headers_admin)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total"] >= 1
    # Should find both "John" and "Johnson"
    found_names = [customer["first_name"] for customer in data["customers"]]
    assert "John" in found_names


@pytest.mark.asyncio
async def test_customer_pagination(async_client: AsyncClient, auth_headers_admin, clean_db):
    """Test customer list pagination"""
    # Create multiple customers
    for i in range(5):
        customer_data = {
            "phone_number": f"555123456{i}",
            "first_name": f"Customer{i}",
            "last_name": "Test"
        }
        await async_client.post("/api/v1/customer/", json=customer_data, headers=auth_headers_admin)
    
    # Test pagination
    response = await async_client.get("/api/v1/customer/?page=1&per_page=2", headers=auth_headers_admin)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data["customers"]) == 2
    assert data["page"] == 1
    assert data["per_page"] == 2
    assert data["total"] == 5
    assert data["pages"] == 3


@pytest.mark.asyncio
async def test_customer_statistics_admin(async_client: AsyncClient, auth_headers_admin, clean_db):
    """Test customer statistics for admin"""
    # Create test customers
    customers = [
        {"phone_number": "5551234567", "first_name": "John", "last_name": "Smith"},
        {"phone_number": "5559876543", "first_name": "Jane", "last_name": "Doe"}
    ]
    
    for customer_data in customers:
        await async_client.post("/api/v1/customer/", json=customer_data, headers=auth_headers_admin)
    
    # Get statistics
    response = await async_client.get("/api/v1/customer/stats", headers=auth_headers_admin)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "total_customers" in data
    assert "active_customers" in data
    assert data["total_customers"] >= 2
    assert data["active_customers"] >= 2


@pytest.mark.asyncio
async def test_customer_statistics_staff_forbidden(async_client: AsyncClient, auth_headers_staff, clean_db):
    """Test staff cannot access customer statistics"""
    response = await async_client.get("/api/v1/customer/stats", headers=auth_headers_staff)
    
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "Admin privileges required" in response.json()["detail"]


@pytest.mark.asyncio
async def test_invalid_phone_formats(async_client: AsyncClient, auth_headers_admin, clean_db):
    """Test invalid phone number validation"""
    invalid_phones = ["123", "12345678901", "555-123-4567", "abcdefghij"]
    
    for phone in invalid_phones:
        customer_data = {
            "phone_number": phone,
            "first_name": "Test",
            "last_name": "User"
        }
        
        response = await async_client.post(
            "/api/v1/customer/",
            json=customer_data,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.asyncio
async def test_customer_validation_errors(async_client: AsyncClient, auth_headers_admin, clean_db):
    """Test various validation errors"""
    # Empty first name
    response = await async_client.post(
        "/api/v1/customer/",
        json={"phone_number": "5551234567", "first_name": "", "last_name": "Smith"},
        headers=auth_headers_admin
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    # Invalid email
    response = await async_client.post(
        "/api/v1/customer/",
        json={
            "phone_number": "5559876543",
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "invalid-email"
        },
        headers=auth_headers_admin
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

@pytest.mark.asyncio
async def test_deactivate_customer_admin(async_client: AsyncClient, auth_headers_admin, clean_db):
    """Test customer deactivation by admin user"""
    # Create a test customer first
    customer_data = {
        "phone_number": "5558887777",
        "first_name": "Deactivate",
        "last_name": "Test",
        "email": "deactivate.test@email.com"
    }
    await async_client.post("/api/v1/customer/", json=customer_data, headers=auth_headers_admin)
    
    # Test deactivation
    response = await async_client.post(
        f"/api/v1/customer/{customer_data['phone_number']}/deactivate",
        headers=auth_headers_admin
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "deactivated"
    assert data["phone_number"] == customer_data["phone_number"]


@pytest.mark.asyncio
async def test_archive_customer_admin(async_client: AsyncClient, auth_headers_admin, clean_db):
    """Test customer archival by admin user"""
    # Create a test customer first
    customer_data = {
        "phone_number": "5559998888",
        "first_name": "Archive",
        "last_name": "Test",
        "email": "archive.test@email.com"
    }
    await async_client.post("/api/v1/customer/", json=customer_data, headers=auth_headers_admin)
    
    # Test archival
    response = await async_client.post(
        f"/api/v1/customer/{customer_data['phone_number']}/archive",
        headers=auth_headers_admin
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "archived"
    assert data["phone_number"] == customer_data["phone_number"]
