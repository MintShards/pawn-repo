# backend/app/app.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import sys
from app.core.config import settings
from app.models.user_model import User
from app.models.customer_model import Customer
from app.models.item_model import Item
from app.models.transaction_model import Transaction
from app.services.user_service import UserService
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.api.api_v1.router import router

import logging
logging.getLogger("pymongo").setLevel(logging.WARNING)

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('pawnrepo.log')
    ]
)

logger = logging.getLogger(__name__)

# Database connection globals
client = None
database = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage application lifespan - startup and shutdown events
    """
    global client, database
    
    # Startup
    try:
        logger.info("Starting Pawn Repo application...")
        
        # Create MongoDB client and get database
        logger.info(f"Connecting to MongoDB...")
        client = AsyncIOMotorClient(settings.MONGO_CONNECTION_STRING)
        
        # Test the connection
        await client.admin.command('ping')
        logger.info("MongoDB connection successful")
        
        database = client.pawnrepo  # Database name
        
        # Initialize Beanie with your document models
        await init_beanie(
            database=database,
            document_models=[
                User,
                Customer,
                Item,
                Transaction
            ]
        )
        
        logger.info("Beanie ODM initialized successfully")
        
        # Check for first-time setup
        setup_check = await UserService.check_first_time_setup()
        if setup_check.is_first_time_setup:
            logger.warning("⚠️  FIRST TIME SETUP REQUIRED")
            logger.warning("⚠️  No users found in database")
            logger.warning("⚠️  Access /docs and use POST /api/v1/auth/setup/admin to create first admin")
        else:
            logger.info(f"System has {setup_check.total_users} users, admin exists: {setup_check.admin_exists}")
        
        logger.info(f"Application started successfully on {settings.PROJECT_NAME}")
        
    except Exception as e:
        logger.error(f"Failed to start application: {str(e)}")
        if client:
            client.close()
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down application...")
    if client:
        client.close()
        logger.info("Disconnected from MongoDB")

# Create FastAPI app with lifespan
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
    debug=settings.DEBUG,
    description="""
    **Pawn Repo - Pawnshop Management System API**
    
    ## Authentication System
    
    This system uses a **PIN-based authentication** with 2-digit user IDs:
    
    ### For First Time Setup:
    1. Check if setup is needed: `GET /api/v1/auth/setup/check`
    2. Create first admin: `POST /api/v1/auth/setup/admin`
    
    ### For Regular Login:
    1. Login with user number (10-99) and PIN: `POST /api/v1/auth/login`
    2. Use the returned JWT token for authenticated requests
    
    ### User Management (Admin Only):
    - Create users: `POST /api/v1/users/create`
    - Users set their own PIN: `POST /api/v1/auth/pin/set/{user_number}`
    - Reset PINs: `POST /api/v1/users/number/{user_number}/pin/reset`
    
    **Note**: Email and password authentication has been removed in favor of this PIN system.
    """,
    version="2.0.0"
)

# CORS configuration
origins = [
    "http://localhost:3000",    # React default port
    "http://localhost:8080",    # Vue default port  
    "http://localhost:5173",    # Vite default port
    "http://127.0.0.1:3000",    # Alternative localhost
    "http://127.0.0.1:8080",
    "http://127.0.0.1:5173"
]

# Add configured CORS origins
if settings.BACKEND_CORS_ORIGINS:
    origins.extend(settings.BACKEND_CORS_ORIGINS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        if client:
            await client.admin.command('ping')
            db_status = "connected"
        else:
            db_status = "disconnected"
        
        # Check first time setup status
        setup_check = await UserService.check_first_time_setup()
        
        return {
            "status": "healthy",
            "database": db_status,
            "application": settings.PROJECT_NAME,
            "version": "2.0.0",
            "authentication": "PIN-based",
            "first_time_setup_needed": setup_check.is_first_time_setup,
            "total_users": setup_check.total_users
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail="Service unavailable")

@app.get("/")
async def root():
    """Root endpoint with system information"""
    try:
        setup_check = await UserService.check_first_time_setup()
        
        response = {
            "message": f"Welcome to {settings.PROJECT_NAME}",
            "version": "2.0.0",
            "authentication": "PIN-based (2-digit user ID + 4-10 digit PIN)",
            "docs": "/docs",
            "health": "/health"
        }
        
        if setup_check.is_first_time_setup:
            response["setup_required"] = True
            response["setup_endpoint"] = "/api/v1/auth/setup/admin"
            response["message"] += " - First time setup required"
        else:
            response["setup_required"] = False
            response["login_endpoint"] = "/api/v1/auth/login"
            response["total_users"] = setup_check.total_users
        
        return response
    except Exception as e:
        logger.error(f"Root endpoint error: {str(e)}")
        return {
            "message": f"Welcome to {settings.PROJECT_NAME}",
            "version": "2.0.0",
            "status": "Database connection issue",
            "docs": "/docs"
        }

# Include API router
app.include_router(router, prefix=settings.API_V1_STR)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global exception: {str(exc)}", exc_info=True)
    return HTTPException(
        status_code=500,
        detail="An unexpected error occurred. Please try again later."
    )