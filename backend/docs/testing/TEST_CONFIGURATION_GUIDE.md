# 📋 Test Configuration Guide

**Updated**: 2025-08-08  
**Purpose**: Correct test credentials and configurations to match actual database setup

---

## 🔑 Test Credentials

### ✅ Correct Test Credentials (Updated)

Based on the actual seeded database (`seed.py`), use these credentials:

#### Admin User
```python
{
    "user_id": "69",     # Admin user from seed.py
    "pin": "6969",       # Actual admin PIN
    "role": "admin"
}
```

#### Staff User  
```python
{
    "user_id": "02",     # Staff user from seed.py  
    "pin": "1234",       # Actual staff PIN
    "role": "staff"
}
```

#### Test User (for creation tests)
```python
{
    "user_id": "99",     # New user ID for tests
    "pin": "9999",       # Test PIN
    "role": "staff"
}
```

### ❌ Outdated Credentials (Do Not Use)

These credentials were used in old tests but don't match the database:

```python
# WRONG - Don't use these
{"user_id": "01", "pin": "1234"}  # User 01 exists but PIN is "0000"
{"user_id": "02", "pin": "5678"}  # User 02 exists but PIN is "1234"
```

---

## 🌐 API Endpoints

### Customer Endpoints

#### ✅ Correct Customer API Paths
```
POST /api/v1/customer/        # Create customer (primary route)
POST /api/v1/customer/create  # Create customer (alias route)
GET  /api/v1/customer/        # List customers
GET  /api/v1/customer/{phone} # Get customer by phone
PUT  /api/v1/customer/{phone} # Update customer
```

#### ❌ Incorrect Paths (Do Not Use)
```
POST /api/v1/customer/create  # Was returning 405 (now fixed)
GET  /api/v1/customer/list    # Wrong - use /customer/ instead
```

### User Endpoints
```
POST /api/v1/user/login       # User login (not JWT)
POST /api/v1/auth/jwt/login   # JWT authentication
GET  /api/v1/user/me          # Current user profile
POST /api/v1/user/create      # Create user (admin only)
GET  /api/v1/user/list        # List users
GET  /api/v1/user/stats       # User statistics (admin only)
```

---

## 📊 Database Schema

### Customer Creation Schema

#### ✅ Correct Customer Data Format
```json
{
    "phone_number": "1234567890",  // Required: 10-digit string
    "first_name": "John",          // Required: 1-50 chars
    "last_name": "Doe",            // Required: 1-50 chars
    "email": "john@example.com",   // Optional: valid email
    "notes": "Staff notes"         // Optional: max 1000 chars
}
```

#### ❌ Incorrect Format (Causes 422 Error)
```json
{
    "phone": "1234567890",         // WRONG - should be "phone_number"
    "first_name": "John",
    "last_name": "Doe"
}
```

### User Creation Schema
```json
{
    "user_id": "99",               // Required: 2-digit string
    "pin": "9999",                 // Required: 4-digit string
    "first_name": "Test",          // Required
    "last_name": "User",           // Required
    "email": "test@example.com",   // Optional
    "role": "staff"                // Required: "admin" or "staff"
}
```

---

## 🧪 Test Environment Setup

### Prerequisites
1. MongoDB running on `localhost:27017`
2. Python virtual environment activated
3. All dependencies installed (`pip install -r requirements-test.txt`)

### Database Setup

#### Option 1: Use Seeded Database (Recommended)
```bash
# Seed the main database (if not already done)
python seed.py

# Tests will use these actual users:
# - Admin: user_id="69", pin="6969"
# - Staff: user_id="02", pin="1234"
```

#### Option 2: Use Clean Test Database
```bash
# Tests will create their own users using conftest.py fixtures
# Database: pawnshop_test (automatically created/cleaned)
pytest tests/
```

### Running Tests

#### All Tests
```bash
pytest tests/ -v
```

#### Specific Test Categories
```bash
pytest tests/test_auth_jwt.py -v           # JWT authentication
pytest tests/test_customer_api.py -v       # Customer endpoints
pytest tests/test_user_endpoints.py -v     # User management
pytest tests/test_integration.py -v        # Integration tests
```

#### With Coverage
```bash
pytest tests/ --cov=app --cov-report=html -v
```

---

## 🔧 Common Issues & Solutions

### Issue: "Invalid credentials" on login
**Solution**: Use correct PINs from this guide
```python
# Correct
{"user_id": "69", "pin": "6969"}    # Admin
{"user_id": "02", "pin": "1234"}    # Staff

# Wrong  
{"user_id": "01", "pin": "1234"}    # User 01 PIN is "0000"
```

### Issue: "Field required" error on customer creation
**Solution**: Use `phone_number`, not `phone`
```python
# Correct
{"phone_number": "1234567890", "first_name": "John", "last_name": "Doe"}

# Wrong
{"phone": "1234567890", "first_name": "John", "last_name": "Doe"}
```

### Issue: 405 Method Not Allowed on customer endpoints
**Solution**: Server restart required for new routes
```bash
# Stop server (Ctrl+C)
# Restart server
uvicorn app.app:app --reload --host 0.0.0.0 --port 8000
```

### Issue: Tests failing due to database conflicts
**Solution**: Use clean test database
```python
# In conftest.py - already configured
test_db_url = "mongodb://localhost:27017/pawnshop_test"
# Tests automatically clean database between runs
```

---

## 📖 Authentication Flow

### JWT Authentication Flow
```python
# 1. Login to get token
response = requests.post("/api/v1/auth/jwt/login", json={
    "user_id": "69",
    "pin": "6969"
})
token = response.json()["access_token"]

# 2. Use token for authenticated requests  
headers = {"Authorization": f"Bearer {token}"}
response = requests.get("/api/v1/user/me", headers=headers)
```

### Expected Status Codes
```
200 - Success
201 - Created
401 - Authentication required/failed
403 - Forbidden (inactive user, insufficient role)
404 - Not found
405 - Method not allowed (wrong HTTP method)
409 - Conflict (duplicate phone number, etc.)
422 - Validation error (wrong field names, etc.)
500 - Server error
```

---

## 🎯 Test Best Practices

### Use Fixtures for Consistent Data
```python
def test_admin_functionality(admin_token, auth_headers_admin):
    # Uses correct admin credentials automatically
    response = client.get("/api/v1/user/stats", headers=auth_headers_admin)
    assert response.status_code == 200
```

### Clean Database Between Tests
```python
async def test_customer_creation(clean_db, async_client):
    # Database is automatically cleaned before this test
    # No conflicts with existing data
```

### Use Async Client for API Tests
```python
async def test_api_endpoint(async_client):
    response = await async_client.post("/api/v1/customer/", json=data)
    assert response.status_code == 201
```

---

**✅ This guide ensures test consistency with the actual database configuration and API behavior.**