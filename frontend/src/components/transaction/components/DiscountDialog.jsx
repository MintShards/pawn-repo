import React, { useState, useEffect, useCallback } from 'react';
import { Percent, Shield, AlertCircle, CheckCircle, DollarSign } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import paymentService from '../../../services/paymentService';
import { formatCurrency } from '../../../utils/transactionUtils';
import { handleError } from '../../../utils/errorHandling';

const DiscountDialog = ({
  open,
  onOpenChange,
  transaction,
  paymentAmount,
  currentBalance,
  overdueFee = 0,
  onSuccess
}) => {
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [errors, setErrors] = useState({});

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setDiscountAmount('');
      setDiscountReason('');
      setAdminPin('');
      setValidationResult(null);
      setErrors({});
    }
  }, [open]);

  // Validate discount in real-time
  const validateDiscount = useCallback(async (amount) => {
    if (!amount || parseFloat(amount) <= 0) {
      setValidationResult(null);
      return;
    }

    try {
      setValidating(true);
      // Calculate actual cash payment (what customer pays after discount)
      const cashPayment = parseFloat(paymentAmount) - parseFloat(amount);
      const discountAmt = parseFloat(amount);
      const result = await paymentService.validateDiscount(
        transaction.transaction_id,
        cashPayment,  // Actual cash customer pays
        discountAmt   // Discount amount
      );
      setValidationResult(result);

      if (!result.is_valid) {
        setErrors(prev => ({ ...prev, discountAmount: result.reason }));
      } else {
        setErrors(prev => ({ ...prev, discountAmount: null }));
      }
    } catch (err) {
      handleError(err, 'Validating discount');
      setValidationResult(null);
    } finally {
      setValidating(false);
    }
  }, [transaction.transaction_id, paymentAmount]);

  // Debounced validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (discountAmount) {
        validateDiscount(discountAmount);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [discountAmount, validateDiscount]);

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!discountAmount || parseFloat(discountAmount) <= 0) {
      newErrors.discountAmount = 'Discount amount is required';
    } else if (parseFloat(discountAmount) > 10000) {
      newErrors.discountAmount = 'Discount cannot exceed $10,000';
    } else if (parseFloat(discountAmount) >= parseFloat(paymentAmount)) {
      newErrors.discountAmount = 'Discount must be less than payment amount';
    }

    if (!discountReason || discountReason.trim().length === 0) {
      newErrors.discountReason = 'Discount reason is required';
    } else if (discountReason.trim().length > 200) {
      newErrors.discountReason = 'Reason cannot exceed 200 characters';
    }

    if (!adminPin || adminPin.length !== 4) {
      newErrors.adminPin = 'Admin PIN must be exactly 4 digits';
    }

    if (!validationResult || !validationResult.is_valid) {
      newErrors.validation = 'Please fix validation errors before submitting';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);

      // Step 1: Set overdue fee if provided
      if (overdueFee > 0) {
        try {
          await paymentService.setOverdueFee(
            transaction.transaction_id,
            overdueFee,
            null  // No automatic notes
          );
        } catch (err) {
          // If overdue fee can't be set (e.g., wrong status), continue with payment
          console.warn('Could not set overdue fee in discount flow:', err.message);
        }
      }

      // Step 2: Calculate actual cash payment inside submit to ensure fresh values
      const cashPayment = parseFloat(paymentAmount) - parseFloat(discountAmount);

      const paymentData = {
        transaction_id: transaction.transaction_id,
        payment_amount: cashPayment, // Actual cash customer pays (after discount)
        discount_amount: parseFloat(discountAmount),
        discount_reason: discountReason.trim(),
        admin_pin: adminPin
      };

      console.log('Submitting discount payment:', {
        paymentAmount,
        discountAmount,
        cashPayment,
        overdueFee,
        paymentData: {
          ...paymentData,
          admin_pin: '****' // Mask PIN
        }
      });

      const result = await paymentService.processPaymentWithDiscount(paymentData);

      if (onSuccess) {
        onSuccess(result);
      }

      // Close dialog
      onOpenChange(false);
    } catch (err) {
      console.error('Discount processing error:', {
        message: err.message,
        status: err.status,
        response: err.response,
        detail: err.response?.data?.detail,
        backendMessage: err.response?.data?.message,
        nestedDetail: err.response?.data?.details?.message
      });

      // Show specific error message if available (check all possible locations)
      const errorMessage =
        err.response?.data?.detail ||
        err.response?.data?.details?.message ||  // Nested in HTTPException
        err.response?.data?.message ||
        err.message;
      handleError({
        ...err,
        message: errorMessage
      }, 'Processing payment with discount');
    } finally {
      setSubmitting(false);
    }
  };

  const actualCashPayment = parseFloat(paymentAmount) - parseFloat(discountAmount || 0);
  const totalCreditApplied = parseFloat(paymentAmount); // Full amount credited to balance
  const balanceAfter = currentBalance - totalCreditApplied;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-amber-500 text-white">
              <Percent className="h-5 w-5" />
            </div>
            Apply Admin Discount
          </DialogTitle>
          <DialogDescription>
            Requires admin approval. Discount applies to interest first, then principal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Payment Summary */}
          <Card className="bg-slate-50 dark:bg-slate-900">
            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Current Balance:</span>
                <span className="font-semibold">{formatCurrency(currentBalance)}</span>
              </div>
              {overdueFee > 0 && (
                <div className="flex justify-between text-amber-700 dark:text-amber-400">
                  <span className="text-sm">Includes Overdue Fee:</span>
                  <span className="font-semibold">{formatCurrency(overdueFee)}</span>
                </div>
              )}
              {discountAmount && parseFloat(discountAmount) > 0 && (
                <>
                  <div className="flex justify-between text-purple-600 dark:text-purple-400">
                    <span className="text-sm">Discount:</span>
                    <span className="font-semibold">-{formatCurrency(parseFloat(discountAmount))}</span>
                  </div>
                  <div className="border-t border-slate-300 dark:border-slate-700 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Customer Pays:</span>
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(actualCashPayment)}
                      </span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-sm text-slate-600 dark:text-slate-400">New Balance:</span>
                      <span className="font-semibold">
                        {formatCurrency(balanceAfter)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Discount Amount */}
          <div className="space-y-2">
            <Label htmlFor="discount_amount">
              Discount Amount ($) *
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="discount_amount"
                type="number"
                step="1"
                min="1"
                max="10000"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder="0"
                className={`pl-10 ${errors.discountAmount ? 'border-red-500' : ''}`}
                disabled={submitting}
              />
              {validating && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600"></div>
                </div>
              )}
            </div>
            {errors.discountAmount && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.discountAmount}
              </p>
            )}
          </div>

          {/* Validation Result */}
          {validationResult && validationResult.is_valid && (
            <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <div className="space-y-1">
                  <div className="font-medium">Discount Valid - Interest-First Allocation:</div>
                  <div className="text-sm space-y-1">
                    {validationResult.discount_on_interest > 0 && (
                      <div>• Discount on Interest: {formatCurrency(validationResult.discount_on_interest)}</div>
                    )}
                    {validationResult.discount_on_principal > 0 && (
                      <div>• Discount on Principal: {formatCurrency(validationResult.discount_on_principal)}</div>
                    )}
                    {validationResult.discount_on_overdue_fees > 0 && (
                      <div>• Discount on Overdue Fees: {formatCurrency(validationResult.discount_on_overdue_fees)}</div>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Discount Reason */}
          <div className="space-y-2">
            <Label htmlFor="discount_reason">
              Discount Reason * <Badge variant="outline" className="ml-2">{discountReason.length}/200</Badge>
            </Label>
            <Textarea
              id="discount_reason"
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
              placeholder="e.g., Customer loyalty, Damaged item, Business promotion..."
              maxLength={200}
              rows={3}
              className={errors.discountReason ? 'border-red-500' : ''}
              disabled={submitting}
            />
            {errors.discountReason && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.discountReason}
              </p>
            )}
          </div>

          {/* Admin PIN */}
          <div className="space-y-2">
            <Label htmlFor="admin_pin" className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-600" />
              Admin PIN *
            </Label>
            <Input
              id="admin_pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className={errors.adminPin ? 'border-red-500' : ''}
              disabled={submitting}
            />
            {errors.adminPin && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.adminPin}
              </p>
            )}
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Admin PIN required to approve discount
            </p>
          </div>

          {/* Validation Error */}
          {errors.validation && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.validation}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
              disabled={submitting || !validationResult?.is_valid}
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Apply Discount & Redeem
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DiscountDialog;
