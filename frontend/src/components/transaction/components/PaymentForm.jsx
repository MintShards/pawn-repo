import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, X, AlertCircle, CheckCircle, DollarSign, Percent } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import paymentService from '../../../services/paymentService';
import transactionService from '../../../services/transactionService';
import customerService from '../../../services/customerService';
import { formatTransactionId, formatCurrency } from '../../../utils/transactionUtils';
import { useFormValidation, validateAmount } from '../../../utils/formValidation';
import { handleError, handleSuccess } from '../../../utils/errorHandling';
import ConfirmationDialog from '../../common/ConfirmationDialog';
import LoadingDialog from '../../common/LoadingDialog';
import { useStatsPolling } from '../../../hooks/useStatsPolling';
import { useAuth } from '../../../context/AuthContext';
import DiscountDialog from './DiscountDialog';
import StatusBadge from './StatusBadge';
import RedemptionReceiptPrint from '../../receipt/RedemptionReceiptPrint';
import RedemptionReceiptPreview from '../../receipt/RedemptionReceiptPreview';

const PaymentForm = ({ transaction, onSuccess, onCancel }) => {
  const { triggerRefresh } = useStatsPolling();
  const { user } = useAuth();
  const [customerName, setCustomerName] = useState(null);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [redemptionPaymentId, setRedemptionPaymentId] = useState(null);
  const [showPrePaymentPreview, setShowPrePaymentPreview] = useState(false);

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  // Form validation setup
  const formValidators = {
    payment_amount: (value, data) => {
      return validateAmount(value, 'Payment amount', { min: 0.01, max: 50000 });
    },
    overdue_fee: (value, data) => {
      // Optional field - return valid result for empty values
      if (!value || value === '' || value === '0') {
        return { isValid: true, message: null, suggestions: [] };
      }
      return validateAmount(value, 'Overdue fee', { min: 0, max: 10000 });
    },
    discount_amount: (value, data) => {
      // Optional field - return valid result for empty values
      if (!value || value === '' || value === '0') {
        return { isValid: true, message: null, suggestions: [] };
      }
      return validateAmount(value, 'Discount amount', { min: 0, max: 10000 });
    }
  };

  const {
    data: formData,
    updateField,
    updateFields,
    touchField,
    validateAll,
    getFieldError,
    getFieldSuggestions,
    isFormValid
  } = useFormValidation({
    payment_amount: '',
    overdue_fee: '',
    discount_amount: '',
    discount_reason: '',
    admin_pin: '' // Admin PIN for discount verification
  }, formValidators);
  
  const [balance, setBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [paymentBreakdown, setPaymentBreakdown] = useState(null);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [autoUpdatePayment, setAutoUpdatePayment] = useState(false);

  // Define functions before use
  const loadBalance = useCallback(async () => {
    try {
      setLoadingBalance(true);
      const balanceData = await transactionService.getTransactionBalance(transaction.transaction_id);
      setBalance(balanceData);
    } catch (err) {
      handleError(err, 'Loading transaction balance');
    } finally {
      setLoadingBalance(false);
    }
  }, [transaction.transaction_id]);

  const calculatePaymentBreakdown = useCallback(async (amount, overdueFeeAmount = 0) => {
    if (!amount || !balance) return;

    try {
      const overdueFee = parseFloat(overdueFeeAmount) || 0;
      const discountAmount = parseFloat(formData.discount_amount) || 0;
      const totalBalance = balance.current_balance + overdueFee - discountAmount;

      const breakdown = {
        paymentAmount: parseFloat(amount),
        currentBalance: balance.current_balance || 0,
        principalDue: balance.principal_balance || 0,
        interestDue: balance.interest_due || 0,
        overdueFee: overdueFee,
        discountAmount: discountAmount,
        totalWithFee: totalBalance,
        isFullPayment: parseFloat(amount) >= totalBalance
      };

      // Calculate payment allocation (interest → principal only)
      // Extension fees are handled separately by the extension system
      let remainingPayment = parseFloat(amount);
      let interestPaid = Math.min(remainingPayment, breakdown.interestDue);
      remainingPayment -= interestPaid;

      let principalPaid = Math.min(remainingPayment, breakdown.principalDue);

      breakdown.allocation = {
        interest: interestPaid,
        principal: principalPaid,
        overpayment: Math.max(0, remainingPayment - principalPaid)
      };

      setPaymentBreakdown(breakdown);
    } catch (err) {
      // Error calculating payment breakdown - clear breakdown
      setPaymentBreakdown(null);
    }
  }, [balance, formData.discount_amount]);

  // Auto-update payment amount when overdue fee or discount changes (if user was paying full)
  useEffect(() => {
    if (!balance || !autoUpdatePayment) return;

    const overdueFee = parseFloat(formData.overdue_fee) || 0;
    const discount = parseFloat(formData.discount_amount) || 0;
    const newTotal = balance.current_balance + overdueFee - discount;
    const currentPaymentAmount = parseFloat(formData.payment_amount) || 0;

    // Only update if the new total is different from current payment amount
    if (Math.abs(newTotal - currentPaymentAmount) < 0.01) return;

    // Update payment amount to match new total
    updateField('payment_amount', newTotal.toString());

    // Recalculate breakdown
    calculatePaymentBreakdown(newTotal, overdueFee);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.overdue_fee, formData.discount_amount, balance, autoUpdatePayment]);

  const handleInputChange = useCallback((field, value) => {
    updateField(field, value);

    // Disable auto-update if user manually changes payment amount
    if (field === 'payment_amount') {
      setAutoUpdatePayment(false);
    }

    // Calculate payment breakdown for amount or overdue fee changes
    if (field === 'payment_amount' && value) {
      calculatePaymentBreakdown(value, formData.overdue_fee);
    } else if (field === 'overdue_fee') {
      if (formData.payment_amount) {
        calculatePaymentBreakdown(formData.payment_amount, value);
      }
    }
  }, [updateField, calculatePaymentBreakdown, formData.payment_amount, formData.overdue_fee]);

  const validateFormExtended = useCallback(() => {
    const isBasicValid = validateAll();
    
    if (!isBasicValid) {
      return false;
    }
    
    // Additional business validation
    if (!balance) {
      handleError({ message: 'Balance information required', status: 412 }, 'Payment validation');
      return false;
    }
    
    // Check if balance is already $0
    if (balance.current_balance <= 0) {
      handleError({ 
        message: 'This transaction has a $0 balance. No payment is needed.',
        status: 422 
      }, 'Payment validation');
      return false;
    }
    
    const amount = parseFloat(formData.payment_amount);

    // Allow overpayments for cash businesses, but prevent obvious typos
    // (e.g., paying $10,000 on a $50 balance is likely a mistake)
    const maxReasonablePayment = Math.max(
      balance.current_balance * 5,
      balance.current_balance + 1000
    );

    if (amount > maxReasonablePayment) {
      handleError({
        message: `Payment amount $${amount.toFixed(2)} seems unusually large for balance $${balance.current_balance.toFixed(2)}. Please verify the amount.`,
        status: 422
      }, 'Payment validation');
      return false;
    }
    
    return true;
  }, [validateAll, balance, formData.payment_amount]);

  const processPayment = useCallback(async () => {
    try {
      setSubmitting(true);

      const overdueFeeAmount = parseFloat(formData.overdue_fee) || 0;
      const discountAmount = parseFloat(formData.discount_amount) || 0;

      // Step 1: Set overdue fee on transaction if provided
      if (overdueFeeAmount > 0) {
        try {
          await paymentService.setOverdueFee(
            transaction.transaction_id,
            overdueFeeAmount,
            null  // No automatic notes
          );
        } catch (err) {
          // If overdue fee can't be set (e.g., wrong status), continue with payment
          // Backend will validate and reject if needed
          console.warn('Could not set overdue fee:', err.message);
        }
      }

      // Step 2: Process payment with or without discount
      let result;
      if (discountAmount > 0) {
        // Process payment with discount (requires admin PIN - already verified)
        const paymentData = {
          transaction_id: transaction.transaction_id,
          payment_amount: Math.round(parseFloat(formData.payment_amount)), // Actual cash customer pays (after discount)
          discount_amount: discountAmount,
          discount_reason: formData.discount_reason || '',
          admin_pin: formData.admin_pin // Admin PIN from discount dialog
        };
        result = await paymentService.processPaymentWithDiscount(paymentData);
      } else {
        // Regular payment without discount
        const paymentData = {
          transaction_id: transaction.transaction_id,
          payment_amount: Math.round(parseFloat(formData.payment_amount)) // Convert to integer dollars
        };
        result = await paymentService.processPayment(paymentData);
      }

      // Trigger immediate stats refresh after successful payment
      triggerRefresh();

      // Immediately refresh balance after successful payment
      await loadBalance();

      const isFullPayment = paymentBreakdown && paymentBreakdown.isFullPayment;

      let message = '';
      if (isFullPayment) {
        message = overdueFeeAmount > 0
          ? `Payment of $${parseFloat(formData.payment_amount).toFixed(2)} processed (includes $${overdueFeeAmount.toFixed(2)} overdue fee) - Transaction redeemed!`
          : `Payment processed - Transaction redeemed!`;

        // Store payment ID and show receipt preview for redemptions
        if (result && result.payment_id) {
          setRedemptionPaymentId(result.payment_id);
          setShowReceiptPreview(true);
        }
      } else {
        message = overdueFeeAmount > 0
          ? `Payment of $${parseFloat(formData.payment_amount).toFixed(2)} processed (includes $${overdueFeeAmount.toFixed(2)} overdue fee)`
          : `Payment of $${parseFloat(formData.payment_amount).toFixed(2)} processed successfully`;
      }

      handleSuccess(message);

      if (onSuccess) {
        onSuccess(result, true); // Pass flag to indicate balance should be refreshed
      }
    } catch (err) {
      handleError(err, 'Processing payment');
    } finally {
      setSubmitting(false);
      setShowConfirmation(false);
    }
  }, [formData, transaction, paymentBreakdown, onSuccess, triggerRefresh, loadBalance]);

  const handleDiscountApplied = useCallback((discountAmount, discountReason, adminPin) => {
    console.log('Applying discount:', { discountAmount, discountReason, adminPin });

    // Calculate new payment amount with discount
    const currentPaymentAmount = parseFloat(formData.payment_amount || 0);
    const overdueFeeAmount = parseFloat(formData.overdue_fee || 0);
    const totalWithDiscount = balance.current_balance + overdueFeeAmount - discountAmount;

    // Update payment amount if it was set to full balance (auto-adjust)
    const shouldUpdatePaymentAmount = currentPaymentAmount === (balance.current_balance + overdueFeeAmount);

    // Set all discount values in the form at once (batched update)
    updateFields({
      discount_amount: discountAmount.toString(),
      discount_reason: discountReason,
      admin_pin: adminPin,
      // Update payment amount if it was previously set to full amount
      ...(shouldUpdatePaymentAmount && { payment_amount: totalWithDiscount.toString() })
    });

    // Enable auto-update so payment amount adjusts when overdue fee changes
    if (shouldUpdatePaymentAmount) {
      setAutoUpdatePayment(true);
    }

    console.log('Discount fields updated');

    // Dialog will be closed by DiscountDialog's onOpenChange
    handleSuccess(`Discount of $${discountAmount} added to payment form`);
  }, [updateFields, handleSuccess, formData.payment_amount, formData.overdue_fee, balance]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!validateFormExtended()) {
      return;
    }

    // Show confirmation for large payments or full redemptions
    const amount = parseFloat(formData.payment_amount);
    if (amount > 500 || (paymentBreakdown && paymentBreakdown.isFullPayment)) {
      setShowConfirmation(true);
      return;
    }

    await processPayment();
  }, [validateFormExtended, formData.payment_amount, paymentBreakdown, processPayment]);

  // Load customer name
  useEffect(() => {
    const fetchCustomerName = async () => {
      if (transaction?.customer_id) {
        try {
          const customer = await customerService.getCustomerByPhone(transaction.customer_id);
          if (customer) {
            setCustomerName(customerService.getCustomerFullName(customer));
          }
        } catch (error) {
          // If customer fetch fails, we'll just show the customer_id
          console.warn('Could not fetch customer name:', error);
        }
      }
    };
    fetchCustomerName();
  }, [transaction?.customer_id]);

  // Load balance on mount
  useEffect(() => {
    if (transaction?.transaction_id) {
      loadBalance();
    }
  }, [transaction?.transaction_id, loadBalance]);

  // Calculate payment breakdown when amount changes
  useEffect(() => {
    if (formData.payment_amount && balance) {
      calculatePaymentBreakdown(formData.payment_amount);
    } else {
      setPaymentBreakdown(null);
    }
  }, [formData.payment_amount, balance, calculatePaymentBreakdown]);


  return (
    <Card className="w-full max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30">
        <CardTitle className="flex items-center text-xl">
          <div className="p-2 rounded-lg bg-emerald-600 text-white shadow-md mr-3">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <div className="text-slate-900 dark:text-slate-100 font-semibold">Process Payment</div>
            <div className="text-sm font-normal text-emerald-700 dark:text-emerald-400">Record customer payment</div>
          </div>
        </CardTitle>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      
      <CardContent>
        {/* Transaction Info Banner */}
        <div className="mb-5 p-4 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Transaction ID & Customer */}
            <div className="md:col-span-2 flex items-center gap-3">
              <Badge variant="outline" className="font-mono bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 whitespace-nowrap">
                #{formatTransactionId(transaction)}
              </Badge>
              <div className="h-10 w-px bg-emerald-300 dark:bg-emerald-700"></div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {customerName || transaction?.customer_id}
                </span>
                {customerName && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {transaction?.customer_id}
                  </span>
                )}
              </div>
            </div>

            {/* Loan Amount */}
            <div className="flex flex-col justify-center">
              <span className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Loan Amount</span>
              <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(transaction?.loan_amount || 0)}
              </span>
            </div>

            {/* Status & Maturity */}
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">Status:</span>
                <StatusBadge status={transaction?.status} />
              </div>
              {transaction?.maturity_date && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Due:</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {new Date(transaction.maturity_date).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Loading Indicator */}
            {loadingBalance && (
              <div className="absolute top-4 right-4 flex items-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600 mr-2"></div>
                Loading...
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Balance Summary Card */}
          <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-800 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Current Balance:</span>
                  <span className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                    {balance ? formatCurrency(balance.current_balance) : '...'}
                  </span>
                </div>

                {formData.overdue_fee && parseFloat(formData.overdue_fee) > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Overdue Fee:</span>
                    <span className="text-lg font-bold text-amber-800 dark:text-amber-300">
                      +{formatCurrency(parseFloat(formData.overdue_fee))}
                    </span>
                  </div>
                )}

                {formData.discount_amount && parseFloat(formData.discount_amount) > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Discount Applied:</span>
                    <span className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                      -{formatCurrency(parseFloat(formData.discount_amount))}
                    </span>
                  </div>
                )}

                {((formData.overdue_fee && parseFloat(formData.overdue_fee) > 0) || (formData.discount_amount && parseFloat(formData.discount_amount) > 0)) && (
                  <div className="border-t border-emerald-200 dark:border-emerald-800 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-semibold text-emerald-900 dark:text-emerald-100">Total Amount Due:</span>
                      <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(balance ? balance.current_balance + parseFloat(formData.overdue_fee || 0) - parseFloat(formData.discount_amount || 0) : 0)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Overdue Fee Input - Only for overdue transactions */}
          {transaction.status === 'overdue' && (
            <div className="space-y-2">
              <Label htmlFor="overdue_fee" className="flex items-center gap-2">
                <span>Additional Overdue Fee ($)</span>
                <Badge variant="outline" className="text-xs">Optional</Badge>
              </Label>
              <Input
                id="overdue_fee"
                type="number"
                step="1"
                min="0"
                max="10000"
                value={formData.overdue_fee}
                onChange={(e) => handleInputChange('overdue_fee', e.target.value)}
                onBlur={() => touchField('overdue_fee')}
                placeholder="0"
                disabled={loadingBalance || (balance && balance.current_balance <= 0)}
                className={getFieldError('overdue_fee') ? 'border-red-500 text-lg h-12' : 'border-slate-300 text-lg h-12'}
              />
              {getFieldError('overdue_fee') && (
                <div className="text-xs text-red-600 mt-1">
                  {getFieldError('overdue_fee')}
                </div>
              )}
              {!formData.overdue_fee || parseFloat(formData.overdue_fee) === 0 ? (
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>Add extra fee for late payment if applicable</span>
                </div>
              ) : (
                <div className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>Overdue fee will be added to transaction balance</span>
                </div>
              )}
            </div>
          )}

          {/* Payment Amount */}
          <div className="space-y-2">
            <Label htmlFor="payment_amount" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Payment Amount ($) *
            </Label>
            <div className="relative">
              <Input
                id="payment_amount"
                type="number"
                step="1"
                min="1"
                max={balance ? balance.current_balance + parseFloat(formData.overdue_fee || 0) + 100 : 50000}
                value={formData.payment_amount}
                onChange={(e) => handleInputChange('payment_amount', e.target.value)}
                onBlur={() => touchField('payment_amount')}
                placeholder="0"
                disabled={loadingBalance || (balance && balance.current_balance <= 0)}
                className={getFieldError('payment_amount') ? 'border-red-500 text-2xl font-bold h-16 pr-28 bg-white dark:bg-slate-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none' : 'border-emerald-300 dark:border-emerald-700 text-2xl font-bold h-16 pr-28 bg-white dark:bg-slate-800 focus:ring-emerald-500 focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'}
                aria-invalid={!!getFieldError('payment_amount')}
                aria-describedby={getFieldError('payment_amount') ? 'payment_amount_error' : undefined}
              />
              {balance && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex gap-2">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-9 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    onClick={() => {
                      const totalWithFee = balance.current_balance + parseFloat(formData.overdue_fee || 0) - parseFloat(formData.discount_amount || 0);
                      handleInputChange('payment_amount', totalWithFee.toString());
                      setAutoUpdatePayment(true); // Enable auto-update for full payments
                    }}
                  >
                    Pay Full
                  </Button>
                  {isAdmin && paymentBreakdown?.isFullPayment && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 px-3 text-xs font-semibold bg-amber-50 hover:bg-amber-200 text-amber-800 hover:text-amber-900 border-amber-400 hover:border-amber-500 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 dark:border-amber-700 dark:text-amber-300 dark:hover:text-amber-200 dark:hover:border-amber-600"
                      onClick={() => setShowDiscountDialog(true)}
                    >
                      <Percent className="h-3 w-3 mr-1" />
                      Discount
                    </Button>
                  )}
                </div>
              )}
            </div>
            {getFieldError('payment_amount') && (
              <div id="payment_amount_error" className="text-xs text-red-600 dark:text-red-400 mt-1">
                {getFieldError('payment_amount')}
              </div>
            )}
          </div>

          {/* Payment Result - Simplified */}
          {paymentBreakdown && formData.payment_amount && !paymentBreakdown.isFullPayment && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-900 dark:text-blue-100">Balance After Payment:</span>
                <span className="text-xl font-bold text-blue-700 dark:text-blue-300">
                  {formatCurrency(Math.max(0, paymentBreakdown.totalWithFee - paymentBreakdown.paymentAmount))}
                </span>
              </div>
            </div>
          )}

          {/* Full Payment Badge with Preview Button */}
          {paymentBreakdown && paymentBreakdown.isFullPayment && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-emerald-600 to-green-600 rounded-lg shadow-md border border-emerald-400">
                <CheckCircle className="h-5 w-5 text-white animate-pulse" />
                <span className="font-semibold text-sm text-white">Transaction Will Be Fully Redeemed</span>
              </div>
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPrePaymentPreview(true)}
                  className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Preview Redemption Receipt
                </Button>
              </div>
            </div>
          )}



          {/* Form Validation Errors */}
          {Object.keys(formValidators).map(field => {
            const fieldError = getFieldError(field);
            const suggestions = getFieldSuggestions(field);
            
            if (!fieldError && suggestions.length === 0) return null;
            
            return (
              <Alert key={field} variant={fieldError ? "destructive" : "default"}>
                {fieldError ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                <AlertDescription>
                  {fieldError && <div className="font-medium">{fieldError}</div>}
                  {suggestions.length > 0 && (
                    <div className="text-sm mt-1">
                      {suggestions.map((suggestion, i) => (
                        <div key={i}>• {suggestion}</div>
                      ))}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            );
          })}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={
                submitting || 
                loadingBalance || 
                !formData.payment_amount ||
                !isFormValid ||
                (balance && balance.current_balance <= 0)
              }
              className={paymentBreakdown?.isFullPayment 
                ? 'bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white shadow-lg transform hover:scale-105 transition-all duration-200' 
                : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg transform hover:scale-105 transition-all duration-200'
              }
              size="lg"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Processing...
                </>
              ) : paymentBreakdown?.isFullPayment ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Redeem Transaction
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Process Payment
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={showConfirmation}
        onOpenChange={setShowConfirmation}
        title={paymentBreakdown?.isFullPayment ? "Confirm Transaction Redemption" : "Confirm Large Payment"}
        description={paymentBreakdown?.isFullPayment 
          ? "This payment will fully redeem the transaction. The customer will receive their items back."
          : `Are you sure you want to process a payment of $${parseFloat(formData.payment_amount || 0).toFixed(2)}?`
        }
        onConfirm={processPayment}
        onCancel={() => setShowConfirmation(false)}
        confirmText={paymentBreakdown?.isFullPayment ? "Redeem Transaction" : "Process Payment"}
        variant={paymentBreakdown?.isFullPayment ? "default" : "warning"}
        loading={submitting}
      >
        {paymentBreakdown && (
          <div className="space-y-2 text-sm">
            <div className="font-medium">Payment Details:</div>
            {paymentBreakdown.allocation.interest > 0 && (
              <div className="flex justify-between">
                <span>Interest:</span>
                <span>{formatCurrency(paymentBreakdown.allocation.interest)}</span>
              </div>
            )}
            {paymentBreakdown.allocation.principal > 0 && (
              <div className="flex justify-between">
                <span>Principal:</span>
                <span>{formatCurrency(paymentBreakdown.allocation.principal)}</span>
              </div>
            )}
            <hr />
            <div className="flex justify-between font-medium">
              <span>Total:</span>
              <span>{formatCurrency(paymentBreakdown.paymentAmount)}</span>
            </div>
          </div>
        )}
      </ConfirmationDialog>

      {/* Loading Dialog */}
      <LoadingDialog
        open={submitting && !showConfirmation}
        title={paymentBreakdown?.isFullPayment ? "Processing Redemption" : "Processing Payment"}
        description={paymentBreakdown?.isFullPayment
          ? "Completing transaction redemption..."
          : "Processing your payment..."
        }
      />

      {/* Discount Dialog - Admin Only */}
      {isAdmin && (
        <DiscountDialog
          open={showDiscountDialog}
          onOpenChange={setShowDiscountDialog}
          transaction={transaction}
          paymentAmount={parseFloat(formData.payment_amount || 0)}
          currentBalance={balance?.current_balance ?
            balance.current_balance + parseFloat(formData.overdue_fee || 0) : 0
          }
          overdueFee={parseFloat(formData.overdue_fee || 0)}
          onDiscountApplied={handleDiscountApplied}
        />
      )}

      {/* Redemption Receipt After Payment - Shows actual receipt with payment_id */}
      {redemptionPaymentId && (
        <RedemptionReceiptPrint
          transactionId={transaction.transaction_id}
          paymentId={redemptionPaymentId}
          showPreview={showReceiptPreview}
          onPreviewClose={() => {
            setShowReceiptPreview(false);
            // Don't clear redemptionPaymentId - allow reprinting
          }}
        />
      )}

      {/* Redemption Receipt Preview Before Payment - Shows what receipt will look like */}
      <RedemptionReceiptPreview
        open={showPrePaymentPreview}
        onOpenChange={setShowPrePaymentPreview}
        transaction={transaction}
        balance={balance}
        paymentAmount={parseFloat(formData.payment_amount || 0)}
        customerName={customerName}
        overdueFee={parseFloat(formData.overdue_fee || 0)}
        discountAmount={parseFloat(formData.discount_amount || 0)}
        discountReason={formData.discount_reason}
      />
    </Card>
  );
};

export default PaymentForm;