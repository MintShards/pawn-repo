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
    Select,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    TableContainer,
    Card,
    CardBody,
    CardHeader,
    Badge,
    Flex,
    Spacer,
    Alert,
    AlertIcon,
    AlertDescription,
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
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    ModalCloseButton,
    useDisclosure,
    Stack,
    Code,
    Divider
} from '@chakra-ui/react';
import {
    FiSearch,
    FiDownload,
    FiRefreshCw,
    FiEye,
    FiFilter,
    FiUser,
    FiClock,
    FiActivity,
    FiShield
} from 'react-icons/fi';
import axiosInstance from '../../services/axios';

const AuditTrail = () => {
    const toast = useToast();
    const { isOpen, onOpen, onClose } = useDisclosure();
    
    // State
    const [auditData, setAuditData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState(null);
    
    // Filter state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const [entityFilter, setEntityFilter] = useState('');
    
    // Available filter options
    const [users, setUsers] = useState([]);
    const [actionTypes, setActionTypes] = useState([]);
    const [entityTypes, setEntityTypes] = useState([]);
    
    // Color mode values
    const cardBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const highlightBg = useColorModeValue('blue.50', 'blue.900');
    
    // Default date range (last 30 days)
    useEffect(() => {
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
        
        setEndDate(today.toISOString().split('T')[0]);
        setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    }, []);
    
    // Fetch filter options
    useEffect(() => {
        fetchFilterOptions();
    }, []);
    
    const fetchFilterOptions = async () => {
        try {
            // These would be actual API calls in a real implementation
            setActionTypes([
                'CREATE_PAWN', 'CREATE_PAYMENT', 'CREATE_RENEWAL', 'CREATE_REDEMPTION',
                'UPDATE_CUSTOMER', 'UPDATE_TRANSACTION', 'DELETE_ITEM',
                'LOGIN', 'LOGOUT', 'PIN_CHANGE'
            ]);
            
            setEntityTypes([
                'Transaction', 'Customer', 'Item', 'User', 'Payment'
            ]);
            
            // Fetch users for filter
            const usersResponse = await axiosInstance.get('/users');
            setUsers(usersResponse.data || []);
        } catch (error) {
            console.error('Error fetching filter options:', error);
        }
    };
    
    // Fetch audit trail data
    const fetchAuditTrail = async () => {
        if (!startDate || !endDate) {
            toast({
                title: 'Date Range Required',
                description: 'Please select both start and end dates',
                status: 'warning',
                duration: 3000,
                isClosable: true
            });
            return;
        }
        
        try {
            setLoading(true);
            const params = new URLSearchParams({
                start_date: startDate,
                end_date: endDate
            });
            
            if (userFilter) params.append('user_id', userFilter);
            if (actionFilter) params.append('action_type', actionFilter);
            if (entityFilter) params.append('entity_type', entityFilter);
            
            const response = await axiosInstance.get(`/reports/audit-trail?${params.toString()}`);
            setAuditData(response.data);
        } catch (error) {
            console.error('Error fetching audit trail:', error);
            toast({
                title: 'Error Loading Audit Trail',
                description: error.response?.data?.detail || 'Failed to load audit trail data',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        } finally {
            setLoading(false);
        }
    };
    
    // View entry details
    const viewEntryDetails = (entry) => {
        setSelectedEntry(entry);
        onOpen();
    };
    
    // Export audit trail
    const exportAuditTrail = async () => {
        try {
            const params = new URLSearchParams({
                report_type: 'audit-trail',
                start_date: startDate,
                end_date: endDate
            });
            
            if (userFilter) params.append('user_id', userFilter);
            if (actionFilter) params.append('action_type', actionFilter);
            if (entityFilter) params.append('entity_type', entityFilter);
            
            const response = await axiosInstance.get(
                `/reports/export/pdf?${params.toString()}`,
                { responseType: 'blob' }
            );
            
            // Download PDF
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `audit_trail_${startDate}_${endDate}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            
            toast({
                title: 'Export Successful',
                description: 'Audit trail report has been downloaded',
                status: 'success',
                duration: 3000,
                isClosable: true
            });
        } catch (error) {
            console.error('Error exporting audit trail:', error);
            toast({
                title: 'Export Failed',
                description: error.response?.data?.detail || 'Failed to export audit trail',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        }
    };
    
    // Clear filters
    const clearFilters = () => {
        setUserFilter('');
        setActionFilter('');
        setEntityFilter('');
    };
    
    // Format timestamp
    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };
    
    // Get action badge color
    const getActionBadgeColor = (action) => {
        if (action.includes('CREATE')) return 'green';
        if (action.includes('UPDATE')) return 'blue';
        if (action.includes('DELETE')) return 'red';
        if (action.includes('LOGIN') || action.includes('LOGOUT')) return 'purple';
        return 'gray';
    };
    
    return (
        <Box p={6}>
            <VStack spacing={6} align="stretch">
                {/* Header */}
                <Flex align="center">
                    <Box>
                        <HStack spacing={2} mb={2}>
                            <FiShield color="orange" />
                            <Text fontSize="2xl" fontWeight="bold">
                                Audit Trail
                            </Text>
                        </HStack>
                        <Text color="gray.600">
                            View and track all system activities and user actions
                        </Text>
                    </Box>
                    <Spacer />
                    <Alert status="warning" w="auto">
                        <AlertIcon />
                        <AlertDescription>Admin access required</AlertDescription>
                    </Alert>
                </Flex>
                
                {/* Filters */}
                <Card bg={cardBg} border="1px" borderColor={borderColor}>
                    <CardHeader>
                        <HStack spacing={2}>
                            <FiFilter />
                            <Text fontSize="lg" fontWeight="semibold">
                                Filters & Search
                            </Text>
                        </HStack>
                    </CardHeader>
                    <CardBody>
                        <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
                            <GridItem>
                                <FormControl>
                                    <FormLabel>Start Date</FormLabel>
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </FormControl>
                            </GridItem>
                            
                            <GridItem>
                                <FormControl>
                                    <FormLabel>End Date</FormLabel>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </FormControl>
                            </GridItem>
                            
                            <GridItem>
                                <FormControl>
                                    <FormLabel>User</FormLabel>
                                    <Select
                                        value={userFilter}
                                        onChange={(e) => setUserFilter(e.target.value)}
                                        placeholder="All users"
                                    >
                                        {users.map((user) => (
                                            <option key={user.user_id} value={user.user_id}>
                                                {user.first_name} {user.last_name} (#{user.user_number})
                                            </option>
                                        ))}
                                    </Select>
                                </FormControl>
                            </GridItem>
                            
                            <GridItem>
                                <FormControl>
                                    <FormLabel>Action Type</FormLabel>
                                    <Select
                                        value={actionFilter}
                                        onChange={(e) => setActionFilter(e.target.value)}
                                        placeholder="All actions"
                                    >
                                        {actionTypes.map((action) => (
                                            <option key={action} value={action}>
                                                {action.replace('_', ' ')}
                                            </option>
                                        ))}
                                    </Select>
                                </FormControl>
                            </GridItem>
                            
                            <GridItem>
                                <FormControl>
                                    <FormLabel>Entity Type</FormLabel>
                                    <Select
                                        value={entityFilter}
                                        onChange={(e) => setEntityFilter(e.target.value)}
                                        placeholder="All entities"
                                    >
                                        {entityTypes.map((entity) => (
                                            <option key={entity} value={entity}>
                                                {entity}
                                            </option>
                                        ))}
                                    </Select>
                                </FormControl>
                            </GridItem>
                        </Grid>
                        
                        <HStack spacing={3} mt={4}>
                            <Button
                                colorScheme="blue"
                                leftIcon={<FiSearch />}
                                onClick={fetchAuditTrail}
                                isLoading={loading}
                                loadingText="Loading..."
                            >
                                Search Audit Trail
                            </Button>
                            <Button
                                variant="outline"
                                onClick={clearFilters}
                            >
                                Clear Filters
                            </Button>
                            <Spacer />
                            {auditData && (
                                <Button
                                    colorScheme="green"
                                    leftIcon={<FiDownload />}
                                    onClick={exportAuditTrail}
                                    variant="outline"
                                >
                                    Export PDF
                                </Button>
                            )}
                        </HStack>
                    </CardBody>
                </Card>
                
                {/* Summary Stats */}
                {auditData && (
                    <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
                        <Card bg={cardBg} border="1px" borderColor={borderColor}>
                            <CardBody>
                                <Stat>
                                    <StatLabel>Total Entries</StatLabel>
                                    <StatNumber>{auditData.summary.total_entries}</StatNumber>
                                    <StatHelpText>in selected period</StatHelpText>
                                </Stat>
                            </CardBody>
                        </Card>
                        
                        <Card bg={cardBg} border="1px" borderColor={borderColor}>
                            <CardBody>
                                <Stat>
                                    <StatLabel>Unique Users</StatLabel>
                                    <StatNumber>{auditData.summary.unique_users}</StatNumber>
                                    <StatHelpText>performed actions</StatHelpText>
                                </Stat>
                            </CardBody>
                        </Card>
                        
                        <Card bg={cardBg} border="1px" borderColor={borderColor}>
                            <CardBody>
                                <Stat>
                                    <StatLabel>Action Types</StatLabel>
                                    <StatNumber>{auditData.summary.unique_actions}</StatNumber>
                                    <StatHelpText>different actions</StatHelpText>
                                </Stat>
                            </CardBody>
                        </Card>
                    </Grid>
                )}
                
                {/* Audit Entries Table */}
                {loading ? (
                    <Flex justify="center" py={8}>
                        <Spinner size="lg" />
                    </Flex>
                ) : auditData ? (
                    <Card bg={cardBg} border="1px" borderColor={borderColor}>
                        <CardHeader>
                            <HStack spacing={2}>
                                <FiActivity />
                                <Text fontSize="lg" fontWeight="semibold">
                                    Audit Entries ({auditData.entries.length})
                                </Text>
                            </HStack>
                        </CardHeader>
                        <CardBody p={0}>
                            <TableContainer>
                                <Table variant="simple">
                                    <Thead>
                                        <Tr>
                                            <Th>Timestamp</Th>
                                            <Th>User</Th>
                                            <Th>Action</Th>
                                            <Th>Entity</Th>
                                            <Th>Entity ID</Th>
                                            <Th>Details</Th>
                                        </Tr>
                                    </Thead>
                                    <Tbody>
                                        {auditData.entries.map((entry, index) => (
                                            <Tr key={index}>
                                                <Td>
                                                    <VStack align="start" spacing={0}>
                                                        <Text fontSize="sm" fontWeight="medium">
                                                            {formatTimestamp(entry.timestamp)}
                                                        </Text>
                                                    </VStack>
                                                </Td>
                                                <Td>
                                                    <HStack spacing={2}>
                                                        <FiUser size={14} />
                                                        <Text fontSize="sm">
                                                            {entry.user_name}
                                                        </Text>
                                                    </HStack>
                                                </Td>
                                                <Td>
                                                    <Badge colorScheme={getActionBadgeColor(entry.action)}>
                                                        {entry.action.replace('_', ' ')}
                                                    </Badge>
                                                </Td>
                                                <Td>
                                                    <Text fontSize="sm">
                                                        {entry.entity_type}
                                                    </Text>
                                                </Td>
                                                <Td>
                                                    <Code fontSize="xs">
                                                        {entry.entity_id?.substring(0, 8)}...
                                                    </Code>
                                                </Td>
                                                <Td>
                                                    <Tooltip label="View Details">
                                                        <IconButton
                                                            icon={<FiEye />}
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => viewEntryDetails(entry)}
                                                        />
                                                    </Tooltip>
                                                </Td>
                                            </Tr>
                                        ))}
                                    </Tbody>
                                </Table>
                            </TableContainer>
                        </CardBody>
                    </Card>
                ) : (
                    <Card bg={cardBg} border="1px" borderColor={borderColor}>
                        <CardBody>
                            <Flex direction="column" align="center" py={8}>
                                <FiClock size={48} color="gray" />
                                <Text mt={4} color="gray.500">
                                    Select date range and click "Search Audit Trail" to view entries
                                </Text>
                            </Flex>
                        </CardBody>
                    </Card>
                )}
            </VStack>
            
            {/* Entry Details Modal */}
            <Modal isOpen={isOpen} onClose={onClose} size="lg">
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Audit Entry Details</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        {selectedEntry && (
                            <VStack spacing={4} align="stretch">
                                <Grid templateColumns="1fr 2fr" gap={4}>
                                    <Text fontWeight="bold">Timestamp:</Text>
                                    <Text>{formatTimestamp(selectedEntry.timestamp)}</Text>
                                    
                                    <Text fontWeight="bold">User:</Text>
                                    <Text>{selectedEntry.user_name}</Text>
                                    
                                    <Text fontWeight="bold">Action:</Text>
                                    <Badge colorScheme={getActionBadgeColor(selectedEntry.action)} w="fit-content">
                                        {selectedEntry.action.replace('_', ' ')}
                                    </Badge>
                                    
                                    <Text fontWeight="bold">Entity Type:</Text>
                                    <Text>{selectedEntry.entity_type}</Text>
                                    
                                    <Text fontWeight="bold">Entity ID:</Text>
                                    <Code>{selectedEntry.entity_id}</Code>
                                </Grid>
                                
                                {selectedEntry.details && (
                                    <>
                                        <Divider />
                                        <Box>
                                            <Text fontWeight="bold" mb={2}>Additional Details:</Text>
                                            <Code p={3} borderRadius="md" w="full" display="block">
                                                <pre>{JSON.stringify(selectedEntry.details, null, 2)}</pre>
                                            </Code>
                                        </Box>
                                    </>
                                )}
                            </VStack>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button onClick={onClose}>Close</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </Box>
    );
};

export default AuditTrail;