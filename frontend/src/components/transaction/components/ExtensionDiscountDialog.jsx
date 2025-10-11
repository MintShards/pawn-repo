import React, { useState, useEffect } from 'react';
import { Percent, Shield, CheckCircle } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Card, CardContent } from '../../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { formatCurrency } from '../../../utils/transactionUtils';
import { handleError } from '../../../utils/errorHandling';
import extensionService from '../../../services/extensionService';

const ExtensionDiscountDialog = ({
  open,
  onOpenChange,
  transaction,
  extensionFee,
  extensionMonths,
  extensionFeePerMonth,
  overdueFeeCollected = 0,
  onSuccess
}) => {
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setDiscountAmount('');
      setDiscountReason('');
      setAdminPin('');
      setErrors({});
    }
  }, [open]);

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!discountAmount || parseFloat(discountAmount) <= 0) {
      newErrors.discountAmount = 'Discount amount is required';
    } else if (parseFloat(discountAmount) > extensionFee) {
      newErrors.discountAmount = `Discount cannot exceed extension fee (${formatCurrency(extensionFee)})`;
    } else if (parseFloat(discountAmount) > 10000) {
      newErrors.discountAmount = 'Discount cannot exceed $10,000';
    }

    if (!discountReason || discountReason.trim().length === 0) {
      newErrors.discountReason = 'Discount reason is required';
    } else if (discountReason.trim().length < 10) {
      newErrors.discountReason = 'Please provide a more detailed reason (at least 10 characters)';
    }

    if (!adminPin || adminPin.length !== 4) {
      newErrors.adminPin = 'Admin PIN must be 4 digits';
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
      setErrors({}); // Clear previous errors

      // Validate admin PIN before returning discount data
      const validationData = {
        transaction_id: transaction.transaction_id,
        extension_months: extensionMonths,
        extension_fee_per_month: extensionFeePerMonth,
        discount_amount: parseFloat(discountAmount),
        discount_reason: discountReason.trim(),
        admin_pin: adminPin
      };

      // Validate the discount and admin PIN with backend
      await extensionService.validateExtensionDiscount(validationData);

      // If validation succeeds, return discount data to parent
      if (onSuccess) {
        onSuccess({
          discountAmount: parseFloat(discountAmount),
          discountReason: discountReason.trim(),
          adminPin: adminPin
        });
      }

      // Close dialog only on success
      onOpenChange(false);
    } catch (err) {
      console.error('Extension discount validation error:', {
        message: err.message,
        status: err.status,
        response: err.response,
        detail: err.response?.data?.detail,
        backendMessage: err.response?.data?.message
      });

      // Let handleError parse the error properly
      handleError(err, 'Validating discount');
    } finally {
      setSubmitting(false);
    }
  };

  const calculateFinalAmount = () => {
    const discount = parseFloat(discountAmount) || 0;
    return Math.max(0, extensionFee - discount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-amber-500 text-white">
              <Percent className="h-4 w-4" />
            </div>
            Apply Discount
          </DialogTitle>
          <DialogDescription className="text-sm">
            Admin approval required • Fully audited
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fee Summary Card */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4 pb-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Extension Fee</span>
                  <span className="text-xl font-bold text-blue-900 dark:text-blue-100">
                    {formatCurrency(extensionFee)}
                  </span>
                </div>
                {discountAmount && parseFloat(discountAmount) > 0 && !errors.discountAmount && (
                  <>
                    <div className="flex justify-between items-center text-amber-700 dark:text-amber-400">
                      <span className="text-sm">Discount</span>
                      <span className="text-base font-semibold">-{formatCurrency(parseFloat(discountAmount))}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-blue-200 dark:border-blue-800">
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Amount to Collect</span>
                      <span className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                        {formatCurrency(calculateFinalAmount())}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Discount Amount */}
          <div className="space-y-2">
            <Label htmlFor="discountAmount" className="text-sm font-medium">
              Discount Amount ($) *
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-500">$</span>
              <Input
                id="discountAmount"
                type="number"
                step="0.01"
                min="0"
                max={extensionFee}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder="0.00"
                className={`pl-8 pr-4 h-11 text-base font-semibold ${errors.discountAmount ? 'border-red-500 focus:ring-red-500' : 'border-amber-300 dark:border-amber-700 focus:ring-amber-500'} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
              />
            </div>
            {errors.discountAmount && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <span className="inline-block w-1 h-1 rounded-full bg-red-600"></span>
                {errors.discountAmount}
              </p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Maximum: {formatCurrency(extensionFee)}
            </p>
          </div>

          {/* Discount Reason */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="discountReason" className="text-sm font-medium">Reason *</Label>
              <span className="text-xs text-slate-500">{discountReason.length}/200</span>
            </div>
            <Textarea
              id="discountReason"
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
              placeholder="e.g., Loyal customer, hardship case, promotional offer..."
              rows={3}
              className={`text-sm resize-none ${errors.discountReason ? 'border-red-500' : ''}`}
              maxLength={200}
            />
            {errors.discountReason && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <span className="inline-block w-1 h-1 rounded-full bg-red-600"></span>
                {errors.discountReason}
              </p>
            )}
          </div>

          {/* Admin PIN */}
          <div className="space-y-2">
            <Label htmlFor="adminPin" className="text-sm font-medium flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-amber-600" />
              Admin PIN *
            </Label>
            <Input
              id="adminPin"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className={`text-center text-xl font-bold tracking-[0.5em] h-11 ${errors.adminPin ? 'border-red-500' : 'border-amber-300 dark:border-amber-700'}`}
            />
            {errors.adminPin && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <span className="inline-block w-1 h-1 rounded-full bg-red-600"></span>
                {errors.adminPin}
              </p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Only valid admin PINs will be accepted
            </p>
          </div>

          {/* Success Preview */}
          {discountAmount && parseFloat(discountAmount) > 0 && !errors.discountAmount && discountReason && adminPin && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-md border border-emerald-200 dark:border-emerald-800">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span className="text-sm text-emerald-800 dark:text-emerald-300">
                Ready to apply <strong>{formatCurrency(parseFloat(discountAmount))}</strong> discount
              </span>
            </div>
          )}
        </form>

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
            onClick={handleSubmit}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
            disabled={submitting || !discountAmount || !discountReason || !adminPin}
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <Percent className="h-4 w-4 mr-2" />
                Apply Discount
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExtensionDiscountDialog;
