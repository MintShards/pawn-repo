# backend/app/api/deps/user_deps.py
from datetime import datetime
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import ValidationError
from app.core.config import settings
from app.models.user_model import User, UserRole
from jose import jwt
from app.services.user_service import UserService
from app.schemas.auth_schema import TokenPayLoad

# Use HTTPBearer instead of OAuth2PasswordBearer for PIN system
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Get the current authenticated user from JWT token"""
    token = credentials.credentials
    
    try: 
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET_KEY, 
            algorithms=[settings.ALGORITHM] 
        )
        token_data = TokenPayLoad(**payload)

        if datetime.fromtimestamp(token_data.exp) < datetime.now():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except (jwt.JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Convert string UUID to UUID object for UserService
    try:
        user_uuid = UUID(str(token_data.sub)) if isinstance(token_data.sub, str) else token_data.sub
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid token format",
        )
    
    user = await UserService.get_user_by_id(user_uuid)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )
    
    if not user.can_login:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User cannot login - PIN not set or account inactive",
        )
    
    return user

async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """Get the current user if they are an admin"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get the current user if they are active (alias for backward compatibility)"""
    return current_user

async def get_current_user_websocket(token: str) -> User:
    """Get current user from WebSocket token (without Depends)"""
    try:
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET_KEY, 
            algorithms=[settings.ALGORITHM] 
        )
        token_data = TokenPayLoad(**payload)

        if datetime.fromtimestamp(token_data.exp) < datetime.now():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
    except (jwt.JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials"
        )
    
    # Convert string UUID to UUID object for UserService
    try:
        user_uuid = UUID(str(token_data.sub)) if isinstance(token_data.sub, str) else token_data.sub
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid token format"
        )
    
    user = await UserService.get_user_by_id(user_uuid)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )
    
    if not user.can_login:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User cannot login - PIN not set or account inactive"
        )
    
    return user