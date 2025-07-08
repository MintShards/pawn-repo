import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Button,
    VStack,
    HStack,
    Text,
    Input,
    Textarea,
    FormControl,
    FormLabel,
    FormErrorMessage,
    Card,
    CardBody,
    CardHeader,
    Heading,
    useColorModeValue,
    useToast,
    Alert,
    AlertIcon,
    Flex,
    IconButton,
    Tooltip,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    NumberIncrementStepper,
    NumberDecrementStepper,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    ModalCloseButton,
    useDisclosure,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    TableContainer,
    Badge,
    Skeleton,
    InputGroup,
    InputLeftElement
} from '@chakra-ui/react';
import { FiArrowLeft, FiSave, FiUser, FiPackage, FiDollarSign, FiSearch, FiPlus } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../services/axios';

const NewPawnLoan = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const { isOpen, onOpen, onClose } = useDisclosure();
    
    const { register, handleSubmit, formState: { errors, isSubmitting }, setValue } = useForm();
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [customerLoading, setCustomerLoading] = useState(false);
    
    // Color mode values
    const cardBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const textColor = useColorModeValue('gray.600', 'gray.300');
    
    // Search customers
    const searchCustomers = useCallback(async (query) => {
        if (!query || query.length < 2) {
            setCustomers([]);
            return;
        }
        
        try {
            setCustomerLoading(true);
            const response = await axiosInstance.get(`/customers?search=${encodeURIComponent(query)}&limit=10`);
            setCustomers(response.data.customers || []);
        } catch (error) {
            console.error('Error searching customers:', error);
            toast({
                title: 'Error Searching Customers',
                description: 'Failed to search customers',
                status: 'error',
                duration: 3000,
                isClosable: true
            });
        } finally {
            setCustomerLoading(false);
        }
    }, [toast]);
    
    // Search effect
    useEffect(() => {
        const delayedSearch = setTimeout(() => {
            searchCustomers(searchTerm);
        }, 300);
        
        return () => clearTimeout(delayedSearch);
    }, [searchTerm, searchCustomers]);
    
    // Handle customer selection
    const handleCustomerSelect = (customer) => {
        setSelectedCustomer(customer);
        setValue('customer_id', customer.customer_id);
        onClose();
    };
    
    // Handle form submission
    const onSubmit = async (data) => {
        if (!selectedCustomer) {
            toast({
                title: 'Customer Required',
                description: 'Please select a customer for this pawn loan',
                status: 'error',
                duration: 3000,
                isClosable: true
            });
            return;
        }
        
        try {
            const pawnData = {
                customer_id: selectedCustomer.customer_id,
                item: {
                    description: data.item_description,
                    notes: data.item_notes || null
                },
                loan_amount: parseFloat(data.loan_amount),
                notes: data.transaction_notes || null
            };
            
            await axiosInstance.post('/transactions/pawn', pawnData);
            
            toast({
                title: 'Pawn Loan Created',
                description: `Pawn loan of ${formatCurrency(data.loan_amount)} created successfully`,
                status: 'success',
                duration: 3000,
                isClosable: true
            });
            
            // Navigate to transaction details or back to list
            navigate('/transactions');
        } catch (error) {
            console.error('Error creating pawn loan:', error);
            toast({
                title: 'Error Creating Pawn Loan',
                description: error.response?.data?.detail || 'Failed to create pawn loan',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        }
    };
    
    // Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    };
    
    // Format phone number
    const formatPhone = (phone) => {
        if (!phone) return 'N/A';
        return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    };
    
    return (
        <Box p={6}>
            {/* Header */}
            <Flex mb={6} align="center">
                <HStack>
                    <Tooltip label="Back to Transactions">
                        <IconButton
                            icon={<FiArrowLeft />}
                            variant="outline"
                            onClick={() => navigate('/transactions')}
                        />
                    </Tooltip>
                    <VStack align="start" spacing={0}>
                        <Heading size="lg">New Pawn Loan</Heading>
                        <Text color={textColor}>Create a new pawn loan transaction</Text>
                    </VStack>
                </HStack>
            </Flex>
            
            <form onSubmit={handleSubmit(onSubmit)}>
                <VStack spacing={6} align="stretch">
                    {/* Customer Selection */}
                    <Card bg={cardBg} border="1px" borderColor={borderColor}>
                        <CardHeader>
                            <HStack justify="space-between">
                                <HStack>
                                    <FiUser />
                                    <Heading size="md">Customer</Heading>
                                </HStack>
                                <Button
                                    leftIcon={<FiSearch />}
                                    onClick={onOpen}
                                    colorScheme="blue"
                                    variant="outline"
                                >
                                    {selectedCustomer ? 'Change Customer' : 'Select Customer'}
                                </Button>
                            </HStack>
                        </CardHeader>
                        <CardBody>
                            {selectedCustomer ? (
                                <Alert status="success">
                                    <AlertIcon />
                                    <Box>
                                        <Text fontWeight="bold">
                                            {selectedCustomer.full_name}
                                        </Text>
                                        <Text fontSize="sm">
                                            Phone: {formatPhone(selectedCustomer.phone)} | 
                                            Status: {selectedCustomer.status}
                                        </Text>
                                    </Box>
                                </Alert>
                            ) : (
                                <Alert status="warning">
                                    <AlertIcon />
                                    <Text>Please select a customer to continue</Text>
                                </Alert>
                            )}
                        </CardBody>
                    </Card>
                    
                    {/* Item Information */}
                    <Card bg={cardBg} border="1px" borderColor={borderColor}>
                        <CardHeader>
                            <HStack>
                                <FiPackage />
                                <Heading size="md">Item Information</Heading>
                            </HStack>
                        </CardHeader>
                        <CardBody>
                            <VStack spacing={4}>
                                <FormControl isInvalid={errors.item_description} isRequired>
                                    <FormLabel>Item Description</FormLabel>
                                    <Textarea
                                        {...register('item_description', {
                                            required: 'Item description is required',
                                            minLength: {
                                                value: 10,
                                                message: 'Description must be at least 10 characters'
                                            }
                                        })}
                                        placeholder="Detailed description of the item (e.g., 14k gold ring with diamonds, size 7)"
                                        rows={3}
                                    />
                                    <FormErrorMessage>
                                        {errors.item_description && errors.item_description.message}
                                    </FormErrorMessage>
                                </FormControl>
                                
                                <FormControl>
                                    <FormLabel>Item Notes (Optional)</FormLabel>
                                    <Textarea
                                        {...register('item_notes')}
                                        placeholder="Additional notes about the item condition or value"
                                        rows={2}
                                    />
                                </FormControl>
                            </VStack>
                        </CardBody>
                    </Card>
                    
                    {/* Loan Information */}
                    <Card bg={cardBg} border="1px" borderColor={borderColor}>
                        <CardHeader>
                            <HStack>
                                <FiDollarSign />
                                <Heading size="md">Loan Information</Heading>
                            </HStack>
                        </CardHeader>
                        <CardBody>
                            <VStack spacing={4}>
                                <FormControl isInvalid={errors.loan_amount} isRequired>
                                    <FormLabel>Loan Amount</FormLabel>
                                    <NumberInput min={1} precision={2}>
                                        <NumberInputField
                                            {...register('loan_amount', {
                                                required: 'Loan amount is required',
                                                min: {
                                                    value: 1,
                                                    message: 'Loan amount must be at least $1'
                                                }
                                            })}
                                            placeholder="0.00"
                                        />
                                        <NumberInputStepper>
                                            <NumberIncrementStepper />
                                            <NumberDecrementStepper />
                                        </NumberInputStepper>
                                    </NumberInput>
                                    <FormErrorMessage>
                                        {errors.loan_amount && errors.loan_amount.message}
                                    </FormErrorMessage>
                                </FormControl>
                                
                                <Alert status="info">
                                    <AlertIcon />
                                    <Box>
                                        <Text fontSize="sm">
                                            <strong>Loan Terms:</strong> 1 month term with 3-month grace period.
                                            Interest is calculated monthly and must be paid to renew.
                                        </Text>
                                    </Box>
                                </Alert>
                                
                                <FormControl>
                                    <FormLabel>Transaction Notes (Optional)</FormLabel>
                                    <Textarea
                                        {...register('transaction_notes')}
                                        placeholder="Any additional notes about this loan"
                                        rows={2}
                                    />
                                </FormControl>
                            </VStack>
                        </CardBody>
                    </Card>
                    
                    {/* Actions */}
                    <Card bg={cardBg} border="1px" borderColor={borderColor}>
                        <CardBody>
                            <HStack spacing={4}>
                                <Button
                                    type="submit"
                                    colorScheme="green"
                                    leftIcon={<FiSave />}
                                    isLoading={isSubmitting}
                                    loadingText="Creating Loan..."
                                    disabled={!selectedCustomer}
                                >
                                    Create Pawn Loan
                                </Button>
                                
                                <Button
                                    variant="outline"
                                    onClick={() => navigate('/transactions')}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </Button>
                            </HStack>
                        </CardBody>
                    </Card>
                </VStack>
            </form>
            
            {/* Customer Search Modal */}
            <Modal isOpen={isOpen} onClose={onClose} size="lg">
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Select Customer</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <VStack spacing={4} align="stretch">
                            <InputGroup>
                                <InputLeftElement pointerEvents="none">
                                    <FiSearch color="gray.300" />
                                </InputLeftElement>
                                <Input
                                    placeholder="Search customers by name, phone, or email..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </InputGroup>
                            
                            {searchTerm.length < 2 && (
                                <Alert status="info">
                                    <AlertIcon />
                                    <Text>Enter at least 2 characters to search for customers</Text>
                                </Alert>
                            )}
                            
                            {customerLoading ? (
                                <VStack spacing={2}>
                                    {[...Array(3)].map((_, i) => (
                                        <Skeleton key={i} height="60px" />
                                    ))}
                                </VStack>
                            ) : customers.length > 0 ? (
                                <TableContainer>
                                    <Table variant="simple" size="sm">
                                        <Thead>
                                            <Tr>
                                                <Th>Name</Th>
                                                <Th>Phone</Th>
                                                <Th>Status</Th>
                                                <Th>Action</Th>
                                            </Tr>
                                        </Thead>
                                        <Tbody>
                                            {customers.map((customer) => (
                                                <Tr key={customer.customer_id}>
                                                    <Td>{customer.full_name}</Td>
                                                    <Td>{formatPhone(customer.phone)}</Td>
                                                    <Td>
                                                        <Badge 
                                                            colorScheme={customer.status === 'active' ? 'green' : 'red'}
                                                        >
                                                            {customer.status}
                                                        </Badge>
                                                    </Td>
                                                    <Td>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleCustomerSelect(customer)}
                                                            disabled={customer.status !== 'active'}
                                                        >
                                                            Select
                                                        </Button>
                                                    </Td>
                                                </Tr>
                                            ))}
                                        </Tbody>
                                    </Table>
                                </TableContainer>
                            ) : searchTerm.length >= 2 && (
                                <Alert status="warning">
                                    <AlertIcon />
                                    <Box>
                                        <Text>No customers found matching your search.</Text>
                                        <Button
                                            size="sm"
                                            leftIcon={<FiPlus />}
                                            onClick={() => {
                                                onClose();
                                                navigate('/customers/new');
                                            }}
                                            mt={2}
                                        >
                                            Create New Customer
                                        </Button>
                                    </Box>
                                </Alert>
                            )}
                        </VStack>
                    </ModalBody>
                    <ModalFooter>
                        <Button onClick={onClose}>Cancel</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </Box>
    );
};

export default NewPawnLoan;