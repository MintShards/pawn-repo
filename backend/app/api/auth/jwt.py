# backend/app/api/auth/jwt.py
from typing import Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Body
from app.services.user_service import UserService
from app.core.security import create_access_token, create_refresh_token
from app.schemas.auth_schema import TokenSchema, LoginResponse, TokenPayLoad, PinStrengthResponse
from app.schemas.user_schema import (
    UserLoginRequest, UserOut, AdminCreateRequest, FirstTimeSetupCheck,
    UserSetPin, UserCreateByAdmin, UserSummary
)
from app.models.user_model import User
from app.api.deps.user_deps import get_current_user, get_current_admin
from app.core.config import settings
from pydantic import ValidationError
from jose import jwt, JWTError
import logging

logger = logging.getLogger(__name__)
auth_router = APIRouter()

# ========== FIRST TIME SETUP ==========

@auth_router.get('/setup/check', summary="Check if first time setup is needed", response_model=FirstTimeSetupCheck)
async def check_first_time_setup() -> Any:
    """Check if this is the first time setup (no users exist)"""
    return await UserService.check_first_time_setup()

@auth_router.post('/setup/admin', summary="Create first admin user", response_model=UserOut)
async def create_first_admin(admin_data: AdminCreateRequest) -> Any:
    """Create the first admin user during initial setup"""
    try:
        user = await UserService.create_first_admin(admin_data)
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating first admin: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create admin user"
        )

# ========== LOGIN / LOGOUT ==========

@auth_router.post('/login', summary="Login with user number and PIN", response_model=LoginResponse)
async def login(login_data: UserLoginRequest) -> Any:
    """Login with 2-digit user number and PIN"""
    user = await UserService.authenticate_user(login_data.user_number, login_data.pin)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user number or PIN",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    if not user.can_login:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive or PIN not set"
        )
    
    access_token = create_access_token(str(user.user_id))
    refresh_token = create_refresh_token(str(user.user_id))
    
    # Create user dict without sensitive data
    user_data = {
        "user_id": str(user.user_id),
        "user_number": user.user_number,
        "full_name": user.full_name,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role.value,
        "is_admin": user.is_admin
    }
    
    logger.info(f"User #{user.user_number} ({user.full_name}) logged in")
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_data
    )

@auth_router.post('/test-token', summary="Test if the access token is valid", response_model=UserOut)
async def test_token(user: User = Depends(get_current_user)):
    """Test if the access token is valid"""
    return user

@auth_router.post('/refresh', summary="Refresh access token", response_model=TokenSchema)
async def refresh_token(refresh_token: str = Body(...)):
    """Refresh the access token using refresh token"""
    try:
        payload = jwt.decode(
            refresh_token, 
            settings.JWT_REFRESH_SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayLoad(**payload)
    except (JWTError, ValidationError):
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
            detail="Invalid token for user",
        )

    return TokenSchema(
        access_token=create_access_token(str(user.user_id)),
        refresh_token=create_refresh_token(str(user.user_id)),
    )

# ========== PIN MANAGEMENT ==========

@auth_router.post('/pin/set/{user_number}', summary="Set PIN for new user", response_model=UserOut)
async def set_user_pin(user_number: int, pin_data: UserSetPin) -> Any:
    """Set PIN for a user who doesn't have one yet"""
    try:
        user = await UserService.set_user_pin(user_number, pin_data)
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error setting PIN for user #{user_number}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set PIN"
        )

@auth_router.post('/pin/check-strength', summary="Check PIN strength", response_model=PinStrengthResponse)
async def check_pin_strength(pin: str = Body(..., embed=True)) -> Any:
    """Check the strength of a PIN and provide feedback"""
    try:
        result = UserService.validate_pin_strength(pin)
        return PinStrengthResponse(**result)
    except Exception as e:
        logger.error(f"Error checking PIN strength: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check PIN strength"
        )

@auth_router.get('/user-numbers/available', summary="Get next available user number")
async def get_next_available_user_number(current_user: User = Depends(get_current_admin)) -> Any:
    """Get the next available user number (admin only)"""
    try:
        next_number = await UserService.get_next_available_user_number()
        if next_number is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All user numbers (10-99) are taken"
            )
        return {"next_available": next_number}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting next available user number: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get available user number"
        )

@auth_router.get('/user-numbers/check/{user_number}', summary="Check if user number is available")
async def check_user_number_available(
    user_number: int,
    current_user: User = Depends(get_current_admin)
) -> Any:
    """Check if a specific user number is available (admin only)"""
    if not (10 <= user_number <= 99):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User number must be between 10 and 99"
        )
    
    try:
        is_available = await UserService.check_user_number_available(user_number)
        return {
            "user_number": user_number,
            "is_available": is_available
        }
    except Exception as e:
        logger.error(f"Error checking user number availability: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check user number availability"
        )