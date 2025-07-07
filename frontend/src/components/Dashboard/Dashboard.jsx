import React, { useState, useEffect } from 'react';
import {
    Box,
    Grid,
    Stat,
    StatLabel,
    StatNumber,
    StatHelpText,
    StatArrow,
    Card,
    CardHeader,
    CardBody,
    Heading,
    Text,
    VStack,
    HStack,
    Button,
    Badge,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    TableContainer,
    useColorModeValue,
    Alert,
    AlertIcon,
    Skeleton,
    SkeletonText,
    IconButton,
    Tooltip,
    useToast,
    Flex,
    Spacer,
    Select,
    Input,
    InputGroup,
    InputLeftElement
} from '@chakra-ui/react';
import { 
    FiDollarSign, 
    FiUsers, 
    FiPackage, 
    FiTrendingUp, 
    FiRefreshCw,
    FiSearch,
    FiAlertTriangle,
    FiClock,
    FiEye,
    FiEdit,
    FiPrinter
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../services/axios';
import { useAuth } from '../../hooks/useAuth';

const Dashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const toast = useToast();
    
    // State management
    const [dashboardData, setDashboardData] = useState({
        stats: null,
        recentTransactions: [],
        dueItems: [],
        overdueItems: []
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedDateRange, setSelectedDateRange] = useState('30');
    
    // Color mode values
    const cardBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const textColor = useColorModeValue('gray.600', 'gray.300');
    const statBg = useColorModeValue('gray.50', 'gray.700');
    
    // Fetch dashboard data
    const fetchDashboardData = async (showToast = false) => {
        try {
            setRefreshing(true);
            
            // Fetch all dashboard data in parallel
            const [statsRes, transactionsRes, dueItemsRes, overdueItemsRes] = await Promise.all([
                axiosInstance.get(`/dashboard/stats?days=${selectedDateRange}`),
                axiosInstance.get('/dashboard/recent-transactions?limit=10'),
                axiosInstance.get('/dashboard/due-items?days_ahead=7'),
                axiosInstance.get('/dashboard/overdue-items')
            ]);
            
            setDashboardData({
                stats: statsRes.data,
                recentTransactions: transactionsRes.data,
                dueItems: dueItemsRes.data,
                overdueItems: overdueItemsRes.data
            });
            
            if (showToast) {
                toast({
                    title: 'Dashboard Updated',
                    description: 'Data refreshed successfully',
                    status: 'success',
                    duration: 2000,
                    isClosable: true
                });
            }
        } catch (error) {
            console.error('Dashboard fetch error:', error);
            toast({
                title: 'Error Loading Dashboard',
                description: error.response?.data?.detail || 'Failed to load dashboard data',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };
    
    useEffect(() => {
        fetchDashboardData();
    }, [selectedDateRange]);
    
    // Handle refresh
    const handleRefresh = () => {
        fetchDashboardData(true);
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
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };
    
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
    
    // Render loading skeleton
    if (loading) {
        return (
            <Box p={6}>
                <VStack spacing={6} align="stretch">
                    <Skeleton height="40px" />
                    <Grid templateColumns="repeat(auto-fit, minmax(250px, 1fr))" gap={6}>
                        {[1, 2, 3, 4].map(i => (
                            <Card key={i} bg={cardBg} border="1px" borderColor={borderColor}>
                                <CardBody>
                                    <Skeleton height="20px" mb={2} />
                                    <Skeleton height="30px" mb={2} />
                                    <SkeletonText noOfLines={1} />
                                </CardBody>
                            </Card>
                        ))}
                    </Grid>
                </VStack>
            </Box>
        );
    }
    
    const { stats, recentTransactions, dueItems, overdueItems } = dashboardData;
    
    return (
        <Box p={6}>
            {/* Header */}
            <Flex mb={6} align="center">
                <VStack align="start" spacing={1}>
                    <Heading size="lg">Dashboard</Heading>
                    <Text color={textColor}>Welcome back, {user?.first_name || 'User'}</Text>
                </VStack>
                <Spacer />
                <HStack spacing={3}>
                    <Select 
                        value={selectedDateRange} 
                        onChange={(e) => setSelectedDateRange(e.target.value)}
                        w="150px"
                    >
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                        <option value="365">Last year</option>
                    </Select>
                    <Tooltip label="Refresh Dashboard">
                        <IconButton
                            icon={<FiRefreshCw />}
                            onClick={handleRefresh}
                            isLoading={refreshing}
                            variant="outline"
                        />
                    </Tooltip>
                </HStack>
            </Flex>
            
            {/* Alert for overdue items */}
            {overdueItems.length > 0 && (
                <Alert status="warning" mb={6} borderRadius="md">
                    <AlertIcon />
                    <Text>
                        <strong>{overdueItems.length} overdue items</strong> require attention
                    </Text>
                    <Spacer />
                    <Button size="sm" onClick={() => navigate('/items?status=overdue')}>
                        View Overdue Items
                    </Button>
                </Alert>
            )}
            
            {/* Stats Cards */}
            <Grid templateColumns="repeat(auto-fit, minmax(250px, 1fr))" gap={6} mb={8}>
                <Card bg={cardBg} border="1px" borderColor={borderColor}>
                    <CardBody>
                        <Stat>
                            <StatLabel color={textColor}>Total Revenue</StatLabel>
                            <StatNumber color="green.500">
                                {formatCurrency(stats?.total_revenue)}
                            </StatNumber>
                            <StatHelpText>
                                <StatArrow type="increase" />
                                {selectedDateRange} days
                            </StatHelpText>
                        </Stat>
                    </CardBody>
                </Card>
                
                <Card bg={cardBg} border="1px" borderColor={borderColor}>
                    <CardBody>
                        <Stat>
                            <StatLabel color={textColor}>Active Loans</StatLabel>
                            <StatNumber>{stats?.active_loans || 0}</StatNumber>
                            <StatHelpText>
                                Outstanding loans
                            </StatHelpText>
                        </Stat>
                    </CardBody>
                </Card>
                
                <Card bg={cardBg} border="1px" borderColor={borderColor}>
                    <CardBody>
                        <Stat>
                            <StatLabel color={textColor}>New Customers</StatLabel>
                            <StatNumber>{stats?.new_customers || 0}</StatNumber>
                            <StatHelpText>
                                {selectedDateRange} days
                            </StatHelpText>
                        </Stat>
                    </CardBody>
                </Card>
                
                <Card bg={cardBg} border="1px" borderColor={borderColor}>
                    <CardBody>
                        <Stat>
                            <StatLabel color={textColor}>Items in Store</StatLabel>
                            <StatNumber>{stats?.total_items || 0}</StatNumber>
                            <StatHelpText>
                                Current inventory
                            </StatHelpText>
                        </Stat>
                    </CardBody>
                </Card>
            </Grid>
            
            {/* Main Content Grid */}
            <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
                {/* Recent Transactions */}
                <Card bg={cardBg} border="1px" borderColor={borderColor}>
                    <CardHeader>
                        <Flex align="center">
                            <Heading size="md">Recent Transactions</Heading>
                            <Spacer />
                            <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => navigate('/transactions')}
                            >
                                View All
                            </Button>
                        </Flex>
                    </CardHeader>
                    <CardBody>
                        {recentTransactions.length === 0 ? (
                            <Text color={textColor}>No recent transactions</Text>
                        ) : (
                            <VStack spacing={3} align="stretch">
                                {recentTransactions.map((transaction) => (
                                    <Box 
                                        key={transaction.transaction_id} 
                                        p={3} 
                                        bg={statBg} 
                                        borderRadius="md"
                                    >
                                        <Flex align="center">
                                            <VStack align="start" spacing={1}>
                                                <Text fontWeight="medium">
                                                    {transaction.transaction_type}
                                                </Text>
                                                <Text fontSize="sm" color={textColor}>
                                                    {formatDate(transaction.transaction_date)}
                                                </Text>
                                            </VStack>
                                            <Spacer />
                                            <VStack align="end" spacing={1}>
                                                <Text fontWeight="bold">
                                                    {formatCurrency(transaction.amount)}
                                                </Text>
                                                <Badge colorScheme={getStatusColor(transaction.status)}>
                                                    {transaction.status}
                                                </Badge>
                                            </VStack>
                                        </Flex>
                                    </Box>
                                ))}
                            </VStack>
                        )}
                    </CardBody>
                </Card>
                
                {/* Items Due Soon */}
                <Card bg={cardBg} border="1px" borderColor={borderColor}>
                    <CardHeader>
                        <Flex align="center">
                            <Heading size="md">Items Due Soon</Heading>
                            <Spacer />
                            <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => navigate('/items?status=due')}
                            >
                                View All
                            </Button>
                        </Flex>
                    </CardHeader>
                    <CardBody>
                        {dueItems.length === 0 ? (
                            <Text color={textColor}>No items due soon</Text>
                        ) : (
                            <VStack spacing={3} align="stretch">
                                {dueItems.slice(0, 5).map((item) => (
                                    <Box 
                                        key={item.item_id} 
                                        p={3} 
                                        bg={statBg} 
                                        borderRadius="md"
                                    >
                                        <Flex align="center">
                                            <VStack align="start" spacing={1}>
                                                <Text fontWeight="medium" noOfLines={1}>
                                                    {item.description}
                                                </Text>
                                                <Text fontSize="sm" color={textColor}>
                                                    Due: {formatDate(item.due_date)}
                                                </Text>
                                            </VStack>
                                            <Spacer />
                                            <VStack align="end" spacing={1}>
                                                <Text fontWeight="bold">
                                                    {formatCurrency(item.total_due)}
                                                </Text>
                                                <Badge colorScheme="yellow">
                                                    Due Soon
                                                </Badge>
                                            </VStack>
                                        </Flex>
                                    </Box>
                                ))}
                            </VStack>
                        )}
                    </CardBody>
                </Card>
            </Grid>
            
            {/* Quick Actions */}
            <Card bg={cardBg} border="1px" borderColor={borderColor} mt={6}>
                <CardHeader>
                    <Heading size="md">Quick Actions</Heading>
                </CardHeader>
                <CardBody>
                    <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
                        <Button 
                            leftIcon={<FiUsers />}
                            onClick={() => navigate('/customers/new')}
                            colorScheme="blue"
                            variant="outline"
                        >
                            New Customer
                        </Button>
                        <Button 
                            leftIcon={<FiPackage />}
                            onClick={() => navigate('/transactions/new')}
                            colorScheme="green"
                            variant="outline"
                        >
                            New Pawn Loan
                        </Button>
                        <Button 
                            leftIcon={<FiDollarSign />}
                            onClick={() => navigate('/transactions/payment')}
                            colorScheme="purple"
                            variant="outline"
                        >
                            Process Payment
                        </Button>
                        <Button 
                            leftIcon={<FiTrendingUp />}
                            onClick={() => navigate('/reports')}
                            colorScheme="orange"
                            variant="outline"
                        >
                            View Reports
                        </Button>
                    </Grid>
                </CardBody>
            </Card>
        </Box>
    );
};

export default Dashboard;