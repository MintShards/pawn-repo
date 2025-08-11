# Pawnshop Operations System

A comprehensive FastAPI-based backend system for pawnshop operations, managing customers, pawn transactions, payments, and generating detailed receipts and reports.

## Features

### Core Functionality
- **Customer Management**: Complete customer lifecycle with status tracking
- **Pawn Transactions**: Multi-item pawn transactions with automated maturity tracking
- **Payment Processing**: Partial and full payment support with interest calculations
- **Extension Management**: Loan extensions with automated fee calculations
- **Receipt System**: Professional receipts for all transaction types
- **User Authentication**: PIN-based authentication with JWT tokens
- **Role-Based Access**: Admin and staff role permissions
- **Audit Logging**: Complete audit trail for all operations

### Technical Features
- **FastAPI Framework**: Modern, fast web framework with automatic API documentation
- **MongoDB Integration**: Document-based storage with Beanie ODM
- **Async Operations**: Full async/await support for high performance
- **JWT Authentication**: Secure token-based authentication
- **Data Validation**: Pydantic schemas for robust data validation
- **API Documentation**: Auto-generated OpenAPI/Swagger documentation
- **Monitoring**: Health checks and system metrics
- **Testing Suite**: Comprehensive test coverage with automated testing

## Quick Start

### Prerequisites
- Python 3.8+
- MongoDB 4.4+
- Virtual environment (recommended)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd pawn-repo/backend
```

2. **Set up virtual environment**
```bash
python -m venv env
source env/bin/activate  # Linux/Mac
env\Scripts\activate     # Windows
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your MongoDB connection and JWT secrets
```

5. **Seed the database**
```bash
python seed.py
```

6. **Start the development server**
```bash
uvicorn app.app:app --reload --host 0.0.0.0 --port 8000
```

7. **Access the application**
- API: http://localhost:8000
- Documentation: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc

## Project Structure

```
backend/
├── app/
│   ├── api/                 # API routing and endpoints
│   │   ├── api_v1/         # Version 1 API routes
│   │   │   ├── handlers/   # Request handlers
│   │   │   └── router.py   # Route definitions
│   │   ├── auth/           # Authentication logic
│   │   └── deps/           # Dependency injection
│   ├── core/               # Core application logic
│   │   ├── config.py       # Application configuration
│   │   ├── security.py     # Security utilities
│   │   └── monitoring.py   # System monitoring
│   ├── models/             # Database models (Beanie)
│   ├── schemas/            # Pydantic schemas
│   ├── services/           # Business logic layer
│   └── app.py              # FastAPI application factory
├── tests/                  # Test suite
├── docs/                   # Documentation
├── config/                 # Configuration files
├── requirements.txt        # Dependencies
├── seed.py                 # Database seeding
└── CLAUDE.md              # Development guidance
```

## Authentication

The system uses PIN-based authentication with JWT tokens.

### Default Test Credentials

**Admin User:**
- User ID: `69`
- PIN: `6969`
- Role: `admin` (full access)

**Staff User:**
- User ID: `02`
- PIN: `1234`
- Role: `staff` (operational access)

### Authentication Flow

1. **Login**: POST `/api/v1/auth/jwt/login` with user_id and pin
2. **Receive Tokens**: Get access_token and refresh_token
3. **Access Protected Endpoints**: Include `Authorization: Bearer <token>` header
4. **Token Refresh**: Use refresh_token to get new access_token

## Core Business Logic

### Customer Management
- Unique identification by phone number
- Status tracking: Active, Suspended, Banned
- Complete transaction history
- Contact information management

### Pawn Transaction Lifecycle
1. **Item Intake**: Multiple items per transaction with descriptions
2. **Loan Processing**: Manual loan amount and interest rate entry
3. **Storage Assignment**: Physical location tracking
4. **Maturity Tracking**: 97-day forfeiture logic
5. **Status Management**: Active → Overdue → Extended/Redeemed/Forfeited → Sold

### Payment Processing
- **Partial Payments**: Applied to oldest interest first, then principal
- **Interest Calculations**: Continuous accrual on unpaid balance
- **Payment Methods**: Cash, card, check, other
- **Receipt Generation**: Automatic receipt for every payment

### Extension Management
- **Extension Options**: 30, 60, or 90-day extensions
- **Fee Calculation**: Manual extension fee entry
- **Date Calculation**: Extensions from original maturity date
- **Receipt Generation**: Extension receipts with new terms

## API Overview

### Core Endpoints

**Authentication:**
- `POST /api/v1/auth/jwt/login` - User login
- `POST /api/v1/auth/jwt/refresh` - Token refresh
- `GET /api/v1/auth/jwt/verify` - Token verification

**Customer Management:**
- `POST /api/v1/customer/` - Create customer
- `GET /api/v1/customer/` - List customers
- `GET /api/v1/customer/{phone}` - Get customer by phone
- `PUT /api/v1/customer/{phone}` - Update customer

**Pawn Transactions:**
- `POST /api/v1/pawn-transaction/` - Create transaction
- `GET /api/v1/pawn-transaction/` - List transactions
- `GET /api/v1/pawn-transaction/{id}` - Get transaction
- `PUT /api/v1/pawn-transaction/{id}/status` - Update status

**Payments:**
- `POST /api/v1/payment/` - Record payment
- `GET /api/v1/payment/transaction/{id}` - Get payments

**Extensions:**
- `POST /api/v1/extension/` - Create extension
- `GET /api/v1/extension/transaction/{id}` - Get extensions

### Response Format

All API responses follow a consistent format:

**Success Response:**
```json
{
    "data": { ... },
    "message": "Success message",
    "timestamp": "2025-01-15T10:30:00Z"
}
```

**Error Response:**
```json
{
    "detail": "Error description",
    "error_code": "SPECIFIC_ERROR_CODE",
    "timestamp": "2025-01-15T10:30:00Z"
}
```

## Configuration

### Environment Variables

```bash
# Database Configuration
MONGO_CONNECTION_STRING=mongodb://localhost:27017/pawnshop

# JWT Configuration
JWT_SECRET_KEY=your-secret-key-here
JWT_REFRESH_SECRET_KEY=your-refresh-secret-key-here
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# API Configuration
API_V1_PREFIX=/api/v1
PROJECT_NAME=Pawnshop Operations API
VERSION=1.0.0
DEBUG=false

# CORS Configuration
ALLOWED_ORIGINS=["http://localhost:3000"]
```

### MongoDB Configuration

The system uses MongoDB with connection pooling for reliability:
- **Pool Size**: 5-20 connections
- **Connection Timeout**: 5 seconds
- **Retry Logic**: Automatic retries for transient failures
- **Atomic Operations**: Transaction support for data consistency

## Testing

### Running Tests

```bash
# Install test dependencies
pip install -r requirements-test.txt

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test categories
pytest tests/test_auth_jwt.py -v
pytest tests/test_customer_api.py -v
pytest tests/test_pawn_integration.py -v
```

### Test Coverage
- **Target Coverage**: 80% minimum
- **Test Categories**: Unit, integration, API, performance
- **Test Data**: Automated test data generation
- **CI/CD Integration**: Automated testing in deployment pipeline

## Development

### Code Quality
- **Linting**: pylint for code quality
- **Formatting**: Black for consistent formatting
- **Type Checking**: mypy for type safety
- **Security**: bandit for security scanning

### Development Workflow
1. **Branch**: Create feature branch from main
2. **Develop**: Implement feature with tests
3. **Test**: Run full test suite locally
4. **Review**: Submit pull request for review
5. **Deploy**: Merge to main triggers deployment

### Database Operations

```bash
# Seed database with test data
python seed.py

# Connect to MongoDB
mongosh mongodb://localhost:27017/pawnshop

# Backup database
mongodump --db pawnshop --out ./backup

# Restore database
mongorestore --db pawnshop ./backup/pawnshop
```

## Performance

### Optimization Features
- **Connection Pooling**: MongoDB connection reuse
- **Async Operations**: Non-blocking I/O operations
- **Query Optimization**: Indexed database queries
- **Response Caching**: Strategic caching where appropriate
- **Data Validation**: Early validation to prevent errors

### Performance Metrics
- **API Response Time**: <200ms for most endpoints
- **Database Queries**: <100ms average query time
- **Memory Usage**: <200MB typical memory footprint
- **Concurrent Users**: Supports 100+ concurrent connections

## Security

### Security Features
- **PIN Authentication**: Secure PIN hashing with bcrypt
- **JWT Tokens**: Signed tokens with expiration
- **Role-Based Access**: Admin/staff permission levels
- **Input Validation**: Comprehensive data validation
- **Audit Logging**: Complete action audit trail
- **Connection Security**: MongoDB connection encryption

### Security Best Practices
- Regular security updates
- PIN complexity requirements
- Token rotation and expiration
- Input sanitization
- Rate limiting
- CORS configuration

## Documentation

- **API Documentation**: [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)
- **Deployment Guide**: [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)
- **Testing Guide**: [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md)
- **Troubleshooting**: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- **OpenAPI Spec**: Available at `/docs` endpoint

## Support

### Common Issues
- MongoDB connection problems
- Authentication token expiration
- Data validation errors
- Performance optimization

### Development Support
- Code examples in documentation
- Comprehensive test suite
- Development best practices
- CI/CD pipeline configuration

## License

[Add your license information here]

## Contributing

[Add contribution guidelines here]

## Changelog

### Version 1.0.0
- Initial release
- Complete customer management
- Pawn transaction processing
- Payment and extension handling
- Receipt generation system
- JWT authentication
- Comprehensive test suite
- Production deployment ready