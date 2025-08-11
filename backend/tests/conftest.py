"""
Test configuration and fixtures for the pawnshop API tests.
"""

import asyncio
import os
from typing import AsyncGenerator, Generator
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.app import app
from app.models.user_model import User
from app.models.customer_model import Customer
from app.models.pawn_transaction_model import PawnTransaction
from app.models.pawn_item_model import PawnItem
from app.models.payment_model import Payment
from app.models.extension_model import Extension
from app.core.config import settings


# Set test environment
os.environ["TESTING"] = "true"


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def db_client():
    """Create test database client and initialize models."""
    # Use in-memory database for tests or test database
    test_db_url = "mongodb://localhost:27017/pawnshop_test"
    client = AsyncIOMotorClient(test_db_url)
    database = client.get_default_database()
    
    # Initialize Beanie with test database
    await init_beanie(
        database=database,
        document_models=[User, Customer, PawnTransaction, PawnItem, Payment, Extension]
    )
    
    yield database
    
    # Cleanup - drop test database
    await client.drop_database("pawnshop_test")
    client.close()


@pytest_asyncio.fixture
async def clean_db(db_client):
    """Clean database before each test."""
    # Clear all collections
    await User.delete_all()
    await Customer.delete_all()
    await PawnTransaction.delete_all()
    await PawnItem.delete_all()
    await Payment.delete_all()
    await Extension.delete_all()
    yield
    # Clean up after test
    await User.delete_all()
    await Customer.delete_all()
    await PawnTransaction.delete_all()
    await PawnItem.delete_all()
    await Payment.delete_all()
    await Extension.delete_all()


@pytest.fixture
def client() -> TestClient:
    """Create test client."""
    return TestClient(app)


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Create async test client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_db_client():
    """Mock database client for unit tests."""
    return MagicMock()


# Test user data - Updated to match seed.py configuration
@pytest.fixture
def admin_user_data():
    """Test admin user data - matches actual seeded admin user."""
    return {
        "user_id": "69",  # Actual admin ID from seed.py
        "pin": "6969",    # Actual admin PIN from seed.py
        "first_name": "Admin",
        "last_name": "Boss",
        "email": "admin@pawnshop.com",
        "role": "admin",
        "status": "active"
    }


@pytest.fixture
def staff_user_data():
    """Test staff user data - matches actual seeded staff user."""
    return {
        "user_id": "02", 
        "pin": "1234",   # Actual staff PIN from seed.py
        "first_name": "John",
        "last_name": "Staff",
        "email": "staff@pawnshop.com",
        "role": "staff",
        "status": "active"
    }


@pytest.fixture
def inactive_user_data():
    """Test inactive user data - for testing deactivated accounts."""
    return {
        "user_id": "98",  # Use existing deactivated user ID
        "pin": "9898",    # Different PIN for test isolation
        "first_name": "Inactive",
        "last_name": "User", 
        "email": "inactive@test.com",
        "role": "staff",
        "status": "deactivated"  # Match actual enum value
    }


@pytest_asyncio.fixture
async def created_admin_user(clean_db, admin_user_data):
    """Create admin user in database."""
    user = User(
        user_id=admin_user_data["user_id"],
        pin_hash=User.hash_pin(admin_user_data["pin"]),
        first_name=admin_user_data["first_name"],
        last_name=admin_user_data["last_name"],
        email=admin_user_data["email"],
        role=admin_user_data["role"],
        status=admin_user_data["status"]
    )
    await user.insert()
    return user


@pytest_asyncio.fixture
async def created_staff_user(clean_db, staff_user_data):
    """Create staff user in database."""
    user = User(
        user_id=staff_user_data["user_id"],
        pin_hash=User.hash_pin(staff_user_data["pin"]),
        first_name=staff_user_data["first_name"],
        last_name=staff_user_data["last_name"],
        email=staff_user_data["email"],
        role=staff_user_data["role"],
        status=staff_user_data["status"]
    )
    await user.insert()
    return user


@pytest_asyncio.fixture
async def created_inactive_user(clean_db, inactive_user_data):
    """Create inactive user in database."""
    user = User(
        user_id=inactive_user_data["user_id"],
        pin_hash=User.hash_pin(inactive_user_data["pin"]),
        first_name=inactive_user_data["first_name"],
        last_name=inactive_user_data["last_name"],
        email=inactive_user_data["email"],
        role=inactive_user_data["role"],
        status=inactive_user_data["status"]
    )
    await user.insert()
    return user


@pytest_asyncio.fixture
async def admin_token(created_admin_user, admin_user_data, async_client):
    """Get JWT token for admin user."""
    response = await async_client.post("/api/v1/auth/jwt/login", json={
        "user_id": admin_user_data["user_id"],
        "pin": admin_user_data["pin"]
    })
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest_asyncio.fixture
async def staff_token(created_staff_user, staff_user_data, async_client):
    """Get JWT token for staff user."""
    response = await async_client.post("/api/v1/auth/jwt/login", json={
        "user_id": staff_user_data["user_id"],
        "pin": staff_user_data["pin"]
    })
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
def auth_headers_admin(admin_token):
    """Authorization headers for admin user."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def auth_headers_staff(staff_token):
    """Authorization headers for staff user."""
    return {"Authorization": f"Bearer {staff_token}"}


@pytest.fixture
def invalid_auth_headers():
    """Invalid authorization headers."""
    return {"Authorization": "Bearer invalid_token"}