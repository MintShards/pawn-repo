"""
User Activity Logging Service

Service for tracking user activities and generating audit logs.
"""

from typing import Optional, Dict, Any
from datetime import datetime, UTC
from fastapi import Request

from app.models.user_activity_log_model import (
    UserActivityLog,
    UserActivityType,
    ActivitySeverity,
    log_user_activity
)


class UserActivityService:
    """Service for logging user activities"""

    @staticmethod
    async def log_activity(
        user_id: str,
        activity_type: UserActivityType,
        description: str,
        severity: ActivitySeverity = ActivitySeverity.INFO,
        details: Optional[str] = None,
        request: Optional[Request] = None,
        target_user_id: Optional[str] = None,
        target_customer_phone: Optional[str] = None,
        target_transaction_id: Optional[str] = None,
        target_resource_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        previous_value: Optional[str] = None,
        new_value: Optional[str] = None,
        is_success: bool = True,
        error_message: Optional[str] = None
    ) -> UserActivityLog:
        """
        Log a user activity with full context.

        Args:
            user_id: User performing the action
            activity_type: Type of activity
            description: Human-readable description
            severity: Severity level
            details: Additional technical details
            request: FastAPI request object for context
            target_user_id: User affected by action
            target_customer_phone: Customer affected by action
            target_transaction_id: Transaction affected by action
            target_resource_id: Generic resource ID
            resource_type: Type of resource
            metadata: Additional metadata
            previous_value: Previous value for updates
            new_value: New value for updates
            is_success: Whether action succeeded
            error_message: Error message if failed

        Returns:
            Created activity log entry
        """
        # Extract context from request if provided
        ip_address = None
        user_agent = None
        session_id = None
        request_id = None

        if request:
            # Get IP address from various headers
            ip_address = (
                request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
                or request.headers.get("X-Real-IP")
                or (request.client.host if request.client else None)
            )

            # Get user agent
            user_agent = request.headers.get("User-Agent")

            # Get session ID if available
            session_id = request.headers.get("X-Session-ID")

            # Get request ID if available
            request_id = request.headers.get("X-Request-ID")

            # Note: Client timezone is stored in request.state.client_timezone by timezone middleware
            # and is automatically used by timezone_utils functions when converting dates

        return await log_user_activity(
            user_id=user_id,
            activity_type=activity_type,
            description=description,
            severity=severity,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
            session_id=session_id,
            request_id=request_id,
            target_user_id=target_user_id,
            target_customer_phone=target_customer_phone,
            target_transaction_id=target_transaction_id,
            target_resource_id=target_resource_id,
            resource_type=resource_type,
            metadata=metadata,
            previous_value=previous_value,
            new_value=new_value,
            is_success=is_success,
            error_message=error_message
        )

    @staticmethod
    async def log_login_attempt(
        user_id: str,
        success: bool,
        request: Optional[Request] = None,
        reason: Optional[str] = None
    ) -> UserActivityLog:
        """Log a login attempt"""
        if success:
            return await UserActivityService.log_activity(
                user_id=user_id,
                activity_type=UserActivityType.LOGIN_SUCCESS,
                description=f"User {user_id} logged in successfully",
                severity=ActivitySeverity.INFO,
                request=request,
                is_success=True
            )
        else:
            return await UserActivityService.log_activity(
                user_id=user_id,
                activity_type=UserActivityType.LOGIN_FAILED,
                description=f"Failed login attempt for user {user_id}",
                severity=ActivitySeverity.WARNING,
                details=reason or "Invalid credentials",
                request=request,
                is_success=False,
                error_message=reason or "Invalid credentials"
            )

    @staticmethod
    async def log_logout(
        user_id: str,
        request: Optional[Request] = None
    ) -> UserActivityLog:
        """Log a user logout"""
        return await UserActivityService.log_activity(
            user_id=user_id,
            activity_type=UserActivityType.LOGOUT,
            description=f"User {user_id} logged out",
            severity=ActivitySeverity.INFO,
            request=request
        )

    @staticmethod
    async def log_user_created(
        creator_user_id: str,
        new_user_id: str,
        new_user_role: str,
        request: Optional[Request] = None
    ) -> UserActivityLog:
        """Log user creation"""
        return await UserActivityService.log_activity(
            user_id=creator_user_id,
            activity_type=UserActivityType.USER_CREATED,
            description=f"Created new user {new_user_id} with role {new_user_role}",
            severity=ActivitySeverity.INFO,
            target_user_id=new_user_id,
            metadata={"role": new_user_role},
            request=request
        )

    @staticmethod
    async def log_user_updated(
        updater_user_id: str,
        target_user_id: str,
        changes: Dict[str, Any],
        request: Optional[Request] = None
    ) -> UserActivityLog:
        """Log user profile update"""
        return await UserActivityService.log_activity(
            user_id=updater_user_id,
            activity_type=UserActivityType.USER_UPDATED,
            description=f"Updated user {target_user_id} profile",
            severity=ActivitySeverity.INFO,
            target_user_id=target_user_id,
            metadata=changes,
            request=request
        )

    @staticmethod
    async def log_status_changed(
        updater_user_id: str,
        target_user_id: str,
        old_status: str,
        new_status: str,
        request: Optional[Request] = None
    ) -> UserActivityLog:
        """Log user status change"""
        return await UserActivityService.log_activity(
            user_id=updater_user_id,
            activity_type=UserActivityType.STATUS_CHANGED,
            description=f"Changed user {target_user_id} status from {old_status} to {new_status}",
            severity=ActivitySeverity.WARNING if new_status == "suspended" else ActivitySeverity.INFO,
            target_user_id=target_user_id,
            previous_value=old_status,
            new_value=new_status,
            request=request
        )

    @staticmethod
    async def log_role_changed(
        updater_user_id: str,
        target_user_id: str,
        old_role: str,
        new_role: str,
        request: Optional[Request] = None
    ) -> UserActivityLog:
        """Log user role change"""
        return await UserActivityService.log_activity(
            user_id=updater_user_id,
            activity_type=UserActivityType.ROLE_CHANGED,
            description=f"Changed user {target_user_id} role from {old_role} to {new_role}",
            severity=ActivitySeverity.WARNING,
            target_user_id=target_user_id,
            previous_value=old_role,
            new_value=new_role,
            request=request
        )

    @staticmethod
    async def log_pin_reset(
        admin_user_id: str,
        target_user_id: str,
        request: Optional[Request] = None
    ) -> UserActivityLog:
        """Log PIN reset"""
        return await UserActivityService.log_activity(
            user_id=admin_user_id,
            activity_type=UserActivityType.PIN_RESET,
            description=f"Reset PIN for user {target_user_id}",
            severity=ActivitySeverity.WARNING,
            target_user_id=target_user_id,
            request=request
        )

    @staticmethod
    async def log_account_locked(
        user_id: str,
        reason: str,
        request: Optional[Request] = None
    ) -> UserActivityLog:
        """Log account lockout"""
        return await UserActivityService.log_activity(
            user_id=user_id,
            activity_type=UserActivityType.ACCOUNT_LOCKED,
            description=f"Account {user_id} locked",
            severity=ActivitySeverity.ERROR,
            details=reason,
            request=request
        )

    @staticmethod
    async def log_customer_action(
        user_id: str,
        activity_type: UserActivityType,
        customer_phone: str,
        description: str,
        request: Optional[Request] = None
    ) -> UserActivityLog:
        """Log customer-related action"""
        return await UserActivityService.log_activity(
            user_id=user_id,
            activity_type=activity_type,
            description=description,
            target_customer_phone=customer_phone,
            resource_type="customer",
            request=request
        )

    @staticmethod
    async def log_transaction_action(
        user_id: str,
        activity_type: UserActivityType,
        transaction_id: str,
        description: str,
        metadata: Optional[Dict[str, Any]] = None,
        request: Optional[Request] = None
    ) -> UserActivityLog:
        """Log transaction-related action"""
        return await UserActivityService.log_activity(
            user_id=user_id,
            activity_type=activity_type,
            description=description,
            target_transaction_id=transaction_id,
            resource_type="pawn_transaction",
            metadata=metadata,
            request=request
        )

    @staticmethod
    async def log_payment_action(
        user_id: str,
        activity_type: UserActivityType,
        payment_id: str,
        transaction_id: str,
        amount: float,
        description: str,
        request: Optional[Request] = None
    ) -> UserActivityLog:
        """Log payment-related action"""
        return await UserActivityService.log_activity(
            user_id=user_id,
            activity_type=activity_type,
            description=description,
            target_transaction_id=transaction_id,
            target_resource_id=payment_id,
            resource_type="payment",
            metadata={"amount": amount},
            request=request
        )

    @staticmethod
    async def log_extension_action(
        user_id: str,
        activity_type: UserActivityType,
        extension_id: str,
        transaction_id: str,
        days: int,
        description: str,
        request: Optional[Request] = None
    ) -> UserActivityLog:
        """Log extension-related action"""
        return await UserActivityService.log_activity(
            user_id=user_id,
            activity_type=activity_type,
            description=description,
            target_transaction_id=transaction_id,
            target_resource_id=extension_id,
            resource_type="extension",
            metadata={"days": days},
            request=request
        )
