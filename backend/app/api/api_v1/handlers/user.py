"""
User Management API Handlers

This module provides FastAPI endpoints for user management operations
including user creation, authentication, profile management, and administration.
"""

# Standard library imports
from datetime import datetime
from typing import Optional, Union

# Third-party imports
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request

# Local imports
from app.core.auth import (
    get_current_active_user, get_admin_user, require_admin,
    require_staff_or_admin, get_current_user_optional
)
from app.core.csrf_protection import generate_csrf_token
from app.models.user_model import User, UserRole, UserStatus, InvalidCredentialsError, AccountLockedError
from app.schemas.user_schema import (
    UserAuth, UserCreate, UserUpdate, UserPinChange,
    UserResponse, UserDetailResponse, UserListResponse,
    LoginResponse, UserStatsResponse, UserFilters
)
from app.services.user_service import UserService
from app.services.user_activity_service import UserActivityService
from app.models.user_activity_log_model import UserActivityType

user_router = APIRouter()

# Authentication endpoints
@user_router.post("/login", 
                 response_model=LoginResponse,
                 summary="User login",
                 description="Authenticate user with 2-digit user ID and 4-digit PIN")
async def login(auth_data: UserAuth):
    """User login endpoint"""
    try:
        return await UserService.authenticate_user(auth_data)
    except InvalidCredentialsError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )
    except AccountLockedError as e:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )

@user_router.post("/logout",
                 summary="User logout",
                 description="Logout user and invalidate session")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_active_user)
):
    """User logout endpoint"""
    # Note: In a real implementation, you'd get the session_id from the request
    # For now, we'll just clear all sessions
    current_user.active_sessions = []
    await current_user.save()

    # Log logout activity
    await UserActivityService.log_logout(
        user_id=current_user.user_id,
        request=request
    )

    return {"message": "Logged out successfully"}

@user_router.get("/csrf-token",
                 summary="Get CSRF token",
                 description="Get a CSRF token for authenticated user (for state-changing operations)")
async def get_csrf_token(current_user: User = Depends(get_current_active_user)):
    """Get CSRF token for authenticated user"""
    try:
        csrf_token = generate_csrf_token(user_id=current_user.user_id)
        return {
            "csrf_token": csrf_token,
            "expires_in": 3600,  # 1 hour
            "header_name": "X-CSRF-Token",
            "message": "Include this token in the X-CSRF-Token header for all POST/PUT/DELETE requests"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate CSRF token: {str(e)}"
        )

# Admin-only user creation endpoint
@user_router.post("/create",
                 response_model=UserResponse,
                 summary="Create a new user",
                 description="Create a new user (Admin only)",
                 dependencies=[Depends(require_admin)])
async def create_user(
    request: Request,
    user_data: UserCreate,
    current_user: User = Depends(get_admin_user)
):
    """Create a new user (Admin only)"""
    new_user = await UserService.create_user(user_data, created_by=current_user.user_id)

    # Log user creation activity
    await UserActivityService.log_user_created(
        creator_user_id=current_user.user_id,
        new_user_id=new_user.user_id,
        new_user_role=new_user.role,
        request=request
    )

    return new_user

# Current user (/me) endpoints - MUST come before /{user_id} routes
@user_router.get("/me",
                response_model=UserResponse,
                summary="Get current user profile",
                description="Get the current authenticated user's profile")
async def get_current_user_profile(current_user: User = Depends(get_current_active_user)):
    """Get current user's own profile"""
    return UserResponse.model_validate(current_user.model_dump())

@user_router.put("/me",
                response_model=UserResponse,
                summary="Update current user profile",
                description="Update the current authenticated user's profile")
async def update_current_user_profile(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_active_user)
):
    """Update current user's own profile"""
    # Users can only update their own basic info (not role/status)
    restricted_update = UserUpdate(
        first_name=update_data.first_name,
        last_name=update_data.last_name,
        email=update_data.email,
        phone=update_data.phone
    )
    return await UserService.update_user(current_user.user_id, restricted_update, current_user.role)

@user_router.post("/me/change-pin",
                 summary="Change current user PIN",
                 description="Change the current authenticated user's PIN")
async def change_current_user_pin(
    pin_data: UserPinChange,
    current_user: User = Depends(get_current_active_user)
):
    """Change current user's PIN"""
    return await UserService.change_pin(current_user.user_id, pin_data)

@user_router.delete("/me")
async def delete_me_not_allowed():
    """DELETE method not allowed for /me endpoint - users cannot delete themselves via this endpoint"""
    raise HTTPException(
        status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        detail="Method not allowed",
        headers={"Allow": "GET, PUT, POST"}
    )

# List and statistics endpoints (specific paths)
@user_router.get("/list",
                response_model=UserListResponse,
                summary="Get users list",
                description="Get paginated list of users with filtering (Staff can see basic info, Admin can see all)",
                dependencies=[Depends(require_staff_or_admin)])
async def get_users_list(
    role: Optional[UserRole] = Query(None, description="Filter by role"),
    status: Optional[UserStatus] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, max_length=100, description="Search in name, email, or user_id"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: str = Query("desc", regex="^(asc|desc)$", description="Sort order"),
    current_user: User = Depends(require_staff_or_admin)
):
    """Get paginated list of users"""
    filters = UserFilters(
        role=role,
        status=status,
        search=search,
        page=page,
        per_page=per_page,
        sort_by=sort_by,
        sort_order=sort_order
    )
    return await UserService.get_users_list(filters, current_user.role)

@user_router.get("/stats",
                response_model=UserStatsResponse,
                summary="Get user statistics",
                description="Get user statistics for admin dashboard (Admin only)",
                dependencies=[Depends(require_admin)])
async def get_user_statistics(
    request: Request,
    admin_user: User = Depends(get_admin_user)
):
    """Get user statistics (Admin only)"""
    timezone_header = request.headers.get('X-Client-Timezone')
    return await UserService.get_user_stats(timezone_header)

# Health check endpoint
@user_router.get("/health",
                summary="Health check",
                description="API health check endpoint")
async def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        user_count = await User.find().count()
        return {
            "status": "healthy",
            "database": "connected",
            "user_count": user_count,
            "timestamp": datetime.utcnow()
        }
    except (ConnectionError, TimeoutError, RuntimeError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database service error: {str(e)}"
        )

# Parameterized routes (/{user_id}) - MUST come LAST to avoid capturing specific paths
@user_router.get("/{user_id}",
                response_model=Union[UserResponse, UserDetailResponse],
                summary="Get user by ID", 
                description="Get user details by ID (Staff can see basic info, Admin can see all)",
                dependencies=[Depends(require_staff_or_admin)])
async def get_user_by_id(
    user_id: str,
    current_user: User = Depends(require_staff_or_admin)
) -> Union[UserResponse, UserDetailResponse]:
    """Get user by ID with role-based response model"""
    return await UserService.get_user_by_id(user_id, current_user.role)

@user_router.put("/{user_id}",
                response_model=UserResponse,
                summary="Update user",
                description="Update user information (Admin only for role/status changes)",
                dependencies=[Depends(require_staff_or_admin)])
async def update_user(
    request: Request,
    user_id: str,
    update_data: UserUpdate,
    current_user: User = Depends(require_staff_or_admin)
):
    """Update user information"""
    # Get old user data for change tracking
    old_user = await User.find_one(User.user_id == user_id)
    if not old_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Perform update
    updated_user = await UserService.update_user(user_id, update_data, current_user.role)

    # Track changes for activity logging
    changes = {}
    if old_user.first_name != updated_user.first_name:
        changes['first_name'] = {'old': old_user.first_name, 'new': updated_user.first_name}
    if old_user.last_name != updated_user.last_name:
        changes['last_name'] = {'old': old_user.last_name, 'new': updated_user.last_name}
    if old_user.email != updated_user.email:
        changes['email'] = {'old': old_user.email, 'new': updated_user.email}
    if old_user.phone != updated_user.phone:
        changes['phone'] = {'old': old_user.phone, 'new': updated_user.phone}
    if old_user.role != updated_user.role:
        changes['role'] = {'old': old_user.role, 'new': updated_user.role}
    if old_user.status != updated_user.status:
        changes['status'] = {'old': old_user.status, 'new': updated_user.status}

    # Log update activity
    if changes:
        await UserActivityService.log_user_updated(
            updater_user_id=current_user.user_id,
            target_user_id=user_id,
            changes=changes,
            request=request
        )

        # Log specific activities for role and status changes
        if 'role' in changes:
            await UserActivityService.log_role_changed(
                updater_user_id=current_user.user_id,
                target_user_id=user_id,
                old_role=changes['role']['old'],
                new_role=changes['role']['new'],
                request=request
            )

        if 'status' in changes:
            await UserActivityService.log_status_changed(
                updater_user_id=current_user.user_id,
                target_user_id=user_id,
                old_status=changes['status']['old'],
                new_status=changes['status']['new'],
                request=request
            )

    return updated_user

@user_router.delete("/{user_id}",
                   summary="Deactivate user",
                   description="Deactivate user account (Admin only)",
                   dependencies=[Depends(require_admin)])
async def deactivate_user(
    user_id: str,
    admin_user: User = Depends(get_admin_user)
):
    """Deactivate user account (Admin only)"""
    if user_id == admin_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )
    return await UserService.delete_user(user_id)

@user_router.post("/{user_id}/reset-pin",
                 summary="Reset user PIN",
                 description="Reset user PIN to a temporary PIN (Admin only)",
                 dependencies=[Depends(require_admin)])
async def reset_user_pin(
    request: Request,
    user_id: str,
    admin_user: User = Depends(get_admin_user)
):
    """Reset user PIN (Admin only)"""
    user = await User.find_one(User.user_id == user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Generate temporary PIN (in production, you might want to send this via secure channel)
    from secrets import randbelow
    temp_pin = f"{randbelow(10000):04d}"

    # Hash and save new PIN
    user.pin_hash = User.hash_pin(temp_pin)
    user.password_changed_at = None  # Force PIN change on next login
    user.updated_at = datetime.utcnow()
    await user.save()

    # Log PIN reset activity
    await UserActivityService.log_pin_reset(
        admin_user_id=admin_user.user_id,
        target_user_id=user_id,
        request=request
    )

    return {
        "message": "PIN reset successfully",
        "temporary_pin": temp_pin,  # In production, send via secure channel
        "note": "User must change PIN on next login"
    }

@user_router.post("/{user_id}/set-pin",
                 summary="Set user PIN",
                 description="Set user PIN to a specific value (Admin only)",
                 dependencies=[Depends(require_admin)])
async def set_user_pin(
    user_id: str,
    pin_data: dict,
    admin_user: User = Depends(get_admin_user)
):
    """Set user PIN to a specific value (Admin only)"""
    user = await User.find_one(User.user_id == user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Extract new PIN from request
    new_pin = pin_data.get("new_pin")
    if not new_pin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="new_pin is required"
        )

    # Validate PIN format (4 digits)
    if not isinstance(new_pin, str) or len(new_pin) != 4 or not new_pin.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN must be exactly 4 digits"
        )

    # Hash and save new PIN
    user.pin_hash = User.hash_pin(new_pin)
    user.password_changed_at = datetime.utcnow()  # Update password change timestamp
    user.updated_at = datetime.utcnow()

    # Optional: Clear active sessions for security (force re-login)
    user.active_sessions = []

    await user.save()

    return {
        "message": "PIN set successfully",
        "user_id": user_id,
        "password_changed_at": user.password_changed_at
    }

@user_router.post("/{user_id}/unlock",
                 summary="Unlock user account",
                 description="Unlock user account and reset failed login attempts (Admin only)",
                 dependencies=[Depends(require_admin)])
async def unlock_user_account(
    request: Request,
    user_id: str,
    admin_user: User = Depends(get_admin_user)
):
    """Unlock user account (Admin only)"""
    user = await User.find_one(User.user_id == user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user.locked_until = None
    user.failed_login_attempts = 0
    user.updated_at = datetime.utcnow()
    await user.save()

    # Log account unlock activity
    await UserActivityService.log_activity(
        user_id=admin_user.user_id,
        activity_type=UserActivityType.ACCOUNT_UNLOCKED,
        description=f"Admin {admin_user.user_id} unlocked account {user_id}",
        target_user_id=user_id,
        request=request
    )

    return {"message": "User account unlocked successfully"}

@user_router.get("/{user_id}/sessions",
                summary="Get user active sessions",
                description="Get user's active sessions (Admin only)",
                dependencies=[Depends(require_admin)])
async def get_user_sessions(
    user_id: str,
    admin_user: User = Depends(get_admin_user)
):
    """Get user's active sessions (Admin only)"""
    user = await User.find_one(User.user_id == user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {
        "user_id": user.user_id,
        "active_sessions": user.active_sessions,
        "last_activity": user.last_activity,
        "session_count": len(user.active_sessions)
    }

@user_router.delete("/{user_id}/sessions",
                   summary="Terminate user sessions",
                   description="Terminate all user sessions (Admin only)",
                   dependencies=[Depends(require_admin)])
async def terminate_user_sessions(
    user_id: str,
    admin_user: User = Depends(get_admin_user)
):
    """Terminate all user sessions (Admin only)"""
    user = await User.find_one(User.user_id == user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.active_sessions = []
    user.updated_at = datetime.utcnow()
    await user.save()
    
    return {"message": "All user sessions terminated successfully"}