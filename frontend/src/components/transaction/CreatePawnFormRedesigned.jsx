import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Search, 
  User, 
  Package, 
  DollarSign,
  Camera,
  Plus,
  Minus,
  X,
  Check,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  UserPlus,
  Sparkles,
  Calculator,
  FileText,
  Shield,
  Save,
  Phone,
  Mail
} from 'lucide-react';

// UI Components
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';

// Services
import transactionService from '../../services/transactionService';
import customerService from '../../services/customerService';
import { useDebounce } from '../../hooks/useDebounce';
import { handleError, handleSuccess } from '../../utils/errorHandling';
import { useFormValidation, validateRequired, validateAmount, createValidationResult } from '../../utils/formValidation';

// Constants
const SUGGESTED_LOAN_RANGES = [
  { min: 50, max: 100, label: '$50-100' },
  { min: 100, max: 250, label: '$100-250' },
  { min: 250, max: 500, label: '$250-500' },
  { min: 500, max: 1000, label: '$500-1K' },
  { min: 1000, max: 2500, label: '$1K-2.5K' }
];

/*
Tailwind safelist for step colors:
bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 from-orange-500 to-red-600 bg-orange-500
bg-pink-50 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/30 from-pink-500 to-rose-600 bg-pink-500
bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 from-cyan-500 to-teal-600 bg-cyan-500
bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 from-rose-500 to-pink-600 bg-rose-500
border-orange-200 dark:border-orange-700 focus:border-orange-500 dark:focus:border-orange-400 border-pink-200 dark:border-pink-700 focus:border-pink-500 dark:focus:border-pink-400
border-cyan-200 dark:border-cyan-700 focus:border-cyan-500 dark:focus:border-cyan-400 border-rose-200 dark:border-rose-700 focus:border-rose-500 dark:focus:border-rose-400
bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300
*/

const CreatePawnFormRedesigned = ({ onSuccess, onCancel }) => {
  // Form state
  const [activeStep, setActiveStep] = useState('customer');
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    email: '',
    notes: ''
  });
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const countdownRef = useRef(null);
  
  // Form validation
  const formValidators = {
    customer_id: (value) => validateRequired(value, 'Customer'),
    loan_amount: (value) => validateAmount(value, 'Loan amount', { min: 1, max: 50000 }),
    monthly_interest_amount: (value) => validateAmount(value, 'Monthly interest', { min: 0, allowZero: true }),
    items: (items) => {
      if (!items || items.length === 0) {
        return createValidationResult(false, 'At least one item is required');
      }
      const hasValidItem = items.some(item => item.description && item.description.trim());
      if (!hasValidItem) {
        return createValidationResult(false, 'At least one item must have a description');
      }
      return createValidationResult(true);
    }
  };

  const {
    data: formData,
    updateField,
    validateAll,
    getFieldError,
    isFormValid
  } = useFormValidation({
    customer_id: '',
    loan_amount: '',
    monthly_interest_amount: '',
    storage_location: '',
    internal_notes: '',
    items: [{ 
      description: '', 
      serial_number: ''
    }]
  }, formValidators);

  // Customer state
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(customerSearchTerm, 300);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [eligibilityData, setEligibilityData] = useState(null);
  const [searchAttempted, setSearchAttempted] = useState(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [expandedItem, setExpandedItem] = useState(0);
  const [autoCreateCountdown, setAutoCreateCountdown] = useState(0);

  // Parse search term to extract potential customer data
  const parseSearchTerm = useCallback((searchTerm) => {
    if (!searchTerm.trim()) return { first_name: '', last_name: '', phone_number: '' };
    
    const trimmed = searchTerm.trim();
    
    // Check if it's a phone number (10+ digits)
    const phoneRegex = /^\d{10,}$/;
    if (phoneRegex.test(trimmed.replace(/\D/g, ''))) {
      const cleanPhone = trimmed.replace(/\D/g, '').slice(0, 10);
      return { first_name: '', last_name: '', phone_number: cleanPhone };
    }
    
    // Otherwise treat as name and split on space
    const nameParts = trimmed.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    return { first_name: firstName, last_name: lastName, phone_number: '' };
  }, []);

  // Load customers
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const response = await customerService.getAllCustomers({ page_size: 100 });
        setCustomers(response.customers || []);
        
        // Get recent customers (last 10)
        const sorted = [...(response.customers || [])]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 10);
        setRecentCustomers(sorted);
      } catch (err) {
        handleError(err, 'Loading customers');
      }
    };
    loadCustomers();
  }, []);

  // Filtered customers based on search
  const filteredCustomers = useMemo(() => {
    if (!debouncedSearchTerm.trim()) {
      setSearchAttempted(false);
      return recentCustomers;
    }
    
    const searchLower = debouncedSearchTerm.toLowerCase();
    const results = customers.filter(customer => 
      customer.phone_number.includes(debouncedSearchTerm) ||
      `${customer.first_name} ${customer.last_name}`.toLowerCase().includes(searchLower)
    );
    
    setSearchAttempted(true);
    return results;
  }, [debouncedSearchTerm, customers, recentCustomers]);

  // Check loan eligibility
  const checkLoanEligibility = useCallback(async (customerId, loanAmount) => {
    if (!customerId || !loanAmount) return;
    
    try {
      const eligibility = await customerService.checkLoanEligibility(customerId, parseFloat(loanAmount));
      setEligibilityData(eligibility);
      
      if (!eligibility.eligible) {
        handleError({ 
          message: `Loan not approved: ${eligibility.reasons?.join(', ') || 'Credit limit exceeded'}`,
          status: 422 
        }, 'Loan eligibility check');
      }
    } catch (err) {
      handleError(err, 'Checking loan eligibility');
    } finally {
      // Eligibility check complete
    }
  }, []);

  // Handle customer selection
  const selectCustomer = useCallback((customer) => {
    setSelectedCustomer(customer);
    updateField('customer_id', customer.phone_number);
    setCustomerSearchTerm(`${customer.first_name} ${customer.last_name}`);
    
    if (formData.loan_amount) {
      checkLoanEligibility(customer.phone_number, formData.loan_amount);
    }
  }, [updateField, formData.loan_amount, checkLoanEligibility]);

  // Handle item management
  const addItem = useCallback(() => {
    const newItems = [...formData.items, {
      description: '',
      serial_number: ''
    }];
    updateField('items', newItems);
    setExpandedItem(newItems.length - 1);
  }, [formData.items, updateField]);

  const removeItem = useCallback((index) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      updateField('items', newItems);
      if (expandedItem >= newItems.length) {
        setExpandedItem(Math.max(0, newItems.length - 1));
      }
    }
  }, [formData.items, updateField, expandedItem]);

  const updateItem = useCallback((index, field, value) => {
    const newItems = formData.items.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    );
    updateField('items', newItems);
  }, [formData.items, updateField]);


  // Calculate total transaction
  const calculateTotal = useMemo(() => {
    const principal = parseFloat(formData.loan_amount) || 0;
    const monthlyInterest = parseFloat(formData.monthly_interest_amount) || 0;
    
    return {
      principal,
      monthlyInterest,
      firstMonth: principal + monthlyInterest,
      threeMonths: principal + (monthlyInterest * 3)
    };
  }, [formData.loan_amount, formData.monthly_interest_amount]);

  // Save draft
  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem('pawnTransactionDraft', JSON.stringify({
        formData,
        selectedCustomer,
        timestamp: new Date().toISOString()
      }));
      setIsDraftSaved(true);
      setTimeout(() => setIsDraftSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save draft:', err);
    }
  }, [formData, selectedCustomer]);

  // Load draft on mount
  useEffect(() => {
    try {
      const draft = localStorage.getItem('pawnTransactionDraft');
      if (draft) {
        const parsed = JSON.parse(draft);
        const draftAge = Date.now() - new Date(parsed.timestamp).getTime();
        
        // Only load drafts less than 24 hours old
        if (draftAge < 24 * 60 * 60 * 1000) {
          // Draft loaded successfully
        }
      }
    } catch (err) {
      console.error('Failed to load draft:', err);
    }
  }, []);

  // Auto-save draft periodically
  useEffect(() => {
    const interval = setInterval(saveDraft, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [saveDraft]);

  // Auto-open create customer dialog when no search results found
  useEffect(() => {
    if (searchAttempted && debouncedSearchTerm.trim() && filteredCustomers.length === 0) {
      setAutoCreateCountdown(3); // Start 3-second countdown
      
      const countdownInterval = setInterval(() => {
        setAutoCreateCountdown(prev => {
          if (prev <= 1) {
            // Countdown finished, open dialog
            const parsed = parseSearchTerm(debouncedSearchTerm);
            setNewCustomerData(prev => ({
              ...prev,
              ...parsed
            }));
            setShowNewCustomerForm(true);
            setAutoCreateCountdown(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        clearInterval(countdownInterval);
        setAutoCreateCountdown(0);
      };
    } else {
      setAutoCreateCountdown(0);
    }
  }, [searchAttempted, debouncedSearchTerm, filteredCustomers.length, parseSearchTerm]);

  // Submit transaction
  const handleSubmit = async () => {
    if (!validateAll()) {
      handleError({ message: 'Please fill in all required fields' }, 'Validation');
      return;
    }

    setSubmitting(true);
    try {
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

      // Submit transaction data
      const result = await transactionService.createTransaction(transactionData);
      // Transaction created successfully
      
      // Clear draft on success
      localStorage.removeItem('pawnTransactionDraft');
      
      handleSuccess(`Transaction #${result.formatted_id || result.transaction_id} created successfully`);
      
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      handleError(err, 'Creating transaction');
    } finally {
      setSubmitting(false);
    }
  };

  // Step navigation
  const canProceedToNext = () => {
    switch (activeStep) {
      case 'customer':
        return !!selectedCustomer;
      case 'items':
        return formData.items.some(item => item.description);
      case 'loan':
        return formData.loan_amount && formData.monthly_interest_amount;
      default:
        return true;
    }
  };


  const steps = [
    { id: 'customer', label: 'Customer', icon: User },
    { id: 'items', label: 'Items', icon: Package },
    { id: 'loan', label: 'Loan Details', icon: DollarSign },
    { id: 'review', label: 'Review', icon: FileText }
  ];

  const currentStepIndex = steps.findIndex(step => step.id === activeStep);

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header with progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              New Pawn Transaction
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Follow the steps below to create a new pawn loan
            </p>
          </div>
          
          <div className="flex items-center gap-1">
            {isDraftSaved && (
              <Badge variant="outline" className="animate-in fade-in slide-in-from-right text-xs">
                <Save className="w-2 h-2 mr-1" />
                Draft saved
              </Badge>
            )}
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={saveDraft}
              title="Save as draft"
              className="h-7 w-7 p-0"
            >
              <Save className="h-3 w-3" />
            </Button>
            
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 w-7 p-0">
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Step Progress */}
        <div className="relative">
          <Progress value={(currentStepIndex + 1) / steps.length * 100} className="h-1" />
          <div className="flex justify-between mt-2">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = step.id === activeStep;
              const isCompleted = index < currentStepIndex;
              
              // Define static classes for each step
              let stepClasses = '';
              let circleClasses = '';
              
              if (step.id === 'customer') {
                stepClasses = isActive 
                  ? 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300'
                  : isCompleted 
                    ? 'text-orange-600 dark:text-orange-400 cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950/30'
                    : 'text-slate-400 dark:text-slate-600';
                circleClasses = isActive 
                  ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white'
                  : isCompleted 
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800';
              } else if (step.id === 'items') {
                stepClasses = isActive 
                  ? 'bg-pink-50 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300'
                  : isCompleted 
                    ? 'text-pink-600 dark:text-pink-400 cursor-pointer hover:bg-pink-50 dark:hover:bg-pink-950/30'
                    : 'text-slate-400 dark:text-slate-600';
                circleClasses = isActive 
                  ? 'bg-gradient-to-br from-pink-500 to-rose-600 text-white'
                  : isCompleted 
                    ? 'bg-pink-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800';
              } else if (step.id === 'loan') {
                stepClasses = isActive 
                  ? 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300'
                  : isCompleted 
                    ? 'text-cyan-600 dark:text-cyan-400 cursor-pointer hover:bg-cyan-50 dark:hover:bg-cyan-950/30'
                    : 'text-slate-400 dark:text-slate-600';
                circleClasses = isActive 
                  ? 'bg-gradient-to-br from-cyan-500 to-teal-600 text-white'
                  : isCompleted 
                    ? 'bg-cyan-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800';
              } else if (step.id === 'review') {
                stepClasses = isActive 
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                  : isCompleted 
                    ? 'text-rose-600 dark:text-rose-400 cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/30'
                    : 'text-slate-400 dark:text-slate-600';
                circleClasses = isActive 
                  ? 'bg-gradient-to-br from-rose-500 to-pink-600 text-white'
                  : isCompleted 
                    ? 'bg-rose-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800';
              }
              
              return (
                <button
                  key={step.id}
                  onClick={() => isCompleted || isActive ? setActiveStep(step.id) : null}
                  disabled={!isCompleted && !isActive}
                  className={`flex flex-col items-center gap-1 p-1 rounded-lg transition-all ${stepClasses}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${circleClasses}`}>
                    {isCompleted ? <Check className="w-3 h-3" /> : <StepIcon className="w-3 h-3" />}
                  </div>
                  <span className="text-xs font-medium">{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-4">
          {/* Customer Selection Step - Transaction Dialog Inspired */}
          {activeStep === 'customer' && (
            <div className="space-y-6">
              {/* Header with large icon */}
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-pawn-accent rounded-xl flex items-center justify-center shadow-lg">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Select Customer
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Choose existing customer or create a new profile
                  </p>
                </div>
              </div>
              
              {/* Enhanced Search Section */}
              <Card className="bg-pawn-light dark:bg-pawn-medium/30 border-pawn-medium/20 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-pawn-accent rounded-xl flex items-center justify-center shadow-md">
                      <Search className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-pawn-dark dark:text-pawn-light">
                        Customer Search
                      </div>
                      <div className="text-sm text-pawn-medium dark:text-pawn-light/80">
                        Find by name or phone number
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search by name or phone number..."
                      value={customerSearchTerm}
                      onChange={(e) => setCustomerSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && debouncedSearchTerm && filteredCustomers.length === 0) {
                          const parsed = parseSearchTerm(debouncedSearchTerm);
                          setNewCustomerData(prev => ({
                            ...prev,
                            ...parsed
                          }));
                          setShowNewCustomerForm(true);
                        }
                      }}
                      className="pl-12 h-12 text-base bg-white/70 dark:bg-slate-800/70 border-orange-200 dark:border-orange-700 focus:border-orange-500 dark:focus:border-orange-400"
                    />
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-8 px-3 border-orange-300 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/50"
                      onClick={() => {
                        if (debouncedSearchTerm && filteredCustomers.length === 0) {
                          const parsed = parseSearchTerm(debouncedSearchTerm);
                          setNewCustomerData(prev => ({
                            ...prev,
                            ...parsed
                          }));
                        }
                        setShowNewCustomerForm(true);
                      }}
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      <span className="text-xs">New</span>
                    </Button>
                  </div>

                  {/* Customer Results */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-orange-700 dark:text-orange-300">
                      {debouncedSearchTerm ? 'Search Results' : 'Recent Customers'}
                    </h4>
                    
                    {filteredCustomers.length > 0 ? (
                      <div className="border rounded-xl bg-white/50 dark:bg-slate-800/50 overflow-hidden">
                        {/* Table Header */}
                        <div className="bg-orange-100/50 dark:bg-orange-900/30 px-4 py-3 border-b border-orange-200/50 dark:border-orange-700/50">
                          <div className="grid grid-cols-12 gap-4 text-sm font-medium text-orange-800 dark:text-orange-200">
                            <div className="col-span-1">Select</div>
                            <div className="col-span-4">Customer Name</div>
                            <div className="col-span-3">Phone Number</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-2">Actions</div>
                          </div>
                        </div>
                        
                        {/* Table Rows */}
                        <div className="divide-y divide-slate-200 dark:divide-slate-700">
                          {filteredCustomers.slice(0, 6).map((customer) => (
                            <button
                              key={customer.phone_number}
                              onClick={() => selectCustomer(customer)}
                              className={`w-full px-4 py-4 text-left transition-all hover:bg-orange-50 dark:hover:bg-orange-900/20 ${
                                selectedCustomer?.phone_number === customer.phone_number
                                  ? 'bg-orange-50 dark:bg-orange-950/50'
                                  : 'bg-transparent'
                              }`}
                            >
                              <div className="grid grid-cols-12 gap-4 items-center">
                                <div className="col-span-1">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    selectedCustomer?.phone_number === customer.phone_number
                                      ? 'bg-orange-500'
                                      : 'bg-orange-100 dark:bg-orange-900/50'
                                  }`}
                                    {selectedCustomer?.phone_number === customer.phone_number ? (
                                      <Check className="h-4 w-4 text-white" />
                                    ) : (
                                      <User className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                    )}
                                  </div>
                                </div>
                                <div className="col-span-4">
                                  <p className="font-semibold text-base text-slate-900 dark:text-slate-100">
                                    {customer.first_name} {customer.last_name}
                                  </p>
                                </div>
                                <div className="col-span-3">
                                  <p className="text-sm text-slate-600 dark:text-slate-400 font-mono">
                                    {customer.phone_number}
                                  </p>
                                </div>
                                <div className="col-span-2">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    customer.status === 'active' 
                                      ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                                  }`}>
                                    {customer.status || 'Active'}
                                  </span>
                                </div>
                                <div className="col-span-2">
                                  {selectedCustomer?.phone_number === customer.phone_number ? (
                                    <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                                      Selected
                                    </span>
                                  ) : (
                                    <span className="text-xs text-orange-600 dark:text-orange-400">
                                      Click to select
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-white/50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700">
                        <User className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
                        <p className="text-base font-medium text-slate-600 dark:text-slate-400 mb-1">No customers found</p>
                        <p className="text-sm text-slate-500 dark:text-slate-500 mb-2">
                          {debouncedSearchTerm ? `No results for "${debouncedSearchTerm}"` : 'Start typing to search'}
                        </p>
                        
                        {/* Auto-create countdown */}
                        {autoCreateCountdown > 0 ? (
                          <div className="mb-4 p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-700">
                            <p className="text-sm text-orange-700 dark:text-orange-300 mb-2">
                              Auto-creating customer in {autoCreateCountdown} seconds...
                            </p>
                            <div className="w-full bg-orange-200 dark:bg-orange-800 rounded-full h-2">
                              <div 
                                className="bg-orange-500 h-2 rounded-full transition-all duration-1000"
                                style={{ width: `${((3 - autoCreateCountdown) / 3) * 100}%` }}
                              />
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setAutoCreateCountdown(0);
                                clearTimeout(countdownRef.current);
                              }}
                              className="mt-2 border-orange-300 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/50"
                            >
                              Cancel auto-create
                            </Button>
                          </div>
                        ) : null}
                        
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (debouncedSearchTerm) {
                              const parsed = parseSearchTerm(debouncedSearchTerm);
                              setNewCustomerData(prev => ({
                                ...prev,
                                ...parsed
                              }));
                            }
                            setShowNewCustomerForm(true);
                          }}
                          className="border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add new customer
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Selected Customer Details */}
              {selectedCustomer && (
                <Card className="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-950/50 dark:to-indigo-950/50 border-blue-200/50 dark:border-blue-800/50 shadow-lg">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-blue-800 dark:text-blue-200">
                          Selected Customer
                        </div>
                        <div className="text-sm text-blue-600 dark:text-blue-400">
                          {selectedCustomer.first_name} {selectedCustomer.last_name}
                        </div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {eligibilityData ? (
                      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl overflow-hidden border border-orange-200/50 dark:border-orange-700/50">
                        {/* Credit Information Table */}
                        <div className="divide-y divide-orange-200/50 dark:divide-orange-700/50">
                          <div className="px-4 py-3 bg-orange-100/30 dark:bg-orange-900/20">
                            <div className="grid grid-cols-3 gap-4 text-sm font-medium text-orange-800 dark:text-orange-200">
                              <div>Credit Limit</div>
                              <div>Available Credit</div>
                              <div>Active Loans</div>
                            </div>
                          </div>
                          <div className="px-4 py-4">
                            <div className="grid grid-cols-3 gap-4 items-center">
                              <div className="text-center">
                                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                  ${eligibilityData.credit_limit?.toLocaleString()}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className={`text-xl font-bold ${
                                  eligibilityData.available_credit > 0 
                                    ? 'text-orange-600 dark:text-orange-400' 
                                    : 'text-red-600 dark:text-red-400'
                                }`}>
                                  ${eligibilityData.available_credit?.toLocaleString()}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                  {eligibilityData.active_loans_count || 0}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-2"></div>
                        <p className="text-sm text-orange-700 dark:text-orange-300">Loading credit information...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Items Step - Transaction Dialog Inspired */}
          {activeStep === 'items' && (
            <div className="space-y-6">
              {/* Header with large icon */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      Pawned Items
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Add items that will be held as collateral
                    </p>
                  </div>
                </div>
                
                <Button 
                  onClick={addItem} 
                  className="bg-pawn-accent hover:bg-pawn-accent/90 text-white shadow-lg"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {/* Items Table */}
              <Card className="bg-gradient-to-br from-pink-50/80 to-rose-50/80 dark:from-pink-950/50 dark:to-rose-950/50 border-pink-200/50 dark:border-pink-800/50 shadow-lg overflow-hidden">
                <CardHeader className="pb-4 border-b border-pink-200/50 dark:border-pink-700/50">
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center shadow-md">
                      <Package className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-pink-800 dark:text-pink-200">
                        Items List
                      </div>
                      <div className="text-sm text-pink-600 dark:text-pink-400">
                        Manage items for this transaction
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  
                  {/* Items Table Structure */}
                  <div className="bg-white/50 dark:bg-slate-800/50">
                    {/* Table Header */}
                    <div className="bg-pink-100/50 dark:bg-pink-900/30 px-4 py-3 border-b border-pink-200/50 dark:border-pink-700/50">
                      <div className="grid grid-cols-12 gap-4 text-sm font-medium text-pink-800 dark:text-pink-200">
                        <div className="col-span-1">#</div>
                        <div className="col-span-5">Description</div>
                        <div className="col-span-3">Serial Number</div>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-1">Actions</div>
                      </div>
                    </div>
                    
                    {/* Table Rows */}
                    <div className="divide-y divide-pink-200/30 dark:divide-pink-700/30">
                      {formData.items.map((item, index) => (
                        <div key={index} className="px-4 py-3 hover:bg-pink-50/30 dark:hover:bg-pink-900/20 transition-colors">
                          <div className="grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-1">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-100 to-rose-100 dark:from-pink-900/50 dark:to-rose-900/50 flex items-center justify-center">
                                <span className="text-sm font-semibold text-pink-700 dark:text-pink-300">
                                  {index + 1}
                                </span>
                              </div>
                            </div>
                            <div className="col-span-5">
                              {expandedItem === index ? (
                                <Input
                                  value={item.description}
                                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                                  placeholder="Enter item description..."
                                  className="h-9 bg-white/70 dark:bg-slate-700/70 border-pink-200 dark:border-pink-700 focus:border-pink-500 dark:focus:border-pink-400"
                                  autoFocus
                                />
                              ) : (
                                <button
                                  onClick={() => setExpandedItem(index)}
                                  className="text-left w-full"
                                >
                                  <p className="font-medium text-slate-900 dark:text-slate-100">
                                    {item.description || `Item ${index + 1}`}
                                  </p>
                                  {!item.description && (
                                    <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                                      Click to add description
                                    </p>
                                  )}
                                </button>
                              )}
                            </div>
                            <div className="col-span-3">
                              {expandedItem === index ? (
                                <Input
                                  value={item.serial_number}
                                  onChange={(e) => updateItem(index, 'serial_number', e.target.value)}
                                  placeholder="Optional"
                                  className="h-9 bg-white/70 dark:bg-slate-700/70 border-pink-200 dark:border-pink-700 focus:border-pink-500 dark:focus:border-pink-400"
                                />
                              ) : (
                                <button
                                  onClick={() => setExpandedItem(index)}
                                  className="text-left w-full"
                                >
                                  <p className="text-sm text-slate-600 dark:text-slate-400 font-mono">
                                    {item.serial_number || 'Not specified'}
                                  </p>
                                </button>
                              )}
                            </div>
                            <div className="col-span-2">
                              {expandedItem === index ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setExpandedItem(-1)}
                                  className="h-7 px-2 text-xs text-pink-600 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-900/50"
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Done
                                </Button>
                              ) : (
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  item.description
                                    ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                                }`}>
                                  {item.description ? 'Complete' : 'Incomplete'}
                                </span>
                              )}
                            </div>
                            <div className="col-span-1">
                              {formData.items.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeItem(index)}
                                  className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                </CardContent>
              </Card>

                {/* Summary Card */}
                {formData.items.some(item => item.description) && (
                  <Card className="bg-gradient-to-br from-slate-50/80 to-blue-50/80 dark:from-slate-800/80 dark:to-blue-900/50 border-slate-200/50 dark:border-slate-700/50 shadow-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <Package className="h-4 w-4" />
                        Items Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center">
                        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {formData.items.filter(item => item.description).length} Item{formData.items.filter(item => item.description).length !== 1 ? 's' : ''} Added
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Ready for pawn transaction
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
          )}

          {/* Loan Details Step - Transaction Dialog Inspired */}
          {activeStep === 'loan' && (
            <div className="space-y-6">
              {/* Header with large icon */}
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Loan Terms & Details
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Set loan amount, interest rate, and storage details
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Loan Configuration */}
                <div className="space-y-6">
                  
                  
                  {/* Quick Amount Selection */}
                  <Card className="bg-gradient-to-br from-cyan-50/80 to-sky-50/80 dark:from-cyan-950/50 dark:to-sky-950/50 border-cyan-200/50 dark:border-cyan-800/50 shadow-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                          <Calculator className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-cyan-800 dark:text-cyan-200">
                            Loan Amount
                          </div>
                          <div className="text-sm text-cyan-600 dark:text-cyan-400">
                            Select amount or enter custom value
                          </div>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Quick Select Table */}
                      <div>
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 block">
                          Quick Select Amount
                        </Label>
                        <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl overflow-hidden border border-cyan-200/50 dark:border-cyan-700/50">
                          <div className="divide-y divide-cyan-200/30 dark:divide-cyan-700/30">
                            {SUGGESTED_LOAN_RANGES.map((range, index) => (
                              <button
                                key={range.label}
                                type="button"
                                onClick={() => updateField('loan_amount', range.min.toString())}
                                className={`w-full px-4 py-3 text-left transition-all hover:bg-cyan-50 dark:hover:bg-cyan-900/20 ${
                                  formData.loan_amount && 
                                  parseFloat(formData.loan_amount) >= range.min && 
                                  parseFloat(formData.loan_amount) <= range.max
                                    ? 'bg-cyan-100 dark:bg-cyan-900/50 border-l-4 border-cyan-500'
                                    : ''
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-lg bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center">
                                      <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                                        {index + 1}
                                      </span>
                                    </div>
                                    <div>
                                      <p className="font-semibold text-cyan-800 dark:text-cyan-200">
                                        {range.label}
                                      </p>
                                      <p className="text-xs text-slate-600 dark:text-slate-400">
                                        Range: ${range.min} - ${range.max}
                                      </p>
                                    </div>
                                  </div>
                                  {formData.loan_amount && 
                                  parseFloat(formData.loan_amount) >= range.min && 
                                  parseFloat(formData.loan_amount) <= range.max && (
                                    <Check className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Custom Amount Input */}
                      <div>
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Loan Amount *</Label>
                        <div className="relative mt-1">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            type="number"
                            value={formData.loan_amount}
                            onChange={(e) => {
                              updateField('loan_amount', e.target.value);
                              if (selectedCustomer && e.target.value) {
                                checkLoanEligibility(selectedCustomer.phone_number, e.target.value);
                              }
                            }}
                            placeholder="0.00"
                            className={`pl-12 h-12 text-lg font-semibold bg-white/70 dark:bg-slate-800/70 border-cyan-200 dark:border-cyan-700 focus:border-cyan-500 dark:focus:border-cyan-400 ${
                              getFieldError('loan_amount') ? 'border-red-500' : ''
                            }`}
                          />
                        </div>
                        {getFieldError('loan_amount') && (
                          <p className="text-red-600 text-sm mt-1">{getFieldError('loan_amount')}</p>
                        )}
                      </div>
                      
                      {/* Monthly Interest */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Monthly Interest *</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowCalculator(!showCalculator)}
                            className="h-8 px-3 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/50"
                          >
                            <Calculator className="h-3 w-3 mr-1" />
                            <span className="text-xs">Calculator</span>
                          </Button>
                        </div>
                        
                        <div className="relative">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            type="number"
                            value={formData.monthly_interest_amount}
                            onChange={(e) => updateField('monthly_interest_amount', e.target.value)}
                            placeholder="0.00"
                            className="pl-12 h-12 text-base bg-white/70 dark:bg-slate-800/70 border-cyan-200 dark:border-cyan-700 focus:border-cyan-500 dark:focus:border-cyan-400"
                          />
                        </div>
                        
                        {/* Interest Calculator */}
                        {showCalculator && formData.loan_amount && (
                          <div className="mt-3 p-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-xl border border-cyan-200 dark:border-cyan-700">
                            <p className="text-sm font-medium mb-3 text-cyan-800 dark:text-cyan-200">Quick Interest Calculator</p>
                            <div className="grid grid-cols-3 gap-2">
                              {[10, 15, 20].map((rate) => {
                                const amount = Math.round(parseFloat(formData.loan_amount) * (rate / 100));
                                return (
                                  <Button
                                    key={rate}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateField('monthly_interest_amount', amount.toString())}
                                    className="h-8 text-xs border-cyan-300 dark:border-cyan-600 hover:bg-cyan-100 dark:hover:bg-cyan-900/50"
                                  >
                                    {rate}% = ${amount}
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Storage Location */}
                      <div>
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Storage Location</Label>
                        <Input
                          value={formData.storage_location}
                          onChange={(e) => updateField('storage_location', e.target.value)}
                          placeholder="e.g., Shelf A-1, Safe #3, Vault B-12"
                          className="h-10 mt-1 bg-white/70 dark:bg-slate-800/70 border-cyan-200 dark:border-cyan-700 focus:border-cyan-500 dark:focus:border-cyan-400"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Right Column - Summary & Additional Details */}
                <div className="space-y-6">
                  
                  {/* Transaction Summary */}
                  <Card className="bg-gradient-to-br from-cyan-50/80 to-teal-50/80 dark:from-cyan-950/50 dark:to-teal-950/50 border-cyan-200/50 dark:border-cyan-800/50 shadow-lg">
                    <CardHeader className="pb-4 border-b border-cyan-200/50 dark:border-cyan-700/50">
                      <CardTitle className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md">
                          <Calculator className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-cyan-800 dark:text-cyan-200">
                            Transaction Summary
                          </div>
                          <div className="text-sm text-cyan-600 dark:text-cyan-400">
                            Payment breakdown and totals
                          </div>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {/* Transaction Summary Table */}
                      <div className="bg-white/50 dark:bg-slate-800/50">
                        {/* Table Header */}
                        <div className="bg-cyan-100/50 dark:bg-cyan-900/30 px-4 py-3 border-b border-cyan-200/50 dark:border-cyan-700/50">
                          <div className="grid grid-cols-2 gap-4 text-sm font-medium text-cyan-800 dark:text-cyan-200">
                            <div>Amount Type</div>
                            <div className="text-right">Value</div>
                          </div>
                        </div>
                        
                        {/* Table Rows */}
                        <div className="divide-y divide-cyan-200/30 dark:divide-cyan-700/30">
                          <div className="px-4 py-4">
                            <div className="grid grid-cols-2 gap-4 items-center">
                              <div>
                                <p className="font-medium text-slate-900 dark:text-slate-100">Principal Amount</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">Loan amount</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                  ${calculateTotal.principal.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="px-4 py-4">
                            <div className="grid grid-cols-2 gap-4 items-center">
                              <div>
                                <p className="font-medium text-slate-900 dark:text-slate-100">Monthly Interest</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">Per month charge</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                  ${calculateTotal.monthlyInterest.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Payment Timeline Section */}
                          <div className="bg-pawn-light dark:bg-pawn-medium/20">
                            <div className="px-4 py-4">
                              <div className="grid grid-cols-2 gap-4 items-center">
                                <div>
                                  <p className="font-bold text-cyan-800 dark:text-cyan-200">Due in 30 days</p>
                                  <p className="text-xs text-cyan-600 dark:text-cyan-400">First payment due</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                                    ${calculateTotal.firstMonth.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="px-4 py-3">
                            <div className="grid grid-cols-2 gap-4 items-center">
                              <div>
                                <p className="font-medium text-slate-700 dark:text-slate-300">Due in 90 days</p>
                                <p className="text-xs text-slate-500 dark:text-slate-500">If unpaid for 3 months</p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                                  ${calculateTotal.threeMonths.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Internal Notes */}
                  <Card className="bg-gradient-to-br from-slate-50/80 to-gray-50/80 dark:from-slate-800/80 dark:to-gray-800/80 border-slate-200/50 dark:border-slate-700/50 shadow-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <FileText className="h-4 w-4" />
                        Internal Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={formData.internal_notes}
                        onChange={(e) => updateField('internal_notes', e.target.value)}
                        placeholder="Add initial staff notes about this transaction (e.g., special instructions, customer requests, item conditions)..."
                        rows={4}
                        className="resize-none bg-white/70 dark:bg-slate-700/70 border-slate-200 dark:border-slate-600 focus:border-slate-400 dark:focus:border-slate-500"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        Additional notes can be added anytime from the transaction detail view.
                      </p>
                    </CardContent>
                  </Card>
                  
                  {/* Terms & Conditions */}
                  <Card className="bg-gradient-to-br from-orange-50/80 to-red-50/80 dark:from-orange-950/50 dark:to-red-950/50 border-orange-200/50 dark:border-orange-800/50 shadow-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-md">
                          <Shield className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-orange-800 dark:text-orange-200">
                            Standard Terms
                          </div>
                          <div className="text-sm text-orange-600 dark:text-orange-400">
                            Loan conditions and policies
                          </div>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-xl p-4">
                        <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0"></div>
                            30-day initial loan period
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0"></div>
                            Interest compounds monthly if unpaid
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0"></div>
                            Item forfeit after 97 days
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0"></div>
                            Valid ID required for redemption
                          </li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* Review Step - Transaction Dialog Inspired Design */}
          {activeStep === 'review' && (
            <div className="space-y-4">
              {/* Header with large icon */}
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Review Transaction
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Verify all details before creating the pawn loan
                  </p>
                </div>
              </div>
              
              {/* 3-column layout inspired by transaction dialog */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column - Customer and Loan Details */}
                <div className="space-y-4">
                  
                  {/* Customer Card */}
                  <Card className="bg-gradient-to-br from-orange-50/80 to-red-50/80 dark:from-orange-950/50 dark:to-red-950/50 border-orange-200/50 dark:border-orange-800/50 shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-orange-800 dark:text-orange-200">
                        <div className="w-6 h-6 bg-orange-100 dark:bg-orange-900/50 rounded-lg flex items-center justify-center">
                          <User className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                        </div>
                        Customer
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <p className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                          {selectedCustomer?.first_name} {selectedCustomer?.last_name}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedCustomer?.phone_number}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveStep('customer')}
                        className="w-full mt-3 h-8 text-xs hover:bg-orange-100 dark:hover:bg-orange-900/50"
                      >
                        Edit Customer
                      </Button>
                    </CardContent>
                  </Card>
                  
                  {/* Loan Details Card */}
                  <Card className="bg-gradient-to-br from-cyan-50/80 to-teal-50/80 dark:from-cyan-950/50 dark:to-teal-950/50 border-cyan-200/50 dark:border-cyan-800/50 shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-cyan-800 dark:text-cyan-200">
                        <div className="w-6 h-6 bg-cyan-100 dark:bg-cyan-900/50 rounded-lg flex items-center justify-center">
                          <DollarSign className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        Loan Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Loan Amount</p>
                          <p className="font-bold text-lg text-slate-900 dark:text-slate-100">
                            ${calculateTotal.principal.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Monthly Interest</p>
                          <p className="font-semibold text-base text-slate-700 dark:text-slate-300">
                            ${calculateTotal.monthlyInterest.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-cyan-200 dark:border-cyan-800">
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300">Due in 30 days</p>
                          <p className="font-bold text-xl text-cyan-600 dark:text-cyan-400">
                            ${calculateTotal.firstMonth.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Storage Location</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {formData.storage_location || 'TBD'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveStep('loan')}
                        className="w-full mt-3 h-8 text-xs hover:bg-cyan-100 dark:hover:bg-cyan-900/50"
                      >
                        Edit Loan Details
                      </Button>
                    </CardContent>
                  </Card>
                  
                </div>
                
                {/* Center/Right Column - Featured Items Section (2 columns) */}
                <div className="lg:col-span-2">
                  <Card className="bg-gradient-to-br from-rose-50/80 via-pink-50/80 to-rose-50/80 dark:from-rose-950/50 dark:via-pink-950/50 dark:to-rose-950/50 border-rose-200/50 dark:border-rose-800/50 shadow-lg">
                    <CardHeader className="pb-4 border-b border-rose-200/50 dark:border-rose-700/50">
                      <CardTitle className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
                          <Package className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-rose-800 dark:text-rose-200">
                            Pawned Items ({formData.items.filter(i => i.description).length})
                          </div>
                          <div className="text-sm text-rose-600 dark:text-rose-400">
                            Items included in this transaction
                          </div>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      
                      {/* Items Table */}
                      <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl overflow-hidden border border-rose-200/50 dark:border-rose-700/50 mb-6">
                        {/* Table Header */}
                        <div className="bg-rose-100/50 dark:bg-rose-900/30 px-4 py-3 border-b border-rose-200/50 dark:border-rose-700/50">
                          <div className="grid grid-cols-12 gap-4 text-sm font-medium text-rose-800 dark:text-rose-200">
                            <div className="col-span-1">#</div>
                            <div className="col-span-8">Description</div>
                            <div className="col-span-3">Serial Number</div>
                          </div>
                        </div>
                        
                        {/* Table Rows */}
                        <div className="divide-y divide-rose-200/30 dark:divide-rose-700/30">
                          {formData.items.filter(item => item.description).map((item, index) => (
                            <div key={index} className="px-4 py-4 hover:bg-rose-50/30 dark:hover:bg-rose-900/10 transition-colors">
                              <div className="grid grid-cols-12 gap-4 items-center">
                                <div className="col-span-1">
                                  <div className="w-8 h-8 bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/50 dark:to-pink-900/50 rounded-lg flex items-center justify-center">
                                    <span className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                                      {index + 1}
                                    </span>
                                  </div>
                                </div>
                                <div className="col-span-8">
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                                    {item.description}
                                  </p>
                                </div>
                                <div className="col-span-3">
                                  <p className="text-sm text-slate-600 dark:text-slate-400 font-mono">
                                    {item.serial_number || '—'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Edit Items Button */}
                      <div className="flex justify-center">
                        <Button
                          variant="outline"
                          onClick={() => setActiveStep('items')}
                          className="px-6 py-2 border-rose-300 dark:border-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300"
                        >
                          <Package className="h-4 w-4 mr-2" />
                          Edit Items
                        </Button>
                      </div>
                      
                    </CardContent>
                  </Card>
                </div>
                
              </div>
              
              {/* Internal Notes (if any) */}
              {formData.internal_notes && (
                <Card className="bg-slate-50/80 dark:bg-slate-800/80 border-slate-200/50 dark:border-slate-700/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <FileText className="h-3 w-3" />
                      Internal Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                      {formData.internal_notes}
                    </p>
                  </CardContent>
                </Card>
              )}
              
              {/* Ready to Create - Final Status */}
              <div className="bg-pawn-light dark:bg-pawn-medium/30 border border-pawn-medium/20 rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-pawn-accent rounded-full flex items-center justify-center shadow-md">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-pawn-dark dark:text-pawn-light">
                      Ready to Create Transaction
                    </h4>
                    <p className="text-sm text-pawn-medium dark:text-pawn-light/80 mt-1">
                      Please review all details above. Once created, the transaction will be active immediately.
                    </p>
                  </div>
                </div>
              </div>
              
            </div>
          )}
        </CardContent>

        {/* Footer Actions */}
        <div className="border-t px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => setActiveStep(steps[currentStepIndex - 1].id)}
                  size="sm"
                >
                  <ChevronLeft className="h-3 w-3 mr-1" />
                  <span className="text-xs">Previous</span>
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {onCancel && (
                <Button variant="outline" onClick={onCancel} size="sm">
                  <span className="text-xs">Cancel</span>
                </Button>
              )}
              
              {activeStep !== 'review' ? (
                <Button
                  onClick={() => setActiveStep(steps[currentStepIndex + 1].id)}
                  disabled={!canProceedToNext()}
                  size="sm"
                >
                  <span className="text-xs">Next</span>
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !isFormValid}
                  className="min-w-[120px]"
                  size="sm"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" />
                      <span className="text-xs">Creating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      <span className="text-xs">Pawn My Items!</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* New Customer Dialog - Matching Customer Hub Design */}
      <Dialog open={showNewCustomerForm} onOpenChange={setShowNewCustomerForm}>
        <DialogContent className="sm:max-w-[600px] bg-gradient-to-br from-slate-50/95 via-blue-50/30 to-indigo-50/40 dark:from-slate-950/95 dark:via-slate-900/95 dark:to-slate-800/95 backdrop-blur-xl border-0 shadow-2xl">
          {/* Gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500"></div>
          
          <DialogHeader className="pb-6 pt-4">
            <div className="flex items-center space-x-4 mb-4">
              {/* Vault Logo */}
              <div className="w-12 h-12 rounded-full border-2 border-amber-500 bg-gradient-to-br from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700 shadow-lg flex items-center justify-center">
                <div className="w-7 h-7 rounded-full border border-amber-400 bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <div className="w-3 h-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-sm"></div>
                </div>
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Add New Customer
                </DialogTitle>
                <DialogDescription className="text-slate-600 dark:text-slate-400 mt-1">
                  Create a new customer profile with encrypted data storage.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={async (e) => {
            e.preventDefault();
            setCreatingCustomer(true);
            
            try {
              const response = await customerService.createCustomer({
                first_name: newCustomerData.first_name.trim(),
                last_name: newCustomerData.last_name.trim(),
                phone_number: newCustomerData.phone_number.trim(),
                email: newCustomerData.email?.trim() || undefined,
                notes: newCustomerData.notes?.trim() || undefined
              });
              
              setCustomers([...customers, response]);
              selectCustomer(response);
              setShowNewCustomerForm(false);
              setNewCustomerData({ first_name: '', last_name: '', phone_number: '', email: '', notes: '' });
              handleSuccess('Customer created successfully');
            } catch (err) {
              handleError(err, 'Creating customer');
            } finally {
              setCreatingCustomer(false);
            }
          }}>
            
            {/* Personal Information Section */}
            <div className="p-6 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-700/50 shadow-lg mb-6">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <User className="w-3 h-3 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Personal Information</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="new_first_name" className="text-sm font-medium text-slate-700 dark:text-slate-300">First Name</Label>
                  <Input
                    id="new_first_name"
                    placeholder="John"
                    value={newCustomerData.first_name}
                    onChange={(e) => setNewCustomerData(prev => ({ ...prev, first_name: e.target.value }))}
                    disabled={creatingCustomer}
                    required
                    className="bg-white/70 dark:bg-slate-700/70 border-slate-200/50 dark:border-slate-600/50 focus:border-orange-500 dark:focus:border-orange-400 focus:ring-orange-500/20 backdrop-blur-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="new_last_name" className="text-sm font-medium text-slate-700 dark:text-slate-300">Last Name</Label>
                  <Input
                    id="new_last_name"
                    placeholder="Doe"
                    value={newCustomerData.last_name}
                    onChange={(e) => setNewCustomerData(prev => ({ ...prev, last_name: e.target.value }))}
                    disabled={creatingCustomer}
                    required
                    className="bg-white/70 dark:bg-slate-700/70 border-slate-200/50 dark:border-slate-600/50 focus:border-orange-500 dark:focus:border-orange-400 focus:ring-orange-500/20 backdrop-blur-sm"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="p-6 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-700/50 shadow-lg mb-6">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                  <Phone className="w-3 h-3 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Contact Information</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="new_phone" className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number</Label>
                  <Input
                    id="new_phone"
                    placeholder="1234567890"
                    value={newCustomerData.phone_number}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setNewCustomerData(prev => ({ ...prev, phone_number: cleaned }));
                    }}
                    disabled={creatingCustomer}
                    required
                    maxLength="10"
                    className="bg-white/70 dark:bg-slate-700/70 border-slate-200/50 dark:border-slate-600/50 focus:border-orange-500 dark:focus:border-orange-400 focus:ring-orange-500/20 backdrop-blur-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="new_email" className="text-sm font-medium text-slate-700 dark:text-slate-300">Email (Optional)</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <Input
                      id="new_email"
                      type="email"
                      placeholder="john.doe@email.com"
                      value={newCustomerData.email}
                      onChange={(e) => setNewCustomerData(prev => ({ ...prev, email: e.target.value }))}
                      disabled={creatingCustomer}
                      className="pl-10 bg-white/70 dark:bg-slate-700/70 border-slate-200/50 dark:border-slate-600/50 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500/20 backdrop-blur-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Internal Notes Section */}
            <div className="p-6 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-700/50 shadow-lg mb-6">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-3 h-3 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Internal Notes</h3>
              </div>
              
              <div>
                <Label htmlFor="new_notes" className="text-sm font-medium text-slate-700 dark:text-slate-300">Internal Notes</Label>
                <Textarea
                  id="new_notes"
                  placeholder="Internal notes about this customer (confidential staff use only)..."
                  value={newCustomerData.notes}
                  onChange={(e) => setNewCustomerData(prev => ({ ...prev, notes: e.target.value }))}
                  disabled={creatingCustomer}
                  className="min-h-[100px] bg-white/70 dark:bg-slate-700/70 border-slate-200/50 dark:border-slate-600/50 focus:border-violet-500 dark:focus:border-violet-400 focus:ring-violet-500/20 backdrop-blur-sm resize-none mt-2"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <DialogFooter className="gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowNewCustomerForm(false);
                  setNewCustomerData({ first_name: '', last_name: '', phone_number: '', email: '', notes: '' });
                }}
                disabled={creatingCustomer}
                className="px-8 py-2 bg-white/70 dark:bg-slate-700/70 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 backdrop-blur-sm"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={creatingCustomer || !newCustomerData.first_name || !newCustomerData.last_name || !newCustomerData.phone_number}
                className="px-8 py-2 bg-pawn-accent hover:bg-pawn-accent/90 text-white shadow-lg shadow-pawn-accent/25 disabled:opacity-50"
              >
                {creatingCustomer ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>Create Customer</span>
                  </div>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatePawnFormRedesigned;