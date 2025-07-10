# backend/app/schemas/user_schema.py
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, validator
from typing import Optional
from app.models.user_model import UserRole

class UserLoginRequest(BaseModel):
    user_number: int = Field(..., ge=10, le=99, description="2-digit user ID")
    pin: str = Field(..., min_length=4, max_length=10, description="4-10 digit PIN")

    @validator('pin')
    def validate_pin(cls, v):
        if not v.isdigit():
            raise ValueError('PIN must contain only digits')
        if not (4 <= len(v) <= 10):
            raise ValueError('PIN must be between 4 and 10 digits')
        return v

class UserCreateByAdmin(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50, description="First name of the user")
    last_name: str = Field(..., min_length=1, max_length=50, description="Last name of the user")
    phone: Optional[str] = Field(None, max_length=15, description="Phone number")
    email: Optional[str] = Field(None, max_length=100, description="Email address")
    is_admin: bool = Field(default=False, description="Whether user should be admin")
    pin: str = Field(..., min_length=4, max_length=10, description="Initial PIN for the user")
    confirm_pin: str = Field(..., min_length=4, max_length=10, description="Confirm PIN")

    @validator('phone')
    def validate_phone(cls, v):
        if v and v.strip():  # Only validate if phone is provided and not empty
            # Remove any non-digit characters
            digits_only = ''.join(filter(str.isdigit, v))
            if len(digits_only) < 10:
                raise ValueError('Phone number must be at least 10 digits')
            if len(digits_only) > 15:
                raise ValueError('Phone number cannot exceed 15 digits')
            return digits_only
        return None  # Return None for empty values

    @validator('email')
    def validate_email(cls, v):
        if v and v.strip():
            # Basic email validation
            import re
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, v.strip()):
                raise ValueError('Invalid email format')
            return v.strip()
        return None  # Return None for empty values

    @validator('pin', 'confirm_pin')
    def validate_pin_format(cls, v):
        if not v.isdigit():
            raise ValueError('PIN must contain only digits')
        if not (4 <= len(v) <= 10):
            raise ValueError('PIN must be between 4 and 10 digits')
        return v

    @validator('confirm_pin')
    def validate_pins_match(cls, v, values):
        if 'pin' in values and v != values['pin']:
            raise ValueError('PINs do not match')
        return v

class UserSetPin(BaseModel):
    pin: str = Field(..., min_length=4, max_length=10, description="4-10 digit PIN")
    confirm_pin: str = Field(..., min_length=4, max_length=10, description="Confirm PIN")

    @validator('pin', 'confirm_pin')
    def validate_pin_format(cls, v):
        if not v.isdigit():
            raise ValueError('PIN must contain only digits')
        if not (4 <= len(v) <= 10):
            raise ValueError('PIN must be between 4 and 10 digits')
        return v

    @validator('confirm_pin')
    def validate_pins_match(cls, v, values):
        if 'pin' in values and v != values['pin']:
            raise ValueError('PINs do not match')
        return v

class UserUpdatePin(BaseModel):
    current_pin: str = Field(..., min_length=4, max_length=10, description="Current PIN")
    new_pin: str = Field(..., min_length=4, max_length=10, description="New PIN")
    confirm_new_pin: str = Field(..., min_length=4, max_length=10, description="Confirm new PIN")

    @validator('current_pin', 'new_pin', 'confirm_new_pin')
    def validate_pin_format(cls, v):
        if not v.isdigit():
            raise ValueError('PIN must contain only digits')
        if not (4 <= len(v) <= 10):
            raise ValueError('PIN must be between 4 and 10 digits')
        return v

    @validator('confirm_new_pin')
    def validate_new_pins_match(cls, v, values):
        if 'new_pin' in values and v != values['new_pin']:
            raise ValueError('New PINs do not match')
        return v

class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, min_length=10, max_length=15)
    email: Optional[str] = Field(None, min_length=1, max_length=100)
    role: Optional[UserRole] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None

class UserOut(BaseModel):
    user_id: UUID
    user_number: int
    first_name: str
    last_name: str
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: UserRole
    is_active: bool
    pin_set: bool
    can_login: bool
    is_admin: bool
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True

class UserSummary(BaseModel):
    """Simplified user info for lists"""
    user_id: UUID
    user_number: int
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: UserRole
    is_admin: bool
    is_active: bool
    pin_set: bool
    created_at: datetime

    class Config:
        from_attributes = True

class FirstTimeSetupCheck(BaseModel):
    """Response for checking if this is first time setup"""
    is_first_time_setup: bool
    total_users: int
    admin_exists: bool

class AdminCreateRequest(BaseModel):
    """Request to create the first admin user"""
    user_number: int = Field(..., ge=10, le=99, description="2-digit admin ID")
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    pin: str = Field(..., min_length=4, max_length=10, description="Admin PIN")
    confirm_pin: str = Field(..., min_length=4, max_length=10, description="Confirm PIN")

    @validator('user_number')
    def validate_user_number(cls, v):
        if not (10 <= v <= 99):
            raise ValueError('User number must be between 10 and 99')
        return v

    @validator('pin', 'confirm_pin')
    def validate_pin_format(cls, v):
        if not v.isdigit():
            raise ValueError('PIN must contain only digits')
        if not (4 <= len(v) <= 10):
            raise ValueError('PIN must be between 4 and 10 digits')
        return v

    @validator('confirm_pin')
    def validate_pins_match(cls, v, values):
        if 'pin' in values and v != values['pin']:
            raise ValueError('PINs do not match')
        return v