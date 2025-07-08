import React from 'react';
import {
    Box,
    Flex,
    VStack,
    HStack,
    Text,
    Button,
    IconButton,
    useColorModeValue,
    Drawer,
    DrawerBody,
    DrawerHeader,
    DrawerOverlay,
    DrawerContent,
    DrawerCloseButton,
    useDisclosure,
    Avatar,
    Menu,
    MenuButton,
    MenuList,
    MenuItem,
    MenuDivider,
    Badge,
    useToast
} from '@chakra-ui/react';
import {
    FiHome,
    FiUsers,
    FiPackage,
    FiDollarSign,
    FiBarChart2,
    FiSettings,
    FiMenu,
    FiLogOut,
    FiUser,
    FiLock,
} from 'react-icons/fi';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import ThemeToggler from '../Theme/ThemeToggler';

const Layout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const { isOpen, onOpen, onClose } = useDisclosure();
    const toast = useToast();
    
    // Color mode values
    const sidebarBg = useColorModeValue('white', 'gray.800');
    const sidebarBorderColor = useColorModeValue('gray.200', 'gray.600');
    const headerBg = useColorModeValue('white', 'gray.800');
    const headerBorderColor = useColorModeValue('gray.200', 'gray.600');
    const contentBg = useColorModeValue('gray.50', 'gray.900');
    const textColor = useColorModeValue('gray.600', 'gray.300');
    const activeNavBg = useColorModeValue('blue.50', 'blue.900');
    const activeNavColor = useColorModeValue('blue.600', 'blue.200');
    const hoverNavBg = useColorModeValue('gray.100', 'gray.700');
    
    const navigationItems = [
        { icon: FiHome, label: 'Dashboard', path: '/dashboard' },
        { icon: FiUsers, label: 'Customers', path: '/customers' },
        { icon: FiPackage, label: 'Items', path: '/items' },
        { icon: FiDollarSign, label: 'Transactions', path: '/transactions' },
        { icon: FiBarChart2, label: 'Reports', path: '/reports' },
        ...(user?.is_admin ? [{ icon: FiSettings, label: 'Admin', path: '/admin' }] : [])
    ];
    
    const handleLogout = async () => {
        try {
            await logout();
            toast({
                title: 'Logged Out',
                description: 'You have been successfully logged out',
                status: 'success',
                duration: 3000,
                isClosable: true
            });
        } catch (error) {
            console.error('Logout error:', error);
            toast({
                title: 'Logout Error',
                description: 'There was an error logging out',
                status: 'error',
                duration: 3000,
                isClosable: true
            });
        }
    };
    
    const NavItem = ({ icon: Icon, label, path, isActive, onClick }) => (
        <Button
            leftIcon={<Icon />}
            variant="ghost"
            justifyContent="flex-start"
            w="100%"
            h="12"
            bg={isActive ? activeNavBg : 'transparent'}
            color={isActive ? activeNavColor : textColor}
            _hover={{
                bg: isActive ? activeNavBg : hoverNavBg
            }}
            onClick={onClick}
        >
            {label}
        </Button>
    );
    
    const SidebarContent = ({ onClose }) => (
        <VStack spacing={1} align="stretch" p={4}>
            <Box mb={6}>
                <Text fontSize="xl" fontWeight="bold" color={activeNavColor}>
                    Pawn Repo
                </Text>
                <Text fontSize="sm" color={textColor}>
                    Pawnshop Management
                </Text>
            </Box>
            
            {navigationItems.map((item) => (
                <NavItem
                    key={item.path}
                    icon={item.icon}
                    label={item.label}
                    path={item.path}
                    isActive={location.pathname.startsWith(item.path)}
                    onClick={() => {
                        navigate(item.path);
                        onClose();
                    }}
                />
            ))}
        </VStack>
    );
    
    return (
        <Box minH="100vh" bg={contentBg}>
            {/* Header */}
            <Flex
                as="header"
                align="center"
                justify="space-between"
                w="100%"
                px={4}
                py={3}
                bg={headerBg}
                borderBottom="1px"
                borderColor={headerBorderColor}
                pos="sticky"
                top={0}
                zIndex={10}
            >
                <HStack spacing={4}>
                    <IconButton
                        icon={<FiMenu />}
                        onClick={onOpen}
                        variant="outline"
                        display={{ base: 'flex', md: 'none' }}
                    />
                    
                    <Text fontSize="lg" fontWeight="medium" display={{ base: 'none', md: 'block' }}>
                        Pawn Repo
                    </Text>
                </HStack>
                
                <HStack spacing={4}>
                    <ThemeToggler />
                    
                    <Menu>
                        <MenuButton as={Button} variant="ghost" p={0}>
                            <HStack spacing={2}>
                                <Avatar 
                                    size="sm" 
                                    name={user?.full_name || 'User'}
                                    bg={activeNavColor}
                                />
                                <VStack align="start" spacing={0} display={{ base: 'none', md: 'flex' }}>
                                    <Text fontSize="sm" fontWeight="medium">
                                        {user?.full_name || 'User'}
                                    </Text>
                                    <HStack spacing={1}>
                                        <Badge size="sm" colorScheme="blue">
                                            #{user?.user_number}
                                        </Badge>
                                        <Badge size="sm" colorScheme={user?.is_admin ? 'red' : 'green'}>
                                            {user?.role || 'Staff'}
                                        </Badge>
                                    </HStack>
                                </VStack>
                            </HStack>
                        </MenuButton>
                        <MenuList>
                            <MenuItem icon={<FiUser />} onClick={() => navigate('/profile')}>
                                Profile
                            </MenuItem>
                            <MenuItem icon={<FiLock />} onClick={() => navigate('/profile/pin')}>
                                Change PIN
                            </MenuItem>
                            <MenuDivider />
                            <MenuItem icon={<FiLogOut />} onClick={handleLogout} color="red.500">
                                Logout
                            </MenuItem>
                        </MenuList>
                    </Menu>
                </HStack>
            </Flex>
            
            {/* Mobile Sidebar */}
            <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
                <DrawerOverlay />
                <DrawerContent>
                    <DrawerCloseButton />
                    <DrawerHeader>Navigation</DrawerHeader>
                    <DrawerBody p={0}>
                        <SidebarContent onClose={onClose} />
                    </DrawerBody>
                </DrawerContent>
            </Drawer>
            
            {/* Desktop Layout */}
            <Flex>
                {/* Desktop Sidebar */}
                <Box
                    as="nav"
                    w="250px"
                    bg={sidebarBg}
                    borderRight="1px"
                    borderColor={sidebarBorderColor}
                    pos="fixed"
                    top="60px"
                    left={0}
                    h="calc(100vh - 60px)"
                    overflowY="auto"
                    display={{ base: 'none', md: 'block' }}
                >
                    <SidebarContent onClose={() => {}} />
                </Box>
                
                {/* Main Content */}
                <Box
                    flex="1"
                    ml={{ base: 0, md: '250px' }}
                    transition="margin-left 0.2s"
                >
                    <Outlet />
                </Box>
            </Flex>
        </Box>
    );
};

export default Layout;