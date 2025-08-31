import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, X, Calculator, AlertCircle, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Alert, AlertDescription } from '../../ui/alert';
import { Progress } from '../../ui/progress';
import { Badge } from '../../ui/badge';
import extensionService from '../../../services/extensionService';
import { formatTransactionId, formatCurrency } from '../../../utils/transactionUtils';
import { useFormValidation, validateAmount, validateExtension } from '../../../utils/formValidation';
import { handleError, handleSuccess } from '../../../utils/errorHandling';
import ConfirmationDialog from '../../common/ConfirmationDialog';
import LoadingDialog from '../../common/LoadingDialog';

const ExtensionForm = ({ transaction, onSuccess, onCancel }) => {
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
    extension_fee_per_month: transaction?.monthly_interest_amount?.toString() || '0',
    internal_notes: ''
  }, formValidators);
  
  const [eligibility, setEligibility] = useState(null);
  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

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
    
    const newMaturity = calculateNewMaturityDate;
    const isOverdue = transaction?.status === 'overdue';
    
    return {
      months,
      feePerMonth,
      totalFee,
      newMaturity,
      isOverdue,
      gracePeriodWarning: isOverdue && 'Extension from overdue status may include additional charges'
    };
  }, [formData.extension_months, formData.extension_fee_per_month, transaction?.status, calculateNewMaturityDate]);

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
        extension_fee_per_month: Math.round(parseFloat(formData.extension_fee_per_month)),
        internal_notes: formData.internal_notes.trim() || null
      };

      const result = await extensionService.processExtension(extensionData);
      
      const newMaturity = new Date(result.new_maturity_date);
      handleSuccess(
        `Loan extended for ${formData.extension_months} month(s). New maturity: ${newMaturity.toLocaleDateString()}`
      );
      
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      handleError(err, 'Processing extension');
    } finally {
      setSubmitting(false);
      setShowConfirmation(false);
    }
  }, [transaction.transaction_id, formData, onSuccess]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
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
        
        {/* Transaction Info Banner */}
        <div className="mb-6 p-4 bg-extension-light dark:bg-extension-medium/30 rounded-xl border border-extension-medium/20 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-extension-dark dark:text-extension-secondary flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Transaction Details
            </h3>
            <Badge variant="outline" className="border-extension-accent dark:border-extension-accent text-blue-700 dark:text-blue-300">
              #{formatTransactionId(transaction)}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm text-blue-700 dark:text-blue-300">Customer: <span className="font-medium">{transaction?.customer_id || 'N/A'}</span></div>
              <div className="text-sm text-blue-700 dark:text-blue-300">Status: <span className="capitalize font-medium">{transaction?.status || 'N/A'}</span></div>
            </div>
            
            <div className="p-3 bg-white/70 dark:bg-slate-800/70 rounded-lg border border-extension-medium/20 dark:border-extension-medium/40">
              <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Current Maturity</div>
              <div className="font-bold text-lg text-extension-dark dark:text-extension-secondary">
                {transaction?.maturity_date ? formatDate(transaction.maturity_date) : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
                <SelectValue placeholder="Select extension duration" />
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
              step="0.01"
              min="0"
              max="500"
              value={formData.extension_fee_per_month}
              onChange={(e) => handleInputChange('extension_fee_per_month', e.target.value)}
              onBlur={() => touchField('extension_fee_per_month')}
              placeholder="0.00"
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


          {/* Internal Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea
              id="notes"
              value={formData.internal_notes}
              onChange={(e) => handleInputChange('internal_notes', e.target.value)}
              placeholder="Optional internal notes..."
              rows={3}
              disabled={submitting}
              className="border-slate-300 focus:border-extension-accent focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
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

          {/* Fee Calculation Preview */}
          {feeCalculation && formData.extension_fee_per_month && eligibility?.is_eligible && (
            <Card className="bg-extension-light dark:bg-extension-medium/20 border-extension-medium/20 dark:border-extension-medium/40 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <div className="p-2 rounded-lg bg-extension-accent text-white shadow-md mr-3">
                    <Calculator className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-extension-dark dark:text-extension-secondary">Extension Calculator</div>
                    <div className="text-sm font-normal text-blue-600 dark:text-blue-400">Fee breakdown and new dates</div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-white/70 dark:bg-slate-800/70 rounded-lg border border-extension-medium/20 dark:border-extension-medium/40">
                    <div className="flex items-center text-blue-600 dark:text-blue-400 mb-1">
                      <Clock className="h-4 w-4 mr-2" />
                      <span className="text-sm font-medium">Duration</span>
                    </div>
                    <div className="font-bold text-lg text-extension-dark dark:text-extension-secondary">
                      {feeCalculation.months} month{feeCalculation.months !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="p-3 bg-white/70 dark:bg-slate-800/70 rounded-lg border border-extension-medium/20 dark:border-extension-medium/40">
                    <div className="flex items-center text-blue-600 dark:text-blue-400 mb-1">
                      <DollarSign className="h-4 w-4 mr-2" />
                      <span className="text-sm font-medium">Fee per Month</span>
                    </div>
                    <div className="font-bold text-lg text-extension-dark dark:text-extension-secondary">
                      {formatCurrency(feeCalculation.feePerMonth)}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-to-r from-gray-100 to-teal-100 dark:from-gray-800/50 dark:to-teal-950/50 rounded-lg border border-extension-accent dark:border-extension-accent">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-extension-dark dark:text-extension-secondary">Total Extension Fee:</span>
                      <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {formatCurrency(feeCalculation.totalFee)}
                      </span>
                    </div>
                  </div>
                  
                  {feeCalculation.newMaturity && (
                    <div className="p-3 bg-white/70 dark:bg-slate-800/70 rounded-lg border border-extension-medium/20 dark:border-extension-medium/40">
                      <div className="flex justify-between items-center">
                        <span className="text-blue-700 dark:text-blue-300 font-medium">New Maturity Date:</span>
                        <Badge variant="outline" className="font-mono text-lg px-3 py-1 border-extension-accent dark:border-extension-accent text-blue-700 dark:text-blue-300">
                          {formatDate(feeCalculation.newMaturity)}
                        </Badge>
                      </div>
                    </div>
                  )}
                  
                  {feeCalculation.isOverdue && feeCalculation.gracePeriodWarning && (
                    <Alert variant="destructive" className="border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm font-medium">
                        {feeCalculation.gracePeriodWarning}
                      </AlertDescription>
                    </Alert>
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
    </Card>
  );
};

export default ExtensionForm;