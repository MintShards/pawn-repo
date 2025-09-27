"""
Customer model for MongoDB using Beanie ODM.

This module defines the customer document model with complete
profile management, status tracking, and transaction history support.
"""

from datetime import datetime
from typing import Optional
from enum import Enum
from decimal import Decimal

from beanie import Document, Indexed, before_event, Replace, Insert
from pydantic import Field, field_validator
from pydantic.networks import EmailStr
from pymongo import IndexModel, TEXT
from bson import Decimal128


class CustomerStatus(str, Enum):
    """Customer account status options"""
    ACTIVE = "active"      # Normal operating customers
    SUSPENDED = "suspended"  # Temporarily restricted customers
    ARCHIVED = "archived"    # Permanently inactive customers (includes banned/deactivated)


class Customer(Document):
    """
    Customer document model for pawnshop operations.
    
    Attributes:
        phone_number: Unique identifier (10-digit phone)
        first_name: Customer's first name
        last_name: Customer's last name
        email: Optional email address
        status: Account status (active/suspended/banned/deactivated/archived)
        notes: Internal staff notes
        created_at: Account creation timestamp
        created_by: User ID who created the customer
        updated_at: Last update timestamp
        updated_by: User ID who last updated
        total_transactions: Count of all transactions
        active_loans: Count of current active loans
        total_loan_value: Sum of all loan amounts
        last_transaction_date: Most recent transaction
        suspended_reason: Reason for suspension (if applicable)
        suspended_by: User who suspended account
        suspended_at: Suspension timestamp
        credit_limit: Maximum loan amount allowed
    """
    
    # Primary identifier - phone number
    phone_number: Indexed(str, unique=True) = Field(
        ...,
        min_length=10,
        max_length=10,
        description="10-digit phone number (unique identifier)"
    )
    
    # Basic information
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
    
    # Status management
    status: CustomerStatus = Field(
        default=CustomerStatus.ACTIVE,
        description="Customer account status"
    )
    
    # Internal notes (staff only)
    notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="Internal staff notes about customer"
    )
    
    # Audit fields
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Customer creation timestamp"
    )
    created_by: str = Field(
        ...,
        description="User ID who created this customer"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last update timestamp"
    )
    updated_by: Optional[str] = Field(
        None,
        description="User ID who last updated"
    )
    
    # Transaction statistics (denormalized for performance)
    total_transactions: int = Field(
        default=0,
        ge=0,
        description="Total number of transactions"
    )
    active_loans: int = Field(
        default=0,
        ge=0,
        description="Number of active loans"
    )
    total_loan_value: float = Field(
        default=0.0,
        ge=0.0,
        description="Total value of all loans"
    )
    last_transaction_date: Optional[datetime] = Field(
        None,
        description="Date of most recent transaction"
    )
    
    # Suspension tracking
    suspended_reason: Optional[str] = Field(
        None,
        max_length=500,
        description="Reason for suspension"
    )
    suspended_by: Optional[str] = Field(
        None,
        description="User who suspended the account"
    )
    suspended_at: Optional[datetime] = Field(
        None,
        description="Suspension timestamp"
    )
    
    # Credit fields
    credit_limit: Decimal = Field(
        default=Decimal("3000.00"),
        ge=Decimal("0.00"),
        le=Decimal("50000.00"),
        description="Maximum loan amount allowed"
    )
    
    # Individual loan limit (overrides system default)
    custom_loan_limit: Optional[int] = Field(
        None,
        ge=1,
        le=50,
        description="Custom maximum active loans for this customer (overrides system default)"
    )
    
    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, v):
        """Validate phone number format (digits only)"""
        if not v.isdigit():
            raise ValueError("Phone number must contain only digits")
        return v
    
    @field_validator("email", mode="before")
    @classmethod
    def empty_string_to_none(cls, v):
        """Convert empty strings to None for optional email"""
        if v == "":
            return None
        return v
    
    @field_validator("credit_limit", mode="before")
    @classmethod
    def handle_decimal128(cls, v):
        """Convert Decimal128 from MongoDB to Python Decimal"""
        if isinstance(v, Decimal128):
            return Decimal(str(v))
        return v
    
    @before_event([Insert, Replace])
    async def update_timestamp(self):
        """Update the updated_at timestamp before save"""
        self.updated_at = datetime.utcnow()
    
    @property
    def full_name(self) -> str:
        """Get customer's full name"""
        return f"{self.first_name} {self.last_name}"
    
    @property
    def is_active(self) -> bool:
        """Check if customer account is active"""
        return self.status == CustomerStatus.ACTIVE
    
    @property
    def can_transact(self) -> bool:
        """Check if customer can perform transactions"""
        return self.status == CustomerStatus.ACTIVE
    
    
    @property
    def can_borrow_amount(self) -> Decimal:
        """Get available borrowing amount based on active loans and credit limit"""
        # Note: This is a synchronous property, so it returns the simplified calculation
        # For accurate real-time calculations, use CustomerService.validate_loan_eligibility()
        # which performs async database queries for precise slot/credit calculations
        return self.credit_limit
    
    def suspend(self, reason: str, suspended_by: str):
        """Suspend customer account"""
        self.status = CustomerStatus.SUSPENDED
        self.suspended_reason = reason
        self.suspended_by = suspended_by
        self.suspended_at = datetime.utcnow()
    
    def ban(self, reason: str, banned_by: str):
        """Ban customer account (now archived)"""
        self.status = CustomerStatus.ARCHIVED
        self.suspended_reason = reason  # Reuse suspension fields for archive
        self.suspended_by = banned_by
        self.suspended_at = datetime.utcnow()
    
    def reactivate(self):
        """Reactivate customer account"""
        self.status = CustomerStatus.ACTIVE
        self.suspended_reason = None
        self.suspended_by = None
        self.suspended_at = None
    
    def deactivate(self, reason: str, deactivated_by: str):
        """Deactivate customer account (customer-requested closure, now archived)"""
        self.status = CustomerStatus.ARCHIVED
        self.suspended_reason = reason
        self.suspended_by = deactivated_by
        self.suspended_at = datetime.utcnow()
    
    def archive(self, reason: str, archived_by: str):
        """Archive customer account (long-term inactive, compliance preservation)"""
        self.status = CustomerStatus.ARCHIVED
        self.suspended_reason = reason
        self.suspended_by = archived_by
        self.suspended_at = datetime.utcnow()
    
    class Settings:
        """Beanie document settings"""
        name = "customers"
        indexes = [
            [("phone_number", 1)],  # Unique index on phone
            [("status", 1)],  # For filtering by status
            [("created_at", -1)],  # For sorting by creation date
            [("last_transaction_date", -1)],  # For transaction history
            [("first_name", 1), ("last_name", 1)],  # For name search
            # Text search index for efficient searching
            IndexModel([("first_name", TEXT), ("last_name", TEXT), ("phone_number", TEXT)])
        ]