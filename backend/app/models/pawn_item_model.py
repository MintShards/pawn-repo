"""
Pawn Item Model

Model for individual items within a pawn transaction. Each transaction can have
multiple items with their own descriptions, serial numbers, and tracking information.
"""

from beanie import Document, Indexed
from pydantic import Field, field_validator, ConfigDict
from datetime import datetime, UTC
from typing import Optional
from uuid import uuid4


class PawnItem(Document):
    """
    Pawn item document model.
    
    Represents individual items within a pawn transaction with proper validation,
    ordering, and relationship management.
    """
    
    # Identifiers
    item_id: Indexed(str) = Field(
        default_factory=lambda: str(uuid4()),
        description="Unique item identifier"
    )
    transaction_id: Indexed(str) = Field(
        ...,
        description="Reference to PawnTransaction document via transaction_id"
    )
    item_number: int = Field(
        ...,
        gt=0,
        description="Sequential number within transaction (1, 2, 3, etc.)"
    )
    
    # Item details
    description: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Item description (e.g., 'Gold ring', 'Dewalt circular saw')"
    )
    serial_number: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Optional serial number or identifier"
    )
    
    # Timestamps
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Item creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Item last update timestamp"
    )
    
    # Pydantic v2 configuration
    model_config = ConfigDict(
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "transaction_id": "12345678-1234-1234-1234-123456789abc",
                "item_number": 1,
                "description": "14k Gold Wedding Ring",
                "serial_number": "GWR-2024-001"
            }
        }
    )
    
    @field_validator('description')
    @classmethod
    def validate_description(cls, v: str) -> str:
        """Validate description is not empty and normalize whitespace."""
        if not v or not v.strip():
            raise ValueError('Item description is required and cannot be empty')
        # Remove extra whitespace and normalize
        return ' '.join(v.strip().split())
    
    @field_validator('item_number')
    @classmethod
    def validate_item_number(cls, v: int) -> int:
        """Validate item number is positive (sequential ordering)."""
        if v <= 0:
            raise ValueError('Item number must be greater than 0')
        return v
    
    @field_validator('serial_number', mode='before')
    @classmethod
    def validate_serial_number(cls, v) -> Optional[str]:
        """Normalize serial numbers and convert empty strings to None."""
        # Convert empty strings to None
        if v == "" or v is None:
            return None
        # Strip whitespace and normalize
        if isinstance(v, str):
            normalized = v.strip()
            return normalized if normalized else None
        return v
    
    @field_validator('transaction_id')
    @classmethod
    def validate_transaction_id(cls, v: str) -> str:
        """Validate transaction_id is not empty."""
        if not v or not v.strip():
            raise ValueError('Transaction ID is required and cannot be empty')
        return v.strip()
    
    async def save(self, *args, **kwargs) -> None:
        """Override save to update timestamps before persisting."""
        # Update timestamp
        self.updated_at = datetime.now(UTC)
        
        # Call parent save
        await super().save(*args, **kwargs)
    
    def __str__(self) -> str:
        """Human-readable string representation."""
        return f"PawnItem({self.item_number}: {self.description})"
    
    def __repr__(self) -> str:
        """Detailed string representation with all key fields."""
        return f"PawnItem(item_id='{self.item_id}', transaction_id='{self.transaction_id}', item_number={self.item_number}, description='{self.description}')"
    
    class Settings:
        """Beanie document settings"""
        name = "pawn_items"
        indexes = [
            "item_id",
            "transaction_id",
            "item_number",
            # Compound indexes for efficient queries
            [("transaction_id", 1), ("item_number", 1)],  # Ordering items within transaction
            [("transaction_id", 1), ("created_at", 1)],   # Chronological ordering
        ]