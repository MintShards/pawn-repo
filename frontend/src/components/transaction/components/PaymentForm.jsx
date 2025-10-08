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
import { formatTransactionId, formatCurrency } from '../../../utils/transactionUtils';
import { useFormValidation, validateAmount } from '../../../utils/formValidation';
import { handleError, handleSuccess } from '../../../utils/errorHandling';
import ConfirmationDialog from '../../common/ConfirmationDialog';
import LoadingDialog from '../../common/LoadingDialog';
import { useStatsPolling } from '../../../hooks/useStatsPolling';
import { useAuth } from '../../../context/AuthContext';
import DiscountDialog from './DiscountDialog';

const PaymentForm = ({ transaction, onSuccess, onCancel }) => {
  const { triggerRefresh } = useStatsPolling();
  const { user } = useAuth();

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
    }
  };

  const {
    data: formData,
    updateField,
    touchField,
    validateAll,
    getFieldError,
    getFieldSuggestions,
    isFormValid
  } = useFormValidation({
    payment_amount: '',
    overdue_fee: ''
  }, formValidators);
  
  const [balance, setBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [paymentBreakdown, setPaymentBreakdown] = useState(null);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);

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
      const totalBalance = balance.current_balance + overdueFee;

      const breakdown = {
        paymentAmount: parseFloat(amount),
        currentBalance: balance.current_balance || 0,
        principalDue: balance.principal_balance || 0,
        interestDue: balance.interest_due || 0,
        overdueFee: overdueFee,
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
  }, [balance]);

  const handleInputChange = useCallback((field, value) => {
    updateField(field, value);

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

      // Step 2: Process payment (backend now knows about the overdue fee)
      const paymentData = {
        transaction_id: transaction.transaction_id,
        payment_amount: Math.round(parseFloat(formData.payment_amount)) // Convert to integer dollars
      };

      const result = await paymentService.processPayment(paymentData);

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

  const handleDiscountSuccess = useCallback(async (result) => {
    // Trigger immediate stats refresh after successful discount payment
    triggerRefresh();

    // Immediately refresh balance after successful payment
    await loadBalance();

    handleSuccess('Payment with discount processed - Transaction redeemed!');

    if (onSuccess) {
      onSuccess(result, true); // Pass flag to indicate balance should be refreshed
    }
  }, [triggerRefresh, loadBalance, onSuccess]);

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
    <Card className="w-full max-w-2xl mx-auto bg-payment-light dark:bg-payment-dark backdrop-blur-xl border border-payment-medium/20 dark:border-payment-medium/40 shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between border-b border-payment-medium/20 dark:border-payment-medium/40 bg-payment-light dark:bg-payment-medium/20">
        <CardTitle className="flex items-center text-xl">
          <div className="p-2 rounded-lg bg-payment-accent text-white shadow-lg mr-3">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <div className="text-payment-dark dark:text-payment-secondary">Process Payment</div>
            <div className="text-sm font-normal text-payment-accent dark:text-amber-400">Record customer payment</div>
          </div>
        </CardTitle>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      
      <CardContent>
        {/* Transaction Info Banner - Simplified */}
        <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                #{formatTransactionId(transaction)}
              </Badge>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {transaction?.customer_id}
              </span>
            </div>
            {loadingBalance && (
              <div className="flex items-center text-xs text-slate-500">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-600 mr-2"></div>
                Loading...
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Amount Summary Card */}
          <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700">
            <CardContent className="pt-4 pb-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Current Balance:</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {balance ? formatCurrency(balance.current_balance) : '...'}
                  </span>
                </div>

                {formData.overdue_fee && parseFloat(formData.overdue_fee) > 0 && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-amber-700 dark:text-amber-400">Overdue Fee:</span>
                      <span className="text-lg font-bold text-amber-800 dark:text-amber-300">
                        +{formatCurrency(parseFloat(formData.overdue_fee))}
                      </span>
                    </div>
                    <div className="border-t border-slate-300 dark:border-slate-600 pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-semibold text-slate-900 dark:text-slate-100">Total Amount Due:</span>
                        <span className="text-xl font-bold text-green-700 dark:text-green-400">
                          {formatCurrency(balance ? balance.current_balance + parseFloat(formData.overdue_fee) : 0)}
                        </span>
                      </div>
                    </div>
                  </>
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
            <Label htmlFor="payment_amount" className="text-base font-semibold">Payment Amount ($) *</Label>
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
                className={getFieldError('payment_amount') ? 'border-red-500 text-2xl font-bold h-14 pr-24' : 'border-slate-300 text-2xl font-bold h-14 pr-24'}
                aria-invalid={!!getFieldError('payment_amount')}
                aria-describedby={getFieldError('payment_amount') ? 'payment_amount_error' : undefined}
              />
              {balance && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex gap-2">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-8 px-3 text-xs font-semibold bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      const totalWithFee = balance.current_balance + parseFloat(formData.overdue_fee || 0);
                      handleInputChange('payment_amount', totalWithFee.toString());
                    }}
                  >
                    Pay Full
                  </Button>
                  {isAdmin && paymentBreakdown?.isFullPayment && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-300"
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
              <div id="payment_amount_error" className="text-xs text-red-600 mt-1">
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

          {/* Full Payment Badge */}
          {paymentBreakdown && paymentBreakdown.isFullPayment && (
            <div className="flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg shadow-md">
              <CheckCircle className="h-6 w-6 text-white" />
              <span className="font-bold text-white">✓ Transaction Will Be Fully Redeemed</span>
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
          onSuccess={handleDiscountSuccess}
        />
      )}
    </Card>
  );
};

export default PaymentForm;