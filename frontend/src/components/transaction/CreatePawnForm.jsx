import React, { useState, useEffect } from 'react';
import { Plus, Minus, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import transactionService from '../../services/transactionService';
import customerService from '../../services/customerService';

const CreatePawnForm = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    customer_id: '',
    loan_amount: '',
    monthly_interest_amount: '',
    storage_location: '',
    internal_notes: '',
    items: [
      { description: '', serial_number: '' }
    ]
  });
  
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [eligibilityData, setEligibilityData] = useState(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  // Load customers on mount
  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const response = await customerService.getAllCustomers({ page_size: 100 });
      setCustomers(response.customers || []);
    } catch (err) {
      console.error('Error loading customers:', err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const checkLoanEligibility = async (customerId, loanAmount) => {
    if (!customerId || !loanAmount) return;
    
    try {
      setCheckingEligibility(true);
      setError(null);
      
      const eligibility = await customerService.checkLoanEligibility(customerId, parseFloat(loanAmount));
      
      // Debug logging
      console.log('Loan Eligibility Check:', {
        customerId,
        loanAmount: parseFloat(loanAmount),
        eligible: eligibility.eligible,
        creditLimit: eligibility.credit_limit,
        availableCredit: eligibility.available_credit,
        activeLoans: eligibility.active_loans,
        reasons: eligibility.reasons
      });
      
      setEligibilityData(eligibility);
      
      if (!eligibility.eligible) {
        setError(`Loan not approved: ${eligibility.reasons?.join(', ') || 'Credit limit exceeded'}`);
      }
    } catch (err) {
      console.error('Error checking loan eligibility:', err);
      setError('Failed to check loan eligibility');
      setEligibilityData(null);
    } finally {
      setCheckingEligibility(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
    
    // Handle customer selection
    if (field === 'customer_id') {
      const customer = customers.find(c => c.phone_number === value);
      setSelectedCustomer(customer);
      setEligibilityData(null);
      
      // If we have both customer and loan amount, check eligibility
      if (value && formData.loan_amount) {
        checkLoanEligibility(value, formData.loan_amount);
      }
    }
    
    // Handle loan amount change
    if (field === 'loan_amount') {
      setEligibilityData(null);
      
      // If we have both customer and loan amount, check eligibility
      if (formData.customer_id && value) {
        checkLoanEligibility(formData.customer_id, value);
      }
    }
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', serial_number: '' }]
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  const validateForm = () => {
    if (!formData.customer_id) {
      setError('Please select a customer');
      return false;
    }
    
    if (!formData.loan_amount || parseFloat(formData.loan_amount) <= 0) {
      setError('Loan amount must be greater than 0');
      return false;
    }
    
    if (!formData.monthly_interest_amount || parseFloat(formData.monthly_interest_amount) < 0) {
      setError('Monthly interest amount must be 0 or greater');
      return false;
    }
    
    // SECURITY: Validate credit limit compliance
    if (!eligibilityData && formData.customer_id && formData.loan_amount) {
      setError('Checking loan eligibility... Please wait and try again.');
      // Trigger eligibility check if not done
      checkLoanEligibility(formData.customer_id, formData.loan_amount);
      return false;
    }
    
    if (eligibilityData && !eligibilityData.eligible) {
      setError(`Loan not approved: ${eligibilityData.reasons?.join(', ') || 'Credit limit exceeded'}`);
      return false;
    }
    
    // Additional check: ensure loan amount doesn't exceed available credit
    if (eligibilityData && formData.loan_amount) {
      const loanAmount = parseFloat(formData.loan_amount);
      const availableCredit = eligibilityData.available_credit || 0;
      
      if (loanAmount > availableCredit) {
        setError(`Loan amount $${loanAmount.toFixed(2)} exceeds available credit of $${availableCredit.toFixed(2)}`);
        return false;
      }
    }
    
    // Storage location is now optional - no validation needed
    
    // Validate items
    for (let i = 0; i < formData.items.length; i++) {
      if (!formData.items[i].description?.trim()) {
        setError(`Item ${i + 1} description is required`);
        return false;
      }
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

      // Convert amounts to integers (dollars)
      const transactionData = {
        customer_id: formData.customer_id,
        loan_amount: Math.round(parseFloat(formData.loan_amount)),
        monthly_interest_amount: Math.round(parseFloat(formData.monthly_interest_amount)),
        storage_location: formData.storage_location?.trim() || "TBD",
        internal_notes: formData.internal_notes.trim() || null,
        items: formData.items.map(item => ({
          description: item.description.trim(),
          serial_number: item.serial_number?.trim() || null
        }))
      };

      const result = await transactionService.createTransaction(transactionData);
      
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      console.error('Error creating transaction:', err);
      
      // Check for specific credit limit error
      if (err.message?.includes('Credit limit exceeded') || 
          err.message?.includes('Loan not approved') ||
          err.message?.includes('exceeds available credit')) {
        // Re-check eligibility to get latest available credit
        if (formData.customer_id && formData.loan_amount) {
          await checkLoanEligibility(formData.customer_id, formData.loan_amount);
        }
      }
      
      setError(err.message || 'Failed to create transaction');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Create New Pawn Transaction</CardTitle>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Selection */}
          <div className="space-y-2">
            <Label htmlFor="customer">Customer *</Label>
            <Select value={formData.customer_id} onValueChange={(value) => handleInputChange('customer_id', value)}>
              <SelectTrigger>
                <SelectValue placeholder={loadingCustomers ? "Loading customers..." : "Select a customer"} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.phone_number} value={customer.phone_number}>
                    {customer.first_name} {customer.last_name} ({customer.phone_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer Credit Limit Status */}
          {selectedCustomer && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-blue-900">Credit Limit Information</h4>
                  <p className="text-sm text-blue-700">
                    {selectedCustomer.first_name} {selectedCustomer.last_name} 
                    {eligibilityData ? (
                      ` • Credit Limit: $${eligibilityData.credit_limit?.toLocaleString()}`
                    ) : (
                      ' • Checking credit limit...'
                    )}
                  </p>
                </div>
                {checkingEligibility && (
                  <div className="text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>
              
              {eligibilityData && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-700">Available Credit:</span>
                    <span className={`font-medium ${
                      eligibilityData.available_credit > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${eligibilityData.available_credit?.toLocaleString()}
                    </span>
                  </div>
                  {formData.loan_amount && !checkingEligibility && (
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-blue-700">Loan Amount:</span>
                      <span className={`font-medium ${
                        eligibilityData.eligible && parseFloat(formData.loan_amount) <= eligibilityData.available_credit
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        ${parseFloat(formData.loan_amount || 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Financial Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loan_amount">Loan Amount ($) *</Label>
              <Input
                id="loan_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.loan_amount}
                onChange={(e) => handleInputChange('loan_amount', e.target.value)}
                placeholder="0.00"
                className={
                  formData.loan_amount && eligibilityData && !eligibilityData.eligible 
                    ? 'border-red-500 focus:border-red-500' 
                    : ''
                }
              />
              {formData.loan_amount && eligibilityData && !checkingEligibility && (
                <div className="flex items-center text-xs mt-1">
                  {eligibilityData.eligible && parseFloat(formData.loan_amount) <= eligibilityData.available_credit ? (
                    <span className="text-green-600">✓ Within credit limit</span>
                  ) : (
                    <span className="text-red-600">✗ Exceeds available credit</span>
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="monthly_interest">Monthly Interest ($) *</Label>
              <Input
                id="monthly_interest"
                type="number"
                step="0.01"
                min="0"
                value={formData.monthly_interest_amount}
                onChange={(e) => handleInputChange('monthly_interest_amount', e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Storage Location */}
          <div className="space-y-2">
            <Label htmlFor="storage_location">Storage Location</Label>
            <Input
              id="storage_location"
              value={formData.storage_location}
              onChange={(e) => handleInputChange('storage_location', e.target.value)}
              placeholder="Optional: e.g., Shelf A-1, Box 42"
            />
          </div>

          {/* Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Items *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
            
            {formData.items.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Item {index + 1}</span>
                  {formData.items.length > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => removeItem(index)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor={`item_desc_${index}`}>Description *</Label>
                    <Input
                      id={`item_desc_${index}`}
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      placeholder="e.g., Gold Ring, iPhone 12"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor={`item_serial_${index}`}>Serial Number</Label>
                    <Input
                      id={`item_serial_${index}`}
                      value={item.serial_number}
                      onChange={(e) => handleItemChange(index, 'serial_number', e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>
            ))}
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
              disabled={
                submitting || 
                loadingCustomers || 
                checkingEligibility || 
                (eligibilityData && !eligibilityData.eligible)
              }
              className={
                eligibilityData && !eligibilityData.eligible 
                  ? 'bg-red-600 hover:bg-red-700 cursor-not-allowed' 
                  : ''
              }
            >
              {submitting ? 'Creating...' : 
               checkingEligibility ? 'Checking Eligibility...' :
               eligibilityData && !eligibilityData.eligible ? 'Credit Limit Exceeded' :
               'Create Transaction'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreatePawnForm;