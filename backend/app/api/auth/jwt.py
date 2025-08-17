"""JWT authentication endpoints for the pawnshop system."""

# Standard library imports
import logging

# Third-party imports
from fastapi import APIRouter, HTTPException, status, Request

# Local imports
from app.core.security_middleware import auth_rate_limit, api_rate_limit
from app.models.user_model import AuthenticationError, AccountLockedError, InvalidCredentialsError
from app.schemas.auth_schema import TokenSchema, RefreshTokenRequest, AccessTokenResponse, TokenVerificationResponse, LoginWithRefreshResponse
from app.schemas.user_schema import UserAuth, LoginResponse
from app.services.user_service import UserService

# Security logger for authentication events
security_logger = logging.getLogger("security.auth")

auth_router = APIRouter()


def _extract_client_info(request: Request) -> tuple[str, str]:
    """Extract client IP and user agent from request."""
    client_ip = request.client.host if request.client else 'unknown'
    user_agent = request.headers.get('user-agent', 'unknown')
    return client_ip, user_agent


def _handle_auth_exception(e: Exception, auth_data: UserAuth, client_ip: str, user_agent: str, context: str = "") -> HTTPException:
    """Handle authentication exceptions with consistent logging and error responses."""
    context_suffix = f" {context}" if context else ""
    
    if isinstance(e, (InvalidCredentialsError, AccountLockedError)):
        security_logger.warning(
            f"Failed authentication{context_suffix}: user_id={auth_data.user_id}, "
            f"reason={type(e).__name__}, ip={client_ip}, user_agent={user_agent[:50]}"
        )
        return HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    elif isinstance(e, AuthenticationError):
        security_logger.warning(
            f"Authentication error{context_suffix}: user_id={auth_data.user_id}, "
            f"reason={type(e).__name__}, ip={client_ip}, user_agent={user_agent[:50]}"
        )
        return HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    elif isinstance(e, HTTPException) and e.status_code == 403:
        security_logger.warning(
            f"Authentication forbidden{context_suffix}: user_id={auth_data.user_id}, "
            f"ip={client_ip}, reason=account_inactive"
        )
        return e
    
    else:
        security_logger.error(
            f"Authentication system error{context_suffix}: user_id={auth_data.user_id}, "
            f"ip={client_ip}, error={type(e).__name__}"
        )
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service temporarily unavailable"
        )


def _log_successful_auth(auth_data: UserAuth, client_ip: str, user_agent: str, context: str = ""):
    """Log successful authentication with context."""
    context_suffix = f" {context}" if context else ""
    security_logger.info(
        f"Successful authentication{context_suffix}: user_id={auth_data.user_id}, "
        f"ip={client_ip}, user_agent={user_agent[:50]}"
    )

@auth_router.post("/login", 
                 response_model=LoginResponse,
                 summary="JWT User Login",
                 description="Authenticate user with 2-digit user ID and 4-digit PIN, returns JWT token")
@auth_rate_limit()
async def jwt_login(request: Request, auth_data: UserAuth) -> LoginResponse:
    """
    JWT-based user authentication endpoint.
    
    Args:
        auth_data: UserAuth containing user_id and pin
        
    Returns:
        LoginResponse with JWT access token and user information
        
    Raises:
        HTTPException: 401 for invalid credentials or locked accounts
        HTTPException: 403 for inactive accounts
        HTTPException: 500 for authentication system errors
    """
    client_ip, user_agent = _extract_client_info(request)
    
    try:
        result = await UserService.authenticate_user(auth_data)
        _log_successful_auth(auth_data, client_ip, user_agent)
        return result
        
    except Exception as e:
        raise _handle_auth_exception(e, auth_data, client_ip, user_agent)

@auth_router.post("/token", 
                 response_model=LoginResponse,
                 summary="OAuth2 Compatible Token Endpoint",
                 description="OAuth2-compatible token endpoint for standard JWT workflows")
@auth_rate_limit()
async def get_token(request: Request, auth_data: UserAuth) -> LoginResponse:
    """
    OAuth2-compatible token endpoint.
    
    This provides the same JWT authentication but follows OAuth2 conventions
    for compatibility with standard OAuth2 clients and tools.
    
    Args:
        auth_data: UserAuth containing user_id and pin
        
    Returns:
        LoginResponse with JWT access token and user information
    """
    return await jwt_login(request, auth_data)

@auth_router.post("/login-with-refresh",
                 response_model=LoginWithRefreshResponse,
                 summary="JWT Login with Refresh Token",
                 description="Authenticate user and return both access and refresh tokens with user data")
@auth_rate_limit()
async def jwt_login_with_refresh(request: Request, auth_data: UserAuth) -> LoginWithRefreshResponse:
    """
    JWT-based user authentication with refresh token support.
    
    Args:
        auth_data: UserAuth containing user_id and pin
        
    Returns:
        LoginWithRefreshResponse with both access and refresh tokens plus user data
    """
    client_ip, user_agent = _extract_client_info(request)
    
    try:
        result = await UserService.authenticate_user_with_refresh(auth_data)
        _log_successful_auth(auth_data, client_ip, user_agent, "with refresh")
        return LoginWithRefreshResponse(**result)
        
    except Exception as e:
        raise _handle_auth_exception(e, auth_data, client_ip, user_agent, "with refresh")

@auth_router.post("/refresh",
                 response_model=AccessTokenResponse,
                 summary="Refresh Access Token",
                 description="Generate new access token using refresh token")
@api_rate_limit()
async def refresh_access_token(request: Request, refresh_request: RefreshTokenRequest) -> AccessTokenResponse:
    """
    Generate new access token from refresh token.
    
    Args:
        request: FastAPI request object
        refresh_request: RefreshTokenRequest containing refresh token
        
    Returns:
        AccessTokenResponse with new access token
    """
    try:
        result = await UserService.refresh_access_token(refresh_request.refresh_token)
        return AccessTokenResponse(**result)
    except HTTPException:
        raise
    except (ValueError, TypeError, KeyError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token refresh failed",
            headers={"WWW-Authenticate": "Bearer"}
        )

@auth_router.get("/verify",
                response_model=TokenVerificationResponse,
                summary="Verify JWT Token",
                description="Verify the validity of a JWT token")
@api_rate_limit()
async def verify_token(request: Request) -> TokenVerificationResponse:
    """
    Verify JWT token validity.
    
    Args:
        request: FastAPI request containing Authorization header
        
    Returns:
        TokenVerificationResponse containing token validity and payload information
    """
    try:
        # Extract token from Authorization header
        authorization = request.headers.get("Authorization")
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid authorization header",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        token = authorization.split(" ")[1]
        payload = UserService.decode_token(token)
        return TokenVerificationResponse(
            valid=True,
            user_id=payload.get("sub"),
            role=payload.get("role"),
            status=payload.get("status"),
            expires_at=payload.get("exp"),
            token_type=payload.get("token_type", "access")
        )
    except HTTPException:
        raise
    except (ValueError, TypeError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed",
            headers={"WWW-Authenticate": "Bearer"}
        )