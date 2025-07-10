import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    VStack,
    HStack,
    Text,
    Input,
    Button,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    TableContainer,
    Badge,
    Avatar,
    IconButton,
    Select,
    Spinner,
    Alert,
    AlertIcon,
    AlertDescription,
    useToast,
    useDisclosure,
    useColorModeValue,
    AlertDialog,
    AlertDialogBody,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogContent,
    AlertDialogOverlay
} from '@chakra-ui/react';
import { 
    FiSearch, 
    FiToggleLeft, 
    FiToggleRight, 
    FiKey, 
    FiRefreshCw,
    FiMail,
    FiPhone,
    FiEdit2
} from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import axiosInstance from '../../services/axios';
import UserEditForm from './UserEditForm';

const UserList = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedUser, setSelectedUser] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [editingUser, setEditingUser] = useState(null);
    
    const { user: currentUser } = useAuth();
    const toast = useToast();
    const { isOpen, onOpen, onClose } = useDisclosure();
    const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
    const cancelRef = React.useRef();

    // Color mode values
    const bgColor = useColorModeValue('white', 'gray.800');
    const textColor = useColorModeValue('gray.800', 'white');
    const subTextColor = useColorModeValue('gray.600', 'gray.400');
    const borderColor = useColorModeValue('gray.200', 'gray.600');

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError('');
        
        try {
            const params = new URLSearchParams();
            if (searchTerm) params.append('query', searchTerm);
            if (statusFilter === 'active') {
                params.append('is_active', 'true');
            } else if (statusFilter === 'inactive') {
                params.append('is_active', 'false');
            }
            // For 'all', don't add is_active parameter

            const response = await axiosInstance.get(`/users?${params}`);
            setUsers(response.data || []);
        } catch (err) {
            console.error('Error fetching users:', err);
            setError('Error loading users. Please try again.');
            toast({
                title: 'Error Loading Users',
                description: 'Failed to load users. Please try again.',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        } finally {
            setLoading(false);
        }
    }, [searchTerm, statusFilter, toast]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleStatusToggle = async (userNumber, currentStatus) => {
        setActionLoading(userNumber);
        
        try {
            const newStatus = !currentStatus;
            await axiosInstance.patch(`/users/${userNumber}`, { 
                is_active: newStatus 
            });
            
            setUsers(users.map(user => 
                user.user_number === userNumber 
                    ? { ...user, is_active: newStatus }
                    : user
            ));
            
            toast({
                title: 'User Status Updated',
                description: `User has been ${newStatus ? 'activated' : 'deactivated'}`,
                status: 'success',
                duration: 3000,
                isClosable: true
            });
        } catch (err) {
            console.error('Error updating user status:', err);
            toast({
                title: 'Status Update Failed',
                description: 'Failed to update user status. Please try again.',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        } finally {
            setActionLoading(null);
        }
    };

    const handlePinReset = async (userNumber) => {
        // Prompt admin for new PIN
        const newPin = prompt('Enter new PIN for user (4-10 digits):');
        if (!newPin) return;
        
        if (!/^\d{4,10}$/.test(newPin)) {
            toast({
                title: 'Invalid PIN',
                description: 'PIN must be 4-10 digits only.',
                status: 'error',
                duration: 3000,
                isClosable: true
            });
            return;
        }
        
        const confirmPin = prompt('Confirm new PIN:');
        if (confirmPin !== newPin) {
            toast({
                title: 'PIN Mismatch',
                description: 'PINs do not match. Please try again.',
                status: 'error',
                duration: 3000,
                isClosable: true
            });
            return;
        }
        
        setActionLoading(userNumber);
        
        try {
            await axiosInstance.post(`/users/number/${userNumber}/pin/reset`, {
                pin: newPin,
                confirm_pin: confirmPin
            });
            
            toast({
                title: 'PIN Reset Successful',
                description: 'User can now log in with the new PIN.',
                status: 'success',
                duration: 5000,
                isClosable: true
            });
        } catch (err) {
            console.error('Error resetting PIN:', err);
            toast({
                title: 'PIN Reset Failed',
                description: err.response?.data?.detail || 'Failed to reset user PIN. Please try again.',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        } finally {
            setActionLoading(null);
            onClose();
        }
    };

    const openPinResetDialog = (user) => {
        setSelectedUser(user);
        onOpen();
    };


    const openEditDialog = (user) => {
        setEditingUser(user);
        onEditOpen();
    };

    const handleUserUpdated = (updatedUser) => {
        setUsers(users.map(user => 
            user.user_number === updatedUser.user_number ? updatedUser : user
        ));
        setEditingUser(null);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const isCurrentUser = (userNumber) => {
        return currentUser?.user_number === userNumber;
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minH="400px">
                <VStack spacing={4}>
                    <Spinner size="xl" color="blue.500" />
                    <Text>Loading users...</Text>
                </VStack>
            </Box>
        );
    }

    if (error) {
        return (
            <Alert status="error" borderRadius="md">
                <AlertIcon />
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    return (
        <Box p={6} bg={bgColor} borderRadius="lg" shadow="md" border="1px" borderColor={borderColor}>
            <VStack spacing={6} align="stretch">
                <HStack justify="space-between" align="center">
                    <Text fontSize="xl" fontWeight="bold" color={textColor}>
                        User Management
                    </Text>
                    <Button
                        leftIcon={<FiRefreshCw />}
                        onClick={fetchUsers}
                        variant="outline"
                        size="sm"
                    >
                        Refresh
                    </Button>
                </HStack>

                <HStack spacing={4}>
                    <HStack flex={1}>
                        <FiSearch />
                        <Input
                            placeholder="Search users by name, email, or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </HStack>
                    <Select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        width="200px"
                    >
                        <option value="all">All Users</option>
                        <option value="active">Active Only</option>
                        <option value="inactive">Inactive Only</option>
                    </Select>
                </HStack>

                <TableContainer>
                    <Table variant="simple">
                        <Thead>
                            <Tr>
                                <Th>User</Th>
                                <Th>Contact</Th>
                                <Th>Role</Th>
                                <Th>Status</Th>
                                <Th>Created</Th>
                                <Th>Actions</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {users.map((user) => (
                                <Tr key={user.user_number}>
                                    <Td>
                                        <HStack spacing={3}>
                                            <Avatar
                                                size="sm"
                                                name={user.full_name}
                                                bg="blue.500"
                                            />
                                            <VStack align="start" spacing={0}>
                                                <Text fontWeight="medium">
                                                    {user.full_name}
                                                </Text>
                                                <Badge colorScheme="blue" size="sm">
                                                    #{user.user_number}
                                                </Badge>
                                            </VStack>
                                        </HStack>
                                    </Td>
                                    <Td>
                                        <VStack align="start" spacing={1}>
                                            <HStack>
                                                <FiMail size="14" />
                                                <Text fontSize="sm">{user.email}</Text>
                                            </HStack>
                                            <HStack>
                                                <FiPhone size="14" />
                                                <Text fontSize="sm">{user.phone}</Text>
                                            </HStack>
                                        </VStack>
                                    </Td>
                                    <Td>
                                        <Badge
                                            colorScheme={user.is_admin ? 'red' : 'green'}
                                            variant="subtle"
                                        >
                                            {user.is_admin ? 'Admin' : 'Staff'}
                                        </Badge>
                                    </Td>
                                    <Td>
                                        <Badge
                                            colorScheme={user.is_active ? 'green' : 'red'}
                                            variant="subtle"
                                        >
                                            {user.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </Td>
                                    <Td>
                                        <Text fontSize="sm" color={subTextColor}>
                                            {formatDate(user.created_at)}
                                        </Text>
                                    </Td>
                                    <Td>
                                        <HStack spacing={2}>
                                            <IconButton
                                                aria-label="Edit User"
                                                icon={<FiEdit2 />}
                                                size="sm"
                                                colorScheme="blue"
                                                variant="outline"
                                                onClick={() => openEditDialog(user)}
                                            />
                                            {!isCurrentUser(user.user_number) && (
                                                <>
                                                    <IconButton
                                                        aria-label={user.is_active ? "Deactivate User" : "Activate User"}
                                                        icon={user.is_active ? <FiToggleRight /> : <FiToggleLeft />}
                                                        size="sm"
                                                        colorScheme={user.is_active ? 'green' : 'gray'}
                                                        variant="outline"
                                                        onClick={() => handleStatusToggle(user.user_number, user.is_active)}
                                                        isLoading={actionLoading === user.user_number}
                                                        title={user.is_active ? "Click to deactivate user" : "Click to activate user"}
                                                    />
                                                    <IconButton
                                                        aria-label="Reset PIN"
                                                        icon={<FiKey />}
                                                        size="sm"
                                                        colorScheme="orange"
                                                        variant="outline"
                                                        onClick={() => openPinResetDialog(user)}
                                                        isLoading={actionLoading === user.user_number}
                                                    />
                                                </>
                                            )}
                                            {isCurrentUser(user.user_number) && (
                                                <Badge colorScheme="blue" size="sm" ml={2}>
                                                    You
                                                </Badge>
                                            )}
                                        </HStack>
                                    </Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                </TableContainer>

                {users.length === 0 && (
                    <Alert status="info" borderRadius="md">
                        <AlertIcon />
                        <AlertDescription>
                            No users found matching your search criteria.
                        </AlertDescription>
                    </Alert>
                )}
            </VStack>

            {/* Edit User Modal */}
            <UserEditForm
                user={editingUser}
                isOpen={isEditOpen}
                onClose={onEditClose}
                onUserUpdated={handleUserUpdated}
            />

            {/* PIN Reset Confirmation Dialog */}
            <AlertDialog
                isOpen={isOpen}
                leastDestructiveRef={cancelRef}
                onClose={onClose}
            >
                <AlertDialogOverlay>
                    <AlertDialogContent>
                        <AlertDialogHeader fontSize="lg" fontWeight="bold">
                            Reset User PIN
                        </AlertDialogHeader>

                        <AlertDialogBody>
                            Are you sure you want to reset the PIN for{' '}
                            <strong>{selectedUser?.full_name}</strong> (#{selectedUser?.user_number})?
                            
                            <br /><br />
                            
                            This will require them to set a new PIN on their next login attempt.
                        </AlertDialogBody>

                        <AlertDialogFooter>
                            <Button ref={cancelRef} onClick={onClose}>
                                Cancel
                            </Button>
                            <Button
                                colorScheme="orange"
                                onClick={() => handlePinReset(selectedUser?.user_number)}
                                ml={3}
                                isLoading={actionLoading === selectedUser?.user_number}
                            >
                                Reset PIN
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialogOverlay>
            </AlertDialog>

        </Box>
    );
};

export default UserList;