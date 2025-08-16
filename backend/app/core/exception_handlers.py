"""
Global Exception Handlers

Provides centralized exception handling for all API endpoints with
security-conscious error responses, detailed logging, and request tracking.
"""

import traceback
import uuid
from datetime import datetime, UTC
from typing import Any, Dict

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import structlog

from app.core.exceptions import (
    PawnShopException, ValidationError, AuthenticationError, AuthorizationError,
    TransactionNotFoundError, CustomerNotFoundError, PaymentError, ExtensionError,
    BusinessRuleError, DatabaseError, RateLimitError, SecurityError,
    ConfigurationError, ExternalServiceError, get_http_status_for_exception
)

# Configure structured logging
exception_handler_logger = structlog.get_logger("exception_handler")


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Global exception handler for all unhandled exceptions.
    
    Provides secure error responses with detailed logging while preventing
    sensitive information exposure to clients.
    
    Args:
        request: FastAPI request object
        exc: Unhandled exception
        
    Returns:
        Standardized JSON error response
    """
    # Generate unique request ID if not present
    request_id = getattr(request.state, 'request_id', str(uuid.uuid4()))
    
    # Extract request context for logging
    request_context = {
        "request_id": request_id,
        "method": request.method,
        "url": str(request.url),
        "path": request.url.path,
        "client_ip": getattr(request.client, 'host', 'unknown') if request.client else 'unknown',
        "user_agent": request.headers.get('user-agent', 'unknown'),
        "timestamp": datetime.now(UTC).isoformat(),
        "exception_type": type(exc).__name__,
        "exception_message": str(exc)
    }
    
    # Log the exception with full context
    exception_handler_logger.error(
        "Unhandled exception occurred",
        **request_context,
        traceback=traceback.format_exc()
    )
    
    # Return sanitized error response
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred. Please try again later or contact support.",
            "error_code": "INTERNAL_ERROR",
            "request_id": request_id,
            "timestamp": request_context["timestamp"]
        }
    )


async def pawn_shop_exception_handler(request: Request, exc: PawnShopException) -> JSONResponse:
    """
    Handler for all custom pawn shop exceptions.
    
    Provides consistent error response format with appropriate HTTP status codes
    and security-conscious error details.
    
    Args:
        request: FastAPI request object
        exc: PawnShopException instance
        
    Returns:
        Standardized JSON error response
    """
    request_id = getattr(request.state, 'request_id', str(uuid.uuid4()))
    
    # Get appropriate HTTP status code
    status_code = get_http_status_for_exception(exc)
    
    # Log exception with appropriate level
    log_context = {
        "request_id": request_id,
        "method": request.method,
        "url": str(request.url),
        "client_ip": getattr(request.client, 'host', 'unknown') if request.client else 'unknown',
        "exception_type": type(exc).__name__,
        "error_code": exc.error_code,
        "message": exc.message,
        "details": exc.details,
        "timestamp": datetime.now(UTC).isoformat()
    }
    
    # Log with appropriate level based on exception severity
    if status_code >= 500:
        exception_handler_logger.error("Server error occurred", **log_context)
    elif status_code >= 400:
        exception_handler_logger.warning("Client error occurred", **log_context)
    else:
        exception_handler_logger.info("Exception handled", **log_context)
    
    # Prepare response content
    response_content = {
        "error": exc.__class__.__name__,
        "message": exc.message,
        "error_code": exc.error_code,
        "request_id": request_id,
        "timestamp": log_context["timestamp"]
    }
    
    # Include details for client errors (400-499) but not server errors
    if 400 <= status_code < 500 and exc.details:
        response_content["details"] = exc.details
    
    return JSONResponse(
        status_code=status_code,
        content=response_content
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Handler for Pydantic validation errors.
    
    Converts Pydantic validation errors to consistent format with
    detailed field-level error information.
    
    Args:
        request: FastAPI request object
        exc: RequestValidationError from Pydantic
        
    Returns:
        Standardized JSON validation error response
    """
    request_id = getattr(request.state, 'request_id', str(uuid.uuid4()))
    
    # Extract validation errors
    validation_errors = []
    for error in exc.errors():
        field_path = ".".join(str(loc) for loc in error["loc"])
        validation_errors.append({
            "field": field_path,
            "message": error["msg"],
            "type": error["type"],
            "input": error.get("input")
        })
    
    # Log validation error
    exception_handler_logger.info(
        "Validation error occurred",
        request_id=request_id,
        method=request.method,
        url=str(request.url),
        client_ip=getattr(request.client, 'host', 'unknown') if request.client else 'unknown',
        validation_errors=validation_errors,
        timestamp=datetime.now(UTC).isoformat()
    )
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "ValidationError",
            "message": "Input validation failed",
            "error_code": "VALIDATION_FAILED",
            "details": {
                "validation_errors": validation_errors,
                "error_count": len(validation_errors)
            },
            "request_id": request_id,
            "timestamp": datetime.now(UTC).isoformat()
        }
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Handler for FastAPI HTTP exceptions.
    
    Standardizes HTTP exception responses while preserving original
    status codes and adding request tracking.
    
    Args:
        request: FastAPI request object
        exc: HTTPException instance
        
    Returns:
        Standardized JSON error response
    """
    request_id = getattr(request.state, 'request_id', str(uuid.uuid4()))
    
    # Log HTTP exception
    log_level = "warning" if exc.status_code < 500 else "error"
    getattr(exception_handler_logger, log_level)(
        "HTTP exception occurred",
        request_id=request_id,
        method=request.method,
        url=str(request.url),
        client_ip=getattr(request.client, 'host', 'unknown') if request.client else 'unknown',
        status_code=exc.status_code,
        detail=exc.detail,
        timestamp=datetime.now(UTC).isoformat()
    )
    
    # Determine error message based on status code
    status_messages = {
        400: "Bad request",
        401: "Authentication required",
        403: "Access forbidden",
        404: "Resource not found",
        405: "Method not allowed",
        409: "Conflict",
        422: "Unprocessable entity",
        429: "Too many requests",
        500: "Internal server error",
        502: "Bad gateway",
        503: "Service unavailable",
        504: "Gateway timeout"
    }
    
    error_message = status_messages.get(exc.status_code, "HTTP error")
    
    response_content = {
        "error": f"HTTP{exc.status_code}Error",
        "message": error_message,
        "error_code": f"HTTP_{exc.status_code}",
        "request_id": request_id,
        "timestamp": datetime.now(UTC).isoformat()
    }
    
    # Include detail for client errors, but sanitize for server errors
    if exc.detail and exc.status_code < 500:
        if isinstance(exc.detail, dict):
            response_content["details"] = exc.detail
        else:
            response_content["details"] = {"message": str(exc.detail)}
    
    return JSONResponse(
        status_code=exc.status_code,
        content=response_content
    )


async def starlette_http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """
    Handler for Starlette HTTP exceptions.
    
    Handles lower-level HTTP exceptions from Starlette with
    consistent response formatting.
    
    Args:
        request: FastAPI request object
        exc: StarletteHTTPException instance
        
    Returns:
        Standardized JSON error response
    """
    request_id = getattr(request.state, 'request_id', str(uuid.uuid4()))
    
    # Log Starlette HTTP exception
    exception_handler_logger.warning(
        "Starlette HTTP exception occurred",
        request_id=request_id,
        method=request.method,
        url=str(request.url),
        client_ip=getattr(request.client, 'host', 'unknown') if request.client else 'unknown',
        status_code=exc.status_code,
        detail=exc.detail,
        timestamp=datetime.now(UTC).isoformat()
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": f"HTTP{exc.status_code}Error",
            "message": "Request could not be processed",
            "error_code": f"HTTP_{exc.status_code}",
            "request_id": request_id,
            "timestamp": datetime.now(UTC).isoformat()
        }
    )


# Dictionary mapping exception types to their handlers for easy registration
EXCEPTION_HANDLERS = {
    # Custom pawn shop exceptions
    PawnShopException: pawn_shop_exception_handler,
    ValidationError: pawn_shop_exception_handler,
    AuthenticationError: pawn_shop_exception_handler,
    AuthorizationError: pawn_shop_exception_handler,
    TransactionNotFoundError: pawn_shop_exception_handler,
    CustomerNotFoundError: pawn_shop_exception_handler,
    PaymentError: pawn_shop_exception_handler,
    ExtensionError: pawn_shop_exception_handler,
    BusinessRuleError: pawn_shop_exception_handler,
    DatabaseError: pawn_shop_exception_handler,
    RateLimitError: pawn_shop_exception_handler,
    SecurityError: pawn_shop_exception_handler,
    ConfigurationError: pawn_shop_exception_handler,
    ExternalServiceError: pawn_shop_exception_handler,
    
    # FastAPI/Starlette exceptions
    RequestValidationError: validation_exception_handler,
    HTTPException: http_exception_handler,
    StarletteHTTPException: starlette_http_exception_handler,
    
    # Global catch-all
    Exception: global_exception_handler
}


def register_exception_handlers(app) -> None:
    """
    Register all exception handlers with the FastAPI application.
    
    Args:
        app: FastAPI application instance
    """
    for exception_type, handler in EXCEPTION_HANDLERS.items():
        app.add_exception_handler(exception_type, handler)
    
    exception_handler_logger.info(
        "Exception handlers registered",
        handler_count=len(EXCEPTION_HANDLERS),
        handlers=list(EXCEPTION_HANDLERS.keys())
    )