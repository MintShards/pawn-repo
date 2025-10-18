"""
Unit tests for validation utilities

Tests all validation functions to ensure consistency across schemas.
"""

import pytest
from decimal import Decimal

from app.utils.validation import (
    UtilsValidationError,
    PhoneValidator,
    EmailValidator,
    NameValidator,
    NotesValidator,
    CurrencyValidator,
    LimitValidator,
    ValidationHelper,
    validate_phone_number,
    validate_email,
    validate_name,
    validate_notes
)


class TestPhoneValidator:
    """Test phone number validation"""

    def test_valid_phone_numbers(self):
        """Test valid phone number formats"""
        # Exactly 10 digits
        is_valid, cleaned, error = PhoneValidator.validate("5551234567")
        assert is_valid is True
        assert cleaned == "5551234567"
        assert error is None

    def test_phone_with_formatting(self):
        """Test phone numbers with formatting characters"""
        is_valid, cleaned, error = PhoneValidator.validate("(555) 123-4567")
        assert is_valid is True
        assert cleaned == "5551234567"
        assert error is None

    def test_phone_with_spaces(self):
        """Test phone numbers with spaces"""
        is_valid, cleaned, error = PhoneValidator.validate("555 123 4567")
        assert is_valid is True
        assert cleaned == "5551234567"
        assert error is None

    def test_invalid_phone_too_short(self):
        """Test phone number that's too short"""
        is_valid, cleaned, error = PhoneValidator.validate("123456789")
        assert is_valid is False
        assert cleaned is None
        assert "10 digits" in error

    def test_invalid_phone_too_long(self):
        """Test phone number that's too long"""
        is_valid, cleaned, error = PhoneValidator.validate("12345678901")
        assert is_valid is False
        assert cleaned is None
        assert "10 digits" in error

    def test_invalid_phone_empty(self):
        """Test empty phone number"""
        is_valid, cleaned, error = PhoneValidator.validate("")
        assert is_valid is False
        assert cleaned is None
        assert "required" in error

    def test_phone_format_display(self):
        """Test phone number display formatting"""
        formatted = PhoneValidator.format_display("5551234567")
        assert formatted == "(555) 123-4567"


class TestEmailValidator:
    """Test email validation"""

    def test_valid_email(self):
        """Test valid email addresses"""
        is_valid, error = EmailValidator.validate("user@example.com")
        assert is_valid is True
        assert error is None

    def test_valid_email_with_subdomain(self):
        """Test email with subdomain"""
        is_valid, error = EmailValidator.validate("user@mail.example.com")
        assert is_valid is True
        assert error is None

    def test_valid_email_with_plus(self):
        """Test email with plus sign"""
        is_valid, error = EmailValidator.validate("user+tag@example.com")
        assert is_valid is True
        assert error is None

    def test_email_none(self):
        """Test None email (optional field)"""
        is_valid, error = EmailValidator.validate(None)
        assert is_valid is True
        assert error is None

    def test_email_empty_string(self):
        """Test empty string email (optional field)"""
        is_valid, error = EmailValidator.validate("")
        assert is_valid is True
        assert error is None

    def test_invalid_email_xss_characters(self):
        """Test email with XSS characters"""
        is_valid, error = EmailValidator.validate("user<script>@example.com")
        assert is_valid is False
        assert "invalid characters" in error

    def test_invalid_email_too_long(self):
        """Test email that exceeds length limit"""
        long_email = "a" * 250 + "@example.com"
        is_valid, error = EmailValidator.validate(long_email)
        assert is_valid is False
        assert "too long" in error

    def test_invalid_email_format(self):
        """Test invalid email format"""
        is_valid, error = EmailValidator.validate("notanemail")
        assert is_valid is False
        assert "Invalid email format" in error


class TestNameValidator:
    """Test name validation"""

    def test_valid_name(self):
        """Test valid name"""
        is_valid, error = NameValidator.validate("John", "first_name")
        assert is_valid is True
        assert error is None

    def test_valid_name_with_hyphen(self):
        """Test name with hyphen"""
        is_valid, error = NameValidator.validate("Mary-Jane", "first_name")
        assert is_valid is True
        assert error is None

    def test_valid_name_with_apostrophe(self):
        """Test name with apostrophe"""
        is_valid, error = NameValidator.validate("O'Connor", "last_name")
        assert is_valid is True
        assert error is None

    def test_valid_name_with_period(self):
        """Test name with period"""
        is_valid, error = NameValidator.validate("Dr. Smith", "last_name")
        assert is_valid is True
        assert error is None

    def test_valid_name_unicode(self):
        """Test international name with unicode"""
        is_valid, error = NameValidator.validate("José", "first_name")
        assert is_valid is True
        assert error is None

    def test_invalid_name_empty(self):
        """Test empty name"""
        is_valid, error = NameValidator.validate("", "first_name")
        assert is_valid is False
        assert "cannot be empty" in error

    def test_invalid_name_whitespace_only(self):
        """Test name with only whitespace"""
        is_valid, error = NameValidator.validate("   ", "first_name")
        assert is_valid is False
        assert "cannot be empty" in error

    def test_invalid_name_too_long(self):
        """Test name that's too long"""
        is_valid, error = NameValidator.validate("a" * 51, "first_name")
        assert is_valid is False
        assert "between 1 and 50 characters" in error


class TestNotesValidator:
    """Test notes validation"""

    def test_valid_notes(self):
        """Test valid notes"""
        is_valid, error = NotesValidator.validate("Customer prefers cash transactions")
        assert is_valid is True
        assert error is None

    def test_notes_none(self):
        """Test None notes (optional field)"""
        is_valid, error = NotesValidator.validate(None)
        assert is_valid is True
        assert error is None

    def test_invalid_notes_html_tags(self):
        """Test notes with HTML tags"""
        is_valid, error = NotesValidator.validate("Customer note <script>alert('xss')</script>")
        assert is_valid is False
        assert "HTML tags" in error

    def test_invalid_notes_javascript(self):
        """Test notes with JavaScript"""
        is_valid, error = NotesValidator.validate("javascript:alert('xss')")
        assert is_valid is False
        assert "unsafe content" in error

    def test_invalid_notes_too_long(self):
        """Test notes that exceed length limit"""
        is_valid, error = NotesValidator.validate("a" * 1001)
        assert is_valid is False
        assert "1000 characters" in error


class TestCurrencyValidator:
    """Test currency validation"""

    def test_valid_amount(self):
        """Test valid currency amount"""
        is_valid, error = CurrencyValidator.validate_amount(
            Decimal("100.50"),
            field_name="Loan amount"
        )
        assert is_valid is True
        assert error is None

    def test_valid_amount_zero(self):
        """Test zero amount"""
        is_valid, error = CurrencyValidator.validate_amount(
            Decimal("0.00"),
            field_name="Amount"
        )
        assert is_valid is True
        assert error is None

    def test_invalid_amount_negative(self):
        """Test negative amount"""
        is_valid, error = CurrencyValidator.validate_amount(
            Decimal("-10.00"),
            field_name="Amount"
        )
        assert is_valid is False
        assert "at least" in error

    def test_invalid_amount_too_many_decimals(self):
        """Test amount with too many decimal places"""
        is_valid, error = CurrencyValidator.validate_amount(
            Decimal("100.123"),
            field_name="Amount"
        )
        assert is_valid is False
        assert "2 decimal places" in error

    def test_invalid_amount_exceeds_max(self):
        """Test amount exceeding maximum"""
        is_valid, error = CurrencyValidator.validate_amount(
            Decimal("2000000.00"),
            max_value=Decimal("1000000.00"),
            field_name="Amount"
        )
        assert is_valid is False
        assert "cannot exceed" in error


class TestLimitValidator:
    """Test credit and loan limit validation"""

    def test_valid_credit_limit(self):
        """Test valid credit limit"""
        is_valid, error = LimitValidator.validate_credit_limit(
            Decimal("5000.00")
        )
        assert is_valid is True
        assert error is None

    def test_invalid_credit_limit_below_usage(self):
        """Test credit limit below current usage"""
        is_valid, error = LimitValidator.validate_credit_limit(
            Decimal("1000.00"),
            current_usage=Decimal("2000.00")
        )
        assert is_valid is False
        assert "below current usage" in error

    def test_valid_loan_limit(self):
        """Test valid loan limit"""
        is_valid, error = LimitValidator.validate_loan_limit(5)
        assert is_valid is True
        assert error is None

    def test_invalid_loan_limit_too_low(self):
        """Test loan limit below minimum"""
        is_valid, error = LimitValidator.validate_loan_limit(0)
        assert is_valid is False
        assert "at least 1" in error

    def test_invalid_loan_limit_too_high(self):
        """Test loan limit above maximum"""
        is_valid, error = LimitValidator.validate_loan_limit(51)
        assert is_valid is False
        assert "cannot exceed 50" in error

    def test_invalid_loan_limit_below_current(self):
        """Test loan limit below current active loans"""
        is_valid, error = LimitValidator.validate_loan_limit(
            3,
            current_loans=5
        )
        assert is_valid is False
        assert "below current active loans" in error


class TestValidationHelper:
    """Test validation helper utilities"""

    def test_validate_required_fields_success(self):
        """Test required fields validation with all fields present"""
        data = {"name": "John", "email": "john@example.com", "age": 30}
        is_valid, error = ValidationHelper.validate_required_fields(
            data,
            ["name", "email"]
        )
        assert is_valid is True
        assert error is None

    def test_validate_required_fields_missing(self):
        """Test required fields validation with missing fields"""
        data = {"name": "John"}
        is_valid, error = ValidationHelper.validate_required_fields(
            data,
            ["name", "email", "age"]
        )
        assert is_valid is False
        assert "Missing required fields" in error
        assert "email" in error
        assert "age" in error

    def test_validate_string_length_valid(self):
        """Test string length validation with valid length"""
        is_valid, error = ValidationHelper.validate_string_length(
            "Hello",
            "greeting",
            min_length=1,
            max_length=10
        )
        assert is_valid is True
        assert error is None

    def test_validate_string_length_too_short(self):
        """Test string length validation with string too short"""
        is_valid, error = ValidationHelper.validate_string_length(
            "Hi",
            "message",
            min_length=5
        )
        assert is_valid is False
        assert "at least 5 characters" in error

    def test_validate_string_length_too_long(self):
        """Test string length validation with string too long"""
        is_valid, error = ValidationHelper.validate_string_length(
            "a" * 300,
            "message",
            max_length=255
        )
        assert is_valid is False
        assert "cannot exceed 255 characters" in error


class TestConvenienceFunctions:
    """Test convenience wrapper functions"""

    def test_validate_phone_number_success(self):
        """Test phone number validation convenience function"""
        result = validate_phone_number("5551234567")
        assert result == "5551234567"

    def test_validate_phone_number_with_formatting(self):
        """Test phone number validation with formatting"""
        result = validate_phone_number("(555) 123-4567")
        assert result == "5551234567"

    def test_validate_phone_number_invalid(self):
        """Test phone number validation with invalid input"""
        with pytest.raises(UtilsValidationError) as exc_info:
            validate_phone_number("12345")
        assert "10 digits" in str(exc_info.value)

    def test_validate_email_success(self):
        """Test email validation convenience function"""
        result = validate_email("user@example.com")
        assert result == "user@example.com"

    def test_validate_email_none(self):
        """Test email validation with None (optional)"""
        result = validate_email(None)
        assert result is None

    def test_validate_email_invalid(self):
        """Test email validation with invalid input"""
        with pytest.raises(UtilsValidationError) as exc_info:
            validate_email("user<script>@example.com")
        assert "invalid characters" in str(exc_info.value)

    def test_validate_name_success(self):
        """Test name validation convenience function"""
        result = validate_name("John", "first_name")
        assert result == "John"

    def test_validate_name_strips_whitespace(self):
        """Test name validation strips whitespace"""
        result = validate_name("  John  ", "first_name")
        assert result == "John"

    def test_validate_name_invalid(self):
        """Test name validation with invalid input"""
        with pytest.raises(UtilsValidationError) as exc_info:
            validate_name("", "first_name")
        assert "cannot be empty" in str(exc_info.value)

    def test_validate_notes_success(self):
        """Test notes validation convenience function"""
        result = validate_notes("Customer prefers cash")
        assert result == "Customer prefers cash"

    def test_validate_notes_none(self):
        """Test notes validation with None (optional)"""
        result = validate_notes(None)
        assert result is None

    def test_validate_notes_invalid(self):
        """Test notes validation with invalid input"""
        with pytest.raises(UtilsValidationError) as exc_info:
            validate_notes("<script>alert('xss')</script>")
        assert "HTML tags" in str(exc_info.value)


class TestEdgeCases:
    """Test edge cases and boundary conditions"""

    def test_phone_number_all_zeros(self):
        """Test phone number with all zeros"""
        is_valid, cleaned, error = PhoneValidator.validate("0000000000")
        assert is_valid is True
        assert cleaned == "0000000000"

    def test_name_exactly_50_characters(self):
        """Test name at maximum length boundary"""
        name_50 = "a" * 50
        is_valid, error = NameValidator.validate(name_50, "name")
        assert is_valid is True

    def test_name_exactly_51_characters(self):
        """Test name just over maximum length"""
        name_51 = "a" * 51
        is_valid, error = NameValidator.validate(name_51, "name")
        assert is_valid is False

    def test_notes_exactly_1000_characters(self):
        """Test notes at maximum length boundary"""
        notes_1000 = "a" * 1000
        is_valid, error = NotesValidator.validate(notes_1000)
        assert is_valid is True

    def test_notes_exactly_1001_characters(self):
        """Test notes just over maximum length"""
        notes_1001 = "a" * 1001
        is_valid, error = NotesValidator.validate(notes_1001)
        assert is_valid is False

    def test_email_exactly_254_characters(self):
        """Test email at RFC 5321 length limit"""
        # Create email exactly 254 characters
        local_part = "a" * 240
        email_254 = f"{local_part}@example.com"
        is_valid, error = EmailValidator.validate(email_254)
        assert is_valid is True

    def test_credit_limit_at_boundaries(self):
        """Test credit limit at exact boundaries"""
        # Minimum
        is_valid, _ = LimitValidator.validate_credit_limit(Decimal("0.00"))
        assert is_valid is True

        # Maximum
        is_valid, _ = LimitValidator.validate_credit_limit(Decimal("50000.00"))
        assert is_valid is True
