import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    VStack,
    HStack,
    Text,
    Input,
    Textarea,
    Select,
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
    Spacer,
    IconButton,
    Tooltip
} from '@chakra-ui/react';
import { FiArrowLeft, FiSave, FiUser, FiPhone, FiMail, FiMapPin } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../../services/axios';

const CustomerForm = () => {
    const navigate = useNavigate();
    const { customerId } = useParams();
    const isEdit = Boolean(customerId);
    const toast = useToast();
    
    const { register, handleSubmit, formState: { errors, isSubmitting }, reset, watch } = useForm();
    const [loading, setLoading] = useState(false);
    const [customer, setCustomer] = useState(null);
    
    // Color mode values
    const cardBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const textColor = useColorModeValue('gray.600', 'gray.300');
    
    // Load customer data for editing
    useEffect(() => {
        if (isEdit && customerId) {
            const fetchCustomer = async () => {
                try {
                    setLoading(true);
                    const response = await axiosInstance.get(`/customers/${customerId}`);
                    const customerData = response.data;
                    setCustomer(customerData);
                    
                    // Reset form with customer data
                    reset({
                        first_name: customerData.first_name || '',
                        last_name: customerData.last_name || '',
                        phone: customerData.phone || '',
                        email: customerData.email || '',
                        address: customerData.address || '',
                        city: customerData.city || '',
                        state: customerData.state || '',
                        zip_code: customerData.zip_code || '',
                        id_type: customerData.id_type || '',
                        id_number: customerData.id_number || '',
                        notes: customerData.notes || ''
                    });
                } catch (error) {
                    console.error('Error fetching customer:', error);
                    toast({
                        title: 'Error Loading Customer',
                        description: error.response?.data?.detail || 'Failed to load customer data',
                        status: 'error',
                        duration: 5000,
                        isClosable: true
                    });
                    navigate('/customers');
                } finally {
                    setLoading(false);
                }
            };
            
            fetchCustomer();
        }
    }, [isEdit, customerId, reset, navigate, toast]);
    
    // Handle form submission
    const onSubmit = async (data) => {
        try {
            // Format phone number (remove any non-digits)
            const formattedData = {
                ...data,
                phone: data.phone.replace(/\D/g, ''),
                email: data.email || null, // Allow empty email
                address: data.address || null,
                city: data.city || null,
                state: data.state || null,
                zip_code: data.zip_code || null,
                id_type: data.id_type || null,
                id_number: data.id_number || null,
                notes: data.notes || null
            };
            
            if (isEdit) {
                await axiosInstance.put(`/customers/${customerId}`, formattedData);
                toast({
                    title: 'Customer Updated',
                    description: 'Customer information has been successfully updated',
                    status: 'success',
                    duration: 3000,
                    isClosable: true
                });
            } else {
                const response = await axiosInstance.post('/customers', formattedData);
                toast({
                    title: 'Customer Created',
                    description: 'New customer has been successfully created',
                    status: 'success',
                    duration: 3000,
                    isClosable: true
                });
                navigate(`/customers/${response.data.customer_id}`);
                return;
            }
            
            navigate('/customers');
        } catch (error) {
            console.error('Error saving customer:', error);
            toast({
                title: isEdit ? 'Error Updating Customer' : 'Error Creating Customer',
                description: error.response?.data?.detail || 'Failed to save customer',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        }
    };
    
    // Format phone number for display
    const formatPhoneInput = (value) => {
        if (!value) return '';
        const phoneNumber = value.replace(/\D/g, '');
        if (phoneNumber.length <= 3) return phoneNumber;
        if (phoneNumber.length <= 6) return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
    };
    
    const phoneValue = watch('phone');
    
    if (loading) {
        return (
            <Box p={6}>
                <Text>Loading customer data...</Text>
            </Box>
        );
    }
    
    return (
        <Box p={6}>
            {/* Header */}
            <Flex mb={6} align="center">
                <HStack>
                    <Tooltip label="Back to Customers">
                        <IconButton
                            icon={<FiArrowLeft />}
                            variant="outline"
                            onClick={() => navigate('/customers')}
                        />
                    </Tooltip>
                    <VStack align="start" spacing={0}>
                        <Heading size="lg">
                            {isEdit ? 'Edit Customer' : 'New Customer'}
                        </Heading>
                        <Text color={textColor}>
                            {isEdit ? 'Update customer information' : 'Add a new customer to the system'}
                        </Text>
                    </VStack>
                </HStack>
            </Flex>
            
            <form onSubmit={handleSubmit(onSubmit)}>
                <VStack spacing={6} align="stretch">
                    {/* Personal Information */}
                    <Card bg={cardBg} border="1px" borderColor={borderColor}>
                        <CardHeader>
                            <HStack>
                                <FiUser />
                                <Heading size="md">Personal Information</Heading>
                            </HStack>
                        </CardHeader>
                        <CardBody>
                            <VStack spacing={4}>
                                <HStack spacing={4} w="100%">
                                    <FormControl isInvalid={errors.first_name} isRequired>
                                        <FormLabel>First Name</FormLabel>
                                        <Input
                                            {...register('first_name', {
                                                required: 'First name is required',
                                                minLength: {
                                                    value: 2,
                                                    message: 'First name must be at least 2 characters'
                                                }
                                            })}
                                        />
                                        <FormErrorMessage>
                                            {errors.first_name && errors.first_name.message}
                                        </FormErrorMessage>
                                    </FormControl>
                                    
                                    <FormControl isInvalid={errors.last_name} isRequired>
                                        <FormLabel>Last Name</FormLabel>
                                        <Input
                                            {...register('last_name', {
                                                required: 'Last name is required',
                                                minLength: {
                                                    value: 2,
                                                    message: 'Last name must be at least 2 characters'
                                                }
                                            })}
                                        />
                                        <FormErrorMessage>
                                            {errors.last_name && errors.last_name.message}
                                        </FormErrorMessage>
                                    </FormControl>
                                </HStack>
                                
                                <HStack spacing={4} w="100%">
                                    <FormControl isInvalid={errors.phone} isRequired>
                                        <FormLabel>Phone Number</FormLabel>
                                        <Input
                                            {...register('phone', {
                                                required: 'Phone number is required',
                                                pattern: {
                                                    value: /^\d{10}$/,
                                                    message: 'Please enter a valid 10-digit phone number'
                                                }
                                            })}
                                            placeholder="(555) 123-4567"
                                            value={formatPhoneInput(phoneValue)}
                                            onChange={(e) => {
                                                const formatted = formatPhoneInput(e.target.value);
                                                register('phone').onChange({
                                                    target: { value: formatted }
                                                });
                                            }}
                                        />
                                        <FormErrorMessage>
                                            {errors.phone && errors.phone.message}
                                        </FormErrorMessage>
                                    </FormControl>
                                    
                                    <FormControl isInvalid={errors.email}>
                                        <FormLabel>Email (Optional)</FormLabel>
                                        <Input
                                            type="email"
                                            {...register('email', {
                                                pattern: {
                                                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                                    message: 'Please enter a valid email address'
                                                }
                                            })}
                                        />
                                        <FormErrorMessage>
                                            {errors.email && errors.email.message}
                                        </FormErrorMessage>
                                    </FormControl>
                                </HStack>
                            </VStack>
                        </CardBody>
                    </Card>
                    
                    {/* Address Information */}
                    <Card bg={cardBg} border="1px" borderColor={borderColor}>
                        <CardHeader>
                            <HStack>
                                <FiMapPin />
                                <Heading size="md">Address Information</Heading>
                            </HStack>
                        </CardHeader>
                        <CardBody>
                            <VStack spacing={4}>
                                <FormControl>
                                    <FormLabel>Street Address</FormLabel>
                                    <Input {...register('address')} />
                                </FormControl>
                                
                                <HStack spacing={4} w="100%">
                                    <FormControl>
                                        <FormLabel>City</FormLabel>
                                        <Input {...register('city')} />
                                    </FormControl>
                                    
                                    <FormControl>
                                        <FormLabel>State</FormLabel>
                                        <Input {...register('state')} />
                                    </FormControl>
                                    
                                    <FormControl>
                                        <FormLabel>ZIP Code</FormLabel>
                                        <Input {...register('zip_code')} />
                                    </FormControl>
                                </HStack>
                            </VStack>
                        </CardBody>
                    </Card>
                    
                    {/* ID Information */}
                    <Card bg={cardBg} border="1px" borderColor={borderColor}>
                        <CardHeader>
                            <Heading size="md">ID Information</Heading>
                        </CardHeader>
                        <CardBody>
                            <VStack spacing={4}>
                                <HStack spacing={4} w="100%">
                                    <FormControl>
                                        <FormLabel>ID Type</FormLabel>
                                        <Select {...register('id_type')}>
                                            <option value="">Select ID Type</option>
                                            <option value="drivers_license">Driver's License</option>
                                            <option value="state_id">State ID</option>
                                            <option value="passport">Passport</option>
                                            <option value="military_id">Military ID</option>
                                            <option value="other">Other</option>
                                        </Select>
                                    </FormControl>
                                    
                                    <FormControl>
                                        <FormLabel>ID Number</FormLabel>
                                        <Input {...register('id_number')} />
                                    </FormControl>
                                </HStack>
                            </VStack>
                        </CardBody>
                    </Card>
                    
                    {/* Notes */}
                    <Card bg={cardBg} border="1px" borderColor={borderColor}>
                        <CardHeader>
                            <Heading size="md">Notes</Heading>
                        </CardHeader>
                        <CardBody>
                            <FormControl>
                                <FormLabel>Internal Notes</FormLabel>
                                <Textarea
                                    {...register('notes')}
                                    placeholder="Internal notes about the customer (not visible to customer)"
                                    rows={3}
                                />
                            </FormControl>
                        </CardBody>
                    </Card>
                    
                    {/* Actions */}
                    <Card bg={cardBg} border="1px" borderColor={borderColor}>
                        <CardBody>
                            <HStack spacing={4}>
                                <Button
                                    type="submit"
                                    colorScheme="blue"
                                    leftIcon={<FiSave />}
                                    isLoading={isSubmitting}
                                    loadingText={isEdit ? 'Updating...' : 'Creating...'}
                                >
                                    {isEdit ? 'Update Customer' : 'Create Customer'}
                                </Button>
                                
                                <Button
                                    variant="outline"
                                    onClick={() => navigate('/customers')}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </Button>
                            </HStack>
                        </CardBody>
                    </Card>
                </VStack>
            </form>
        </Box>
    );
};

export default CustomerForm;