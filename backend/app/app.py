"""
Pawnshop Operations System - FastAPI Application

A secure pawnshop management system with PIN-based authentication,
user management, and comprehensive audit logging.
"""

# Standard library imports
from contextlib import asynccontextmanager

# Third-party imports
from beanie import init_beanie
from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient

# Local imports
from app.api.api_v1.router import router
from app.core.config import settings
from app.core.security_middleware import setup_security_middleware
from app.core.csrf_protection import initialize_csrf_protection
from app.core.database_indexes import create_database_indexes
from app.core.database import initialize_database, close_database
from app.core.redis_cache import initialize_cache_service
from app.core.field_encryption import initialize_field_encryption, generate_master_key
from app.core.exception_handlers import register_exception_handlers
from app.middleware.request_id import add_request_id_middleware
from app.middleware.timezone_middleware import add_timezone_middleware
from app.models.customer_model import Customer
from app.models.extension_model import Extension
from app.models.loan_config_model import LoanConfig
from app.models.pawn_item_model import PawnItem
from app.models.pawn_transaction_model import PawnTransaction
from app.models.payment_model import Payment
from app.models.service_alert_model import ServiceAlert
from app.models.user_model import User

# Database client
db_client = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown"""
    global db_client
    
    # Initialize database connection with transaction support
    await initialize_database()
    
    # Get database client for Beanie initialization
    from app.core.database import get_database
    db_client = get_database()
    
    await init_beanie(
        database=db_client,
        document_models=[User, Customer, PawnTransaction, PawnItem, Payment, Extension, ServiceAlert, LoanConfig]
    )
    
    # Initialize Redis-based services
    redis_client = None
    try:
        import redis
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        redis_client.ping()  # Test connection
        
        # Initialize CSRF protection with Redis
        initialize_csrf_protection(redis_client, settings.JWT_SECRET_KEY)
        
        # Initialize cache service with Redis
        initialize_cache_service(redis_client, settings.REDIS_URL)
        
        print("Redis services initialized successfully")
        
    except Exception as e:
        print(f"Redis unavailable, using fallback services: {e}")
        # Fallback to in-memory services
        initialize_csrf_protection(None, settings.JWT_SECRET_KEY)
        initialize_cache_service(None, settings.REDIS_URL)
    
    # Initialize field encryption for sensitive data
    try:
        encryption_key = settings.FIELD_ENCRYPTION_KEY
        if not encryption_key:
            # Generate a warning about missing encryption key
            print("WARNING: FIELD_ENCRYPTION_KEY not set. Generating temporary key for this session.")
            print("For production, set FIELD_ENCRYPTION_KEY in environment variables.")
            encryption_key = generate_master_key()
            
        initialize_field_encryption(encryption_key)
        print("Field encryption initialized")
        
    except Exception as e:
        print(f"Warning: Failed to initialize field encryption: {e}")
    
    # Create database indexes for optimal performance
    try:
        created_count, error_count = await create_database_indexes(db_client)
        print(f"Database indexes: {created_count} created, {error_count} errors")
    except Exception as e:
        print(f"Warning: Failed to create database indexes: {e}")
    
    yield
    
    # Shutdown
    await close_database()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Secure pawnshop operations system with PIN-based authentication and production security",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Add request ID middleware for error tracking
add_request_id_middleware(app)

# Add timezone middleware for dynamic timezone handling
add_timezone_middleware(app)

# Register exception handlers for comprehensive error handling
register_exception_handlers(app)

# Setup security middleware (rate limiting, CORS, security headers, logging)
app = setup_security_middleware(app, settings.BACKEND_CORS_ORIGINS)

# Add APM middleware
try:
    from app.core.monitoring import APMMiddleware, get_metrics_endpoint
    app.add_middleware(APMMiddleware)
    
    # Add metrics endpoint
    @app.get("/metrics")
    async def metrics():
        """Prometheus metrics endpoint"""
        return get_metrics_endpoint()
        
except ImportError:
    pass

# Include API routes
app.include_router(router, prefix=settings.API_V1_STR)