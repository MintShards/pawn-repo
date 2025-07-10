import React, { useState } from 'react';
import {
    Box,
    Container,
    VStack,
    HStack,
    Text,
    Tabs,
    TabList,
    TabPanels,
    Tab,
    TabPanel,
    useColorModeValue,
    Divider
} from '@chakra-ui/react';
import { FiPlus, FiUsers } from 'react-icons/fi';
import UserCreateForm from './UserCreateForm';
import UserList from './UserList';

const UserManagement = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);

    const bgColor = useColorModeValue('gray.50', 'gray.900');

    const handleUserCreated = (newUser) => {
        // Refresh the user list
        setRefreshKey(prev => prev + 1);
        // Switch to user list tab
        setActiveTab(1);
    };

    return (
        <Box minH="100vh" bg={bgColor}>
            <Container maxW="7xl" py={8}>
                <VStack spacing={8} align="stretch">
                    <Box>
                        <Text fontSize="3xl" fontWeight="bold" color={useColorModeValue('gray.800', 'white')} mb={2}>
                            User Management
                        </Text>
                        <Text fontSize="md" color={useColorModeValue('gray.600', 'gray.400')}>
                            Create and manage staff accounts for your pawnshop
                        </Text>
                    </Box>

                    <Divider />

                    <Tabs
                        index={activeTab}
                        onChange={setActiveTab}
                        variant="enclosed"
                        colorScheme="blue"
                    >
                        <TabList>
                            <Tab>
                                <HStack spacing={2}>
                                    <FiPlus />
                                    <Text>Create User</Text>
                                </HStack>
                            </Tab>
                            <Tab>
                                <HStack spacing={2}>
                                    <FiUsers />
                                    <Text>Manage Users</Text>
                                </HStack>
                            </Tab>
                        </TabList>

                        <TabPanels>
                            <TabPanel p={0} pt={6}>
                                <UserCreateForm onUserCreated={handleUserCreated} />
                            </TabPanel>
                            <TabPanel p={0} pt={6}>
                                <UserList key={refreshKey} />
                            </TabPanel>
                        </TabPanels>
                    </Tabs>
                </VStack>
            </Container>
        </Box>
    );
};

export default UserManagement;