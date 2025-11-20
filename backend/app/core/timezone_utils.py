"""
Timezone utility functions for dynamic timezone handling.

Supports automatic timezone detection from client headers and provides
business logic date calculations in the user's local timezone.
"""

from datetime import datetime, UTC
from typing import Optional
from zoneinfo import ZoneInfo
import structlog

# Configure logger
logger = structlog.get_logger("timezone_utils")


def validate_and_get_timezone(tz_string: Optional[str] = None) -> ZoneInfo:
    """
    Validate timezone string and return ZoneInfo timezone object.

    SECURITY: Prevents crashes from malformed timezone strings by validating
    against zoneinfo database. Always returns a valid timezone object.

    Args:
        tz_string: Timezone string from X-Client-Timezone header

    Returns:
        ZoneInfo object (defaults to UTC if invalid)

    Raises:
        Never raises - always returns valid timezone (defensive)
    """
    # Default to UTC if not provided
    if not tz_string:
        logger.debug("No timezone provided, defaulting to UTC")
        return ZoneInfo("UTC")

    # Validate and return timezone
    try:
        tz = ZoneInfo(tz_string)
        logger.debug(f"Valid timezone received: {tz_string}")
        return tz
    except Exception as e:
        logger.warning(
            f"Invalid timezone received: {tz_string}, falling back to UTC",
            extra={"invalid_timezone": tz_string, "error": str(e)}
        )
        return ZoneInfo("UTC")




def get_user_now(timezone_header: Optional[str] = None) -> datetime:
    """
    Get current time in user's timezone.

    Args:
        timezone_header: Client timezone from X-Client-Timezone header

    Returns:
        Current datetime in user's timezone
    """
    user_tz = validate_and_get_timezone(timezone_header)
    return datetime.now(user_tz)


def get_user_business_date(timezone_header: Optional[str] = None) -> datetime:
    """
    Get current business date in user's timezone (midnight start of day).

    Used for pawn transactions to ensure consistent business date
    regardless of time of day the transaction is created.

    Args:
        timezone_header: Client timezone from X-Client-Timezone header

    Returns:
        Datetime representing start of current business day in user's timezone
    """
    user_tz = validate_and_get_timezone(timezone_header)
    local_now = datetime.now(user_tz)
    # Get start of business day (midnight) in user's timezone
    business_date = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return business_date


def utc_to_user_timezone(utc_dt: datetime, timezone_header: Optional[str] = None) -> datetime:
    """
    Convert UTC datetime to user's timezone.

    Args:
        utc_dt: UTC datetime
        timezone_header: Client timezone from X-Client-Timezone header

    Returns:
        Datetime converted to user's timezone
    """
    if utc_dt.tzinfo is None:
        utc_dt = utc_dt.replace(tzinfo=UTC)

    user_tz = validate_and_get_timezone(timezone_header)
    return utc_dt.astimezone(user_tz)


def user_timezone_to_utc(local_dt: datetime, timezone_header: Optional[str] = None) -> datetime:
    """
    Convert user timezone datetime to UTC.

    Args:
        local_dt: Datetime in user's timezone
        timezone_header: Client timezone from X-Client-Timezone header

    Returns:
        Datetime converted to UTC
    """
    user_tz = validate_and_get_timezone(timezone_header)

    if local_dt.tzinfo is None:
        local_dt = local_dt.replace(tzinfo=user_tz)

    return local_dt.astimezone(UTC)


def get_months_between_user_timezone(
    start_date: datetime, 
    end_date: datetime, 
    timezone_header: Optional[str] = None
) -> int:
    """
    Calculate months between dates using user's timezone for calendar logic.
    
    Args:
        start_date: Starting date (stored in UTC)
        end_date: Ending date (stored in UTC)
        timezone_header: Client timezone from X-Client-Timezone header
        
    Returns:
        Number of complete months elapsed in user's timezone
    """
    # Convert to user timezone for calendar calculations
    start_local = utc_to_user_timezone(start_date, timezone_header)
    end_local = utc_to_user_timezone(end_date, timezone_header)
    
    months_elapsed = ((end_local.year - start_local.year) * 12 + 
                     (end_local.month - start_local.month))
    
    # Only add 1 if we've passed the start day
    if end_local.day > start_local.day:
        months_elapsed += 1
    
    return months_elapsed


def format_user_datetime(utc_dt: datetime, timezone_header: Optional[str] = None) -> str:
    """
    Format datetime for display in user's timezone.
    
    Args:
        utc_dt: UTC datetime
        timezone_header: Client timezone from X-Client-Timezone header
        
    Returns:
        Formatted datetime string with timezone abbreviation
    """
    local_dt = utc_to_user_timezone(utc_dt, timezone_header)
    return local_dt.strftime("%Y-%m-%d %H:%M %Z")


def add_months_user_timezone(
    base_date: datetime, 
    months_to_add: int, 
    timezone_header: Optional[str] = None
) -> datetime:
    """
    Add months to a date using user's timezone calendar logic.
    
    Args:
        base_date: Starting date (UTC)
        months_to_add: Number of months to add
        timezone_header: Client timezone from X-Client-Timezone header
        
    Returns:
        New date in UTC with months added using user's calendar
    """
    # Convert to user timezone for calendar arithmetic
    local_dt = utc_to_user_timezone(base_date, timezone_header)
    
    year = local_dt.year
    month = local_dt.month + months_to_add
    day = local_dt.day
    
    # Handle month overflow
    if month > 12:
        year += month // 12
        month = month % 12
        if month == 0:
            month = 12
            year -= 1
    elif month < 1:
        year += month // 12 - 1
        month = month % 12 + 12
    
    # Handle day overflow for shorter months
    import calendar
    try:
        new_local = local_dt.replace(year=year, month=month, day=day)
    except ValueError:
        # Day doesn't exist in target month
        last_day = calendar.monthrange(year, month)[1]
        new_local = local_dt.replace(year=year, month=month, day=last_day)
    
    # Convert back to UTC
    return user_timezone_to_utc(new_local, timezone_header)