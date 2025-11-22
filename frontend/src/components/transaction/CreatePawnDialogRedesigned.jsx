import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, User, Package, DollarSign, FileText, Clock,
  Plus, X, CheckCircle, AlertCircle,
  Calculator, CreditCard, ArrowRight, ArrowLeft, Barcode
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Separator } from '../ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import transactionService from '../../services/transactionService';
import customerService from '../../services/customerService';
import businessConfigService from '../../services/businessConfigService';
import { formatStorageLocation } from '../../utils/transactionUtils';
import { useFormValidation, validateRequired, validateAmount, createValidationResult } from '../../utils/formValidation';
import { handleError, handleSuccess } from '../../utils/errorHandling';
import { useDebounce } from '../../hooks/useDebounce';
import ConfirmationDialog from '../common/ConfirmationDialog';
import LoadingDialog from '../common/LoadingDialog';
import CustomerDialog from '../customer/CustomerDialog';
import { DualReceiptPrint } from '../receipt/DualReceiptPrint';


const CreatePawnDialogRedesigned = ({ onSuccess, onCancel, prefilledCustomer = null }) => {
  // Current active tab
  const [activeTab, setActiveTab] = useState('customer');
  const [completedTabs, setCompletedTabs] = useState(new Set());

  // Form validation setup
  const formValidators = {
    customer_id: (value) => validateRequired(value, 'Customer'),
    loan_amount: (value) => validateAmount(value, 'Loan amount', { min: 1, max: 50000 }),
    monthly_interest_amount: (value) => validateAmount(value, 'Monthly interest', { min: 0, allowZero: true }),
    transaction_type: (value) => validateRequired(value, 'Transaction Type'),
    items: (items) => {
      // Filter out blank items - only validate items with descriptions
      const filledItems = (items || []).filter(item => item.description && item.description.trim());

      if (filledItems.length === 0) {
        return createValidationResult(false, 'At least one item is required');
      }

      return createValidationResult(true);
    },
    reference_barcode: (value, allData) => {
      // Reference barcode is now optional for all transaction types
      const trimmedValue = (value || '').trim();

      if (!trimmedValue) {
        return createValidationResult(true); // Optional field
      }

      if (trimmedValue.length > 100) {
        return createValidationResult(false, 'Reference Barcode must be 100 characters or less');
      }

      // Match backend validation pattern - alphanumeric, hyphens, underscores only
      if (!/^[A-Za-z0-9\-_]+$/.test(trimmedValue)) {
        return createValidationResult(
          false,
          'Reference Barcode can only contain letters, numbers, hyphens, and underscores'
        );
      }

      return createValidationResult(true);
    }
  };

  const {
    data: formData,
    updateField,
    updateFields,
    validateAll,
    getFieldError,
    isFormValid,
    clearFieldError
  } = useFormValidation({
    customer_id: '',
    loan_amount: '',
    monthly_interest_amount: '',
    storage_location: '',
    internal_notes: '',
    transaction_type: '',
    reference_barcode: '',
    items: [{
      description: '',
      serial_number: ''
    }]
  }, formValidators);

  // State management
  const [customers, setCustomers] = useState([]);
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [eligibilityData, setEligibilityData] = useState(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [prefilledCustomerData, setPrefilledCustomerData] = useState(null);
  const debouncedSearchTerm = useDebounce(customerSearchTerm, 300);

  // Receipt printing state
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [createdTransaction, setCreatedTransaction] = useState(null);

  // Financial policy state for validation
  const [financialPolicy, setFinancialPolicy] = useState(null);
  const [interestRateError, setInterestRateError] = useState(null);

  // Ref to track last auto-calculated interest to prevent overwriting manual edits
  const lastAutoCalculatedInterest = useRef(null);

  // Refs for items scrolling
  const itemsContainerRef = useRef(null);
  const itemRefs = useRef([]);

  // Load customers on mount
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const response = await customerService.getAllCustomers({ page_size: 100 });
        const allCustomers = response.customers || [];
        setCustomers(allCustomers);
        
        // Get recent customers (last 30 days transactions)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recent = allCustomers
          .filter(customer => customer.last_transaction_date && new Date(customer.last_transaction_date) > thirtyDaysAgo)
          .sort((a, b) => new Date(b.last_transaction_date) - new Date(a.last_transaction_date))
          .slice(0, 3);
        
        setRecentCustomers(recent);
      } catch (err) {
        handleError(err, 'Loading customers');
      }
    };

    loadCustomers();
  }, []);

  // Handle prefilled customer
  useEffect(() => {
    if (prefilledCustomer) {
      updateField('customer_id', prefilledCustomer.phone_number);
      setSelectedCustomer(prefilledCustomer);
      setCompletedTabs(prev => new Set([...prev, 'customer']));
      // Skip to items tab since customer is already selected
      setActiveTab('items');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledCustomer]);

  // Load financial policy on mount and store for validation
  useEffect(() => {
    const loadPolicy = async () => {
      try {
        const policy = await businessConfigService.getFinancialPolicyConfig();
        setFinancialPolicy(policy);
      } catch (error) {
        console.error('Failed to load financial policy:', error);
      }
    };
    loadPolicy();
  }, []);

  // Auto-populate interest when loan amount changes
  useEffect(() => {
    // Only proceed if we have a loan amount
    if (!formData.loan_amount) {
      lastAutoCalculatedInterest.current = null;
      return;
    }

    const loanAmount = parseFloat(formData.loan_amount);
    if (loanAmount <= 0) {
      return;
    }

    // Calculate what the interest should be
    let calculatedInterest;
    if (financialPolicy?.default_monthly_interest_rate) {
      const defaultRate = financialPolicy.default_monthly_interest_rate;
      calculatedInterest = Math.round(loanAmount * (defaultRate / 100));
    } else {
      // Fallback to 15% if policy not loaded yet
      calculatedInterest = Math.round(loanAmount * 0.15);
    }

    // Only auto-update if:
    // 1. Current interest is empty, OR
    // 2. Current interest matches our last auto-calculated value (hasn't been manually edited)
    const currentInterest = parseFloat(formData.monthly_interest_amount) || 0;
    const isManuallyEdited = currentInterest !== 0 &&
                             currentInterest !== lastAutoCalculatedInterest.current;

    if (!isManuallyEdited && calculatedInterest !== currentInterest) {
      lastAutoCalculatedInterest.current = calculatedInterest;
      updateField('monthly_interest_amount', calculatedInterest.toString());
    } else if (!isManuallyEdited) {
      // Update tracking even if we don't change the value
      lastAutoCalculatedInterest.current = calculatedInterest;
    }
  }, [formData.loan_amount, financialPolicy, formData.monthly_interest_amount, updateField]);

  // Validate interest rate in real-time
  useEffect(() => {
    if (!formData.loan_amount || !formData.monthly_interest_amount || !financialPolicy) {
      setInterestRateError(null);
      return;
    }

    const loanAmount = parseFloat(formData.loan_amount);
    const interestAmount = parseFloat(formData.monthly_interest_amount);

    if (loanAmount > 0 && interestAmount >= 0) {
      const percentage = (interestAmount / loanAmount) * 100;

      if (percentage < financialPolicy.min_interest_rate) {
        setInterestRateError(
          `Interest rate ${percentage.toFixed(1)}% is below minimum ${financialPolicy.min_interest_rate}%`
        );
      } else if (percentage > financialPolicy.max_interest_rate) {
        setInterestRateError(
          `Interest rate ${percentage.toFixed(1)}% exceeds maximum ${financialPolicy.max_interest_rate}%`
        );
      } else {
        setInterestRateError(null);
      }
    }
  }, [formData.loan_amount, formData.monthly_interest_amount, financialPolicy]);

  // Filtered customers for search
  const filteredCustomers = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return [];
    
    const searchLower = debouncedSearchTerm.toLowerCase();
    return customers.filter(customer => 
      customer.phone_number.includes(debouncedSearchTerm) ||
      `${customer.first_name} ${customer.last_name}`.toLowerCase().includes(searchLower) ||
      customer.first_name.toLowerCase().includes(searchLower) ||
      customer.last_name.toLowerCase().includes(searchLower)
    ).slice(0, 8);
  }, [debouncedSearchTerm, customers]);

  // Real-time loan calculations
  const loanCalculations = useMemo(() => {
    const loanAmount = parseFloat(formData.loan_amount) || 0;
    const monthlyInterest = parseFloat(formData.monthly_interest_amount) || 0;
    
    // Calculate maturity date (3 months from today)
    const calculateMaturityDate = () => {
      const today = new Date();
      let year = today.getFullYear();
      let month = today.getMonth() + 3; // Add 3 months
      
      // Handle year overflow
      if (month > 11) {
        year += Math.floor(month / 12);
        month = month % 12;
      }
      
      const maturityDate = new Date(year, month, today.getDate());
      
      // Format the date for display
      return maturityDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };
    
    return {
      loanAmount,
      monthlyInterest,
      totalWithInterest: loanAmount + monthlyInterest,
      maturityDate: calculateMaturityDate()
    };
  }, [formData.loan_amount, formData.monthly_interest_amount]);

  // Check loan eligibility
  const checkLoanEligibility = useCallback(async (customerId, loanAmount) => {
    if (!customerId || !loanAmount) return;
    
    try {
      setCheckingEligibility(true);
      const eligibility = await customerService.checkLoanEligibility(customerId, parseFloat(loanAmount));
      setEligibilityData(eligibility);
    } catch (err) {
      handleError(err, 'Checking loan eligibility');
      setEligibilityData(null);
    } finally {
      setCheckingEligibility(false);
    }
  }, []);

  // Handle customer selection
  const handleCustomerSelect = useCallback((customer) => {
    updateField('customer_id', customer.phone_number);
    setSelectedCustomer(customer);
    setCustomerSearchTerm('');
    setShowCustomerSearch(false);
    setEligibilityData(null);
    
    // Mark customer tab as completed
    setCompletedTabs(prev => new Set([...prev, 'customer']));
    
    // Check eligibility if loan amount is set
    if (formData.loan_amount) {
      checkLoanEligibility(customer.phone_number, formData.loan_amount);
    }
  }, [updateField, formData.loan_amount, checkLoanEligibility]);

  // Parse search term to prefill new customer form
  const parseSearchTermForCustomer = useCallback(() => {
    const searchTerm = customerSearchTerm.trim();
    if (!searchTerm) return null;

    const prefilledData = {
      phone_number: '',
      first_name: '',
      last_name: '',
      email: '',
      status: 'active',
      notes: ''
    };

    // Check if search term is a phone number (10 digits)
    if (/^\d{10}$/.test(searchTerm)) {
      prefilledData.phone_number = searchTerm;
    }
    // Check if search term looks like a phone number with formatting
    else if (/^\d{3}[\s-]?\d{3}[\s-]?\d{4}$/.test(searchTerm)) {
      prefilledData.phone_number = searchTerm.replace(/\D/g, '');
    }
    // If it's text, try to parse as name
    else {
      const nameParts = searchTerm.split(/\s+/);
      if (nameParts.length >= 1) {
        prefilledData.first_name = nameParts[0];
      }
      if (nameParts.length >= 2) {
        prefilledData.last_name = nameParts.slice(1).join(' ');
      }
    }

    return prefilledData;
  }, [customerSearchTerm]);

  // Handle opening new customer form with prefilled data
  const handleOpenNewCustomerForm = useCallback(() => {
    const parsedData = parseSearchTermForCustomer();
    setPrefilledCustomerData(parsedData);
    setShowNewCustomerForm(true);
  }, [parseSearchTermForCustomer]);

  // Handle tab changes with validation
  const handleTabChange = useCallback((newTab) => {
    const tabs = ['customer', 'items', 'loan', 'review'];
    const currentIndex = tabs.indexOf(activeTab);
    const newIndex = tabs.indexOf(newTab);
    const isMovingForward = newIndex > currentIndex;

    // Only validate when moving FORWARD away from a completed section
    if (isMovingForward) {
      // Validate customer tab when leaving it
      if (activeTab === 'customer') {
        if (!formData.customer_id) {
          handleError({ message: 'Please select a customer first' }, 'Tab validation');
          return;
        }
      }

      // Validate items tab when leaving it
      if (activeTab === 'items') {
        if (!formData.items.some(item => item.description.trim())) {
          handleError({ message: 'Please add at least one item' }, 'Tab validation');
          return;
        }
      }

      // Validate loan tab when leaving it (moving to review)
      if (activeTab === 'loan') {
        if (!formData.loan_amount || !formData.monthly_interest_amount) {
          handleError({ message: 'Please complete loan details' }, 'Tab validation');
          return;
        }
        if (!formData.transaction_type) {
          handleError({ message: 'Please select a transaction type' }, 'Tab validation');
          return;
        }
        if (interestRateError) {
          handleError({ message: interestRateError }, 'Interest rate validation');
          return;
        }
        // Check eligibility
        if (eligibilityData && !eligibilityData.eligible) {
          handleError({ message: 'Customer does not meet loan eligibility requirements' }, 'Eligibility validation');
          return;
        }
      }
    }

    // Prevent navigating to review tab if there are validation errors (regardless of direction)
    if (newTab === 'review') {
      if (!formData.customer_id) {
        handleError({ message: 'Please select a customer first' }, 'Review validation');
        return;
      }
      if (!formData.items.some(item => item.description.trim())) {
        handleError({ message: 'Please add at least one item' }, 'Review validation');
        return;
      }
      if (!formData.loan_amount || !formData.monthly_interest_amount) {
        handleError({ message: 'Please complete loan details first' }, 'Review validation');
        return;
      }
      if (!formData.transaction_type) {
        handleError({ message: 'Please select a transaction type' }, 'Review validation');
        return;
      }
      if (interestRateError) {
        handleError({ message: interestRateError }, 'Interest rate validation');
        return;
      }
      if (eligibilityData && !eligibilityData.eligible) {
        handleError({ message: 'Customer exceeds credit limit or loan slots' }, 'Eligibility validation');
        return;
      }
    }

    setActiveTab(newTab);

    // Mark tabs as completed when moving forward past them
    if (isMovingForward) {
      setCompletedTabs(prev => new Set([...prev, activeTab]));
    }
  }, [activeTab, formData, interestRateError, eligibilityData]);

  // Handle item changes
  const handleItemChange = useCallback((index, field, value) => {
    // Convert description and serial_number to uppercase
    const processedValue = (field === 'description' || field === 'serial_number')
      ? value.toUpperCase()
      : value;

    const newItems = formData.items.map((item, i) =>
      i === index ? { ...item, [field]: processedValue } : item
    );
    updateField('items', newItems);
  }, [formData.items, updateField]);

  const addItem = useCallback(() => {
    if (formData.items.length < 8) {
      const newItems = [...formData.items, {
        description: '',
        serial_number: ''
      }];
      updateField('items', newItems);

      // Scroll to the new item after it's added
      setTimeout(() => {
        const newIndex = newItems.length - 1;
        if (itemRefs.current[newIndex]) {
          itemRefs.current[newIndex].scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
          // Focus the description input
          const descInput = itemRefs.current[newIndex].querySelector('input');
          if (descInput) descInput.focus();
        }
      }, 100);
    }
  }, [formData.items, updateField]);

  const removeItem = useCallback((index) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      updateField('items', newItems);
    }
  }, [formData.items, updateField]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!validateAll()) return;

    if (eligibilityData && !eligibilityData.eligible) {
      handleError({ message: 'Customer exceeds credit limit' }, 'Eligibility check');
      return;
    }

    if (interestRateError) {
      handleError({ message: interestRateError }, 'Interest rate validation');
      return;
    }

    setShowConfirmation(true);
  }, [validateAll, eligibilityData, interestRateError]);

  const processTransaction = useCallback(async () => {
    try {
      setSubmitting(true);

      const transactionData = {
        customer_id: formData.customer_id,
        loan_amount: Math.round(parseFloat(formData.loan_amount)),
        monthly_interest_amount: Math.round(parseFloat(formData.monthly_interest_amount)),
        storage_location: formData.storage_location?.trim() || "TBD",
        internal_notes: formData.internal_notes.trim() || null,
        transaction_type: formData.transaction_type || 'New Entry',
        reference_barcode: formData.transaction_type === 'Imported' ? (formData.reference_barcode?.trim() || null) : null,
        items: formData.items
          .filter(item => item.description.trim()) // Only include items with descriptions
          .map(item => ({
            description: item.description.trim(),
            serial_number: item.serial_number?.trim() || null
          }))
      };

      let result;

      // REAL-TIME FIX: Use optimistic transaction creation if available
      if (window.TransactionListOptimistic?.createTransaction) {
        result = await window.TransactionListOptimistic.createTransaction(transactionData);
      } else {
        // Fallback to direct API call
        result = await transactionService.createTransaction(transactionData);
        handleSuccess(`Transaction #${result.formatted_id || result.transaction_id} created successfully`);
      }

      // Store the created transaction for printing
      setCreatedTransaction(result);

      // Show print dialog after successful creation
      setShowPrintDialog(true);

      // DO NOT call onSuccess here - wait until print dialog is closed
      // This prevents the parent component from closing before the print dialog is shown

    } catch (err) {
      console.error('❌ TRANSACTION CREATION FAILED:', err);
      handleError(err, 'Creating transaction');
    } finally {
      setSubmitting(false);
      setShowConfirmation(false);
    }
  }, [formData]);

  // Tab completion status
  const getTabStatus = useCallback((tab) => {
    if (completedTabs.has(tab)) return 'completed';
    if (tab === activeTab) return 'current';
    return 'pending';
  }, [completedTabs, activeTab]);

  return (
    <TooltipProvider>
      <Card className="w-full max-w-4xl mx-auto bg-pawn-light dark:bg-pawn-dark backdrop-blur-xl border border-pawn-medium/20 dark:border-pawn-medium/40 shadow-2xl">
        <CardHeader className="border-b border-pawn-medium/20 dark:border-pawn-medium/40 bg-pawn-light dark:bg-pawn-medium/20">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-pawn-accent text-white shadow-lg">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <div className="text-pawn-dark dark:text-pawn-light text-xl font-bold">Create Pawn Transaction</div>
                <div className="text-sm font-normal text-pawn-medium dark:text-pawn-light/80">Secure loan processing system</div>
              </div>
            </CardTitle>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>

      <CardContent className="p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          {/* Enhanced Tab Navigation */}
          <TabsList className="grid w-full grid-cols-4 mb-6 bg-pawn-light dark:bg-pawn-medium p-1 rounded-xl">
            <TabsTrigger 
              value="customer" 
              className="flex items-center justify-center space-x-2 data-[state=active]:bg-pawn-accent data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-200"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Customer</span>
              {getTabStatus('customer') === 'completed' && (
                <CheckCircle className="w-3 h-3 text-green-500" />
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="items" 
              className="flex items-center justify-center space-x-2 data-[state=active]:bg-pawn-accent data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-200"
            >
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Items</span>
              {getTabStatus('items') === 'completed' && (
                <CheckCircle className="w-3 h-3 text-green-500" />
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="loan" 
              className="flex items-center justify-center space-x-2 data-[state=active]:bg-pawn-accent data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-200"
            >
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">Loan</span>
              {getTabStatus('loan') === 'completed' && (
                <CheckCircle className="w-3 h-3 text-green-500" />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="review"
              disabled={interestRateError || !formData.loan_amount || !formData.monthly_interest_amount || (eligibilityData && !eligibilityData.eligible)}
              className="flex items-center justify-center space-x-2 data-[state=active]:bg-pawn-accent data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Review</span>
            </TabsTrigger>
          </TabsList>

          {/* Customer Selection Tab */}
          <TabsContent value="customer" className="space-y-4 mt-0">
            {/* Step Header with Info Banner */}
            <div className="p-4 bg-pawn-light dark:bg-pawn-medium/30 rounded-xl border border-pawn-medium/20 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-pawn-dark dark:text-pawn-light flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Customer Selection
                </h3>
                <Badge variant="outline" className="border-pawn-accent text-pawn-accent">
                  Step 1 of 4
                </Badge>
              </div>
              <p className="text-sm text-pawn-medium dark:text-pawn-light/80">
                Start by selecting the customer for this pawn transaction. Use recent customers for quick access or search all customers.
              </p>
            </div>

            {/* Customer Search */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-pawn-accent" />
                <Label className="text-sm font-medium text-pawn-dark dark:text-pawn-light">Search All Customers</Label>
              </div>
              
              <div className="space-y-2 relative">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <Input
                    placeholder="Search by name or phone number..."
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                    onFocus={() => setShowCustomerSearch(true)}
                    onBlur={() => setTimeout(() => setShowCustomerSearch(false), 200)}
                    className="pl-10 pr-20 h-12"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={handleOpenNewCustomerForm}
                      className="bg-pawn-accent hover:bg-pawn-accent/90 text-white h-8 px-3 text-xs font-medium shadow-sm"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      New
                    </Button>
                    {customerSearchTerm && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCustomerSearchTerm('');
                          setShowCustomerSearch(false);
                        }}
                        className="h-6 w-6 p-0 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Search Results Dropdown */}
                {showCustomerSearch && filteredCustomers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer.phone_number}
                        type="button"
                        onClick={() => handleCustomerSelect(customer)}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-600 last:border-b-0 focus:bg-slate-50 dark:focus:bg-slate-700 focus:outline-none transition-colors"
                      >
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-pawn-accent/10 rounded-full flex items-center justify-center">
                            <User className="w-3 h-3 text-pawn-accent" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 uppercase">
                              {customerService.getCustomerFullName(customer)}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {customerService.formatPhoneNumber(customer.phone_number)}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* No Results Message */}
                {showCustomerSearch && customerSearchTerm.trim() && filteredCustomers.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3">
                    <div className="text-center text-slate-500 dark:text-slate-400">
                      <User className="w-6 h-6 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm mb-2">No customers found for "{customerSearchTerm}"</p>
                      <p className="text-xs mb-3">Try searching by name or phone number</p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleOpenNewCustomerForm}
                        className="bg-pawn-accent hover:bg-pawn-accent/90 text-white text-xs"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Create New Customer
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Customers Quick Access */}
            {recentCustomers.length > 0 && (
              <div className="space-y-3">
                <Separator className="my-4" />
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-pawn-accent" />
                  <Label className="text-sm font-medium text-pawn-dark dark:text-pawn-light">Recent Customers</Label>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {recentCustomers.map((customer) => (
                    <Button
                      key={customer.phone_number}
                      type="button"
                      variant="outline"
                      onClick={() => handleCustomerSelect(customer)}
                      className="h-auto p-4 justify-start hover:bg-pawn-accent/10 border-pawn-medium/20 dark:border-pawn-medium/40"
                    >
                      <div className="flex items-center space-x-3 w-full">
                        <div className="w-10 h-10 bg-pawn-accent/10 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-pawn-accent" />
                        </div>
                        <div className="text-left flex-1">
                          <div className="font-medium text-slate-900 dark:text-slate-100 uppercase">
                            {customerService.getCustomerFullName(customer)}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {customerService.formatPhoneNumber(customer.phone_number)}
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Customer Dialog */}
            <CustomerDialog
              open={showNewCustomerForm}
              onOpenChange={(isOpen) => {
                setShowNewCustomerForm(isOpen);
                if (!isOpen) {
                  setPrefilledCustomerData(null);
                }
              }}
              prefilledData={prefilledCustomerData}
              onSave={(newCustomer) => {
                // Add new customer to the list
                setCustomers(prev => [newCustomer, ...prev]);
                // Select the new customer
                handleCustomerSelect(newCustomer);
                // Close dialog and clear prefilled data
                setShowNewCustomerForm(false);
                setPrefilledCustomerData(null);
              }}
              onCancel={() => {
                setShowNewCustomerForm(false);
                setPrefilledCustomerData(null);
              }}
            />

            {/* Selected Customer Info */}
            {selectedCustomer && (
              <Card className="bg-pawn-light dark:bg-pawn-medium/20 border-pawn-medium/20 dark:border-pawn-medium/40 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-pawn-accent/10 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-pawn-accent" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-pawn-dark dark:text-pawn-light uppercase">
                            {customerService.getCustomerFullName(selectedCustomer)}
                          </span>
                          <CheckCircle className="w-4 h-4 text-pawn-accent" />
                        </div>
                        <div className="text-sm text-pawn-medium dark:text-pawn-light/80">
                          {customerService.formatPhoneNumber(selectedCustomer.phone_number)} • {selectedCustomer.status || 'Active'}
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => handleTabChange('items')}
                      className="bg-pawn-accent hover:bg-pawn-accent/90 text-white shadow-lg"
                    >
                      Next: Add Items
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                  
                  {/* Credit Status */}
                  {eligibilityData && (
                    <div className="mt-4 pt-3 border-t border-pawn-medium/20 dark:border-pawn-medium/40">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-pawn-medium dark:text-pawn-light/80">Credit Limit:</span>
                        <span className="font-medium text-pawn-dark dark:text-pawn-light">
                          ${eligibilityData.credit_limit?.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-pawn-medium dark:text-pawn-light/80">Available Credit:</span>
                        <span className={`font-medium ${
                          eligibilityData.available_credit > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ${eligibilityData.available_credit?.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items" className="space-y-4 mt-0">
            {/* Step Header */}
            <div className="p-4 bg-pawn-light dark:bg-pawn-medium/30 rounded-xl border border-pawn-medium/20 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-pawn-dark dark:text-pawn-light flex items-center">
                    <Package className="w-5 h-5 mr-2" />
                    Items Information
                  </h3>
                </div>
                <Badge variant="outline" className="border-pawn-accent text-pawn-accent">
                  Step 2 of 4
                </Badge>
              </div>
              <p className="text-sm text-pawn-medium dark:text-pawn-light/80">
                Add descriptions and serial numbers for items being pawned
              </p>
            </div>

            {/* Single Container for All Items */}
            <Card className="bg-pawn-light dark:bg-pawn-medium/20 border-pawn-medium/20 dark:border-pawn-medium/40 shadow-lg overflow-hidden">
              <CardHeader className="pb-2 border-b border-pawn-medium/20 dark:border-pawn-medium/40 bg-gradient-to-r from-pawn-light to-pawn-light/50 dark:from-pawn-medium/20 dark:to-pawn-medium/10">
                <div className="space-y-2">
                  {/* Title and Action Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-pawn-accent to-pawn-accent/80 rounded-lg flex items-center justify-center shadow-md">
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base text-pawn-dark dark:text-pawn-light">
                          Item Details
                        </CardTitle>
                        <Badge variant="outline" className="text-xs border-pawn-accent/30 text-pawn-accent">
                          {formData.items.length}/8 Slots
                        </Badge>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={addItem}
                      disabled={formData.items.length >= 8}
                      size="sm"
                      className="bg-pawn-accent hover:bg-pawn-accent/90 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Item
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Table Header */}
                <div className="bg-pawn-light dark:bg-pawn-medium/10 px-3 py-1.5 border-b border-pawn-medium/20 dark:border-pawn-medium/40">
                  <div className="grid grid-cols-12 gap-3 text-xs font-semibold text-pawn-dark dark:text-pawn-light uppercase tracking-wide">
                    <div className="col-span-1"></div>
                    <div className="col-span-7">Description</div>
                    <div className="col-span-3">Serial Number (Optional)</div>
                    <div className="col-span-1 text-center">Action</div>
                  </div>
                </div>

                {/* Items Rows */}
                <div className="divide-y divide-pawn-medium/10 dark:divide-pawn-medium/20" ref={itemsContainerRef}>
                  {formData.items.map((item, index) => {
                    const hasDescription = item.description.trim().length > 0;

                    return (
                      <div
                        key={index}
                        ref={(el) => (itemRefs.current[index] = el)}
                        className="px-3 py-2 hover:bg-pawn-accent/5 transition-colors"
                      >
                        <div className="grid grid-cols-12 gap-3 items-start">
                          {/* Item Number */}
                          <div className="col-span-1 flex items-start justify-center">
                            <div className="w-7 h-7 rounded-lg bg-pawn-accent/10 flex items-center justify-center">
                              <span className="text-xs font-bold text-pawn-accent">
                                {index + 1}
                              </span>
                            </div>
                          </div>

                          {/* Description Input with Character Count */}
                          <div className="col-span-7 space-y-1">
                            <div className="relative">
                              <Input
                                value={item.description}
                                onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                placeholder="Enter item description"
                                className="h-8 text-sm pr-12"
                                maxLength={50}
                              />
                              {hasDescription && (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                </div>
                              )}
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className={`${
                                hasDescription ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-400'
                              }`}>
                                {hasDescription ? '✓ Complete' : 'Required'}
                              </span>
                              <span className="text-slate-400">
                                {item.description.length}/50
                              </span>
                            </div>
                          </div>

                          {/* Serial Number Input with Character Count */}
                          <div className="col-span-3 space-y-1">
                            <Input
                              value={item.serial_number}
                              onChange={(e) => handleItemChange(index, 'serial_number', e.target.value)}
                              placeholder="Enter serial number"
                              className="h-8 text-sm font-mono"
                              maxLength={20}
                            />
                            <div className="flex justify-end text-xs text-slate-400">
                              <span>{item.serial_number.length}/20</span>
                            </div>
                          </div>

                          {/* Remove Button */}
                          <div className="col-span-1 flex items-start justify-center">
                            {formData.items.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(index)}
                                className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleTabChange('customer')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Customer
              </Button>
              <Button
                type="button"
                onClick={() => handleTabChange('loan')}
                disabled={!formData.items.some(item => item.description.trim())}
                className="bg-pawn-accent hover:bg-pawn-accent/90 text-white"
              >
                Next: Loan Details
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </TabsContent>

          {/* Loan Details Tab */}
          <TabsContent value="loan" className="space-y-4 mt-0">
            <div className="p-4 bg-pawn-light dark:bg-pawn-medium/30 rounded-xl border border-pawn-medium/20 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-pawn-dark dark:text-pawn-light flex items-center">
                  <Calculator className="w-5 h-5 mr-2" />
                  Loan Configuration
                </h3>
                <Badge variant="outline" className="border-pawn-accent text-pawn-accent">
                  Step 3 of 4
                </Badge>
              </div>
              <p className="text-sm text-pawn-medium dark:text-pawn-light/80">Configure loan amount and interest terms for this transaction</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Loan Settings */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="loan_amount" className="text-sm font-medium flex items-center">
                    Loan Amount ($) *
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-4 w-4 p-0 ml-1">
                            <AlertCircle className="h-3 w-3 text-slate-400" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Enter the amount you're lending to the customer</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="loan_amount"
                    type="number"
                    step="1"
                    min="1"
                    max="50000"
                    value={formData.loan_amount}
                    onChange={(e) => {
                      updateField('loan_amount', e.target.value);
                      if (selectedCustomer && e.target.value) {
                        checkLoanEligibility(selectedCustomer.phone_number, e.target.value);
                      }
                    }}
                    onInput={(e) => {
                      // Prevent decimal point entry
                      e.target.value = e.target.value.replace(/[.,]/g, '');
                    }}
                    placeholder="Whole dollars only"
                    className={getFieldError('loan_amount') ? 'border-red-500 focus:border-red-500 h-12 text-lg' : 'focus:ring-pawn-accent focus:border-pawn-accent h-12 text-lg font-medium'}
                  />
                  {getFieldError('loan_amount') && (
                    <div className="text-xs text-red-600 mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {getFieldError('loan_amount')}
                    </div>
                  )}
                  {selectedCustomer && eligibilityData && formData.loan_amount && (
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Available credit: ${eligibilityData.available_credit?.toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthly_interest_amount" className="text-sm font-medium flex items-center">
                    Monthly Interest ($) *
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-4 w-4 p-0 ml-1">
                            <AlertCircle className="h-3 w-3 text-slate-400" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Monthly interest amount charged on the loan</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="monthly_interest_amount"
                    type="number"
                    step="1"
                    min="0"
                    max="10000"
                    value={formData.monthly_interest_amount}
                    onChange={(e) => updateField('monthly_interest_amount', e.target.value)}
                    onInput={(e) => {
                      // Prevent decimal point entry
                      e.target.value = e.target.value.replace(/[.,]/g, '');
                    }}
                    placeholder="Whole dollars only"
                    className={getFieldError('monthly_interest_amount') || interestRateError ? 'border-red-500 focus:border-red-500 h-12 text-lg' : 'focus:ring-pawn-accent focus:border-pawn-accent h-12 text-lg font-medium'}
                  />
                  {getFieldError('monthly_interest_amount') && (
                    <div className="text-xs text-red-600 mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {getFieldError('monthly_interest_amount')}
                    </div>
                  )}
                  {interestRateError && (
                    <div className="text-xs text-red-600 mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {interestRateError}
                    </div>
                  )}
                  {formData.loan_amount && formData.monthly_interest_amount && !interestRateError && (
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Interest rate: {((parseFloat(formData.monthly_interest_amount) / parseFloat(formData.loan_amount)) * 100).toFixed(1)}% per month
                    </div>
                  )}
                </div>

                {/* Transaction Type */}
                <div className="space-y-2">
                  <Label htmlFor="transaction_type" className="text-sm font-medium flex items-center">
                    Transaction Type *
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-4 w-4 p-0 ml-1">
                            <AlertCircle className="h-3 w-3 text-slate-400" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Select "Imported" if from external system</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Select
                    value={formData.transaction_type}
                    onValueChange={(value) => {
                      // Batch update both fields to avoid race conditions
                      if (value === 'New Entry') {
                        updateFields({
                          transaction_type: value,
                          reference_barcode: ''
                        });
                        clearFieldError('reference_barcode');
                      } else {
                        updateField('transaction_type', value);
                      }
                    }}
                  >
                    <SelectTrigger className={`h-10 ${
                      getFieldError('transaction_type')
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : 'focus:ring-pawn-accent focus:border-pawn-accent'
                    }`}>
                      <SelectValue placeholder="Select transaction type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New Entry">New Entry</SelectItem>
                      <SelectItem value="Imported">Imported</SelectItem>
                    </SelectContent>
                  </Select>
                  {getFieldError('transaction_type') && (
                    <div className="text-xs text-red-600 mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {getFieldError('transaction_type')}
                    </div>
                  )}
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Select "Imported" if this transaction is from an external system
                  </div>
                </div>

                {/* Reference Barcode - Conditional */}
                {formData.transaction_type === 'Imported' && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <Label htmlFor="reference_barcode" className="text-sm font-medium flex items-center">
                      Reference Barcode
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-4 w-4 p-0 ml-1">
                              <AlertCircle className="h-3 w-3 text-slate-400" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Barcode from the main system</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id="reference_barcode"
                      value={formData.reference_barcode}
                      onChange={(e) => updateField('reference_barcode', e.target.value)}
                      placeholder="Enter barcode from main system"
                      maxLength={100}
                      className={`h-10 focus:ring-pawn-accent focus:border-pawn-accent ${
                        getFieldError('reference_barcode') ? 'border-red-500' : ''
                      }`}
                    />
                    {getFieldError('reference_barcode') && (
                      <p className="text-red-600 text-sm">{getFieldError('reference_barcode')}</p>
                    )}
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Optional (max 100 characters)
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="storage_location" className="text-sm font-medium flex items-center">
                    Storage Location
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-4 w-4 p-0 ml-1">
                            <AlertCircle className="h-3 w-3 text-slate-400" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Where the items will be stored (optional)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Select
                    value={formData.storage_location}
                    onValueChange={(value) => updateField('storage_location', value)}
                  >
                    <SelectTrigger className="h-10 focus:ring-pawn-accent focus:border-pawn-accent">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Safe">Safe</SelectItem>
                      <SelectItem value="Fire Exit">Fire Exit</SelectItem>
                      <SelectItem value="Small Bins">Small Bins</SelectItem>
                      <SelectItem value="Back Room">Back Room</SelectItem>
                      <SelectItem value="152nd St">152nd St</SelectItem>
                      <SelectItem value="Large Bins">Large Bins</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="internal_notes" className="text-sm font-medium">Internal Notes</Label>
                  <Textarea
                    id="internal_notes"
                    value={formData.internal_notes}
                    onChange={(e) => updateField('internal_notes', e.target.value)}
                    placeholder="Staff notes"
                    rows={3}
                    className="focus:ring-pawn-accent focus:border-pawn-accent"
                  />
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    These notes are only visible to staff
                  </div>
                </div>
              </div>

              {/* Right: Live Calculations */}
              <div className="space-y-4">
                <Card className="bg-pawn-light dark:bg-pawn-medium/20 border-pawn-medium/20 dark:border-pawn-medium/40">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center space-x-2 text-pawn-dark dark:text-pawn-light">
                      <Calculator className="w-5 h-5" />
                      <span>Loan Calculator</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-pawn-medium dark:text-pawn-light/80">Loan Amount:</span>
                      <span className="font-bold text-lg text-pawn-dark dark:text-pawn-light">
                        ${loanCalculations.loanAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-pawn-medium dark:text-pawn-light/80">Monthly Interest:</span>
                      <span className="font-medium text-pawn-dark dark:text-pawn-light">
                        ${loanCalculations.monthlyInterest.toLocaleString()}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-pawn-medium dark:text-pawn-light/80">Maturity Date:</span>
                      <span className="font-medium text-pawn-dark dark:text-pawn-light">
                        {loanCalculations.maturityDate}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center p-2 bg-pawn-accent/10 rounded-lg border border-pawn-accent/30">
                      <span className="font-semibold text-pawn-dark dark:text-pawn-light">Total Amount Due:</span>
                      <span className="text-xl font-bold text-pawn-dark dark:text-pawn-light">
                        ${loanCalculations.totalWithInterest.toLocaleString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Credit Check Status */}
                {checkingEligibility && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <span>Checking loan eligibility...</span>
                        <Progress value={50} className="h-2" />
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {eligibilityData && (
                  <Card className={`${eligibilityData.eligible ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-red-500 bg-red-50 dark:bg-red-950/20'}`}>
                    <CardContent className="p-4">
                      {eligibilityData.eligible ? (
                        <div className="space-y-3">
                          {/* Header with Icon and Status */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-full">
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                              </div>
                              <span className="text-lg font-semibold text-green-800 dark:text-green-200">
                                Loan Approved
                              </span>
                            </div>
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 border-0">
                              Eligible
                            </Badge>
                          </div>

                          {/* Credit and Slot Info Grid */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white dark:bg-gray-800/50 rounded-lg p-2 border border-green-200 dark:border-green-800">
                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Credit Status</div>
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                ${eligibilityData.available_credit?.toLocaleString()} available
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                of ${eligibilityData.credit_limit?.toLocaleString()} limit
                              </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800/50 rounded-lg p-2 border border-green-200 dark:border-green-800">
                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Loan Slots</div>
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {eligibilityData.slots_available || (eligibilityData.max_loans - eligibilityData.active_loans) || 0} available
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {eligibilityData.active_loans || eligibilityData.slots_used || 0} of {eligibilityData.max_loans || 0} used
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* Header with Icon and Status */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-full">
                                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                              </div>
                              <span className="text-lg font-semibold text-red-800 dark:text-red-200">
                                Loan Denied
                              </span>
                            </div>
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 border-0">
                              Not Eligible
                            </Badge>
                          </div>

                          {/* Credit and Slot Info Grid */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white dark:bg-gray-800/50 rounded-lg p-2 border border-red-200 dark:border-red-800">
                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Credit Status</div>
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                ${eligibilityData.available_credit?.toLocaleString()} available
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                of ${eligibilityData.credit_limit?.toLocaleString()} limit
                              </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800/50 rounded-lg p-2 border border-red-200 dark:border-red-800">
                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Loan Slots</div>
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {eligibilityData.slots_available || (eligibilityData.max_loans - eligibilityData.active_loans) || 0} available
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {eligibilityData.active_loans || eligibilityData.slots_used || 0} of {eligibilityData.max_loans || 0} used
                              </div>
                            </div>
                          </div>


                          {/* Denial Reasons */}
                          {eligibilityData.reasons && eligibilityData.reasons.length > 0 && (
                            <div className="bg-red-100 dark:bg-red-900/20 rounded-lg p-2">
                              <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                                Reasons for Denial:
                              </div>
                              <ul className="space-y-1">
                                {eligibilityData.reasons.map((reason, index) => (
                                  <li key={index} className="flex items-start">
                                    <span className="text-red-600 dark:text-red-400 mr-2 text-sm">•</span>
                                    <span className="text-sm text-red-700 dark:text-red-300">{reason}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleTabChange('items')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Items
              </Button>
              <Button
                type="button"
                onClick={() => handleTabChange('review')}
                disabled={!formData.loan_amount || !formData.monthly_interest_amount || (eligibilityData && !eligibilityData.eligible) || interestRateError}
                className="bg-pawn-accent hover:bg-pawn-accent/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Review Transaction
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </TabsContent>


          {/* Review Tab */}
          <TabsContent value="review" className="space-y-4 mt-0">
            <div className="p-4 bg-pawn-light dark:bg-pawn-medium/30 rounded-xl border border-pawn-medium/20 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-pawn-dark dark:text-pawn-light flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Final Review
                </h3>
                <Badge variant="outline" className="border-pawn-accent text-pawn-accent">
                  Step 4 of 4
                </Badge>
              </div>
              <p className="text-sm text-pawn-medium dark:text-pawn-light/80">Review all transaction details before finalizing. Once created, this cannot be undone.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Customer & Financial Summary */}
              <Card className="md:col-span-2 bg-pawn-light dark:bg-pawn-medium/20 border-pawn-medium/20 dark:border-pawn-medium/40 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center text-lg">
                    <div className="p-2 rounded-lg bg-pawn-accent text-white shadow-md mr-3">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-pawn-dark dark:text-pawn-light">Financial Summary</div>
                      <div className="text-sm font-normal text-pawn-medium dark:text-pawn-light/80">Customer and loan details</div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="p-2 bg-white/70 dark:bg-slate-800/70 rounded-lg border border-pawn-medium/20 dark:border-pawn-medium/40">
                    <div className="text-xs text-pawn-accent font-medium mb-1">Customer Information</div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-xs text-pawn-medium dark:text-pawn-light/80">Name:</span>
                        <span className="text-xs font-medium text-pawn-dark dark:text-pawn-light uppercase">{selectedCustomer && customerService.getCustomerFullName(selectedCustomer)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-pawn-medium dark:text-pawn-light/80">Phone:</span>
                        <span className="text-xs font-mono text-pawn-dark dark:text-pawn-light">{selectedCustomer && customerService.formatPhoneNumber(selectedCustomer.phone_number)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-pawn-medium dark:text-pawn-light/80">Status:</span>
                        <Badge variant="outline" className="text-xs border-pawn-accent text-pawn-accent">
                          {selectedCustomer?.status || 'Active'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-white/70 dark:bg-slate-800/70 rounded-lg border border-pawn-medium/20 dark:border-pawn-medium/40">
                      <div className="text-xs text-pawn-accent font-medium">Loan Amount</div>
                      <div className="font-bold text-lg text-pawn-dark dark:text-pawn-light">
                        ${loanCalculations.loanAmount.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-2 bg-white/70 dark:bg-slate-800/70 rounded-lg border border-pawn-medium/20 dark:border-pawn-medium/40">
                      <div className="text-xs text-pawn-accent font-medium">Monthly Interest</div>
                      <div className="font-bold text-lg text-pawn-dark dark:text-pawn-light">
                        ${loanCalculations.monthlyInterest.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="p-2 bg-pawn-accent/10 rounded-lg border border-pawn-accent/30">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-pawn-dark dark:text-pawn-light">Interest Rate:</span>
                      <span className="text-sm font-bold text-pawn-dark dark:text-pawn-light">
                        {formData.loan_amount && formData.monthly_interest_amount ?
                          ((parseFloat(formData.monthly_interest_amount) / parseFloat(formData.loan_amount)) * 100).toFixed(1) : '0'
                        }% per month
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-pawn-medium dark:text-pawn-light/80 font-medium">Maturity Date:</span>
                      <Badge variant="outline" className="text-xs px-2 py-0.5 border-pawn-accent text-pawn-accent bg-pawn-accent/5">
                        {loanCalculations.maturityDate}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-pawn-accent/10 rounded-lg border border-pawn-accent/30">
                      <span className="text-xs font-bold text-pawn-dark dark:text-pawn-light">Total Amount Due:</span>
                      <span className="text-lg font-bold text-pawn-dark dark:text-pawn-light">
                        ${loanCalculations.totalWithInterest.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Items Summary */}
              <Card className="md:col-span-3 bg-pawn-light dark:bg-pawn-medium/20 border-pawn-medium/20 dark:border-pawn-medium/40 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center text-lg">
                    <div className="p-2 rounded-lg bg-pawn-accent text-white shadow-md mr-3">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-pawn-dark dark:text-pawn-light">Items Summary</div>
                      <div className="text-sm font-normal text-pawn-medium dark:text-pawn-light/80">{formData.items.filter(item => item.description.trim()).length} item{formData.items.filter(item => item.description.trim()).length !== 1 ? 's' : ''} in this transaction</div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="space-y-1.5">
                    {formData.items.filter(item => item.description.trim()).map((item, index) => (
                      <div key={index} className="p-2 bg-white/70 dark:bg-slate-800/70 rounded-lg border border-pawn-medium/20 dark:border-pawn-medium/40">
                        <div className={`flex space-x-2 ${item.serial_number ? 'items-start' : 'items-center'}`}>
                          <div className="w-6 h-6 bg-pawn-accent/10 rounded-md flex items-center justify-center">
                            <span className="text-xs font-bold text-pawn-accent">{index + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-pawn-dark dark:text-pawn-light text-sm break-words">
                              {item.description}
                            </div>
                            {item.serial_number && (
                              <div className="text-xs text-pawn-medium dark:text-pawn-light/80 font-mono mt-1">
                                SN: {item.serial_number}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>


                  {/* Storage and Notes Summary */}
                  {(formData.storage_location || formData.internal_notes) && (
                    <div className="space-y-1.5 mt-2">
                      {formData.storage_location && (
                        <div className="p-2 bg-slate-50/80 dark:bg-slate-800/50 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-amber-100 dark:bg-amber-900/30 rounded-md flex items-center justify-center">
                                <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              </div>
                              <span className="text-sm font-medium text-pawn-dark dark:text-pawn-light">Storage Location</span>
                            </div>
                            <span className="font-mono text-sm font-bold text-pawn-dark dark:text-pawn-light bg-slate-100 dark:bg-slate-700/80 px-3 py-1 rounded-md">
                              {formatStorageLocation(formData.storage_location)}
                            </span>
                          </div>
                        </div>
                      )}
                      {formData.internal_notes && (
                        <div className="p-2 bg-slate-50/80 dark:bg-slate-800/50 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center">
                                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <span className="text-sm font-medium text-pawn-dark dark:text-pawn-light">Staff Notes</span>
                            </div>
                            <span className="font-mono text-sm font-bold text-pawn-dark dark:text-pawn-light bg-slate-100 dark:bg-slate-700/80 px-3 py-1 rounded-md max-w-xs break-words">
                              {formData.internal_notes}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Final Validation & Actions */}
            <div className="space-y-3">
              {/* Eligibility Status */}
              {eligibilityData && (
                <Card className={`${eligibilityData.eligible ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-red-500 bg-red-50 dark:bg-red-950/20'} border-2`}>
                  <CardContent className="p-3">
                    {eligibilityData.eligible ? (
                      <div className="space-y-2">
                        {/* Header with Icon and Status */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-full">
                              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <span className="text-lg font-semibold text-green-800 dark:text-green-200">
                              Loan Approved
                            </span>
                          </div>
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 border-0">
                            Ready to Process
                          </Badge>
                        </div>
                        
                        {/* Credit and Slot Info Grid */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 border border-green-200 dark:border-green-800">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Credit Status</div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              ${eligibilityData.available_credit?.toLocaleString()} available
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              of ${eligibilityData.credit_limit?.toLocaleString()} limit
                            </div>
                          </div>
                          <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 border border-green-200 dark:border-green-800">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Loan Slots</div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {eligibilityData.slots_available || (eligibilityData.max_loans - eligibilityData.active_loans) || 0} available
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {eligibilityData.active_loans || eligibilityData.slots_used || 0} of {eligibilityData.max_loans || 0} used
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Header with Icon and Status */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-full">
                              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                            </div>
                            <span className="text-lg font-semibold text-red-800 dark:text-red-200">
                              Loan Denied
                            </span>
                          </div>
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 border-0">
                            Cannot Process
                          </Badge>
                        </div>
                        
                        {/* Credit and Slot Info Grid */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 border border-red-200 dark:border-red-800">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Credit Status</div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              ${eligibilityData.available_credit?.toLocaleString()} available
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              of ${eligibilityData.credit_limit?.toLocaleString()} limit
                            </div>
                          </div>
                          <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 border border-red-200 dark:border-red-800">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Loan Slots</div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {eligibilityData.slots_available || (eligibilityData.max_loans - eligibilityData.active_loans) || 0} available
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {eligibilityData.active_loans || eligibilityData.slots_used || 0} of {eligibilityData.max_loans || 0} used
                            </div>
                          </div>
                        </div>
                        
                        {/* Denial Reasons */}
                        {eligibilityData.reasons && eligibilityData.reasons.length > 0 && (
                          <div className="bg-red-100 dark:bg-red-900/20 rounded-lg p-3">
                            <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                              Issues Preventing Approval:
                            </div>
                            <ul className="space-y-1">
                              {eligibilityData.reasons.map((reason, index) => (
                                <li key={index} className="flex items-start">
                                  <span className="text-red-600 dark:text-red-400 mr-2 text-sm">•</span>
                                  <span className="text-sm text-red-700 dark:text-red-300">{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Final Actions */}
            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleTabChange('loan')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Loan Details
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!isFormValid || (eligibilityData && !eligibilityData.eligible) || interestRateError}
                className="bg-pawn-accent hover:bg-pawn-accent/90 text-white px-8 py-3 h-auto shadow-lg transform hover:scale-105 transition-all duration-200"
                size="lg"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Create Transaction
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={showConfirmation}
        onOpenChange={setShowConfirmation}
        title="Create Pawn Transaction"
        description="Please confirm the transaction details below"
        onConfirm={processTransaction}
        onCancel={() => setShowConfirmation(false)}
        confirmText="Create Transaction"
        loading={submitting}
      >
        <div className="space-y-3 text-sm">
          <div className="font-medium text-center border-b pb-2">Transaction Summary</div>
          <div className="flex justify-between">
            <span>Customer:</span>
            <span className="font-medium">{selectedCustomer?.first_name} {selectedCustomer?.last_name}</span>
          </div>
          <div className="flex justify-between">
            <span>Loan Amount:</span>
            <span className="font-bold">${loanCalculations.loanAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Monthly Interest:</span>
            <span className="font-medium">${loanCalculations.monthlyInterest.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Items:</span>
            <span className="font-medium">{formData.items.length} item(s)</span>
          </div>
          {formData.storage_location && (
            <div className="flex justify-between">
              <span>Storage:</span>
              <span className="font-mono text-xs">{formatStorageLocation(formData.storage_location)}</span>
            </div>
          )}
        </div>
      </ConfirmationDialog>

      {/* Loading Dialog */}
      <LoadingDialog
        open={submitting && !showConfirmation}
        title="Creating Transaction"
        description="Processing your pawn transaction..."
      />

      {/* Print Receipt Dialog */}
      {createdTransaction && (
        <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Transaction Created Successfully!
              </DialogTitle>
              <DialogDescription>
                Transaction #{createdTransaction.formatted_id || createdTransaction.transaction_id} has been created.
                <br />
                Would you like to print the receipt now?
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4 py-4">
              {/* Transaction Summary */}
              <div className="w-full p-4 bg-muted rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">{selectedCustomer?.first_name} {selectedCustomer?.last_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loan Amount:</span>
                  <span className="font-bold">${createdTransaction.loan_amount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items:</span>
                  <span>{createdTransaction.items?.length || formData.items.length} item(s)</span>
                </div>
              </div>

              {/* Print Button */}
              <DualReceiptPrint
                transactionId={createdTransaction.transaction_id}
                receiptType="initial"
              />
            </div>

            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPrintDialog(false);
                  // Call onSuccess to notify parent component
                  if (onSuccess && createdTransaction) {
                    onSuccess(createdTransaction);
                  }
                  setCreatedTransaction(null);
                }}
              >
                Skip Printing
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowPrintDialog(false);
                  // Call onSuccess to notify parent component
                  if (onSuccess && createdTransaction) {
                    onSuccess(createdTransaction);
                  }
                  setCreatedTransaction(null);
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      </Card>
    </TooltipProvider>
  );
};

export default CreatePawnDialogRedesigned;