import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Save,
  RotateCcw,
  Info,
  User,
  Loader2,
  TrendingUp,
  Shield,
  UserPlus,
  Building2,
  AlertCircle,
  Check,
  CreditCard
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Progress } from '../ui/progress';
import customerService from '../../services/customerService';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { isAdmin as isAdminRole } from '../../utils/roleUtils';

const CustomCreditLimitDialog = ({ 
  open, 
  onOpenChange, 
  customer, 
  eligibilityData,
  onCustomerUpdate,
  onEligibilityUpdate 
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [customLimit, setCustomLimit] = useState('');
  const [reason, setReason] = useState('');
  const [systemDefault] = useState(3000); // Still used for calculations
  const [selectedUseCase, setSelectedUseCase] = useState(null);
  const [localEligibilityData, setLocalEligibilityData] = useState(eligibilityData);

  const isAdmin = isAdminRole(user);

  // Predefined use cases for credit limits
  const useCases = [
    { 
      id: 'vip',
      icon: TrendingUp,
      title: 'VIP Customer',
      range: '$15,000-$25,000',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
      description: 'High-value customer with excellent payment history'
    },
    { 
      id: 'new',
      icon: UserPlus,
      title: 'New Customer',
      range: '$500-$2,000',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      description: 'Building trust with limited initial exposure'
    },
    { 
      id: 'risk',
      icon: Shield,
      title: 'High Risk',
      range: '$1,000-$3,000',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950/20',
      description: 'Requires closer monitoring and control'
    },
    { 
      id: 'business',
      icon: Building2,
      title: 'Business Client',
      range: '$25,000-$50,000',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950/20',
      description: 'Higher volume for business operations'
    }
  ];

  useEffect(() => {
    if (open && customer) {
      // Start with empty field to show placeholder text
      setCustomLimit('');
      setReason('');
      setSelectedUseCase(null);
      
      // Ensure we have the latest eligibility data when dialog opens
      setLocalEligibilityData(eligibilityData);
    }
  }, [open, customer, eligibilityData]); // Re-initialize when dialog opens or when customer credit limit changes
  
  // Sync local eligibility data when prop changes
  useEffect(() => {
    setLocalEligibilityData(eligibilityData);
  }, [eligibilityData]);

  const handleUseCaseSelect = (useCase) => {
    setSelectedUseCase(useCase);
    
    // Set suggested values based on use case
    const suggestions = {
      'vip': '20000',
      'new': '1000', 
      'risk': '2000',
      'business': '40000'  // Updated to stay within $50K limit
    };
    
    setCustomLimit(suggestions[useCase.id] || '');
    setReason(`Setting ${useCase.title.toLowerCase()} credit limit - ${useCase.description.toLowerCase()}`);
  };

  const handleReset = () => {
    // Check if customer has active transactions that would prevent reset
    if (currentCreditUsed > systemDefault) {
      toast.error(`Cannot reset to system default ($${systemDefault.toLocaleString()}) because customer currently has $${currentCreditUsed.toLocaleString()} in active transactions. Please wait for transactions to be completed or set a higher custom limit.`);
      return;
    }
    
    setCustomLimit('');
    setReason('Resetting to system default credit limit');
    setSelectedUseCase(null);
  };

  const handleSave = async () => {
    if (!isAdmin) {
      toast.error("Only admin users can modify credit limits.");
      return;
    }

    if (!reason.trim()) {
      toast.error("Please provide a reason for this change.");
      return;
    }

    // Validate custom limit input
    if (customLimit !== '' && customLimit.trim() === '') {
      toast.error("Please enter a valid credit limit amount.");
      return;
    }

    const limitNumber = customLimit === '' ? null : parseFloat(customLimit);
    
    // Check for invalid number conversion
    if (customLimit !== '' && (limitNumber === null || isNaN(limitNumber))) {
      toast.error("Please enter a valid number for the credit limit.");
      return;
    }
    
    // Check range validation (match backend limit)
    if (limitNumber !== null && (limitNumber < 0 || limitNumber > 50000)) {
      toast.error("Credit limit must be between $0 and $50,000, or leave empty to use system default.");
      return;
    }

    // Check if trying to set the same value as current
    if (limitNumber === currentEffectiveLimit) {
      toast.error(`The credit limit is already set to $${limitNumber.toLocaleString()}. No change needed.`);
      return;
    }

    // Check if new limit is below current usage
    if (limitNumber !== null && limitNumber < currentCreditUsed) {
      toast.error(`Cannot set limit below current usage ($${currentCreditUsed.toLocaleString()} is currently in use).`);
      return;
    }

    setLoading(true);
    try {
      // Send credit_limit as string to match backend Decimal expectation
      const updateData = {
        credit_limit: limitNumber !== null ? limitNumber.toString() : null
      };


      const updatedCustomer = await customerService.updateCustomer(customer.phone_number, updateData);
      
      // Immediate optimistic UI update for Current Utilization
      const newCreditLimit = limitNumber !== null ? limitNumber : systemDefault;
      const updatedEligibilityData = {
        ...localEligibilityData,
        credit_limit: newCreditLimit,
        available_credit: newCreditLimit - (localEligibilityData?.credit_used || 0)
      };
      setLocalEligibilityData(updatedEligibilityData);
      
      // Notify parent component of eligibility data change
      if (onEligibilityUpdate) {
        onEligibilityUpdate(updatedEligibilityData);
      }
      
      // Immediate UI updates with real-time data refresh
      if (onCustomerUpdate) {
        onCustomerUpdate(updatedCustomer);
      }
      
      onOpenChange(false);
      
      toast.success(limitNumber ? 
        `Credit limit set to $${limitNumber.toLocaleString()}` : 
        "Credit limit reset to system default"
      );
      
      // Allow parent component update to complete first, then refresh cache
      setTimeout(async () => {
        await customerService.forceRefresh();
        
        // Trigger real-time update for other components after parent is updated
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('customer-data-updated', {
            detail: { customer: updatedCustomer, type: 'credit_limit' }
          }));
        }
      }, 100);
      
    } catch (error) {
      
      // Extract user-friendly error message
      let errorMessage = "Failed to update credit limit. Please try again.";
      
      // Check for different error response structures
      const status = error.response?.status || error.status;
      const errorDetail = error.response?.data?.detail || error.data?.detail;
      const errorData = error.response?.data;
      
      // Special handling for 500 errors that might have succeeded
      if (status === 500 && errorData && errorData.request_id) {
        errorMessage = "The server encountered an error while processing your request. The credit limit may have been updated successfully. Please check the customer information to verify if the change was applied.";
      } else if (errorDetail) {
        // Using server error detail for user display
        errorMessage = errorDetail;
      } else if (status === 500) {
        errorMessage = "Server error occurred. Please contact support if this continues.";
      } else if (status === 403) {
        errorMessage = "You don't have permission to perform this action.";
      } else if (status === 404) {
        errorMessage = "Customer not found. Please refresh and try again.";
      } else if (status === 422) {
        errorMessage = "Invalid data format. Please check your input and try again.";
      } else if (error.message && error.message.includes('500')) {
        errorMessage = "Server error occurred. Please contact support if this continues.";
      } else if (error.message && !error.message.includes('HTTP error')) {
        errorMessage = error.message;
      }
      
      // Display error message to user with appropriate severity
      if (status === 500 && errorData && errorData.request_id) {
        toast.error(errorMessage, {
          duration: 8000, // Longer duration for important message
          action: {
            label: 'Check Status',
            onClick: () => {
              // Force refresh eligibility data to check current status
              if (onEligibilityUpdate) {
                setTimeout(() => {
                  window.location.reload();
                }, 500);
              }
            }
          }
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!customer) return null;

  // Use eligibility data for real-time updates, fallback to customer data
  const currentEffectiveLimit = localEligibilityData?.credit_limit || parseFloat(customer.credit_limit) || systemDefault;
  const isUsingCustomLimit = (localEligibilityData?.credit_limit || customer.credit_limit) && currentEffectiveLimit !== systemDefault;
  const currentCreditUsed = localEligibilityData?.credit_used || 0;
  const creditUtilization = (currentCreditUsed / currentEffectiveLimit) * 100;
  
  // Fix: Handle empty input and ensure proper number comparison
  const limitValue = customLimit && customLimit.trim() !== '' ? parseFloat(customLimit) : null;
  const isIncrease = limitValue !== null && limitValue > currentEffectiveLimit;
  const isDecrease = limitValue !== null && limitValue < currentEffectiveLimit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="pb-6">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="block">Set Custom Credit Limit</span>
              <span className="text-sm font-normal text-slate-600 dark:text-slate-400">
                Customize credit capacity for {customer.first_name} {customer.last_name}
              </span>
            </div>
          </DialogTitle>
          <DialogDescription>
            Configure a custom credit limit specifically for this customer, overriding the default system limits.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Customer Overview Card */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-xl p-6 border border-slate-200 dark:border-slate-600">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Info */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-lg shadow-md flex items-center justify-center">
                  <User className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{customer.first_name} {customer.last_name}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {customerService.formatPhoneNumber(customer.phone_number)}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                      Active Customer
                    </Badge>
                    {isUsingCustomLimit && (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                        Custom Limit
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Credit Status */}
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Current Utilization</span>
                  <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    ${currentCreditUsed.toLocaleString()} / ${currentEffectiveLimit.toLocaleString()}
                  </span>
                </div>
                <Progress value={creditUtilization} className="h-2" />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{creditUtilization.toFixed(0)}% utilized</span>
                  <span>${(currentEffectiveLimit - currentCreditUsed).toLocaleString()} available</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Templates */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Quick Templates</Label>
            <div className="grid grid-cols-2 gap-3">
              {useCases.map((useCase) => {
                const Icon = useCase.icon;
                return (
                  <button
                    key={useCase.id}
                    onClick={() => handleUseCaseSelect(useCase)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedUseCase?.id === useCase.id
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`${useCase.bgColor} p-2 rounded-lg`}>
                        <Icon className={`h-4 w-4 ${useCase.color}`} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{useCase.title}</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          {useCase.description}
                        </p>
                        <p className={`text-xs font-medium mt-2 ${useCase.color}`}>
                          Limit: {useCase.range}
                        </p>
                      </div>
                      {selectedUseCase?.id === useCase.id && (
                        <Check className="h-4 w-4 text-amber-600 shrink-0 mt-1" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Manual Input Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customLimit" className="font-medium">
                Custom Credit Limit
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="customLimit"
                    type="number"
                    min="0"
                    max="50000"
                    value={customLimit}
                    onChange={(e) => {
                      setCustomLimit(e.target.value);
                    }}
                    placeholder="Enter custom limit or leave empty for default"
                    className="pr-20 pl-12 h-12 text-lg font-medium border-2 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <DollarSign className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                    <span className="font-medium">$0-$50K</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="default"
                  onClick={handleReset}
                  className="h-12 px-4 border-2 border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-950 transition-all duration-200"
                  title="Reset to system default"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>
            
            {/* Warning for invalid limit */}
            {customLimit && parseFloat(customLimit) < currentCreditUsed && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-red-800 dark:text-red-300">
                      Invalid Limit
                    </p>
                    <p className="text-red-700 dark:text-red-400 mt-1">
                      Cannot set limit to ${parseFloat(customLimit).toLocaleString()} - customer currently has ${currentCreditUsed.toLocaleString()} in use.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

              {/* Reason Input */}
              <div className="space-y-2">
                <Label htmlFor="reason" className="font-medium flex items-center gap-2">
                  Reason for Change
                  <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide a clear business justification for this limit change..."
                  rows={3}
                  className="resize-none border-2 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all duration-200"
                  required
                />
                <p className="text-xs text-slate-500">This will be recorded in the audit trail</p>
              </div>

              {/* Visual Impact Indicator */}
              {customLimit && (
                <div className={`rounded-xl p-4 border-2 transition-all duration-300 ${
                  isIncrease ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 shadow-emerald-200/50 shadow-lg' :
                  isDecrease ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 shadow-orange-200/50 shadow-lg' :
                  'bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      isIncrease ? 'bg-emerald-100 dark:bg-emerald-900/50' :
                      isDecrease ? 'bg-orange-100 dark:bg-orange-900/50' :
                      'bg-slate-100 dark:bg-slate-800'
                    }`}>
                      <AlertCircle className={`h-4 w-4 ${
                        isIncrease ? 'text-emerald-600 dark:text-emerald-400' :
                        isDecrease ? 'text-orange-600 dark:text-orange-400' :
                        'text-slate-600 dark:text-slate-400'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        isIncrease ? 'text-emerald-800 dark:text-emerald-300' :
                        isDecrease ? 'text-orange-800 dark:text-orange-300' :
                        'text-slate-800 dark:text-slate-300'
                      }`}>
                        {isIncrease ? `Increasing limit by $${(limitValue - currentEffectiveLimit).toLocaleString()}` :
                         isDecrease ? `Decreasing limit by $${(currentEffectiveLimit - limitValue).toLocaleString()}` :
                         'Reset to system default'}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {customLimit === '' || limitValue === null ? 
                          `Customer will use system default of $${systemDefault.toLocaleString()} credit limit` :
                          `Customer can have up to $${limitValue.toLocaleString()} in active transactions`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

          {/* System Info */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center shrink-0">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                  System Default Information
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Current system default: <span className="font-bold text-blue-900 dark:text-blue-100">${systemDefault.toLocaleString()}</span> credit limit
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Individual customer limits override the system default when set.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-6 mt-2 border-t-2 border-slate-200 dark:border-slate-700">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-11 px-6 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
          >
            Cancel
          </Button>
          <div className="flex gap-3">
            {customLimit !== (customer.credit_limit?.toString() || '') && (
              <span className="text-sm text-slate-500 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1 text-amber-500" />
                Unsaved changes
              </span>
            )}
            <Button
              onClick={handleSave}
              disabled={loading || !reason.trim()}
              className="h-11 px-6 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomCreditLimitDialog;