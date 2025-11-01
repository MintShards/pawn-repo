"""JWT authentication endpoints for the pawnshop system."""

# Standard library imports
import logging
from datetime import UTC
from zoneinfo import ZoneInfo

# Third-party imports
from fastapi import APIRouter, HTTPException, status, Request

# Local imports
from app.core.security_middleware import auth_rate_limit, api_rate_limit
from app.models.user_model import User, AuthenticationError, AccountLockedError, InvalidCredentialsError
from app.schemas.auth_schema import TokenSchema, RefreshTokenRequest, AccessTokenResponse, TokenVerificationResponse, LoginWithRefreshResponse
from app.schemas.user_schema import UserAuth, LoginResponse
from app.services.user_service import UserService
from app.services.user_activity_service import UserActivityService
from app.models.user_activity_log_model import UserActivityType

# Security logger for authentication events
security_logger = logging.getLogger("security.auth")

# Business timezone configuration
BUSINESS_TIMEZONE = ZoneInfo("America/Vancouver")  # Pacific Time

auth_router = APIRouter()


def _extract_client_info(request: Request) -> tuple[str, str]:
    """Extract client IP and user agent from request."""
    client_ip = request.client.host if request.client else 'unknown'
    user_agent = request.headers.get('user-agent', 'unknown')
    return client_ip, user_agent


async def _handle_auth_exception(e: Exception, auth_data: UserAuth, client_ip: str, user_agent: str, request: Request, context: str = "") -> HTTPException:
    """Handle authentication exceptions with consistent logging and error responses."""
    context_suffix = f" {context}" if context else ""

    if isinstance(e, AccountLockedError):
        security_logger.warning(
            f"Failed authentication{context_suffix}: user_id={auth_data.user_id}, "
            f"reason=AccountLockedError, ip={client_ip}, user_agent={user_agent[:50]}"
        )

        # Log account locked activity
        await UserActivityService.log_activity(
            user_id=auth_data.user_id,
            activity_type=UserActivityType.LOGIN_FAILED,
            description=f"Login attempt blocked - account locked",
            details="Account locked due to too many failed login attempts",
            request=request,
            is_success=False,
            error_message="Account locked"
        )

        # Format locked_until timestamp in business timezone (Pacific Time)
        error_message = "Account locked due to too many failed login attempts."
        if e.locked_until:
            try:
                # Ensure locked_until has timezone info (should be UTC from database)
                locked_until_utc = e.locked_until
                if locked_until_utc.tzinfo is None:
                    locked_until_utc = locked_until_utc.replace(tzinfo=UTC)

                # Convert to business timezone (Pacific Time)
                locked_until_local = locked_until_utc.astimezone(BUSINESS_TIMEZONE)
                formatted_time = locked_until_local.strftime("%I:%M %p %Z on %B %d, %Y")
                error_message = f"Account locked due to too many failed login attempts. Your account will automatically unlock at {formatted_time}, or contact an admin for immediate access."
            except Exception as format_error:
                # Fallback to generic message if formatting fails
                security_logger.error(f"Failed to format locked_until timestamp: {format_error}")
                error_message = "Account locked due to too many failed login attempts. Your account will automatically unlock in 30 minutes, or contact an admin for immediate access."

        return HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=error_message,
            headers={"WWW-Authenticate": "Bearer"}
        )

    if isinstance(e, InvalidCredentialsError):
        security_logger.warning(
            f"Failed authentication{context_suffix}: user_id={auth_data.user_id}, "
            f"reason=InvalidCredentialsError, ip={client_ip}, user_agent={user_agent[:50]}"
        )

        # Log failed login activity
        await UserActivityService.log_login_attempt(
            user_id=auth_data.user_id,
            success=False,
            request=request,
            reason="Invalid credentials"
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

        # Log failed authentication activity
        await UserActivityService.log_login_attempt(
            user_id=auth_data.user_id,
            success=False,
            request=request,
            reason=type(e).__name__
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

        # Log forbidden access activity
        await UserActivityService.log_activity(
            user_id=auth_data.user_id,
            activity_type=UserActivityType.LOGIN_FAILED,
            description=f"Login attempt blocked - account inactive",
            details="Account is not active",
            request=request,
            is_success=False,
            error_message="Account inactive"
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

        # Log successful login activity
        await UserActivityService.log_login_attempt(
            user_id=auth_data.user_id,
            success=True,
            request=request
        )

        return result

    except Exception as e:
        raise await _handle_auth_exception(e, auth_data, client_ip, user_agent, request)

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

        # Log successful login with refresh token activity
        await UserActivityService.log_login_attempt(
            user_id=auth_data.user_id,
            success=True,
            request=request
        )

        return LoginWithRefreshResponse(**result)

    except Exception as e:
        raise await _handle_auth_exception(e, auth_data, client_ip, user_agent, request, "with refresh")

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

        # Extract user_id from token for activity logging
        try:
            payload = UserService.decode_token(refresh_request.refresh_token, token_type="refresh")
            user_id = payload.get("sub")

            # Log token refresh activity
            await UserActivityService.log_activity(
                user_id=user_id,
                activity_type=UserActivityType.TOKEN_REFRESHED,
                description=f"Access token refreshed for user {user_id}",
                request=request,
                is_success=True
            )
        except Exception:
            # Don't fail the request if activity logging fails
            pass

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
                description="Verify the validity of a JWT token including session validation")
@api_rate_limit()
async def verify_token(request: Request) -> TokenVerificationResponse:
    """
    Verify JWT token validity including session validation.

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

        # Validate session is still active (if jti claim exists)
        session_id = payload.get("jti")
        if session_id:
            user_id = payload.get("sub")
            user = await User.find_one(User.user_id == user_id)

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found",
                    headers={"WWW-Authenticate": "Bearer"}
                )

            # Check if session is still active
            if session_id not in user.active_sessions:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session has been revoked. Please login again",
                    headers={"WWW-Authenticate": "Bearer"}
                )

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