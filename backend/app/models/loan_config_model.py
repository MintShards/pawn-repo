"""
Loan configuration model for storing business rules like loan limits.

This model stores configurable loan-related business rules including
the maximum active loans per customer limit and audit trail.
"""

from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import Field


class LoanConfig(Document):
    """
    Loan configuration document for business rules
    
    Stores configurable loan limits and business rules with audit trail.
    Only one active configuration should exist at a time.
    """
    
    # Configuration fields
    max_active_loans: int = Field(
        default=8,
        ge=1,
        le=20,
        description="Maximum active loans allowed per customer"
    )
    
    # Audit fields
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: str = Field(default="system", description="Admin user who updated the configuration")
    reason: str = Field(default="Default configuration", description="Reason for this configuration")
    is_active: bool = Field(default=True, description="Whether this configuration is active")
    
    class Settings:
        name = "loan_config"
        indexes = [
            "is_active",
            "updated_at"
        ]
    
    @classmethod
    async def get_current_config(cls) -> Optional["LoanConfig"]:
        """Get the current active loan configuration"""
        return await cls.find_one(cls.is_active == True)  # pylint: disable=singleton-comparison
    
    @classmethod
    async def get_max_active_loans(cls) -> int:
        """Get the current maximum active loans limit"""
        config = await cls.get_current_config()
        return config.max_active_loans if config else 8  # Default fallback
    
    async def set_as_active(self):
        """Set this configuration as active and deactivate others"""
        # Deactivate all other configurations
        await LoanConfig.find(LoanConfig.is_active == True).update({"$set": {"is_active": False}})  # pylint: disable=singleton-comparison
        
        # Activate this configuration
        self.is_active = True
        self.updated_at = datetime.utcnow()
        await self.save()