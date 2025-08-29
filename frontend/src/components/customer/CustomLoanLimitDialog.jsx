import React, { useState, useEffect } from 'react';
import {
  Gauge,
  Save,
  RotateCcw,
  AlertTriangle,
  Info,
  User,
  Loader2,
  TrendingUp,
  Shield,
  UserPlus,
  Building2,
  AlertCircle,
  Check
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../ui/alert';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Progress } from '../ui/progress';
import customerService from '../../services/customerService';
import { useToast } from '../ui/toast';
import { useAuth } from '../../context/AuthContext';
import { isAdmin as isAdminRole } from '../../utils/roleUtils';

const CustomLoanLimitDialog = ({ 
  open, 
  onOpenChange, 
  customer, 
  onCustomerUpdate 
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [customLimit, setCustomLimit] = useState('');
  const [reason, setReason] = useState('');
  const [systemDefault, setSystemDefault] = useState(8);
  const [selectedUseCase, setSelectedUseCase] = useState(null);

  const isAdmin = isAdminRole(user);

  // Predefined use cases for better UX
  const useCases = [
    { 
      id: 'vip',
      icon: TrendingUp,
      title: 'VIP Customer',
      range: '15-20',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
      description: 'Loyal customer with excellent payment history'
    },
    { 
      id: 'new',
      icon: UserPlus,
      title: 'New Customer',
      range: '2-3',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      description: 'Building trust with limited initial exposure'
    },
    { 
      id: 'risk',
      icon: Shield,
      title: 'High Risk',
      range: '3-5',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950/20',
      description: 'Requires closer monitoring and control'
    },
    { 
      id: 'business',
      icon: Building2,
      title: 'Business Client',
      range: '20+',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950/20',
      description: 'Higher volume for business operations'
    }
  ];

  useEffect(() => {
    if (open && customer) {
      // Initialize with customer's current custom limit or empty
      setCustomLimit(customer.custom_loan_limit?.toString() || '');
      setReason('');
      setSelectedUseCase(null);
      
      // Load system default
      loadSystemDefault();
    }
  }, [open, customer]);

  const loadSystemDefault = async () => {
    try {
      const defaultLimit = await customerService.getCurrentMaxLoans();
      setSystemDefault(defaultLimit);
    } catch (error) {
      console.warn('Failed to load system default, using fallback:', error);
      setSystemDefault(8);
    }
  };

  const handleUseCaseClick = (useCase) => {
    setSelectedUseCase(useCase.id);
    
    // Auto-populate based on use case
    switch(useCase.id) {
      case 'vip':
        setCustomLimit('15');
        setReason('VIP customer with excellent payment history and long-term relationship');
        break;
      case 'new':
        setCustomLimit('3');
        setReason('New customer - starting with limited exposure to build trust');
        break;
      case 'risk':
        setCustomLimit('5');
        setReason('Requires closer monitoring due to payment history concerns');
        break;
      case 'business':
        setCustomLimit('20');
        setReason('Business client requiring higher transaction volume for operations');
        break;
    }
  };

  const handleSave = async () => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only admin users can modify loan limits.",
        variant: "destructive",
      });
      return;
    }

    if (!reason.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a reason for this change.",
        variant: "destructive",
      });
      return;
    }

    const limitNumber = customLimit === '' ? null : parseInt(customLimit);
    
    if (limitNumber !== null && (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 50)) {
      toast({
        title: "Invalid Limit",
        description: "Loan limit must be between 1 and 50, or leave empty to use system default.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const updateData = {
        custom_loan_limit: limitNumber,
        // Add reason to notes for audit trail
        notes: customer.notes ? 
          `${customer.notes}\n\n[${new Date().toISOString()}] Loan limit ${limitNumber ? `set to ${limitNumber}` : 'reset to system default'} by ${user.user_id}: ${reason.trim()}` :
          `[${new Date().toISOString()}] Loan limit ${limitNumber ? `set to ${limitNumber}` : 'reset to system default'} by ${user.user_id}: ${reason.trim()}`
      };

      const updatedCustomer = await customerService.updateCustomer(customer.phone_number, updateData);
      
      if (onCustomerUpdate) {
        onCustomerUpdate(updatedCustomer);
      }
      
      onOpenChange(false);
      
      toast({
        title: "Loan Limit Updated",
        description: limitNumber ? 
          `Custom loan limit set to ${limitNumber} for ${customer.first_name} ${customer.last_name}.` :
          `Loan limit reset to system default (${systemDefault}) for ${customer.first_name} ${customer.last_name}.`,
      });

      // Force refresh customer data
      await customerService.forceRefresh();
      
    } catch (error) {
      console.error('Failed to update loan limit:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update loan limit.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCustomLimit('');
    setReason('Reset to system default');
    setSelectedUseCase(null);
  };

  if (!customer) return null;

  const currentEffectiveLimit = customer.custom_loan_limit || systemDefault;
  const isUsingCustomLimit = customer.custom_loan_limit !== null && customer.custom_loan_limit !== undefined;
  const loanUtilization = (customer.active_loans / currentEffectiveLimit) * 100;
  const limitValue = customLimit ? parseInt(customLimit) : systemDefault;
  const isIncrease = limitValue > currentEffectiveLimit;
  const isDecrease = limitValue < currentEffectiveLimit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="pb-6">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Gauge className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="block">Set Custom Loan Limit</span>
              <span className="text-sm font-normal text-slate-600 dark:text-slate-400">
                Customize loan capacity for {customer.first_name} {customer.last_name}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        {!isAdmin ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              Only admin users can modify individual customer loan limits.
            </AlertDescription>
          </Alert>
        ) : (
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

                {/* Loan Status */}
                <div className="space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Current Utilization</span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {customer.active_loans} / {currentEffectiveLimit}
                    </span>
                  </div>
                  <Progress value={loanUtilization} className="h-2" />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{loanUtilization.toFixed(0)}% utilized</span>
                    <span>{currentEffectiveLimit - customer.active_loans} slots available</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Select Use Cases */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Quick Templates</Label>
              <div className="grid grid-cols-2 gap-3">
                {useCases.map((useCase) => {
                  const Icon = useCase.icon;
                  return (
                    <button
                      key={useCase.id}
                      onClick={() => handleUseCaseClick(useCase)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        selectedUseCase === useCase.id
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
                        {selectedUseCase === useCase.id && (
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
                  Custom Loan Limit
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="customLimit"
                      type="number"
                      min="1"
                      max="50"
                      value={customLimit}
                      onChange={(e) => {
                        setCustomLimit(e.target.value);
                        setSelectedUseCase(null);
                      }}
                      placeholder={`Default: ${systemDefault}`}
                      className="pr-20 pl-12 h-12 text-lg font-medium border-2 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Gauge className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                      <span className="font-medium">1-50</span>
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
                        {isIncrease ? `Increasing limit by ${limitValue - currentEffectiveLimit}` :
                         isDecrease ? `Decreasing limit by ${currentEffectiveLimit - limitValue}` :
                         'No change from current limit'}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {customLimit === '' ? 
                          `Customer will use system default of ${systemDefault} active loans` :
                          `Customer can have up to ${limitValue} active loans simultaneously`
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
                    Current system default: <span className="font-bold text-blue-900 dark:text-blue-100">{systemDefault}</span> active loans
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Individual customer limits override the system default when set.
                  </p>
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
                {customLimit !== (customer.custom_loan_limit?.toString() || '') && (
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CustomLoanLimitDialog;