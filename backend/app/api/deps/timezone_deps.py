"""Timezone dependency injection for FastAPI endpoints."""

from typing import Optional
from fastapi import Request


async def get_client_timezone(request: Request) -> Optional[str]:
    """
    Extract client timezone from request state (set by timezone middleware).
    
    Args:
        request: FastAPI request object
        
    Returns:
        Client timezone string or None if not provided
    """
    timezone = getattr(request.state, 'client_timezone', None)
    return timezone