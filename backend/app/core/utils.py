"""
Common utility functions shared across the pawn system.

Provides helper functions for enum handling, formatting, and other
common operations used throughout the application.
"""

from typing import Any


def get_enum_value(enum_field: Any) -> str:
    """
    Helper to safely get enum value, handling both enum objects and strings.
    
    Args:
        enum_field: Enum object or string
        
    Returns:
        String value of the enum
    """
    if isinstance(enum_field, str):
        return enum_field
    return enum_field.value


def format_currency(amount: int) -> str:
    """
    Format integer amount as currency string.
    
    Args:
        amount: Amount in whole dollars
        
    Returns:
        Formatted currency string (e.g., "$1,234")
    """
    return f"${amount:,}"


def validate_positive_integer(value: int, field_name: str, max_value: int = None) -> int:
    """
    Validate that a value is a positive integer within optional bounds.
    
    Args:
        value: Value to validate
        field_name: Name of field for error messages
        max_value: Optional maximum value
        
    Returns:
        Validated integer value
        
    Raises:
        ValueError: If validation fails
    """
    if not isinstance(value, int):
        raise ValueError(f"{field_name} must be an integer")
    
    if value <= 0:
        raise ValueError(f"{field_name} must be greater than 0")
    
    if max_value and value > max_value:
        raise ValueError(f"{field_name} cannot exceed {max_value}")
    
    return value