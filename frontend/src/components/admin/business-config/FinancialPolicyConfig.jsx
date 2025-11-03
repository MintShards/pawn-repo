import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { DollarSign, Loader2 } from 'lucide-react';
import businessConfigService from '../../../services/businessConfigService';
import { toast } from 'sonner';
import { formatBusinessDateTime } from '../../../utils/timezoneUtils';

const FinancialPolicyConfig = () => {
  const [loading, setLoading] = useState(false);
  const [savingInterestRates, setSavingInterestRates] = useState(false);
  const [savingLoanLimit, setSavingLoanLimit] = useState(false);
  const [savingCreditLimit, setSavingCreditLimit] = useState(false);
  const [config, setConfig] = useState(null);

  // Interest Rate Settings State
  const [interestRateData, setInterestRateData] = useState({
    default_monthly_interest_rate: '',
    min_interest_rate: '',
    max_interest_rate: '',
    reason: ''
  });
  const [initialInterestRateData, setInitialInterestRateData] = useState(null);
  const [hasInterestRateChanges, setHasInterestRateChanges] = useState(false);

  // Loan Limit Settings State
  const [loanLimitData, setLoanLimitData] = useState({
    max_active_loans_per_customer: 8,
    reason: ''
  });
  const [initialLoanLimitData, setInitialLoanLimitData] = useState(null);
  const [hasLoanLimitChanges, setHasLoanLimitChanges] = useState(false);
  const [loanLimitError, setLoanLimitError] = useState('');

  // Credit Limit Settings State
  const [creditLimitData, setCreditLimitData] = useState({
    customer_credit_limit: 3000,
    reason: ''
  });
  const [initialCreditLimitData, setInitialCreditLimitData] = useState(null);
  const [hasCreditLimitChanges, setHasCreditLimitChanges] = useState(false);
  const [creditLimitError, setCreditLimitError] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  // Track Interest Rate changes
  useEffect(() => {
    if (initialInterestRateData) {
      const changed = Object.keys(interestRateData).some(
        key => {
          if (key === 'reason') return interestRateData.reason.length > 0;
          return interestRateData[key] !== initialInterestRateData[key];
        }
      );
      setHasInterestRateChanges(changed);
    }
  }, [interestRateData, initialInterestRateData]);

  // Track Loan Limit changes
  useEffect(() => {
    if (initialLoanLimitData) {
      const changed = Object.keys(loanLimitData).some(
        key => {
          if (key === 'reason') return loanLimitData.reason.length > 0;
          return loanLimitData[key] !== initialLoanLimitData[key];
        }
      );
      setHasLoanLimitChanges(changed);
    }
  }, [loanLimitData, initialLoanLimitData]);

  // Track Credit Limit changes
  useEffect(() => {
    if (initialCreditLimitData) {
      const changed = Object.keys(creditLimitData).some(
        key => {
          if (key === 'reason') return creditLimitData.reason.length > 0;
          return creditLimitData[key] !== initialCreditLimitData[key];
        }
      );
      setHasCreditLimitChanges(changed);
    }
  }, [creditLimitData, initialCreditLimitData]);

  // Warn before closing/navigating with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasInterestRateChanges || hasLoanLimitChanges || hasCreditLimitChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasInterestRateChanges, hasLoanLimitChanges, hasCreditLimitChanges]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await businessConfigService.getFinancialPolicyConfig();
      setConfig(data);

      // Populate Interest Rate Settings
      const interestRates = {
        default_monthly_interest_rate: data.default_monthly_interest_rate || '',
        min_interest_rate: data.min_interest_rate || '',
        max_interest_rate: data.max_interest_rate || '',
        reason: ''
      };
      setInterestRateData(interestRates);
      setInitialInterestRateData(interestRates);

      // Populate Loan Limit Settings
      const loanLimit = {
        max_active_loans_per_customer: data.max_active_loans_per_customer || 8,
        reason: ''
      };
      setLoanLimitData(loanLimit);
      setInitialLoanLimitData(loanLimit);
      setLoanLimitError('');

      // Populate Credit Limit Settings
      const creditLimit = {
        customer_credit_limit: data.customer_credit_limit || 3000,
        reason: ''
      };
      setCreditLimitData(creditLimit);
      setInitialCreditLimitData(creditLimit);
      setCreditLimitError('');
    } catch (error) {
      if (error.status !== 404) {
        console.error('Error fetching financial policy config:', error);
        toast.error('Failed to load financial policy');
      }
    } finally {
      setLoading(false);
    }
  };

  // Interest Rate Settings Handlers
  const handleInterestRateChange = (e) => {
    setInterestRateData({
      ...interestRateData,
      [e.target.name]: e.target.value
    });
  };

  const handleInterestRateReset = () => {
    if (initialInterestRateData) {
      setInterestRateData(initialInterestRateData);
      toast.info('Interest rate settings reset to saved values');
    }
  };

  const handleInterestRateSubmit = async (e) => {
    e.preventDefault();

    if (!interestRateData.reason || interestRateData.reason.length < 5) {
      toast.error('Please provide a reason for this configuration change (min 5 characters)');
      return;
    }

    const payload = {
      default_monthly_interest_rate: parseFloat(interestRateData.default_monthly_interest_rate),
      min_interest_rate: parseFloat(interestRateData.min_interest_rate),
      max_interest_rate: parseFloat(interestRateData.max_interest_rate),
      // Preserve other section values
      min_loan_amount: config?.min_loan_amount || 10.0,
      max_loan_amount: config?.max_loan_amount || 10000.0,
      max_active_loans_per_customer: config?.max_active_loans_per_customer || 8,
      customer_credit_limit: config?.customer_credit_limit || null,
      enforce_credit_limit: true,
      reason: interestRateData.reason,
      section_updated: "interest_rates"
    };

    try {
      setSavingInterestRates(true);
      const savedConfig = await businessConfigService.createFinancialPolicyConfig(payload);
      toast.success('Interest rate settings saved successfully');
      setConfig(savedConfig);
      const updatedData = {
        default_monthly_interest_rate: savedConfig.default_monthly_interest_rate?.toString() || '',
        min_interest_rate: savedConfig.min_interest_rate?.toString() || '',
        max_interest_rate: savedConfig.max_interest_rate?.toString() || '',
        reason: ''
      };
      setInterestRateData(updatedData);
      setInitialInterestRateData(updatedData);
    } catch (error) {
      console.error('Error saving interest rate settings:', error);
      toast.error(error.detail || 'Failed to save interest rate settings');
    } finally {
      setSavingInterestRates(false);
    }
  };

  // Loan Limit Settings Handlers
  const handleLoanLimitChange = (e) => {
    const value = e.target.value;

    // Real-time validation
    if (value && parseInt(value) < 8) {
      setLoanLimitError('Loan limit cannot be below 8');
    } else if (value && parseInt(value) > 20) {
      setLoanLimitError('Loan limit cannot exceed 20');
    } else {
      setLoanLimitError('');
    }

    setLoanLimitData({
      ...loanLimitData,
      [e.target.name]: value
    });
  };

  const handleLoanLimitReset = () => {
    if (initialLoanLimitData) {
      setLoanLimitData(initialLoanLimitData);
      setLoanLimitError('');
      toast.info('Loan limit settings reset to saved values');
    }
  };

  const handleLoanLimitSubmit = async (e) => {
    e.preventDefault();

    if (loanLimitError) {
      toast.error('Please fix validation errors before saving');
      return;
    }

    if (!loanLimitData.reason || loanLimitData.reason.length < 5) {
      toast.error('Please provide a reason for this configuration change (min 5 characters)');
      return;
    }

    // Backup validation
    if (loanLimitData.max_active_loans_per_customer && parseInt(loanLimitData.max_active_loans_per_customer) < 8) {
      toast.error('Loan limit cannot be below 8');
      return;
    }

    if (loanLimitData.max_active_loans_per_customer && parseInt(loanLimitData.max_active_loans_per_customer) > 20) {
      toast.error('Loan limit cannot exceed 20');
      return;
    }

    const payload = {
      max_active_loans_per_customer: loanLimitData.max_active_loans_per_customer ? parseInt(loanLimitData.max_active_loans_per_customer) : 8,
      // Preserve other section values
      default_monthly_interest_rate: config?.default_monthly_interest_rate || 0,
      min_interest_rate: config?.min_interest_rate || 0,
      max_interest_rate: config?.max_interest_rate || 0,
      min_loan_amount: config?.min_loan_amount || 10.0,
      max_loan_amount: config?.max_loan_amount || 10000.0,
      customer_credit_limit: config?.customer_credit_limit || null,
      enforce_credit_limit: true,
      reason: loanLimitData.reason,
      section_updated: "loan_limit"
    };

    try {
      setSavingLoanLimit(true);
      const savedConfig = await businessConfigService.createFinancialPolicyConfig(payload);
      toast.success('Loan limit settings saved successfully');
      setConfig(savedConfig);
      const updatedData = {
        max_active_loans_per_customer: savedConfig.max_active_loans_per_customer || 8,
        reason: ''
      };
      setLoanLimitData(updatedData);
      setInitialLoanLimitData(updatedData);
      setLoanLimitError('');
    } catch (error) {
      console.error('Error saving loan limit settings:', error);
      toast.error(error.detail || 'Failed to save loan limit settings');
    } finally {
      setSavingLoanLimit(false);
    }
  };

  // Credit Limit Settings Handlers
  const handleCreditLimitChange = (e) => {
    const value = e.target.value;

    // Real-time validation
    if (value && parseFloat(value) < 3000) {
      setCreditLimitError('Credit limit cannot be below $3,000');
    } else {
      setCreditLimitError('');
    }

    setCreditLimitData({
      ...creditLimitData,
      [e.target.name]: value
    });
  };

  const handleCreditLimitReset = () => {
    if (initialCreditLimitData) {
      setCreditLimitData(initialCreditLimitData);
      setCreditLimitError('');
      toast.info('Credit limit settings reset to saved values');
    }
  };

  const handleCreditLimitSubmit = async (e) => {
    e.preventDefault();

    if (creditLimitError) {
      toast.error('Please fix validation errors before saving');
      return;
    }

    if (!creditLimitData.reason || creditLimitData.reason.length < 5) {
      toast.error('Please provide a reason for this configuration change (min 5 characters)');
      return;
    }

    // Backup validation
    if (creditLimitData.customer_credit_limit && parseFloat(creditLimitData.customer_credit_limit) < 3000) {
      toast.error('Customer credit limit cannot be below $3,000');
      return;
    }

    const payload = {
      customer_credit_limit: creditLimitData.customer_credit_limit ? parseFloat(creditLimitData.customer_credit_limit) : null,
      enforce_credit_limit: true,
      // Preserve other section values
      default_monthly_interest_rate: config?.default_monthly_interest_rate || 0,
      min_interest_rate: config?.min_interest_rate || 0,
      max_interest_rate: config?.max_interest_rate || 0,
      min_loan_amount: config?.min_loan_amount || 10.0,
      max_loan_amount: config?.max_loan_amount || 10000.0,
      max_active_loans_per_customer: config?.max_active_loans_per_customer || 8,
      reason: creditLimitData.reason,
      section_updated: "credit_limit"
    };

    try {
      setSavingCreditLimit(true);
      const savedConfig = await businessConfigService.createFinancialPolicyConfig(payload);
      toast.success('Credit limit settings saved successfully');
      setConfig(savedConfig);
      const updatedData = {
        customer_credit_limit: savedConfig.customer_credit_limit || 3000,
        reason: ''
      };
      setCreditLimitData(updatedData);
      setInitialCreditLimitData(updatedData);
      setCreditLimitError('');
    } catch (error) {
      console.error('Error saving credit limit settings:', error);
      toast.error(error.detail || 'Failed to save credit limit settings');
    } finally {
      setSavingCreditLimit(false);
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
    <div className="space-y-6">
      {/* Interest Rate Settings Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
            <div>
              <CardTitle>Interest Rate Settings (Percentage-Based)</CardTitle>
              <CardDescription>Configure default and allowable interest rate ranges</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInterestRateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="default_monthly_interest_rate">Default Monthly Interest Rate (%) *</Label>
                <Input
                  id="default_monthly_interest_rate"
                  name="default_monthly_interest_rate"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={interestRateData.default_monthly_interest_rate}
                  onChange={handleInterestRateChange}
                  placeholder="e.g., 10.0"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Percentage of loan amount per month</p>
              </div>
              <div>
                <Label htmlFor="min_interest_rate">Minimum Interest Rate (%)</Label>
                <Input
                  id="min_interest_rate"
                  name="min_interest_rate"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={interestRateData.min_interest_rate}
                  onChange={handleInterestRateChange}
                  placeholder="e.g., 2.0"
                />
                <p className="text-xs text-slate-500 mt-1">Minimum allowed percentage</p>
              </div>
              <div>
                <Label htmlFor="max_interest_rate">Maximum Interest Rate (%) *</Label>
                <Input
                  id="max_interest_rate"
                  name="max_interest_rate"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={interestRateData.max_interest_rate}
                  onChange={handleInterestRateChange}
                  placeholder="e.g., 25.0"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Maximum allowed percentage</p>
              </div>
            </div>

            <div>
              <Label htmlFor="interest_rate_reason">Reason for Change *</Label>
              <Textarea
                id="interest_rate_reason"
                name="reason"
                value={interestRateData.reason}
                onChange={handleInterestRateChange}
                placeholder="Explain why you are updating interest rate settings..."
                rows={3}
                required
                className="resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">Minimum 5 characters required</p>
            </div>

            {config && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {config.interest_rates_updated_at ? (
                  <>Last updated: {formatBusinessDateTime(config.interest_rates_updated_at)} by {config.updated_by}</>
                ) : (
                  <>Last updated: {formatBusinessDateTime(config.updated_at)} by {config.updated_by}</>
                )}
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              {hasInterestRateChanges && (
                <div className="text-sm text-amber-600 dark:text-amber-500 font-medium">
                  ⚠️ You have unsaved changes
                </div>
              )}
              {!hasInterestRateChanges && <div></div>}
              <div className="flex gap-2 md:ml-auto">
                {hasInterestRateChanges && (
                  <Button type="button" variant="outline" onClick={handleInterestRateReset}>
                    Reset
                  </Button>
                )}
                <Button type="submit" disabled={savingInterestRates || !hasInterestRateChanges}>
                  {savingInterestRates ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Interest Rate Settings'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Loan Limit Settings Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <CardTitle>Loan Limit Settings</CardTitle>
              <CardDescription>Configure maximum active loans per customer</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLoanLimitSubmit} className="space-y-4">
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
                value={loanLimitData.max_active_loans_per_customer}
                onChange={handleLoanLimitChange}
                className={loanLimitError ? 'border-red-500' : ''}
              />
              {loanLimitError && (
                <p className="text-xs text-red-600 mt-1 font-medium">
                  ⚠️ {loanLimitError}
                </p>
              )}
              {!loanLimitError && (
                <p className="text-xs text-slate-500 mt-1">
                  Minimum 8 required.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="loan_limit_reason">Reason for Change *</Label>
              <Textarea
                id="loan_limit_reason"
                name="reason"
                value={loanLimitData.reason}
                onChange={handleLoanLimitChange}
                placeholder="Explain why you are updating loan limit settings..."
                rows={3}
                required
                className="resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">Minimum 5 characters required</p>
            </div>

            {config && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {config.loan_limit_updated_at ? (
                  <>Last updated: {formatBusinessDateTime(config.loan_limit_updated_at)} by {config.updated_by}</>
                ) : (
                  <>Last updated: {formatBusinessDateTime(config.updated_at)} by {config.updated_by}</>
                )}
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              {hasLoanLimitChanges && (
                <div className="text-sm text-amber-600 dark:text-amber-500 font-medium">
                  ⚠️ You have unsaved changes
                </div>
              )}
              {!hasLoanLimitChanges && <div></div>}
              <div className="flex gap-2 md:ml-auto">
                {hasLoanLimitChanges && (
                  <Button type="button" variant="outline" onClick={handleLoanLimitReset}>
                    Reset
                  </Button>
                )}
                <Button type="submit" disabled={savingLoanLimit || loanLimitError || !hasLoanLimitChanges}>
                  {savingLoanLimit ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Loan Limit Settings'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Credit Limit Settings Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <DollarSign className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <div>
              <CardTitle>Credit Limit Settings</CardTitle>
              <CardDescription>Configure default customer credit limits</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreditLimitSubmit} className="space-y-4">
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
                value={creditLimitData.customer_credit_limit}
                onChange={handleCreditLimitChange}
                className={creditLimitError ? 'border-red-500' : ''}
              />
              {creditLimitError && (
                <p className="text-xs text-red-600 mt-1 font-medium">
                  ⚠️ {creditLimitError}
                </p>
              )}
              {!creditLimitError && (
                <p className="text-xs text-slate-500 mt-1">
                  Minimum $3,000 required.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="credit_limit_reason">Reason for Change *</Label>
              <Textarea
                id="credit_limit_reason"
                name="reason"
                value={creditLimitData.reason}
                onChange={handleCreditLimitChange}
                placeholder="Explain why you are updating credit limit settings..."
                rows={3}
                required
                className="resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">Minimum 5 characters required</p>
            </div>

            {config && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {config.credit_limit_updated_at ? (
                  <>Last updated: {formatBusinessDateTime(config.credit_limit_updated_at)} by {config.updated_by}</>
                ) : (
                  <>Last updated: {formatBusinessDateTime(config.updated_at)} by {config.updated_by}</>
                )}
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              {hasCreditLimitChanges && (
                <div className="text-sm text-amber-600 dark:text-amber-500 font-medium">
                  ⚠️ You have unsaved changes
                </div>
              )}
              {!hasCreditLimitChanges && <div></div>}
              <div className="flex gap-2 md:ml-auto">
                {hasCreditLimitChanges && (
                  <Button type="button" variant="outline" onClick={handleCreditLimitReset}>
                    Reset
                  </Button>
                )}
                <Button type="submit" disabled={savingCreditLimit || creditLimitError || !hasCreditLimitChanges}>
                  {savingCreditLimit ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Credit Limit Settings'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialPolicyConfig;
