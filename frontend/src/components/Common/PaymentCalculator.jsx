import React, { useState, useEffect } from 'react';
import {
    Box,
    VStack,
    HStack,
    Text,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    NumberIncrementStepper,
    NumberDecrementStepper,
    Card,
    CardBody,
    Badge,
    Stat,
    StatLabel,
    StatNumber,
    StatHelpText,
    Divider,
    useColorModeValue
} from '@chakra-ui/react';

const PaymentCalculator = ({ loanStatus, paymentAmount, onPaymentChange }) => {
    const [calculatedResult, setCalculatedResult] = useState(null);
    
    // Color mode values
    const cardBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const successColor = useColorModeValue('green.50', 'green.900');
    const warningColor = useColorModeValue('orange.50', 'orange.900');
    
    // Calculate payment allocation in real-time
    useEffect(() => {
        if (!loanStatus || !paymentAmount || parseFloat(paymentAmount) <= 0) {
            setCalculatedResult(null);
            return;
        }
        
        const amount = parseFloat(paymentAmount);
        const currentBalance = loanStatus.current_balance;
        const monthlyInterest = loanStatus.monthly_interest_fee;
        const totalOwed = loanStatus.total_amount_owed;
        const minimumPayment = loanStatus.minimum_payment_required;
        
        // Calculate payment allocation based on pawnshop rules
        let result = {
            paymentAmount: amount,
            interestPayment: 0,
            principalPayment: 0,
            newBalance: currentBalance,
            paymentType: '',
            isValid: false,
            overpayment: 0,
            newDueDate: null
        };
        
        // Check if payment meets minimum requirement
        if (amount < minimumPayment) {
            result.paymentType = 'insufficient';
            result.isValid = false;
        } else if (amount >= totalOwed) {
            // Full redemption
            result.interestPayment = monthlyInterest;
            result.principalPayment = currentBalance;
            result.newBalance = 0;
            result.overpayment = amount - totalOwed;
            result.paymentType = 'full_redemption';
            result.isValid = true;
        } else if (amount <= monthlyInterest + 0.01) {
            // Interest-only payment (extension)
            result.interestPayment = monthlyInterest;
            result.principalPayment = 0;
            result.newBalance = currentBalance;
            result.paymentType = 'interest_only';
            result.isValid = true;
        } else {
            // Partial payment (interest + some principal)
            result.interestPayment = monthlyInterest;
            result.principalPayment = amount - monthlyInterest;
            result.newBalance = Math.max(0, currentBalance - result.principalPayment);
            result.paymentType = 'partial_payment';
            result.isValid = true;
        }
        
        // Calculate new due date (simplified - would be 30 days from original due in real system)
        if (result.isValid && result.paymentType !== 'full_redemption') {
            const currentDue = new Date(loanStatus.current_due_date);
            const newDue = new Date(currentDue);
            newDue.setMonth(newDue.getMonth() + 1);
            result.newDueDate = newDue;
        }
        
        setCalculatedResult(result);
    }, [loanStatus, paymentAmount]);
    
    // Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    };
    
    // Format date
    const formatDate = (date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };
    
    // Get payment type display info
    const getPaymentTypeInfo = (type) => {
        switch (type) {
            case 'insufficient':
                return {
                    label: 'Insufficient Payment',
                    color: 'red',
                    description: `Minimum payment required: ${formatCurrency(loanStatus?.minimum_payment_required)}`
                };
            case 'interest_only':
                return {
                    label: 'Interest Only (Extension)',
                    color: 'blue',
                    description: 'Extends loan by 1 month, balance remains same'
                };
            case 'partial_payment':
                return {
                    label: 'Partial Payment',
                    color: 'orange',
                    description: 'Reduces balance and extends loan by 1 month'
                };
            case 'full_redemption':
                return {
                    label: 'Full Redemption',
                    color: 'green',
                    description: 'Pays off loan completely, item ready for pickup'
                };
            default:
                return {
                    label: 'Unknown',
                    color: 'gray',
                    description: ''
                };
        }
    };
    
    if (!loanStatus) {
        return null;
    }
    
    return (
        <Card bg={cardBg} border="1px" borderColor={borderColor}>
            <CardBody>
                <VStack spacing={4} align="stretch">
                    <Text fontWeight="semibold" fontSize="md">
                        Payment Calculator
                    </Text>
                    
                    {/* Current Loan Status */}
                    <VStack spacing={2} align="stretch">
                        <HStack justify="space-between">
                            <Text fontSize="sm" color="gray.600">Current Balance:</Text>
                            <Text fontWeight="bold">{formatCurrency(loanStatus.current_balance)}</Text>
                        </HStack>
                        <HStack justify="space-between">
                            <Text fontSize="sm" color="gray.600">Monthly Interest:</Text>
                            <Text fontWeight="bold">{formatCurrency(loanStatus.monthly_interest_fee)}</Text>
                        </HStack>
                        <HStack justify="space-between">
                            <Text fontSize="sm" color="gray.600">Total Amount Owed:</Text>
                            <Text fontWeight="bold" color="red.500">{formatCurrency(loanStatus.total_amount_owed)}</Text>
                        </HStack>
                    </VStack>
                    
                    <Divider />
                    
                    {/* Payment Amount Input */}
                    <Box>
                        <Text fontSize="sm" fontWeight="medium" mb={2}>
                            Payment Amount:
                        </Text>
                        <NumberInput
                            value={paymentAmount}
                            onChange={(value) => onPaymentChange(value)}
                            min={0}
                            precision={2}
                            step={0.01}
                        >
                            <NumberInputField placeholder="Enter amount..." />
                            <NumberInputStepper>
                                <NumberIncrementStepper />
                                <NumberDecrementStepper />
                            </NumberInputStepper>
                        </NumberInput>
                    </Box>
                    
                    {/* Real-time Calculation Results */}
                    {calculatedResult && (
                        <>
                            <Divider />
                            
                            <Box>
                                <HStack justify="space-between" mb={3}>
                                    <Text fontWeight="medium">Payment Breakdown:</Text>
                                    <Badge colorScheme={getPaymentTypeInfo(calculatedResult.paymentType).color}>
                                        {getPaymentTypeInfo(calculatedResult.paymentType).label}
                                    </Badge>
                                </HStack>
                                
                                {calculatedResult.isValid ? (
                                    <VStack spacing={3} align="stretch">
                                        <Box p={3} bg={successColor} borderRadius="md">
                                            <VStack spacing={2} align="stretch">
                                                <HStack justify="space-between">
                                                    <Text fontSize="sm">Interest Payment:</Text>
                                                    <Text fontWeight="bold">{formatCurrency(calculatedResult.interestPayment)}</Text>
                                                </HStack>
                                                <HStack justify="space-between">
                                                    <Text fontSize="sm">Principal Payment:</Text>
                                                    <Text fontWeight="bold">{formatCurrency(calculatedResult.principalPayment)}</Text>
                                                </HStack>
                                                {calculatedResult.overpayment > 0 && (
                                                    <HStack justify="space-between">
                                                        <Text fontSize="sm" color="blue.600">Overpayment:</Text>
                                                        <Text fontWeight="bold" color="blue.600">{formatCurrency(calculatedResult.overpayment)}</Text>
                                                    </HStack>
                                                )}
                                                <Divider />
                                                <HStack justify="space-between">
                                                    <Text fontSize="sm" fontWeight="bold">New Balance:</Text>
                                                    <Text fontWeight="bold" fontSize="lg" color={calculatedResult.newBalance === 0 ? 'green.500' : 'orange.500'}>
                                                        {formatCurrency(calculatedResult.newBalance)}
                                                    </Text>
                                                </HStack>
                                                {calculatedResult.newDueDate && (
                                                    <HStack justify="space-between">
                                                        <Text fontSize="sm">New Due Date:</Text>
                                                        <Text fontWeight="bold">{formatDate(calculatedResult.newDueDate)}</Text>
                                                    </HStack>
                                                )}
                                            </VStack>
                                        </Box>
                                        
                                        <Text fontSize="sm" color="gray.600" fontStyle="italic">
                                            {getPaymentTypeInfo(calculatedResult.paymentType).description}
                                        </Text>
                                    </VStack>
                                ) : (
                                    <Box p={3} bg={warningColor} borderRadius="md">
                                        <Text fontSize="sm" color="red.600" fontWeight="medium">
                                            {getPaymentTypeInfo(calculatedResult.paymentType).description}
                                        </Text>
                                    </Box>
                                )}
                            </Box>
                        </>
                    )}
                    
                    {paymentAmount && parseFloat(paymentAmount) > 0 && !calculatedResult && (
                        <Text fontSize="sm" color="gray.500" textAlign="center">
                            Enter a valid payment amount to see calculation...
                        </Text>
                    )}
                </VStack>
            </CardBody>
        </Card>
    );
};

export default PaymentCalculator;