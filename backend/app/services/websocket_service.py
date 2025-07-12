"""
WebSocket Service for Real-time Updates

Handles WebSocket connections and broadcasts real-time updates to connected clients.
"""
import json
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
from fastapi import WebSocket
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class MessageType(str, Enum):
    """WebSocket message types"""
    TRANSACTION_CREATED = "TRANSACTION_CREATED"
    TRANSACTION_UPDATED = "TRANSACTION_UPDATED"
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED"
    ITEM_FORFEITED = "ITEM_FORFEITED"
    USER_LOGIN = "USER_LOGIN"
    USER_LOGOUT = "USER_LOGOUT"
    SYSTEM_ALERT = "SYSTEM_ALERT"
    DASHBOARD_UPDATE = "DASHBOARD_UPDATE"


class WebSocketMessage:
    """WebSocket message structure"""
    
    def __init__(self, 
                 message_type: MessageType, 
                 data: Dict[str, Any], 
                 user_id: Optional[str] = None,
                 broadcast: bool = True):
        self.type = message_type
        self.data = data
        self.user_id = user_id
        self.broadcast = broadcast
        self.timestamp = datetime.utcnow().isoformat()
        
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "data": self.data,
            "timestamp": self.timestamp,
            "user_id": self.user_id
        }
        
    def to_json(self) -> str:
        return json.dumps(self.to_dict())


class ConnectionManager:
    """Manages WebSocket connections"""
    
    def __init__(self):
        # Active connections: user_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        # Connection metadata
        self.connection_metadata: Dict[str, Dict[str, Any]] = {}
        
    async def connect(self, websocket: WebSocket, user_id: str, user_data: Dict[str, Any]):
        """Accept WebSocket connection and store user info"""
        await websocket.accept()
        
        # Close existing connection if user is already connected
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].close()
            except Exception:
                pass
        
        self.active_connections[user_id] = websocket
        self.connection_metadata[user_id] = {
            "connected_at": datetime.utcnow(),
            "user_data": user_data,
            "last_activity": datetime.utcnow()
        }
        
        logger.info(f"WebSocket connected: {user_data.get('name', 'Unknown')} ({user_id})")
        
        # Notify other users about new connection
        await self.broadcast_message(WebSocketMessage(
            MessageType.USER_LOGIN,
            {
                "user_id": user_id,
                "user_name": user_data.get("name", "Unknown"),
                "connected_at": datetime.utcnow().isoformat()
            },
            user_id=user_id
        ))
        
    def disconnect(self, user_id: str):
        """Remove WebSocket connection"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            
        user_data = self.connection_metadata.get(user_id, {}).get("user_data", {})
        if user_id in self.connection_metadata:
            del self.connection_metadata[user_id]
            
        logger.info(f"WebSocket disconnected: {user_data.get('name', 'Unknown')} ({user_id})")
        
        # Notify other users about disconnection (async task)
        asyncio.create_task(self.broadcast_message(WebSocketMessage(
            MessageType.USER_LOGOUT,
            {
                "user_id": user_id,
                "user_name": user_data.get("name", "Unknown"),
                "disconnected_at": datetime.utcnow().isoformat()
            },
            user_id=user_id
        )))
        
    async def send_personal_message(self, message: WebSocketMessage, user_id: str):
        """Send message to specific user"""
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_text(message.to_json())
                # Update last activity
                if user_id in self.connection_metadata:
                    self.connection_metadata[user_id]["last_activity"] = datetime.utcnow()
            except Exception as e:
                logger.error(f"Error sending message to {user_id}: {e}")
                # Remove dead connection
                self.disconnect(user_id)
                
    async def broadcast_message(self, message: WebSocketMessage):
        """Broadcast message to all connected users"""
        if not message.broadcast:
            return
            
        disconnected_users = []
        
        for user_id, websocket in self.active_connections.items():
            # Don't send message back to sender
            if message.user_id and user_id == message.user_id:
                continue
                
            try:
                await websocket.send_text(message.to_json())
                # Update last activity
                if user_id in self.connection_metadata:
                    self.connection_metadata[user_id]["last_activity"] = datetime.utcnow()
            except Exception as e:
                logger.error(f"Error broadcasting to {user_id}: {e}")
                disconnected_users.append(user_id)
        
        # Clean up disconnected users
        for user_id in disconnected_users:
            self.disconnect(user_id)
            
    async def send_to_role(self, message: WebSocketMessage, role: str):
        """Send message to users with specific role"""
        for user_id, metadata in self.connection_metadata.items():
            user_role = metadata.get("user_data", {}).get("role")
            if user_role == role:
                await self.send_personal_message(message, user_id)
                
    def get_connected_users(self) -> List[Dict[str, Any]]:
        """Get list of connected users"""
        connected_users = []
        for user_id, metadata in self.connection_metadata.items():
            user_data = metadata.get("user_data", {})
            connected_users.append({
                "user_id": user_id,
                "name": user_data.get("name", "Unknown"),
                "role": user_data.get("role", "unknown"),
                "connected_at": metadata.get("connected_at").isoformat() if metadata.get("connected_at") else None,
                "last_activity": metadata.get("last_activity").isoformat() if metadata.get("last_activity") else None
            })
        return connected_users
        
    def get_connection_count(self) -> int:
        """Get number of active connections"""
        return len(self.active_connections)


class WebSocketService:
    """Service for managing WebSocket communications"""
    
    def __init__(self):
        self.manager = ConnectionManager()
        
    async def connect_user(self, websocket: WebSocket, user_id: str, user_data: Dict[str, Any]):
        """Connect a user to WebSocket"""
        await self.manager.connect(websocket, user_id, user_data)
        
    def disconnect_user(self, user_id: str):
        """Disconnect a user from WebSocket"""
        self.manager.disconnect(user_id)
        
    async def notify_transaction_created(self, transaction_data: Dict[str, Any], user_id: str):
        """Notify about new transaction"""
        message = WebSocketMessage(
            MessageType.TRANSACTION_CREATED,
            {
                "transaction_id": transaction_data.get("transaction_id"),
                "customer_name": transaction_data.get("customer_name"),
                "loan_amount": transaction_data.get("loan_amount"),
                "created_by": transaction_data.get("created_by"),
                "created_at": transaction_data.get("created_at")
            },
            user_id=user_id
        )
        await self.manager.broadcast_message(message)
        
    async def notify_payment_received(self, payment_data: Dict[str, Any], user_id: str):
        """Notify about payment received"""
        message = WebSocketMessage(
            MessageType.PAYMENT_RECEIVED,
            {
                "transaction_id": payment_data.get("transaction_id"),
                "customer_name": payment_data.get("customer_name"),
                "payment_amount": payment_data.get("payment_amount"),
                "new_balance": payment_data.get("new_balance"),
                "processed_by": payment_data.get("processed_by"),
                "processed_at": payment_data.get("processed_at")
            },
            user_id=user_id
        )
        await self.manager.broadcast_message(message)
        
    async def notify_item_forfeited(self, forfeiture_data: Dict[str, Any]):
        """Notify about item forfeiture (system notification)"""
        message = WebSocketMessage(
            MessageType.ITEM_FORFEITED,
            {
                "transaction_id": forfeiture_data.get("transaction_id"),
                "customer_name": forfeiture_data.get("customer_name"),
                "item_description": forfeiture_data.get("item_description"),
                "forfeited_at": forfeiture_data.get("forfeited_at")
            }
        )
        await self.manager.broadcast_message(message)
        
    async def notify_dashboard_update(self, stats_data: Dict[str, Any]):
        """Notify about dashboard statistics update"""
        message = WebSocketMessage(
            MessageType.DASHBOARD_UPDATE,
            stats_data,
            broadcast=True
        )
        await self.manager.broadcast_message(message)
        
    async def send_system_alert(self, alert_data: Dict[str, Any], target_role: Optional[str] = None):
        """Send system alert to all users or specific role"""
        message = WebSocketMessage(
            MessageType.SYSTEM_ALERT,
            {
                "level": alert_data.get("level", "info"),
                "title": alert_data.get("title"),
                "message": alert_data.get("message"),
                "action_required": alert_data.get("action_required", False)
            }
        )
        
        if target_role:
            await self.manager.send_to_role(message, target_role)
        else:
            await self.manager.broadcast_message(message)
            
    async def send_personal_notification(self, user_id: str, notification_data: Dict[str, Any]):
        """Send personal notification to specific user"""
        message = WebSocketMessage(
            MessageType.SYSTEM_ALERT,
            notification_data,
            user_id=user_id,
            broadcast=False
        )
        await self.manager.send_personal_message(message, user_id)
        
    def get_connected_users(self) -> List[Dict[str, Any]]:
        """Get list of connected users"""
        return self.manager.get_connected_users()
        
    def get_connection_count(self) -> int:
        """Get number of active connections"""
        return self.manager.get_connection_count()


# Global WebSocket service instance
websocket_service = WebSocketService()