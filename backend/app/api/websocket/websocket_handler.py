"""
WebSocket Handler

Handles WebSocket connections and real-time communication.
"""
from fastapi import WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.routing import APIRouter
from typing import Dict, Any
import json
import logging

from app.services.websocket_service import websocket_service
from app.api.deps.user_deps import get_current_user_websocket
from app.models.user_model import User

logger = logging.getLogger(__name__)

websocket_router = APIRouter()


@websocket_router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """
    WebSocket endpoint for real-time updates.
    
    Clients connect with their JWT token in the URL path.
    """
    try:
        # Verify token and get user
        user = await get_current_user_websocket(token)
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
            
        user_data = {
            "name": f"{user.first_name} {user.last_name}",
            "role": user.role,
            "user_number": user.user_number
        }
        
        # Connect user
        await websocket_service.connect_user(websocket, str(user.user_id), user_data)
        
        try:
            # Keep connection alive and handle incoming messages
            while True:
                # Wait for messages from client
                data = await websocket.receive_text()
                
                try:
                    message = json.loads(data)
                    await handle_client_message(message, str(user.user_id), user)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON received from {user.user_id}: {data}")
                except Exception as e:
                    logger.error(f"Error handling message from {user.user_id}: {e}")
                    
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected: {user.first_name} {user.last_name}")
        except Exception as e:
            logger.error(f"WebSocket error for {user.user_id}: {e}")
        finally:
            websocket_service.disconnect_user(str(user.user_id))
            
    except HTTPException as e:
        logger.warning(f"WebSocket authentication failed: {e.detail}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)


async def handle_client_message(message: Dict[str, Any], user_id: str, user: User):
    """Handle messages received from WebSocket clients"""
    try:
        message_type = message.get("type")
        data = message.get("data", {})
        
        if message_type == "ping":
            # Respond to ping with pong
            await websocket_service.send_personal_notification(user_id, {
                "type": "pong",
                "timestamp": message.get("timestamp")
            })
            
        elif message_type == "subscribe_dashboard":
            # Client wants to subscribe to dashboard updates
            # This could be used to send periodic dashboard updates
            logger.info(f"User {user_id} subscribed to dashboard updates")
            
        elif message_type == "request_user_list":
            # Send list of connected users (admin only)
            if user.role == "admin":
                connected_users = websocket_service.get_connected_users()
                await websocket_service.send_personal_notification(user_id, {
                    "type": "user_list",
                    "users": connected_users,
                    "total_connections": len(connected_users)
                })
            
        else:
            logger.warning(f"Unknown message type '{message_type}' from user {user_id}")
            
    except Exception as e:
        logger.error(f"Error handling client message: {e}")


# Dependency to get current user for WebSocket (separate from HTTP)
async def get_current_user_websocket(token: str) -> User:
    """
    Get current user from WebSocket token.
    This is a simplified version - in a real implementation,
    you'd want to properly validate the JWT token.
    """
    try:
        from app.core.security import verify_token
        from app.services.user_service import UserService
        
        # Verify JWT token
        payload = verify_token(token)
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        # Get user from database
        user = await UserService.get_user_by_id(user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        return user
        
    except Exception as e:
        logger.error(f"WebSocket authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication"
        )