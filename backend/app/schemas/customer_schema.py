"""
Customer Pydantic schemas for request/response validation.

This module defines all schemas used for customer-related API operations,
including creation, updates, responses, and search functionality.
"""

from datetime import datetime
from typing import Optional, List
from decimal import Decimal
import re
from pydantic import BaseModel, Field, ConfigDict, validator
from pydantic.networks import EmailStr

from app.models.customer_model import CustomerStatus


class CustomerBase(BaseModel):
    """Base customer schema with common fields"""
    first_name: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Customer's first name"
    )
    last_name: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Customer's last name"
    )
    email: Optional[EmailStr] = Field(
        None,
        description="Optional email address"
    )
    notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="Internal staff notes (staff only)"
    )


class CustomerCreate(CustomerBase):
    """Schema for creating a new customer"""
    phone_number: str = Field(
        ...,
        min_length=10,
        max_length=10,
        description="10-digit phone number (unique identifier)"
    )
    
    @validator('first_name', 'last_name')
    def validate_names(cls, v):
        """Enhanced name validation with unicode support for international names"""
        if not v or not v.strip():
            raise ValueError('Name cannot be empty')
        
        # Remove leading/trailing whitespace
        v = v.strip()
        
        # Enhanced regex pattern for international names:
        # Support Unicode letters, spaces, hyphens, and apostrophes
        # This supports names like: José, O'Connor, Mary-Jane, etc.
        if not re.match(r'^[\w\s\-\'\.]+$', v, re.UNICODE):
            raise ValueError('Name contains invalid characters. Only letters, spaces, hyphens, and apostrophes are allowed.')
        
        # Check length after cleaning
        if len(v) < 1 or len(v) > 50:
            raise ValueError('Name must be between 1 and 50 characters')
        
        return v
    
    @validator('phone_number')
    def validate_phone_number(cls, v):
        """Strict phone number validation - exactly 10 digits"""
        if not v:
            raise ValueError('Phone number is required')
        
        # Remove any non-digit characters for validation
        digits_only = re.sub(r'[^\d]', '', v)
        
        # Must be exactly 10 digits
        if not re.match(r'^\d{10}$', digits_only):
            raise ValueError('Phone number must be exactly 10 digits (e.g., 5551234567)')
        
        # Return only digits
        return digits_only
    
    @validator('email')
    def validate_email_security(cls, v):
        """Additional email security validation"""
        if v is None:
            return v
        
        # Basic XSS protection - reject emails with suspicious characters
        if re.search(r'[<>"\'\(\)&]', v):
            raise ValueError('Email contains invalid characters')
        
        # Length check for security
        if len(v) > 254:  # RFC 5321 limit
            raise ValueError('Email address is too long')
            
        return v
    
    @validator('notes')
    def validate_notes_security(cls, v):
        """Security validation for notes field"""
        if v is None:
            return v
        
        v = v.strip()
        
        # Basic XSS protection - sanitize HTML-like content
        if re.search(r'<[^>]+>', v):
            raise ValueError('Notes cannot contain HTML tags')
        
        # Additional XSS patterns
        if re.search(r'(javascript:|data:|vbscript:|onload=|onerror=)', v, re.IGNORECASE):
            raise ValueError('Notes contain potentially unsafe content')
        
        return v
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "phone_number": "5551234567",
                "first_name": "John",
                "last_name": "Smith",
                "email": "john.smith@email.com",
                "notes": "Regular customer, prefers cash transactions"
            }
        }
    )


class CustomerUpdate(CustomerBase):
    """Schema for updating customer information"""
    first_name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=50,
        description="Customer's first name"
    )
    last_name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=50,
        description="Customer's last name"
    )
    status: Optional[CustomerStatus] = Field(
        None,
        description="Customer account status (admin only)"
    )
    credit_limit: Optional[Decimal] = Field(
        None,
        ge=Decimal("0.00"),
        le=Decimal("50000.00"),
        description="Maximum loan amount allowed (admin only)"
    )
    payment_history_score: Optional[int] = Field(
        None,
        ge=1,
        le=100,
        description="Payment reliability score 1-100 (admin only)"
    )
    default_count: Optional[int] = Field(
        None,
        ge=0,
        description="Number of defaulted loans (admin only)"
    )
    
    @validator('first_name', 'last_name')
    def validate_names(cls, v):
        """Enhanced name validation with unicode support for international names"""
        if v is None:
            return v
        
        if not v.strip():
            raise ValueError('Name cannot be empty')
        
        # Remove leading/trailing whitespace
        v = v.strip()
        
        # Enhanced regex pattern for international names
        if not re.match(r'^[\w\s\-\'\.]+$', v, re.UNICODE):
            raise ValueError('Name contains invalid characters. Only letters, spaces, hyphens, and apostrophes are allowed.')
        
        # Check length after cleaning
        if len(v) < 1 or len(v) > 50:
            raise ValueError('Name must be between 1 and 50 characters')
        
        return v
    
    @validator('email')
    def validate_email_security(cls, v):
        """Additional email security validation"""
        if v is None:
            return v
        
        # Basic XSS protection
        if re.search(r'[<>"\'\(\)&]', v):
            raise ValueError('Email contains invalid characters')
        
        # Length check for security
        if len(v) > 254:
            raise ValueError('Email address is too long')
            
        return v
    
    @validator('notes')
    def validate_notes_security(cls, v):
        """Security validation for notes field"""
        if v is None:
            return v
        
        v = v.strip()
        
        # Basic XSS protection
        if re.search(r'<[^>]+>', v):
            raise ValueError('Notes cannot contain HTML tags')
        
        if re.search(r'(javascript:|data:|vbscript:|onload=|onerror=)', v, re.IGNORECASE):
            raise ValueError('Notes contain potentially unsafe content')
        
        return v
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "first_name": "John",
                "last_name": "Doe", 
                "email": "john.doe@email.com",
                "status": "active",
                "notes": "Updated contact information",
                "credit_limit": "2500.00",
                "payment_history_score": 85,
                "default_count": 0
            }
        }
    )


class CustomerResponse(CustomerBase):
    """Schema for customer responses"""
    phone_number: str = Field(..., description="10-digit phone number")
    status: CustomerStatus = Field(..., description="Customer account status")
    created_at: datetime = Field(..., description="Account creation timestamp")
    created_by: str = Field(..., description="User ID who created this customer")
    updated_at: datetime = Field(..., description="Last update timestamp")
    updated_by: Optional[str] = Field(None, description="User ID who last updated")
    total_transactions: int = Field(..., description="Total number of transactions")
    active_loans: int = Field(..., description="Number of active loans")
    last_transaction_date: Optional[datetime] = Field(
        None,
        description="Date of most recent transaction"
    )
    credit_limit: Decimal = Field(..., description="Maximum loan amount allowed")
    payment_history_score: int = Field(..., description="Payment reliability score (1-100)")
    default_count: int = Field(..., description="Number of defaulted loans")
    risk_level: str = Field(..., description="Calculated risk level (low/medium/high)")
    can_borrow_amount: Decimal = Field(..., description="Available borrowing amount")
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "phone_number": "5551234567",
                "first_name": "John",
                "last_name": "Smith",
                "email": "john.smith@email.com",
                "status": "active",
                "notes": "Regular customer",
                "created_at": "2024-01-01T10:00:00Z",
                "created_by": "01",
                "updated_at": "2024-01-15T14:30:00Z",
                "updated_by": "02",
                "total_transactions": 15,
                "active_loans": 2,
                "last_transaction_date": "2024-01-15T14:30:00Z",
                "credit_limit": "2500.00",
                "payment_history_score": 85,
                "default_count": 0,
                "risk_level": "medium",
                "can_borrow_amount": "2500.00"
            }
        }
    )


class CustomerListResponse(BaseModel):
    """Schema for paginated customer list responses"""
    customers: List[CustomerResponse] = Field(..., description="List of customers")
    total: int = Field(..., description="Total number of customers")
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total number of pages")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "customers": [
                    {
                        "phone_number": "5551234567",
                        "first_name": "John",
                        "last_name": "Smith",
                        "email": "john.smith@email.com",
                        "status": "active",
                        "notes": "Regular customer",
                        "created_at": "2024-01-01T10:00:00Z",
                        "updated_at": "2024-01-15T14:30:00Z",
                        "total_transactions": 15,
                        "active_loans": 2,
                        "last_transaction_date": "2024-01-15T14:30:00Z"
                    }
                ],
                "total": 125,
                "page": 1,
                "per_page": 10,
                "pages": 13
            }
        }
    )


class CustomerStatsResponse(BaseModel):
    """Schema for customer statistics (admin only)"""
    total_customers: int = Field(..., description="Total number of customers")
    active_customers: int = Field(..., description="Number of active customers")
    suspended_customers: int = Field(..., description="Number of suspended customers")
    archived_customers: int = Field(..., description="Number of archived customers")
    customers_created_today: int = Field(..., description="Customers created today")
    avg_transactions_per_customer: float = Field(..., description="Average transactions per customer")
    
    # Enhanced customer-focused metrics
    new_this_month: int = Field(..., description="Customers joined in the last 30 days")
    good_standing: int = Field(..., description="Customers with low-medium risk level")
    needs_follow_up: int = Field(..., description="High-risk customers or flagged for contact")
    eligible_for_increase: int = Field(..., description="Low-risk customers eligible for credit increase")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "total_customers": 125,
                "active_customers": 118,
                "suspended_customers": 5,
                "archived_customers": 2,
                "customers_created_today": 3,
                "avg_transactions_per_customer": 8.5,
                "new_this_month": 12,
                "good_standing": 95,
                "needs_follow_up": 8,
                "eligible_for_increase": 35
            }
        }
    )


class CustomerStatusUpdate(BaseModel):
    """Schema for updating customer status (admin only)"""
    status: CustomerStatus = Field(..., description="New customer status")
    reason: Optional[str] = Field(
        None,
        max_length=500,
        description="Reason for status change (required for suspension/ban)"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "suspended",
                "reason": "Account suspended due to multiple failed payment attempts"
            }
        }
    )


class CustomerArchiveRequest(BaseModel):
    """Schema for archiving customer (admin only)"""
    reason: str = Field(
        default="Admin action - permanent archive",
        max_length=500,
        description="Reason for archiving customer account"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "reason": "Admin action - permanent archive"
            }
        }
    )
