"""
Date utility functions for calendar arithmetic across the pawn system.

Provides consistent date calculation methods for maturity dates, grace periods,
and extension calculations using calendar month arithmetic.
"""

from datetime import datetime, UTC
import calendar


def add_months_to_date(base_date: datetime, months_to_add: int) -> datetime:
    """
    Add calendar months to a date using proper month arithmetic.
    
    Args:
        base_date: Starting date
        months_to_add: Number of months to add
        
    Returns:
        New date with months added
    """
    year = base_date.year
    month = base_date.month + months_to_add
    day = base_date.day
    
    # Handle month overflow
    if month > 12:
        year += month // 12
        month = month % 12
        if month == 0:
            month = 12
            year -= 1
    
    # Handle day overflow for shorter months
    try:
        new_date = base_date.replace(year=year, month=month, day=day)
    except ValueError:
        # Day doesn't exist in target month (e.g., Jan 31 → Feb 31)
        # Move to last day of the month
        last_day = calendar.monthrange(year, month)[1]
        new_date = base_date.replace(year=year, month=month, day=last_day)
    
    return new_date


def ensure_timezone_aware(dt: datetime) -> datetime:
    """
    Ensure datetime is timezone-aware (UTC).
    
    Args:
        dt: datetime object (may or may not be timezone-aware)
        
    Returns:
        Timezone-aware datetime in UTC
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def calculate_months_elapsed(start_date: datetime, end_date: datetime) -> int:
    """
    Calculate months elapsed between two dates using calendar month logic.
    
    Args:
        start_date: Starting date (e.g., pawn_date)
        end_date: Ending date (e.g., current date)
        
    Returns:
        Number of complete months elapsed
    """
    # Ensure timezone consistency
    start_date = ensure_timezone_aware(start_date)
    end_date = ensure_timezone_aware(end_date)
    
    months_elapsed = ((end_date.year - start_date.year) * 12 + 
                     (end_date.month - start_date.month))
    
    # Only add 1 if we've passed the start day (not on the exact day)
    if end_date.day > start_date.day:
        months_elapsed += 1
    
    return months_elapsed