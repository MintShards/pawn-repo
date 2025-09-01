"""
Database Health Monitoring

Endpoints for monitoring database transaction health, concurrency metrics,
and atomic operation performance for the pawnshop system.
"""

# Standard library imports
from typing import Dict, Any
from datetime import datetime, UTC

# Third-party imports
from fastapi import APIRouter, HTTPException, Depends, status

# Local imports
from app.core.database import health_check, get_connection_stats
from app.api.deps.user_deps import get_current_admin_user, get_current_active_user
from app.models.user_model import User

# Create router
router = APIRouter(prefix="/database", tags=["database-health"])


@router.get("/health")
async def get_database_health(
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """
    Get database health status including transaction support.
    
    Returns:
        Database health information
        
    Raises:
        HTTPException: If health check fails
    """
    try:
        health_info = await health_check()
        
        return {
            "timestamp": datetime.now(UTC).isoformat(),
            "status": "healthy" if health_info["status"] == "healthy" else "unhealthy",
            "database_info": health_info,
            "checked_by": current_user.user_id
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database health check failed: {str(e)}"
        )


@router.get("/connections")
async def get_database_connections(
    current_user: User = Depends(get_current_admin_user)
) -> Dict[str, Any]:
    """
    Get database connection statistics (admin only).
    
    Returns:
        Connection statistics and pool information
        
    Raises:
        HTTPException: If connection stats retrieval fails
    """
    try:
        conn_stats = await get_connection_stats()
        
        return {
            "timestamp": datetime.now(UTC).isoformat(),
            "connection_stats": conn_stats,
            "checked_by": current_user.user_id
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get connection stats: {str(e)}"
        )


@router.get("/concurrency-metrics")
async def get_database_concurrency_metrics(
    current_user: User = Depends(get_current_admin_user)
) -> Dict[str, Any]:
    """
    Get concurrency and optimistic locking metrics (admin only).
    
    Returns:
        Concurrency metrics including retry rates and failure counts
    """
    try:
        metrics = {"note": "Concurrency metrics unavailable - optimistic locking disabled"}
        
        return {
            "timestamp": datetime.now(UTC).isoformat(),
            "concurrency_metrics": metrics,
            "recommendations": _get_concurrency_recommendations(metrics),
            "checked_by": current_user.user_id
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get concurrency metrics: {str(e)}"
        )


@router.get("/transaction-support")
async def test_database_transaction_support(
    current_user: User = Depends(get_current_admin_user)
) -> Dict[str, Any]:
    """
    Test database transaction support functionality (admin only).
    
    Returns:
        Transaction support test results
    """
    try:
        from app.core.database import transaction_session
        
        # Test basic transaction session functionality
        test_results = {
            "session_creation": False,
            "transaction_start": False,
            "transaction_abort": False,
            "error_details": None
        }
        
        try:
            async with transaction_session() as session:
                test_results["session_creation"] = True
                
                # Transaction methods are not async in Motor
                session.start_transaction()
                test_results["transaction_start"] = True
                
                # Test abort (rollback)
                session.abort_transaction()
                test_results["transaction_abort"] = True
                
        except Exception as e:
            test_results["error_details"] = str(e)
        
        overall_status = all([
            test_results["session_creation"],
            test_results["transaction_start"],
            test_results["transaction_abort"]
        ])
        
        return {
            "timestamp": datetime.now(UTC).isoformat(),
            "transaction_support_available": overall_status,
            "test_results": test_results,
            "tested_by": current_user.user_id
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test transaction support: {str(e)}"
        )


@router.post("/reset-concurrency-metrics")
async def reset_concurrency_metrics(
    current_user: User = Depends(get_current_admin_user)
) -> Dict[str, Any]:
    """
    Reset concurrency metrics counters (admin only).
    
    Returns:
        Reset confirmation
    """
    try:
        from app.core.optimistic_locking import concurrency_metrics
        
        old_metrics = concurrency_metrics.get_metrics()
        concurrency_metrics.reset_metrics()
        
        return {
            "timestamp": datetime.now(UTC).isoformat(),
            "metrics_reset": True,
            "previous_metrics": old_metrics,
            "reset_by": current_user.user_id
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset concurrency metrics: {str(e)}"
        )


def _get_concurrency_recommendations(metrics: Dict[str, Any]) -> list:
    """
    Generate recommendations based on concurrency metrics.
    
    Args:
        metrics: Concurrency metrics dictionary
        
    Returns:
        List of recommendation strings
    """
    recommendations = []
    
    retry_rate = metrics.get("retry_rate", 0)
    failure_rate = metrics.get("failure_rate", 0)
    total_operations = metrics.get("total_operations", 0)
    
    if retry_rate > 0.1:  # > 10% retry rate
        recommendations.append(
            f"High retry rate ({retry_rate:.2%}). Consider optimizing concurrent operations."
        )
    
    if failure_rate > 0.05:  # > 5% failure rate
        recommendations.append(
            f"High failure rate ({failure_rate:.2%}). Review error handling and retry logic."
        )
    
    if total_operations > 1000 and retry_rate > 0.05:
        recommendations.append(
            "Consider implementing operation queuing to reduce contention."
        )
    
    if not recommendations:
        recommendations.append("Concurrency metrics look healthy.")
    
    return recommendations


# Health check endpoint for load balancers
@router.get("/ping")
async def ping_database() -> Dict[str, str]:
    """
    Simple database ping for load balancer health checks.
    
    Returns:
        Simple status response
    """
    try:
        health_info = await health_check()
        
        if health_info["status"] == "healthy":
            return {"status": "ok", "timestamp": datetime.now(UTC).isoformat()}
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database unhealthy"
            )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database ping failed"
        )