from typing import Optional, List
from datetime import datetime, timedelta
import secrets

import jwt
from fastapi import HTTPException, status

from app.models.user_model import User, UserRole, UserStatus, AuthConfig
from app.models.user_model import AuthenticationError, AccountLockedError, InvalidCredentialsError
from app.schemas.user_schema import (
    UserCreate, UserUpdate, UserAuth, UserPinChange, 
    UserResponse, UserDetailResponse, UserListResponse, 
    LoginResponse, UserStatsResponse, UserFilters
)
from app.core.config import settings

class UserService:
    
    @staticmethod
    async def create_user(user_data: UserCreate, created_by: Optional[str] = None) -> UserResponse:
        """Create a new user"""
        try:
            # Check if user_id already exists
            existing_user = await User.find_one(User.user_id == user_data.user_id)
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"User ID {user_data.user_id} already exists"
                )
            
            # Check if email already exists (if provided)
            if user_data.email:
                existing_email = await User.find_one(User.email == user_data.email)
                if existing_email:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Email address already registered"
                    )
            
            # Hash the PIN
            pin_hash = User.hash_pin(user_data.pin)
            
            # Create user document
            user = User(
                user_id=user_data.user_id,
                pin_hash=pin_hash,
                first_name=user_data.first_name,
                last_name=user_data.last_name,
                email=user_data.email,
                role=user_data.role,
                notes=user_data.notes,
                created_by=created_by,
                password_changed_at=datetime.utcnow()
            )
            
            await user.insert()
            return UserResponse.model_validate(user.model_dump())
            
        except HTTPException:
            # Re-raise HTTP exceptions (like duplicate user checks)
            raise
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except (TypeError, AttributeError, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"User creation failed: {str(e)}"
            )
    
    @staticmethod
    async def authenticate_user(auth_data: UserAuth) -> LoginResponse:
        """Authenticate user and return login response with JWT token"""
        try:
            # Find user by user_id
            user = await User.find_one(User.user_id == auth_data.user_id)
            if not user:
                raise InvalidCredentialsError("Invalid user ID or PIN")
            
            # Check if account is locked
            if user.is_locked():
                raise AccountLockedError(f"Account locked until {user.locked_until}")
            
            # Check if user is active
            if user.status != UserStatus.ACTIVE:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Account is {user.status.value}"
                )
            
            # Verify PIN
            if not user.verify_pin(auth_data.pin):
                user.increment_failed_login()
                await user.save()
                
                attempts_remaining = AuthConfig.MAX_FAILED_LOGIN_ATTEMPTS - user.failed_login_attempts
                if attempts_remaining <= 0:
                    raise AccountLockedError("Account locked due to too many failed attempts")
                
                raise InvalidCredentialsError(f"Invalid user ID or PIN. {attempts_remaining} attempts remaining")
            
            # Successful login
            user.update_last_login()
            
            # Generate JWT token
            access_token = UserService._create_access_token(user)
            
            # Generate session ID
            session_id = f"sess_{secrets.token_urlsafe(16)}"
            user.add_session(session_id)
            
            await user.save()
            
            return LoginResponse(
                access_token=access_token,
                expires_in=settings.ACCESS_TOKEN_EXPIRATION * 60,  # Convert to seconds
                user=UserResponse.model_validate(user.model_dump()),
                session_id=session_id
            )
            
        except (InvalidCredentialsError, AccountLockedError):
            # Re-raise authentication-specific exceptions for API layer to handle
            raise
        except (TypeError, AttributeError, RuntimeError) as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Authentication service error: {str(e)}"
            )
    
    @staticmethod
    async def get_user_by_id(user_id: str, requester_role: UserRole = None) -> UserDetailResponse:
        """Get user by ID with role-based access control"""
        user = await User.find_one(User.user_id == user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Return detailed response for admin, basic for others
        if requester_role == UserRole.ADMIN:
            return UserDetailResponse.model_validate(user.model_dump())
        else:
            return UserResponse.model_validate(user.model_dump())
    
    @staticmethod
    async def update_user(user_id: str, update_data: UserUpdate, requester_role: UserRole = None) -> UserResponse:
        """Update user information"""
        user = await User.find_one(User.user_id == user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Only admins can change role and status
        if requester_role != UserRole.ADMIN:
            if update_data.role is not None or update_data.status is not None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient privileges to change role or status"
                )
        
        # Check email uniqueness if being updated
        if update_data.email and update_data.email != user.email:
            existing_email = await User.find_one(User.email == update_data.email)
            if existing_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email address already registered"
                )
        
        # Apply updates
        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(user, field, value)
        
        user.updated_at = datetime.utcnow()
        await user.save()
        
        return UserResponse.model_validate(user.model_dump())
    
    @staticmethod
    async def change_pin(user_id: str, pin_data: UserPinChange) -> dict:
        """Change user PIN"""
        user = await User.find_one(User.user_id == user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Verify current PIN
        if not user.verify_pin(pin_data.current_pin):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current PIN is incorrect"
            )
        
        # Check new PIN confirmation
        if not pin_data.validate_pins_match():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New PIN and confirmation do not match"
            )
        
        # Update PIN
        user.pin_hash = User.hash_pin(pin_data.new_pin)
        user.password_changed_at = datetime.utcnow()
        user.updated_at = datetime.utcnow()
        await user.save()
        
        return {"message": "PIN changed successfully"}
    
    @staticmethod
    async def get_users_list(filters: UserFilters, requester_role: UserRole = None) -> UserListResponse:
        """Get paginated list of users with filtering"""
        query = User.find()
        
        # Apply filters
        if filters.role:
            query = query.find(User.role == filters.role)
        if filters.status:
            query = query.find(User.status == filters.status)
        if filters.search:
            # Search in multiple fields
            query = query.find({
                "$or": [
                    {"first_name": {"$regex": filters.search, "$options": "i"}},
                    {"last_name": {"$regex": filters.search, "$options": "i"}},
                    {"email": {"$regex": filters.search, "$options": "i"}},
                    {"user_id": {"$regex": filters.search, "$options": "i"}}
                ]
            })
        
        # Count total
        total = await query.count()
        
        # Apply sorting
        sort_field = filters.sort_by
        sort_direction = 1 if filters.sort_order == "asc" else -1
        query = query.sort([(sort_field, sort_direction)])
        
        # Apply pagination
        skip = (filters.page - 1) * filters.per_page
        users = await query.skip(skip).limit(filters.per_page).to_list()
        
        # Convert to response format
        user_responses = [UserResponse.model_validate(user.model_dump()) for user in users]
        
        # Hide notes from non-admin users
        if requester_role != UserRole.ADMIN:
            for user_resp in user_responses:
                user_resp.notes = None
        
        pages = (total + filters.per_page - 1) // filters.per_page
        
        return UserListResponse(
            users=user_responses,
            total=total,
            page=filters.page,
            per_page=filters.per_page,
            pages=pages
        )
    
    @staticmethod
    async def delete_user(user_id: str) -> dict:
        """Soft delete user (deactivate)"""
        user = await User.find_one(User.user_id == user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user.status = UserStatus.DEACTIVATED
        user.updated_at = datetime.utcnow()
        await user.save()
        
        return {"message": "User deactivated successfully"}
    
    @staticmethod
    async def get_user_stats() -> UserStatsResponse:
        """Get user statistics for admin dashboard"""
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Aggregate statistics
        total_users = await User.find().count()
        active_users = await User.find(User.status == UserStatus.ACTIVE).count()
        suspended_users = await User.find(User.status == UserStatus.SUSPENDED).count()
        admin_users = await User.find(User.role == UserRole.ADMIN).count()
        staff_users = await User.find(User.role == UserRole.STAFF).count()
        users_created_today = await User.find(User.created_at >= today).count()
        recent_logins = await User.find(User.last_login >= today).count()
        
        # Count locked users
        current_time = datetime.utcnow()
        locked_users = await User.find({
            "locked_until": {"$exists": True, "$gte": current_time}
        }).count()
        
        return UserStatsResponse(
            total_users=total_users,
            active_users=active_users,
            suspended_users=suspended_users,
            locked_users=locked_users,
            admin_users=admin_users,
            staff_users=staff_users,
            users_created_today=users_created_today,
            recent_logins=recent_logins
        )
    
    @staticmethod
    async def logout_user(user_id: str, session_id: str) -> dict:
        """Logout user and invalidate session"""
        user = await User.find_one(User.user_id == user_id)
        if user:
            user.remove_session(session_id)
            await user.save()
        
        return {"message": "Logged out successfully"}
    
    @staticmethod
    def _create_access_token(user: User) -> str:
        """Create JWT access token"""
        payload = {
            "sub": user.user_id,
            "role": str(user.role),  # Handle both enum and string values
            "status": str(user.status),  # Handle both enum and string values
            "exp": datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRATION),
            "iat": datetime.utcnow()
        }
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.ALGORITHM)
    
    @staticmethod
    def decode_token(token: str) -> dict:
        """Decode and validate JWT token"""
        try:
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except (jwt.DecodeError, jwt.InvalidTokenError, jwt.InvalidSignatureError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
    
    @staticmethod
    async def get_current_user(token: str) -> User:
        """Get current user from JWT token"""
        payload = UserService.decode_token(token)
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        
        user = await User.find_one(User.user_id == user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        if user.status != UserStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is {user.status.value}"
            )
        
        return user
    
    @staticmethod
    def _create_refresh_token(user: User) -> str:
        """Create JWT refresh token"""
        payload = {
            "sub": user.user_id,
            "role": str(user.role),
            "status": str(user.status),
            "exp": datetime.utcnow() + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRATION),
            "iat": datetime.utcnow(),
            "token_type": "refresh"
        }
        return jwt.encode(payload, settings.JWT_REFRESH_SECRET_KEY, algorithm=settings.ALGORITHM)
    
    @staticmethod
    def decode_refresh_token(token: str) -> dict:
        """Decode and validate JWT refresh token"""
        try:
            payload = jwt.decode(token, settings.JWT_REFRESH_SECRET_KEY, algorithms=[settings.ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has expired"
            )
        except (jwt.DecodeError, jwt.InvalidTokenError, jwt.InvalidSignatureError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
    
    @staticmethod
    async def refresh_access_token(refresh_token: str) -> dict:
        """Generate new access token from refresh token"""
        try:
            # Decode refresh token
            payload = UserService.decode_refresh_token(refresh_token)
            user_id = payload.get("sub")
            
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid refresh token payload"
                )
            
            # Verify token type
            if payload.get("token_type") != "refresh":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token type"
                )
            
            # Get user and verify status
            user = await User.find_one(User.user_id == user_id)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found"
                )
            
            if user.status != UserStatus.ACTIVE:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Account is {user.status.value}"
                )
            
            # Generate new access token
            new_access_token = UserService._create_access_token(user)
            
            return {
                "access_token": new_access_token,
                "token_type": "bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRATION * 60
            }
            
        except HTTPException:
            # Re-raise HTTP exceptions
            raise
        except (jwt.DecodeError, jwt.InvalidTokenError, jwt.InvalidSignatureError, ValueError, TypeError) as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token refresh failed: {str(e)}"
            )
    
    @staticmethod
    async def authenticate_user_with_refresh(auth_data: "UserAuth") -> dict:
        """Authenticate user and return both access and refresh tokens"""
        try:
            # First authenticate the user (reuse existing logic)
            login_response = await UserService.authenticate_user(auth_data)
            
            # Get the user for refresh token generation
            user = await User.find_one(User.user_id == auth_data.user_id)
            
            # Generate refresh token
            refresh_token = UserService._create_refresh_token(user)
            
            # Return enhanced response with refresh token
            return {
                "access_token": login_response.access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRATION * 60,
                "user": login_response.user.model_dump(),
                "session_id": login_response.session_id
            }
            
        except (InvalidCredentialsError, AccountLockedError, AuthenticationError):
            # Re-raise authentication-specific exceptions for API layer to handle
            raise
        except HTTPException:
            # Re-raise HTTP exceptions as-is
            raise
        except Exception as e:
            # Only wrap genuine service-layer errors
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication failed"
            )