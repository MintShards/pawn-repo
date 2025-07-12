/**
 * WebSocket Service for Real-time Updates
 * 
 * Handles WebSocket connections and real-time communication with the backend.
 */

class WebSocketService {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second
        this.heartbeatInterval = null;
        this.token = null;
        
        // Bind methods to preserve context
        this.onOpen = this.onOpen.bind(this);
        this.onMessage = this.onMessage.bind(this);
        this.onError = this.onError.bind(this);
        this.onClose = this.onClose.bind(this);
    }
    
    /**
     * Connect to WebSocket server
     * @param {string} token - JWT token for authentication
     */
    connect(token) {
        if (this.isConnected) {
            console.warn('WebSocket already connected');
            return;
        }
        
        this.token = token;
        const wsUrl = this.getWebSocketUrl(token);
        
        try {
            this.ws = new WebSocket(wsUrl);
            this.ws.onopen = this.onOpen;
            this.ws.onmessage = this.onMessage;
            this.ws.onerror = this.onError;
            this.ws.onclose = this.onClose;
            
            console.log('Connecting to WebSocket...');
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.handleReconnect();
        }
    }
    
    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
        }
        this.cleanup();
    }
    
    /**
     * Send message to server
     * @param {Object} message - Message to send
     */
    send(message) {
        if (this.isConnected && this.ws) {
            try {
                this.ws.send(JSON.stringify(message));
            } catch (error) {
                console.error('Failed to send WebSocket message:', error);
            }
        } else {
            console.warn('WebSocket not connected. Message not sent:', message);
        }
    }
    
    /**
     * Subscribe to message types
     * @param {string} messageType - Type of message to listen for
     * @param {Function} callback - Callback function to handle message
     */
    subscribe(messageType, callback) {
        if (!this.listeners.has(messageType)) {
            this.listeners.set(messageType, []);
        }
        this.listeners.get(messageType).push(callback);
        
        return () => {
            // Return unsubscribe function
            const callbacks = this.listeners.get(messageType);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }
    
    /**
     * Handle WebSocket open event
     */
    onOpen() {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Subscribe to dashboard updates
        this.send({
            type: 'subscribe_dashboard',
            timestamp: new Date().toISOString()
        });
        
        // Notify listeners
        this.notifyListeners('connection', { status: 'connected' });
    }
    
    /**
     * Handle WebSocket message event
     * @param {MessageEvent} event - WebSocket message event
     */
    onMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('WebSocket message received:', message);
            
            // Handle specific message types
            switch (message.type) {
                case 'pong':
                    // Heartbeat response
                    break;
                    
                case 'TRANSACTION_CREATED':
                    this.notifyListeners('transaction_created', message.data);
                    break;
                    
                case 'PAYMENT_RECEIVED':
                    this.notifyListeners('payment_received', message.data);
                    break;
                    
                case 'ITEM_FORFEITED':
                    this.notifyListeners('item_forfeited', message.data);
                    break;
                    
                case 'USER_LOGIN':
                    this.notifyListeners('user_login', message.data);
                    break;
                    
                case 'USER_LOGOUT':
                    this.notifyListeners('user_logout', message.data);
                    break;
                    
                case 'SYSTEM_ALERT':
                    this.notifyListeners('system_alert', message.data);
                    break;
                    
                case 'DASHBOARD_UPDATE':
                    this.notifyListeners('dashboard_update', message.data);
                    break;
                    
                case 'user_list':
                    this.notifyListeners('user_list', message);
                    break;
                    
                default:
                    // Generic message handler
                    this.notifyListeners('message', message);
                    break;
            }
            
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    }
    
    /**
     * Handle WebSocket error event
     * @param {Event} event - WebSocket error event
     */
    onError(error) {
        console.error('WebSocket error:', error);
        this.notifyListeners('error', { error });
    }
    
    /**
     * Handle WebSocket close event
     * @param {CloseEvent} event - WebSocket close event
     */
    onClose(event) {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.cleanup();
        
        // Notify listeners
        this.notifyListeners('connection', { status: 'disconnected', code: event.code, reason: event.reason });
        
        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000) {
            this.handleReconnect();
        }
    }
    
    /**
     * Handle reconnection logic
     */
    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts && this.token) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            setTimeout(() => {
                this.connect(this.token);
            }, this.reconnectDelay);
            
            // Exponential backoff
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
        } else {
            console.error('Max reconnection attempts reached or no token available');
            this.notifyListeners('connection', { status: 'failed' });
        }
    }
    
    /**
     * Start heartbeat to keep connection alive
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.send({
                type: 'ping',
                timestamp: new Date().toISOString()
            });
        }, 30000); // Send ping every 30 seconds
    }
    
    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    /**
     * Clean up connection state
     */
    cleanup() {
        this.isConnected = false;
        this.ws = null;
        this.stopHeartbeat();
    }
    
    /**
     * Notify all listeners for a specific message type
     * @param {string} messageType - Message type
     * @param {Object} data - Message data
     */
    notifyListeners(messageType, data) {
        const callbacks = this.listeners.get(messageType);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in WebSocket listener callback:', error);
                }
            });
        }
    }
    
    /**
     * Get WebSocket URL with token
     * @param {string} token - JWT token
     * @returns {string} WebSocket URL
     */
    getWebSocketUrl(token) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        
        // In development, you might want to use a different host
        if (process.env.NODE_ENV === 'development') {
            // Adjust this URL to match your backend WebSocket endpoint
            return `${protocol}//localhost:8000/ws/${token}`;
        }
        
        return `${protocol}//${host}/ws/${token}`;
    }
    
    /**
     * Get connection status
     * @returns {boolean} Connection status
     */
    getConnectionStatus() {
        return this.isConnected;
    }
    
    /**
     * Request list of connected users (admin only)
     */
    requestUserList() {
        this.send({
            type: 'request_user_list',
            timestamp: new Date().toISOString()
        });
    }
}

// Create singleton instance
const webSocketService = new WebSocketService();

export default webSocketService;