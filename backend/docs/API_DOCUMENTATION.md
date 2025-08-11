# API Documentation

Complete API reference for the Pawnshop Operations System.

## Overview

FastAPI-based REST API for pawnshop operations including customer management, pawn transactions, payments, extensions, and user authentication.

**Base URL**: `http://localhost:8000`  
**API Version**: v1  
**Authentication**: JWT tokens via PIN-based login  

## Authentication Endpoints

### POST /api/v1/auth/jwt/login
User authentication with PIN verification.

**Request Body:**
```json
{
    "user_id": "69",    // 2-digit string
    "pin": "6969"       // 4-digit string
}
```

**Response:**
```json
{
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "token_type": "bearer",
    "expires_in": 3600,
    "user": {
        "id": "67890123456789012345678",
        "user_id": "69",
        "first_name": "Admin",
        "last_name": "User",
        "role": "admin"
    }
}
```

### POST /api/v1/auth/jwt/refresh
Refresh access token using refresh token.

### GET /api/v1/auth/jwt/verify
Verify current token validity.

## User Management

### GET /api/v1/user/me
Get current user profile information.

### POST /api/v1/user/create
Create new user (admin only).

**Request Body:**
```json
{
    "user_id": "02",
    "pin": "1234",
    "first_name": "Staff",
    "last_name": "Member",
    "role": "staff"
}
```

### GET /api/v1/user/list
List all users (staff/admin access).

### GET /api/v1/user/stats
User statistics and metrics (admin only).

## Customer Management

### POST /api/v1/customer/
Create new customer.

**Request Body:**
```json
{
    "phone_number": "1234567890",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "notes": "VIP customer"
}
```

### GET /api/v1/customer/
List customers with optional filtering.

**Query Parameters:**
- `status`: Filter by customer status (active, suspended, banned)
- `limit`: Number of results per page
- `skip`: Number of results to skip

### GET /api/v1/customer/{phone}
Get customer by phone number.

### PUT /api/v1/customer/{phone}
Update customer information.

**Request Body:**
```json
{
    "first_name": "John",
    "last_name": "Smith",
    "email": "johnsmith@example.com",
    "status": "active",
    "notes": "Updated contact info"
}
```

## Pawn Transaction Management

### POST /api/v1/pawn-transaction/
Create new pawn transaction.

**Request Body:**
```json
{
    "customer_phone": "1234567890",
    "items": [
        {
            "description": "Gold Ring",
            "category": "jewelry",
            "condition": "excellent",
            "estimated_value": 250.00
        }
    ],
    "loan_amount": 200.00,
    "interest_rate": 15.00,
    "storage_location": "Shelf A-1",
    "notes": "Beautiful gold ring, 14k"
}
```

### GET /api/v1/pawn-transaction/
List pawn transactions with filtering.

**Query Parameters:**
- `status`: Filter by transaction status
- `customer_phone`: Filter by customer
- `overdue`: Show only overdue transactions
- `limit`, `skip`: Pagination

### GET /api/v1/pawn-transaction/{transaction_id}
Get specific transaction details.

### PUT /api/v1/pawn-transaction/{transaction_id}/status
Update transaction status.

## Payment Management

### POST /api/v1/payment/
Record payment on transaction.

**Request Body:**
```json
{
    "transaction_id": "67890123456789012345678",
    "amount": 50.00,
    "payment_method": "cash",
    "notes": "Partial payment"
}
```

### GET /api/v1/payment/transaction/{transaction_id}
Get all payments for a transaction.

## Extension Management

### POST /api/v1/extension/
Create extension for transaction.

**Request Body:**
```json
{
    "transaction_id": "67890123456789012345678",
    "extension_days": 30,
    "extension_fee": 25.00,
    "notes": "Customer requested 30-day extension"
}
```

### GET /api/v1/extension/transaction/{transaction_id}
Get all extensions for a transaction.

## Monitoring Endpoints

### GET /api/v1/monitoring/health
System health check.

### GET /api/v1/monitoring/metrics
System performance metrics.

## Error Responses

All endpoints return consistent error responses:

```json
{
    "detail": "Error message",
    "error_code": "SPECIFIC_ERROR_CODE",
    "timestamp": "2025-01-15T10:30:00Z"
}
```

**Common HTTP Status Codes:**
- `400`: Bad Request - Invalid input data
- `401`: Unauthorized - Invalid or missing authentication
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource doesn't exist
- `422`: Validation Error - Input validation failed
- `500`: Internal Server Error - Server-side error

## Rate Limiting

- **General endpoints**: 100 requests/minute
- **Authentication**: 5 attempts/minute per IP
- **File uploads**: 10 requests/minute

## Data Models

### Customer
```json
{
    "id": "ObjectId",
    "phone_number": "string (10 digits)",
    "first_name": "string",
    "last_name": "string",
    "email": "string (optional)",
    "status": "active|suspended|banned",
    "notes": "string (optional)",
    "created_at": "datetime",
    "updated_at": "datetime"
}
```

### Pawn Transaction
```json
{
    "id": "ObjectId",
    "customer_id": "ObjectId",
    "items": ["PawnItem[]"],
    "loan_amount": "decimal",
    "interest_rate": "decimal",
    "status": "active|overdue|extended|redeemed|forfeited|sold",
    "loan_date": "datetime",
    "maturity_date": "datetime",
    "storage_location": "string",
    "notes": "string (optional)"
}
```

### Payment
```json
{
    "id": "ObjectId",
    "transaction_id": "ObjectId",
    "amount": "decimal",
    "payment_method": "cash|card|check|other",
    "payment_date": "datetime",
    "notes": "string (optional)"
}
```

## Testing

Default test credentials (seeded database):

**Admin User:**
- User ID: `69`
- PIN: `6969`

**Staff User:**
- User ID: `02`
- PIN: `1234`

Run seed script: `python seed.py`