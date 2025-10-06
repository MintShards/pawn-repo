import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, X, AlertCircle, CheckCircle, DollarSign, Calculator } from 'lucide-react';
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

const PaymentForm = ({ transaction, onSuccess, onCancel }) => {
  const { triggerRefresh } = useStatsPolling();
  
  // Form validation setup
  const formValidators = {
    payment_amount: (value, data) => {
      return validateAmount(value, 'Payment amount', { min: 0.01, max: 50000 });
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
    payment_amount: ''
  }, formValidators);
  
  const [balance, setBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [paymentBreakdown, setPaymentBreakdown] = useState(null);

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

  const calculatePaymentBreakdown = useCallback(async (amount) => {
    if (!amount || !balance) return;
    
    try {
      const breakdown = {
        paymentAmount: parseFloat(amount),
        currentBalance: balance.current_balance || 0,
        principalDue: balance.principal_balance || 0,
        interestDue: balance.interest_due || 0,
        isFullPayment: parseFloat(amount) >= balance.current_balance
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
    
    // Calculate payment breakdown for amount changes
    if (field === 'payment_amount' && value) {
      calculatePaymentBreakdown(value);
    }
  }, [updateField, calculatePaymentBreakdown]);

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
    if (amount > (balance.current_balance + 100)) { // Allow $100 overpayment
      handleError({ 
        message: `Payment amount $${amount.toFixed(2)} exceeds balance $${balance.current_balance.toFixed(2)} plus $100 allowable overpayment`,
        status: 422 
      }, 'Payment validation');
      return false;
    }
    
    return true;
  }, [validateAll, balance, formData.payment_amount]);

  const processPayment = useCallback(async () => {
    try {
      setSubmitting(true);

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
      const message = isFullPayment 
        ? `Payment processed - Transaction redeemed!` 
        : `Payment of $${parseFloat(formData.payment_amount).toFixed(2)} processed successfully`;
      
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
        {/* Transaction Info Banner */}
        <div className="mb-6 p-4 bg-payment-light dark:bg-payment-medium/30 rounded-xl border border-payment-medium/20 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-payment-dark dark:text-payment-secondary flex items-center">
              <DollarSign className="w-5 h-5 mr-2" />
              Transaction Details
            </h3>
            <Badge variant="outline" className="border-payment-accent dark:border-amber-700 text-green-700 dark:text-green-300">
              #{formatTransactionId(transaction)}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm text-green-700 dark:text-green-300">Customer: <span className="font-medium">{transaction?.customer_id || 'N/A'}</span></div>
              <div className="text-sm text-green-700 dark:text-green-300">Status: <span className="capitalize font-medium">{transaction?.status || 'N/A'}</span></div>
            </div>
            
            <div className="p-3 bg-white/70 dark:bg-slate-800/70 rounded-lg border border-payment-medium/20 dark:border-payment-medium/40">
              <div className="text-sm text-payment-accent dark:text-amber-400 font-medium">Current Balance</div>
              {loadingBalance ? (
                <div className="flex items-center text-green-700 dark:text-green-300">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
                  Loading...
                </div>
              ) : balance ? (
                <>
                  <div className="font-bold text-2xl text-payment-dark dark:text-payment-secondary">
                    {formatCurrency(balance.current_balance)}
                  </div>
                  {balance.current_balance <= 0 && (
                    <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/50 rounded border border-green-200 dark:border-green-800">
                      <div className="flex items-center text-green-700 dark:text-green-300 text-sm">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        This transaction is fully paid. No payment needed.
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-slate-500 dark:text-slate-400">Unable to load</div>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Payment Amount */}
          <div className="space-y-2">
            <Label htmlFor="payment_amount">Payment Amount ($) *</Label>
            <div className="relative">
              <Input
                id="payment_amount"
                type="number"
                step="1"
                min="1"
                max={balance ? balance.current_balance + 100 : 50000}
                value={formData.payment_amount}
                onChange={(e) => handleInputChange('payment_amount', e.target.value)}
                onBlur={() => touchField('payment_amount')}
                placeholder="0"
                disabled={loadingBalance || (balance && balance.current_balance <= 0)}
                className={getFieldError('payment_amount') ? 'border-red-500 focus:border-red-500 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 ring-0 ring-offset-0' : 'border-slate-300 focus:border-payment-accent focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 ring-0 ring-offset-0'}
                aria-invalid={!!getFieldError('payment_amount')}
                aria-describedby={getFieldError('payment_amount') ? 'payment_amount_error' : undefined}
              />
              {balance && (
                <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => handleInputChange('payment_amount', balance.current_balance.toString())}
                  >
                    Pay Full
                  </Button>
                </div>
              )}
            </div>
            {getFieldError('payment_amount') && (
              <div id="payment_amount_error" className="text-xs text-red-600 mt-1">
                {getFieldError('payment_amount')}
              </div>
            )}
            {balance && formData.payment_amount && (
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>Remaining balance:</span>
                <span className="font-medium">
                  {formatCurrency(Math.max(0, balance.current_balance - parseFloat(formData.payment_amount || 0)))}
                </span>
              </div>
            )}
            {balance && (
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Current balance:</span>
                <span>{formatCurrency(balance.current_balance)}</span>
              </div>
            )}
          </div>

          {/* Payment Breakdown Display */}
          {paymentBreakdown && formData.payment_amount && (
            <Card className="bg-payment-light dark:bg-payment-medium/20 border-payment-medium/20 dark:border-payment-medium/40 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <div className="p-2 rounded-lg bg-payment-accent text-white shadow-md mr-3">
                    <Calculator className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-payment-dark dark:text-payment-secondary">Payment Breakdown</div>
                    <div className="text-sm font-normal text-payment-accent dark:text-amber-400">Payment allocation details</div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {paymentBreakdown.allocation.interest > 0 && (
                    <div className="flex justify-between items-center p-2 bg-white/70 dark:bg-slate-800/70 rounded-lg">
                      <span className="text-slate-700 dark:text-slate-300">Interest Payment:</span>
                      <span className="font-bold text-green-700 dark:text-green-300">{formatCurrency(paymentBreakdown.allocation.interest)}</span>
                    </div>
                  )}
                  {paymentBreakdown.allocation.principal > 0 && (
                    <div className="flex justify-between items-center p-2 bg-white/70 dark:bg-slate-800/70 rounded-lg">
                      <span className="text-slate-700 dark:text-slate-300">Principal Payment:</span>
                      <span className="font-bold text-green-700 dark:text-green-300">{formatCurrency(paymentBreakdown.allocation.principal)}</span>
                    </div>
                  )}
                  {paymentBreakdown.allocation.overpayment > 0 && (
                    <div className="flex justify-between items-center p-2 bg-green-100 dark:bg-green-950/30 rounded-lg border border-green-300 dark:border-green-700">
                      <span className="text-green-700 dark:text-green-300">Overpayment:</span>
                      <span className="font-bold text-payment-dark dark:text-payment-secondary">+{formatCurrency(paymentBreakdown.allocation.overpayment)}</span>
                    </div>
                  )}
                  
                  <div className="border-t border-payment-accent dark:border-amber-700 pt-3">
                    <div className="flex justify-between items-center p-3 bg-gradient-to-r from-gray-100 to-amber-100 dark:from-gray-800/50 dark:to-amber-950/50 rounded-lg border border-payment-accent dark:border-amber-700">
                      <span className="font-semibold text-payment-dark dark:text-payment-secondary">Remaining Balance:</span>
                      <span className="font-bold text-xl text-green-900 dark:text-green-100">
                        {formatCurrency(Math.max(0, paymentBreakdown.currentBalance - paymentBreakdown.paymentAmount))}
                      </span>
                    </div>
                  </div>
                  
                  {paymentBreakdown.isFullPayment && (
                    <div className="flex items-center justify-center p-3 bg-gradient-to-r from-amber-100 to-gray-100 dark:from-amber-950/50 dark:to-gray-800/50 rounded-lg border border-payment-accent dark:border-amber-700">
                      <CheckCircle className="h-5 w-5 mr-2 text-payment-accent dark:text-amber-400" />
                      <span className="font-bold text-payment-dark dark:text-payment-secondary">Transaction will be fully redeemed!</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
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
    </Card>
  );
};

export default PaymentForm;