"""
Pawnshop Operations System - FastAPI Application

A secure pawnshop management system with PIN-based authentication,
user management, and comprehensive audit logging.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.core.security_middleware import setup_security_middleware
from app.models.user_model import User
from app.api.api_v1.router import router
from app.models.customer_model import Customer

# Database client
db_client = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown"""
    global db_client
    
    # Startup
    client = AsyncIOMotorClient(settings.MONGO_CONNECTION_STRING)
    db_client = client.get_default_database()
    
    await init_beanie(
        database=db_client,
        document_models=[User, Customer]
    )
    
    yield
    
    # Shutdown
    if db_client is not None:
        db_client.client.close()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Secure pawnshop operations system with PIN-based authentication and production security",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

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