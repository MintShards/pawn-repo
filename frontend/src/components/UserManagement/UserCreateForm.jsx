import React, { useState } from 'react';
import {
    Box,
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
    AlertTitle,
    AlertDescription,
    useToast,
    useColorModeValue
} from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import axiosInstance from '../../services/axios';
import { useAuth } from '../../hooks/useAuth';

const UserCreateForm = ({ onUserCreated }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [createdUser, setCreatedUser] = useState(null);
    const toast = useToast();
    const { user } = useAuth();

    // Color mode values
    const bgColor = useColorModeValue('white', 'gray.800');
    const textColor = useColorModeValue('gray.800', 'white');
    const subTextColor = useColorModeValue('gray.600', 'gray.400');
    const borderColor = useColorModeValue('gray.200', 'gray.600');

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
        setValue,
        watch
    } = useForm({
        defaultValues: {
            first_name: '',
            last_name: '',
            phone: '',
            email: '',
            is_admin: false,
            pin: '',
            confirm_pin: ''
        }
    });

    const watchedIsAdmin = watch('is_admin');

    const onSubmit = async (data) => {
        
        // Check if user is admin before attempting to create user
        if (!user?.is_admin) {
            setSubmitError('You must be an admin to create new users.');
            toast({
                title: 'Access Denied',
                description: 'You must be an admin to create new users.',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
            return;
        }
        
        setIsLoading(true);
        setSubmitError('');

        try {
            
            const response = await axiosInstance.post('/users/create', {
                first_name: data.first_name.trim(),
                last_name: data.last_name.trim(),
                phone: data.phone && data.phone.trim() ? data.phone.trim() : null,
                email: data.email && data.email.trim() ? data.email.trim() : null,
                is_admin: data.is_admin,
                pin: data.pin,
                confirm_pin: data.confirm_pin
            });

            const newUser = response.data;
            setCreatedUser(newUser);
            
            toast({
                title: 'User Created Successfully',
                description: `User #${newUser.user_number} created. They can now log in with their assigned PIN.`,
                status: 'success',
                duration: 5000,
                isClosable: true
            });

            reset();
            if (onUserCreated) {
                onUserCreated(newUser);
            }

        } catch (error) {
            console.error('User creation error:', error);
            console.error('Error response:', error.response?.data);
            console.error('Error status:', error.response?.status);
            console.error('Error message:', error.message);
            
            let errorMessage = 'Failed to create user. Please try again.';
            
            if (error.response?.data?.detail) {
                errorMessage = error.response.data.detail;
            } else if (error.response?.status === 401) {
                errorMessage = 'Authentication failed. Please log in again.';
            } else if (error.response?.status === 403) {
                errorMessage = 'Access denied. Admin privileges required.';
            } else if (error.response?.status === 422) {
                errorMessage = 'Validation error. Please check your input.';
            } else if (error.response?.status === 500) {
                errorMessage = 'Server error. Please try again later.';
            } else if (error.code === 'ERR_NETWORK') {
                errorMessage = 'Network error. Please check your connection.';
            }
            
            // Show the actual error in development
            if (process.env.NODE_ENV === 'development') {
                errorMessage += ` (${error.message})`;
            }
            
            setSubmitError(errorMessage);
            
            toast({
                title: 'User Creation Failed',
                description: errorMessage,
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box p={6} bg={bgColor} borderRadius="lg" shadow="md" border="1px" borderColor={borderColor}>
            <VStack spacing={6} align="stretch">
                <Text fontSize="xl" fontWeight="bold" color={textColor}>
                    Create New User
                </Text>

                {createdUser && (
                    <Alert status="success" borderRadius="md">
                        <AlertIcon />
                        <Box>
                            <AlertTitle>User Created Successfully!</AlertTitle>
                            <AlertDescription>
                                User #{createdUser.user_number} ({createdUser.full_name}) has been created. 
                                They can now log in using user number {createdUser.user_number} and their assigned PIN.
                            </AlertDescription>
                        </Box>
                    </Alert>
                )}

                {submitError && (
                    <Alert status="error" borderRadius="md">
                        <AlertIcon />
                        <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                )}

                <form onSubmit={handleSubmit(onSubmit)}>
                    <VStack spacing={4}>
                        <FormControl isInvalid={!!errors.first_name}>
                            <FormLabel htmlFor="first_name">First Name</FormLabel>
                            <Input
                                id="first_name"
                                placeholder="Enter first name"
                                {...register('first_name', {
                                    required: 'First name is required',
                                    minLength: {
                                        value: 2,
                                        message: 'First name must be at least 2 characters'
                                    }
                                })}
                            />
                            <FormErrorMessage>{errors.first_name?.message}</FormErrorMessage>
                        </FormControl>

                        <FormControl isInvalid={!!errors.last_name}>
                            <FormLabel htmlFor="last_name">Last Name</FormLabel>
                            <Input
                                id="last_name"
                                placeholder="Enter last name"
                                {...register('last_name', {
                                    required: 'Last name is required',
                                    minLength: {
                                        value: 2,
                                        message: 'Last name must be at least 2 characters'
                                    }
                                })}
                            />
                            <FormErrorMessage>{errors.last_name?.message}</FormErrorMessage>
                        </FormControl>

                        <FormControl isInvalid={!!errors.phone}>
                            <FormLabel htmlFor="phone">Phone Number <Text as="span" color={subTextColor}>(Optional)</Text></FormLabel>
                            <Input
                                id="phone"
                                placeholder="5551234567"
                                {...register('phone', {
                                    pattern: {
                                        value: /^\d{10,15}$/,
                                        message: 'Phone number must be 10-15 digits'
                                    },
                                    minLength: {
                                        value: 10,
                                        message: 'Phone number must be at least 10 digits'
                                    }
                                })}
                            />
                            <FormErrorMessage>{errors.phone?.message}</FormErrorMessage>
                        </FormControl>

                        <FormControl isInvalid={!!errors.email}>
                            <FormLabel htmlFor="email">Email <Text as="span" color={subTextColor}>(Optional)</Text></FormLabel>
                            <Input
                                id="email"
                                type="email"
                                placeholder="user@example.com"
                                {...register('email', {
                                    pattern: {
                                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                        message: 'Invalid email format'
                                    }
                                })}
                            />
                            <FormErrorMessage>{errors.email?.message}</FormErrorMessage>
                        </FormControl>

                        <FormControl isInvalid={!!errors.pin}>
                            <FormLabel htmlFor="pin">Initial PIN (4-10 digits)</FormLabel>
                            <Input
                                id="pin"
                                type="password"
                                placeholder="Enter initial PIN for user"
                                {...register('pin', {
                                    required: 'PIN is required',
                                    pattern: {
                                        value: /^\d{4,10}$/,
                                        message: 'PIN must be 4-10 digits'
                                    },
                                    minLength: {
                                        value: 4,
                                        message: 'PIN must be at least 4 digits'
                                    },
                                    maxLength: {
                                        value: 10,
                                        message: 'PIN cannot exceed 10 digits'
                                    }
                                })}
                            />
                            <FormErrorMessage>{errors.pin?.message}</FormErrorMessage>
                            <Text fontSize="sm" color={subTextColor} mt={1}>
                                This PIN will be used by the user to log in
                            </Text>
                        </FormControl>

                        <FormControl isInvalid={!!errors.confirm_pin}>
                            <FormLabel htmlFor="confirm_pin">Confirm PIN</FormLabel>
                            <Input
                                id="confirm_pin"
                                type="password"
                                placeholder="Confirm the PIN"
                                {...register('confirm_pin', {
                                    required: 'Please confirm the PIN',
                                    validate: (value) => {
                                        const pin = watch('pin');
                                        return value === pin || 'PINs do not match';
                                    }
                                })}
                            />
                            <FormErrorMessage>{errors.confirm_pin?.message}</FormErrorMessage>
                        </FormControl>

                        <FormControl>
                            <HStack justify="space-between">
                                <FormLabel htmlFor="is_admin" mb={0}>Admin Privileges</FormLabel>
                                <Switch
                                    id="is_admin"
                                    colorScheme="red"
                                    isChecked={watchedIsAdmin}
                                    onChange={(e) => setValue('is_admin', e.target.checked)}
                                />
                            </HStack>
                            <Text fontSize="sm" color={subTextColor} mt={1}>
                                {watchedIsAdmin ? 'User will have admin privileges' : 'User will have staff privileges'}
                            </Text>
                        </FormControl>

                        <Button
                            type="submit"
                            colorScheme="blue"
                            size="lg"
                            width="full"
                            isLoading={isLoading}
                            loadingText="Creating User..."
                        >
                            Create User
                        </Button>
                    </VStack>
                </form>
            </VStack>
        </Box>
    );
};

export default UserCreateForm;