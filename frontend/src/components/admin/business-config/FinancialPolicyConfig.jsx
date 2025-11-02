import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Checkbox } from '../../ui/checkbox';
import { DollarSign, Loader2 } from 'lucide-react';
import businessConfigService from '../../../services/businessConfigService';
import { toast } from 'sonner';
import { formatBusinessDateTime } from '../../../utils/timezoneUtils';

const FinancialPolicyConfig = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [creditLimitError, setCreditLimitError] = useState('');
  const [loanAmountError, setLoanAmountError] = useState('');
  const [formData, setFormData] = useState({
    default_monthly_interest_rate: '',
    min_interest_rate: '',
    max_interest_rate: '',
    allow_staff_override: true,
    min_loan_amount: 10.0,
    max_loan_amount: 10000.0,
    max_active_loans_per_customer: 8,
    customer_credit_limit: 3000,
    reason: ''
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await businessConfigService.getFinancialPolicyConfig();
      setConfig(data);
      setCreditLimitError(''); // Clear any validation errors
      setLoanAmountError(''); // Clear loan amount errors
      setFormData({
        default_monthly_interest_rate: data.default_monthly_interest_rate || '',
        min_interest_rate: data.min_interest_rate || '',
        max_interest_rate: data.max_interest_rate || '',
        allow_staff_override: data.allow_staff_override,
        min_loan_amount: data.min_loan_amount || 10.0,
        max_loan_amount: data.max_loan_amount || 10000.0,
        max_active_loans_per_customer: data.max_active_loans_per_customer || 8,
        customer_credit_limit: data.customer_credit_limit || '',
        reason: ''
      });
    } catch (error) {
      if (error.status !== 404) {
        console.error('Error fetching financial policy config:', error);
        toast.error('Failed to load financial policy');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

    // Real-time validation for customer credit limit
    if (e.target.name === 'customer_credit_limit') {
      if (value && parseFloat(value) < 3000) {
        setCreditLimitError('Credit limit cannot be below $3,000');
      } else {
        setCreditLimitError('');
      }
    }

    // Real-time validation for max active loans per customer
    if (e.target.name === 'max_active_loans_per_customer') {
      if (value && parseInt(value) < 8) {
        setLoanAmountError('Loan limit cannot be below 8');
      } else if (value && parseInt(value) > 20) {
        setLoanAmountError('Loan limit cannot exceed 20');
      } else {
        setLoanAmountError('');
      }
    }

    // Real-time validation for loan amounts
    if (e.target.name === 'min_loan_amount' || e.target.name === 'max_loan_amount') {
      const minLoan = e.target.name === 'min_loan_amount' ? parseFloat(value) : parseFloat(formData.min_loan_amount);
      const maxLoan = e.target.name === 'max_loan_amount' ? parseFloat(value) : parseFloat(formData.max_loan_amount);

      if (minLoan && maxLoan && minLoan > maxLoan) {
        setLoanAmountError('Minimum loan amount cannot exceed maximum loan amount');
      } else if (minLoan && minLoan < 0) {
        setLoanAmountError('Loan amounts cannot be negative');
      } else if (maxLoan && maxLoan < 0) {
        setLoanAmountError('Loan amounts cannot be negative');
      } else {
        setLoanAmountError('');
      }
    }

    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check for validation errors
    if (creditLimitError || loanAmountError) {
      toast.error('Please fix validation errors before saving');
      return;
    }

    // Validation
    if (!formData.reason || formData.reason.length < 5) {
      toast.error('Please provide a reason for this configuration change (min 5 characters)');
      return;
    }

    // Validate customer credit limit minimum (backup validation)
    if (formData.customer_credit_limit && parseFloat(formData.customer_credit_limit) < 3000) {
      toast.error('Customer credit limit cannot be below $3,000');
      return;
    }

    // Validate max active loans per customer (backup validation)
    if (formData.max_active_loans_per_customer && parseInt(formData.max_active_loans_per_customer) < 8) {
      toast.error('Loan limit cannot be below 8');
      return;
    }

    if (formData.max_active_loans_per_customer && parseInt(formData.max_active_loans_per_customer) > 20) {
      toast.error('Loan limit cannot exceed 20');
      return;
    }

    // Validate loan amounts (backup validation)
    const minLoan = parseFloat(formData.min_loan_amount);
    const maxLoan = parseFloat(formData.max_loan_amount);
    if (minLoan && maxLoan && minLoan > maxLoan) {
      toast.error('Minimum loan amount cannot exceed maximum loan amount');
      return;
    }

    // Convert string values to numbers
    const payload = {
      ...formData,
      default_monthly_interest_rate: parseFloat(formData.default_monthly_interest_rate),
      min_interest_rate: parseFloat(formData.min_interest_rate),
      max_interest_rate: parseFloat(formData.max_interest_rate),
      min_loan_amount: parseFloat(formData.min_loan_amount),
      max_loan_amount: parseFloat(formData.max_loan_amount),
      max_active_loans_per_customer: parseInt(formData.max_active_loans_per_customer),
      customer_credit_limit: formData.customer_credit_limit ? parseFloat(formData.customer_credit_limit) : null,
      enforce_credit_limit: true, // Always enforce credit limits
    };

    try {
      setSaving(true);
      const savedConfig = await businessConfigService.createFinancialPolicyConfig(payload);
      toast.success('Financial policy saved successfully');

      // Use the save response directly instead of fetching again
      setConfig(savedConfig);
      setCreditLimitError(''); // Clear validation error after successful save
      setLoanAmountError(''); // Clear loan amount errors after successful save
      setFormData({
        default_monthly_interest_rate: savedConfig.default_monthly_interest_rate?.toString() || '20',
        min_interest_rate: savedConfig.min_interest_rate?.toString() || '10',
        max_interest_rate: savedConfig.max_interest_rate?.toString() || '50',
        min_loan_amount: savedConfig.min_loan_amount?.toString() || '50',
        max_loan_amount: savedConfig.max_loan_amount?.toString() || '10000',
        max_active_loans_per_customer: savedConfig.max_active_loans_per_customer?.toString() || '8',
        customer_credit_limit: savedConfig.customer_credit_limit?.toString() || '',
        allow_staff_override: savedConfig.allow_staff_override ?? true,
        reason: '' // Clear reason field after save
      });
    } catch (error) {
      console.error('Error saving financial policy config:', error);
      toast.error(error.detail || 'Failed to save financial policy');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-3">
          <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
          <div>
            <CardTitle>Financial Policies</CardTitle>
            <CardDescription>Interest rates, extension fees, loan limits, and credit limits</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Interest Rates */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Interest Rate Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="default_monthly_interest_rate">Default Monthly Interest *</Label>
                <Input
                  id="default_monthly_interest_rate"
                  name="default_monthly_interest_rate"
                  type="number"
                  step="0.01"
                  value={formData.default_monthly_interest_rate}
                  onChange={handleChange}
                  placeholder="e.g., 50.00"
                  required
                />
              </div>
              <div>
                <Label htmlFor="min_interest_rate">Minimum Interest</Label>
                <Input
                  id="min_interest_rate"
                  name="min_interest_rate"
                  type="number"
                  step="0.01"
                  value={formData.min_interest_rate}
                  onChange={handleChange}
                  placeholder="e.g., 10.00"
                />
              </div>
              <div>
                <Label htmlFor="max_interest_rate">Maximum Interest *</Label>
                <Input
                  id="max_interest_rate"
                  name="max_interest_rate"
                  type="number"
                  step="0.01"
                  value={formData.max_interest_rate}
                  onChange={handleChange}
                  placeholder="e.g., 200.00"
                  required
                />
              </div>
            </div>
            <div className="mt-3 flex items-center space-x-2">
              <Checkbox
                id="allow_staff_override"
                name="allow_staff_override"
                checked={formData.allow_staff_override}
                onCheckedChange={(checked) => setFormData({ ...formData, allow_staff_override: checked })}
              />
              <Label htmlFor="allow_staff_override" className="font-normal cursor-pointer">
                Allow staff to override default interest rate
              </Label>
            </div>
          </div>

          {/* Loan Limit and Credit Limit Settings - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Loan Limit Settings */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Loan Limit Settings</h3>
              <div>
                <Label htmlFor="max_active_loans_per_customer">
                  Default Customer Loan Limit (optional)
                </Label>
                <Input
                  id="max_active_loans_per_customer"
                  name="max_active_loans_per_customer"
                  type="number"
                  min="8"
                  max="20"
                  value={formData.max_active_loans_per_customer}
                  onChange={handleChange}
                  className={loanAmountError ? 'border-red-500' : ''}
                />
                {loanAmountError && (
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    ⚠️ {loanAmountError}
                  </p>
                )}
                {!loanAmountError && (
                  <p className="text-xs text-slate-500 mt-1">
                    Minimum 8 required. Leave empty to keep current default.
                  </p>
                )}
              </div>
            </div>

            {/* Credit Limit Settings */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Credit Limit Settings</h3>
              <div>
                <Label htmlFor="customer_credit_limit">
                  Default Customer Credit Limit (optional)
                </Label>
                <Input
                  id="customer_credit_limit"
                  name="customer_credit_limit"
                  type="number"
                  step="0.01"
                  min="3000"
                  value={formData.customer_credit_limit}
                  onChange={handleChange}
                  className={creditLimitError ? 'border-red-500' : ''}
                />
                {creditLimitError && (
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    ⚠️ {creditLimitError}
                  </p>
                )}
                {!creditLimitError && (
                  <p className="text-xs text-slate-500 mt-1">
                    Minimum $3,000 required. Leave empty to keep current default.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Reason for Change */}
          <div>
            <Label htmlFor="reason">Reason for Change *</Label>
            <Textarea
              id="reason"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Explain why you are updating this configuration..."
              rows={3}
              required
              className="resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">Minimum 5 characters required</p>
          </div>

          {config && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Last updated: {formatBusinessDateTime(config.updated_at)} by {config.updated_by}
            </div>
          )}

          <Button type="submit" disabled={saving || creditLimitError || loanAmountError} className="w-full md:w-auto">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Financial Policy'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default FinancialPolicyConfig;
