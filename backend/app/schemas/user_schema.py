from pydantic import BaseModel, Field, field_validator, EmailStr
from typing import Optional, List
from datetime import datetime
import re

from app.models.user_model import UserRole, UserStatus, AuthConfig


# Base schemas for different operations
class UserAuth(BaseModel):
    """Schema for user authentication (login)"""
    user_id: str = Field(..., min_length=2, max_length=2, description="2-digit user ID")
    pin: str = Field(..., min_length=4, max_length=4, description="4-digit PIN")
    
    @field_validator('user_id')
    @classmethod
    def validate_user_id(cls, v: str) -> str:
        if not re.match(r'^\d{2}$', v):
            raise ValueError('User ID must be exactly 2 digits')
        return v
    
    @field_validator('pin')
    @classmethod
    def validate_pin(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError('PIN must contain only digits')
        if len(v) != 4:
            raise ValueError('PIN must be exactly 4 digits')
        return v


class UserCreate(BaseModel):
    """Schema for creating a new user"""
    user_id: str = Field(..., min_length=2, max_length=2, description="2-digit unique user ID")
    pin: str = Field(..., min_length=4, max_length=4, description="4-digit PIN")
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: Optional[EmailStr] = None
    role: UserRole = Field(default=UserRole.STAFF)
    notes: Optional[str] = Field(None, max_length=500, description="Internal admin notes")
    
    @field_validator('user_id')
    @classmethod
    def validate_user_id(cls, v: str) -> str:
        if not re.match(r'^\d{2}$', v):
            raise ValueError('User ID must be exactly 2 digits')
        return v
    
    @field_validator('pin')
    @classmethod
    def validate_pin(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError('PIN must contain only digits')
        if len(v) != AuthConfig.MIN_PIN_LENGTH:
            raise ValueError(f'PIN must be exactly {AuthConfig.MIN_PIN_LENGTH} digits')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "01",
                "pin": "1234",
                "first_name": "John",
                "last_name": "Doe",
                "email": "john.doe@pawnshop.com",
                "role": "staff",
                "notes": "New staff member"
            }
        }


class UserUpdate(BaseModel):
    """Schema for updating user information"""
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    status: Optional[UserStatus] = None
    notes: Optional[str] = Field(None, max_length=500)

    class Config:
        json_schema_extra = {
            "example": {
                "first_name": "John",
                "last_name": "Smith",
                "email": "john.smith@pawnshop.com",
                "role": "admin",
                "status": "active",
                "notes": "Promoted to admin"
            }
        }


class UserPinChange(BaseModel):
    """Schema for changing user PIN"""
    current_pin: str = Field(..., min_length=4, max_length=4)
    new_pin: str = Field(..., min_length=4, max_length=4)
    confirm_pin: str = Field(..., min_length=4, max_length=4)
    
    @field_validator('current_pin', 'new_pin', 'confirm_pin')
    @classmethod
    def validate_pin_digits(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError('PIN must contain only digits')
        return v
    
    def validate_pins_match(self) -> bool:
        """Validate that new PIN and confirmation match"""
        return self.new_pin == self.confirm_pin


class UserResponse(BaseModel):
    """Schema for user data in responses (excludes sensitive info)"""
    user_id: str
    first_name: str
    last_name: str
    email: Optional[EmailStr]
    role: UserRole
    status: UserStatus
    created_at: datetime
    last_login: Optional[datetime]
    notes: Optional[str] = None  # Only visible to admins

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "user_id": "01",
                "first_name": "John",
                "last_name": "Doe",
                "email": "john.doe@pawnshop.com",
                "role": "staff",
                "status": "active",
                "created_at": "2024-01-01T10:00:00Z",
                "last_login": "2024-01-15T09:30:00Z",
                "notes": "Regular staff member"
            }
        }


class UserDetailResponse(UserResponse):
    """Extended user response with additional details for admin use"""
    created_by: Optional[str]
    updated_at: datetime
    failed_login_attempts: int
    locked_until: Optional[datetime]
    last_activity: Optional[datetime]
    active_sessions: List[str]

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """Schema for paginated user list responses"""
    users: List[UserResponse]
    total: int
    page: int
    per_page: int
    pages: int

    class Config:
        json_schema_extra = {
            "example": {
                "users": [
                    {
                        "user_id": "01",
                        "first_name": "John",
                        "last_name": "Doe",
                        "email": "john.doe@pawnshop.com",
                        "role": "staff",
                        "status": "active",
                        "created_at": "2024-01-01T10:00:00Z",
                        "last_login": "2024-01-15T09:30:00Z"
                    }
                ],
                "total": 25,
                "page": 1,
                "per_page": 10,
                "pages": 3
            }
        }


class LoginResponse(BaseModel):
    """Schema for successful login response"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: UserResponse
    session_id: str

    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
                "token_type": "bearer",
                "expires_in": 900,
                "user": {
                    "user_id": "01",
                    "first_name": "John",
                    "last_name": "Doe",
                    "role": "staff",
                    "status": "active"
                },
                "session_id": "sess_123456789"
            }
        }


class ErrorResponse(BaseModel):
    """Schema for error responses"""
    error: str
    message: str
    details: Optional[dict] = None

    class Config:
        json_schema_extra = {
            "example": {
                "error": "INVALID_CREDENTIALS",
                "message": "Invalid user ID or PIN",
                "details": {
                    "attempts_remaining": 3
                }
            }
        }


class UserStatsResponse(BaseModel):
    """Schema for user statistics (admin only)"""
    total_users: int
    active_users: int
    suspended_users: int
    locked_users: int
    admin_users: int
    staff_users: int
    users_created_today: int
    recent_logins: int

    class Config:
        json_schema_extra = {
            "example": {
                "total_users": 25,
                "active_users": 22,
                "suspended_users": 2,
                "locked_users": 1,
                "admin_users": 3,
                "staff_users": 22,
                "users_created_today": 2,
                "recent_logins": 15
            }
        }


# Query parameter schemas
class UserFilters(BaseModel):
    """Schema for user list filtering"""
    role: Optional[UserRole] = None
    status: Optional[UserStatus] = None
    search: Optional[str] = Field(None, max_length=100, description="Search in name, email, or user_id")
    page: int = Field(1, ge=1, description="Page number")
    per_page: int = Field(10, ge=1, le=100, description="Items per page")
    sort_by: Optional[str] = Field("created_at", description="Sort field")
    sort_order: Optional[str] = Field("desc", pattern="^(asc|desc)$", description="Sort order")

    class Config:
        json_schema_extra = {
            "example": {
                "role": "staff",
                "status": "active",
                "search": "john",
                "page": 1,
                "per_page": 10,
                "sort_by": "last_login",
                "sort_order": "desc"
            }
        }