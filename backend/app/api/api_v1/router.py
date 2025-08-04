"""
API v1 Router

Central router for all v1 API endpoints.
"""

from fastapi import APIRouter

from app.api.api_v1.handlers.user import user_router

# Main API v1 router
router = APIRouter()

# Include all sub-routers
router.include_router(
    user_router,
    prefix="/user",
    tags=["User Management"],
    responses={404: {"description": "Not found"}}
)