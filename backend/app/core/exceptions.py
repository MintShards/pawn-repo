"""
Centralized Exception Classes

Provides a hierarchy of custom exceptions for consistent error handling
across the pawn shop management system with security-conscious design.
"""

from typing import Any, Dict, Optional
import structlog

# Configure logger for exception tracking
exception_logger = structlog.get_logger("exceptions")


class PawnShopException(Exception):
    """
    Base exception for pawn shop operations.
    
    Provides structured error information with security-conscious
    message handling and optional error codes for client integration.
    """
    
    def __init__(
        self, 
        message: str, 
        error_code: str = None, 
        details: Dict[str, Any] = None,
        log_level: str = "warning"
    ):
        """
        Initialize pawn shop exception.
        
        Args:
            message: User-friendly error message
            error_code: Machine-readable error code
            details: Additional error context (sanitized)
            log_level: Logging level for this exception
        """
        self.message = message
        self.error_code = error_code or self.__class__.__name__.upper()
        self.details = self._sanitize_details(details or {})
        self.log_level = log_level
        
        # Log exception creation with context
        getattr(exception_logger, log_level)(
            f"Exception created: {self.__class__.__name__}",
            message=message,
            error_code=self.error_code,
            details=self.details
        )
        
        super().__init__(self.message)
    
    def _sanitize_details(self, details: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize error details to prevent sensitive information exposure.
        
        Args:
            details: Raw error details
            
        Returns:
            Sanitized error details safe for client consumption
        """
        if not details:
            return {}
        
        # List of sensitive keys that should never be exposed
        sensitive_keys = {
            'password', 'pin', 'token', 'secret', 'key', 'auth',
            'credential', 'session', 'cookie', 'hash', 'salt'
        }
        
        sanitized = {}
        for key, value in details.items():
            # Skip sensitive keys
            if any(sensitive in key.lower() for sensitive in sensitive_keys):
                sanitized[key] = "[REDACTED]"
                continue
            
            # Sanitize string values
            if isinstance(value, str) and len(value) > 100:
                sanitized[key] = value[:97] + "..."
            else:
                sanitized[key] = value
        
        return sanitized
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for API responses."""
        return {
            "error": self.__class__.__name__,
            "message": self.message,
            "error_code": self.error_code,
            "details": self.details
        }


class ValidationError(PawnShopException):
    """Raised when input validation fails."""
    
    def __init__(self, message: str, error_code: str = None, details: Dict[str, Any] = None):
        super().__init__(message, error_code or "VALIDATION_ERROR", details, log_level="info")


class AuthenticationError(PawnShopException):
    """Raised when authentication fails."""
    
    def __init__(self, message: str = "Authentication failed", error_code: str = None, details: Dict[str, Any] = None):
        super().__init__(
            message, 
            error_code or "AUTH_FAILED", 
            details,
            log_level="warning"
        )


class AuthorizationError(PawnShopException):
    """Raised when user lacks required permissions."""
    
    def __init__(self, message: str = "Access denied", error_code: str = None, details: Dict[str, Any] = None):
        super().__init__(
            message,
            error_code or "ACCESS_DENIED",
            details,
            log_level="warning"
        )


class TransactionNotFoundError(PawnShopException):
    """Raised when pawn transaction is not found."""
    
    def __init__(self, transaction_id: str, error_code: str = None, details: Dict[str, Any] = None):
        message = f"Transaction not found"
        # Include transaction ID in details, not message for security
        transaction_details = {"transaction_id": transaction_id}
        if details:
            transaction_details.update(details)
        
        super().__init__(
            message,
            error_code or "TRANSACTION_NOT_FOUND",
            transaction_details,
            log_level="info"
        )


class CustomerNotFoundError(PawnShopException):
    """Raised when customer is not found."""
    
    def __init__(self, customer_id: str, error_code: str = None, details: Dict[str, Any] = None):
        message = f"Customer not found"
        # Include customer ID in details, not message
        customer_details = {"customer_id": customer_id}
        if details:
            customer_details.update(details)
        
        super().__init__(
            message,
            error_code or "CUSTOMER_NOT_FOUND",
            customer_details,
            log_level="info"
        )


class PaymentError(PawnShopException):
    """Raised when payment processing fails."""
    
    def __init__(self, message: str, error_code: str = None, details: Dict[str, Any] = None):
        super().__init__(
            message,
            error_code or "PAYMENT_ERROR",
            details,
            log_level="error"
        )


class ExtensionError(PawnShopException):
    """Raised when loan extension fails."""
    
    def __init__(self, message: str, error_code: str = None, details: Dict[str, Any] = None):
        super().__init__(
            message,
            error_code or "EXTENSION_ERROR",
            details,
            log_level="warning"
        )


class BusinessRuleError(PawnShopException):
    """Raised when business rules are violated."""
    
    def __init__(self, message: str, error_code: str = None, details: Dict[str, Any] = None):
        super().__init__(
            message,
            error_code or "BUSINESS_RULE_ERROR",
            details,
            log_level="info"
        )


class DatabaseError(PawnShopException):
    """Raised when database operations fail."""
    
    def __init__(self, message: str = "Database operation failed", error_code: str = None, details: Dict[str, Any] = None):
        super().__init__(
            message,
            error_code or "DATABASE_ERROR",
            details,
            log_level="error"
        )


class RateLimitError(PawnShopException):
    """Raised when rate limits are exceeded."""
    
    def __init__(self, message: str = "Rate limit exceeded", error_code: str = None, details: Dict[str, Any] = None):
        super().__init__(
            message,
            error_code or "RATE_LIMIT_EXCEEDED",
            details,
            log_level="warning"
        )


class SecurityError(PawnShopException):
    """Raised when security violations are detected."""
    
    def __init__(self, message: str = "Security violation detected", error_code: str = None, details: Dict[str, Any] = None):
        super().__init__(
            message,
            error_code or "SECURITY_VIOLATION",
            details,
            log_level="error"
        )


class ConfigurationError(PawnShopException):
    """Raised when system configuration issues are detected."""
    
    def __init__(self, message: str, error_code: str = None, details: Dict[str, Any] = None):
        super().__init__(
            message,
            error_code or "CONFIG_ERROR",
            details,
            log_level="error"
        )


class ExternalServiceError(PawnShopException):
    """Raised when external service calls fail."""
    
    def __init__(self, service_name: str, message: str = None, error_code: str = None, details: Dict[str, Any] = None):
        default_message = f"External service unavailable"
        service_details = {"service_name": service_name}
        if details:
            service_details.update(details)
        
        super().__init__(
            message or default_message,
            error_code or "EXTERNAL_SERVICE_ERROR",
            service_details,
            log_level="error"
        )


# Exception mapping for common HTTP status codes
EXCEPTION_STATUS_MAP = {
    ValidationError: 400,
    AuthenticationError: 401,
    AuthorizationError: 403,
    TransactionNotFoundError: 404,
    CustomerNotFoundError: 404,
    BusinessRuleError: 422,
    PaymentError: 422,
    ExtensionError: 422,
    RateLimitError: 429,
    DatabaseError: 500,
    SecurityError: 403,
    ConfigurationError: 500,
    ExternalServiceError: 503,
}


def get_http_status_for_exception(exception: Exception) -> int:
    """
    Get appropriate HTTP status code for exception type.
    
    Args:
        exception: Exception instance
        
    Returns:
        HTTP status code
    """
    return EXCEPTION_STATUS_MAP.get(type(exception), 500)