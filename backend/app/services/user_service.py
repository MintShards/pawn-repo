from typing import Optional, List, Union
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
from app.services.user_activity_service import UserActivityService
from app.models.user_activity_log_model import UserActivityType

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

            # Check if phone number already exists (if provided)
            if user_data.phone:
                existing_phone = await User.find_one(User.phone == user_data.phone)
                if existing_phone:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Phone number already registered"
                    )

            # Hash the PIN
            pin_hash = User.hash_pin(user_data.pin)

            # Create user document (exclude None email to avoid sparse index issues)
            user_dict = {
                "user_id": user_data.user_id,
                "pin_hash": pin_hash,
                "first_name": user_data.first_name,
                "last_name": user_data.last_name,
                "phone": user_data.phone,
                "role": user_data.role,
                "created_by": created_by,
                "password_changed_at": datetime.utcnow()
            }

            # Only include email if it's not None (sparse index compatibility)
            if user_data.email:
                user_dict["email"] = user_data.email

            # Only include notes if it's not None
            if user_data.notes:
                user_dict["notes"] = user_data.notes

            user = User(**user_dict)
            
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
                raise AccountLockedError(
                    "Account locked due to too many failed login attempts",
                    locked_until=user.locked_until
                )
            
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
                    # Log account lockout activity
                    await UserActivityService.log_account_locked(
                        user_id=user.user_id,
                        reason="Too many failed login attempts"
                    )

                    raise AccountLockedError(
                        "Account locked due to too many failed login attempts",
                        locked_until=user.locked_until
                    )

                raise InvalidCredentialsError(f"Invalid user ID or PIN. {attempts_remaining} attempts remaining")
            
            # Successful login
            user.update_last_login()

            # Generate session ID first
            session_id = f"sess_{secrets.token_urlsafe(16)}"
            user.add_session(session_id)

            # Generate JWT token with session ID
            access_token = UserService._create_access_token(user, session_id=session_id)
            
            # Use try/catch around save to handle concurrent modifications gracefully
            try:
                await user.save()
            except Exception as save_error:
                # If save fails due to concurrent modification, generate token anyway
                # The user was already validated, so authentication should succeed
                pass
            
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
    async def get_user_by_id(user_id: str, requester_role: UserRole = None) -> Union[UserResponse, UserDetailResponse]:
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

        # Check phone number uniqueness if being updated
        if update_data.phone and update_data.phone != user.phone:
            existing_phone = await User.find_one(User.phone == update_data.phone)
            if existing_phone:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Phone number already registered"
                )

        # Apply updates using MongoDB's atomic $set operation (bypass Beanie revision checking)
        update_dict = update_data.model_dump(exclude_unset=True)
        update_dict["updated_at"] = datetime.utcnow()

        # Remove email and notes from update if they're None (sparse index compatibility)
        if "email" in update_dict and update_dict["email"] is None:
            del update_dict["email"]
        if "notes" in update_dict and update_dict["notes"] is None:
            del update_dict["notes"]

        # Use MongoDB collection directly to bypass revision checking
        await User.get_motor_collection().update_one(
            {"user_id": user_id},
            {"$set": update_dict}
        )

        # Fetch updated user to return
        updated_user = await User.find_one(User.user_id == user_id)
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found after update"
            )

        return UserResponse.model_validate(updated_user.model_dump())
    
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
        """Get paginated list of users with advanced filtering"""
        query = User.find()

        # Apply basic filters
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
                    {"phone": {"$regex": filters.search, "$options": "i"}},
                    {"user_id": {"$regex": filters.search, "$options": "i"}}
                ]
            })

        # Apply advanced date filters
        if filters.created_after:
            query = query.find(User.created_at >= filters.created_after)
        if filters.created_before:
            query = query.find(User.created_at <= filters.created_before)
        if filters.last_login_after:
            query = query.find(User.last_login >= filters.last_login_after)
        if filters.last_login_before:
            # Include users who never logged in (null) as they are also "inactive"
            query = query.find({
                "$or": [
                    {"last_login": {"$lte": filters.last_login_before}},
                    {"last_login": None},
                    {"last_login": {"$exists": False}}
                ]
            })

        # Apply security filters
        if filters.is_locked is not None:
            # Use timezone-aware datetime (MongoDB stores timezone-aware datetimes)
            # Using UTC since account lock status is not user-timezone dependent
            from datetime import timezone
            current_time = datetime.now(timezone.utc)

            if filters.is_locked:
                # Find locked users (locked_until exists and is in the future)
                query = query.find({
                    "$and": [
                        {"locked_until": {"$ne": None}},
                        {"locked_until": {"$gt": current_time}}
                    ]
                })
            else:
                # Find unlocked users (locked_until is None or in the past)
                query = query.find({
                    "$or": [
                        {"locked_until": None},
                        {"locked_until": {"$exists": False}},
                        {"locked_until": {"$lte": current_time}}
                    ]
                })

        if filters.min_failed_attempts is not None:
            query = query.find(User.failed_login_attempts >= filters.min_failed_attempts)

        # Apply activity filters
        if filters.has_active_sessions is not None:
            # Use timezone-aware datetime for consistent comparison with database
            from datetime import timezone
            eight_hours_ago = datetime.now(timezone.utc) - timedelta(hours=8)

            if filters.has_active_sessions:
                # Users with at least one active session that's not expired
                # Session timeout is 8 hours, so check last_activity is within that window
                query = query.find({
                    "$and": [
                        {"active_sessions": {"$ne": [], "$exists": True}},
                        {"last_activity": {"$gte": eight_hours_ago}}
                    ]
                })
            else:
                # Users with no active sessions or expired sessions
                query = query.find({
                    "$or": [
                        {"active_sessions": []},
                        {"active_sessions": {"$exists": False}},
                        {"active_sessions": None},
                        {"last_activity": {"$lt": eight_hours_ago}},
                        {"last_activity": None}
                    ]
                })

        # Never logged in filter
        if filters.never_logged_in is not None:
            if filters.never_logged_in:
                query = query.find({
                    "$or": [
                        {"last_login": None},
                        {"last_login": {"$exists": False}}
                    ]
                })
            else:
                query = query.find({
                    "last_login": {"$exists": True, "$ne": None}
                })

        # Contact information filters
        if filters.has_email is not None:
            if filters.has_email:
                # Fixed: Ensure email is actually a non-null, non-empty string
                query = query.find({
                    "$and": [
                        {"email": {"$ne": None}},
                        {"email": {"$ne": ""}},
                        {"email": {"$type": "string"}}
                    ]
                })
            else:
                query = query.find({
                    "$or": [
                        {"email": None},
                        {"email": ""},
                        {"email": {"$exists": False}}
                    ]
                })

        # Account age filters
        if filters.account_age_min_days is not None or filters.account_age_max_days is not None:
            current_time = datetime.utcnow()

            if filters.account_age_min_days is not None:
                # Account must be older than min days
                max_created_at = current_time - timedelta(days=filters.account_age_min_days)
                query = query.find({"created_at": {"$lte": max_created_at}})

            if filters.account_age_max_days is not None:
                # Account must be younger than max days
                min_created_at = current_time - timedelta(days=filters.account_age_max_days)
                query = query.find({"created_at": {"$gte": min_created_at}})

        # Created by filter
        if filters.created_by:
            query = query.find({"created_by": filters.created_by})

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

        # Use MongoDB collection directly to bypass revision checking
        await User.get_motor_collection().update_one(
            {"user_id": user_id},
            {"$set": {
                "status": UserStatus.DEACTIVATED.value,
                "updated_at": datetime.utcnow()
            }}
        )

        return {"message": "User deactivated successfully"}
    
    @staticmethod
    async def get_user_stats(timezone_header: Optional[str] = None) -> UserStatsResponse:
        """Get user statistics for admin dashboard using business timezone"""
        from app.core.timezone_utils import get_user_business_date, get_user_now

        # Get business date boundaries in user's timezone
        business_today = get_user_business_date(timezone_header)

        # Get first day of current month in user's timezone
        user_now = get_user_now(timezone_header)
        first_day_of_month = user_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Aggregate statistics
        total_users = await User.find().count()
        active_users = await User.find(User.status == UserStatus.ACTIVE).count()
        suspended_users = await User.find(User.status == UserStatus.SUSPENDED).count()
        admin_users = await User.find(User.role == UserRole.ADMIN).count()
        staff_users = await User.find(User.role == UserRole.STAFF).count()
        users_created_today = await User.find(User.created_at >= business_today).count()
        users_created_this_month = await User.find(User.created_at >= first_day_of_month).count()
        recent_logins = await User.find(User.last_login >= business_today).count()

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
            users_created_this_month=users_created_this_month,
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
    def _create_access_token(user: User, session_id: str = None) -> str:
        """Create JWT access token with optional session tracking"""
        payload = {
            "sub": user.user_id,
            "role": str(user.role),  # Handle both enum and string values
            "status": str(user.status),  # Handle both enum and string values
            "exp": datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRATION),
            "iat": datetime.utcnow()
        }

        # Include session ID as jti (JWT ID) for session tracking
        if session_id:
            payload["jti"] = session_id

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

        # Validate session is still active (if jti claim exists)
        session_id = payload.get("jti")
        if session_id and session_id not in user.active_sessions:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has been revoked. Please login again",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        return user
    
    @staticmethod
    def _create_refresh_token(user: User, session_id: str = None) -> str:
        """Create JWT refresh token with optional session tracking"""
        payload = {
            "sub": user.user_id,
            "role": str(user.role),
            "status": str(user.status),
            "exp": datetime.utcnow() + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRATION),
            "iat": datetime.utcnow(),
            "token_type": "refresh"
        }

        # Include session ID as jti (JWT ID) for session tracking
        if session_id:
            payload["jti"] = session_id

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

            # Extract session ID from refresh token (if present)
            session_id = payload.get("jti")

            # Validate session is still active (if session tracking enabled)
            if session_id and session_id not in user.active_sessions:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session has been revoked. Please login again",
                    headers={"WWW-Authenticate": "Bearer"}
                )

            # Generate new access token with same session ID
            new_access_token = UserService._create_access_token(user, session_id=session_id)
            
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

            # Generate refresh token with session ID
            refresh_token = UserService._create_refresh_token(user, session_id=login_response.session_id)
            
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