# backend/app/schemas/auth_schema.py
from uuid import UUID
from pydantic import BaseModel, Field
from typing import Union

class TokenSchema(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenPayLoad(BaseModel):
    sub: Union[str, UUID] = None  # Allow both string and UUID
    exp: int = None

class LoginResponse(BaseModel):
    """Response after successful login"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict  # User info without sensitive data

class PinStrengthResponse(BaseModel):
    """Response for PIN strength validation"""
    is_strong: bool
    score: int  # 1-5 scale
    feedback: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)