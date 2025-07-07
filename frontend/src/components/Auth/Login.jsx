// Login.jsx - Updated for PIN Authentication (Fixed Hooks)
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
    AlertDescription
} from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import ThemeToggler from '../Theme/ThemeToggler';
import { useAuth } from '../../hooks/useAuth';

export const Login = () => {
    const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm();
    const navigate = useNavigate();
    const { login, checkFirstTimeSetup } = useAuth();
    const toast = useToast();
    const [needsSetup, setNeedsSetup] = useState(false);
    const [setupLoading, setSetupLoading] = useState(true);
    
    // Call all hooks at the top level (before any early returns)
    const bgColor = useColorModeValue('gray.100', 'gray.700');
    const headingColor = useColorModeValue('gray.800', 'white');
    const textColor = useColorModeValue('gray.600', 'gray.300');
    const inputBg = useColorModeValue('gray.300', 'gray.600');
    const helpTextColor = useColorModeValue('gray.600', 'gray.400');
    
    const userNumberValue = watch('user_number');
    
    useEffect(() => {
        // Check if first time setup is needed
        const checkSetup = async () => {
            try {
                const setupStatus = await checkFirstTimeSetup();
                setNeedsSetup(setupStatus.is_first_time_setup);
            } catch (error) {
                console.error('Failed to check setup status:', error);
            } finally {
                setSetupLoading(false);
            }
        };
        
        checkSetup();
    }, [checkFirstTimeSetup]);
    
    const onSubmit = async (values) => {
        try {
            // Convert user_number to number
            const loginData = {
                user_number: parseInt(values.user_number),
                pin: values.pin
            };
            
            await login(loginData.user_number, loginData.pin);
            
            toast({
                title: 'Login Successful',
                description: `Welcome back, User #${loginData.user_number}!`,
                status: 'success',
                duration: 3000,
                isClosable: true
            });
        } catch (error) {
            console.error('Login failed:', error);
            toast({
                title: 'Login Failed',
                description: error.message || 'Invalid user number or PIN.',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        }
    };

    if (setupLoading) {
        return (
            <Flex height="100vh" justifyContent="center" alignItems="center">
                <Text>Checking system status...</Text>
            </Flex>
        );
    }

    if (needsSetup) {
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
                    <Alert status="warning" mb={6} rounded="md">
                        <AlertIcon />
                        <VStack align="start" spacing={0}>
                            <AlertTitle>First Time Setup Required</AlertTitle>
                            <AlertDescription>
                                No admin user exists. Please create the first admin user.
                            </AlertDescription>
                        </VStack>
                    </Alert>
                    
                    <Button
                        colorScheme="blue"
                        size="lg"
                        onClick={() => navigate('/setup', { replace: true })}
                    >
                        Create Admin User
                    </Button>
                    
                    <ThemeToggler showLabel={true} mt={4} />
                </Flex>
            </Flex>
        );
    }

    return (
        <Flex height="100vh" justifyContent="center" alignItems="center">
            <Flex 
                direction="column"
                alignItems="center"
                background={bgColor}
                p={12}
                rounded={6}
                maxWidth="400px"
                width="100%"
            >
                <Heading mb={2} color={headingColor}>
                    Pawn Repo
                </Heading>
                <Text mb={6} color={textColor} textAlign="center">
                    Enter your user number and PIN
                </Text>
                
                <form onSubmit={handleSubmit(onSubmit)} style={{ width: '100%' }}>
                    <VStack spacing={4} align="stretch">
                        <FormControl isInvalid={errors.user_number}>
                            <FormLabel>User Number</FormLabel>
                            <Input
                                placeholder="Enter 2-digit user number (10-99)"
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
                            {userNumberValue && (userNumberValue < 10 || userNumberValue > 99) && (
                                <Text fontSize="sm" color="orange.500" mt={1}>
                                    Valid range: 10-99
                                </Text>
                            )}
                        </FormControl>
                        
                        <FormControl isInvalid={errors.pin}>
                            <FormLabel>PIN</FormLabel>
                            <Input
                                placeholder="Enter your 4-10 digit PIN"
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
                        
                        <Button
                            type="submit"
                            colorScheme="green"
                            variant="solid"
                            size="lg"
                            width="100%"
                            isLoading={isSubmitting}
                            loadingText="Logging in..."
                        >
                            Login
                        </Button>
                    </VStack>
                </form>
                
                <VStack spacing={4} mt={6} width="100%">
                    <ThemeToggler showLabel={true}/>
                    
                    <Text fontSize="sm" color={helpTextColor} textAlign="center">
                        Need help? Contact your administrator
                    </Text>
                </VStack>
            </Flex>
        </Flex>
    );
};

export default Login;