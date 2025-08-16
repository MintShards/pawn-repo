"""
Request ID Middleware

Provides unique request identification for error tracking, debugging,
and request correlation across the application stack.
"""

import uuid
import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import structlog

# Configure logger for request tracking
request_logger = structlog.get_logger("request_middleware")


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add unique request IDs and basic request tracking.
    
    Features:
    - Generates unique UUID for each request
    - Adds request ID to response headers
    - Tracks request duration
    - Logs request/response information
    - Handles request correlation for error tracking
    """
    
    def __init__(
        self,
        app,
        header_name: str = "X-Request-ID",
        generate_request_id: Callable[[], str] = None
    ):
        """
        Initialize request ID middleware.
        
        Args:
            app: FastAPI application instance
            header_name: HTTP header name for request ID
            generate_request_id: Function to generate request IDs
        """
        super().__init__(app)
        self.header_name = header_name
        self.generate_request_id = generate_request_id or self._default_request_id_generator
    
    def _default_request_id_generator(self) -> str:
        """Generate default UUID-based request ID."""
        return str(uuid.uuid4())
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request with ID tracking and logging.
        
        Args:
            request: Incoming HTTP request
            call_next: Next middleware/endpoint in chain
            
        Returns:
            HTTP response with added request ID header
        """
        # Generate or extract request ID
        request_id = (
            request.headers.get(self.header_name) or 
            request.headers.get(self.header_name.lower()) or
            self.generate_request_id()
        )
        
        # Store request ID in request state for access by handlers
        request.state.request_id = request_id
        
        # Record request start time
        start_time = time.time()
        
        # Extract request information for logging
        request_info = {
            "request_id": request_id,
            "method": request.method,
            "url": str(request.url),
            "path": request.url.path,
            "query_params": str(request.query_params) if request.query_params else None,
            "client_ip": self._get_client_ip(request),
            "user_agent": request.headers.get("user-agent", "unknown"),
            "content_type": request.headers.get("content-type"),
            "content_length": request.headers.get("content-length")
        }
        
        # Log incoming request
        request_logger.info(
            "Request started",
            **request_info
        )
        
        try:
            # Process request through the application
            response = await call_next(request)
            
            # Calculate request duration
            duration_ms = round((time.time() - start_time) * 1000, 2)
            
            # Add request ID to response headers
            response.headers[self.header_name] = request_id
            
            # Log successful response
            request_logger.info(
                "Request completed",
                request_id=request_id,
                status_code=response.status_code,
                duration_ms=duration_ms,
                response_size=response.headers.get("content-length")
            )
            
            return response
            
        except Exception as exc:
            # Calculate duration even for failed requests
            duration_ms = round((time.time() - start_time) * 1000, 2)
            
            # Log failed request
            request_logger.error(
                "Request failed",
                request_id=request_id,
                exception_type=type(exc).__name__,
                exception_message=str(exc),
                duration_ms=duration_ms
            )
            
            # Re-raise the exception to be handled by exception handlers
            raise
    
    def _get_client_ip(self, request: Request) -> str:
        """
        Extract client IP address from request with proxy support.
        
        Args:
            request: HTTP request object
            
        Returns:
            Client IP address string
        """
        # Check forwarded headers for proxy setups
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # Take the first IP in the chain
            return forwarded_for.split(",")[0].strip()
        
        # Check other proxy headers
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
        
        # Fallback to direct connection IP
        if request.client:
            return request.client.host
        
        return "unknown"


# Convenience function for simple middleware setup
def add_request_id_middleware(
    app,
    header_name: str = "X-Request-ID",
    generate_request_id: Callable[[], str] = None
) -> None:
    """
    Add request ID middleware to FastAPI application.
    
    Args:
        app: FastAPI application instance
        header_name: HTTP header name for request ID
        generate_request_id: Custom request ID generator function
    """
    app.add_middleware(
        RequestIDMiddleware,
        header_name=header_name,
        generate_request_id=generate_request_id
    )
    
    request_logger.info(
        "Request ID middleware added",
        header_name=header_name
    )


# Alternative simple middleware function for basic setups
async def simple_request_id_middleware(request: Request, call_next: Callable) -> Response:
    """
    Simple request ID middleware function (alternative to class-based middleware).
    
    Args:
        request: HTTP request object
        call_next: Next middleware/endpoint in chain
        
    Returns:
        HTTP response with request ID header
    """
    # Generate request ID
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    # Process request
    response = await call_next(request)
    
    # Add request ID to response
    response.headers["X-Request-ID"] = request_id
    
    return response