"""
Timezone Middleware

Extracts client timezone from request headers and makes it available
to all request handlers for dynamic timezone handling.
"""

from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import structlog

# Configure logger
timezone_logger = structlog.get_logger("timezone_middleware")


class TimezoneMiddleware(BaseHTTPMiddleware):
    """
    Middleware to extract and store client timezone information.
    
    Extracts timezone from X-Client-Timezone header sent by frontend
    and stores it in request state for use by business logic.
    """
    
    def __init__(self, app, header_name: str = "X-Client-Timezone"):
        """
        Initialize timezone middleware.
        
        Args:
            app: FastAPI application instance
            header_name: HTTP header name for client timezone
        """
        super().__init__(app)
        self.header_name = header_name
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and extract timezone information.
        
        Args:
            request: Incoming HTTP request
            call_next: Next middleware/endpoint in chain
            
        Returns:
            HTTP response
        """
        # Extract timezone from headers
        client_timezone = (
            request.headers.get(self.header_name) or
            request.headers.get(self.header_name.lower())
        )
        
        # Store timezone in request state
        request.state.client_timezone = client_timezone
        
        # Log timezone information for debugging (skip OPTIONS requests to reduce noise)
        if request.method != "OPTIONS":
            if client_timezone:
                timezone_logger.debug(
                    "🕐 TIMEZONE DETECTED",
                    timezone=client_timezone,
                    path=request.url.path,
                    request_id=getattr(request.state, 'request_id', 'unknown')
                )
            else:
                # Only log warning for non-GET requests (POST/PUT/DELETE need timezone for business logic)
                if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
                    timezone_logger.warning(
                        "⚠️ NO TIMEZONE HEADER",
                        path=request.url.path,
                        method=request.method,
                        request_id=getattr(request.state, 'request_id', 'unknown')
                    )
        
        # Process request
        response = await call_next(request)
        
        return response


def add_timezone_middleware(app, header_name: str = "X-Client-Timezone") -> None:
    """
    Add timezone middleware to FastAPI application.
    
    Args:
        app: FastAPI application instance
        header_name: HTTP header name for client timezone
    """
    app.add_middleware(TimezoneMiddleware, header_name=header_name)
    
    timezone_logger.info(
        "Timezone middleware added",
        header_name=header_name
    )