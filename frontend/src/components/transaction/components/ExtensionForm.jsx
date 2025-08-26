import React, { useState, useEffect } from 'react';
import { Calendar, CreditCard, X, Clock } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import extensionService from '../../../services/extensionService';
import { formatTransactionId } from '../../../utils/transactionUtils';

const ExtensionForm = ({ transaction, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    extension_months: '1',
    extension_fee_per_month: '',
    internal_notes: ''
  });
  
  const [eligibility, setEligibility] = useState(null);
  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Check eligibility when component mounts or extension months change
  useEffect(() => {
    if (transaction?.transaction_id && formData.extension_months) {
      checkEligibility();
    }
  }, [transaction?.transaction_id, formData.extension_months]);

  const checkEligibility = async () => {
    try {
      setLoadingEligibility(true);
      const eligibilityResult = await extensionService.checkExtensionEligibility(
        transaction.transaction_id,
        parseInt(formData.extension_months)
      );
      setEligibility(eligibilityResult);
      
      // Auto-populate fee if provided by API
      if (eligibilityResult.suggested_fee_per_month) {
        setFormData(prev => ({
          ...prev,
          extension_fee_per_month: eligibilityResult.suggested_fee_per_month.toString()
        }));
      }
    } catch (err) {
      console.error('Error checking extension eligibility:', err);
      setError('Failed to check extension eligibility');
    } finally {
      setLoadingEligibility(false);
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
    const months = parseInt(formData.extension_months);
    const fee = parseFloat(formData.extension_fee_per_month);
    
    if (!months || months < 1 || months > 3) {
      setError('Extension months must be between 1 and 3');
      return false;
    }
    
    if (!fee || fee < 0 || fee > 500) {
      setError('Extension fee must be between $0 and $500 per month');
      return false;
    }
    
    if (eligibility && !eligibility.is_eligible) {
      setError(`Transaction not eligible for extension: ${eligibility.reason || 'Unknown reason'}`);
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

      const extensionData = {
        transaction_id: transaction.transaction_id,
        extension_months: parseInt(formData.extension_months),
        extension_fee_per_month: Math.round(parseFloat(formData.extension_fee_per_month)),
        internal_notes: formData.internal_notes.trim() || null
      };

      const result = await extensionService.processExtension(extensionData);
      
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      console.error('Error processing extension:', err);
      setError(err.message || 'Failed to process extension');
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const calculateNewMaturityDate = () => {
    if (!transaction?.maturity_date || !formData.extension_months) return null;
    
    const currentMaturity = new Date(transaction.maturity_date);
    const extensionMonths = parseInt(formData.extension_months);
    const newMaturity = new Date(currentMaturity);
    newMaturity.setMonth(newMaturity.getMonth() + extensionMonths);
    
    return newMaturity;
  };

  const calculateTotalFee = () => {
    const months = parseInt(formData.extension_months) || 0;
    const feePerMonth = parseFloat(formData.extension_fee_per_month) || 0;
    return months * feePerMonth;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <Calendar className="h-5 w-5 mr-2" />
          Extend Loan
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
            <div>Current Status: <span className="capitalize">{transaction?.status || 'N/A'}</span></div>
            <div>Current Maturity: {transaction?.maturity_date ? formatDate(transaction.maturity_date) : 'N/A'}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Extension Duration */}
          <div className="space-y-2">
            <Label htmlFor="extension_months">Extension Duration *</Label>
            <Select value={formData.extension_months} onValueChange={(value) => handleInputChange('extension_months', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select extension duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Month</SelectItem>
                <SelectItem value="2">2 Months</SelectItem>
                <SelectItem value="3">3 Months</SelectItem>
              </SelectContent>
            </Select>
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
              placeholder="0.00"
              disabled={loadingEligibility}
            />
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
            />
          </div>

          {/* Eligibility Check */}
          {loadingEligibility && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-blue-700 text-sm">Checking extension eligibility...</div>
            </div>
          )}

          {eligibility && !loadingEligibility && (
            <div className={`p-3 border rounded-lg ${
              eligibility.is_eligible ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className={`text-sm ${eligibility.is_eligible ? 'text-green-800' : 'text-red-800'}`}>
                <div className="font-medium">
                  Eligibility: {eligibility.is_eligible ? '✅ Eligible' : '❌ Not Eligible'}
                </div>
                {eligibility.reason && (
                  <div className="mt-1">Reason: {eligibility.reason}</div>
                )}
                {eligibility.warnings && eligibility.warnings.length > 0 && (
                  <div className="mt-2">
                    <div className="font-medium">Warnings:</div>
                    {eligibility.warnings.map((warning, index) => (
                      <div key={index} className="text-yellow-600">⚠️ {warning}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Extension Summary */}
          {formData.extension_months && formData.extension_fee_per_month && eligibility?.is_eligible && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm space-y-1">
                <div className="font-medium text-blue-800">Extension Summary</div>
                <div>Duration: {formData.extension_months} month{formData.extension_months !== '1' ? 's' : ''}</div>
                <div>Fee per month: {formatCurrency(parseFloat(formData.extension_fee_per_month))}</div>
                <div>Total extension fee: {formatCurrency(calculateTotalFee())}</div>
                {calculateNewMaturityDate() && (
                  <div className="font-medium">
                    New maturity date: {formatDate(calculateNewMaturityDate())}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-red-600 text-sm">
                <strong>Error:</strong> {error}
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
              disabled={submitting || loadingEligibility || !eligibility?.is_eligible}
            >
              {submitting ? 'Processing...' : 'Process Extension'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ExtensionForm;