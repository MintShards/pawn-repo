import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Button,
    VStack,
    HStack,
    Text,
    Input,
    Select,
    Card,
    CardBody,
    CardHeader,
    Heading,
    useColorModeValue,
    useToast,
    Alert,
    AlertIcon,
    Flex,
    Spacer,
    IconButton,
    Tooltip,
    FormControl,
    FormLabel,
    Grid,
    Stat,
    StatLabel,
    StatNumber,
    StatHelpText,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    TableContainer,
    Badge,
    Skeleton,
    SkeletonText
} from '@chakra-ui/react';
import {
    FiDownload,
    FiRefreshCw,
    FiFileText
} from 'react-icons/fi';
import axiosInstance from '../../services/axios';

const Reports = () => {
    const toast = useToast();
    
    // State
    const [loading, setLoading] = useState(false);
    const [reports, setReports] = useState({
        financial: null,
        transactions: [],
        inventory: [],
        customerActivity: [],
        agedLoans: []
    });
    const [dateRange, setDateRange] = useState({
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0]
    });
    const [reportType, setReportType] = useState('financial');
    
    // Color mode values
    const cardBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const textColor = useColorModeValue('gray.600', 'gray.300');
    const statBg = useColorModeValue('gray.50', 'gray.700');
    
    // Fetch reports
    const fetchReports = useCallback(async () => {
        try {
            setLoading(true);
            
            const promises = [];
            
            // Financial report
            promises.push(
                axiosInstance.get('/reports/financial', {
                    params: dateRange
                }).then(res => ({ type: 'financial', data: res.data }))
            );
            
            // Transaction report
            promises.push(
                axiosInstance.get('/reports/transactions', {
                    params: { ...dateRange, format: 'json' }
                }).then(res => ({ type: 'transactions', data: res.data }))
            );
            
            // Inventory report
            promises.push(
                axiosInstance.get('/reports/inventory', {
                    params: { format: 'json' }
                }).then(res => ({ type: 'inventory', data: res.data }))
            );
            
            // Customer activity report
            promises.push(
                axiosInstance.get('/reports/customer-activity', {
                    params: { ...dateRange, min_transactions: 1 }
                }).then(res => ({ type: 'customerActivity', data: res.data }))
            );
            
            // Aged loans report
            promises.push(
                axiosInstance.get('/reports/aged-loans')
                    .then(res => ({ type: 'agedLoans', data: res.data }))
            );
            
            const results = await Promise.all(promises);
            
            const newReports = { ...reports };
            results.forEach(result => {
                newReports[result.type] = result.data;
            });
            
            setReports(newReports);
        } catch (error) {
            console.error('Error fetching reports:', error);
            toast({
                title: 'Error Loading Reports',
                description: error.response?.data?.detail || 'Failed to load reports',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        } finally {
            setLoading(false);
        }
    }, [dateRange, reports, toast]);
    
    // Download report
    const downloadReport = async (type, format = 'csv') => {
        try {
            let endpoint = '';
            let params = { format };
            
            switch (type) {
                case 'financial':
                    endpoint = '/reports/financial';
                    params = { ...params, ...dateRange };
                    break;
                case 'transactions':
                    endpoint = '/reports/transactions';
                    params = { ...params, ...dateRange };
                    break;
                case 'inventory':
                    endpoint = '/reports/inventory';
                    break;
                case 'customerActivity':
                    endpoint = '/reports/customer-activity';
                    params = { ...params, ...dateRange, min_transactions: 1 };
                    break;
                case 'agedLoans':
                    endpoint = '/reports/aged-loans';
                    break;
                default:
                    throw new Error('Unknown report type');
            }
            
            const response = await axiosInstance.get(endpoint, {
                params,
                responseType: 'blob'
            });
            
            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${type}_report_${new Date().toISOString().split('T')[0]}.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            
            toast({
                title: 'Download Started',
                description: `${type} report download started`,
                status: 'success',
                duration: 3000,
                isClosable: true
            });
        } catch (error) {
            console.error('Error downloading report:', error);
            toast({
                title: 'Download Error',
                description: 'Failed to download report',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        }
    };
    
    // Initial load
    useEffect(() => {
        fetchReports();
    }, [dateRange, fetchReports]);
    
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
            {/* Header */}
            <Flex mb={6} align="center">
                <VStack align="start" spacing={1}>
                    <Text fontSize="2xl" fontWeight="bold">Reports & Analytics</Text>
                    <Text color={textColor}>Generate and view business reports</Text>
                </VStack>
                <Spacer />
                <Tooltip label="Refresh Reports">
                    <IconButton
                        icon={<FiRefreshCw />}
                        onClick={fetchReports}
                        isLoading={loading}
                        variant="outline"
                    />
                </Tooltip>
            </Flex>
            
            {/* Date Range and Filters */}
            <Card bg={cardBg} border="1px" borderColor={borderColor} mb={6}>
                <CardBody>
                    <HStack spacing={4}>
                        <FormControl>
                            <FormLabel>Start Date</FormLabel>
                            <Input
                                type="date"
                                value={dateRange.start_date}
                                onChange={(e) => setDateRange(prev => ({
                                    ...prev,
                                    start_date: e.target.value
                                }))}
                            />
                        </FormControl>
                        
                        <FormControl>
                            <FormLabel>End Date</FormLabel>
                            <Input
                                type="date"
                                value={dateRange.end_date}
                                onChange={(e) => setDateRange(prev => ({
                                    ...prev,
                                    end_date: e.target.value
                                }))}
                            />
                        </FormControl>
                        
                        <FormControl>
                            <FormLabel>Report Type</FormLabel>
                            <Select
                                value={reportType}
                                onChange={(e) => setReportType(e.target.value)}
                            >
                                <option value="financial">Financial Summary</option>
                                <option value="transactions">Transaction History</option>
                                <option value="inventory">Inventory Report</option>
                                <option value="customerActivity">Customer Activity</option>
                                <option value="agedLoans">Aged Loans</option>
                            </Select>
                        </FormControl>
                    </HStack>
                </CardBody>
            </Card>
            
            {/* Financial Summary Stats */}
            {reports.financial && (
                <Grid templateColumns="repeat(auto-fit, minmax(250px, 1fr))" gap={6} mb={8}>
                    <Card bg={cardBg} border="1px" borderColor={borderColor}>
                        <CardBody>
                            <Stat>
                                <StatLabel color={textColor}>Total Revenue</StatLabel>
                                <StatNumber color="green.500">
                                    {formatCurrency(reports.financial.total_revenue)}
                                </StatNumber>
                                <StatHelpText>
                                    Selected period
                                </StatHelpText>
                            </Stat>
                        </CardBody>
                    </Card>
                    
                    <Card bg={cardBg} border="1px" borderColor={borderColor}>
                        <CardBody>
                            <Stat>
                                <StatLabel color={textColor}>Interest Collected</StatLabel>
                                <StatNumber color="blue.500">
                                    {formatCurrency(reports.financial.interest_collected)}
                                </StatNumber>
                                <StatHelpText>
                                    Interest payments
                                </StatHelpText>
                            </Stat>
                        </CardBody>
                    </Card>
                    
                    <Card bg={cardBg} border="1px" borderColor={borderColor}>
                        <CardBody>
                            <Stat>
                                <StatLabel color={textColor}>Loans Issued</StatLabel>
                                <StatNumber>{reports.financial.loans_issued || 0}</StatNumber>
                                <StatHelpText>
                                    New loans
                                </StatHelpText>
                            </Stat>
                        </CardBody>
                    </Card>
                    
                    <Card bg={cardBg} border="1px" borderColor={borderColor}>
                        <CardBody>
                            <Stat>
                                <StatLabel color={textColor}>Active Loans</StatLabel>
                                <StatNumber>{reports.financial.active_loans || 0}</StatNumber>
                                <StatHelpText>
                                    Outstanding loans
                                </StatHelpText>
                            </Stat>
                        </CardBody>
                    </Card>
                </Grid>
            )}
            
            {/* Report Content */}
            <Card bg={cardBg} border="1px" borderColor={borderColor}>
                <CardHeader>
                    <Flex align="center">
                        <HStack>
                            <FiFileText />
                            <Heading size="md">
                                {reportType === 'financial' && 'Financial Summary'}
                                {reportType === 'transactions' && 'Transaction History'}
                                {reportType === 'inventory' && 'Inventory Report'}
                                {reportType === 'customerActivity' && 'Customer Activity'}
                                {reportType === 'agedLoans' && 'Aged Loans'}
                            </Heading>
                        </HStack>
                        <Spacer />
                        <HStack>
                            <Button
                                leftIcon={<FiDownload />}
                                size="sm"
                                onClick={() => downloadReport(reportType, 'csv')}
                            >
                                Download CSV
                            </Button>
                            <Button
                                leftIcon={<FiDownload />}
                                size="sm"
                                variant="outline"
                                onClick={() => downloadReport(reportType, 'json')}
                            >
                                Download JSON
                            </Button>
                        </HStack>
                    </Flex>
                </CardHeader>
                <CardBody>
                    {loading ? (
                        <VStack spacing={4}>
                            <Skeleton height="20px" />
                            <SkeletonText noOfLines={5} />
                        </VStack>
                    ) : (
                        <>
                            {/* Transactions Report */}
                            {reportType === 'transactions' && reports.transactions && (
                                <TableContainer>
                                    <Table variant="simple" size="sm">
                                        <Thead>
                                            <Tr>
                                                <Th>Date</Th>
                                                <Th>Type</Th>
                                                <Th>Customer</Th>
                                                <Th>Amount</Th>
                                                <Th>Status</Th>
                                            </Tr>
                                        </Thead>
                                        <Tbody>
                                            {reports.transactions.slice(0, 20).map((transaction, index) => (
                                                <Tr key={index}>
                                                    <Td>{formatDate(transaction.date)}</Td>
                                                    <Td>
                                                        <Badge colorScheme="blue">
                                                            {transaction.type}
                                                        </Badge>
                                                    </Td>
                                                    <Td>{transaction.customer}</Td>
                                                    <Td>{formatCurrency(transaction.amount)}</Td>
                                                    <Td>
                                                        <Badge colorScheme="green">
                                                            {transaction.status}
                                                        </Badge>
                                                    </Td>
                                                </Tr>
                                            ))}
                                        </Tbody>
                                    </Table>
                                </TableContainer>
                            )}
                            
                            {/* Inventory Report */}
                            {reportType === 'inventory' && reports.inventory && (
                                <TableContainer>
                                    <Table variant="simple" size="sm">
                                        <Thead>
                                            <Tr>
                                                <Th>Item</Th>
                                                <Th>Customer</Th>
                                                <Th>Loan Amount</Th>
                                                <Th>Status</Th>
                                                <Th>Storage</Th>
                                            </Tr>
                                        </Thead>
                                        <Tbody>
                                            {reports.inventory.slice(0, 20).map((item, index) => (
                                                <Tr key={index}>
                                                    <Td>{item.description}</Td>
                                                    <Td>{item.customer}</Td>
                                                    <Td>{formatCurrency(item.loan_amount)}</Td>
                                                    <Td>
                                                        <Badge colorScheme={item.status === 'active' ? 'green' : 'gray'}>
                                                            {item.status}
                                                        </Badge>
                                                    </Td>
                                                    <Td>{item.storage_location || 'N/A'}</Td>
                                                </Tr>
                                            ))}
                                        </Tbody>
                                    </Table>
                                </TableContainer>
                            )}
                            
                            {/* Customer Activity Report */}
                            {reportType === 'customerActivity' && reports.customerActivity && (
                                <TableContainer>
                                    <Table variant="simple" size="sm">
                                        <Thead>
                                            <Tr>
                                                <Th>Customer</Th>
                                                <Th>Phone</Th>
                                                <Th>Total Transactions</Th>
                                                <Th>Total Amount</Th>
                                                <Th>Last Activity</Th>
                                            </Tr>
                                        </Thead>
                                        <Tbody>
                                            {reports.customerActivity.slice(0, 20).map((customer, index) => (
                                                <Tr key={index}>
                                                    <Td>{customer.name}</Td>
                                                    <Td>{customer.phone}</Td>
                                                    <Td>{customer.transaction_count}</Td>
                                                    <Td>{formatCurrency(customer.total_amount)}</Td>
                                                    <Td>{formatDate(customer.last_activity)}</Td>
                                                </Tr>
                                            ))}
                                        </Tbody>
                                    </Table>
                                </TableContainer>
                            )}
                            
                            {/* Aged Loans Report */}
                            {reportType === 'agedLoans' && reports.agedLoans && (
                                <TableContainer>
                                    <Table variant="simple" size="sm">
                                        <Thead>
                                            <Tr>
                                                <Th>Customer</Th>
                                                <Th>Item</Th>
                                                <Th>Loan Amount</Th>
                                                <Th>Days Outstanding</Th>
                                                <Th>Total Due</Th>
                                                <Th>Status</Th>
                                            </Tr>
                                        </Thead>
                                        <Tbody>
                                            {reports.agedLoans.slice(0, 20).map((loan, index) => (
                                                <Tr key={index}>
                                                    <Td>{loan.customer}</Td>
                                                    <Td>{loan.item_description}</Td>
                                                    <Td>{formatCurrency(loan.loan_amount)}</Td>
                                                    <Td>{loan.days_outstanding}</Td>
                                                    <Td>{formatCurrency(loan.total_due)}</Td>
                                                    <Td>
                                                        <Badge 
                                                            colorScheme={
                                                                loan.days_outstanding > 90 ? 'red' :
                                                                loan.days_outstanding > 60 ? 'orange' :
                                                                loan.days_outstanding > 30 ? 'yellow' : 'green'
                                                            }
                                                        >
                                                            {loan.status}
                                                        </Badge>
                                                    </Td>
                                                </Tr>
                                            ))}
                                        </Tbody>
                                    </Table>
                                </TableContainer>
                            )}
                            
                            {/* Financial Summary */}
                            {reportType === 'financial' && reports.financial && (
                                <VStack spacing={4} align="stretch">
                                    <Alert status="info">
                                        <AlertIcon />
                                        <Box>
                                            <Text fontWeight="bold">Financial Summary</Text>
                                            <Text fontSize="sm">
                                                Period: {formatDate(dateRange.start_date)} to {formatDate(dateRange.end_date)}
                                            </Text>
                                        </Box>
                                    </Alert>
                                    
                                    <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
                                        <Box p={4} bg={statBg} borderRadius="md">
                                            <Text fontSize="sm" color={textColor}>Total Loans Issued</Text>
                                            <Text fontSize="2xl" fontWeight="bold">
                                                {formatCurrency(reports.financial.total_loans_issued)}
                                            </Text>
                                        </Box>
                                        
                                        <Box p={4} bg={statBg} borderRadius="md">
                                            <Text fontSize="sm" color={textColor}>Interest Revenue</Text>
                                            <Text fontSize="2xl" fontWeight="bold">
                                                {formatCurrency(reports.financial.interest_collected)}
                                            </Text>
                                        </Box>
                                        
                                        <Box p={4} bg={statBg} borderRadius="md">
                                            <Text fontSize="sm" color={textColor}>Outstanding Loans</Text>
                                            <Text fontSize="2xl" fontWeight="bold">
                                                {formatCurrency(reports.financial.outstanding_principal)}
                                            </Text>
                                        </Box>
                                        
                                        <Box p={4} bg={statBg} borderRadius="md">
                                            <Text fontSize="sm" color={textColor}>Profit Margin</Text>
                                            <Text fontSize="2xl" fontWeight="bold">
                                                {reports.financial.profit_margin ? 
                                                    `${(reports.financial.profit_margin * 100).toFixed(1)}%` : 
                                                    'N/A'
                                                }
                                            </Text>
                                        </Box>
                                    </Grid>
                                </VStack>
                            )}
                            
                            {!reports[reportType] && (
                                <Alert status="warning">
                                    <AlertIcon />
                                    <Text>No data available for the selected report type and date range.</Text>
                                </Alert>
                            )}
                        </>
                    )}
                </CardBody>
            </Card>
        </Box>
    );
};

export default Reports;