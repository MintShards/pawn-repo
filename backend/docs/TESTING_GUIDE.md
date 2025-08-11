# Testing Guide

Comprehensive testing guide for the Pawnshop Operations System.

## Overview

The testing suite includes unit tests, integration tests, API tests, and performance benchmarks to ensure system reliability and quality.

## Test Structure

```
tests/
├── conftest.py              # Test configuration and fixtures
├── test_api_structure.py    # API endpoint validation
├── test_auth_jwt.py         # Authentication and authorization
├── test_customer_api.py     # Customer management tests
├── test_pawn_integration.py # Pawn transaction integration tests
└── test_user_endpoints.py   # User management tests
```

## Setup and Configuration

### Prerequisites
```bash
pip install -r requirements-test.txt
```

### Test Dependencies
- **pytest**: Test framework
- **pytest-asyncio**: Async test support
- **httpx**: HTTP client for API testing
- **pytest-cov**: Code coverage analysis
- **pytest-mock**: Mocking utilities

### Environment Setup
```bash
# Create test environment file
cp .env .env.test

# Modify for testing
TEST_MONGO_CONNECTION_STRING=mongodb://localhost:27017/pawnshop_test
DEBUG=true
```

## Running Tests

### All Tests
```bash
pytest
```

### Specific Test Categories
```bash
# Authentication tests
pytest tests/test_auth_jwt.py -v

# Customer API tests
pytest tests/test_customer_api.py -v

# Integration tests
pytest tests/test_pawn_integration.py -v

# API structure tests
pytest tests/test_api_structure.py -v

# User management tests
pytest tests/test_user_endpoints.py -v
```

### Coverage Analysis
```bash
# Run with coverage
pytest --cov=app --cov-report=html --cov-report=term

# Coverage report location
open htmlcov/index.html
```

### Performance Testing
```bash
# Run performance benchmarks
pytest tests/ -k "performance" --benchmark-only

# Load testing
python -m pytest tests/test_api_structure.py::test_load_testing -s
```

## Test Categories

### 1. Authentication Tests (`test_auth_jwt.py`)

**Coverage:**
- PIN-based authentication
- JWT token generation and validation
- Token refresh mechanisms
- Role-based access control
- Session management

**Key Test Scenarios:**
```python
def test_login_valid_credentials():
    # Test successful authentication with valid PIN

def test_login_invalid_credentials():
    # Test authentication failure with invalid PIN

def test_token_refresh():
    # Test token refresh functionality

def test_protected_endpoints():
    # Test access control on protected endpoints
```

### 2. Customer API Tests (`test_customer_api.py`)

**Coverage:**
- Customer creation and validation
- Customer information retrieval
- Customer status management
- Phone number uniqueness
- Data validation and error handling

**Key Test Scenarios:**
```python
def test_create_customer():
    # Test customer creation with valid data

def test_duplicate_phone_number():
    # Test phone number uniqueness constraint

def test_update_customer_status():
    # Test customer status changes

def test_customer_data_validation():
    # Test input validation and error responses
```

### 3. Pawn Integration Tests (`test_pawn_integration.py`)

**Coverage:**
- Complete pawn transaction workflows
- Multi-item transactions
- Payment processing
- Extension handling
- Interest calculations
- Receipt generation

**Key Test Scenarios:**
```python
def test_complete_pawn_workflow():
    # Test end-to-end pawn transaction process

def test_payment_processing():
    # Test partial and full payment scenarios

def test_extension_processing():
    # Test loan extension workflows

def test_interest_calculations():
    # Test interest calculation accuracy

def test_receipt_generation():
    # Test receipt generation for all scenarios
```

### 4. API Structure Tests (`test_api_structure.py`)

**Coverage:**
- API endpoint availability
- HTTP method validation
- Response format consistency
- Error handling standardization
- Performance benchmarks

**Key Test Scenarios:**
```python
def test_endpoint_availability():
    # Test all endpoints are accessible

def test_cors_configuration():
    # Test CORS headers and configuration

def test_rate_limiting():
    # Test rate limiting functionality

def test_response_formats():
    # Test consistent response formats
```

### 5. User Management Tests (`test_user_endpoints.py`)

**Coverage:**
- User creation and management
- Role-based permissions
- User profile operations
- Administrative functions

**Key Test Scenarios:**
```python
def test_create_user():
    # Test user creation with proper permissions

def test_user_permissions():
    # Test role-based access control

def test_user_profile_operations():
    # Test user profile management
```

## Test Fixtures and Utilities

### Common Fixtures (`conftest.py`)

```python
@pytest.fixture
async def async_client():
    # HTTP client for API testing
    
@pytest.fixture
async def authenticated_admin():
    # Admin user with valid JWT token
    
@pytest.fixture
async def authenticated_staff():
    # Staff user with valid JWT token
    
@pytest.fixture
async def test_customer():
    # Sample customer data for testing
    
@pytest.fixture
async def test_transaction():
    # Sample pawn transaction for testing
```

### Database Management
```python
@pytest.fixture(autouse=True)
async def clean_database():
    # Clean test database before each test
    
@pytest.fixture
async def seed_test_data():
    # Seed database with test data
```

## Performance Testing

### Load Testing
```python
def test_concurrent_authentication():
    # Test multiple concurrent login attempts
    
def test_api_response_times():
    # Measure API response times under load
    
def test_database_performance():
    # Test database query performance
```

### Benchmarks
- **Authentication**: <100ms response time
- **Customer operations**: <50ms response time
- **Transaction queries**: <200ms response time
- **Payment processing**: <150ms response time

## Integration Testing

### End-to-End Scenarios

**Complete Transaction Workflow:**
1. Create customer
2. Create pawn transaction
3. Process payment
4. Generate receipt
5. Verify data integrity

**Extension Workflow:**
1. Create overdue transaction
2. Process extension
3. Verify new maturity date
4. Generate extension receipt

**Multi-Item Transaction:**
1. Create transaction with multiple items
2. Process partial payment
3. Verify interest calculations
4. Test individual item tracking

## Mocking and Test Doubles

### External Dependencies
```python
@pytest.fixture
def mock_mongodb():
    # Mock MongoDB operations for unit tests
    
@pytest.fixture
def mock_jwt_service():
    # Mock JWT token generation/validation
```

### Test Data Generation
```python
def generate_customer_data():
    # Generate random customer data for testing
    
def generate_transaction_data():
    # Generate random transaction data for testing
```

## Test Maintenance

### Regular Tasks
```bash
# Update test dependencies
pip install -U pytest pytest-asyncio httpx

# Run full test suite
pytest --cov=app --cov-report=html

# Check test coverage requirements
pytest --cov=app --cov-fail-under=80
```

### Test Quality Metrics
- **Code coverage**: Minimum 80%
- **Test execution time**: <30 seconds for full suite
- **Test reliability**: 100% pass rate
- **Performance benchmarks**: Within defined thresholds

## Continuous Integration

### GitHub Actions Configuration
```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:5.0
        ports:
          - 27017:27017
    
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v3
      with:
        python-version: 3.9
    
    - name: Install dependencies
      run: |
        pip install -r requirements-test.txt
    
    - name: Run tests
      run: |
        pytest --cov=app --cov-report=xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

## Troubleshooting

### Common Issues

**1. Database Connection Errors**
```bash
# Check MongoDB test instance
mongosh mongodb://localhost:27017/pawnshop_test

# Verify test database isolation
pytest tests/test_customer_api.py::test_database_isolation
```

**2. Authentication Test Failures**
```bash
# Check JWT configuration
pytest tests/test_auth_jwt.py::test_jwt_configuration -v

# Verify test user creation
pytest tests/test_auth_jwt.py::test_create_test_users -v
```

**3. Async Test Issues**
```bash
# Check pytest-asyncio configuration
pytest --asyncio-mode=auto

# Verify async fixtures
pytest tests/conftest.py::test_async_fixtures -v
```

## Best Practices

### Test Writing Guidelines
1. **Descriptive Names**: Use clear, descriptive test function names
2. **Single Responsibility**: Each test should verify one specific behavior
3. **Independent Tests**: Tests should not depend on each other
4. **Cleanup**: Always clean up test data after tests
5. **Mocking**: Mock external dependencies appropriately

### Performance Considerations
1. **Database Operations**: Use transactions for test data management
2. **Parallel Execution**: Design tests for parallel execution
3. **Resource Management**: Properly close connections and clean up resources
4. **Test Data**: Use minimal test data sets for faster execution

### Documentation
1. **Test Documentation**: Document complex test scenarios
2. **Coverage Reports**: Maintain coverage reports and trends
3. **Performance Metrics**: Track performance test results over time
4. **Test Maintenance**: Regular test suite maintenance and updates

## Test Data Management

### Sample Data Files
```
tests/fixtures/
├── customers.json           # Sample customer data
├── transactions.json        # Sample transaction data
├── payments.json           # Sample payment data
└── users.json              # Sample user data
```

### Data Generation Scripts
```python
# Generate test data
python scripts/generate_test_data.py

# Load test fixtures
python scripts/load_test_fixtures.py
```

## Quality Gates

Tests must pass these quality gates:
- [ ] All tests pass (100% success rate)
- [ ] Code coverage ≥80%
- [ ] Performance benchmarks met
- [ ] No security vulnerabilities detected
- [ ] API documentation updated
- [ ] Test documentation current

## Reporting

### Test Results
- **Console Output**: Real-time test execution feedback
- **HTML Coverage Report**: Detailed coverage analysis
- **Performance Reports**: Benchmark results and trends
- **CI/CD Integration**: Automated test reporting in pipelines