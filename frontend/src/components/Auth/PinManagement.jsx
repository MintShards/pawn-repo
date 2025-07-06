// PinManagement.jsx - Component for users to update their PIN
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
    Icon,
    Box,
    Badge
} from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { FaKey, FaShieldAlt, FaCheckCircle } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';

export const PinManagement = () => {
    const { register, handleSubmit, formState: { errors, isSubmitting }, watch, reset } = useForm();
    const { updateUserPin, checkPinStrength } = useAuth();
    const toast = useToast();
    const [pinStrength, setPinStrength] = useState(null);
    const [isCheckingStrength, setIsCheckingStrength] = useState(false);
    
    const newPin = watch('new_pin');
    
    useEffect(() => {
        const checkStrength = async () => {
            if (newPin && newPin.length >= 4) {
                setIsCheckingStrength(true);
                try {
                    const strength = await checkPinStrength(newPin);
                    setPinStrength(strength);
                } catch (error) {
                    console.error('Error checking PIN strength:', error);
                } finally {
                    setIsCheckingStrength(false);
                }
            } else {
                setPinStrength(null);
            }
        };
        
        const timeoutId = setTimeout(checkStrength, 500);
        return () => clearTimeout(timeoutId);
    }, [newPin, checkPinStrength]);
    
    const onSubmit = async (values) => {
        try {
            await updateUserPin(values.current_pin, values.new_pin);
            
            toast({
                title: 'PIN Updated Successfully',
                description: 'Your PIN has been changed. Please remember your new PIN.',
                status: 'success',
                duration: 5000,
                isClosable: true
            });
            
            // Clear the form
            reset();
            setPinStrength(null);
            
        } catch (error) {
            console.error('PIN update failed:', error);
            toast({
                title: 'PIN Update Failed',
                description: error.message || 'Failed to update PIN.',
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        }
    };

    const getStrengthColor = (score) => {
        if (score <= 2) return 'red';
        if (score <= 3) return 'orange';
        if (score <= 4) return 'yellow';
        return 'green';
    };

    const getStrengthLabel = (score) => {
        if (score <= 2) return 'Weak';
        if (score <= 3) return 'Fair';
        if (score <= 4) return 'Good';
        return 'Strong';
    };

    return (
        <Flex justifyContent="center" alignItems="center" minHeight="80vh" p={4}>
            <Flex 
                direction="column"
                alignItems="center"
                background={useColorModeValue('white', 'gray.800')}
                p={8}
                rounded="lg"
                shadow="lg"
                maxWidth="500px"
                width="100%"
                border="1px"
                borderColor={useColorModeValue('gray.200', 'gray.600')}
            >
                <HStack mb={6}>
                    <Icon as={FaShieldAlt} color="blue.500" boxSize={6} />
                    <Heading size="lg" color={useColorModeValue('gray.800', 'white')}>
                        Update Your PIN
                    </Heading>
                </HStack>
                
                <Text mb={6} color={useColorModeValue('gray.600', 'gray.300')} textAlign="center">
                    Change your login PIN for security
                </Text>

                <Alert status="info" mb={6} rounded="md">
                    <AlertIcon />
                    <VStack align="start" spacing={0}>
                        <AlertTitle fontSize="sm">Security Tips</AlertTitle>
                        <AlertDescription fontSize="sm">
                            Use a PIN that's easy for you to remember but hard for others to guess. 
                            Avoid simple patterns like 1234 or repeated digits.
                        </AlertDescription>
                    </VStack>
                </Alert>
                
                <form onSubmit={handleSubmit(onSubmit)} style={{ width: '100%' }}>
                    <VStack spacing={6} align="stretch">
                        <FormControl isInvalid={errors.current_pin}>
                            <FormLabel>Current PIN</FormLabel>
                            <Input
                                placeholder="Enter your current PIN"
                                type="password"
                                size="lg"
                                {...register('current_pin', {
                                    required: 'Current PIN is required',
                                    minLength: {
                                        value: 4,
                                        message: 'PIN must be at least 4 digits'
                                    },
                                    pattern: {
                                        value: /^\d+$/,
                                        message: 'PIN must contain only numbers'
                                    }
                                })}
                            />
                            <FormErrorMessage>
                                {errors.current_pin && errors.current_pin.message}
                            </FormErrorMessage>
                        </FormControl>
                        
                        <Box>
                            <FormControl isInvalid={errors.new_pin}>
                                <FormLabel>New PIN</FormLabel>
                                <Input
                                    placeholder="Enter your new PIN (4-10 digits)"
                                    type="password"
                                    size="lg"
                                    {...register('new_pin', {
                                        required: 'New PIN is required',
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
                                    {errors.new_pin && errors.new_pin.message}
                                </FormErrorMessage>
                            </FormControl>
                            
                            {/* PIN Strength Indicator */}
                            {newPin && newPin.length >= 4 && (
                                <Box mt={3} p={3} bg={useColorModeValue('gray.50', 'gray.700')} rounded="md">
                                    <HStack justify="space-between" mb={2}>
                                        <Text fontSize="sm" fontWeight="medium">PIN Strength:</Text>
                                        {isCheckingStrength ? (
                                            <Text fontSize="sm">Checking...</Text>
                                        ) : pinStrength && (
                                            <Badge colorScheme={getStrengthColor(pinStrength.score)}>
                                                {getStrengthLabel(pinStrength.score)}
                                            </Badge>
                                        )}
                                    </HStack>
                                    
                                    {pinStrength && !isCheckingStrength && (
                                        <>
                                            <Progress 
                                                value={(pinStrength.score / 5) * 100} 
                                                colorScheme={getStrengthColor(pinStrength.score)}
                                                size="sm"
                                                mb={2}
                                            />
                                            
                                            {pinStrength.feedback.length > 0 && (
                                                <VStack align="start" spacing={1}>
                                                    {pinStrength.feedback.map((feedback, index) => (
                                                        <Text key={index} fontSize="xs" color="orange.600">
                                                            • {feedback}
                                                        </Text>
                                                    ))}
                                                </VStack>
                                            )}
                                            
                                            {pinStrength.suggestions.length > 0 && (
                                                <VStack align="start" spacing={1} mt={1}>
                                                    {pinStrength.suggestions.map((suggestion, index) => (
                                                        <Text key={index} fontSize="xs" color="blue.600">
                                                            💡 {suggestion}
                                                        </Text>
                                                    ))}
                                                </VStack>
                                            )}
                                        </>
                                    )}
                                </Box>
                            )}
                        </Box>
                        
                        <FormControl isInvalid={errors.confirm_pin}>
                            <FormLabel>Confirm New PIN</FormLabel>
                            <Input
                                placeholder="Re-enter your new PIN"
                                type="password"
                                size="lg"
                                {...register('confirm_pin', {
                                    required: 'Please confirm your new PIN',
                                    validate: value => 
                                        value === newPin || 'PINs do not match'
                                })}
                            />
                            <FormErrorMessage>
                                {errors.confirm_pin && errors.confirm_pin.message}
                            </FormErrorMessage>
                        </FormControl>
                        
                        <Button
                            type="submit"
                            colorScheme="blue"
                            variant="solid"
                            size="lg"
                            width="100%"
                            isLoading={isSubmitting}
                            loadingText="Updating PIN..."
                            leftIcon={<Icon as={FaKey} />}
                        >
                            Update PIN
                        </Button>
                    </VStack>
                </form>
            </Flex>
        </Flex>
    );
};

export default PinManagement;