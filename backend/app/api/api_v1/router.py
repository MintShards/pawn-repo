"""
API v1 Router

Central router for all v1 API endpoints.
"""

from fastapi import APIRouter

from app.api.api_v1.handlers.user import user_router
from app.api.auth.jwt import auth_router
from app.api.api_v1.handlers.monitoring import monitoring_router
from app.api.api_v1.handlers.customer import customer_router
from app.api.api_v1.handlers.pawn_transaction import pawn_transaction_router
from app.api.api_v1.handlers.payment import payment_router
from app.api.api_v1.handlers.extension import extension_router
from app.api.api_v1.handlers.service_alert import service_alert_router
from app.api.api_v1.handlers.notes import notes_router
from app.api.api_v1.handlers.database_health import router as database_health_router
from app.api.api_v1.handlers.stats import router as stats_router

# Main API v1 router
router = APIRouter()

# Include all sub-routers
router.include_router(
    user_router,
    prefix="/user",
    tags=["User Management"],
    responses={404: {"description": "Not found"}}
)

router.include_router(
    auth_router,
    prefix="/auth/jwt",
    tags=["JWT Authentication"],
    responses={401: {"description": "Unauthorized"}}
)

router.include_router(
    monitoring_router,
    prefix="/monitoring",
    tags=["System Monitoring"],
    responses={403: {"description": "Admin access required"}}
)

router.include_router(
    customer_router,
    prefix="/customer",
    tags=["Customer Management"],
    responses={403: {"description": "Admin access required"}}
)

router.include_router(
    pawn_transaction_router,
    prefix="/pawn-transaction",
    tags=["Pawn Transaction Management"],
    responses={403: {"description": "Staff or Admin access required"}}
)

router.include_router(
    payment_router,
    prefix="/payment",
    tags=["Payment Management"],
    responses={403: {"description": "Staff or Admin access required"}}
)

router.include_router(
    extension_router,
    prefix="/extension",
    tags=["Extension Management"],
    responses={403: {"description": "Staff or Admin access required"}}
)

router.include_router(
    service_alert_router,
    prefix="/service-alert",
    tags=["Service Alert Management"],
    responses={403: {"description": "Staff or Admin access required"}}
)

router.include_router(
    notes_router,
    prefix="/notes",
    tags=["Notes Management"],
    responses={403: {"description": "Staff or Admin access required"}}
)

router.include_router(
    database_health_router,
    tags=["Database Health"],
    responses={403: {"description": "Admin access required for most endpoints"}}
)

router.include_router(
    stats_router,
    tags=["Transaction Statistics"],
    responses={403: {"description": "Staff or Admin access required"}}
)

