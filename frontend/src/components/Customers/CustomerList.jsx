import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Button,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    TableContainer,
    VStack,
    HStack,
    Text,
    Input,
    InputGroup,
    InputLeftElement,
    Select,
    Badge,
    IconButton,
    Tooltip,
    useColorModeValue,
    Skeleton,
    Card,
    CardBody,
    Flex,
    Spacer,
    useToast,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    ModalCloseButton,
    useDisclosure,
} from '@chakra-ui/react';
import {
    FiSearch,
    FiPlus,
    FiEye,
    FiEdit,
    FiTrash2,
    FiRefreshCw,
    FiUserX,
    FiUserCheck,
    FiPhone,
    FiMail
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../services/axios';

const CustomerList = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const { isOpen, onOpen, onClose } = useDisclosure();
    
    // State
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0
    });
    
    // Color mode values
    const cardBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const textColor = useColorModeValue('gray.600', 'gray.300');
    
    // Fetch customers
    const fetchCustomers = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const skip = (page - 1) * pagination.limit;
            const params = new URLSearchParams({
                skip: skip.toString(),
                limit: pagination.limit.toString(),
                ...(searchTerm && { query: searchTerm }),
                ...(statusFilter !== 'all' && { status: statusFilter })
            });
            
            const response = await axiosInstance.get(`/customers?${params}`);
            // Backend returns direct array, not paginated object
            setCustomers(response.data || []);
            setPagination(prev => ({
                ...prev,
                page,
                total: response.data.length || 0
            }));
        } catch (error) {
            console.error('Error fetching customers:', error);
            toast({
                title: 'Error Loading Customers',
                description: error.response?.data?.detail || 'Failed to load customers',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        } finally {
            setLoading(false);
        }
    }, [pagination.limit, searchTerm, statusFilter, toast]);
    
    // Search effect
    useEffect(() => {
        const delayedSearch = setTimeout(() => {
            fetchCustomers(1);
        }, 300);
        
        return () => clearTimeout(delayedSearch);
    }, [searchTerm, statusFilter, fetchCustomers]);
    
    // Initial load
    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);
    
    // Get status badge color
    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'active': return 'green';
            case 'suspended': return 'yellow';
            case 'banned': return 'red';
            case 'restricted': return 'orange';
            default: return 'gray';
        }
    };
    
    // Handle customer action
    const handleCustomerAction = async (customerId, action) => {
        try {
            setActionLoading(true);
            
            if (action === 'delete') {
                await axiosInstance.delete(`/customers/${customerId}`);
                toast({
                    title: 'Customer Deleted',
                    description: 'Customer has been successfully deleted',
                    status: 'success',
                    duration: 3000,
                    isClosable: true
                });
            } else {
                await axiosInstance.patch(`/customers/${customerId}/status`, {
                    status: action
                });
                toast({
                    title: 'Status Updated',
                    description: `Customer status updated to ${action}`,
                    status: 'success',
                    duration: 3000,
                    isClosable: true
                });
            }
            
            fetchCustomers(pagination.page);
            onClose();
        } catch (error) {
            console.error('Error updating customer:', error);
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to update customer',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        } finally {
            setActionLoading(false);
        }
    };
    
    // Format phone number
    const formatPhone = (phone) => {
        if (!phone) return 'N/A';
        return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    };
    
    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };
    
    return (
        <Box p={6}>
            {/* Header */}
            <Flex mb={6} align="center">
                <VStack align="start" spacing={1}>
                    <Text fontSize="2xl" fontWeight="bold">Customers</Text>
                    <Text color={textColor}>Manage customer accounts and information</Text>
                </VStack>
                <Spacer />
                <Button
                    leftIcon={<FiPlus />}
                    colorScheme="blue"
                    onClick={() => navigate('/customers/new')}
                >
                    Add Customer
                </Button>
            </Flex>
            
            {/* Search and Filters */}
            <Card bg={cardBg} border="1px" borderColor={borderColor} mb={6}>
                <CardBody>
                    <HStack spacing={4}>
                        <InputGroup flex={1}>
                            <InputLeftElement pointerEvents="none">
                                <FiSearch color="gray.300" />
                            </InputLeftElement>
                            <Input
                                placeholder="Search customers by name, phone, or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </InputGroup>
                        
                        <Select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            w="200px"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="banned">Banned</option>
                            <option value="restricted">Restricted</option>
                        </Select>
                        
                        <Tooltip label="Refresh">
                            <IconButton
                                icon={<FiRefreshCw />}
                                onClick={() => fetchCustomers(pagination.page)}
                                variant="outline"
                            />
                        </Tooltip>
                    </HStack>
                </CardBody>
            </Card>
            
            {/* Customer Table */}
            <Card bg={cardBg} border="1px" borderColor={borderColor}>
                <CardBody p={0}>
                    <TableContainer>
                        <Table variant="simple">
                            <Thead>
                                <Tr>
                                    <Th>Name</Th>
                                    <Th>Phone</Th>
                                    <Th>Email</Th>
                                    <Th>Status</Th>
                                    <Th>Created</Th>
                                    <Th>Actions</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {loading ? (
                                    // Loading skeleton
                                    [...Array(5)].map((_, i) => (
                                        <Tr key={i}>
                                            <Td><Skeleton height="20px" /></Td>
                                            <Td><Skeleton height="20px" /></Td>
                                            <Td><Skeleton height="20px" /></Td>
                                            <Td><Skeleton height="20px" /></Td>
                                            <Td><Skeleton height="20px" /></Td>
                                            <Td><Skeleton height="20px" /></Td>
                                        </Tr>
                                    ))
                                ) : customers.length === 0 ? (
                                    <Tr>
                                        <Td colSpan={6} textAlign="center" py={8}>
                                            <Text color={textColor}>No customers found</Text>
                                        </Td>
                                    </Tr>
                                ) : (
                                    customers.map((customer) => (
                                        <Tr key={customer.customer_id}>
                                            <Td>
                                                <VStack align="start" spacing={0}>
                                                    <Text fontWeight="medium">
                                                        {`${customer.first_name} ${customer.last_name}`}
                                                    </Text>
                                                    <Text fontSize="sm" color={textColor}>
                                                        ID: {customer.customer_id?.slice(-8)}
                                                    </Text>
                                                </VStack>
                                            </Td>
                                            <Td>
                                                <HStack>
                                                    <FiPhone size={12} />
                                                    <Text>{formatPhone(customer.phone)}</Text>
                                                </HStack>
                                            </Td>
                                            <Td>
                                                <HStack>
                                                    <FiMail size={12} />
                                                    <Text>{customer.email || 'N/A'}</Text>
                                                </HStack>
                                            </Td>
                                            <Td>
                                                <Badge colorScheme={getStatusColor(customer.status)}>
                                                    {customer.status}
                                                </Badge>
                                            </Td>
                                            <Td>
                                                <Text fontSize="sm">
                                                    {formatDate(customer.created_at)}
                                                </Text>
                                            </Td>
                                            <Td>
                                                <HStack spacing={1}>
                                                    <Tooltip label="View Details">
                                                        <IconButton
                                                            icon={<FiEye />}
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => navigate(`/customers/${customer.customer_id}`)}
                                                        />
                                                    </Tooltip>
                                                    <Tooltip label="Edit">
                                                        <IconButton
                                                            icon={<FiEdit />}
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => navigate(`/customers/${customer.customer_id}/edit`)}
                                                        />
                                                    </Tooltip>
                                                    <Tooltip label="More Actions">
                                                        <IconButton
                                                            icon={<FiTrash2 />}
                                                            size="sm"
                                                            variant="ghost"
                                                            colorScheme="red"
                                                            onClick={() => {
                                                                setSelectedCustomer(customer);
                                                                onOpen();
                                                            }}
                                                        />
                                                    </Tooltip>
                                                </HStack>
                                            </Td>
                                        </Tr>
                                    ))
                                )}
                            </Tbody>
                        </Table>
                    </TableContainer>
                    
                    {/* Pagination */}
                    {customers.length > 0 && (
                        <Flex justify="space-between" align="center" p={4} borderTop="1px" borderColor={borderColor}>
                            <Text color={textColor}>
                                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} customers
                            </Text>
                            <HStack>
                                <Button
                                    size="sm"
                                    disabled={pagination.page === 1}
                                    onClick={() => fetchCustomers(pagination.page - 1)}
                                >
                                    Previous
                                </Button>
                                <Button
                                    size="sm"
                                    disabled={pagination.page * pagination.limit >= pagination.total}
                                    onClick={() => fetchCustomers(pagination.page + 1)}
                                >
                                    Next
                                </Button>
                            </HStack>
                        </Flex>
                    )}
                </CardBody>
            </Card>
            
            {/* Action Modal */}
            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Customer Actions</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        {selectedCustomer && (
                            <VStack spacing={4} align="stretch">
                                <Text>
                                    What would you like to do with <strong>{selectedCustomer.full_name}</strong>?
                                </Text>
                                
                                <VStack spacing={2}>
                                    {selectedCustomer.status === 'active' && (
                                        <Button
                                            leftIcon={<FiUserX />}
                                            colorScheme="yellow"
                                            variant="outline"
                                            w="100%"
                                            onClick={() => handleCustomerAction(selectedCustomer.customer_id, 'suspended')}
                                            isLoading={actionLoading}
                                        >
                                            Suspend Customer
                                        </Button>
                                    )}
                                    
                                    {selectedCustomer.status === 'suspended' && (
                                        <Button
                                            leftIcon={<FiUserCheck />}
                                            colorScheme="green"
                                            variant="outline"
                                            w="100%"
                                            onClick={() => handleCustomerAction(selectedCustomer.customer_id, 'active')}
                                            isLoading={actionLoading}
                                        >
                                            Activate Customer
                                        </Button>
                                    )}
                                    
                                    <Button
                                        leftIcon={<FiTrash2 />}
                                        colorScheme="red"
                                        variant="outline"
                                        w="100%"
                                        onClick={() => handleCustomerAction(selectedCustomer.customer_id, 'delete')}
                                        isLoading={actionLoading}
                                    >
                                        Delete Customer
                                    </Button>
                                </VStack>
                            </VStack>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button onClick={onClose}>Cancel</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </Box>
    );
};

export default CustomerList;