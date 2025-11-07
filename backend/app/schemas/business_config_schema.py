"""
Business Configuration Schemas

Pydantic schemas for API request/response validation for all
business configuration settings.
"""

from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator
from datetime import datetime


# ==================== Company Configuration ====================

class CompanyConfigCreate(BaseModel):
    """Schema for creating company configuration"""
    company_name: str = Field(..., min_length=1, max_length=200)
    logo_url: Optional[str] = Field(None, max_length=500, description="Company logo URL")
    address_line1: str = Field(..., min_length=1, max_length=200)
    address_line2: Optional[str] = Field(None, max_length=200)
    city: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=2, max_length=50)
    zip_code: str = Field(..., min_length=3, max_length=20)
    phone: str = Field(..., min_length=10, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=200)


class CompanyConfigResponse(BaseModel):
    """Schema for company configuration response"""
    company_name: str
    logo_url: Optional[str]
    address_line1: str
    address_line2: Optional[str]
    city: str
    state: str
    zip_code: str
    phone: str
    email: Optional[str]
    website: Optional[str]
    created_at: datetime
    updated_at: datetime
    updated_by: str
    is_active: bool

    class Config:
        from_attributes = True


# ==================== Financial Policy Configuration ====================

class FinancialPolicyConfigCreate(BaseModel):
    """Schema for creating financial policy configuration"""
    # Interest rate settings (percentage-based)
    default_monthly_interest_rate: float = Field(..., ge=0, le=100, description="Default monthly interest rate as percentage (0-100)")
    min_interest_rate: float = Field(0, ge=0, le=100, description="Minimum interest rate as percentage (0-100)")
    max_interest_rate: float = Field(..., ge=0, le=100, description="Maximum interest rate as percentage (0-100)")

    # Loan limits
    min_loan_amount: float = Field(default=10.0, ge=0)
    max_loan_amount: float = Field(default=10000.0, ge=0)
    max_active_loans_per_customer: int = Field(default=8, ge=1, le=20)

    # Credit limit settings
    customer_credit_limit: Optional[float] = Field(
        None,
        ge=3000.0,
        description="Default customer credit limit (minimum $3,000, always enforced)"
    )
    enforce_credit_limit: bool = Field(default=True, description="Credit limits are always enforced")

    # Audit
    reason: str = Field(..., min_length=5, max_length=500)

    # Section indicator for timestamp tracking
    section_updated: Optional[Literal["interest_rates", "loan_limit", "credit_limit"]] = Field(
        None,
        description="Which section is being updated (for section-specific timestamps)"
    )

    @field_validator('max_interest_rate')
    @classmethod
    def validate_max_interest(cls, v, info):
        """Validate that max interest rate is greater than min"""
        if 'min_interest_rate' in info.data and v < info.data['min_interest_rate']:
            raise ValueError('max_interest_rate must be greater than or equal to min_interest_rate')
        return v

    @field_validator('max_loan_amount')
    @classmethod
    def validate_max_loan(cls, v, info):
        """Validate that max loan amount is greater than min"""
        if 'min_loan_amount' in info.data and v < info.data['min_loan_amount']:
            raise ValueError('max_loan_amount must be greater than or equal to min_loan_amount')
        return v


class FinancialPolicyConfigResponse(BaseModel):
    """Schema for financial policy configuration response"""
    # Interest rates (percentage values: 0-100)
    default_monthly_interest_rate: float
    min_interest_rate: float
    max_interest_rate: float
    # Loan limits
    min_loan_amount: float
    max_loan_amount: float
    max_active_loans_per_customer: int
    # Credit limits
    customer_credit_limit: Optional[float]
    enforce_credit_limit: bool
    # Audit
    created_at: datetime
    updated_at: datetime
    updated_by: str
    reason: str
    is_active: bool
    # Section-specific timestamps
    interest_rates_updated_at: Optional[datetime]
    loan_limit_updated_at: Optional[datetime]
    credit_limit_updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ==================== Forfeiture Configuration ====================

class ForfeitureConfigCreate(BaseModel):
    """Schema for creating forfeiture configuration"""
    forfeiture_days: int = Field(default=97, ge=30, le=365)
    grace_period_days: int = Field(default=0, ge=0, le=30)
    notification_days_before: int = Field(default=7, ge=0, le=30)
    enable_notifications: bool = Field(default=False)
    reason: str = Field(..., min_length=5, max_length=500)


class ForfeitureConfigResponse(BaseModel):
    """Schema for forfeiture configuration response"""
    forfeiture_days: int
    grace_period_days: int
    notification_days_before: int
    enable_notifications: bool
    created_at: datetime
    updated_at: datetime
    updated_by: str
    reason: str
    is_active: bool

    class Config:
        from_attributes = True


# ==================== Printer Configuration ====================

class PrinterConfigCreate(BaseModel):
    """Schema for creating printer configuration"""
    default_receipt_printer: Optional[str] = Field(None, max_length=200)
    default_report_printer: Optional[str] = Field(None, max_length=200)


class PrinterConfigResponse(BaseModel):
    """Schema for printer configuration response"""
    default_receipt_printer: Optional[str]
    default_report_printer: Optional[str]
    created_at: datetime
    updated_at: datetime
    updated_by: str
    is_active: bool

    class Config:
        from_attributes = True


# ==================== Location Configuration ====================

class LocationConfigCreate(BaseModel):
    """Schema for creating location configuration"""
    location_name: str = Field(..., min_length=1, max_length=100, description="Location name")
    city: str = Field(..., min_length=1, max_length=100, description="City name")
    state: Optional[str] = Field(None, max_length=50, description="State/Province")
    country: str = Field(default="Canada", max_length=100, description="Country")
    latitude: float = Field(..., ge=-90, le=90, description="Location latitude")
    longitude: float = Field(..., ge=-180, le=180, description="Location longitude")
    timezone: str = Field(..., min_length=1, max_length=50, description="IANA timezone")


class LocationConfigResponse(BaseModel):
    """Schema for location configuration response"""
    location_name: str
    city: str
    state: Optional[str]
    country: str
    latitude: float
    longitude: float
    timezone: str
    created_at: datetime
    updated_at: datetime
    updated_by: str
    is_active: bool

    class Config:
        from_attributes = True
