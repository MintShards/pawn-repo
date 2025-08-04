from beanie import Document, Indexed
from pydantic import Field, field_validator, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime, timedelta
from enum import Enum
import re

from app.core.security import get_pin, verify_pin


# Configuration constants
class AuthConfig:
    """Authentication configuration constants"""
    MAX_FAILED_LOGIN_ATTEMPTS = 5
    ACCOUNT_LOCKOUT_DURATION_MINUTES = 30
    MIN_PIN_LENGTH = 4
    MAX_PIN_LENGTH = 4
    USER_ID_LENGTH = 2
    SESSION_TIMEOUT_HOURS = 8
    MAX_CONCURRENT_SESSIONS = 3
    PIN_HASH_MIN_LENGTH = 60  # Bcrypt produces ~60 character hash


# Custom exceptions
class AuthenticationError(Exception):
    """Base exception for authentication errors"""
    pass


class AccountLockedError(AuthenticationError):
    """Raised when account is locked due to failed attempts"""
    pass


class InvalidCredentialsError(AuthenticationError):
    """Raised when credentials are invalid"""
    pass



class UserRole(str, Enum):
    ADMIN = "admin"
    STAFF = "staff"


class UserStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DEACTIVATED = "deactivated"


class User(Document):
    # Authentication fields
    user_id: Indexed(str, unique=True) = Field(
        ..., 
        description="2-digit unique user ID",
        min_length=AuthConfig.USER_ID_LENGTH,
        max_length=AuthConfig.USER_ID_LENGTH
    )
    pin_hash: str = Field(
        ..., 
        description="Bcrypt hashed 4-digit PIN",
        min_length=AuthConfig.PIN_HASH_MIN_LENGTH
    )
    
    # Profile information
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: Optional[EmailStr] = Field(None)
    
    # Role and status
    role: UserRole = Field(default=UserRole.STAFF)
    status: UserStatus = Field(default=UserStatus.ACTIVE)
    
    # Audit fields
    created_at: Indexed(datetime) = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = Field(None, description="User ID who created this account")
    last_login: Optional[datetime] = None
    failed_login_attempts: int = Field(default=0, ge=0)
    locked_until: Optional[datetime] = None
    
    # Session management fields
    active_sessions: List[str] = Field(default_factory=list)
    last_activity: Optional[datetime] = None
    password_changed_at: Optional[datetime] = None
    login_history: List[dict] = Field(default_factory=list, max_items=100)
    
    # Additional fields
    notes: Optional[str] = Field(None, max_length=500, description="Internal admin notes")
    
    @field_validator('user_id')
    @classmethod
    def validate_user_id(cls, v: str) -> str:
        """Validate user ID format"""
        if not isinstance(v, str):
            raise ValueError('User ID must be a string')
        if not re.match(rf'^\d{{{AuthConfig.USER_ID_LENGTH}}}$', v):
            raise ValueError(f'User ID must be exactly {AuthConfig.USER_ID_LENGTH} digits')
        return v
    
    @field_validator('pin_hash')
    @classmethod
    def validate_pin_hash(cls, v: str) -> str:
        """Validate PIN hash format and strength"""
        if not v or len(v) < AuthConfig.PIN_HASH_MIN_LENGTH:
            raise ValueError(f'PIN hash must be at least {AuthConfig.PIN_HASH_MIN_LENGTH} characters (bcrypt)')
        # Validate it looks like a proper bcrypt hash
        if not v.startswith('$2b$'):
            raise ValueError('PIN hash must be a valid bcrypt hash')
        return v
    
    def is_locked(self) -> bool:
        """Check if user account is locked due to failed login attempts"""
        if self.locked_until and self.locked_until > datetime.utcnow():
            return True
        # Auto-unlock if lockout period has passed
        if self.locked_until and self.locked_until <= datetime.utcnow():
            self.locked_until = None
            self.failed_login_attempts = 0
        return False
    
    def can_access_admin_features(self) -> bool:
        """Check if user has admin privileges"""
        return self.role == UserRole.ADMIN and self.status == UserStatus.ACTIVE
    
    def update_last_login(self) -> None:
        """Update last login timestamp and reset failed attempts"""
        now = datetime.utcnow()
        self.last_login = now
        self.last_activity = now
        self.failed_login_attempts = 0
        self.locked_until = None
        
        # Add to login history
        login_entry = {
            "timestamp": now.isoformat(),
            "success": True
        }
        self.login_history.insert(0, login_entry)
        # Keep only last 100 entries
        self.login_history = self.login_history[:100]
    
    def increment_failed_login(self) -> None:
        """Increment failed login attempts and lock account if necessary"""
        self.failed_login_attempts += 1
        now = datetime.utcnow()
        
        # Add to login history
        login_entry = {
            "timestamp": now.isoformat(),
            "success": False,
            "attempt_number": self.failed_login_attempts
        }
        self.login_history.insert(0, login_entry)
        self.login_history = self.login_history[:100]
        
        if self.failed_login_attempts >= AuthConfig.MAX_FAILED_LOGIN_ATTEMPTS:
            # Lock account using timedelta (fixes the datetime bug)
            self.locked_until = now + timedelta(minutes=AuthConfig.ACCOUNT_LOCKOUT_DURATION_MINUTES)
    
    @classmethod
    def hash_pin(cls, pin: str) -> str:
        """Hash a PIN using bcrypt"""
        if not pin or len(pin) != AuthConfig.MIN_PIN_LENGTH:
            raise ValueError(f"PIN must be exactly {AuthConfig.MIN_PIN_LENGTH} digits")
        if not pin.isdigit():
            raise ValueError("PIN must contain only digits")
        return get_pin(pin)
    
    def verify_pin(self, pin: str) -> bool:
        """Verify a PIN against the stored hash"""
        try:
            if not pin or len(pin) != AuthConfig.MIN_PIN_LENGTH or not pin.isdigit():
                return False
            return verify_pin(pin, self.pin_hash)
        except ValueError:
            return False
    
    def add_session(self, session_id: str) -> None:
        """Add a new session and enforce concurrent session limit"""
        if session_id not in self.active_sessions:
            self.active_sessions.append(session_id)
            # Remove oldest sessions if limit exceeded
            if len(self.active_sessions) > AuthConfig.MAX_CONCURRENT_SESSIONS:
                self.active_sessions = self.active_sessions[-AuthConfig.MAX_CONCURRENT_SESSIONS:]
        self.last_activity = datetime.utcnow()
    
    def remove_session(self, session_id: str) -> None:
        """Remove a session"""
        if session_id in self.active_sessions:
            self.active_sessions.remove(session_id)
    
    def is_session_valid(self, session_id: str) -> bool:
        """Check if a session is still valid"""
        if session_id not in self.active_sessions:
            return False
        if self.last_activity:
            session_age = datetime.utcnow() - self.last_activity
            if session_age > timedelta(hours=AuthConfig.SESSION_TIMEOUT_HOURS):
                self.remove_session(session_id)
                return False
        return True
    
    def update_activity(self) -> None:
        """Update last activity timestamp"""
        self.last_activity = datetime.utcnow()
    
    class Settings:
        name = "users"
        indexes = [
            "user_id",
            "email",
            "role",
            "status",
            "created_at",  # Added for audit queries
            [("role", 1), ("status", 1)],  # Compound index for role+status queries
            [("status", 1), ("last_login", -1)]  # For active user queries
        ]
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "01",
                "first_name": "John",
                "last_name": "Doe",
                "email": "john.doe@pawnshop.com",
                "role": "staff",
                "status": "active",
                "notes": "Regular staff member"
            }
        },
        validate_assignment=True,
        use_enum_values=True
    )