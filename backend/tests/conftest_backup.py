"""
Simple test configuration without database dependencies.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

# Import app with mocked dependencies
import sys
from unittest.mock import patch

# Mock problematic imports before importing the app
sys.modules['motor.motor_asyncio'] = MagicMock()
sys.modules['beanie'] = MagicMock()

from app.app import app


@pytest.fixture
def client() -> TestClient:
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def mock_user():
    """Mock user for testing."""
    user = MagicMock()
    user.user_id = "01"
    user.role = "admin"
    user.status = "active"
    user.first_name = "Test"
    user.last_name = "Admin"
    user.email = "admin@test.com"
    return user