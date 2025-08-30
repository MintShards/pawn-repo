import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, User, Package, DollarSign, FileText, Clock, 
  Plus, X, CheckCircle, AlertCircle, HelpCircle,
  Calculator, CreditCard, ArrowRight, ArrowLeft, Shield, Zap
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Separator } from '../ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Badge } from '../ui/badge';
import transactionService from '../../services/transactionService';
import customerService from '../../services/customerService';
import { useFormValidation, validateRequired, validateAmount, validateItemDescription, createValidationResult } from '../../utils/formValidation';
import { handleError, handleSuccess } from '../../utils/errorHandling';
import { useDebounce } from '../../hooks/useDebounce';
import ConfirmationDialog from '../common/ConfirmationDialog';
import LoadingDialog from '../common/LoadingDialog';


const CreatePawnDialogRedesigned = ({ onSuccess, onCancel }) => {
  // Current active tab
  const [activeTab, setActiveTab] = useState('customer');
  const [completedTabs, setCompletedTabs] = useState(new Set());

  // Form validation setup
  const formValidators = {
    customer_id: (value) => validateRequired(value, 'Customer'),
    loan_amount: (value) => validateAmount(value, 'Loan amount', { min: 1, max: 50000 }),
    monthly_interest_amount: (value) => validateAmount(value, 'Monthly interest', { min: 0, allowZero: true }),
    items: (items) => {
      if (!items || items.length === 0) {
        return createValidationResult(false, 'At least one item is required');
      }
      for (let i = 0; i < items.length; i++) {
        const itemResult = validateItemDescription(items[i].description);
        if (!itemResult.isValid) {
          return createValidationResult(false, `Item ${i + 1}: ${itemResult.message}`);
        }
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
  const debouncedSearchTerm = useDebounce(customerSearchTerm, 300);

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
    
    return {
      loanAmount,
      monthlyInterest,
      maturityDate: new Date(new Date().setMonth(new Date().getMonth() + 3)), // 3 months from now
      totalWithInterest: loanAmount + monthlyInterest
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

  // Handle tab changes with validation
  const handleTabChange = useCallback((newTab) => {
    const tabs = ['customer', 'items', 'loan', 'review'];
    const currentIndex = tabs.indexOf(activeTab);
    const newIndex = tabs.indexOf(newTab);
    
    // Validate current tab before moving forward
    if (newIndex > currentIndex) {
      if (activeTab === 'customer' && !formData.customer_id) {
        handleError({ message: 'Please select a customer first' }, 'Tab validation');
        return;
      }
      if (activeTab === 'items' && (!formData.items.length || !formData.items[0].description)) {
        handleError({ message: 'Please add at least one item' }, 'Tab validation');
        return;
      }
      if (activeTab === 'loan' && (!formData.loan_amount || !formData.monthly_interest_amount)) {
        handleError({ message: 'Please complete loan details' }, 'Tab validation');
        return;
      }
    }
    
    setActiveTab(newTab);
    
    // Mark previous tabs as completed when moving forward
    if (newIndex > currentIndex) {
      setCompletedTabs(prev => new Set([...prev, activeTab]));
    }
  }, [activeTab, formData]);

  // Handle item changes
  const handleItemChange = useCallback((index, field, value) => {
    const newItems = formData.items.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
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
    
    setShowConfirmation(true);
  }, [validateAll, eligibilityData]);

  const processTransaction = useCallback(async () => {
    try {
      setSubmitting(true);

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
      
      handleSuccess(`Transaction #${result.transaction_id?.slice(-8)} created successfully`);
      
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      handleError(err, 'Creating transaction');
    } finally {
      setSubmitting(false);
      setShowConfirmation(false);
    }
  }, [formData, onSuccess]);

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
              className="flex items-center justify-center space-x-2 data-[state=active]:bg-pawn-accent data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-200"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Review</span>
            </TabsTrigger>
          </TabsList>

          {/* Customer Selection Tab */}
          <TabsContent value="customer" className="space-y-6 mt-0">
            {/* Step Header with Info Banner */}
            <div className="p-4 bg-pawn-light dark:bg-pawn-medium/30 rounded-xl border border-pawn-medium/20 shadow-sm">
              <div className="flex items-center justify-between mb-3">
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
                    className="pl-10 h-12"
                  />
                  {customerSearchTerm && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCustomerSearchTerm('');
                        setShowCustomerSearch(false);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
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
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {customer.first_name} {customer.last_name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {customer.phone_number}
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
                      <User className="w-6 h-6 mx-auto mb-1 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm">No customers found for "{customerSearchTerm}"</p>
                      <p className="text-xs mt-1">Try searching by name or phone number</p>
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
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {customer.first_name} {customer.last_name}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {customer.phone_number}
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

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
                          <span className="font-semibold text-pawn-dark dark:text-pawn-light">
                            {selectedCustomer.first_name} {selectedCustomer.last_name}
                          </span>
                          <CheckCircle className="w-4 h-4 text-pawn-accent" />
                        </div>
                        <div className="text-sm text-pawn-medium dark:text-pawn-light/80">
                          {selectedCustomer.phone_number} • {selectedCustomer.status || 'Active'}
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
          <TabsContent value="items" className="space-y-6 mt-0">
            {/* Step Header with Info Banner */}
            <div className="p-4 bg-pawn-light dark:bg-pawn-medium/30 rounded-xl border border-pawn-medium/20 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-pawn-dark dark:text-pawn-light flex items-center">
                  <Package className="w-5 h-5 mr-2" />
                  Items & Documentation
                </h3>
                <Badge variant="outline" className="border-pawn-accent text-pawn-accent">
                  Step 2 of 4
                </Badge>
              </div>
              <p className="text-sm text-pawn-medium dark:text-pawn-light/80">
                Add detailed descriptions of items being pawned. Take photos and record serial numbers for verification and security.
              </p>
            </div>

            <div className="space-y-4">
              {formData.items.map((item, index) => (
                <Card key={index} className="border border-pawn-medium/20 dark:border-pawn-medium/40 hover:border-pawn-accent/50 bg-pawn-light dark:bg-pawn-medium/20 shadow-sm transition-colors">
                  <CardHeader className="pb-3 bg-pawn-light dark:bg-pawn-medium/10">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2 text-base font-medium text-pawn-dark dark:text-pawn-light">
                        <div className="w-6 h-6 bg-pawn-accent/10 rounded-md flex items-center justify-center">
                          <Package className="w-3 h-3 text-pawn-accent" />
                        </div>
                        <span>Item #{index + 1}</span>
                      </CardTitle>
                      <div className="flex items-center space-x-2">
                        {formData.items.length > 1 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(index)}
                                className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Remove this item</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Item Description */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor={`item_desc_${index}`} className="text-sm font-medium text-pawn-dark dark:text-pawn-light">
                          Item Description *
                        </Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-4 h-4 text-pawn-medium hover:text-pawn-accent cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Be specific: include brand, model, color, and key features</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id={`item_desc_${index}`}
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        placeholder="e.g., Gold Ring, iPhone 12"
                        className="h-12 text-base"
                        maxLength={200}
                      />
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Be as specific as possible for accurate identification</span>
                        <span>{item.description.length}/200</span>
                      </div>
                    </div>

                    {/* Serial Number */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor={`item_serial_${index}`} className="text-sm font-medium text-pawn-dark dark:text-pawn-light">
                          Serial Number / ID
                        </Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-4 h-4 text-pawn-medium hover:text-pawn-accent cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Record any serial numbers, IMEI, or unique identifiers</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id={`item_serial_${index}`}
                        value={item.serial_number}
                        onChange={(e) => handleItemChange(index, 'serial_number', e.target.value)}
                        placeholder="e.g., SN123456789"
                        className="h-10 font-mono"
                      />
                      <p className="text-xs text-slate-500">
                        Check device settings, battery compartment, or product labels
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Add Item Button */}
              <Button
                type="button"
                variant="dashed"
                onClick={addItem}
                disabled={formData.items.length >= 8}
                className="w-full h-16 border-2 border-dashed border-pawn-medium/30 dark:border-pawn-medium/50 hover:border-pawn-accent hover:bg-pawn-accent/10 transition-colors"
              >
                <Plus className="w-5 h-5 mr-2 text-pawn-accent" />
                <span className="text-pawn-accent">Add Another Item</span>
                <span className="text-xs text-slate-500 ml-2">({formData.items.length}/8)</span>
              </Button>
            </div>

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
                disabled={!formData.items[0]?.description}
                className="bg-pawn-accent hover:bg-pawn-accent/90 text-white"
              >
                Next: Loan Details
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </TabsContent>

          {/* Loan Details Tab */}
          <TabsContent value="loan" className="space-y-6 mt-0">
            <div className="p-4 bg-pawn-light dark:bg-pawn-medium/30 rounded-xl border border-pawn-medium/20 shadow-sm">
              <div className="flex items-center justify-between mb-3">
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
                    step="0.01"
                    min="1"
                    max="50000"
                    value={formData.loan_amount}
                    onChange={(e) => {
                      updateField('loan_amount', e.target.value);
                      if (selectedCustomer && e.target.value) {
                        checkLoanEligibility(selectedCustomer.phone_number, e.target.value);
                      }
                    }}
                    placeholder="Enter loan amount (e.g., 250.00)"
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
                    step="0.01"
                    min="0"
                    max="10000"
                    value={formData.monthly_interest_amount}
                    onChange={(e) => updateField('monthly_interest_amount', e.target.value)}
                    placeholder="Enter monthly interest (e.g., 37.50)"
                    className={getFieldError('monthly_interest_amount') ? 'border-red-500 focus:border-red-500 h-12 text-lg' : 'focus:ring-pawn-accent focus:border-pawn-accent h-12 text-lg font-medium'}
                  />
                  {getFieldError('monthly_interest_amount') && (
                    <div className="text-xs text-red-600 mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {getFieldError('monthly_interest_amount')}
                    </div>
                  )}
                  {formData.loan_amount && formData.monthly_interest_amount && (
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Interest rate: {((parseFloat(formData.monthly_interest_amount) / parseFloat(formData.loan_amount)) * 100).toFixed(1)}% per month
                    </div>
                  )}
                </div>

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
                  <Input
                    id="storage_location"
                    value={formData.storage_location}
                    onChange={(e) => updateField('storage_location', e.target.value)}
                    placeholder="e.g., Shelf A-1, Box 42, Vault Section B"
                    className="focus:ring-pawn-accent focus:border-pawn-accent h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="internal_notes" className="text-sm font-medium">Internal Notes</Label>
                  <Textarea
                    id="internal_notes"
                    value={formData.internal_notes}
                    onChange={(e) => updateField('internal_notes', e.target.value)}
                    placeholder="Optional staff notes about this transaction..."
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
                        {loanCalculations.maturityDate.toLocaleDateString()}
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
                  <Alert variant={eligibilityData.eligible ? "default" : "destructive"}>
                    {eligibilityData.eligible ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <AlertDescription>
                      <div className="space-y-2">
                        <div className="font-medium">
                          {eligibilityData.eligible ? 'Loan Approved' : 'Loan Denied'}
                        </div>
                        <div className="text-sm">
                          Credit Limit: ${eligibilityData.credit_limit?.toLocaleString()}
                        </div>
                        <div className="text-sm">
                          Available: ${eligibilityData.available_credit?.toLocaleString()}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
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
                disabled={!formData.loan_amount || !formData.monthly_interest_amount}
                className="bg-pawn-accent hover:bg-pawn-accent/90 text-white"
              >
                Review Transaction
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </TabsContent>


          {/* Review Tab */}
          <TabsContent value="review" className="space-y-6 mt-0">
            <div className="p-4 bg-pawn-light dark:bg-pawn-medium/30 rounded-xl border border-pawn-medium/20 shadow-sm">
              <div className="flex items-center justify-between mb-3">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer & Financial Summary */}
              <Card className="bg-pawn-light dark:bg-pawn-medium/20 border-pawn-medium/20 dark:border-pawn-medium/40 shadow-lg">
                <CardHeader className="pb-3">
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
                <CardContent className="pt-0 space-y-3">
                  <div className="p-3 bg-white/70 dark:bg-slate-800/70 rounded-lg border border-pawn-medium/20 dark:border-pawn-medium/40">
                    <div className="text-sm text-pawn-accent font-medium mb-2">Customer Information</div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm text-pawn-medium dark:text-pawn-light/80">Name:</span>
                        <span className="font-medium text-pawn-dark dark:text-pawn-light">{selectedCustomer?.first_name} {selectedCustomer?.last_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-pawn-medium dark:text-pawn-light/80">Phone:</span>
                        <span className="font-mono text-pawn-dark dark:text-pawn-light">{selectedCustomer?.phone_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-pawn-medium dark:text-pawn-light/80">Status:</span>
                        <Badge variant="outline" className="text-xs border-pawn-accent text-pawn-accent">
                          {selectedCustomer?.status || 'Active'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white/70 dark:bg-slate-800/70 rounded-lg border border-pawn-medium/20 dark:border-pawn-medium/40">
                      <div className="text-sm text-pawn-accent font-medium">Loan Amount</div>
                      <div className="font-bold text-xl text-pawn-dark dark:text-pawn-light">
                        ${loanCalculations.loanAmount.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 bg-white/70 dark:bg-slate-800/70 rounded-lg border border-pawn-medium/20 dark:border-pawn-medium/40">
                      <div className="text-sm text-pawn-accent font-medium">Monthly Interest</div>
                      <div className="font-bold text-xl text-pawn-dark dark:text-pawn-light">
                        ${loanCalculations.monthlyInterest.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-pawn-accent/10 rounded-lg border border-pawn-accent/30">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-pawn-dark dark:text-pawn-light">Interest Rate:</span>
                      <span className="text-lg font-bold text-pawn-dark dark:text-pawn-light">
                        {formData.loan_amount && formData.monthly_interest_amount ? 
                          ((parseFloat(formData.monthly_interest_amount) / parseFloat(formData.loan_amount)) * 100).toFixed(1) : '0'
                        }% per month
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-pawn-medium dark:text-pawn-light/80 font-medium">Maturity Date:</span>
                      <Badge variant="outline" className="font-mono text-sm px-3 py-1 border-pawn-accent text-pawn-accent">
                        {loanCalculations.maturityDate.toLocaleDateString()}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-pawn-accent/10 rounded-lg border border-pawn-accent/30">
                      <span className="font-bold text-pawn-dark dark:text-pawn-light">Total Amount Due:</span>
                      <span className="text-xl font-bold text-pawn-dark dark:text-pawn-light">
                        ${loanCalculations.totalWithInterest.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Items Summary */}
              <Card className="bg-pawn-light dark:bg-pawn-medium/20 border-pawn-medium/20 dark:border-pawn-medium/40 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <div className="p-2 rounded-lg bg-pawn-accent text-white shadow-md mr-3">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-pawn-dark dark:text-pawn-light">Items Summary</div>
                      <div className="text-sm font-normal text-pawn-medium dark:text-pawn-light/80">{formData.items.length} item{formData.items.length !== 1 ? 's' : ''} in this transaction</div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {formData.items.map((item, index) => (
                      <div key={index} className="p-3 bg-white/70 dark:bg-slate-800/70 rounded-lg border border-pawn-medium/20 dark:border-pawn-medium/40">
                        <div className="flex items-start space-x-2">
                          <div className="w-6 h-6 bg-pawn-accent/10 rounded-md flex items-center justify-center mt-0.5">
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
                    <div className="p-3 bg-pawn-light dark:bg-pawn-medium/10 rounded-lg border border-pawn-medium/20 dark:border-pawn-medium/40 mt-3">
                      {formData.storage_location && (
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-pawn-medium dark:text-pawn-light/80">Storage:</span>
                          <span className="font-mono text-sm text-pawn-dark dark:text-pawn-light">{formData.storage_location}</span>
                        </div>
                      )}
                      {formData.internal_notes && (
                        <div className="mt-2">
                          <div className="text-sm text-pawn-medium dark:text-pawn-light/80 mb-1">Staff Notes:</div>
                          <div className="text-xs text-pawn-dark dark:text-pawn-light bg-white/50 dark:bg-slate-800/50 p-2 rounded border border-pawn-medium/20 dark:border-pawn-medium/40">
                            {formData.internal_notes}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Final Validation & Actions */}
            <div className="space-y-4">
              {/* Eligibility Status */}
              {eligibilityData && (
                <Alert variant={eligibilityData.eligible ? "default" : "destructive"} className="border-2">
                  {eligibilityData.eligible ? (
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      <div>
                        <div className="font-bold text-green-800 dark:text-green-200">✓ Loan Approved</div>
                        <div className="text-sm text-green-700 dark:text-green-300">
                          Credit available: ${eligibilityData.available_credit?.toLocaleString()} of ${eligibilityData.credit_limit?.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                      <div>
                        <div className="font-bold text-red-800 dark:text-red-200">✗ Loan Denied</div>
                        <div className="text-sm text-red-700 dark:text-red-300">
                          Exceeds available credit of ${eligibilityData.available_credit?.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                </Alert>
              )}

              {/* Security Notice */}
              <Alert className="border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50">
                <Shield className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <AlertDescription className="text-sm text-slate-700 dark:text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>This transaction will be permanently recorded and cannot be deleted.</span>
                    <Zap className="h-4 w-4 text-pawn-accent" />
                  </div>
                </AlertDescription>
              </Alert>
            </div>

            {/* Final Actions */}
            <div className="flex justify-between pt-6">
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
                disabled={!isFormValid || (eligibilityData && !eligibilityData.eligible)}
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
              <span className="font-mono text-xs">{formData.storage_location}</span>
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
      </Card>
    </TooltipProvider>
  );
};

export default CreatePawnDialogRedesigned;