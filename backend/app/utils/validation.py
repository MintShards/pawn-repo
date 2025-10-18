"""
Shared Validation Utilities

Consolidates validation logic to reduce code duplication between
schemas, services, and API handlers.
"""

import re
from typing import Optional, Dict, Tuple
from decimal import Decimal


class UtilsValidationError(Exception):
    """Custom validation exception for utility validators"""
    pass


class PhoneValidator:
    """Phone number validation utilities"""

    @staticmethod
    def validate(phone_number: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Validate phone number format

        Args:
            phone_number: Phone number string to validate

        Returns:
            Tuple of (is_valid, cleaned_number, error_message)
        """
        if not phone_number:
            return False, None, "Phone number is required"

        # Remove any non-digit characters for validation
        cleaned = re.sub(r'[^\d]', '', phone_number)

        # Must be exactly 10 digits
        if not re.match(r'^\d{10}$', cleaned):
            return False, None, "Phone number must be exactly 10 digits (e.g., 5551234567)"

        return True, cleaned, None

    @staticmethod
    def clean(phone_number: str) -> str:
        """Clean phone number by removing non-digits"""
        return re.sub(r'[^\d]', '', phone_number)

    @staticmethod
    def format_display(phone_number: str) -> str:
        """Format phone number for display: (123) 456-7890"""
        cleaned = PhoneValidator.clean(phone_number)
        if len(cleaned) == 10:
            return f"({cleaned[:3]}) {cleaned[3:6]}-{cleaned[6:]}"
        return phone_number


class EmailValidator:
    """Email validation utilities"""

    @staticmethod
    def validate(email: Optional[str]) -> Tuple[bool, Optional[str]]:
        """
        Validate email format and security

        Args:
            email: Email string to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        if email is None or email == "":
            return True, None  # Email is optional

        # Basic XSS protection - reject emails with suspicious characters
        if re.search(r'[<>"\'\(\)&]', email):
            return False, "Email contains invalid characters"

        # Length check for security (RFC 5321 limit)
        if len(email) > 254:
            return False, "Email address is too long"

        # Basic email format check
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
            return False, "Invalid email format"

        return True, None


class NameValidator:
    """Name validation utilities"""

    @staticmethod
    def validate(name: str, field_name: str = "Name") -> Tuple[bool, Optional[str]]:
        """
        Enhanced name validation with unicode support for international names

        Args:
            name: Name string to validate
            field_name: Field name for error messages

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not name or not name.strip():
            return False, f"{field_name} cannot be empty"

        # Remove leading/trailing whitespace
        cleaned_name = name.strip()

        # Enhanced regex pattern for international names:
        # Support Unicode letters, spaces, hyphens, and apostrophes
        # This supports names like: José, O'Connor, Mary-Jane, etc.
        if not re.match(r'^[\w\s\-\'\.]+$', cleaned_name, re.UNICODE):
            return False, f"{field_name} contains invalid characters. Only letters, spaces, hyphens, and apostrophes are allowed."

        # Check length after cleaning
        if len(cleaned_name) < 1 or len(cleaned_name) > 50:
            return False, f"{field_name} must be between 1 and 50 characters"

        return True, None


class NotesValidator:
    """Notes field validation utilities"""

    @staticmethod
    def validate(notes: Optional[str]) -> Tuple[bool, Optional[str]]:
        """
        Security validation for notes field

        Args:
            notes: Notes string to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        if notes is None:
            return True, None

        cleaned_notes = notes.strip()

        # Basic XSS protection - sanitize HTML-like content
        if re.search(r'<[^>]+>', cleaned_notes):
            return False, "Notes cannot contain HTML tags"

        # Additional XSS patterns
        if re.search(r'(javascript:|data:|vbscript:|onload=|onerror=)', cleaned_notes, re.IGNORECASE):
            return False, "Notes contain potentially unsafe content"

        # Length check
        if len(cleaned_notes) > 1000:
            return False, "Notes cannot exceed 1000 characters"

        return True, None


class CurrencyValidator:
    """Currency and decimal validation utilities"""

    @staticmethod
    def validate_amount(
        amount: Decimal,
        min_value: Decimal = Decimal("0.00"),
        max_value: Decimal = Decimal("1000000.00"),
        field_name: str = "Amount"
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate currency amount

        Args:
            amount: Decimal amount to validate
            min_value: Minimum allowed value
            max_value: Maximum allowed value
            field_name: Field name for error messages

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not isinstance(amount, Decimal):
            try:
                amount = Decimal(str(amount))
            except:
                return False, f"{field_name} must be a valid decimal number"

        if amount < min_value:
            return False, f"{field_name} must be at least ${min_value}"

        if amount > max_value:
            return False, f"{field_name} cannot exceed ${max_value}"

        # Check decimal places (max 2 for currency)
        if amount.as_tuple().exponent < -2:
            return False, f"{field_name} can have at most 2 decimal places"

        return True, None


class LimitValidator:
    """Credit and loan limit validation utilities"""

    @staticmethod
    def validate_credit_limit(
        credit_limit: Decimal,
        current_usage: Decimal = Decimal("0.00")
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate credit limit changes

        Args:
            credit_limit: New credit limit
            current_usage: Current credit usage

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Validate as currency amount
        is_valid, error = CurrencyValidator.validate_amount(
            credit_limit,
            min_value=Decimal("0.00"),
            max_value=Decimal("50000.00"),
            field_name="Credit limit"
        )

        if not is_valid:
            return False, error

        # Cannot set limit below current usage
        if credit_limit < current_usage:
            return False, f"Cannot set credit limit below current usage (${current_usage:,.2f})"

        return True, None

    @staticmethod
    def validate_loan_limit(
        loan_limit: int,
        current_loans: int = 0
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate loan limit changes

        Args:
            loan_limit: New loan limit
            current_loans: Current active loans

        Returns:
            Tuple of (is_valid, error_message)
        """
        if loan_limit < 1:
            return False, "Loan limit must be at least 1"

        if loan_limit > 50:
            return False, "Loan limit cannot exceed 50"

        # Cannot set limit below current active loans
        if loan_limit < current_loans:
            return False, f"Cannot set loan limit below current active loans ({current_loans})"

        return True, None


class ValidationHelper:
    """Helper class for common validation patterns"""

    @staticmethod
    def validate_required_fields(data: Dict, required_fields: list) -> Tuple[bool, Optional[str]]:
        """
        Validate that required fields are present

        Args:
            data: Dictionary to validate
            required_fields: List of required field names

        Returns:
            Tuple of (is_valid, error_message)
        """
        missing_fields = []
        for field in required_fields:
            if field not in data or data[field] is None or data[field] == "":
                missing_fields.append(field)

        if missing_fields:
            return False, f"Missing required fields: {', '.join(missing_fields)}"

        return True, None

    @staticmethod
    def validate_string_length(
        value: str,
        field_name: str,
        min_length: int = 0,
        max_length: int = 255
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate string length

        Args:
            value: String to validate
            field_name: Field name for error messages
            min_length: Minimum allowed length
            max_length: Maximum allowed length

        Returns:
            Tuple of (is_valid, error_message)
        """
        if value is None:
            if min_length > 0:
                return False, f"{field_name} is required"
            return True, None

        length = len(value)

        if length < min_length:
            return False, f"{field_name} must be at least {min_length} characters"

        if length > max_length:
            return False, f"{field_name} cannot exceed {max_length} characters"

        return True, None


# Convenience functions for common validations
def validate_phone_number(phone: str) -> str:
    """
    Validate and clean phone number

    Args:
        phone: Phone number to validate

    Returns:
        Cleaned phone number

    Raises:
        UtilsValidationError: If phone number is invalid
    """
    is_valid, cleaned, error = PhoneValidator.validate(phone)
    if not is_valid:
        raise UtilsValidationError(error)
    return cleaned


def validate_email(email: Optional[str]) -> Optional[str]:
    """
    Validate email

    Args:
        email: Email to validate

    Returns:
        Email (unchanged if valid)

    Raises:
        UtilsValidationError: If email is invalid
    """
    is_valid, error = EmailValidator.validate(email)
    if not is_valid:
        raise UtilsValidationError(error)
    return email


def validate_name(name: str, field_name: str = "Name") -> str:
    """
    Validate name

    Args:
        name: Name to validate
        field_name: Field name for error messages

    Returns:
        Trimmed name

    Raises:
        UtilsValidationError: If name is invalid
    """
    is_valid, error = NameValidator.validate(name, field_name)
    if not is_valid:
        raise UtilsValidationError(error)
    return name.strip()


def validate_notes(notes: Optional[str]) -> Optional[str]:
    """
    Validate notes

    Args:
        notes: Notes to validate

    Returns:
        Trimmed notes

    Raises:
        UtilsValidationError: If notes contain unsafe content
    """
    is_valid, error = NotesValidator.validate(notes)
    if not is_valid:
        raise UtilsValidationError(error)
    return notes.strip() if notes else None
