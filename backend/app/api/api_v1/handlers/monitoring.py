"""
Monitoring and metrics endpoints for pawnshop system
"""

from typing import Dict, Any
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app.models.user_model import User
from app.core.auth import require_admin, get_admin_user

monitoring_router = APIRouter()

@monitoring_router.get("/system-health",
                     summary="System health check",
                     description="Get comprehensive system health information (Admin only)",
                     dependencies=[Depends(require_admin)])
async def get_system_health(admin_user: User = Depends(get_admin_user)) -> Dict[str, Any]:
    """Get system health metrics (Admin only)"""
    try:
        from app.core.monitoring import performance_monitor, business_metrics
        
        # Get system performance metrics
        system_metrics = performance_monitor.get_system_metrics()
        
        # Get business metrics
        business_data = await business_metrics.get_all_metrics()
        
        health_data = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "uptime_seconds": performance_monitor.get_uptime(),
            "system": system_metrics,
            "business": business_data
        }
        
        return health_data
        
    except ImportError:
        # Fallback when monitoring module not available
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "message": "Basic health check - monitoring not configured"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Health check failed: {str(e)}"
        )

@monitoring_router.get("/performance-metrics",
                     summary="Performance metrics",
                     description="Get current performance metrics (Admin only)",
                     dependencies=[Depends(require_admin)])
async def get_performance_metrics(admin_user: User = Depends(get_admin_user)) -> Dict[str, Any]:
    """Get performance metrics (Admin only)"""
    try:
        from app.core.monitoring import performance_monitor
        
        metrics = performance_monitor.get_system_metrics()
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "performance": metrics,
            "thresholds": {
                "slow_request_ms": 1000,
                "critical_request_ms": 5000,
                "high_memory_mb": 512,
                "critical_memory_mb": 1024,
                "high_cpu_percent": 70,
                "critical_cpu_percent": 90
            }
        }
        
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Performance monitoring not configured"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get performance metrics: {str(e)}"
        )

@monitoring_router.get("/business-metrics",
                     summary="Business metrics",
                     description="Get business intelligence metrics (Admin only)",
                     dependencies=[Depends(require_admin)])
async def get_business_metrics(admin_user: User = Depends(get_admin_user)) -> Dict[str, Any]:
    """Get business metrics (Admin only)"""
    try:
        from app.core.monitoring import business_metrics
        
        metrics = await business_metrics.get_all_metrics()
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "business_metrics": metrics
        }
        
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Business metrics monitoring not configured"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get business metrics: {str(e)}"
        )

@monitoring_router.get("/security-events",
                     summary="Security events summary",
                     description="Get recent security events summary (Admin only)",
                     dependencies=[Depends(require_admin)])
async def get_security_events(admin_user: User = Depends(get_admin_user)) -> Dict[str, Any]:
    """Get security events summary (Admin only)"""
    try:
        from app.core.monitoring import security_tracker
        
        # Get recent events (last 50)
        recent_events = security_tracker.event_history[-50:] if security_tracker.event_history else []
        
        # Count events by type and severity
        event_summary = {}
        severity_count = {}
        
        for event in recent_events:
            event_type = event['event_type']
            severity = event['severity']
            
            event_summary[event_type] = event_summary.get(event_type, 0) + 1
            severity_count[severity] = severity_count.get(severity, 0) + 1
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "recent_events_count": len(recent_events),
            "events_by_type": event_summary,
            "events_by_severity": severity_count,
            "latest_events": [
                {
                    "timestamp": event["timestamp"].isoformat(),
                    "type": event["event_type"],
                    "severity": event["severity"],
                    "details": event.get("details", {})
                }
                for event in recent_events[-10:]  # Last 10 events
            ]
        }
        
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Security event monitoring not configured"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get security events: {str(e)}"
        )

@monitoring_router.get("/alerts-status",
                     summary="Alerts status",
                     description="Get current alerts and system status (Admin only)",
                     dependencies=[Depends(require_admin)])
async def get_alerts_status(admin_user: User = Depends(get_admin_user)) -> Dict[str, Any]:
    """Get alerts status (Admin only)"""
    try:
        from app.core.monitoring import performance_monitor, security_tracker
        
        # Get current system status
        system_metrics = performance_monitor.get_system_metrics()
        
        # Check for active alerts
        alerts = []
        
        # Check memory alerts
        memory_mb = system_metrics.get('memory_mb', 0)
        if memory_mb > 1024:  # Critical threshold
            alerts.append({
                "type": "critical_memory_usage",
                "severity": "critical",
                "message": f"Memory usage is critical: {memory_mb}MB",
                "value": memory_mb,
                "threshold": 1024
            })
        elif memory_mb > 512:  # High threshold
            alerts.append({
                "type": "high_memory_usage",
                "severity": "warning",
                "message": f"Memory usage is high: {memory_mb}MB",
                "value": memory_mb,
                "threshold": 512
            })
        
        # Check CPU alerts
        cpu_percent = system_metrics.get('cpu_percent', 0)
        if cpu_percent > 90:  # Critical threshold
            alerts.append({
                "type": "critical_cpu_usage",
                "severity": "critical",
                "message": f"CPU usage is critical: {cpu_percent}%",
                "value": cpu_percent,
                "threshold": 90
            })
        elif cpu_percent > 70:  # High threshold
            alerts.append({
                "type": "high_cpu_usage",
                "severity": "warning",
                "message": f"CPU usage is high: {cpu_percent}%",
                "value": cpu_percent,
                "threshold": 70
            })
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "system_status": "healthy" if not alerts else "warning",
            "active_alerts_count": len(alerts),
            "alerts": alerts,
            "system_metrics": system_metrics
        }
        
    except ImportError:
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "system_status": "unknown",
            "message": "Monitoring not configured"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get alerts status: {str(e)}"
        )