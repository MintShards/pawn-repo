"""User dependency injection for FastAPI endpoints."""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings
from app.models.user_model import User, UserRole, UserStatus
from app.services.user_service import UserService
from app.schemas.auth_schema import TokenPayload

# HTTP Bearer security scheme
security = HTTPBearer()

# Optional Bearer security scheme (doesn't raise error if no token)
optional_security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """
    Get current authenticated user from JWT token.
    
    Args:
        credentials: Bearer token from Authorization header
        
    Returns:
        User: Current authenticated user
        
    Raises:
        HTTPException: 401 if token is invalid or user not found
        HTTPException: 403 if user account is not active
    """
    token = credentials.credentials
    return await UserService.get_current_user(token)


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current active user (additional check for active status).
    
    Args:
        current_user: User from get_current_user dependency
        
    Returns:
        User: Current active user
        
    Raises:
        HTTPException: 403 if user account is not active
    """
    if current_user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {current_user.status.value}"
        )
    return current_user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security)
) -> Optional[User]:
    """
    Get current user if authenticated, None otherwise.
    Used for endpoints that work with or without authentication.
    
    Args:
        credentials: Optional Bearer token from Authorization header
        
    Returns:
        User | None: Current user if authenticated, None otherwise
    """
    if not credentials:
        return None
    
    try:
        token = credentials.credentials
        return await UserService.get_current_user(token)
    except HTTPException:
        return None


async def get_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Require admin privileges.
    
    Args:
        current_user: User from get_current_active_user dependency
        
    Returns:
        User: Current admin user
        
    Raises:
        HTTPException: 403 if user is not admin
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


async def get_staff_or_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Require staff or admin privileges.
    
    Args:
        current_user: User from get_current_active_user dependency
        
    Returns:
        User: Current staff or admin user
        
    Raises:
        HTTPException: 403 if user is not staff or admin
    """
    if current_user.role not in [UserRole.STAFF, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff or Admin privileges required"
        )
    return current_user


class RoleChecker:
    """Role-based access control checker."""
    
    def __init__(self, allowed_roles: list[UserRole]):
        """
        Initialize role checker.
        
        Args:
            allowed_roles: List of allowed user roles
        """
        self.allowed_roles = allowed_roles
    
    def __call__(self, current_user: User = Depends(get_current_active_user)) -> User:
        """
        Check if current user has required role.
        
        Args:
            current_user: User from get_current_active_user dependency
            
        Returns:
            User: Current user if authorized
            
        Raises:
            HTTPException: 403 if user doesn't have required role
        """
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient privileges"
            )
        return current_user


# Convenience dependency instances
require_admin = RoleChecker([UserRole.ADMIN])
require_staff_or_admin = RoleChecker([UserRole.STAFF, UserRole.ADMIN])


async def validate_token_payload(token: str) -> TokenPayload:
    """
    Validate token and return payload.
    
    Args:
        token: JWT token string
        
    Returns:
        TokenPayload: Validated token payload
        
    Raises:
        HTTPException: 401 if token is invalid or expired
    """
    try:
        payload_dict = UserService.decode_token(token)
        return TokenPayload(**payload_dict)
    except HTTPException:
        # Re-raise HTTP exceptions from UserService
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
            headers={"WWW-Authenticate": "Bearer"}
        )


async def get_refresh_token_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """
    Get user from refresh token.
    Used specifically for refresh token endpoints.
    
    Args:
        credentials: Bearer token from Authorization header
        
    Returns:
        User: User associated with refresh token
        
    Raises:
        HTTPException: 401 if refresh token is invalid
    """
    token = credentials.credentials
    
    try:
        payload_dict = UserService.decode_token(token)
        token_payload = TokenPayload(**payload_dict)
        
        # Verify this is a refresh token
        if token_payload.token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type. Refresh token required",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Get user from token
        user = await UserService.get_current_user(token)
        return user
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except (ValueError, TypeError, AttributeError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Refresh token validation error: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"}
        )