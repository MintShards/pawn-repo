"""
CSRF Protection Module

Provides Cross-Site Request Forgery (CSRF) protection for FastAPI applications.
Implements token-based CSRF protection for state-changing operations.
"""

import secrets
import hmac
import hashlib
import time
import json
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, UTC

from fastapi import HTTPException, status, Request, Depends
from fastapi.security import HTTPBearer
import redis
import structlog

# Configure logger
csrf_logger = structlog.get_logger("csrf")

class CSRFConfig:
    """CSRF protection configuration"""
    
    # Token settings
    TOKEN_LENGTH = 32  # Length of CSRF tokens
    TOKEN_EXPIRY = 3600  # Token expiry in seconds (1 hour)
    HEADER_NAME = "X-CSRF-Token"
    COOKIE_NAME = "csrf_token"
    
    # Security settings
    SECRET_KEY = None  # Will be set from app config
    SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}
    
    # Redis settings for token storage
    REDIS_PREFIX = "csrf:"
    REDIS_EXPIRY = TOKEN_EXPIRY


class CSRFError(Exception):
    """CSRF protection related errors"""
    pass


class CSRFTokenManager:
    """Manages CSRF token generation, validation, and storage"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None, secret_key: str = None):
        self.redis_client = redis_client
        self.secret_key = secret_key or secrets.token_urlsafe(32)
        self.in_memory_tokens: Dict[str, Dict[str, Any]] = {}
        
        csrf_logger.info(
            "CSRF token manager initialized",
            redis_available=bool(redis_client),
            secret_key_length=len(self.secret_key)
        )
    
    def generate_token(self, user_id: str = None) -> str:
        """
        Generate a new CSRF token for a user session.
        
        Args:
            user_id: Optional user identifier for token association
            
        Returns:
            Generated CSRF token string
        """
        # Generate random token
        token = secrets.token_urlsafe(CSRFConfig.TOKEN_LENGTH)
        
        # Create token metadata
        token_data = {
            "user_id": user_id,
            "created_at": datetime.now(UTC).timestamp(),
            "expires_at": (datetime.now(UTC) + timedelta(seconds=CSRFConfig.TOKEN_EXPIRY)).timestamp()
        }
        
        # Store token
        if self.redis_client:
            try:
                key = f"{CSRFConfig.REDIS_PREFIX}{token}"
                self.redis_client.setex(
                    key, 
                    CSRFConfig.REDIS_EXPIRY, 
                    json.dumps(token_data)
                )
                csrf_logger.debug("CSRF token stored in Redis", token_length=len(token))
            except Exception as e:
                csrf_logger.warning("Failed to store CSRF token in Redis", error=str(e))
                self.in_memory_tokens[token] = token_data
        else:
            # Fallback to in-memory storage
            self.in_memory_tokens[token] = token_data
            
            # Clean up expired tokens
            self._cleanup_expired_tokens()
        
        csrf_logger.info("CSRF token generated", user_id=user_id, token_length=len(token))
        return token
    
    def validate_token(self, token: str, user_id: str = None) -> bool:
        """
        Validate a CSRF token.
        
        Args:
            token: CSRF token to validate
            user_id: Optional user identifier for additional validation
            
        Returns:
            True if token is valid, False otherwise
        """
        if not token:
            csrf_logger.warning("CSRF validation failed: empty token")
            return False
        
        token_data = None
        
        # Try Redis first
        if self.redis_client:
            try:
                key = f"{CSRFConfig.REDIS_PREFIX}{token}"
                stored_data = self.redis_client.get(key)
                if stored_data:
                    try:
                        token_data = json.loads(stored_data.decode())
                        csrf_logger.debug("CSRF token found in Redis")
                    except json.JSONDecodeError as e:
                        csrf_logger.warning("Failed to parse CSRF token data from Redis", error=str(e))
                        token_data = None
            except Exception as e:
                csrf_logger.warning("Failed to retrieve CSRF token from Redis", error=str(e))
        
        # Fallback to in-memory storage
        if not token_data:
            token_data = self.in_memory_tokens.get(token)
            if token_data:
                csrf_logger.debug("CSRF token found in memory")
        
        if not token_data:
            csrf_logger.warning("CSRF validation failed: token not found", token_length=len(token))
            return False
        
        # Check expiration
        current_time = datetime.now(UTC).timestamp()
        if current_time > token_data["expires_at"]:
            csrf_logger.warning("CSRF validation failed: token expired")
            self._remove_token(token)
            return False
        
        # Check user association if provided
        if user_id and token_data.get("user_id") != user_id:
            csrf_logger.warning(
                "CSRF validation failed: user mismatch",
                expected_user=user_id,
                token_user=token_data.get("user_id")
            )
            return False
        
        csrf_logger.info("CSRF token validated successfully", user_id=user_id)
        return True
    
    def revoke_token(self, token: str) -> bool:
        """
        Revoke a CSRF token.
        
        Args:
            token: Token to revoke
            
        Returns:
            True if token was revoked, False if not found
        """
        removed = self._remove_token(token)
        if removed:
            csrf_logger.info("CSRF token revoked", token_length=len(token))
        return removed
    
    def _remove_token(self, token: str) -> bool:
        """Remove token from storage"""
        removed = False
        
        # Remove from Redis
        if self.redis_client:
            try:
                key = f"{CSRFConfig.REDIS_PREFIX}{token}"
                removed = bool(self.redis_client.delete(key))
            except Exception as e:
                csrf_logger.warning("Failed to remove CSRF token from Redis", error=str(e))
        
        # Remove from memory
        if token in self.in_memory_tokens:
            del self.in_memory_tokens[token]
            removed = True
        
        return removed
    
    def _cleanup_expired_tokens(self):
        """Clean up expired tokens from in-memory storage"""
        current_time = datetime.now(UTC).timestamp()
        expired_tokens = [
            token for token, data in self.in_memory_tokens.items()
            if current_time > data["expires_at"]
        ]
        
        for token in expired_tokens:
            del self.in_memory_tokens[token]
        
        if expired_tokens:
            csrf_logger.debug(f"Cleaned up {len(expired_tokens)} expired CSRF tokens")


# Global token manager instance
csrf_token_manager: Optional[CSRFTokenManager] = None


def initialize_csrf_protection(redis_client: Optional[redis.Redis] = None, secret_key: str = None):
    """Initialize CSRF protection with Redis client and secret key"""
    global csrf_token_manager
    
    csrf_token_manager = CSRFTokenManager(redis_client, secret_key)
    csrf_logger.info("CSRF protection initialized")
    
    return csrf_token_manager


def get_csrf_token_manager() -> CSRFTokenManager:
    """Get the global CSRF token manager"""
    if not csrf_token_manager:
        raise CSRFError("CSRF protection not initialized")
    return csrf_token_manager


class CSRFProtection:
    """CSRF protection dependency for FastAPI endpoints"""
    
    def __init__(self, exempt_methods: Optional[set] = None):
        self.exempt_methods = exempt_methods or CSRFConfig.SAFE_METHODS
    
    async def __call__(self, request: Request) -> bool:
        """
        Validate CSRF token for unsafe HTTP methods.
        
        Args:
            request: FastAPI request object
            
        Returns:
            True if validation passes
            
        Raises:
            HTTPException: If CSRF validation fails
        """
        # Skip validation for safe methods
        if request.method in self.exempt_methods:
            return True
        
        # Get token manager
        try:
            token_manager = get_csrf_token_manager()
        except CSRFError as e:
            csrf_logger.error("CSRF token manager not available", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="CSRF protection not available"
            )
        
        # Extract token from header
        csrf_token = request.headers.get(CSRFConfig.HEADER_NAME)
        
        if not csrf_token:
            csrf_logger.warning(
                "CSRF protection failed: missing token",
                method=request.method,
                path=request.url.path,
                client_ip=request.client.host if request.client else "unknown"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "CSRF token required",
                    "message": f"CSRF token must be provided in {CSRFConfig.HEADER_NAME} header",
                    "header_name": CSRFConfig.HEADER_NAME
                }
            )
        
        # Extract user ID from request if available (for additional validation)
        user_id = None
        if hasattr(request.state, "user") and request.state.user:
            user_id = getattr(request.state.user, "user_id", None)
        
        # Validate token
        if not token_manager.validate_token(csrf_token, user_id):
            csrf_logger.warning(
                "CSRF protection failed: invalid token",
                method=request.method,
                path=request.url.path,
                client_ip=request.client.host if request.client else "unknown",
                user_id=user_id
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "Invalid CSRF token",
                    "message": "The provided CSRF token is invalid or expired",
                    "header_name": CSRFConfig.HEADER_NAME
                }
            )
        
        csrf_logger.debug(
            "CSRF protection passed",
            method=request.method,
            path=request.url.path,
            user_id=user_id
        )
        
        return True


# Convenience instances
csrf_protect = CSRFProtection()
csrf_protect_exempt_get = CSRFProtection(exempt_methods={"GET", "HEAD", "OPTIONS"})


def generate_csrf_token(user_id: str = None) -> str:
    """
    Generate a new CSRF token.
    
    Args:
        user_id: Optional user identifier
        
    Returns:
        Generated CSRF token
        
    Raises:
        CSRFError: If CSRF protection not initialized
    """
    token_manager = get_csrf_token_manager()
    return token_manager.generate_token(user_id)


def validate_csrf_token(token: str, user_id: str = None) -> bool:
    """
    Validate a CSRF token.
    
    Args:
        token: CSRF token to validate
        user_id: Optional user identifier
        
    Returns:
        True if token is valid, False otherwise
    """
    try:
        token_manager = get_csrf_token_manager()
        return token_manager.validate_token(token, user_id)
    except CSRFError:
        return False


def revoke_csrf_token(token: str) -> bool:
    """
    Revoke a CSRF token.
    
    Args:
        token: Token to revoke
        
    Returns:
        True if token was revoked, False if not found
    """
    try:
        token_manager = get_csrf_token_manager()
        return token_manager.revoke_token(token)
    except CSRFError:
        return False