"""JWT authentication endpoints for the pawnshop system."""

from fastapi import APIRouter, HTTPException, status

from app.schemas.user_schema import UserAuth, LoginResponse
from app.schemas.auth_schema import TokenSchema, RefreshTokenRequest, AccessTokenResponse, TokenVerificationResponse
from app.services.user_service import UserService
from app.models.user_model import AuthenticationError, AccountLockedError, InvalidCredentialsError

auth_router = APIRouter()

@auth_router.post("/login", 
                 response_model=LoginResponse,
                 summary="JWT User Login",
                 description="Authenticate user with 2-digit user ID and 4-digit PIN, returns JWT token")
async def jwt_login(auth_data: UserAuth) -> LoginResponse:
    """
    JWT-based user authentication endpoint.
    
    This endpoint provides the same functionality as the main login endpoint
    but is located under /auth/jwt/login for JWT-specific authentication flows.
    
    Args:
        auth_data: UserAuth containing user_id and pin
        
    Returns:
        LoginResponse with JWT access token and user information
        
    Raises:
        HTTPException: 401 for invalid credentials or locked accounts
        HTTPException: 403 for inactive accounts
        HTTPException: 500 for authentication system errors
    """
    try:
        return await UserService.authenticate_user(auth_data)
    except (InvalidCredentialsError, AccountLockedError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )

@auth_router.post("/token", 
                 response_model=LoginResponse,
                 summary="OAuth2 Compatible Token Endpoint",
                 description="OAuth2-compatible token endpoint for standard JWT workflows")
async def get_token(auth_data: UserAuth) -> LoginResponse:
    """
    OAuth2-compatible token endpoint.
    
    This provides the same JWT authentication but follows OAuth2 conventions
    for compatibility with standard OAuth2 clients and tools.
    
    Args:
        auth_data: UserAuth containing user_id and pin
        
    Returns:
        LoginResponse with JWT access token and user information
    """
    return await jwt_login(auth_data)

@auth_router.post("/login-with-refresh",
                 response_model=TokenSchema,
                 summary="JWT Login with Refresh Token",
                 description="Authenticate user and return both access and refresh tokens")
async def jwt_login_with_refresh(auth_data: UserAuth) -> TokenSchema:
    """
    JWT-based user authentication with refresh token support.
    
    Args:
        auth_data: UserAuth containing user_id and pin
        
    Returns:
        TokenSchema with both access and refresh tokens
        
    Raises:
        HTTPException: 401 for invalid credentials or locked accounts
        HTTPException: 403 for inactive accounts
        HTTPException: 500 for authentication system errors
    """
    try:
        result = await UserService.authenticate_user_with_refresh(auth_data)
        return TokenSchema(**result)
    except (InvalidCredentialsError, AccountLockedError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )

@auth_router.post("/refresh",
                 response_model=AccessTokenResponse,
                 summary="Refresh Access Token",
                 description="Generate new access token using refresh token")
async def refresh_access_token(request: RefreshTokenRequest) -> AccessTokenResponse:
    """
    Generate new access token from refresh token.
    
    Args:
        request: RefreshTokenRequest containing refresh token
        
    Returns:
        AccessTokenResponse with new access token
        
    Raises:
        HTTPException: 401 for invalid or expired refresh tokens
    """
    try:
        result = await UserService.refresh_access_token(request.refresh_token)
        return AccessTokenResponse(**result)
    except HTTPException:
        # Re-raise HTTP exceptions from UserService
        raise
    except (ValueError, TypeError, KeyError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token refresh error: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"}
        )

@auth_router.get("/verify",
                response_model=TokenVerificationResponse,
                summary="Verify JWT Token",
                description="Verify the validity of a JWT token")
async def verify_token(token: str) -> TokenVerificationResponse:
    """
    Verify JWT token validity.
    
    Args:
        token: JWT token string to verify
        
    Returns:
        TokenVerificationResponse containing token validity and payload information
        
    Raises:
        HTTPException: 401 for invalid or expired tokens
    """
    try:
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
        # Re-raise HTTP exceptions from decode_token
        raise
    except (ValueError, TypeError, KeyError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification error: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"}
        )