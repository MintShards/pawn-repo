# backend/app/models/user_model.py
from typing import Optional
from datetime import datetime
from uuid import UUID, uuid4
from beanie import Document, Indexed
from pydantic import Field, validator
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "admin"
    STAFF = "staff"

class User(Document):
    user_id: UUID = Field(default_factory=uuid4)
    
    # PIN-based authentication fields
    user_number: Indexed(int, unique=True) = Field(..., ge=10, le=99, description="Unique 2-digit user ID (10-99)")
    hashed_pin: Optional[str] = Field(None, description="Hashed PIN code (4-10 digits)")
    
    # User details
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    phone: Optional[str] = Field(None, max_length=15, description="Phone number")
    email: Optional[str] = Field(None, max_length=100, description="Email address")
    role: UserRole = Field(default=UserRole.STAFF)
    
    # Status
    is_active: bool = Field(default=True)
    pin_set: bool = Field(default=False, description="Whether user has set their PIN")
    created_by: Optional[UUID] = Field(None, description="Admin who created this user")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None

    @validator('user_number')
    def validate_user_number(cls, v):
        if not (10 <= v <= 99):
            raise ValueError('User number must be between 10 and 99')
        return v

    def __repr__(self) -> str:
        return f"<User #{self.user_number} - {self.full_name}>"

    def __str__(self) -> str:
        return f"#{self.user_number} - {self.full_name}"

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def can_login(self) -> bool:
        """Check if user can log in (active and has PIN set)"""
        return self.is_active and self.pin_set and self.hashed_pin is not None

    @property
    def is_admin(self) -> bool:
        """Check if user is an admin"""
        return self.role == UserRole.ADMIN

    def update_last_login(self):
        """Update last login timestamp"""
        self.last_login = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    class Settings:
        name = "users"
        indexes = [
            [("user_number", 1)],
            [("role", 1)],
            [("is_active", 1)]
        ]