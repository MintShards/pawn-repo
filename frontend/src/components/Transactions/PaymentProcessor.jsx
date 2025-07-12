import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    VStack,
    HStack,
    Text,
    Input,
    FormControl,
    FormLabel,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    NumberIncrementStepper,
    NumberDecrementStepper,
    Textarea,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    Card,
    CardBody,
    CardHeader,
    Divider,
    Badge,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    TableContainer,
    Select,
    IconButton,
    Tooltip,
    useToast,
    useColorModeValue,
    Spinner,
    Grid,
    GridItem,
    Stat,
    StatLabel,
    StatNumber,
    StatHelpText,
    Flex,
    Spacer
} from '@chakra-ui/react';
import {
    FiSearch,
    FiDollarSign,
    FiPrinter,
    FiRefreshCw,
    FiCreditCard,
    FiCheck,
    FiAlertTriangle
} from 'react-icons/fi';
import axiosInstance from '../../services/axios';

const PaymentProcessor = () => {
    const toast = useToast();
    
    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentType, setPaymentType] = useState('partial');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [paymentScenarios, setPaymentScenarios] = useState([]);
    const [loading, setLoading] = useState(false);
    const [processingPayment, setProcessingPayment] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    
    // Color mode values
    const cardBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const accentColor = useColorModeValue('blue.50', 'blue.900');
    
    // Search for loans
    const searchLoans = async () => {
        if (!searchTerm.trim()) {
            toast({
                title: 'Search Required',
                description: 'Please enter a customer phone number or transaction ID',
                status: 'warning',
                duration: 3000,
                isClosable: true
            });
            return;
        }
        
        try {
            setSearchLoading(true);
            // Search by phone number first
            if (searchTerm.match(/^\+?[\d\s\-\(\)]+$/)) {
                const response = await axiosInstance.get(`/customers/search/phone/${searchTerm.replace(/\D/g, '')}`);
                if (response.data) {
                    const customerLoansResponse = await axiosInstance.get(`/transactions?customer_id=${response.data.customer_id}&status=active`);
                    setSearchResults(customerLoansResponse.data || []);
                }
            } else {
                // Search by transaction ID
                const response = await axiosInstance.get(`/transactions?search=${searchTerm}`);
                setSearchResults(response.data || []);
            }
        } catch (error) {
            console.error('Error searching loans:', error);
            toast({
                title: 'Search Error',
                description: error.response?.data?.detail || 'No loans found matching your search',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    };
    
    // Fetch payment scenarios
    const fetchPaymentScenarios = async (loanId) => {
        try {
            setLoading(true);
            const response = await axiosInstance.get(`/transactions/loan/${loanId}/scenarios`);
            setPaymentScenarios(response.data || []);
        } catch (error) {
            console.error('Error fetching payment scenarios:', error);
            setPaymentScenarios([]);
        } finally {
            setLoading(false);
        }
    };
    
    // Select loan for payment
    const selectLoan = (loan) => {
        setSelectedLoan(loan);
        setPaymentAmount('');
        setPaymentNotes('');
        fetchPaymentScenarios(loan.transaction_id);
    };
    
    // Process payment
    const processPayment = async () => {
        if (!selectedLoan || !paymentAmount) return;
        
        try {
            setProcessingPayment(true);
            
            // Process payment
            const paymentResponse = await axiosInstance.post('/transactions/payment', {
                loan_id: selectedLoan.transaction_id,
                amount: parseFloat(paymentAmount),
                payment_type: paymentType,
                notes: paymentNotes || null
            });
            
            toast({
                title: 'Payment Processed Successfully',
                description: `Payment of $${paymentAmount} has been processed`,
                status: 'success',
                duration: 5000,
                isClosable: true
            });
            
            // Generate payment receipt
            try {
                const receiptResponse = await axiosInstance.post(
                    `/transactions/payment-receipt?loan_id=${selectedLoan.transaction_id}&payment_amount=${paymentAmount}`,
                    {},
                    { responseType: 'blob' }
                );
                
                // Auto-download payment receipt
                const blob = new Blob([receiptResponse.data], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `payment_receipt_${selectedLoan.transaction_number}.pdf`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                
                toast({
                    title: 'Receipt Generated',
                    description: 'Payment receipt has been downloaded',
                    status: 'info',
                    duration: 3000,
                    isClosable: true
                });
            } catch (receiptError) {
                console.warn('Could not generate payment receipt:', receiptError);
            }
            
            // Reset form and refresh
            setPaymentAmount('');
            setPaymentNotes('');
            setSelectedLoan(null);
            setSearchResults([]);
            setSearchTerm('');
            
        } catch (error) {
            console.error('Error processing payment:', error);
            toast({
                title: 'Payment Failed',
                description: error.response?.data?.detail || 'Failed to process payment',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        } finally {
            setProcessingPayment(false);
        }
    };
    
    // Use payment scenario
    const useScenario = (scenario) => {
        setPaymentAmount(scenario.amount.toString());
        setPaymentType(scenario.type);
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
            year: 'numeric'
        });
    };
    
    return (
        <Box p={6}>
            <VStack spacing={6} align="stretch">
                {/* Header */}
                <Box>
                    <Text fontSize="2xl" fontWeight="bold" mb={2}>
                        Payment Processor
                    </Text>
                    <Text color="gray.600">
                        Search for active loans and process customer payments
                    </Text>
                </Box>
                
                {/* Search Section */}
                <Card bg={cardBg} border="1px" borderColor={borderColor}>
                    <CardHeader>
                        <Text fontSize="lg" fontWeight="semibold">
                            Find Loan to Process Payment
                        </Text>
                    </CardHeader>
                    <CardBody>
                        <HStack spacing={4}>
                            <FormControl flex={1}>
                                <FormLabel>Customer Phone or Transaction ID</FormLabel>
                                <Input
                                    placeholder="Enter phone number or transaction ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && searchLoans()}
                                />
                            </FormControl>
                            <Button
                                colorScheme="blue"
                                leftIcon={<FiSearch />}
                                onClick={searchLoans}
                                isLoading={searchLoading}
                                loadingText="Searching..."
                                mt={8}
                            >
                                Search
                            </Button>
                        </HStack>
                        
                        {/* Search Results */}
                        {searchResults.length > 0 && (
                            <Box mt={6}>
                                <Text fontWeight="semibold" mb={3}>
                                    Active Loans Found:
                                </Text>
                                <TableContainer>
                                    <Table variant="simple" size="sm">
                                        <Thead>
                                            <Tr>
                                                <Th>Transaction #</Th>
                                                <Th>Customer</Th>
                                                <Th>Items</Th>
                                                <Th>Current Balance</Th>
                                                <Th>Due Date</Th>
                                                <Th>Action</Th>
                                            </Tr>
                                        </Thead>
                                        <Tbody>
                                            {searchResults.map((loan) => (
                                                <Tr key={loan.transaction_id}>
                                                    <Td>{loan.transaction_number}</Td>
                                                    <Td>{loan.customer_name}</Td>
                                                    <Td>{loan.item_count} item(s)</Td>
                                                    <Td>{formatCurrency(loan.current_balance)}</Td>
                                                    <Td>{formatDate(loan.maturity_date)}</Td>
                                                    <Td>
                                                        <Button
                                                            size="sm"
                                                            colorScheme="green"
                                                            leftIcon={<FiDollarSign />}
                                                            onClick={() => selectLoan(loan)}
                                                        >
                                                            Process Payment
                                                        </Button>
                                                    </Td>
                                                </Tr>
                                            ))}
                                        </Tbody>
                                    </Table>
                                </TableContainer>
                            </Box>
                        )}
                    </CardBody>
                </Card>
                
                {/* Payment Processing Section */}
                {selectedLoan && (
                    <Card bg={cardBg} border="1px" borderColor={borderColor}>
                        <CardHeader>
                            <Flex align="center">
                                <Box>
                                    <Text fontSize="lg" fontWeight="semibold">
                                        Process Payment - Transaction #{selectedLoan.transaction_number}
                                    </Text>
                                    <Text fontSize="sm" color="gray.600">
                                        Customer: {selectedLoan.customer_name}
                                    </Text>
                                </Box>
                                <Spacer />
                                <Badge colorScheme="blue" fontSize="md" p={2}>
                                    Current Balance: {formatCurrency(selectedLoan.current_balance)}
                                </Badge>
                            </Flex>
                        </CardHeader>
                        <CardBody>
                            <Grid templateColumns="1fr 1fr" gap={6}>
                                {/* Payment Scenarios */}
                                <GridItem>
                                    <Text fontWeight="semibold" mb={3}>
                                        Payment Options:
                                    </Text>
                                    {loading ? (
                                        <Flex justify="center" py={4}>
                                            <Spinner />
                                        </Flex>
                                    ) : paymentScenarios.length > 0 ? (
                                        <VStack spacing={3} align="stretch">
                                            {paymentScenarios.map((scenario, index) => (
                                                <Card key={index} size="sm" cursor="pointer" onClick={() => useScenario(scenario)}>
                                                    <CardBody>
                                                        <HStack justify="space-between">
                                                            <Box>
                                                                <Text fontWeight="medium">
                                                                    {scenario.name || scenario.type}
                                                                </Text>
                                                                <Text fontSize="sm" color="gray.600">
                                                                    {scenario.description}
                                                                </Text>
                                                            </Box>
                                                            <VStack align="end" spacing={0}>
                                                                <Text fontWeight="bold" color="green.500">
                                                                    {formatCurrency(scenario.amount)}
                                                                </Text>
                                                                <Text fontSize="xs" color="gray.500">
                                                                    Click to use
                                                                </Text>
                                                            </VStack>
                                                        </HStack>
                                                    </CardBody>
                                                </Card>
                                            ))}
                                        </VStack>
                                    ) : (
                                        <Alert status="info">
                                            <AlertIcon />
                                            <AlertDescription>
                                                No payment scenarios available
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </GridItem>
                                
                                {/* Payment Form */}
                                <GridItem>
                                    <VStack spacing={4} align="stretch">
                                        <FormControl isRequired>
                                            <FormLabel>Payment Amount</FormLabel>
                                            <NumberInput
                                                value={paymentAmount}
                                                onChange={(value) => setPaymentAmount(value)}
                                                min={0}
                                                max={parseFloat(selectedLoan.current_balance)}
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
                                            <FormLabel>Payment Type</FormLabel>
                                            <Select
                                                value={paymentType}
                                                onChange={(e) => setPaymentType(e.target.value)}
                                            >
                                                <option value="partial">Partial Payment</option>
                                                <option value="full">Full Payment</option>
                                                <option value="interest">Interest Only</option>
                                                <option value="extension">Extension Fee</option>
                                            </Select>
                                        </FormControl>
                                        
                                        <FormControl>
                                            <FormLabel>Payment Notes (Optional)</FormLabel>
                                            <Textarea
                                                value={paymentNotes}
                                                onChange={(e) => setPaymentNotes(e.target.value)}
                                                placeholder="Add any notes about this payment..."
                                                rows={3}
                                            />
                                        </FormControl>
                                        
                                        <HStack spacing={3} pt={4}>
                                            <Button
                                                colorScheme="green"
                                                leftIcon={<FiCreditCard />}
                                                onClick={processPayment}
                                                isLoading={processingPayment}
                                                loadingText="Processing..."
                                                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                                                flex={1}
                                            >
                                                Process Payment
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => setSelectedLoan(null)}
                                            >
                                                Cancel
                                            </Button>
                                        </HStack>
                                    </VStack>
                                </GridItem>
                            </Grid>
                        </CardBody>
                    </Card>
                )}
                
                {/* Instructions */}
                <Alert status="info">
                    <AlertIcon />
                    <Box>
                        <AlertTitle>Payment Processing Instructions:</AlertTitle>
                        <AlertDescription>
                            1. Search for customer by phone number or transaction ID<br/>
                            2. Select the loan to process payment for<br/>
                            3. Choose a payment scenario or enter custom amount<br/>
                            4. Process payment and receipt will be automatically generated
                        </AlertDescription>
                    </Box>
                </Alert>
            </VStack>
        </Box>
    );
};

export default PaymentProcessor;