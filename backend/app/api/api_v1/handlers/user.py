# backend/app/api/api_v1/handlers/user.py
from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from app.schemas.user_schema import (
    UserCreateByAdmin, UserOut, UserUpdate, UserUpdatePin, 
    UserSummary, UserSetPin
)
from app.services.user_service import UserService
from app.api.deps.user_deps import get_current_user, get_current_admin
from app.models.user_model import User, UserRole
import logging

logger = logging.getLogger(__name__)
user_router = APIRouter()

# ========== USER CREATION (ADMIN ONLY) ==========

@user_router.post("/create", summary="Create a new user", response_model=UserOut)
async def create_user(
    user_data: UserCreateByAdmin,
    current_user: User = Depends(get_current_admin)
):
    """Create a new user (admin only). User will need to set their PIN separately."""
    try:
        user = await UserService.create_user_by_admin(user_data, current_user.user_id)
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )

# ========== USER INFO ==========

@user_router.get("/me", summary="Get current user info", response_model=UserOut)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get information about the currently logged-in user"""
    return current_user

@user_router.get("/", summary="Get all users", response_model=List[UserSummary])
async def get_all_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: Optional[bool] = Query(None, description="Filter by active status: true=active only, false=inactive only, null=all"),
    current_user: User = Depends(get_current_admin)
):
    """Get all users (admin only)"""
    try:
        users = await UserService.get_all_users(skip=skip, limit=limit, is_active_filter=is_active)
        return [UserSummary.from_orm(user) for user in users]
    except Exception as e:
        logger.error(f"Error fetching users: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch users"
        )

@user_router.get("/number/{user_number}", summary="Get user by number", response_model=UserOut)
async def get_user_by_number(
    user_number: int,
    current_user: User = Depends(get_current_admin)
):
    """Get user by their 2-digit number (admin only)"""
    if not (10 <= user_number <= 99):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User number must be between 10 and 99"
        )
    
    try:
        user = await UserService.get_user_by_number(user_number)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user #{user_number}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user"
        )

@user_router.get("/{user_id}", summary="Get user by ID", response_model=UserOut)
async def get_user_by_id(
    user_id: str,
    current_user: User = Depends(get_current_admin)
):
    """Get user by UUID (admin only)"""
    # Strip quotes and validate UUID format
    clean_user_id = user_id.strip('"\'')
    
    try:
        # Validate it's a proper UUID format
        from uuid import UUID
        uuid_obj = UUID(clean_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format"
        )
    
    try:
        user = await UserService.get_user_by_id(uuid_obj)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user {clean_user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user"
        )

# ========== USER UPDATES ==========

@user_router.put("/{user_id}", summary="Update user details", response_model=UserOut)
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_admin)
):
    """Update user details (admin only)"""
    # Strip quotes and validate UUID format
    clean_user_id = user_id.strip('"\'')
    
    try:
        from uuid import UUID
        uuid_obj = UUID(clean_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format"
        )
    
    try:
        user = await UserService.update_user(uuid_obj, user_data, current_user.user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating user {clean_user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )

@user_router.patch("/{user_number}", summary="Update user by number", response_model=UserOut)
async def update_user_by_number(
    user_number: int,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_admin)
):
    """Update user by user_number (admin only)"""
    try:
        user = await UserService.update_user_by_number(user_number, user_data, current_user.user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating user #{user_number}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )

# ========== PIN MANAGEMENT ==========

@user_router.post("/me/pin/update", summary="Update own PIN", response_model=UserOut)
async def update_own_pin(
    pin_data: UserUpdatePin,
    current_user: User = Depends(get_current_user)
):
    """Update your own PIN"""
    try:
        user = await UserService.update_user_pin(current_user.user_id, pin_data)
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating PIN for user #{current_user.user_number}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update PIN"
        )

@user_router.post("/number/{user_number}/pin/reset", summary="Reset user PIN with new PIN", response_model=UserOut)
async def reset_user_pin(
    user_number: int,
    pin_data: UserSetPin,
    current_user: User = Depends(get_current_admin)
):
    """Reset a user's PIN with a new PIN assigned by admin"""
    if not (10 <= user_number <= 99):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User number must be between 10 and 99"
        )
    
    try:
        user = await UserService.reset_user_pin_with_new(user_number, pin_data, current_user.user_id)
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error resetting PIN for user #{user_number}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset PIN"
        )

# ========== USER MANAGEMENT (ADMIN ONLY) ==========

# Note: Users are never deleted, only deactivated via status toggle for audit compliance

@user_router.get("/debug/all", summary="Debug: Get all users with full details")
async def debug_get_all_users(current_user: User = Depends(get_current_admin)):
    """Debug endpoint to see all users and their UUIDs"""
    try:
        users = await UserService.get_all_users()
        debug_info = []
        for user in users:
            debug_info.append({
                "user_number": user.user_number,
                "user_id": str(user.user_id),
                "user_id_type": type(user.user_id).__name__,
                "full_name": user.full_name,
                "role": user.role.value,
                "is_active": user.is_active,
                "pin_set": user.pin_set
            })
        return {
            "total_users": len(users),
            "users": debug_info
        }
    except Exception as e:
        logger.error(f"Error in debug endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get debug info"
        )
async def get_user_stats(current_user: User = Depends(get_current_admin)):
    """Get user statistics (admin only)"""
    try:
        all_users = await UserService.get_all_users()
        
        stats = {
            "total_users": len(all_users),
            "active_users": len([u for u in all_users if u.is_active]),
            "users_with_pin": len([u for u in all_users if u.pin_set]),
            "admin_users": len([u for u in all_users if u.role == UserRole.ADMIN]),
            "staff_users": len([u for u in all_users if u.role == UserRole.STAFF]),
            "users_need_pin_setup": len([u for u in all_users if u.is_active and not u.pin_set])
        }
        
        return stats
    except Exception as e:
        logger.error(f"Error getting user stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user statistics"
        )

@user_router.get("/pending-setup", summary="Get users needing PIN setup", response_model=List[UserSummary])
async def get_users_needing_pin_setup(current_user: User = Depends(get_current_admin)):
    """Get list of users who need to set up their PIN (admin only)"""
    try:
        all_users = await UserService.get_all_users(is_active_filter=True)
        pending_users = [user for user in all_users if not user.pin_set]
        return [UserSummary.from_orm(user) for user in pending_users]
    except Exception as e:
        logger.error(f"Error getting users needing PIN setup: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get users needing PIN setup"
        )