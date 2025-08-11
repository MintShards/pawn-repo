# Pawnshop Operations System - Backend

A comprehensive FastAPI-based backend system for pawnshop operations, managing customers, pawn transactions, payments, and generating detailed receipts and reports.

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- MongoDB 4.4+
- Virtual environment (recommended)

### Installation

1. **Clone and navigate**
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
# Create .env file with your MongoDB connection and JWT secrets
cp .env.example .env
# Edit .env with your configuration
```

5. **Seed the database**
```bash
python seed.py
```

6. **Start the server**
```bash
uvicorn app.app:app --reload --host 0.0.0.0 --port 8000
```

7. **Access the application**
- API: http://localhost:8000
- Documentation: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc

## 📁 Project Structure

```
backend/
├── app/                           # Core application
│   ├── api/                       # API endpoints
│   ├── core/                      # Core configuration
│   ├── models/                    # Database models
│   ├── schemas/                   # Pydantic schemas
│   ├── services/                  # Business logic
│   └── app.py                     # FastAPI application
├── tests/                         # Test suite
├── docs/                          # Documentation
├── config/                        # Configuration files
├── requirements.txt               # Dependencies
├── seed.py                        # Database seeding
└── CLAUDE.md                      # Development guidance
```

## 🔧 Features

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

## 🧪 Testing

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

## 📚 Documentation

- **[API Documentation](docs/API_DOCUMENTATION.md)** - Complete API reference
- **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Production deployment guide
- **[Testing Guide](docs/TESTING_GUIDE.md)** - Comprehensive testing guide
- **[Troubleshooting](docs/troubleshooting/TROUBLESHOOTING_GUIDE.md)** - Common issues and solutions

## 🔐 Authentication

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

## ⚙️ Configuration

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
```

## 🛠️ Development

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

## 🚀 Deployment

See [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) for detailed production deployment instructions including:
- Docker containerization
- Environment configuration
- Database setup
- SSL/TLS configuration
- Monitoring setup

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run the test suite
5. Submit a pull request

## 📄 License

[Add your license information here]

---

For detailed technical documentation, see the comprehensive guides in the `docs/` directory.