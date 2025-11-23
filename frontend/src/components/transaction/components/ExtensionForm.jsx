import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, X, AlertCircle, CheckCircle, Percent } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Alert, AlertDescription } from '../../ui/alert';
import { Badge } from '../../ui/badge';
import extensionService from '../../../services/extensionService';
import { formatTransactionId, formatCurrency } from '../../../utils/transactionUtils';
import { useFormValidation, validateAmount, validateExtension } from '../../../utils/formValidation';
import { handleError } from '../../../utils/errorHandling';
import ConfirmationDialog from '../../common/ConfirmationDialog';
import LoadingDialog from '../../common/LoadingDialog';
import ExtensionDiscountDialog from './ExtensionDiscountDialog';
import StatusBadge from './StatusBadge';
import { formatBusinessDate } from '../../../utils/timezoneUtils';
import { useStatsPolling } from '../../../hooks/useStatsPolling';
import { useAuth } from '../../../context/AuthContext';

const ExtensionForm = ({ transaction, onSuccess, onCancel }) => {
  const { triggerRefresh } = useStatsPolling();
  const { user } = useAuth();

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  // Form validation setup
  const formValidators = {
    extension_months: (value) => validateExtension(value, transaction),
    extension_fee_per_month: (value) => validateAmount(value, 'Extension fee per month', { min: 0, max: 500, allowZero: true })
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
    extension_months: '1',
    extension_fee_per_month: transaction?.monthly_interest_amount?.toString() || '0'
  }, formValidators);
  
  const [eligibility, setEligibility] = useState(null);
  const [loadingEligibility, setLoadingEligibility] = useState(false); // eslint-disable-line no-unused-vars
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [overdueFee, setOverdueFee] = useState('');
  const [discountData, setDiscountData] = useState(null);

  const calculateNewMaturityDate = useMemo(() => {
    if (!transaction?.maturity_date || !formData.extension_months) return null;
    
    const currentMaturity = new Date(transaction.maturity_date);
    const extensionMonths = parseInt(formData.extension_months);
    
    // Safe month addition that handles month overflow properly
    let newYear = currentMaturity.getFullYear();
    let newMonth = currentMaturity.getMonth() + extensionMonths;
    const day = currentMaturity.getDate();
    
    // Handle month overflow
    while (newMonth >= 12) {
      newYear += 1;
      newMonth -= 12;
    }
    
    // Handle day overflow for shorter months
    const newMaturity = new Date(newYear, newMonth, 1);
    const lastDayOfMonth = new Date(newYear, newMonth + 1, 0).getDate();
    const adjustedDay = Math.min(day, lastDayOfMonth);
    
    newMaturity.setDate(adjustedDay);
    newMaturity.setHours(currentMaturity.getHours(), currentMaturity.getMinutes(), currentMaturity.getSeconds(), currentMaturity.getMilliseconds());
    
    return newMaturity;
  }, [transaction?.maturity_date, formData.extension_months]);

  const checkEligibility = useCallback(async () => {
    if (!transaction?.transaction_id || !formData.extension_months) return;
    
    try {
      setLoadingEligibility(true);
      const eligibilityResult = await extensionService.checkExtensionEligibility(
        transaction.transaction_id,
        parseInt(formData.extension_months)
      );
      setEligibility(eligibilityResult);
      
      // Auto-populate fee if provided by API
      if (eligibilityResult.suggested_fee_per_month) {
        updateField('extension_fee_per_month', eligibilityResult.suggested_fee_per_month.toString());
      }
    } catch (err) {
      handleError(err, 'Checking extension eligibility');
      setEligibility(null);
    } finally {
      setLoadingEligibility(false);
    }
  }, [transaction?.transaction_id, formData.extension_months, updateField]);

  const feeCalculation = useMemo(() => {
    const months = parseInt(formData.extension_months) || 0;
    const feePerMonth = parseFloat(formData.extension_fee_per_month) || 0;
    const totalFee = months * feePerMonth;
    const overdueFeeAmount = parseFloat(overdueFee) || 0;
    const discount = discountData?.discountAmount || 0;
    const finalAmount = Math.max(0, totalFee + overdueFeeAmount - discount);

    const newMaturity = calculateNewMaturityDate;
    const isOverdue = transaction?.status === 'overdue';

    return {
      months,
      feePerMonth,
      totalFee,
      overdueFeeAmount,
      discount,
      finalAmount,
      newMaturity,
      isOverdue,
      gracePeriodWarning: isOverdue && 'Extension from overdue status may include additional charges'
    };
  }, [formData.extension_months, formData.extension_fee_per_month, transaction?.status, calculateNewMaturityDate, overdueFee, discountData]);

  const handleInputChange = useCallback((field, value) => {
    updateField(field, value);
  }, [updateField]);

  // Check eligibility when component mounts or extension months change with debounce
  useEffect(() => {
    if (!transaction?.transaction_id || !formData.extension_months) return;
    
    const timeoutId = setTimeout(() => {
      checkEligibility();
    }, 500); // 500ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [transaction?.transaction_id, formData.extension_months, checkEligibility]);

  const validateFormExtended = useCallback(() => {
    const isBasicValid = validateAll();
    
    if (!isBasicValid) {
      return false;
    }
    
    if (eligibility && !eligibility.is_eligible) {
      handleError({ 
        message: `Transaction not eligible for extension: ${eligibility.reason || 'Unknown reason'}`,
        status: 422 
      }, 'Extension validation');
      return false;
    }
    
    return true;
  }, [validateAll, eligibility]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!validateFormExtended()) {
      return;
    }

    // Show confirmation for extensions
    setShowConfirmation(true);
  }, [validateFormExtended]);

  const processExtension = useCallback(async () => {
    try {
      setSubmitting(true);

      const extensionData = {
        transaction_id: transaction.transaction_id,
        extension_months: parseInt(formData.extension_months),
        extension_fee_per_month: Math.round(parseFloat(formData.extension_fee_per_month))
      };

      // Include overdue fee if present
      if (overdueFee && parseFloat(overdueFee) > 0) {
        extensionData.overdue_fee_collected = parseFloat(overdueFee);
      }

      // Include discount data if applied
      if (discountData) {
        extensionData.discount_amount = discountData.discountAmount;
        extensionData.discount_reason = discountData.discountReason;
        extensionData.admin_pin = discountData.adminPin;
      }

      // REAL-TIME FIX: Use optimistic extension processing if available
      let result;
      if (window.TransactionListOptimistic?.processExtension) {
        result = await window.TransactionListOptimistic.processExtension(
          transaction.transaction_id,
          extensionData
        );
      } else {
        // Fallback to direct API call
        result = await extensionService.processExtension(extensionData);
      }

      // Trigger immediate stats refresh after successful extension
      triggerRefresh();

      // Always call onSuccess to close dialog and refresh UI
      if (onSuccess) {
        onSuccess(result, true); // Pass flag to indicate balance should be refreshed
      }

    } catch (err) {
      console.error('❌ EXTENSION PROCESSING FAILED:', err);
      handleError(err, 'Processing extension');
    } finally {
      setSubmitting(false);
      setShowConfirmation(false);
    }
  }, [transaction.transaction_id, formData, onSuccess, triggerRefresh, overdueFee, discountData]);

  const formatDate = (dateString) => {
    return formatBusinessDate(dateString);
  };


  const calculateTotalFee = () => {
    const months = parseInt(formData.extension_months) || 0;
    const feePerMonth = parseFloat(formData.extension_fee_per_month) || 0;
    return months * feePerMonth;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto bg-extension-light dark:bg-extension-dark backdrop-blur-xl border border-extension-medium/20 dark:border-extension-medium/40 shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between border-b border-extension-medium/20 dark:border-extension-medium/40 bg-extension-light dark:bg-extension-medium/20">
        <CardTitle className="flex items-center text-xl">
          <div className="p-2 rounded-lg bg-extension-accent text-white shadow-lg mr-3">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <div className="text-extension-dark dark:text-extension-secondary">Extend Loan</div>
            <div className="text-sm font-normal text-blue-600 dark:text-blue-400">Extend transaction maturity period</div>
          </div>
        </CardTitle>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      
      <CardContent className="relative">
        {/* Processing Overlay - only show when submitting */}
        {submitting && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-extension-accent"></div>
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                Processing extension...
              </p>
            </div>
          </div>
        )}
        
        {/* Transaction Info Banner - Compact */}
        <div className="mb-5 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Transaction ID and Customer Info */}
            <div className="flex flex-col gap-1">
              <Badge variant="outline" className="font-mono bg-white dark:bg-slate-900 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 px-2.5 py-1 whitespace-nowrap w-fit">
                #{formatTransactionId(transaction)}
              </Badge>
              <div className="flex flex-col mt-1">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                  {transaction?.customer_name || 'N/A'}
                </span>
                <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                  {transaction?.customer_id || 'N/A'}
                </span>
              </div>
            </div>

            {/* Loan Amount */}
            <div className="flex flex-col justify-center">
              <span className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Loan Amount</span>
              <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                {formatCurrency(transaction?.loan_amount || 0)}
              </span>
            </div>

            {/* Status */}
            <div className="flex flex-col justify-center">
              <span className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Status:</span>
              <StatusBadge status={transaction?.status} />
            </div>

            {/* Current Maturity */}
            <div className="flex flex-col justify-center">
              <span className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Due:</span>
              <span className="text-base font-bold text-blue-700 dark:text-blue-400">
                {transaction?.maturity_date ? formatDate(transaction.maturity_date) : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Extension Duration and Fee Per Month - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Extension Duration */}
            <div className="space-y-2">
              <Label htmlFor="extension_months">Extension Duration *</Label>
              <Select
                value={formData.extension_months}
                onValueChange={(value) => handleInputChange('extension_months', value)}
                onOpenChange={(open) => !open && touchField('extension_months')}
                disabled={submitting}
              >
                <SelectTrigger className={getFieldError('extension_months') ? 'border-red-500 focus:border-red-500 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 ring-0 ring-offset-0' : 'border-slate-300 focus:border-extension-accent focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 ring-0 ring-offset-0'}>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Month</SelectItem>
                  <SelectItem value="2">2 Months</SelectItem>
                  <SelectItem value="3">3 Months</SelectItem>
                </SelectContent>
              </Select>
              {getFieldError('extension_months') && (
                <div className="text-xs text-red-600 mt-1">
                  {getFieldError('extension_months')}
                </div>
              )}
            </div>

            {/* Fee Per Month */}
            <div className="space-y-2">
              <Label htmlFor="extension_fee">Fee Per Month ($) *</Label>
              <Input
                id="extension_fee"
                type="number"
                step="1"
                min="0"
                max="500"
                value={formData.extension_fee_per_month}
                onChange={(e) => handleInputChange('extension_fee_per_month', e.target.value)}
                onInput={(e) => {
                  // Prevent decimal point entry
                  e.target.value = e.target.value.replace(/[.,]/g, '');
                }}
                onBlur={() => touchField('extension_fee_per_month')}
                placeholder="Whole dollars only (no cents)"
                disabled={submitting}
                className={getFieldError('extension_fee_per_month') ? 'border-red-500 focus:border-red-500 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0' : 'border-slate-300 focus:border-extension-accent focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0'}
                aria-invalid={!!getFieldError('extension_fee_per_month')}
                aria-describedby={getFieldError('extension_fee_per_month') ? 'extension_fee_error' : undefined}
              />
              {getFieldError('extension_fee_per_month') && (
                <div id="extension_fee_error" className="text-xs text-red-600 mt-1">
                  {getFieldError('extension_fee_per_month')}
                </div>
              )}
            </div>
          </div>



          {/* Eligibility Check - Only show if there are issues or warnings */}
          {eligibility && !eligibility.is_eligible && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div className="font-medium">Not eligible for extension</div>
                  {eligibility.reason && (
                    <div>Reason: {eligibility.reason}</div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Show warnings even if eligible */}
          {eligibility && eligibility.is_eligible && eligibility.warnings && eligibility.warnings.length > 0 && (
            <Alert variant="default">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div className="font-medium">Warnings:</div>
                  {eligibility.warnings.map((warning, index) => (
                    <div key={index}>• {warning}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Fee Summary Card - User-Friendly Design */}
          {feeCalculation && formData.extension_fee_per_month && eligibility?.is_eligible && (
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 shadow-sm">
              <CardContent className="pt-5 pb-5">
                <div className="space-y-4">
                  {/* Extension Fee Section */}
                  <div>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Extension Fee</span>
                      <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {formatCurrency(feeCalculation.totalFee)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 dark:text-slate-500">
                        {feeCalculation.months} month{feeCalculation.months !== 1 ? 's' : ''} @ {formatCurrency(feeCalculation.feePerMonth)}/month
                      </span>
                      {isAdmin && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-900/20"
                          onClick={() => setShowDiscountDialog(true)}
                        >
                          <Percent className="h-3 w-3 mr-1" />
                          {discountData ? 'Edit Discount' : 'Add Discount'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Overdue Fee Section - Only show for overdue transactions */}
                  {feeCalculation.isOverdue && (
                    <div className="pt-3 border-t border-blue-200 dark:border-blue-700">
                      <div className="flex justify-between items-center gap-4 mb-2">
                        <div className="flex-1">
                          <Label htmlFor="overdue-fee" className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1 block">
                            Add Overdue Fee
                          </Label>
                          <p className="text-xs text-slate-500 dark:text-slate-500">Optional late payment charge</p>
                        </div>
                        <div className="relative w-28">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
                          <Input
                            id="overdue-fee"
                            type="number"
                            min="0"
                            max="10000"
                            placeholder="0.00"
                            value={overdueFee}
                            onChange={(e) => setOverdueFee(e.target.value)}
                            className="h-10 w-full text-base font-semibold text-right pl-7 pr-3 border-amber-300 dark:border-amber-700 focus:ring-2 focus:ring-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      </div>
                      {overdueFee && parseFloat(overdueFee) > 0 && (
                        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800">
                          <CheckCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                          <span className="text-sm text-amber-800 dark:text-amber-300">
                            Late payment fee of <strong>{formatCurrency(parseFloat(overdueFee))}</strong> will be added
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Discount Section - Show when discount applied */}
                  {discountData && (
                    <div className="pt-3 border-t border-blue-200 dark:border-blue-700">
                      <div className="flex justify-between items-center gap-4 mb-2">
                        <div className="flex-1">
                          <Label className="text-sm font-medium text-purple-700 dark:text-purple-400 mb-1 block">
                            Discount Applied
                          </Label>
                          <p className="text-xs text-slate-500 dark:text-slate-500">{discountData.discountReason}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-purple-700 dark:text-purple-400">
                            -{formatCurrency(discountData.discountAmount)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                            onClick={() => setDiscountData(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-md border border-purple-200 dark:border-purple-800">
                        <CheckCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                        <span className="text-sm text-purple-800 dark:text-purple-300">
                          Discount of <strong>{formatCurrency(discountData.discountAmount)}</strong> has been approved
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Final Amount Section - Show when discount or overdue fee present */}
                  {(discountData || (overdueFee && parseFloat(overdueFee) > 0)) && (
                    <div className="pt-4 border-t-2 border-emerald-200 dark:border-emerald-800">
                      <div className="flex justify-between items-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                        <div>
                          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400 block mb-1">Total Amount Due</span>
                          <span className="text-xs text-emerald-600 dark:text-emerald-500">Amount to collect from customer</span>
                        </div>
                        <span className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
                          {formatCurrency(feeCalculation.finalAmount)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* New Maturity Date */}
                  {feeCalculation.newMaturity && (
                    <div className="pt-3 border-t border-blue-200 dark:border-blue-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 block">New Maturity Date</span>
                          <span className="text-xs text-slate-500 dark:text-slate-500">Extended due date</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-base font-bold text-blue-700 dark:text-blue-400">
                            {formatDate(feeCalculation.newMaturity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Form Validation Errors */}
          {Object.keys(formValidators).map(field => {
            const error = getFieldError(field);
            const suggestions = getFieldSuggestions(field);
            
            if (!error && suggestions.length === 0) return null;
            
            return (
              <Alert key={field} variant={error ? "destructive" : "default"}>
                {error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                <AlertDescription>
                  {error && <div className="font-medium">{error}</div>}
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
                !eligibility?.is_eligible ||
                !isFormValid
              }
              className={feeCalculation?.isOverdue 
                ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg transform hover:scale-105 transition-all duration-200'
                : 'bg-gradient-to-r from-extension-accent to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg transform hover:scale-105 transition-all duration-200'
              }
              size="lg"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Processing...
                </>
              ) : feeCalculation?.isOverdue ? (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Extend Overdue Loan
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  Process Extension
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
        title={feeCalculation?.isOverdue ? "Confirm Overdue Extension" : "Confirm Loan Extension"}
        description={feeCalculation?.isOverdue 
          ? "This transaction is overdue. The extension will apply from the original maturity date."
          : `Extend this loan for ${formData.extension_months} month(s) with a total fee of $${calculateTotalFee().toFixed(2)}?`
        }
        onConfirm={processExtension}
        onCancel={() => setShowConfirmation(false)}
        confirmText="Process Extension"
        variant={feeCalculation?.isOverdue ? "warning" : "default"}
        loading={submitting}
      >
        {feeCalculation && (
          <div className="space-y-2 text-sm">
            <div className="font-medium">Extension Details:</div>
            <div className="flex justify-between">
              <span>Duration:</span>
              <span>{feeCalculation.months} month{feeCalculation.months !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between">
              <span>Fee per Month:</span>
              <span>{formatCurrency(feeCalculation.feePerMonth)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Total Fee:</span>
              <span>{formatCurrency(feeCalculation.totalFee)}</span>
            </div>
            {feeCalculation.newMaturity && (
              <div className="flex justify-between">
                <span>New Maturity:</span>
                <span className="font-mono">{formatDate(feeCalculation.newMaturity)}</span>
              </div>
            )}
          </div>
        )}
      </ConfirmationDialog>

      {/* Loading Dialog */}
      <LoadingDialog
        open={submitting && !showConfirmation}
        title="Processing Extension"
        description="Extending your loan period..."
      />

      {/* Discount Dialog */}
      <ExtensionDiscountDialog
        open={showDiscountDialog}
        onOpenChange={setShowDiscountDialog}
        transaction={transaction}
        extensionFee={feeCalculation.totalFee}
        extensionMonths={parseInt(formData.extension_months)}
        extensionFeePerMonth={Math.round(parseFloat(formData.extension_fee_per_month))}
        overdueFeeCollected={overdueFee}
        onSuccess={(discountInfo) => {
          // Store discount data - don't process yet
          setDiscountData(discountInfo);
        }}
      />
    </Card>
  );
};

export default ExtensionForm;