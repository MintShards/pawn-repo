"""
Business Configuration Models

Comprehensive models for storing all business settings including:
- Company information
- Financial policies
- Forfeiture rules
- Printer configuration
"""

from datetime import datetime
from typing import Optional, List
from beanie import Document
from pydantic import Field, field_validator


class CompanyConfig(Document):
    """
    Company information configuration

    Stores business identity and contact information used in
    receipts, reports, and customer communications.
    """

    # Company information
    company_name: str = Field(..., description="Business name")
    address_line1: str = Field(..., description="Primary address line")
    address_line2: Optional[str] = Field(None, description="Secondary address line (suite, unit, etc.)")
    city: str = Field(..., description="City")
    state: str = Field(..., description="State/Province")
    zip_code: str = Field(..., description="ZIP/Postal code")
    phone: str = Field(..., description="Business phone number")
    email: Optional[str] = Field(None, description="Business email address")
    website: Optional[str] = Field(None, description="Business website URL")

    # Audit fields
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: str = Field(..., description="Admin user who updated the configuration")
    is_active: bool = Field(default=True, description="Whether this configuration is active")

    class Settings:
        name = "company_config"
        indexes = [
            "is_active",
            "updated_at"
        ]

    @classmethod
    async def get_current_config(cls) -> Optional["CompanyConfig"]:
        """Get the current active company configuration (newest one if multiple exist)"""
        return await cls.find(cls.is_active == True).sort("-updated_at").first_or_none()  # pylint: disable=singleton-comparison

    async def set_as_active(self):
        """Set this configuration as active and deactivate others"""
        # Deactivate all other configs first
        await CompanyConfig.find(CompanyConfig.is_active == True).update_many({"$set": {"is_active": False}})  # pylint: disable=singleton-comparison
        # Now activate this one
        self.is_active = True
        self.updated_at = datetime.utcnow()
        await self.save()


class FinancialPolicyConfig(Document):
    """
    Financial policies configuration

    Stores default financial rules including interest rates,
    loan limits, and credit limits.

    Note: Extension fees are managed manually per transaction, not via configuration.
    """

    # Interest rate settings
    default_monthly_interest_rate: float = Field(
        ...,
        ge=0,
        description="Default monthly interest rate (fixed amount, not percentage)"
    )
    min_interest_rate: float = Field(
        0,
        ge=0,
        description="Minimum allowed interest rate"
    )
    max_interest_rate: float = Field(
        ...,
        ge=0,
        description="Maximum allowed interest rate"
    )
    allow_staff_override: bool = Field(
        default=True,
        description="Allow staff to override default interest rate"
    )

    # Loan limits
    min_loan_amount: float = Field(default=10.0, ge=0, description="Minimum loan amount")
    max_loan_amount: float = Field(default=10000.0, ge=0, description="Maximum loan amount")
    max_active_loans_per_customer: int = Field(
        default=8,
        ge=1,
        le=20,
        description="Maximum active loans per customer"
    )

    # Credit limit settings
    customer_credit_limit: Optional[float] = Field(
        None,
        ge=3000.0,
        description="Default customer credit limit (minimum $3,000, None = not configured, always enforced)"
    )
    enforce_credit_limit: bool = Field(
        default=True,
        description="Credit limits are always enforced (kept for backward compatibility)"
    )

    # Audit fields
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: str = Field(..., description="Admin user who updated the configuration")
    reason: str = Field(..., description="Reason for this configuration change")
    is_active: bool = Field(default=True, description="Whether this configuration is active")

    class Settings:
        name = "financial_policy_config"
        indexes = [
            "is_active",
            "updated_at"
        ]

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

    @classmethod
    async def get_current_config(cls) -> Optional["FinancialPolicyConfig"]:
        """Get the current active financial policy configuration (newest one if multiple exist)"""
        return await cls.find(cls.is_active == True).sort("-updated_at").first_or_none()  # pylint: disable=singleton-comparison

    async def set_as_active(self):
        """Set this configuration as active and deactivate others"""
        # Deactivate all other configs first
        await FinancialPolicyConfig.find(FinancialPolicyConfig.is_active == True).update_many({"$set": {"is_active": False}})  # pylint: disable=singleton-comparison
        # Now activate this one
        self.is_active = True
        self.updated_at = datetime.utcnow()
        await self.save()


class ForfeitureConfig(Document):
    """
    Forfeiture rules configuration

    Stores rules for automatic item forfeiture including
    thresholds, grace periods, and notification settings.
    """

    # Forfeiture settings
    forfeiture_days: int = Field(
        default=97,
        ge=30,
        le=365,
        description="Days after loan date before automatic forfeiture"
    )
    grace_period_days: int = Field(
        default=0,
        ge=0,
        le=30,
        description="Additional grace period days after forfeiture threshold"
    )
    notification_days_before: int = Field(
        default=7,
        ge=0,
        le=30,
        description="Days before forfeiture to send notification (if enabled)"
    )
    enable_notifications: bool = Field(
        default=False,
        description="Enable customer notifications before forfeiture"
    )

    # Audit fields
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: str = Field(..., description="Admin user who updated the configuration")
    reason: str = Field(..., description="Reason for this configuration change")
    is_active: bool = Field(default=True, description="Whether this configuration is active")

    class Settings:
        name = "forfeiture_config"
        indexes = [
            "is_active",
            "updated_at"
        ]

    @classmethod
    async def get_current_config(cls) -> Optional["ForfeitureConfig"]:
        """Get the current active forfeiture configuration (newest one if multiple exist)"""
        return await cls.find(cls.is_active == True).sort("-updated_at").first_or_none()  # pylint: disable=singleton-comparison

    @classmethod
    async def get_forfeiture_days(cls) -> int:
        """Get the current forfeiture threshold in days"""
        config = await cls.get_current_config()
        return config.forfeiture_days if config else 97  # Default fallback

    async def set_as_active(self):
        """Set this configuration as active and deactivate others"""
        # Deactivate all other configs first
        await ForfeitureConfig.find(ForfeitureConfig.is_active == True).update_many({"$set": {"is_active": False}})  # pylint: disable=singleton-comparison
        # Now activate this one
        self.is_active = True
        self.updated_at = datetime.utcnow()
        await self.save()


class PrinterConfig(Document):
    """
    Printer configuration

    Stores default printer selection for receipts and reports.
    Leave empty to use browser's default print dialog.
    """

    # Printer selection (empty = browser default)
    default_receipt_printer: Optional[str] = Field(
        None,
        description="Default printer name for receipts (leave empty for browser default)"
    )
    default_report_printer: Optional[str] = Field(
        None,
        description="Default printer name for reports (leave empty for browser default)"
    )

    # Audit fields
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: str = Field(..., description="Admin user who updated the configuration")
    is_active: bool = Field(default=True, description="Whether this configuration is active")

    class Settings:
        name = "printer_config"
        indexes = [
            "is_active",
            "updated_at"
        ]

    @classmethod
    async def get_current_config(cls) -> Optional["PrinterConfig"]:
        """Get the current active printer configuration (newest one if multiple exist)"""
        return await cls.find(cls.is_active == True).sort("-updated_at").first_or_none()  # pylint: disable=singleton-comparison

    async def set_as_active(self):
        """Set this configuration as active and deactivate others"""
        # Deactivate all other configs first
        await PrinterConfig.find(PrinterConfig.is_active == True).update_many({"$set": {"is_active": False}})  # pylint: disable=singleton-comparison
        # Now activate this one
        self.is_active = True
        self.updated_at = datetime.utcnow()
        await self.save()
