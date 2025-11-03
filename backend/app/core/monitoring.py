"""
Application Performance Monitoring (APM) and Business Metrics System
Provides comprehensive monitoring, metrics collection, and alerting for the pawnshop system.
"""

import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

import psutil
import structlog
from fastapi import Response
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CollectorRegistry, CONTENT_TYPE_LATEST

# Configure monitoring logger
monitoring_logger = structlog.get_logger("monitoring")

class APMConfig:
    """APM configuration constants"""

    # Performance thresholds (milliseconds)
    SLOW_REQUEST_THRESHOLD = 2000  # 2 seconds
    CRITICAL_REQUEST_THRESHOLD = 10000  # 10 seconds
    
    # Memory thresholds (MB)
    HIGH_MEMORY_THRESHOLD = 512
    CRITICAL_MEMORY_THRESHOLD = 1024
    
    # CPU thresholds (percentage)
    HIGH_CPU_THRESHOLD = 70
    CRITICAL_CPU_THRESHOLD = 90
    
    # Business metrics intervals
    METRICS_COLLECTION_INTERVAL = 60  # seconds
    ALERT_COOLDOWN_PERIOD = 300  # 5 minutes

# Prometheus metrics
registry = CollectorRegistry()

# Request metrics
request_count = Counter(
    'pawnshop_requests_total',
    'Total number of HTTP requests',
    ['method', 'endpoint', 'status_code'],
    registry=registry
)

request_duration = Histogram(
    'pawnshop_request_duration_seconds',
    'Time spent processing HTTP requests',
    ['method', 'endpoint'],
    registry=registry
)

# Authentication metrics
auth_attempts = Counter(
    'pawnshop_auth_attempts_total',
    'Total authentication attempts',
    ['result', 'user_type'],
    registry=registry
)

# Business metrics
active_users = Gauge(
    'pawnshop_active_users',
    'Number of currently active users',
    registry=registry
)

# System metrics
memory_usage = Gauge(
    'pawnshop_memory_usage_mb',
    'Current memory usage in MB',
    registry=registry
)

cpu_usage = Gauge(
    'pawnshop_cpu_usage_percent',
    'Current CPU usage percentage',
    registry=registry
)

# Security metrics
security_events = Counter(
    'pawnshop_security_events_total',
    'Total security events',
    ['event_type', 'severity'],
    registry=registry
)

rate_limit_hits = Counter(
    'pawnshop_rate_limit_hits_total',
    'Total rate limit violations',
    ['endpoint'],
    registry=registry
)

class PerformanceMonitor:
    """Application performance monitoring system"""
    
    def __init__(self):
        self.start_time = time.time()
        self.request_stats = {}
        self.alert_history = {}
    
    def get_uptime(self) -> float:
        """Get application uptime in seconds"""
        return time.time() - self.start_time
    
    def get_system_metrics(self) -> Dict[str, Any]:
        """Get current system performance metrics"""
        try:
            # Get current process for accurate memory usage
            current_process = psutil.Process()

            # Memory usage - process-specific (not system-wide)
            process_memory = current_process.memory_info()
            memory_mb = process_memory.rss / 1024 / 1024  # Resident Set Size in MB

            # CPU usage - process-specific
            cpu_percent = current_process.cpu_percent(interval=1)

            # Update Prometheus metrics
            memory_usage.set(memory_mb)
            cpu_usage.set(cpu_percent)

            metrics = {
                'memory_mb': round(memory_mb, 2),
                'memory_percent': round((memory_mb / 1024) * 100, 2),  # Percent of 1GB baseline
                'cpu_percent': cpu_percent,
                'uptime_seconds': self.get_uptime(),
                'timestamp': datetime.utcnow().isoformat()
            }

            # Check for threshold violations
            self._check_performance_thresholds(metrics)

            return metrics

        except Exception as e:
            monitoring_logger.error("Failed to collect system metrics", error=str(e))
            return {}
    
    def _check_performance_thresholds(self, metrics: Dict[str, Any]):
        """Check performance metrics against thresholds and generate alerts"""
        current_time = time.time()
        
        # Check memory thresholds
        memory_mb = metrics.get('memory_mb', 0)
        if memory_mb > APMConfig.CRITICAL_MEMORY_THRESHOLD:
            self._generate_alert(
                'critical_memory_usage',
                f"Critical memory usage: {memory_mb}MB",
                current_time
            )
        elif memory_mb > APMConfig.HIGH_MEMORY_THRESHOLD:
            self._generate_alert(
                'high_memory_usage',
                f"High memory usage: {memory_mb}MB",
                current_time
            )
        
        # Check CPU thresholds
        cpu_percent = metrics.get('cpu_percent', 0)
        if cpu_percent > APMConfig.CRITICAL_CPU_THRESHOLD:
            self._generate_alert(
                'critical_cpu_usage',
                f"Critical CPU usage: {cpu_percent}%",
                current_time
            )
        elif cpu_percent > APMConfig.HIGH_CPU_THRESHOLD:
            self._generate_alert(
                'high_cpu_usage',
                f"High CPU usage: {cpu_percent}%",
                current_time
            )
    
    def _generate_alert(self, alert_type: str, message: str, current_time: float):
        """Generate alert with cooldown period"""
        last_alert_time = self.alert_history.get(alert_type, 0)
        
        if current_time - last_alert_time > APMConfig.ALERT_COOLDOWN_PERIOD:
            monitoring_logger.warning(
                "performance_alert",
                alert_type=alert_type,
                message=message,
                timestamp=datetime.utcnow().isoformat()
            )
            
            # Record security event
            severity = "critical" if "critical" in alert_type else "high"
            security_events.labels(event_type="performance_threshold", severity=severity).inc()
            
            self.alert_history[alert_type] = current_time
    
    def record_request(self, method: str, endpoint: str, status_code: int, duration: float):
        """Record request metrics"""
        # Update Prometheus metrics
        request_count.labels(method=method, endpoint=endpoint, status_code=str(status_code)).inc()
        request_duration.labels(method=method, endpoint=endpoint).observe(duration)
        
        # Check for slow requests
        duration_ms = duration * 1000
        if duration_ms > APMConfig.CRITICAL_REQUEST_THRESHOLD:
            monitoring_logger.warning(
                "critical_slow_request",
                method=method,
                endpoint=endpoint,
                duration_ms=duration_ms,
                status_code=status_code
            )
            security_events.labels(event_type="slow_request", severity="critical").inc()

        elif duration_ms > APMConfig.SLOW_REQUEST_THRESHOLD:
            monitoring_logger.debug(
                "slow_request",
                method=method,
                endpoint=endpoint,
                duration_ms=duration_ms,
                status_code=status_code
            )
            security_events.labels(event_type="slow_request", severity="medium").inc()

class BusinessMetrics:
    """Business metrics collection and monitoring"""
    
    def __init__(self):
        self.metrics_cache = {}
        self.last_update = 0
    
    async def collect_user_metrics(self) -> Dict[str, Any]:
        """Collect user-related business metrics"""
        try:
            from app.models.user_model import User, UserStatus, UserRole
            
            # Get current user counts
            total_users = await User.find().count()
            active_users_count = await User.find(User.status == UserStatus.ACTIVE).count()
            admin_count = await User.find(User.role == UserRole.ADMIN).count()
            staff_count = await User.find(User.role == UserRole.STAFF).count()
            
            # Update Prometheus metrics
            active_users.set(active_users_count)
            
            metrics = {
                'total_users': total_users,
                'active_users': active_users_count,
                'admin_users': admin_count,
                'staff_users': staff_count,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            monitoring_logger.debug("user_metrics_collected", **metrics)
            return metrics
            
        except Exception as e:
            monitoring_logger.error("Failed to collect user metrics", error=str(e))
            return {}
    
    async def collect_authentication_metrics(self) -> Dict[str, Any]:
        """Collect authentication-related metrics"""
        try:
            from app.models.user_model import User
            
            # Get today's date range
            today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Count recent logins
            recent_logins = await User.find(User.last_login >= today).count()
            
            # Count locked accounts
            current_time = datetime.utcnow()
            locked_accounts = await User.find({
                "locked_until": {"$exists": True, "$gte": current_time}
            }).count()
            
            metrics = {
                'recent_logins': recent_logins,
                'locked_accounts': locked_accounts,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            monitoring_logger.debug("auth_metrics_collected", **metrics)
            return metrics
            
        except Exception as e:
            monitoring_logger.error("Failed to collect auth metrics", error=str(e))
            return {}
    
    async def get_all_metrics(self, force_refresh: bool = False) -> Dict[str, Any]:
        """Get all business metrics with caching"""
        current_time = time.time()
        
        # Check if cache is still valid
        if not force_refresh and (current_time - self.last_update) < APMConfig.METRICS_COLLECTION_INTERVAL:
            return self.metrics_cache
        
        # Collect fresh metrics
        user_metrics = await self.collect_user_metrics()
        auth_metrics = await self.collect_authentication_metrics()
        
        all_metrics = {
            'collection_time': datetime.utcnow().isoformat(),
            'users': user_metrics,
            'authentication': auth_metrics
        }
        
        # Update cache
        self.metrics_cache = all_metrics
        self.last_update = current_time
        
        return all_metrics

class SecurityEventTracker:
    """Security event tracking and alerting system"""
    
    def __init__(self):
        self.event_history = []
        self.alert_rules = {
            'failed_login_burst': {'threshold': 5, 'window': 60},  # 5 failures in 1 minute
            'rate_limit_burst': {'threshold': 10, 'window': 300},  # 10 hits in 5 minutes
            'suspicious_activity': {'threshold': 3, 'window': 900}  # 3 events in 15 minutes
        }
    
    def record_event(self, event_type: str, severity: str, details: Dict[str, Any] = None):
        """Record security event and check for alert conditions"""
        event = {
            'timestamp': datetime.utcnow(),
            'event_type': event_type,
            'severity': severity,
            'details': details or {}
        }
        
        self.event_history.append(event)
        
        # Update Prometheus metrics
        security_events.labels(event_type=event_type, severity=severity).inc()
        
        # Log security event
        monitoring_logger.warning(
            "security_event",
            event_type=event_type,
            severity=severity,
            details=details
        )
        
        # Check alert conditions
        self._check_alert_conditions(event_type, severity)
        
        # Cleanup old events (keep last 1000 events)
        if len(self.event_history) > 1000:
            self.event_history = self.event_history[-1000:]
    
    def _check_alert_conditions(self, event_type: str, severity: str):
        """Check if event patterns trigger alerts"""
        current_time = datetime.utcnow()
        
        for rule_name, rule_config in self.alert_rules.items():
            threshold = rule_config['threshold']
            window_seconds = rule_config['window']
            window_start = current_time - timedelta(seconds=window_seconds)
            
            # Count events in time window
            matching_events = [
                event for event in self.event_history
                if event['timestamp'] >= window_start and (
                    rule_name in event['event_type'] or 
                    event_type in rule_name or
                    severity == 'critical'
                )
            ]
            
            if len(matching_events) >= threshold:
                self._generate_security_alert(rule_name, matching_events)
    
    def _generate_security_alert(self, rule_name: str, events: List[Dict]):
        """Generate security alert"""
        monitoring_logger.critical(
            "security_alert_triggered",
            rule=rule_name,
            event_count=len(events),
            time_window=f"{len(events)} events",
            events=events[-3:]  # Include last 3 events for context
        )
        
        # Record critical security event
        security_events.labels(event_type="security_alert", severity="critical").inc()

# Global instances
performance_monitor = PerformanceMonitor()
business_metrics = BusinessMetrics()
security_tracker = SecurityEventTracker()

class APMMiddleware:
    """APM middleware for request monitoring"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        start_time = time.time()
        method = scope["method"]
        path = scope["path"]
        
        # Simplify endpoint path for metrics
        endpoint = self._normalize_endpoint(path)
        
        status_code = 500  # Default for errors
        
        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)
        
        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            # Record request metrics
            duration = time.time() - start_time
            performance_monitor.record_request(method, endpoint, status_code, duration)
    
    def _normalize_endpoint(self, path: str) -> str:
        """Normalize endpoint path for metrics grouping"""
        # Remove API version prefix
        if path.startswith('/api/v1'):
            path = path[7:]
        
        # Group similar endpoints
        if '/user/' in path:
            if path.endswith('/sessions'):
                return '/user/{id}/sessions'
            elif path.endswith('/unlock'):
                return '/user/{id}/unlock'
            elif path.endswith('/reset-pin'):
                return '/user/{id}/reset-pin'
            elif path.count('/') == 2:  # /user/{id}
                return '/user/{id}'
        
        return path

# Utility functions
def record_auth_attempt(result: str, user_type: str = 'user'):
    """Record authentication attempt for metrics"""
    auth_attempts.labels(result=result, user_type=user_type).inc()
    
    if result == 'failed':
        security_tracker.record_event(
            'authentication_failed',
            'medium',
            {'user_type': user_type}
        )

def record_rate_limit_hit(endpoint: str, client_ip: str = None):
    """Record rate limit violation"""
    rate_limit_hits.labels(endpoint=endpoint).inc()
    security_tracker.record_event(
        'rate_limit_exceeded',
        'high',
        {'endpoint': endpoint, 'client_ip': client_ip}
    )

def get_metrics_endpoint():
    """Get Prometheus metrics endpoint response"""
    return Response(
        generate_latest(registry),
        media_type=CONTENT_TYPE_LATEST
    )