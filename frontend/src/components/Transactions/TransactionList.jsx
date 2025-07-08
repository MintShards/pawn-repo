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
    FormControl,
    FormLabel,
    Textarea,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    NumberIncrementStepper,
    NumberDecrementStepper,
    Alert,
    AlertIcon,
    Divider
} from '@chakra-ui/react';
import {
    FiSearch,
    FiPlus,
    FiEye,
    FiDollarSign,
    FiRefreshCw,
    FiPrinter,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../services/axios';

const TransactionList = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const { isOpen, onOpen, onClose } = useDisclosure();
    const {
        isOpen: isPaymentOpen,
        onOpen: onPaymentOpen,
        onClose: onPaymentClose
    } = useDisclosure();
    
    // State
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNote, setPaymentNote] = useState('');
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [paymentScenarios, setPaymentScenarios] = useState([]);
    
    // Color mode values
    const cardBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const textColor = useColorModeValue('gray.600', 'gray.300');
    
    // Fetch transactions
    const fetchTransactions = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get('/dashboard/recent-transactions?limit=50');
            setTransactions(response.data || []);
        } catch (error) {
            console.error('Error fetching transactions:', error);
            toast({
                title: 'Error Loading Transactions',
                description: error.response?.data?.detail || 'Failed to load transactions',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);
    
    // Fetch payment scenarios
    const fetchPaymentScenarios = async (loanId) => {
        try {
            const response = await axiosInstance.get(`/transactions/loan/${loanId}/scenarios`);
            setPaymentScenarios(response.data.scenarios || []);
        } catch (error) {
            console.error('Error fetching payment scenarios:', error);
            setPaymentScenarios([]);
        }
    };
    
    // Initial load
    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);
    
    // Filter transactions
    const filteredTransactions = transactions.filter(transaction => {
        const matchesSearch = searchTerm === '' || 
            transaction.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            transaction.item_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            transaction.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesType = typeFilter === 'all' || transaction.transaction_type === typeFilter;
        
        return matchesSearch && matchesType;
    });
    
    // Get status badge color
    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'active': return 'green';
            case 'due': return 'yellow';
            case 'overdue': return 'red';
            case 'redeemed': return 'blue';
            case 'forfeited': return 'gray';
            default: return 'gray';
        }
    };
    
    // Get transaction type color
    const getTransactionTypeColor = (type) => {
        switch (type?.toLowerCase()) {
            case 'pawn_loan': return 'blue';
            case 'payment': return 'green';
            case 'renewal': return 'purple';
            case 'redemption': return 'teal';
            case 'forfeit': return 'red';
            default: return 'gray';
        }
    };
    
    // Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    };
    
    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    
    // Handle payment
    const handlePayment = async () => {
        if (!selectedTransaction || !paymentAmount) return;
        
        try {
            setPaymentLoading(true);
            await axiosInstance.post('/transactions/payment', {
                loan_id: selectedTransaction.loan_id,
                amount: parseFloat(paymentAmount),
                notes: paymentNote || null
            });
            
            toast({
                title: 'Payment Processed',
                description: `Payment of ${formatCurrency(paymentAmount)} processed successfully`,
                status: 'success',
                duration: 3000,
                isClosable: true
            });
            
            // Reset form
            setPaymentAmount('');
            setPaymentNote('');
            setPaymentScenarios([]);
            onPaymentClose();
            
            // Refresh transactions
            fetchTransactions();
        } catch (error) {
            console.error('Error processing payment:', error);
            toast({
                title: 'Payment Error',
                description: error.response?.data?.detail || 'Failed to process payment',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        } finally {
            setPaymentLoading(false);
        }
    };
    
    // Handle payment modal open
    const handlePaymentModalOpen = (transaction) => {
        setSelectedTransaction(transaction);
        if (transaction.loan_id) {
            fetchPaymentScenarios(transaction.loan_id);
        }
        onPaymentOpen();
    };
    
    return (
        <Box p={6}>
            {/* Header */}
            <Flex mb={6} align="center">
                <VStack align="start" spacing={1}>
                    <Text fontSize="2xl" fontWeight="bold">Transactions</Text>
                    <Text color={textColor}>View and manage pawn loans and payments</Text>
                </VStack>
                <Spacer />
                <HStack>
                    <Button
                        leftIcon={<FiDollarSign />}
                        colorScheme="green"
                        onClick={() => navigate('/transactions/payment')}
                    >
                        Process Payment
                    </Button>
                    <Button
                        leftIcon={<FiPlus />}
                        colorScheme="blue"
                        onClick={() => navigate('/transactions/new')}
                    >
                        New Pawn Loan
                    </Button>
                </HStack>
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
                                placeholder="Search by customer, item, or transaction ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </InputGroup>
                        
                        <Select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            w="200px"
                        >
                            <option value="all">All Types</option>
                            <option value="pawn_loan">Pawn Loans</option>
                            <option value="payment">Payments</option>
                            <option value="renewal">Renewals</option>
                            <option value="redemption">Redemptions</option>
                            <option value="forfeit">Forfeits</option>
                        </Select>
                        
                        <Tooltip label="Refresh">
                            <IconButton
                                icon={<FiRefreshCw />}
                                onClick={fetchTransactions}
                                variant="outline"
                            />
                        </Tooltip>
                    </HStack>
                </CardBody>
            </Card>
            
            {/* Transactions Table */}
            <Card bg={cardBg} border="1px" borderColor={borderColor}>
                <CardBody p={0}>
                    <TableContainer>
                        <Table variant="simple">
                            <Thead>
                                <Tr>
                                    <Th>Date</Th>
                                    <Th>Type</Th>
                                    <Th>Customer</Th>
                                    <Th>Item</Th>
                                    <Th>Amount</Th>
                                    <Th>Status</Th>
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
                                            <Td><Skeleton height="20px" /></Td>
                                        </Tr>
                                    ))
                                ) : filteredTransactions.length === 0 ? (
                                    <Tr>
                                        <Td colSpan={7} textAlign="center" py={8}>
                                            <Text color={textColor}>No transactions found</Text>
                                        </Td>
                                    </Tr>
                                ) : (
                                    filteredTransactions.map((transaction) => (
                                        <Tr key={transaction.transaction_id}>
                                            <Td>
                                                <VStack align="start" spacing={0}>
                                                    <Text fontSize="sm" fontWeight="medium">
                                                        {formatDate(transaction.transaction_date)}
                                                    </Text>
                                                </VStack>
                                            </Td>
                                            <Td>
                                                <Badge colorScheme={getTransactionTypeColor(transaction.transaction_type)}>
                                                    {transaction.transaction_type?.replace('_', ' ')}
                                                </Badge>
                                            </Td>
                                            <Td>
                                                <Text fontWeight="medium">
                                                    {transaction.customer_name || 'N/A'}
                                                </Text>
                                            </Td>
                                            <Td>
                                                <Text noOfLines={1} maxW="200px">
                                                    {transaction.item_description || 'N/A'}
                                                </Text>
                                            </Td>
                                            <Td>
                                                <Text fontWeight="bold">
                                                    {formatCurrency(transaction.amount)}
                                                </Text>
                                            </Td>
                                            <Td>
                                                <Badge colorScheme={getStatusColor(transaction.status)}>
                                                    {transaction.status}
                                                </Badge>
                                            </Td>
                                            <Td>
                                                <HStack spacing={1}>
                                                    <Tooltip label="View Details">
                                                        <IconButton
                                                            icon={<FiEye />}
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => {
                                                                setSelectedTransaction(transaction);
                                                                onOpen();
                                                            }}
                                                        />
                                                    </Tooltip>
                                                    
                                                    {transaction.transaction_type === 'pawn_loan' && 
                                                     transaction.status === 'active' && (
                                                        <Tooltip label="Process Payment">
                                                            <IconButton
                                                                icon={<FiDollarSign />}
                                                                size="sm"
                                                                variant="ghost"
                                                                colorScheme="green"
                                                                onClick={() => handlePaymentModalOpen(transaction)}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                    
                                                    <Tooltip label="Print Receipt">
                                                        <IconButton
                                                            icon={<FiPrinter />}
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => {
                                                                // Handle print receipt
                                                                toast({
                                                                    title: 'Print Receipt',
                                                                    description: 'Print functionality coming soon',
                                                                    status: 'info',
                                                                    duration: 2000
                                                                });
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
                </CardBody>
            </Card>
            
            {/* Transaction Details Modal */}
            <Modal isOpen={isOpen} onClose={onClose} size="lg">
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Transaction Details</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        {selectedTransaction && (
                            <VStack spacing={4} align="stretch">
                                <HStack justify="space-between">
                                    <Text fontWeight="bold">Transaction ID:</Text>
                                    <Text>{selectedTransaction.transaction_id}</Text>
                                </HStack>
                                
                                <HStack justify="space-between">
                                    <Text fontWeight="bold">Type:</Text>
                                    <Badge colorScheme={getTransactionTypeColor(selectedTransaction.transaction_type)}>
                                        {selectedTransaction.transaction_type?.replace('_', ' ')}
                                    </Badge>
                                </HStack>
                                
                                <HStack justify="space-between">
                                    <Text fontWeight="bold">Date:</Text>
                                    <Text>{formatDate(selectedTransaction.transaction_date)}</Text>
                                </HStack>
                                
                                <HStack justify="space-between">
                                    <Text fontWeight="bold">Customer:</Text>
                                    <Text>{selectedTransaction.customer_name || 'N/A'}</Text>
                                </HStack>
                                
                                <HStack justify="space-between">
                                    <Text fontWeight="bold">Item:</Text>
                                    <Text>{selectedTransaction.item_description || 'N/A'}</Text>
                                </HStack>
                                
                                <HStack justify="space-between">
                                    <Text fontWeight="bold">Amount:</Text>
                                    <Text fontSize="lg" fontWeight="bold">
                                        {formatCurrency(selectedTransaction.amount)}
                                    </Text>
                                </HStack>
                                
                                <HStack justify="space-between">
                                    <Text fontWeight="bold">Status:</Text>
                                    <Badge colorScheme={getStatusColor(selectedTransaction.status)}>
                                        {selectedTransaction.status}
                                    </Badge>
                                </HStack>
                                
                                {selectedTransaction.notes && (
                                    <Box>
                                        <Text fontWeight="bold" mb={2}>Notes:</Text>
                                        <Text bg="gray.100" p={3} borderRadius="md">
                                            {selectedTransaction.notes}
                                        </Text>
                                    </Box>
                                )}
                            </VStack>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button onClick={onClose}>Close</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
            
            {/* Payment Processing Modal */}
            <Modal isOpen={isPaymentOpen} onClose={onPaymentClose} size="lg">
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Process Payment</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        {selectedTransaction && (
                            <VStack spacing={4} align="stretch">
                                <Alert status="info">
                                    <AlertIcon />
                                    <Box>
                                        <Text fontWeight="bold">
                                            Processing payment for: {selectedTransaction.customer_name}
                                        </Text>
                                        <Text fontSize="sm">
                                            Item: {selectedTransaction.item_description}
                                        </Text>
                                    </Box>
                                </Alert>
                                
                                {paymentScenarios.length > 0 && (
                                    <Box>
                                        <Text fontWeight="bold" mb={2}>Payment Options:</Text>
                                        <VStack spacing={2} align="stretch">
                                            {paymentScenarios.map((scenario, index) => (
                                                <Box key={index} p={3} bg="gray.50" borderRadius="md">
                                                    <Text fontWeight="medium">{scenario.type}</Text>
                                                    <Text fontSize="sm">Amount: {formatCurrency(scenario.amount)}</Text>
                                                    <Text fontSize="sm">{scenario.description}</Text>
                                                </Box>
                                            ))}
                                        </VStack>
                                        <Divider my={4} />
                                    </Box>
                                )}
                                
                                <FormControl isRequired>
                                    <FormLabel>Payment Amount</FormLabel>
                                    <NumberInput
                                        value={paymentAmount}
                                        onChange={(value) => setPaymentAmount(value)}
                                        min={0}
                                        precision={2}
                                    >
                                        <NumberInputField />
                                        <NumberInputStepper>
                                            <NumberIncrementStepper />
                                            <NumberDecrementStepper />
                                        </NumberInputStepper>
                                    </NumberInput>
                                </FormControl>
                                
                                <FormControl>
                                    <FormLabel>Payment Notes (Optional)</FormLabel>
                                    <Textarea
                                        value={paymentNote}
                                        onChange={(e) => setPaymentNote(e.target.value)}
                                        placeholder="Add any notes about this payment..."
                                        rows={3}
                                    />
                                </FormControl>
                            </VStack>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            colorScheme="green"
                            onClick={handlePayment}
                            isLoading={paymentLoading}
                            loadingText="Processing..."
                            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                            mr={3}
                        >
                            Process Payment
                        </Button>
                        <Button onClick={onPaymentClose}>Cancel</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </Box>
    );
};

export default TransactionList;