// FirstTimeSetup.jsx - Create first admin user (Fixed Hooks)
import { 
    Flex, 
    useColorModeValue, 
    Heading, 
    FormControl, 
    Input, 
    FormErrorMessage, 
    Button, 
    useToast,
    Text,
    VStack,
    FormLabel,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    Progress,
    HStack,
    Icon
} from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { FaShieldAlt, FaUser, FaKey } from 'react-icons/fa';
import ThemeToggler from '../Theme/ThemeToggler';
import { useAuth } from '../../hooks/useAuth';

export const FirstTimeSetup = () => {
    const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm();
    const navigate = useNavigate();
    const { createFirstAdmin } = useAuth();
    const toast = useToast();
    
    // Call all hooks at the top level
    const bgColor = useColorModeValue('gray.100', 'gray.700');
    const headingColor = useColorModeValue('gray.800', 'white');
    const textColor = useColorModeValue('gray.600', 'gray.300');
    const sectionBg = useColorModeValue('gray.50', 'gray.600');
    const inputBg = useColorModeValue('white', 'gray.500');
    const progressBg = useColorModeValue('gray.300', 'gray.600');
    
    const watchedValues = watch();
    const { user_number, first_name, last_name, pin, confirm_pin } = watchedValues;
    
    const onSubmit = async (values) => {
        try {
            const adminData = {
                user_number: parseInt(values.user_number),
                first_name: values.first_name,
                last_name: values.last_name,
                pin: values.pin,
                confirm_pin: values.confirm_pin
            };
            
            await createFirstAdmin(adminData);
            
            toast({
                title: 'Admin Created Successfully!',
                description: `Admin user #${adminData.user_number} has been created. You can now login.`,
                status: 'success',
                duration: 5000,
                isClosable: true
            });
            
            // Navigate to login after success
            setTimeout(() => {
                navigate('/login', { replace: true });
            }, 2000);
            
        } catch (error) {
            console.error('Setup failed:', error);
            toast({
                title: 'Setup Failed',
                description: error.message || 'Failed to create admin user.',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        }
    };

    const getStepProgress = () => {
        if (user_number && first_name && last_name) {
            if (pin && confirm_pin && pin === confirm_pin) {
                return 100;
            }
            return 66;
        }
        if (user_number) {
            return 33;
        }
        return 0;
    };

    return (
        <Flex height="100vh" justifyContent="center" alignItems="center">
            <Flex 
                direction="column"
                alignItems="center"
                background={bgColor}
                p={12}
                rounded={6}
                maxWidth="500px"
                width="100%"
            >
                <HStack mb={4}>
                    <Icon as={FaShieldAlt} color="blue.500" boxSize={6} />
                    <Heading size="lg" color={headingColor}>
                        First Time Setup
                    </Heading>
                </HStack>
                
                <Text mb={6} color={textColor} textAlign="center">
                    Create the first administrator user for your pawn shop system
                </Text>

                <Progress 
                    value={getStepProgress()} 
                    width="100%" 
                    mb={6} 
                    colorScheme="blue" 
                    bg={progressBg}
                    rounded="md"
                />
                
                <Alert status="info" mb={6} rounded="md">
                    <AlertIcon />
                    <VStack align="start" spacing={0}>
                        <AlertTitle fontSize="sm">Admin Account</AlertTitle>
                        <AlertDescription fontSize="sm">
                            This admin can create other users and manage the system
                        </AlertDescription>
                    </VStack>
                </Alert>
                
                <form onSubmit={handleSubmit(onSubmit)} style={{ width: '100%' }}>
                    <VStack spacing={4} align="stretch">
                        {/* Step 1: User Number */}
                        <VStack spacing={3} align="stretch" p={4} bg={sectionBg} rounded="md">
                            <HStack>
                                <Icon as={FaUser} color="blue.500" />
                                <Text fontWeight="bold">Admin User Number</Text>
                            </HStack>
                            
                            <FormControl isInvalid={errors.user_number}>
                                <FormLabel fontSize="sm">Choose a 2-digit ID (10-99)</FormLabel>
                                <Input
                                    placeholder="e.g., 10"
                                    type="number"
                                    autoFocus
                                    background={inputBg}
                                    size="lg"
                                    min={10}
                                    max={99}
                                    {...register('user_number', {
                                        required: 'User number is required',
                                        validate: {
                                            isNumber: value => {
                                                const num = parseInt(value);
                                                if (isNaN(num)) return 'Please enter a valid number';
                                                if (num < 10 || num > 99) return 'User number must be between 10 and 99';
                                                return true;
                                            }
                                        }
                                    })}
                                />
                                <FormErrorMessage>
                                    {errors.user_number && errors.user_number.message}
                                </FormErrorMessage>
                                <Text fontSize="xs" color="gray.500" mt={1}>
                                    This will be your login ID (remember this number!)
                                </Text>
                            </FormControl>
                        </VStack>

                        {/* Step 2: Personal Info */}
                        <VStack spacing={3} align="stretch" p={4} bg={sectionBg} rounded="md">
                            <Text fontWeight="bold">Personal Information</Text>
                            
                            <HStack spacing={3}>
                                <FormControl isInvalid={errors.first_name}>
                                    <FormLabel fontSize="sm">First Name</FormLabel>
                                    <Input
                                        placeholder="John"
                                        type="text"
                                        background={inputBg}
                                        size="lg"
                                        {...register('first_name', {
                                            required: 'First name is required',
                                            minLength: {
                                                value: 1,
                                                message: 'First name is required'
                                            },
                                            maxLength: {
                                                value: 50,
                                                message: 'First name must be less than 50 characters'
                                            }
                                        })}
                                    />
                                    <FormErrorMessage>
                                        {errors.first_name && errors.first_name.message}
                                    </FormErrorMessage>
                                </FormControl>
                                
                                <FormControl isInvalid={errors.last_name}>
                                    <FormLabel fontSize="sm">Last Name</FormLabel>
                                    <Input
                                        placeholder="Doe"
                                        type="text"
                                        background={inputBg}
                                        size="lg"
                                        {...register('last_name', {
                                            required: 'Last name is required',
                                            minLength: {
                                                value: 1,
                                                message: 'Last name is required'
                                            },
                                            maxLength: {
                                                value: 50,
                                                message: 'Last name must be less than 50 characters'
                                            }
                                        })}
                                    />
                                    <FormErrorMessage>
                                        {errors.last_name && errors.last_name.message}
                                    </FormErrorMessage>
                                </FormControl>
                            </HStack>
                        </VStack>

                        {/* Step 3: PIN Setup */}
                        <VStack spacing={3} align="stretch" p={4} bg={sectionBg} rounded="md">
                            <HStack>
                                <Icon as={FaKey} color="blue.500" />
                                <Text fontWeight="bold">Security PIN</Text>
                            </HStack>
                            
                            <FormControl isInvalid={errors.pin}>
                                <FormLabel fontSize="sm">Create PIN (4-10 digits)</FormLabel>
                                <Input
                                    placeholder="Enter your secure PIN"
                                    type="password"
                                    background={inputBg}
                                    size="lg"
                                    {...register('pin', {
                                        required: 'PIN is required',
                                        minLength: {
                                            value: 4,
                                            message: 'PIN must be at least 4 digits'
                                        },
                                        maxLength: {
                                            value: 10,
                                            message: 'PIN must be no more than 10 digits'
                                        },
                                        pattern: {
                                            value: /^\d+$/,
                                            message: 'PIN must contain only numbers'
                                        }
                                    })}
                                />
                                <FormErrorMessage>
                                    {errors.pin && errors.pin.message}
                                </FormErrorMessage>
                            </FormControl>
                            
                            <FormControl isInvalid={errors.confirm_pin}>
                                <FormLabel fontSize="sm">Confirm PIN</FormLabel>
                                <Input
                                    placeholder="Re-enter your PIN"
                                    type="password"
                                    background={inputBg}
                                    size="lg"
                                    {...register('confirm_pin', {
                                        required: 'Please confirm your PIN',
                                        validate: value => 
                                            value === pin || 'PINs do not match'
                                    })}
                                />
                                <FormErrorMessage>
                                    {errors.confirm_pin && errors.confirm_pin.message}
                                </FormErrorMessage>
                            </FormControl>
                            
                            <Text fontSize="xs" color="gray.500">
                                Use a secure PIN you'll remember. Avoid simple patterns like 1234.
                            </Text>
                        </VStack>
                        
                        <Button
                            type="submit"
                            colorScheme="blue"
                            variant="solid"
                            size="lg"
                            width="100%"
                            isLoading={isSubmitting}
                            loadingText="Creating admin..."
                            isDisabled={getStepProgress() < 100}
                        >
                            Create Admin Account
                        </Button>
                    </VStack>
                </form>
                
                <VStack spacing={4} mt={6} width="100%">
                    <ThemeToggler showLabel={true}/>
                    
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/login', { replace: true })}
                    >
                        ← Back to Login
                    </Button>
                </VStack>
            </Flex>
        </Flex>
    );
};

export default FirstTimeSetup;