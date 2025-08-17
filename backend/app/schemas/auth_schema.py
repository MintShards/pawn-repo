"""Authentication schema definitions for JWT and refresh token functionality."""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class TokenSchema(BaseModel):
    """Schema for token pair response"""
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Access token expiration in seconds")
    
    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
                "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
                "token_type": "bearer",
                "expires_in": 900
            }
        }


class TokenPayload(BaseModel):
    """Schema for JWT token payload"""
    sub: Optional[str] = Field(None, description="Subject (user_id)")
    role: Optional[str] = Field(None, description="User role")
    status: Optional[str] = Field(None, description="User status")
    exp: Optional[int] = Field(None, description="Expiration timestamp")
    iat: Optional[int] = Field(None, description="Issued at timestamp")
    token_type: Optional[str] = Field(None, description="Token type (access/refresh)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "sub": "69",
                "role": "admin",
                "status": "active",
                "exp": 1640995200,
                "iat": 1640908800,
                "token_type": "access"
            }
        }


class RefreshTokenRequest(BaseModel):
    """Schema for refresh token request"""
    refresh_token: str = Field(..., description="Valid refresh token")
    
    class Config:
        json_schema_extra = {
            "example": {
                "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
            }
        }


class AccessTokenResponse(BaseModel):
    """Schema for new access token response"""
    access_token: str = Field(..., description="New JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Access token expiration in seconds")
    
    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
                "token_type": "bearer",
                "expires_in": 900
            }
        }


class LoginWithRefreshResponse(BaseModel):
    """Schema for login with refresh token response including user data"""
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Access token expiration in seconds")
    user: Dict[str, Any] = Field(..., description="User data")
    session_id: str = Field(..., description="Session ID")
    
    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
                "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
                "token_type": "bearer",
                "expires_in": 1800,
                "user": {
                    "user_id": "69",
                    "role": "admin",
                    "status": "active"
                },
                "session_id": "sess_12345"
            }
        }


class TokenVerificationResponse(BaseModel):
    """Schema for token verification response"""
    valid: bool = Field(..., description="Whether token is valid")
    user_id: Optional[str] = Field(None, description="User ID from token")
    role: Optional[str] = Field(None, description="User role from token")
    status: Optional[str] = Field(None, description="User status from token")
    expires_at: Optional[int] = Field(None, description="Token expiration timestamp")
    token_type: Optional[str] = Field(None, description="Token type")
    
    class Config:
        json_schema_extra = {
            "example": {
                "valid": True,
                "user_id": "69",
                "role": "admin",
                "status": "active",
                "expires_at": 1640995200,
                "token_type": "access"
            }
        }