"""
Security middleware for production deployment
Includes rate limiting, security headers, and request logging
"""

import time
from typing import Optional
from fastapi import Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import redis
import structlog

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

# Get security logger
security_logger = structlog.get_logger("security")

class SecurityConfig:
    """Security configuration constants"""
    
    # Rate limiting settings - Environment configurable
    LOGIN_RATE_LIMIT = "3/minute"  # 3 login attempts per minute (stricter)
    API_RATE_LIMIT = "60/minute"   # 60 API calls per minute (more conservative)
    STRICT_RATE_LIMIT = "5/minute"  # 5 requests per minute for sensitive endpoints
    ADMIN_RATE_LIMIT = "30/minute"  # 30 requests per minute for admin endpoints
    
    # Production rate limits (more restrictive)
    PROD_LOGIN_RATE_LIMIT = "2/minute"
    PROD_API_RATE_LIMIT = "30/minute"
    PROD_STRICT_RATE_LIMIT = "3/minute"
    
    # Security headers
    SECURITY_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
    }

# Initialize Redis connection for rate limiting with enhanced configuration
def initialize_rate_limiter():
    """Initialize rate limiter with Redis connection testing"""
    from app.core.config import settings
    
    # Get Redis URL from settings
    redis_url = getattr(settings, 'REDIS_URL', 'redis://localhost:6379')
    
    try:
        # Test Redis connection with timeout
        redis_client = redis.from_url(redis_url, decode_responses=True, socket_timeout=2)
        redis_client.ping()
        
        # Log successful Redis connection
        security_logger.info("Redis connection established", redis_url=redis_url)
        
        # Create rate limiter with Redis backend
        limiter = Limiter(
            key_func=get_remote_address,
            storage_uri=redis_url,
            default_limits=["500/day", "100/hour"],
            strategy="fixed-window"
        )
        
        # Test rate limiter functionality
        test_key = "test_rate_limit"
        limiter.reset(test_key)
        security_logger.info("Rate limiter initialized with Redis backend")
        
        return limiter, True
        
    except (redis.ConnectionError, redis.RedisError, redis.TimeoutError) as e:
        # Fallback to in-memory rate limiting
        security_logger.warning(
            "Redis connection failed, using in-memory rate limiting",
            error=str(e),
            redis_url=redis_url
        )
        
        limiter = Limiter(
            key_func=get_remote_address,
            default_limits=["500/day", "100/hour"],
            strategy="fixed-window"
        )
        
        return limiter, False

# Initialize rate limiter
rate_limiter, redis_available = initialize_rate_limiter()

class SecurityHeadersMiddleware:
    """Middleware to add security headers to all responses"""
    
    def __init__(self, app, headers: dict = None):
        self.app = app
        self.headers = headers or SecurityConfig.SECURITY_HEADERS
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            async def send_wrapper(message):
                if message["type"] == "http.response.start":
                    headers = list(message.get("headers", []))
                    for name, value in self.headers.items():
                        headers.append([name.encode(), value.encode()])
                    message["headers"] = headers
                await send(message)
            await self.app(scope, receive, send_wrapper)
        else:
            await self.app(scope, receive, send)

class SecurityLoggingMiddleware:
    """Middleware for comprehensive security logging"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        request_start_time = time.time()
        client_ip = self._get_client_ip(scope)
        method = scope["method"]
        path = scope["path"]
        
        # Log incoming request
        security_logger.info(
            "request_received",
            method=method,
            path=path,
            client_ip=client_ip,
            user_agent=self._get_user_agent(scope)
        )
        
        status_code = 500  # Default in case of exception
        
        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)
        
        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as e:
            # Log unhandled exceptions
            security_logger.error(
                "unhandled_exception",
                method=method,
                path=path,
                client_ip=client_ip,
                error=str(e),
                exception_type=type(e).__name__
            )
            raise
        finally:
            # Log response
            duration = time.time() - request_start_time
            
            # Log security-relevant events
            if status_code == 401:
                security_logger.warning(
                    "authentication_failed",
                    method=method,
                    path=path,
                    client_ip=client_ip,
                    status_code=status_code,
                    duration_ms=duration * 1000
                )
            elif status_code == 403:
                security_logger.warning(
                    "authorization_failed",
                    method=method,
                    path=path,
                    client_ip=client_ip,
                    status_code=status_code,
                    duration_ms=duration * 1000
                )
            elif status_code == 429:
                security_logger.warning(
                    "rate_limit_exceeded",
                    method=method,
                    path=path,
                    client_ip=client_ip,
                    status_code=status_code,
                    duration_ms=duration * 1000
                )
            elif path in ["/api/v1/auth/jwt/login", "/api/v1/user/login"]:
                # Log all login attempts
                success = status_code == 200
                security_logger.info(
                    "login_attempt",
                    method=method,
                    path=path,
                    client_ip=client_ip,
                    status_code=status_code,
                    success=success,
                    duration_ms=duration * 1000
                )
                
                # Record authentication attempt in monitoring system
                try:
                    from app.core.monitoring import record_auth_attempt
                    result = "success" if success else "failed"
                    record_auth_attempt(result)
                except ImportError:
                    pass
            else:
                security_logger.debug(
                    "request_completed",
                    method=method,
                    path=path,
                    client_ip=client_ip,
                    status_code=status_code,
                    duration_ms=duration * 1000
                )
    
    def _get_client_ip(self, scope) -> str:
        """Extract client IP from request scope"""
        headers = dict(scope.get("headers", []))
        
        # Check for forwarded headers (when behind proxy)
        if b"x-forwarded-for" in headers:
            return headers[b"x-forwarded-for"].decode().split(",")[0].strip()
        elif b"x-real-ip" in headers:
            return headers[b"x-real-ip"].decode()
        
        # Fallback to direct connection IP
        client = scope.get("client", ["unknown", 0])
        return client[0] if client else "unknown"
    
    def _get_user_agent(self, scope) -> str:
        """Extract User-Agent from request scope"""
        headers = dict(scope.get("headers", []))
        user_agent = headers.get(b"user-agent", b"unknown").decode()
        return user_agent

# Rate limit decorators for different endpoint types
def auth_rate_limit():
    """Rate limiter for authentication endpoints"""
    return rate_limiter.limit(SecurityConfig.LOGIN_RATE_LIMIT)

def api_rate_limit():
    """Rate limiter for general API endpoints"""
    return rate_limiter.limit(SecurityConfig.API_RATE_LIMIT)

def strict_rate_limit():
    """Rate limiter for sensitive endpoints"""
    return rate_limiter.limit(SecurityConfig.STRICT_RATE_LIMIT)

# Custom rate limit exceeded handler
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Custom handler for rate limit exceeded"""
    client_ip = get_remote_address(request)
    
    # Calculate retry_after based on rate limit (default to 60 seconds)
    retry_after = 60
    if exc.limit and hasattr(exc.limit, 'limit'):
        # Extract time window from rate limit string (e.g., "3/minute" -> 60)
        limit_str = str(exc.limit.limit)
        if '/minute' in limit_str:
            retry_after = 60
        elif '/second' in limit_str:
            retry_after = 1
        elif '/hour' in limit_str:
            retry_after = 3600
    
    # Log rate limit event (without accessing non-existent retry_after)
    security_logger.warning(
        "rate_limit_exceeded",
        client_ip=client_ip,
        path=str(request.url.path),
        limit_type=str(exc.limit.limit) if exc.limit else "unknown",
        calculated_retry_after=retry_after
    )
    
    # Record rate limit hit in monitoring system
    try:
        from app.core.monitoring import record_rate_limit_hit
        record_rate_limit_hit(str(request.url.path), client_ip)
    except ImportError:
        pass
    
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "error": "Rate limit exceeded",
            "message": f"Too many requests. Try again in {retry_after} seconds.",
            "retry_after": retry_after
        }
    )

# Function to configure CORS
def configure_cors(app, allowed_origins: list = None):
    """Configure CORS middleware with proper settings"""
    
    # Default to localhost for development if no origins specified
    if not allowed_origins:
        allowed_origins = [
            "http://localhost:3000",  # React dev server
            "http://127.0.0.1:3000",
            "http://localhost:8080",  # Vue dev server
            "http://127.0.0.1:8080"
        ]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        allow_headers=["*"],
        expose_headers=["X-Total-Count", "X-Process-Time"]
    )
    
    security_logger.info("CORS configured", allowed_origins=allowed_origins)

# Function to setup all security middleware
def setup_security_middleware(app, cors_origins: list = None):
    """Setup all security middleware for the application"""
    
    # Add rate limiting
    app.state.limiter = rate_limiter
    app.add_exception_handler(RateLimitExceeded, custom_rate_limit_handler)
    app.add_middleware(SlowAPIMiddleware)
    
    # Add security logging
    app.add_middleware(SecurityLoggingMiddleware)
    
    # Add security headers
    app.add_middleware(SecurityHeadersMiddleware)
    
    # Configure CORS
    configure_cors(app, cors_origins)
    
    security_logger.info("Security middleware initialized successfully")
    
    return app