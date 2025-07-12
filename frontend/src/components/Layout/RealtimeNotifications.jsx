import React, { useState } from 'react';
import {
    Box,
    VStack,
    HStack,
    Text,
    Badge,
    IconButton,
    Tooltip,
    Popover,
    PopoverTrigger,
    PopoverContent,
    PopoverHeader,
    PopoverBody,
    PopoverCloseButton,
    useColorModeValue,
    Button,
    Divider,
    Alert,
    AlertIcon,
    Flex,
    Spacer
} from '@chakra-ui/react';
import {
    FiBell,
    FiUsers,
    FiWifi,
    FiWifiOff,
    FiActivity,
    FiX,
    FiRefreshCw
} from 'react-icons/fi';
import { useWebSocket } from '../../hooks/useWebSocket';

const RealtimeNotifications = () => {
    const [showNotifications, setShowNotifications] = useState(false);
    const [showConnectedUsers, setShowConnectedUsers] = useState(false);
    
    const {
        isConnected,
        messages,
        connectedUsers,
        requestUserList,
        clearMessages,
        connect,
        disconnect
    } = useWebSocket();
    
    // Color mode values
    const bgColor = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const textColor = useColorModeValue('gray.600', 'gray.300');
    
    // Get unread messages count
    const unreadCount = messages.length;
    
    // Format timestamp for notifications
    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    
    // Get status color
    const getStatusColor = () => {
        return isConnected ? 'green' : 'red';
    };
    
    // Get message icon based on type
    const getMessageIcon = (messageType) => {
        switch (messageType) {
            case 'transaction_created':
                return '💰';
            case 'payment_received':
                return '💸';
            case 'item_forfeited':
                return '⚠️';
            case 'user_login':
                return '👋';
            case 'user_logout':
                return '👋';
            case 'system_alert':
                return '🚨';
            default:
                return '📄';
        }
    };
    
    // Handle connection toggle
    const handleConnectionToggle = () => {
        if (isConnected) {
            disconnect();
        } else {
            connect();
        }
    };
    
    return (
        <HStack spacing={2}>
            {/* Connection Status */}
            <Tooltip label={isConnected ? 'Connected - Real-time updates active' : 'Disconnected - Click to reconnect'}>
                <IconButton
                    icon={isConnected ? <FiWifi /> : <FiWifiOff />}
                    size="sm"
                    variant="ghost"
                    colorScheme={getStatusColor()}
                    onClick={handleConnectionToggle}
                />
            </Tooltip>
            
            {/* Connected Users */}
            <Popover 
                isOpen={showConnectedUsers} 
                onOpen={() => {
                    setShowConnectedUsers(true);
                    requestUserList();
                }}
                onClose={() => setShowConnectedUsers(false)}
                placement="bottom-end"
            >
                <PopoverTrigger>
                    <Tooltip label="View connected users">
                        <Box position="relative">
                            <IconButton
                                icon={<FiUsers />}
                                size="sm"
                                variant="ghost"
                                colorScheme={isConnected ? 'blue' : 'gray'}
                            />
                            {connectedUsers.length > 0 && (
                                <Badge
                                    position="absolute"
                                    top="-1"
                                    right="-1"
                                    colorScheme="blue"
                                    fontSize="xs"
                                    borderRadius="full"
                                >
                                    {connectedUsers.length}
                                </Badge>
                            )}
                        </Box>
                    </Tooltip>
                </PopoverTrigger>
                <PopoverContent bg={bgColor} border="1px" borderColor={borderColor}>
                    <PopoverHeader>
                        <HStack>
                            <FiUsers />
                            <Text fontWeight="bold">Connected Users</Text>
                            <Spacer />
                            <IconButton
                                icon={<FiRefreshCw />}
                                size="xs"
                                variant="ghost"
                                onClick={requestUserList}
                            />
                        </HStack>
                    </PopoverHeader>
                    <PopoverCloseButton />
                    <PopoverBody>
                        {connectedUsers.length > 0 ? (
                            <VStack spacing={2} align="stretch">
                                {connectedUsers.map((user) => (
                                    <HStack key={user.user_id} spacing={3}>
                                        <Box
                                            w={2}
                                            h={2}
                                            borderRadius="full"
                                            bg="green.400"
                                        />
                                        <VStack align="start" spacing={0} flex={1}>
                                            <Text fontSize="sm" fontWeight="medium">
                                                {user.name}
                                            </Text>
                                            <Text fontSize="xs" color={textColor}>
                                                {user.role} • Connected {formatTimestamp(user.connected_at)}
                                            </Text>
                                        </VStack>
                                    </HStack>
                                ))}
                            </VStack>
                        ) : (
                            <Text fontSize="sm" color={textColor}>
                                No other users connected
                            </Text>
                        )}
                    </PopoverBody>
                </PopoverContent>
            </Popover>
            
            {/* Notifications */}
            <Popover 
                isOpen={showNotifications} 
                onOpen={() => setShowNotifications(true)}
                onClose={() => setShowNotifications(false)}
                placement="bottom-end"
            >
                <PopoverTrigger>
                    <Tooltip label="View real-time notifications">
                        <Box position="relative">
                            <IconButton
                                icon={<FiBell />}
                                size="sm"
                                variant="ghost"
                                colorScheme={unreadCount > 0 ? 'orange' : 'gray'}
                            />
                            {unreadCount > 0 && (
                                <Badge
                                    position="absolute"
                                    top="-1"
                                    right="-1"
                                    colorScheme="red"
                                    fontSize="xs"
                                    borderRadius="full"
                                >
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </Badge>
                            )}
                        </Box>
                    </Tooltip>
                </PopoverTrigger>
                <PopoverContent 
                    bg={bgColor} 
                    border="1px" 
                    borderColor={borderColor}
                    w="400px"
                    maxH="500px"
                    overflowY="auto"
                >
                    <PopoverHeader>
                        <HStack>
                            <FiActivity />
                            <Text fontWeight="bold">Real-time Activity</Text>
                            <Spacer />
                            {messages.length > 0 && (
                                <Button
                                    size="xs"
                                    variant="ghost"
                                    leftIcon={<FiX />}
                                    onClick={clearMessages}
                                >
                                    Clear
                                </Button>
                            )}
                        </HStack>
                    </PopoverHeader>
                    <PopoverCloseButton />
                    <PopoverBody p={0}>
                        {!isConnected && (
                            <Alert status="warning" size="sm">
                                <AlertIcon />
                                <Text fontSize="sm">Real-time updates are offline</Text>
                            </Alert>
                        )}
                        
                        {messages.length > 0 ? (
                            <VStack spacing={0} align="stretch">
                                {messages.slice(0, 20).map((message, index) => (
                                    <Box key={index}>
                                        <Box p={3} _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}>
                                            <HStack spacing={3} align="start">
                                                <Text fontSize="lg">
                                                    {getMessageIcon(message.type)}
                                                </Text>
                                                <VStack align="start" spacing={1} flex={1}>
                                                    <HStack spacing={2} w="full">
                                                        <Text fontSize="sm" fontWeight="medium" flex={1}>
                                                            {message.type?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                        </Text>
                                                        <Text fontSize="xs" color={textColor}>
                                                            {formatTimestamp(message.timestamp)}
                                                        </Text>
                                                    </HStack>
                                                    {message.data && (
                                                        <Text fontSize="xs" color={textColor}>
                                                            {typeof message.data === 'string' 
                                                                ? message.data 
                                                                : JSON.stringify(message.data).substring(0, 100) + '...'
                                                            }
                                                        </Text>
                                                    )}
                                                </VStack>
                                            </HStack>
                                        </Box>
                                        {index < messages.length - 1 && <Divider />}
                                    </Box>
                                ))}
                                
                                {messages.length > 20 && (
                                    <Box p={3} textAlign="center">
                                        <Text fontSize="sm" color={textColor}>
                                            Showing last 20 notifications
                                        </Text>
                                    </Box>
                                )}
                            </VStack>
                        ) : (
                            <Box p={6} textAlign="center">
                                <FiActivity size={24} color="gray" />
                                <Text mt={2} fontSize="sm" color={textColor}>
                                    {isConnected 
                                        ? 'No recent activity' 
                                        : 'Connect to see real-time activity'
                                    }
                                </Text>
                            </Box>
                        )}
                    </PopoverBody>
                </PopoverContent>
            </Popover>
        </HStack>
    );
};

export default RealtimeNotifications;