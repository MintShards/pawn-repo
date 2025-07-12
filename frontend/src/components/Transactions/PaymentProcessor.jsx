import React, { useState, useEffect, useCallback } from 'react';
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
    Spacer,
    List,
    ListItem,
    ListIcon
} from '@chakra-ui/react';
import {
    FiSearch,
    FiDollarSign,
    FiPrinter,
    FiRefreshCw,
    FiCreditCard,
    FiCheck,
    FiAlertTriangle,
    FiUser,
    FiPhone
} from 'react-icons/fi';
import axiosInstance from '../../services/axios';
import PaymentCalculator from '../Common/PaymentCalculator';

const PaymentProcessor = () => {
    const toast = useToast();
    
    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [customerSuggestions, setCustomerSuggestions] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentType, setPaymentType] = useState('partial');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [paymentScenarios, setPaymentScenarios] = useState([]);
    const [loanStatus, setLoanStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [processingPayment, setProcessingPayment] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    // Color mode values
    const cardBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const accentColor = useColorModeValue('blue.50', 'blue.900');
    
    // Real-time customer search with debounce
    const searchCustomers = useCallback(async (query) => {
        if (!query || query.length < 3) {
            setCustomerSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        
        try {
            let customers = [];
            
            // Search by phone number if it looks like a phone
            if (query.match(/^\+?[\d\s\-\(\)]+$/)) {
                const phoneOnly = query.replace(/\D/g, '');
                if (phoneOnly.length >= 3) {
                    try {
                        const response = await axiosInstance.get(`/customers/lookup/phone/${phoneOnly}`);
                        customers = [response.data];
                    } catch (error) {
                        // If exact phone not found, search by partial phone
                        const searchResponse = await axiosInstance.get(`/customers?phone=${phoneOnly}&limit=5`);
                        customers = searchResponse.data;
                    }
                }
            } else {
                // Search by name
                const response = await axiosInstance.get(`/customers/search/name/${encodeURIComponent(query)}?limit=5`);
                customers = response.data;
            }
            
            setCustomerSuggestions(customers);
            setShowSuggestions(customers.length > 0);
        } catch (error) {
            console.error('Error searching customers:', error);
            setCustomerSuggestions([]);
            setShowSuggestions(false);
        }
    }, []);
    
    // Debounced search effect
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            searchCustomers(searchTerm);
        }, 300);
        
        return () => clearTimeout(timeoutId);
    }, [searchTerm, searchCustomers]);
    
    // Search for active loans for selected customer
    const searchLoansForCustomer = async (customer) => {
        try {
            setSearchLoading(true);
            setSelectedCustomer(customer);
            setShowSuggestions(false);
            setSearchTerm(`${customer.first_name} ${customer.last_name} (${customer.phone})`);
            
            // Search for active transactions for this customer
            const response = await axiosInstance.post('/transactions/search', {
                customer_id: customer.customer_id,
                transaction_type: 'pawn',
                loan_status: 'active'
            });
            
            setSearchResults(response.data || []);
            
            if (response.data.length === 0) {
                toast({
                    title: 'No Active Loans',
                    description: `${customer.first_name} ${customer.last_name} has no active loans`,
                    status: 'info',
                    duration: 4000,
                    isClosable: true
                });
            }
        } catch (error) {
            console.error('Error searching loans for customer:', error);
            toast({
                title: 'Search Error',
                description: error.response?.data?.detail || 'Failed to load customer loans',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    };
    
    // Fetch loan status and payment scenarios
    const fetchLoanDetails = async (loanId) => {
        try {
            setLoading(true);
            
            // Fetch both loan status and payment scenarios in parallel
            const [statusResponse, scenariosResponse] = await Promise.all([
                axiosInstance.get(`/transactions/loan/${loanId}/status`),
                axiosInstance.get(`/transactions/loan/${loanId}/scenarios`)
            ]);
            
            setLoanStatus(statusResponse.data);
            setPaymentScenarios(scenariosResponse.data || []);
        } catch (error) {
            console.error('Error fetching loan details:', error);
            toast({
                title: 'Error Loading Loan Details',
                description: error.response?.data?.detail || 'Failed to load loan information',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
            setLoanStatus(null);
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
        fetchLoanDetails(loan.transaction_id);
    };
    
    // Process payment with corrected API call
    const processPayment = async () => {
        if (!selectedLoan || !paymentAmount) return;
        
        try {
            setProcessingPayment(true);
            
            // Process payment with correct schema
            const paymentData = {
                loan_id: selectedLoan.transaction_id,
                payment_amount: parseFloat(paymentAmount), // Correct field name
                payment_date: new Date().toISOString().split('T')[0], // Current date
                payment_method: 'cash', // Default payment method
                notes: paymentNotes || null
            };
            
            const paymentResponse = await axiosInstance.post('/transactions/payment', paymentData);
            
            toast({
                title: 'Payment Processed Successfully',
                description: paymentResponse.data.message || `Payment of $${paymentAmount} has been processed`,
                status: 'success',
                duration: 5000,
                isClosable: true
            });
            
            // Generate payment receipt
            try {
                const receiptResponse = await axiosInstance.post(
                    `/transactions/payment-receipt`,
                    {
                        loan_id: selectedLoan.transaction_id,
                        payment_amount: parseFloat(paymentAmount)
                    },
                    { responseType: 'blob' }
                );
                
                // Auto-download payment receipt
                const blob = new Blob([receiptResponse.data], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `payment_receipt_${selectedLoan.receipt_number || 'transaction'}.pdf`;
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
                toast({
                    title: 'Receipt Notice',
                    description: 'Payment successful but receipt generation failed',
                    status: 'warning',
                    duration: 3000,
                    isClosable: true
                });
            }
            
            // Reset form and refresh
            setPaymentAmount('');
            setPaymentNotes('');
            setPaymentType('partial');
            setSelectedLoan(null);
            setLoanStatus(null);
            setSearchResults([]);
            setSearchTerm('');
            setSelectedCustomer(null);
            setPaymentScenarios([]);
            
            // Success feedback with payment details
            const paymentDetails = paymentResponse.data;
            if (paymentDetails.payment_allocation) {
                const allocation = paymentDetails.payment_allocation;
                toast({
                    title: 'Payment Details',
                    description: `Interest: $${allocation.interest_payment.toFixed(2)}, Principal: $${allocation.principal_payment.toFixed(2)}, New Balance: $${allocation.new_balance.toFixed(2)}`,
                    status: 'info',
                    duration: 8000,
                    isClosable: true
                });
            }
            
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
        setPaymentAmount(scenario.payment_amount.toString());
        
        // Determine payment type based on scenario
        if (scenario.is_full_redemption) {
            setPaymentType('full');
        } else if (scenario.scenario_name.toLowerCase().includes('interest')) {
            setPaymentType('interest');
        } else {
            setPaymentType('partial');
        }
        
        toast({
            title: 'Scenario Selected',
            description: `${scenario.scenario_name}: $${scenario.payment_amount.toFixed(2)}`,
            status: 'info',
            duration: 2000,
            isClosable: true
        });
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
                            Find Customer & Active Loans
                        </Text>
                    </CardHeader>
                    <CardBody>
                        <VStack spacing={4} align="stretch">
                            <FormControl>
                                <FormLabel>Search Customer by Name or Phone</FormLabel>
                                <Box position="relative">
                                    <Input
                                        placeholder="Type customer name or phone number..."
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            if (!e.target.value) {
                                                setSelectedCustomer(null);
                                                setSearchResults([]);
                                            }
                                        }}
                                        onFocus={() => searchTerm.length >= 3 && setShowSuggestions(true)}
                                    />
                                    
                                    {/* Customer suggestions dropdown */}
                                    {showSuggestions && customerSuggestions.length > 0 && (
                                        <Box
                                            position="absolute"
                                            top="100%"
                                            left={0}
                                            right={0}
                                            bg={cardBg}
                                            border="1px"
                                            borderColor={borderColor}
                                            borderRadius="md"
                                            shadow="lg"
                                            zIndex={10}
                                            maxH="200px"
                                            overflowY="auto"
                                        >
                                            <List spacing={0}>
                                                {customerSuggestions.map((customer) => (
                                                    <ListItem
                                                        key={customer.customer_id}
                                                        px={3}
                                                        py={2}
                                                        cursor="pointer"
                                                        _hover={{ bg: accentColor }}
                                                        onClick={() => searchLoansForCustomer(customer)}
                                                        borderBottom="1px"
                                                        borderColor={borderColor}
                                                    >
                                                        <HStack>
                                                            <ListIcon as={FiUser} color="blue.500" />
                                                            <VStack align="start" spacing={0}>
                                                                <Text fontWeight="medium">
                                                                    {customer.first_name} {customer.last_name}
                                                                </Text>
                                                                <HStack>
                                                                    <FiPhone size={12} />
                                                                    <Text fontSize="sm" color="gray.600">
                                                                        {customer.phone}
                                                                    </Text>
                                                                    <Badge 
                                                                        colorScheme={customer.status === 'active' ? 'green' : 'red'}
                                                                        size="sm"
                                                                    >
                                                                        {customer.status}
                                                                    </Badge>
                                                                </HStack>
                                                            </VStack>
                                                        </HStack>
                                                    </ListItem>
                                                ))}
                                            </List>
                                        </Box>
                                    )}
                                </Box>
                                {searchTerm.length > 0 && searchTerm.length < 3 && (
                                    <Text fontSize="sm" color="gray.500" mt={1}>
                                        Type at least 3 characters to search
                                    </Text>
                                )}
                            </FormControl>
                            
                            {selectedCustomer && (
                                <Alert status="info">
                                    <AlertIcon />
                                    <Box>
                                        <Text fontWeight="medium">
                                            Selected: {selectedCustomer.first_name} {selectedCustomer.last_name}
                                        </Text>
                                        <Text fontSize="sm">{selectedCustomer.phone}</Text>
                                    </Box>
                                </Alert>
                            )}
                        </VStack>
                        
                        {/* Active Loans for Selected Customer */}
                        {searchLoading && (
                            <Flex justify="center" py={4}>
                                <Spinner />
                                <Text ml={2}>Loading customer loans...</Text>
                            </Flex>
                        )}
                        
                        {searchResults.length > 0 && (
                            <Box mt={6}>
                                <Text fontWeight="semibold" mb={3}>
                                    Active Loans for {selectedCustomer?.first_name} {selectedCustomer?.last_name}:
                                </Text>
                                <VStack spacing={3} align="stretch">
                                    {searchResults.map((loan) => (
                                        <Card key={loan.transaction_id} size="sm" cursor="pointer" 
                                              border="2px" borderColor="transparent"
                                              _hover={{ borderColor: 'blue.200', shadow: 'md' }}
                                              onClick={() => selectLoan(loan)}
                                        >
                                            <CardBody>
                                                <Grid templateColumns="1fr auto" gap={4} alignItems="center">
                                                    <VStack align="start" spacing={1}>
                                                        <HStack>
                                                            <Text fontWeight="bold">
                                                                {loan.receipt_number || `Loan #${loan.transaction_id.slice(0, 8)}`}
                                                            </Text>
                                                            <Badge 
                                                                colorScheme={loan.loan_status === 'active' ? 'green' : 
                                                                           loan.loan_status === 'overdue' ? 'red' : 'yellow'}
                                                            >
                                                                {loan.loan_status}
                                                            </Badge>
                                                        </HStack>
                                                        <Text fontSize="sm" color="gray.600">
                                                            Principal: {formatCurrency(loan.principal_amount)}
                                                        </Text>
                                                        <Text fontSize="sm" color="gray.600">
                                                            Due: {formatDate(loan.current_due_date)}
                                                        </Text>
                                                        {loan.days_until_due !== null && (
                                                            <Text fontSize="sm" color={loan.days_until_due < 0 ? 'red.500' : 'gray.600'}>
                                                                {loan.days_until_due < 0 ? 
                                                                    `${Math.abs(loan.days_until_due)} days overdue` :
                                                                    `${loan.days_until_due} days until due`
                                                                }
                                                            </Text>
                                                        )}
                                                    </VStack>
                                                    <VStack align="end" spacing={1}>
                                                        <Text fontSize="lg" fontWeight="bold" color="green.500">
                                                            {formatCurrency(loan.current_balance)}
                                                        </Text>
                                                        <Button
                                                            size="sm"
                                                            colorScheme="blue"
                                                            leftIcon={<FiDollarSign />}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                selectLoan(loan);
                                                            }}
                                                        >
                                                            Pay Now
                                                        </Button>
                                                    </VStack>
                                                </Grid>
                                            </CardBody>
                                        </Card>
                                    ))}
                                </VStack>
                            </Box>
                        )}
                        
                        {selectedCustomer && searchResults.length === 0 && !searchLoading && (
                            <Alert status="info" mt={4}>
                                <AlertIcon />
                                <Box>
                                    <AlertTitle>No Active Loans Found</AlertTitle>
                                    <AlertDescription>
                                        {selectedCustomer.first_name} {selectedCustomer.last_name} has no active loans requiring payments.
                                        <br/>
                                        <Text fontSize="sm" mt={2} color="gray.600">
                                            If you expect this customer to have active loans, please verify:
                                            <br/>• Customer information is correct
                                            <br/>• Loans haven't been recently paid off
                                            <br/>• Loans haven't been forfeited
                                        </Text>
                                    </AlertDescription>
                                </Box>
                            </Alert>
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
                                        Process Payment - {selectedLoan.receipt_number || `Loan #${selectedLoan.transaction_id.slice(0, 8)}`}
                                    </Text>
                                    <Text fontSize="sm" color="gray.600">
                                        Customer: {selectedCustomer?.first_name} {selectedCustomer?.last_name}
                                    </Text>
                                    {loanStatus && (
                                        <HStack mt={2} spacing={4}>
                                            <Text fontSize="sm">
                                                <strong>Monthly Interest:</strong> {formatCurrency(loanStatus.monthly_interest_fee)}
                                            </Text>
                                            <Text fontSize="sm">
                                                <strong>Minimum Payment:</strong> {formatCurrency(loanStatus.minimum_payment_required)}
                                            </Text>
                                        </HStack>
                                    )}
                                </Box>
                                <Spacer />
                                <VStack align="end" spacing={1}>
                                    <Badge colorScheme="blue" fontSize="md" p={2}>
                                        Balance: {formatCurrency(selectedLoan.current_balance)}
                                    </Badge>
                                    {loanStatus && (
                                        <Badge 
                                            colorScheme={loanStatus.total_amount_owed > loanStatus.current_balance ? 'orange' : 'green'}
                                            fontSize="sm" p={1}
                                        >
                                            Total Owed: {formatCurrency(loanStatus.total_amount_owed)}
                                        </Badge>
                                    )}
                                </VStack>
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
                                            <Text ml={2}>Loading payment options...</Text>
                                        </Flex>
                                    ) : paymentScenarios.length > 0 ? (
                                        <VStack spacing={3} align="stretch">
                                            {paymentScenarios.map((scenario, index) => (
                                                <Card 
                                                    key={index} 
                                                    size="sm" 
                                                    cursor="pointer" 
                                                    onClick={() => useScenario(scenario)}
                                                    border="2px"
                                                    borderColor="transparent"
                                                    _hover={{ borderColor: 'green.200', shadow: 'md' }}
                                                >
                                                    <CardBody>
                                                        <VStack align="stretch" spacing={2}>
                                                            <HStack justify="space-between">
                                                                <Box>
                                                                    <Text fontWeight="bold" color="green.600">
                                                                        {scenario.scenario_name}
                                                                    </Text>
                                                                    {scenario.is_full_redemption && (
                                                                        <Badge colorScheme="green" size="sm" ml={2}>
                                                                            Full Payoff
                                                                        </Badge>
                                                                    )}
                                                                </Box>
                                                                <Text fontWeight="bold" color="green.500" fontSize="lg">
                                                                    {formatCurrency(scenario.payment_amount)}
                                                                </Text>
                                                            </HStack>
                                                            
                                                            {/* Payment breakdown */}
                                                            <HStack spacing={4} fontSize="sm" color="gray.600">
                                                                {scenario.amount_breakdown.interest > 0 && (
                                                                    <Text>
                                                                        Interest: {formatCurrency(scenario.amount_breakdown.interest)}
                                                                    </Text>
                                                                )}
                                                                {scenario.amount_breakdown.principal > 0 && (
                                                                    <Text>
                                                                        Principal: {formatCurrency(scenario.amount_breakdown.principal)}
                                                                    </Text>
                                                                )}
                                                            </HStack>
                                                            
                                                            <HStack justify="space-between" fontSize="sm">
                                                                <Text color="gray.600">
                                                                    New Balance: {formatCurrency(scenario.resulting_balance)}
                                                                </Text>
                                                                <Text color="gray.600">
                                                                    Due: {formatDate(scenario.new_due_date)}
                                                                </Text>
                                                            </HStack>
                                                            
                                                            <Text fontSize="xs" color="blue.500" textAlign="center">
                                                                Click to select this payment option
                                                            </Text>
                                                        </VStack>
                                                    </CardBody>
                                                </Card>
                                            ))}
                                        </VStack>
                                    ) : (
                                        <Alert status="info">
                                            <AlertIcon />
                                            <AlertDescription>
                                                Loading payment scenarios...
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </GridItem>
                                
                                {/* Payment Calculator & Form */}
                                <GridItem>
                                    <VStack spacing={4} align="stretch">
                                        {/* Real-time Payment Calculator */}
                                        <PaymentCalculator 
                                            loanStatus={loanStatus}
                                            paymentAmount={paymentAmount}
                                            onPaymentChange={setPaymentAmount}
                                        />
                                        {/* Quick Amount Buttons */}
                                        <Box>
                                            <Text fontSize="sm" fontWeight="medium" mb={2}>
                                                Quick Amounts:
                                            </Text>
                                            <HStack spacing={2} flexWrap="wrap">
                                                {loanStatus && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setPaymentAmount(loanStatus.minimum_payment_required.toString())}
                                                        >
                                                            Min: {formatCurrency(loanStatus.minimum_payment_required)}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setPaymentAmount((loanStatus.current_balance / 2).toFixed(2))}
                                                        >
                                                            Half: {formatCurrency(loanStatus.current_balance / 2)}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            colorScheme="green"
                                                            onClick={() => setPaymentAmount(loanStatus.total_amount_owed.toString())}
                                                        >
                                                            Full: {formatCurrency(loanStatus.total_amount_owed)}
                                                        </Button>
                                                    </>
                                                )}
                                            </HStack>
                                        </Box>
                                        
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
                                                disabled={
                                                    !paymentAmount || 
                                                    parseFloat(paymentAmount) <= 0 ||
                                                    (loanStatus && parseFloat(paymentAmount) < loanStatus.minimum_payment_required)
                                                }
                                                flex={1}
                                                size="lg"
                                            >
                                                Process ${paymentAmount || '0.00'} Payment
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
                
                {/* Enhanced Instructions */}
                <Alert status="info">
                    <AlertIcon />
                    <Box>
                        <AlertTitle>Payment Processing Guide:</AlertTitle>
                        <AlertDescription>
                            <VStack align="start" spacing={2} mt={2}>
                                <HStack>
                                    <Badge colorScheme="blue" variant="outline">1</Badge>
                                    <Text fontSize="sm">Search customer by typing name or phone number (minimum 3 characters)</Text>
                                </HStack>
                                <HStack>
                                    <Badge colorScheme="blue" variant="outline">2</Badge>
                                    <Text fontSize="sm">Select customer from suggestions to view their active loans</Text>
                                </HStack>
                                <HStack>
                                    <Badge colorScheme="blue" variant="outline">3</Badge>
                                    <Text fontSize="sm">Choose loan and review payment scenarios or use the calculator</Text>
                                </HStack>
                                <HStack>
                                    <Badge colorScheme="blue" variant="outline">4</Badge>
                                    <Text fontSize="sm">Enter payment amount and add optional notes</Text>
                                </HStack>
                                <HStack>
                                    <Badge colorScheme="blue" variant="outline">5</Badge>
                                    <Text fontSize="sm">Process payment - receipt will be automatically generated</Text>
                                </HStack>
                                
                                <Box mt={3} p={2} bg="blue.50" borderRadius="md">
                                    <Text fontSize="xs" fontWeight="bold" color="blue.700">Payment Types:</Text>
                                    <Text fontSize="xs" color="blue.600">• Interest Only: Extends loan by 1 month</Text>
                                    <Text fontSize="xs" color="blue.600">• Partial Payment: Reduces balance and extends loan</Text>
                                    <Text fontSize="xs" color="blue.600">• Full Redemption: Pays off loan completely</Text>
                                </Box>
                            </VStack>
                        </AlertDescription>
                    </Box>
                </Alert>
            </VStack>
        </Box>
    );
};

export default PaymentProcessor;