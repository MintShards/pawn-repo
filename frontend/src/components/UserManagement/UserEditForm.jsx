import React, { useState, useEffect } from 'react';
import {
    VStack,
    HStack,
    Text,
    Input,
    Button,
    FormControl,
    FormLabel,
    FormErrorMessage,
    Switch,
    Alert,
    AlertIcon,
    AlertDescription,
    useToast,
    useColorModeValue,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    ModalCloseButton
} from '@chakra-ui/react';
import axiosInstance from '../../services/axios';

const UserEditForm = ({ user, isOpen, onClose, onUserUpdated }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        is_admin: false
    });
    const toast = useToast();

    // Color mode values
    const textColor = useColorModeValue('gray.600', 'gray.400');

    // Fetch full user details and populate form
    useEffect(() => {
        const fetchUserDetails = async () => {
            if (user && isOpen && user.user_number) {
                setIsLoading(true);
                try {
                    const response = await axiosInstance.get(`/users/number/${user.user_number}`);
                    const fullUserData = response.data;
                    
                    const newFormData = {
                        first_name: fullUserData.first_name || '',
                        last_name: fullUserData.last_name || '',
                        phone: fullUserData.phone || '',
                        email: fullUserData.email || '',
                        is_admin: fullUserData.is_admin || false
                    };
                    
                    setFormData(newFormData);
                } catch (error) {
                    console.error('Error fetching user details:', error);
                    toast({
                        title: 'Error Loading User',
                        description: 'Failed to load user details for editing.',
                        status: 'error',
                        duration: 3000,
                        isClosable: true
                    });
                } finally {
                    setIsLoading(false);
                }
            }
        };
        
        fetchUserDetails();
    }, [user, isOpen]);


    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const onSubmit = async () => {
        if (!user) return;
        
        // Basic validation
        if (!formData.first_name || formData.first_name.length < 2) {
            setSubmitError('First name is required and must be at least 2 characters');
            return;
        }
        if (!formData.last_name || formData.last_name.length < 2) {
            setSubmitError('Last name is required and must be at least 2 characters');
            return;
        }

        setIsLoading(true);
        setSubmitError('');

        try {
            const response = await axiosInstance.patch(`/users/${user.user_number}`, {
                first_name: formData.first_name,
                last_name: formData.last_name,
                phone: formData.phone || null,
                email: formData.email || null,
                is_admin: formData.is_admin
            });

            const updatedUser = response.data;
            
            toast({
                title: 'User Updated Successfully',
                description: `User #${updatedUser.user_number} has been updated.`,
                status: 'success',
                duration: 3000,
                isClosable: true
            });

            if (onUserUpdated) {
                onUserUpdated(updatedUser);
            }
            
            onClose();

        } catch (error) {
            console.error('User update error:', error);
            const errorMessage = error.response?.data?.detail || 'Failed to update user. Please try again.';
            setSubmitError(errorMessage);
            
            toast({
                title: 'User Update Failed',
                description: errorMessage,
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setSubmitError('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} size="md">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>
                    Edit User - {user?.full_name} (#{user?.user_number})
                </ModalHeader>
                <ModalCloseButton />
                
                <ModalBody>
                    <VStack spacing={4}>
                        {submitError && (
                            <Alert status="error" borderRadius="md">
                                <AlertIcon />
                                <AlertDescription>{submitError}</AlertDescription>
                            </Alert>
                        )}


                        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} style={{ width: '100%' }}>
                            <VStack spacing={4}>
                                <FormControl>
                                    <FormLabel htmlFor="edit_first_name">First Name</FormLabel>
                                    <Input
                                        id="edit_first_name"
                                        placeholder="Enter first name"
                                        value={formData.first_name}
                                        onChange={(e) => handleInputChange('first_name', e.target.value)}
                                    />
                                </FormControl>

                                <FormControl>
                                    <FormLabel htmlFor="edit_last_name">Last Name</FormLabel>
                                    <Input
                                        id="edit_last_name"
                                        placeholder="Enter last name"
                                        value={formData.last_name}
                                        onChange={(e) => handleInputChange('last_name', e.target.value)}
                                    />
                                </FormControl>

                                <FormControl>
                                    <FormLabel htmlFor="edit_phone">Phone Number <Text as="span" color={textColor}>(Optional)</Text></FormLabel>
                                    <Input
                                        id="edit_phone"
                                        placeholder="5551234567"
                                        value={formData.phone}
                                        onChange={(e) => handleInputChange('phone', e.target.value)}
                                    />
                                </FormControl>

                                <FormControl>
                                    <FormLabel htmlFor="edit_email">Email <Text as="span" color={textColor}>(Optional)</Text></FormLabel>
                                    <Input
                                        id="edit_email"
                                        type="email"
                                        placeholder="user@example.com"
                                        value={formData.email}
                                        onChange={(e) => handleInputChange('email', e.target.value)}
                                    />
                                </FormControl>

                                <FormControl>
                                    <HStack justify="space-between">
                                        <FormLabel htmlFor="edit_is_admin" mb={0}>Admin Privileges</FormLabel>
                                        <Switch
                                            id="edit_is_admin"
                                            colorScheme="red"
                                            isChecked={formData.is_admin}
                                            onChange={(e) => handleInputChange('is_admin', e.target.checked)}
                                        />
                                    </HStack>
                                    <Text fontSize="sm" color={textColor} mt={1}>
                                        {formData.is_admin ? 'User will have admin privileges' : 'User will have staff privileges'}
                                    </Text>
                                </FormControl>
                            </VStack>
                        </form>
                    </VStack>
                </ModalBody>

                <ModalFooter>
                    <Button variant="ghost" mr={3} onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        colorScheme="blue"
                        onClick={onSubmit}
                        isLoading={isLoading}
                        loadingText="Updating..."
                    >
                        Update User
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default UserEditForm;