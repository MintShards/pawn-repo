# backend/app/core/security.py
from datetime import datetime
from typing import Any, Union
from passlib.context import CryptContext
from app.core.config import settings
from datetime import timedelta
from jose import jwt

password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(subject: Union[str, Any], expires_delta: int = None) -> str:
    if expires_delta is not None:
        expires_delta = datetime.utcnow() + expires_delta
    else:
        expires_delta = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {"sub": str(subject), "exp": expires_delta}
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(subject: Union[str, Any], expires_delta: int = None) -> str:
    if expires_delta is not None:
        expires_delta = datetime.utcnow() + expires_delta
    else:
        expires_delta = datetime.utcnow() + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)

    to_encode = {"sub": str(subject), "exp": expires_delta}
    encoded_jwt = jwt.encode(to_encode, settings.JWT_REFRESH_SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def get_password_hash(password: str) -> str:
    """
    Hash a password/PIN using bcrypt.
    """
    return password_context.hash(password)

def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verify a password/PIN against a hashed password.
    """
    return password_context.verify(password, hashed_password)

# Backward compatibility aliases
def get_password(password: str) -> str:
    """Alias for get_password_hash for backward compatibility"""
    return get_password_hash(password)

def hash_pin(pin: str) -> str:
    """Hash a PIN - alias for clarity"""
    return get_password_hash(pin)

def verify_pin(pin: str, hashed_pin: str) -> bool:
    """Verify a PIN - alias for clarity"""
    return verify_password(pin, hashed_pin)