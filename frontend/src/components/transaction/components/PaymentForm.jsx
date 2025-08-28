import React, { useState, useEffect } from 'react';
import { CreditCard, X } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import paymentService from '../../../services/paymentService';
import transactionService from '../../../services/transactionService';
import { formatTransactionId } from '../../../utils/transactionUtils';

const PaymentForm = ({ transaction, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    payment_amount: '',
    receipt_number: '',
    internal_notes: ''
  });
  
  const [balance, setBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [validation, setValidation] = useState(null);

  // Load balance on mount
  useEffect(() => {
    if (transaction?.transaction_id) {
      loadBalance();
    }
  }, [transaction?.transaction_id]);

  // Validate payment amount as user types
  useEffect(() => {
    if (formData.payment_amount && balance) {
      validatePaymentAmount();
    }
  }, [formData.payment_amount, balance]);

  const loadBalance = async () => {
    try {
      setLoadingBalance(true);
      const balanceData = await transactionService.getTransactionBalance(transaction.transaction_id);
      setBalance(balanceData);
    } catch (err) {
      // Error handled
      setError('Failed to load transaction balance');
    } finally {
      setLoadingBalance(false);
    }
  };

  const validatePaymentAmount = async () => {
    try {
      const amount = parseFloat(formData.payment_amount);
      if (amount > 0) {
        const validationResult = await paymentService.validatePayment({
          transaction_id: transaction.transaction_id,
          payment_amount: Math.round(amount) // Convert to cents
        });
        setValidation(validationResult);
      }
    } catch (err) {
      // Error handled
      setValidation(null);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
  };

  const validateForm = () => {
    const amount = parseFloat(formData.payment_amount);
    
    if (!amount || amount <= 0) {
      setError('Payment amount must be greater than 0');
      return false;
    }
    
    if (balance && amount > (balance.current_balance + 100)) { // Allow $100 overpayment
      setError('Payment amount exceeds balance plus allowable overpayment');
      return false;
    }
    
    setError(null);
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const paymentData = {
        transaction_id: transaction.transaction_id,
        payment_amount: Math.round(parseFloat(formData.payment_amount)), // Convert to integer dollars
        receipt_number: formData.receipt_number.trim() || null,
        internal_notes: formData.internal_notes.trim() || null
      };

      const result = await paymentService.processPayment(paymentData);
      
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      // Error handled
      setError(err.message || 'Failed to process payment');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <CreditCard className="h-5 w-5 mr-2" />
          Process Payment
        </CardTitle>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      
      <CardContent>
        {/* Transaction Info */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-2">Transaction Details</h3>
          <div className="space-y-1 text-sm">
            <div>Transaction: #{formatTransactionId(transaction)}</div>
            <div>Customer: {transaction?.customer_id || 'N/A'}</div>
            <div>Status: <span className="capitalize">{transaction?.status || 'N/A'}</span></div>
            {loadingBalance ? (
              <div>Current Balance: Loading...</div>
            ) : balance ? (
              <div className="font-medium text-lg">
                Current Balance: {formatCurrency(balance.current_balance)}
              </div>
            ) : null}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Payment Amount */}
          <div className="space-y-2">
            <Label htmlFor="payment_amount">Payment Amount ($) *</Label>
            <Input
              id="payment_amount"
              type="number"
              step="0.01"
              min="0.01"
              max={balance ? balance.current_balance + 100 : undefined}
              value={formData.payment_amount}
              onChange={(e) => handleInputChange('payment_amount', e.target.value)}
              placeholder="0.00"
              disabled={loadingBalance}
            />
            {balance && formData.payment_amount && (
              <div className="text-sm text-gray-600">
                Remaining balance after payment: {
                  formatCurrency(Math.max(0, balance.current_balance - parseFloat(formData.payment_amount || 0)))
                }
              </div>
            )}
          </div>

          {/* Payment Validation Display */}
          {validation && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm">
                <div className="font-medium text-blue-800">Payment Validation</div>
                <div>Valid payment amount: {validation.is_valid ? 'Yes' : 'No'}</div>
                {validation.warnings && validation.warnings.length > 0 && (
                  <div className="text-yellow-600 mt-1">
                    {validation.warnings.map((warning, index) => (
                      <div key={index}>⚠️ {warning}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Receipt Number */}
          <div className="space-y-2">
            <Label htmlFor="receipt_number">Receipt Number</Label>
            <Input
              id="receipt_number"
              value={formData.receipt_number}
              onChange={(e) => handleInputChange('receipt_number', e.target.value)}
              placeholder="Optional receipt number"
            />
          </div>

          {/* Internal Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea
              id="notes"
              value={formData.internal_notes}
              onChange={(e) => handleInputChange('internal_notes', e.target.value)}
              placeholder="Optional payment notes..."
              rows={3}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-red-600 text-sm">
                <strong>Error:</strong> {error}
              </div>
            </div>
          )}

          {/* Payment Summary */}
          {balance && formData.payment_amount && !error && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm space-y-1">
                <div className="font-medium text-green-800">Payment Summary</div>
                <div>Amount: {formatCurrency(parseFloat(formData.payment_amount))}</div>
                <div>Current Balance: {formatCurrency(balance.current_balance)}</div>
                <div className="font-medium">
                  New Balance: {formatCurrency(Math.max(0, balance.current_balance - parseFloat(formData.payment_amount)))}
                </div>
                {balance.current_balance <= parseFloat(formData.payment_amount) && (
                  <div className="text-green-600 font-medium">✅ Transaction will be paid in full!</div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={submitting || loadingBalance || !formData.payment_amount}
            >
              {submitting ? 'Processing...' : 'Process Payment'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default PaymentForm;