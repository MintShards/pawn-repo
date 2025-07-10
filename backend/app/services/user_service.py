# backend/app/services/user_service.py
from typing import Optional, List, Tuple
from uuid import UUID
from datetime import datetime
from app.schemas.user_schema import (
    UserCreateByAdmin, UserSetPin, UserUpdatePin, UserUpdate, 
    AdminCreateRequest, FirstTimeSetupCheck
)
from app.models.user_model import User, UserRole
from app.core.security import get_password_hash, verify_password
from beanie.operators import And
import logging

logger = logging.getLogger(__name__)

class UserService:
    
    @staticmethod
    async def check_first_time_setup() -> FirstTimeSetupCheck:
        """Check if this is the first time setup (no users exist)"""
        total_users = await User.find().count()
        admin_exists = await User.find_one(User.role == UserRole.ADMIN) is not None
        
        return FirstTimeSetupCheck(
            is_first_time_setup=total_users == 0,
            total_users=total_users,
            admin_exists=admin_exists
        )
    
    @staticmethod
    async def create_first_admin(admin_data: AdminCreateRequest) -> User:
        """Create the first admin user during initial setup"""
        # Verify this is actually first time setup
        setup_check = await UserService.check_first_time_setup()
        if not setup_check.is_first_time_setup:
            raise ValueError("System already has users. Use regular admin user creation.")
        
        # Check if user number is available
        existing_user = await User.find_one(User.user_number == admin_data.user_number)
        if existing_user:
            raise ValueError(f"User number {admin_data.user_number} is already taken")
        
        # Create admin user
        hashed_pin = get_password_hash(admin_data.pin)
        
        user = User(
            user_number=admin_data.user_number,
            first_name=admin_data.first_name,
            last_name=admin_data.last_name,
            role=UserRole.ADMIN,
            hashed_pin=hashed_pin,
            pin_set=True,
            is_active=True
        )
        
        await user.save()
        logger.info(f"Created first admin user #{user.user_number}")
        return user
    
    @staticmethod
    async def create_user_by_admin(user_data: UserCreateByAdmin, created_by: UUID) -> User:
        """Create a new user (admin only)"""
        try:
            # Verify the creator is an admin
            admin = await User.find_one(User.user_id == created_by)
            if not admin or not admin.is_admin:
                raise ValueError("Only administrators can create new users")
            
            # Get next available user number
            next_user_number = await UserService.get_next_available_user_number()
            if next_user_number is None:
                raise ValueError("All user numbers (10-99) are taken")
            
            # Determine role from is_admin flag
            role = UserRole.ADMIN if user_data.is_admin else UserRole.STAFF
            
            # Clean and validate data
            phone = user_data.phone if user_data.phone and user_data.phone.strip() else None
            email = user_data.email if user_data.email and user_data.email.strip() else None
            
            # Hash the PIN provided by admin
            hashed_pin = get_password_hash(user_data.pin)
            
            # Create user with PIN already set
            user = User(
                user_number=next_user_number,
                first_name=user_data.first_name.strip(),
                last_name=user_data.last_name.strip(),
                phone=phone,
                email=email,
                role=role,
                created_by=created_by,
                hashed_pin=hashed_pin,
                pin_set=True,
                is_active=True
            )
            
            await user.save()
            logger.info(f"Admin #{admin.user_number} created user #{user.user_number} ({user.full_name})")
            return user
            
        except Exception as e:
            logger.error(f"Error creating user: {str(e)}")
            logger.error(f"User data: {user_data}")
            logger.error(f"Created by: {created_by}")
            raise
    
    @staticmethod
    async def authenticate_user(user_number: int, pin: str) -> Optional[User]:
        """Authenticate user with user number and PIN"""
        user = await User.find_one(
            And(
                User.user_number == user_number,
                User.is_active == True,
                User.pin_set == True
            )
        )
        
        if not user or not user.hashed_pin:
            return None
        
        if not verify_password(pin, user.hashed_pin):
            return None
        
        # Update last login
        user.update_last_login()
        await user.save()
        
        return user
    
    @staticmethod
    async def set_user_pin(user_number: int, pin_data: UserSetPin) -> User:
        """Set PIN for a user who doesn't have one yet"""
        user = await User.find_one(
            And(
                User.user_number == user_number,
                User.is_active == True
            )
        )
        
        if not user:
            raise ValueError("User not found or inactive")
        
        if user.pin_set:
            raise ValueError("User already has a PIN set. Use update PIN instead.")
        
        # Hash and save PIN
        hashed_pin = get_password_hash(pin_data.pin)
        user.hashed_pin = hashed_pin
        user.pin_set = True
        user.updated_at = datetime.utcnow()
        
        await user.save()
        logger.info(f"User #{user.user_number} set their PIN")
        return user
    
    @staticmethod
    async def update_user_pin(user_id: UUID, pin_data: UserUpdatePin) -> User:
        """Update PIN for an existing user"""
        user = await User.find_one(User.user_id == user_id)
        if not user:
            raise ValueError("User not found")
        
        if not user.pin_set or not user.hashed_pin:
            raise ValueError("User doesn't have a PIN set")
        
        # Verify current PIN
        if not verify_password(pin_data.current_pin, user.hashed_pin):
            raise ValueError("Current PIN is incorrect")
        
        # Update to new PIN
        new_hashed_pin = get_password_hash(pin_data.new_pin)
        user.hashed_pin = new_hashed_pin
        user.updated_at = datetime.utcnow()
        
        await user.save()
        logger.info(f"User #{user.user_number} updated their PIN")
        return user
    
    @staticmethod
    async def get_user_by_id(user_id) -> Optional[User]:
        """Get user by UUID - accepts both string and UUID types"""
        # Handle both string and UUID types, and strip quotes if present
        if isinstance(user_id, str):
            # Strip surrounding quotes if present
            user_id = user_id.strip('"\'')
            try:
                from uuid import UUID
                user_id = UUID(user_id)
            except ValueError:
                return None
        elif not hasattr(user_id, 'hex'):  # Not a UUID object
            try:
                from uuid import UUID
                user_id = UUID(str(user_id))
            except (ValueError, TypeError):
                return None
        
        return await User.find_one(User.user_id == user_id)
    
    @staticmethod
    async def get_user_by_number(user_number: int) -> Optional[User]:
        """Get user by user number"""
        return await User.find_one(User.user_number == user_number)
    
    @staticmethod
    async def get_all_users(skip: int = 0, limit: int = 100, is_active_filter: Optional[bool] = None) -> List[User]:
        """Get all users with optional filtering"""
        query = User.find()
        
        if is_active_filter is not None:
            query = query.find(User.is_active == is_active_filter)
        
        return await query.skip(skip).limit(limit).to_list()
    
    @staticmethod
    async def update_user(user_id: UUID, user_data: UserUpdate, updated_by: UUID) -> Optional[User]:
        """Update user details (admin only for role changes)"""
        user = await UserService.get_user_by_id(user_id)
        if not user:
            return None
        
        admin = await User.find_one(User.user_id == updated_by)
        if not admin:
            raise ValueError("Invalid admin user")
        
        update_data = user_data.dict(exclude_unset=True)
        
        # Only admins can change roles or active status
        if ('role' in update_data or 'is_active' in update_data) and not admin.is_admin:
            raise ValueError("Only administrators can change user roles or status")
        
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            await user.update({"$set": update_data})
            return await UserService.get_user_by_id(user_id)
        return user
    
    @staticmethod
    async def update_user_by_number(user_number: int, user_data: UserUpdate, updated_by: UUID) -> Optional[User]:
        """Update user details by user_number (admin only for role changes)"""
        user = await User.find_one(User.user_number == user_number)
        if not user:
            return None
        
        admin = await User.find_one(User.user_id == updated_by)
        if not admin:
            raise ValueError("Invalid admin user")
        
        update_data = user_data.dict(exclude_unset=True)
        
        # Convert is_admin to role
        if 'is_admin' in update_data:
            is_admin = update_data.pop('is_admin')
            update_data['role'] = UserRole.ADMIN if is_admin else UserRole.STAFF
        
        # Handle full_name by splitting into first_name and last_name
        if 'full_name' in update_data:
            full_name = update_data.pop('full_name')
            if full_name:
                names = full_name.strip().split(' ', 1)
                update_data['first_name'] = names[0]
                update_data['last_name'] = names[1] if len(names) > 1 else names[0]
        
        # Only admins can change roles or active status
        if ('role' in update_data or 'is_active' in update_data) and not admin.is_admin:
            raise ValueError("Only administrators can change user roles or status")
        
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            await user.update({"$set": update_data})
            return await User.find_one(User.user_number == user_number)
        return user
    
# User deletion removed - Users are only deactivated via status toggle for audit compliance
    
    @staticmethod
    async def reset_user_pin(user_number: int, reset_by: UUID) -> User:
        """Reset user PIN (admin only) - user will need to set new PIN"""
        admin = await User.find_one(User.user_id == reset_by)
        if not admin or not admin.is_admin:
            raise ValueError("Only administrators can reset PINs")
        
        user = await User.find_one(User.user_number == user_number)
        if not user:
            raise ValueError("User not found")
        
        # Reset PIN
        user.hashed_pin = None
        user.pin_set = False
        user.updated_at = datetime.utcnow()
        
        await user.save()
        logger.info(f"Admin #{admin.user_number} reset PIN for user #{user.user_number}")
        return user
    
    @staticmethod
    async def reset_user_pin_with_new(user_number: int, pin_data: UserSetPin, reset_by: UUID) -> User:
        """Reset user PIN with new PIN assigned by admin"""
        admin = await User.find_one(User.user_id == reset_by)
        if not admin or not admin.is_admin:
            raise ValueError("Only administrators can reset PINs")
        
        user = await User.find_one(User.user_number == user_number)
        if not user:
            raise ValueError("User not found")
        
        # Set new PIN
        hashed_pin = get_password_hash(pin_data.pin)
        user.hashed_pin = hashed_pin
        user.pin_set = True
        user.updated_at = datetime.utcnow()
        
        await user.save()
        logger.info(f"Admin #{admin.user_number} reset PIN for user #{user.user_number} with new PIN")
        return user
    
    @staticmethod
    async def check_user_number_available(user_number: int) -> bool:
        """Check if a user number is available"""
        existing_user = await User.find_one(User.user_number == user_number)
        return existing_user is None
    
    @staticmethod
    async def get_next_available_user_number() -> Optional[int]:
        """Get the next available user number (10-99)"""
        # Get all users and extract their user numbers
        all_users = await User.find().to_list()
        used_numbers = {user.user_number for user in all_users}
        
        for num in range(10, 100):
            if num not in used_numbers:
                return num
        
        return None  # All numbers are taken
    
    @staticmethod
    def validate_pin_strength(pin: str) -> dict:
        """Validate PIN strength and provide feedback"""
        feedback = []
        suggestions = []
        score = 1
        
        # Length check
        if len(pin) < 6:
            feedback.append("PIN is short")
            suggestions.append("Use at least 6 digits for better security")
        else:
            score += 1
        
        # Check for common patterns
        if pin in ['1234', '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999']:
            feedback.append("PIN uses common pattern")
            suggestions.append("Avoid sequential or repeated digits")
        else:
            score += 1
        
        # Check for ascending/descending sequences
        is_ascending = all(int(pin[i]) == int(pin[i-1]) + 1 for i in range(1, len(pin)))
        is_descending = all(int(pin[i]) == int(pin[i-1]) - 1 for i in range(1, len(pin)))
        
        if is_ascending or is_descending:
            feedback.append("PIN uses sequential pattern")
            suggestions.append("Mix up the digit order")
        else:
            score += 1
        
        # Check for repeated digits
        unique_digits = len(set(pin))
        if unique_digits < len(pin) // 2:
            feedback.append("PIN has too many repeated digits")
            suggestions.append("Use more varied digits")
        else:
            score += 1
        
        # Length bonus
        if len(pin) >= 8:
            score += 1
        
        is_strong = score >= 4 and len(feedback) == 0
        
        return {
            "is_strong": is_strong,
            "score": min(score, 5),
            "feedback": feedback,
            "suggestions": suggestions
        }