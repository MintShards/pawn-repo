"""
Account Security Service - Production-grade security controls for authentication.

This module implements:
1. Progressive account lockout with exponential backoff
2. Progressive login delays (exponential backoff before lockout)
3. Admin unlock capabilities with authorization
4. Comprehensive security event tracking

Security Philosophy:
- Defense in depth: Multiple layers of protection
- Fail secure: Default to denying access when uncertain
- Audit everything: Comprehensive logging for security analysis
- No secrets logged: Never log PINs, tokens, or sensitive data
"""

import asyncio
import logging
from datetime import datetime, timedelta, UTC
from typing import Optional, Dict, Any
from enum import Enum

from fastapi import HTTPException, status

from app.models.user_model import User, UserRole, AuthConfig


# Security event logger (separate from application logs)
security_logger = logging.getLogger("security.account")


class SecurityEventType(str, Enum):
    """Security event types for audit trail"""
    AUTH_SUCCESS = "auth_success"
    AUTH_FAILURE = "auth_failure"
    ACCOUNT_LOCKED = "account_locked"
    ACCOUNT_UNLOCKED = "account_unlocked"
    PROGRESSIVE_DELAY_APPLIED = "progressive_delay_applied"
    LOCKOUT_AUTO_EXPIRED = "lockout_auto_expired"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"


class ProgressiveLockoutConfig:
    """Progressive lockout configuration with exponential backoff"""
    # Base lockout duration (minutes)
    BASE_LOCKOUT_MINUTES = 15

    # Progressive lockout thresholds
    LOCKOUT_TIER_1_COUNT = 1  # First lockout: 15 minutes
    LOCKOUT_TIER_2_COUNT = 3  # After 3 lockouts: 30 minutes
    LOCKOUT_TIER_3_COUNT = 5  # After 5 lockouts: 60 minutes
    LOCKOUT_TIER_4_COUNT = 10  # After 10 lockouts: 120 minutes (2 hours)

    # Lockout duration multipliers
    TIER_1_MULTIPLIER = 1  # 15 minutes
    TIER_2_MULTIPLIER = 2  # 30 minutes
    TIER_3_MULTIPLIER = 4  # 60 minutes
    TIER_4_MULTIPLIER = 8  # 120 minutes

    # Progressive delay configuration (before lockout)
    DELAY_START_ATTEMPT = 3  # Start delays after 3rd failed attempt
    BASE_DELAY_SECONDS = 2  # Base delay in seconds
    MAX_DELAY_SECONDS = 8  # Maximum delay before lockout

    # Reset thresholds
    RESET_LOCKOUT_COUNT_DAYS = 30  # Reset lockout counter after 30 days of good behavior


class AccountSecurityService:
    """
    Production-grade account security service.

    Features:
    - Progressive lockout with exponential backoff
    - Automatic unlock after timeout
    - Manual admin unlock with authorization
    - Progressive delays before lockout
    - Comprehensive audit logging
    """

    @staticmethod
    def calculate_lockout_duration(lockout_count: int) -> int:
        """
        Calculate lockout duration in minutes based on lockout count.

        Progressive lockout strategy:
        - 1st lockout: 15 minutes
        - 3rd lockout: 30 minutes
        - 5th lockout: 60 minutes
        - 10th+ lockout: 120 minutes

        Args:
            lockout_count: Total number of account lockouts

        Returns:
            Lockout duration in minutes
        """
        base_minutes = ProgressiveLockoutConfig.BASE_LOCKOUT_MINUTES

        if lockout_count >= ProgressiveLockoutConfig.LOCKOUT_TIER_4_COUNT:
            return base_minutes * ProgressiveLockoutConfig.TIER_4_MULTIPLIER
        elif lockout_count >= ProgressiveLockoutConfig.LOCKOUT_TIER_3_COUNT:
            return base_minutes * ProgressiveLockoutConfig.TIER_3_MULTIPLIER
        elif lockout_count >= ProgressiveLockoutConfig.LOCKOUT_TIER_2_COUNT:
            return base_minutes * ProgressiveLockoutConfig.TIER_2_MULTIPLIER
        else:
            return base_minutes * ProgressiveLockoutConfig.TIER_1_MULTIPLIER

    @staticmethod
    def calculate_progressive_delay(failed_attempts: int) -> float:
        """
        Calculate progressive delay in seconds based on failed attempts.

        Exponential backoff strategy:
        - Attempts 1-2: No delay (user experience)
        - Attempt 3: 2 seconds
        - Attempt 4: 4 seconds
        - Attempt 5: 8 seconds (then lockout)

        Args:
            failed_attempts: Number of consecutive failed attempts

        Returns:
            Delay duration in seconds (0 if no delay)
        """
        if failed_attempts < ProgressiveLockoutConfig.DELAY_START_ATTEMPT:
            return 0.0

        # Exponential backoff: 2^(attempts - 2)
        delay = ProgressiveLockoutConfig.BASE_DELAY_SECONDS ** (
            failed_attempts - ProgressiveLockoutConfig.DELAY_START_ATTEMPT + 1
        )

        return min(delay, ProgressiveLockoutConfig.MAX_DELAY_SECONDS)

    @staticmethod
    async def apply_progressive_delay(user: User, context: Dict[str, Any]) -> None:
        """
        Apply progressive delay based on failed login attempts.

        This method implements exponential backoff to slow down brute force attacks
        without immediately locking accounts (preserving user experience for first 2 attempts).

        Args:
            user: User object with failed_login_attempts
            context: Security context (IP, user agent, request ID)
        """
        delay_seconds = AccountSecurityService.calculate_progressive_delay(
            user.failed_login_attempts
        )

        if delay_seconds > 0:
            # Log progressive delay application
            security_logger.info(
                f"Progressive delay applied: user_id={user.user_id}, "
                f"attempts={user.failed_login_attempts}, delay={delay_seconds}s, "
                f"ip={context.get('ip', 'unknown')}"
            )

            # Apply delay
            await asyncio.sleep(delay_seconds)

    @staticmethod
    async def lock_account(user: User, context: Dict[str, Any]) -> None:
        """
        Lock user account with progressive timeout.

        Implements progressive lockout:
        - First lockout: 15 minutes
        - After 3 lockouts: 30 minutes
        - After 5 lockouts: 60 minutes
        - After 10 lockouts: 120 minutes

        Args:
            user: User object to lock
            context: Security context (IP, user agent, request ID)
        """
        # Increment total lockout count
        if not hasattr(user, 'total_lockout_count') or user.total_lockout_count is None:
            user.total_lockout_count = 0
        user.total_lockout_count += 1

        # Calculate progressive lockout duration
        lockout_minutes = AccountSecurityService.calculate_lockout_duration(
            user.total_lockout_count
        )

        # Set lockout expiration
        now = datetime.now(UTC)
        user.locked_until = now + timedelta(minutes=lockout_minutes)
        user.last_lockout_at = now

        # Log account lockout
        security_logger.warning(
            f"Account locked: user_id={user.user_id}, "
            f"lockout_number={user.total_lockout_count}, "
            f"duration={lockout_minutes}min, "
            f"locked_until={user.locked_until.isoformat()}, "
            f"ip={context.get('ip', 'unknown')}"
        )

        # Save user state
        await user.save()

    @staticmethod
    async def check_and_unlock_expired(user: User) -> bool:
        """
        Check if account lockout has expired and auto-unlock if necessary.

        Args:
            user: User object to check

        Returns:
            True if account was unlocked, False otherwise
        """
        if user.locked_until:
            # Ensure locked_until is timezone-aware for comparison
            locked_until_aware = user.locked_until
            if locked_until_aware.tzinfo is None:
                locked_until_aware = locked_until_aware.replace(tzinfo=UTC)

            if locked_until_aware <= datetime.now(UTC):
                # Lockout expired, auto-unlock
                security_logger.info(
                    f"Account auto-unlocked: user_id={user.user_id}, "
                    f"was_locked_until={user.locked_until.isoformat()}"
                )

                user.locked_until = None
                user.failed_login_attempts = 0
                await user.save()

            return True

        return False

    @staticmethod
    async def unlock_account_admin(
        user: User,
        admin_user: User,
        supervisor_pin: Optional[str] = None,
        context: Dict[str, Any] = None
    ) -> None:
        """
        Manually unlock account (admin only).

        Requires:
        - Admin role authorization
        - Optional supervisor PIN for critical unlocks

        Args:
            user: User account to unlock
            admin_user: Admin performing unlock
            supervisor_pin: Optional supervisor PIN for additional authorization
            context: Security context (IP, user agent, request ID)

        Raises:
            HTTPException: If admin is not authorized or validation fails
        """
        # Validate admin authorization
        if admin_user.role != UserRole.ADMIN:
            security_logger.warning(
                f"Unauthorized unlock attempt: admin_id={admin_user.user_id}, "
                f"target_user={user.user_id}, ip={context.get('ip', 'unknown') if context else 'unknown'}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin privileges required to unlock accounts"
            )

        # Supervisor PIN validation (optional but recommended for high-value accounts)
        if supervisor_pin:
            if not admin_user.verify_pin(supervisor_pin):
                security_logger.warning(
                    f"Invalid supervisor PIN for unlock: admin_id={admin_user.user_id}, "
                    f"target_user={user.user_id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid supervisor PIN"
                )

        # Unlock account
        user.locked_until = None
        user.failed_login_attempts = 0
        await user.save()

        # Log admin unlock
        security_logger.info(
            f"Account manually unlocked: user_id={user.user_id}, "
            f"admin={admin_user.user_id}, "
            f"supervisor_pin_used={bool(supervisor_pin)}, "
            f"ip={context.get('ip', 'unknown') if context else 'unknown'}"
        )

    @staticmethod
    async def reset_lockout_counter(user: User) -> None:
        """
        Reset lockout counter after period of good behavior.

        This provides a "clean slate" for users who have demonstrated good security hygiene
        for an extended period (default: 30 days).

        Args:
            user: User object to reset
        """
        # Check if user qualifies for reset
        if not hasattr(user, 'last_lockout_at') or user.last_lockout_at is None:
            return

        days_since_lockout = (datetime.now(UTC) - user.last_lockout_at).days

        if days_since_lockout >= ProgressiveLockoutConfig.RESET_LOCKOUT_COUNT_DAYS:
            old_count = getattr(user, 'total_lockout_count', 0)
            user.total_lockout_count = 0
            await user.save()

            security_logger.info(
                f"Lockout counter reset: user_id={user.user_id}, "
                f"old_count={old_count}, days_since_last_lockout={days_since_lockout}"
            )

    @staticmethod
    def get_security_context(request: Any) -> Dict[str, Any]:
        """
        Extract security context from HTTP request.

        Args:
            request: FastAPI request object

        Returns:
            Dictionary with security context (IP, user agent, request ID)
        """
        return {
            "ip": request.client.host if hasattr(request, 'client') and request.client else 'unknown',
            "user_agent": request.headers.get('user-agent', 'unknown') if hasattr(request, 'headers') else 'unknown',
            "request_id": request.state.request_id if hasattr(request, 'state') and hasattr(request.state, 'request_id') else 'unknown'
        }

    @staticmethod
    def log_security_event(
        event_type: SecurityEventType,
        user_id: str,
        details: Dict[str, Any],
        context: Dict[str, Any]
    ) -> None:
        """
        Log security event with structured data.

        Args:
            event_type: Type of security event
            user_id: User ID involved in event
            details: Event-specific details
            context: Security context (IP, user agent, request ID)
        """
        # Handle both enum and string event types
        event_type_str = event_type.value if hasattr(event_type, 'value') else str(event_type)

        log_entry = {
            "event_type": event_type_str,
            "user_id": user_id,
            "timestamp": datetime.now(UTC).isoformat(),
            "ip": context.get("ip", "unknown"),
            "user_agent": context.get("user_agent", "unknown"),
            "request_id": context.get("request_id", "unknown"),
            **details
        }

        # Log to security logger
        if event_type in [SecurityEventType.ACCOUNT_LOCKED, SecurityEventType.SUSPICIOUS_ACTIVITY]:
            security_logger.warning(f"Security event: {log_entry}")
        else:
            security_logger.info(f"Security event: {log_entry}")
