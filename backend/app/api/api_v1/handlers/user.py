# Standard library imports
from datetime import datetime
from typing import Optional

# Third-party imports  
from fastapi import APIRouter, Depends, HTTPException, status, Query

# Local imports
from app.core.auth import (
    get_current_active_user, get_admin_user, require_admin,
    require_staff_or_admin, get_current_user_optional
)
from app.models.user_model import User, UserRole, UserStatus
from app.schemas.user_schema import (
    UserAuth, UserCreate, UserUpdate, UserPinChange,
    UserResponse, UserDetailResponse, UserListResponse,
    LoginResponse, UserStatsResponse, UserFilters
)
from app.services.user_service import UserService

user_router = APIRouter()

# Authentication endpoints
@user_router.post("/login", 
                 response_model=LoginResponse,
                 summary="User login",
                 description="Authenticate user with 2-digit user ID and 4-digit PIN")
async def login(auth_data: UserAuth):
    """User login endpoint"""
    return await UserService.authenticate_user(auth_data)

@user_router.post("/logout",
                 summary="User logout",
                 description="Logout user and invalidate session")
async def logout(current_user: User = Depends(get_current_active_user)):
    """User logout endpoint"""
    # Note: In a real implementation, you'd get the session_id from the request
    # For now, we'll just clear all sessions
    current_user.active_sessions = []
    await current_user.save()
    return {"message": "Logged out successfully"}

# Admin-only user creation endpoint
@user_router.post("/create",
                 response_model=UserResponse,
                 summary="Create a new user",
                 description="Create a new user (Admin only)",
                 dependencies=[Depends(require_admin)])
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_admin_user)
):
    """Create a new user (Admin only)"""
    return await UserService.create_user(user_data, created_by=current_user.user_id)

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
        email=update_data.email
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
async def get_user_statistics(admin_user: User = Depends(get_admin_user)):
    """Get user statistics (Admin only)"""
    return await UserService.get_user_stats()

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
                response_model=UserDetailResponse,
                summary="Get user by ID",
                description="Get user details by ID (Staff can see basic info, Admin can see all)",
                dependencies=[Depends(require_staff_or_admin)])
async def get_user_by_id(
    user_id: str,
    current_user: User = Depends(require_staff_or_admin)
):
    """Get user by ID"""
    return await UserService.get_user_by_id(user_id, current_user.role)

@user_router.put("/{user_id}",
                response_model=UserResponse,
                summary="Update user",
                description="Update user information (Admin only for role/status changes)",
                dependencies=[Depends(require_staff_or_admin)])
async def update_user(
    user_id: str,
    update_data: UserUpdate,
    current_user: User = Depends(require_staff_or_admin)
):
    """Update user information"""
    return await UserService.update_user(user_id, update_data, current_user.role)

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
    
    return {
        "message": "PIN reset successfully",
        "temporary_pin": temp_pin,  # In production, send via secure channel
        "note": "User must change PIN on next login"
    }

@user_router.post("/{user_id}/unlock",
                 summary="Unlock user account",
                 description="Unlock user account and reset failed login attempts (Admin only)",
                 dependencies=[Depends(require_admin)])
async def unlock_user_account(
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