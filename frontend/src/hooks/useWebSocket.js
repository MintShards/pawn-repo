/**
 * useWebSocket Hook
 * 
 * React hook for managing WebSocket connections and real-time updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@chakra-ui/react';
import webSocketService from '../services/websocket';
import { useAuth } from './useAuth';

/**
 * Hook for WebSocket functionality
 * @param {Object} options - Hook options
 * @param {boolean} options.autoConnect - Whether to auto-connect on mount
 * @param {Array} options.messageTypes - Message types to listen for
 * @returns {Object} WebSocket state and methods
 */
export const useWebSocket = (options = {}) => {
    const { autoConnect = true, messageTypes = [] } = options;
    const { getToken, user } = useAuth();
    const toast = useToast();
    
    // State
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [messages, setMessages] = useState([]);
    const [connectedUsers, setConnectedUsers] = useState([]);
    
    // Refs for cleanup
    const unsubscribeFunctions = useRef([]);
    
    // Connect to WebSocket
    const connect = useCallback(() => {
        const token = getToken();
        if (token && user) {
            try {
                webSocketService.connect(token);
            } catch (error) {
                console.error('Failed to connect to WebSocket:', error);
                toast({
                    title: 'Connection Error',
                    description: 'Failed to establish real-time connection',
                    status: 'error',
                    duration: 3000,
                    isClosable: true
                });
            }
        }
    }, [getToken, user, toast]);
    
    // Disconnect from WebSocket
    const disconnect = useCallback(() => {
        webSocketService.disconnect();
    }, []);
    
    // Send message
    const sendMessage = useCallback((message) => {
        webSocketService.send(message);
    }, []);
    
    // Subscribe to specific message type
    const subscribe = useCallback((messageType, callback) => {
        const unsubscribe = webSocketService.subscribe(messageType, callback);
        unsubscribeFunctions.current.push(unsubscribe);
        return unsubscribe;
    }, []);
    
    // Request connected users list
    const requestUserList = useCallback(() => {
        webSocketService.requestUserList();
    }, []);
    
    // Setup WebSocket listeners
    useEffect(() => {
        // Connection status listener
        const unsubscribeConnection = webSocketService.subscribe('connection', (data) => {
            setIsConnected(data.status === 'connected');
            setConnectionStatus(data.status);
            
            if (data.status === 'connected') {
                toast({
                    title: 'Connected',
                    description: 'Real-time updates are now active',
                    status: 'success',
                    duration: 2000,
                    isClosable: true
                });
            } else if (data.status === 'disconnected') {
                toast({
                    title: 'Disconnected',
                    description: 'Real-time updates are offline',
                    status: 'warning',
                    duration: 2000,
                    isClosable: true
                });
            } else if (data.status === 'failed') {
                toast({
                    title: 'Connection Failed',
                    description: 'Unable to establish real-time connection',
                    status: 'error',
                    duration: 5000,
                    isClosable: true
                });
            }
        });
        
        // Generic message listener
        const unsubscribeMessage = webSocketService.subscribe('message', (message) => {
            setMessages(prev => [...prev, { ...message, timestamp: new Date() }]);
        });
        
        // User list listener
        const unsubscribeUserList = webSocketService.subscribe('user_list', (data) => {
            setConnectedUsers(data.users || []);
        });
        
        // Transaction created listener
        const unsubscribeTransactionCreated = webSocketService.subscribe('transaction_created', (data) => {
            toast({
                title: 'New Transaction',
                description: `New pawn loan created for ${data.customer_name}`,
                status: 'info',
                duration: 4000,
                isClosable: true
            });
        });
        
        // Payment received listener
        const unsubscribePaymentReceived = webSocketService.subscribe('payment_received', (data) => {
            toast({
                title: 'Payment Received',
                description: `Payment of $${data.payment_amount} received from ${data.customer_name}`,
                status: 'success',
                duration: 4000,
                isClosable: true
            });
        });
        
        // Item forfeited listener
        const unsubscribeItemForfeited = webSocketService.subscribe('item_forfeited', (data) => {
            toast({
                title: 'Item Forfeited',
                description: `${data.item_description} has been forfeited`,
                status: 'warning',
                duration: 5000,
                isClosable: true
            });
        });
        
        // User login/logout listeners
        const unsubscribeUserLogin = webSocketService.subscribe('user_login', (data) => {
            if (data.user_id !== user?.user_id) {
                toast({
                    title: 'User Connected',
                    description: `${data.user_name} is now online`,
                    status: 'info',
                    duration: 2000,
                    isClosable: true
                });
            }
        });
        
        const unsubscribeUserLogout = webSocketService.subscribe('user_logout', (data) => {
            if (data.user_id !== user?.user_id) {
                toast({
                    title: 'User Disconnected',
                    description: `${data.user_name} is now offline`,
                    status: 'info',
                    duration: 2000,
                    isClosable: true
                });
            }
        });
        
        // System alerts listener
        const unsubscribeSystemAlert = webSocketService.subscribe('system_alert', (data) => {
            toast({
                title: data.title || 'System Alert',
                description: data.message,
                status: data.level || 'info',
                duration: data.action_required ? 0 : 5000,
                isClosable: true
            });
        });
        
        // Store unsubscribe functions
        unsubscribeFunctions.current = [
            unsubscribeConnection,
            unsubscribeMessage,
            unsubscribeUserList,
            unsubscribeTransactionCreated,
            unsubscribePaymentReceived,
            unsubscribeItemForfeited,
            unsubscribeUserLogin,
            unsubscribeUserLogout,
            unsubscribeSystemAlert
        ];
        
        // Subscribe to custom message types
        messageTypes.forEach(messageType => {
            const unsubscribe = webSocketService.subscribe(messageType, (data) => {
                // Custom message handler - consumers can listen to messages state
                setMessages(prev => [...prev, { type: messageType, data, timestamp: new Date() }]);
            });
            unsubscribeFunctions.current.push(unsubscribe);
        });
        
        return () => {
            // Cleanup all subscriptions
            unsubscribeFunctions.current.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            });
            unsubscribeFunctions.current = [];
        };
    }, [toast, user, messageTypes]);
    
    // Auto-connect on mount
    useEffect(() => {
        if (autoConnect && user && getToken()) {
            connect();
        }
        
        return () => {
            if (autoConnect) {
                disconnect();
            }
        };
    }, [autoConnect, user, getToken, connect, disconnect]);
    
    // Clean up on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);
    
    return {
        // State
        isConnected,
        connectionStatus,
        messages,
        connectedUsers,
        
        // Methods
        connect,
        disconnect,
        sendMessage,
        subscribe,
        requestUserList,
        
        // Utilities
        clearMessages: () => setMessages([]),
        getConnectionStatus: () => webSocketService.getConnectionStatus()
    };
};

/**
 * Hook specifically for dashboard real-time updates
 */
export const useDashboardWebSocket = () => {
    const [dashboardStats, setDashboardStats] = useState(null);
    
    const webSocket = useWebSocket({
        autoConnect: true,
        messageTypes: ['dashboard_update']
    });
    
    useEffect(() => {
        // Listen for dashboard updates
        const unsubscribe = webSocket.subscribe('dashboard_update', (data) => {
            setDashboardStats(data);
        });
        
        return unsubscribe;
    }, [webSocket]);
    
    return {
        ...webSocket,
        dashboardStats
    };
};

/**
 * Hook for transaction real-time updates
 */
export const useTransactionWebSocket = () => {
    const [recentTransactions, setRecentTransactions] = useState([]);
    const [recentPayments, setRecentPayments] = useState([]);
    
    const webSocket = useWebSocket({
        autoConnect: true,
        messageTypes: ['transaction_created', 'payment_received']
    });
    
    useEffect(() => {
        // Listen for transaction updates
        const unsubscribeTransaction = webSocket.subscribe('transaction_created', (data) => {
            setRecentTransactions(prev => [data, ...prev.slice(0, 9)]); // Keep last 10
        });
        
        const unsubscribePayment = webSocket.subscribe('payment_received', (data) => {
            setRecentPayments(prev => [data, ...prev.slice(0, 9)]); // Keep last 10
        });
        
        return () => {
            unsubscribeTransaction();
            unsubscribePayment();
        };
    }, [webSocket]);
    
    return {
        ...webSocket,
        recentTransactions,
        recentPayments,
        clearTransactionHistory: () => {
            setRecentTransactions([]);
            setRecentPayments([]);
        }
    };
};