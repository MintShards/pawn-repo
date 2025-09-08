"""
Redis Caching Service

Provides intelligent caching for frequently accessed data to improve performance.
Based on codebase analysis recommendations for reducing database load.
"""

import json
from datetime import datetime, timedelta, UTC
from typing import Any, Optional, Dict, List, Union
import redis
import structlog
from functools import wraps

# Configure logger
cache_logger = structlog.get_logger("redis_cache")


class CacheConfig:
    """Cache configuration constants"""
    
    # Default TTL values (in seconds)
    DEFAULT_TTL = 300  # 5 minutes
    SHORT_TTL = 60     # 1 minute
    MEDIUM_TTL = 600   # 10 minutes
    LONG_TTL = 3600    # 1 hour
    VERY_LONG_TTL = 86400  # 24 hours
    
    # Cache key prefixes
    CUSTOMER_PREFIX = "customer:"
    USER_PREFIX = "user:"
    TRANSACTION_PREFIX = "transaction:"
    PAYMENT_PREFIX = "payment:"
    BALANCE_PREFIX = "balance:"
    STATS_PREFIX = "stats:"
    
    # Cache strategies
    CACHE_ASIDE = "cache_aside"
    WRITE_THROUGH = "write_through"
    WRITE_BEHIND = "write_behind"


class RedisCacheService:
    """Redis caching service with intelligent cache management"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None, redis_url: str = None):
        """
        Initialize Redis cache service.
        
        Args:
            redis_client: Existing Redis client
            redis_url: Redis connection URL
        """
        self.redis_client = redis_client
        self.redis_url = redis_url
        self.is_available = False
        self._stats = {
            "hits": 0,
            "misses": 0,
            "errors": 0,
            "sets": 0,
            "deletes": 0
        }
        
        if not self.redis_client and redis_url:
            try:
                self.redis_client = redis.from_url(redis_url, decode_responses=False)
                self.redis_client.ping()
                self.is_available = True
                cache_logger.info("Redis cache service initialized", redis_url=redis_url)
            except Exception as e:
                cache_logger.warning("Redis unavailable, caching disabled", error=str(e))
                self.is_available = False
        elif self.redis_client:
            try:
                self.redis_client.ping()
                self.is_available = True
                cache_logger.info("Redis cache service initialized with existing client")
            except Exception as e:
                cache_logger.warning("Redis client not available, caching disabled", error=str(e))
                self.is_available = False
    
    def _serialize(self, data: Any) -> bytes:
        """Serialize data for Redis storage using secure JSON-only approach"""
        try:
            # Convert to JSON-serializable format
            if isinstance(data, (dict, list, str, int, float, bool)) or data is None:
                return json.dumps(data, default=str).encode('utf-8')
            else:
                # For complex objects, convert to dict representation
                if hasattr(data, 'model_dump'):
                    # Pydantic models
                    return json.dumps(data.model_dump(), default=str).encode('utf-8')
                elif hasattr(data, '__dict__'):
                    # Regular objects with __dict__
                    return json.dumps(data.__dict__, default=str).encode('utf-8')
                else:
                    # Fallback to string representation
                    return json.dumps(str(data)).encode('utf-8')
        except Exception as e:
            cache_logger.error("Failed to serialize data", error=str(e))
            raise
    
    def _deserialize(self, data: Union[bytes, str]) -> Any:
        """Deserialize data from Redis storage using secure JSON-only approach"""
        try:
            # Handle both bytes and string data from Redis
            if isinstance(data, bytes):
                json_str = data.decode('utf-8')
            else:
                json_str = data
            
            return json.loads(json_str)
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            cache_logger.error("Failed to deserialize JSON data", error=str(e), data_type=type(data).__name__)
            # Return None instead of failing for backwards compatibility
            return None
        except Exception as e:
            cache_logger.error("Failed to deserialize data", error=str(e), data_type=type(data).__name__)
            raise
    
    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found
        """
        if not self.is_available:
            return None
        
        try:
            data = self.redis_client.get(key)
            if data is None:
                self._stats["misses"] += 1
                cache_logger.debug("Cache miss", key=key)
                return None
            
            self._stats["hits"] += 1
            result = self._deserialize(data)
            cache_logger.debug("Cache hit", key=key, data_type=type(result).__name__)
            return result
            
        except Exception as e:
            self._stats["errors"] += 1
            cache_logger.error("Cache get error", key=key, error=str(e))
            return None
    
    async def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """
        Set value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
            
        Returns:
            True if successful, False otherwise
        """
        if not self.is_available:
            return False
        
        try:
            ttl = ttl or CacheConfig.DEFAULT_TTL
            serialized_data = self._serialize(value)
            
            result = self.redis_client.setex(key, ttl, serialized_data)
            
            if result:
                self._stats["sets"] += 1
                cache_logger.debug(
                    "Cache set", 
                    key=key, 
                    ttl=ttl, 
                    data_size=len(serialized_data)
                )
            
            return bool(result)
            
        except Exception as e:
            self._stats["errors"] += 1
            cache_logger.error("Cache set error", key=key, error=str(e))
            return False
    
    async def delete(self, key: str) -> bool:
        """
        Delete value from cache.
        
        Args:
            key: Cache key to delete
            
        Returns:
            True if successful, False otherwise
        """
        if not self.is_available:
            return False
        
        try:
            result = self.redis_client.delete(key)
            
            if result:
                self._stats["deletes"] += 1
                cache_logger.debug("Cache delete", key=key)
            
            return bool(result)
            
        except Exception as e:
            self._stats["errors"] += 1
            cache_logger.error("Cache delete error", key=key, error=str(e))
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching pattern.
        
        Args:
            pattern: Key pattern (supports wildcards)
            
        Returns:
            Number of keys deleted
        """
        if not self.is_available:
            return 0
        
        try:
            keys = self.redis_client.keys(pattern)
            if not keys:
                return 0
            
            deleted_count = self.redis_client.delete(*keys)
            self._stats["deletes"] += deleted_count
            
            cache_logger.info(
                "Cache pattern delete", 
                pattern=pattern, 
                deleted_count=deleted_count
            )
            
            return deleted_count
            
        except Exception as e:
            self._stats["errors"] += 1
            cache_logger.error("Cache pattern delete error", pattern=pattern, error=str(e))
            return 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        if not self.is_available:
            return False
        
        try:
            return bool(self.redis_client.exists(key))
        except Exception as e:
            cache_logger.error("Cache exists error", key=key, error=str(e))
            return False
    
    async def expire(self, key: str, ttl: int) -> bool:
        """Set expiration time for key"""
        if not self.is_available:
            return False
        
        try:
            return bool(self.redis_client.expire(key, ttl))
        except Exception as e:
            cache_logger.error("Cache expire error", key=key, ttl=ttl, error=str(e))
            return False
    
    async def delete_by_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        if not self.is_available:
            return 0
        
        deleted_count = 0
        try:
            # Use SCAN to find all matching keys (safer than KEYS for production)
            cursor = 0
            while True:
                cursor, keys = self.redis_client.scan(cursor, match=pattern, count=100)
                if keys:
                    deleted_count += self.redis_client.delete(*keys)
                if cursor == 0:
                    break
            
            self._stats["deletes"] += deleted_count
            cache_logger.info("Deleted keys by pattern", pattern=pattern, count=deleted_count)
            return deleted_count
        except Exception as e:
            cache_logger.error("Cache delete by pattern error", pattern=pattern, error=str(e))
            self._stats["errors"] += 1
            return 0
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_requests = self._stats["hits"] + self._stats["misses"]
        hit_rate = (self._stats["hits"] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            **self._stats,
            "total_requests": total_requests,
            "hit_rate_percent": round(hit_rate, 2),
            "is_available": self.is_available
        }
    
    def reset_stats(self):
        """Reset cache statistics"""
        self._stats = {
            "hits": 0,
            "misses": 0,
            "errors": 0,
            "sets": 0,
            "deletes": 0
        }


# Global cache service instance
cache_service: Optional[RedisCacheService] = None


def initialize_cache_service(redis_client: Optional[redis.Redis] = None, redis_url: str = None):
    """Initialize global cache service"""
    global cache_service
    cache_service = RedisCacheService(redis_client, redis_url)
    return cache_service


def get_cache_service() -> Optional[RedisCacheService]:
    """Get global cache service instance"""
    return cache_service


# Cache decorators for common patterns
def cached_result(prefix: str, ttl: int = CacheConfig.DEFAULT_TTL, key_generator=None):
    """
    Decorator to cache function results.
    
    Args:
        prefix: Cache key prefix
        ttl: Time to live in seconds
        key_generator: Function to generate cache key from args
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache = get_cache_service()
            if not cache or not cache.is_available:
                return await func(*args, **kwargs)
            
            # Generate cache key
            if key_generator:
                cache_key = f"{prefix}{key_generator(*args, **kwargs)}"
            else:
                # Simple key generation from args
                key_parts = [str(arg) for arg in args]
                key_parts.extend([f"{k}:{v}" for k, v in sorted(kwargs.items())])
                cache_key = f"{prefix}{'_'.join(key_parts)}"
            
            # Try to get from cache
            cached_result = await cache.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            if result is not None:
                await cache.set(cache_key, result, ttl)
            
            return result
        
        return wrapper
    return decorator


# Specific cache functions for business objects
class BusinessCache:
    """High-level cache functions for business objects"""
    
    @staticmethod
    async def get_customer(phone_number: str):
        """Get cached customer data"""
        cache = get_cache_service()
        if not cache:
            return None
        return await cache.get(f"{CacheConfig.CUSTOMER_PREFIX}{phone_number}")
    
    @staticmethod
    async def set_customer(phone_number: str, customer_data: dict, ttl: int = CacheConfig.LONG_TTL):
        """Cache customer data"""
        cache = get_cache_service()
        if not cache:
            return False
        return await cache.set(f"{CacheConfig.CUSTOMER_PREFIX}{phone_number}", customer_data, ttl)
    
    @staticmethod
    async def invalidate_customer(phone_number: str):
        """Invalidate customer cache"""
        cache = get_cache_service()
        if not cache:
            return False
        return await cache.delete(f"{CacheConfig.CUSTOMER_PREFIX}{phone_number}")
    
    @staticmethod
    async def get_user(user_id: str):
        """Get cached user data"""
        cache = get_cache_service()
        if not cache:
            return None
        return await cache.get(f"{CacheConfig.USER_PREFIX}{user_id}")
    
    @staticmethod
    async def set_user(user_id: str, user_data: dict, ttl: int = CacheConfig.MEDIUM_TTL):
        """Cache user data"""
        cache = get_cache_service()
        if not cache:
            return False
        return await cache.set(f"{CacheConfig.USER_PREFIX}{user_id}", user_data, ttl)
    
    @staticmethod
    async def get_transaction_balance(transaction_id: str):
        """Get cached transaction balance"""
        cache = get_cache_service()
        if not cache:
            return None
        return await cache.get(f"{CacheConfig.BALANCE_PREFIX}{transaction_id}")
    
    @staticmethod
    async def set_transaction_balance(transaction_id: str, balance_data: dict, ttl: int = CacheConfig.SHORT_TTL):
        """Cache transaction balance (short TTL due to frequent changes)"""
        cache = get_cache_service()
        if not cache:
            return False
        return await cache.set(f"{CacheConfig.BALANCE_PREFIX}{transaction_id}", balance_data, ttl)
    
    @staticmethod
    async def invalidate_transaction_data(transaction_id: str):
        """Invalidate all transaction-related cache entries"""
        cache = get_cache_service()
        if not cache:
            return 0
        
        # Invalidate transaction balance and related data
        patterns = [
            f"{CacheConfig.BALANCE_PREFIX}{transaction_id}",
            f"{CacheConfig.TRANSACTION_PREFIX}{transaction_id}*",
            f"{CacheConfig.PAYMENT_PREFIX}{transaction_id}*"
        ]
        
        total_deleted = 0
        for pattern in patterns:
            deleted = await cache.delete_pattern(pattern)
            total_deleted += deleted
        
        return total_deleted
    
    @staticmethod
    async def get_user_stats():
        """Get cached user statistics"""
        cache = get_cache_service()
        if not cache:
            return None
        return await cache.get(f"{CacheConfig.STATS_PREFIX}users")
    
    @staticmethod
    async def set_user_stats(stats_data: dict, ttl: int = CacheConfig.MEDIUM_TTL):
        """Cache user statistics"""
        cache = get_cache_service()
        if not cache:
            return False
        return await cache.set(f"{CacheConfig.STATS_PREFIX}users", stats_data, ttl)
    
    @staticmethod
    async def invalidate_by_pattern(pattern: str):
        """Invalidate all cache entries matching pattern"""
        cache = get_cache_service()
        if not cache:
            return 0
        return await cache.delete_by_pattern(pattern)
    
    @staticmethod
    async def get(key: str):
        """Generic get method for any cache key"""
        cache = get_cache_service()
        if not cache:
            return None
        return await cache.get(key)
    
    @staticmethod
    async def set(key: str, value: Any, ttl_seconds: int = CacheConfig.MEDIUM_TTL):
        """Generic set method for any cache key"""
        cache = get_cache_service()
        if not cache:
            return False
        return await cache.set(key, value, ttl_seconds)