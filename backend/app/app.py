"""
Pawnshop Operations System - FastAPI Application

A secure pawnshop management system with PIN-based authentication,
user management, and comprehensive audit logging.
"""

# Standard library imports
from contextlib import asynccontextmanager

# Third-party imports
from beanie import init_beanie
from fastapi import FastAPI, Request
from fastapi.middleware.gzip import GZipMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import structlog

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
from app.models.user_activity_log_model import UserActivityLog
from app.models.transaction_metrics import TransactionMetrics
from app.models.business_config_model import (
    CompanyConfig,
    FinancialPolicyConfig,
    ForfeitureConfig,
    PrinterConfig,
    LocationConfig
)

# Database client, limiter, scheduler and logger
db_client = None
limiter = Limiter(key_func=get_remote_address)
scheduler = AsyncIOScheduler()
logger = structlog.get_logger("app")


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
        document_models=[
            User,
            UserActivityLog,
            Customer,
            PawnTransaction,
            PawnItem,
            Payment,
            Extension,
            ServiceAlert,
            LoanConfig,
            TransactionMetrics,
            CompanyConfig,
            FinancialPolicyConfig,
            ForfeitureConfig,
            PrinterConfig,
            LocationConfig
        ]
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
        
        logger.info("Redis services initialized successfully")
        
    except Exception as e:
        logger.warning(f"Redis unavailable, using fallback services: {e}")
        # Fallback to in-memory services
        initialize_csrf_protection(None, settings.JWT_SECRET_KEY)
        initialize_cache_service(None, settings.REDIS_URL)
    
    # Initialize field encryption for sensitive data
    try:
        encryption_key = settings.FIELD_ENCRYPTION_KEY
        if not encryption_key:
            # Generate a warning about missing encryption key
            logger.warning("FIELD_ENCRYPTION_KEY not set. Generating temporary key for this session.")
            logger.warning("For production, set FIELD_ENCRYPTION_KEY in environment variables.")
            encryption_key = generate_master_key()
            
        initialize_field_encryption(encryption_key)
        logger.info("Field encryption initialized")
        
    except Exception as e:
        logger.warning(f"Failed to initialize field encryption: {e}")
    
    # Create database indexes for optimal performance
    try:
        created_count, error_count = await create_database_indexes(db_client)
        logger.info(f"Database indexes: {created_count} created, {error_count} errors")
    except Exception as e:
        logger.warning(f"Failed to create database indexes: {e}")

    # BLOCKER-1 FIX: Verify trends-specific indexes exist before accepting requests
    # This prevents 30+ second query times from missing indexes.
    # Application MUST fail fast if required indexes are missing.
    try:
        from app.api.api_v1.handlers.trends import verify_trends_indexes
        await verify_trends_indexes()
        logger.info("Trends indexes verified successfully")
    except RuntimeError as e:
        logger.critical(
            "Missing required indexes for trends endpoints",
            error=str(e)
        )
        raise  # Fail fast if indexes are missing
    except Exception as e:
        logger.error(
            "Trends indexes verification encountered an error",
            error=str(e)
        )
        # Allow app to start on verification errors (but not missing indexes)

    # Initialize background scheduler for automatic status updates
    try:
        from app.services.pawn_transaction_service import PawnTransactionService

        # Wrap the async function for APScheduler
        async def scheduled_status_update():
            """Scheduled task to update transaction statuses daily"""
            try:
                logger.info("Starting scheduled status update...")
                result = await PawnTransactionService.bulk_update_statuses()
                logger.info(
                    "Scheduled status update completed",
                    updated_counts=result
                )
            except Exception as e:
                logger.error(
                    "Scheduled status update failed",
                    error=str(e),
                    exc_info=True
                )

        # Schedule daily status updates at 2:00 AM
        scheduler.add_job(
            scheduled_status_update,
            CronTrigger(hour=2, minute=0),
            id='daily_status_update',
            name='Update transaction statuses to overdue',
            replace_existing=True
        )

        scheduler.start()
        logger.info("Background scheduler started - daily status updates at 2:00 AM")

        # CRITICAL: Run status update immediately on startup to catch any overdue transactions
        try:
            logger.info("Running initial status update on startup...")
            startup_result = await PawnTransactionService.bulk_update_statuses()
            logger.info(
                "Initial status update completed on startup",
                updated_counts=startup_result
            )
        except Exception as e:
            logger.error(
                "Initial status update failed on startup",
                error=str(e),
                exc_info=True
            )

    except Exception as e:
        logger.error(f"Failed to initialize background scheduler: {e}")

    yield

    # Shutdown
    try:
        scheduler.shutdown(wait=False)
        logger.info("Background scheduler stopped")
    except Exception as e:
        logger.warning(f"Error stopping scheduler: {e}")

    # CRITICAL-1: Shutdown trends cache gracefully
    try:
        from app.api.api_v1.handlers.trends import shutdown_cache
        shutdown_cache()
        logger.info("Trends cache shutdown completed")
    except Exception as e:
        logger.warning(f"Error shutting down trends cache: {e}")

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

# Add response compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Add rate limiting middleware
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

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