import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  DollarSign,
  Shield,
  CheckCircle,
  XCircle,
  Settings,
  Loader2,
  Info,
  CreditCard,
  Target,
  Award,
  Calendar
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import customerService from '../../services/customerService';
import { useToast } from '../ui/toast';
import { useAuth } from '../../context/AuthContext';
import { isAdmin as isAdminRole } from '../../utils/roleUtils';
import CustomLoanLimitDialog from './CustomLoanLimitDialog';
import CustomCreditLimitDialog from './CustomCreditLimitDialog';

const LoanEligibilityManager = ({ customer, onEligibilityUpdate }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [eligibilityData, setEligibilityData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCustomCreditDialog, setShowCustomCreditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showCustomLimitDialog, setShowCustomLimitDialog] = useState(false);

  const isAdmin = isAdminRole(user);



  const checkEligibility = useCallback(async (shouldCallCallback = false) => {
    setLoading(true);
    try {
      const result = await customerService.checkLoanEligibility(
        customer.phone_number
      );
      setEligibilityData(result);
      
      // Only call onEligibilityUpdate when explicitly requested (e.g., credit limit changes)
      if (onEligibilityUpdate && shouldCallCallback) {
        onEligibilityUpdate(result);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to check loan eligibility',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [customer.phone_number, onEligibilityUpdate, toast]);

  // Load initial eligibility data only when customer phone number changes
  useEffect(() => {
    if (customer?.phone_number) {
      checkEligibility(); // Don't call callback on initial load
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.phone_number]); // Only depend on phone number to avoid infinite loops
  
  // Real-time update listener for customer data changes
  useEffect(() => {
    const handleCustomerDataUpdate = (event) => {
      const { customer: updatedCustomer } = event.detail;
      
      // Only refresh if this is the same customer
      if (updatedCustomer?.phone_number === customer?.phone_number) {
        
        // Refresh eligibility data with callback to update parent
        checkEligibility(true);
      }
    };
    
    // Add event listener for real-time updates
    window.addEventListener('customer-data-updated', handleCustomerDataUpdate);
    
    // Cleanup event listener
    return () => {
      window.removeEventListener('customer-data-updated', handleCustomerDataUpdate);
    };
  }, [customer?.phone_number, checkEligibility]);





  if (!customer) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Select a customer to view loan eligibility</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Loan Eligibility Card */}
      <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50/80 to-gray-50/80 dark:from-slate-900/80 dark:to-slate-800/80 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Loan Eligibility Header */}
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              Loan Eligibility
            </h3>
            {loading && !eligibilityData ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Checking eligibility...</span>
              </div>
            ) : eligibilityData ? (
              <div className="space-y-4">
                {/* Large Eligibility Status Box */}
                <div className={`p-4 rounded-lg border-2 transition-colors ${
                  eligibilityData.eligible 
                    ? 'bg-green-700/20 border-green-500' 
                    : 'bg-red-700/20 border-red-500'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      eligibilityData.eligible 
                        ? 'bg-green-100 dark:bg-green-900/30' 
                        : 'bg-red-100 dark:bg-red-900/30'
                    }`}>
                      {eligibilityData.eligible ? (
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold text-lg ${
                        eligibilityData.eligible 
                          ? 'text-green-800 dark:text-green-100' 
                          : 'text-red-800 dark:text-red-100'
                      }`}>
                        {eligibilityData.eligible ? 'Eligible for New Loan' : 'Not Eligible'}
                      </p>
                      {eligibilityData.reasons && eligibilityData.reasons.length > 0 && (
                        <p className={`text-sm mt-1 ${
                          eligibilityData.eligible 
                            ? 'text-green-700 dark:text-green-200' 
                            : 'text-red-700 dark:text-red-200'
                        }`}>
                          {eligibilityData.reasons.join(' • ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Two Column Layout - Credit Info and Loan Slots */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Credit Info Card */}
                  <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
                    <CardHeader className="pb-3 pt-4">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                          <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        Credit Info
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Limit</span>
                        <span className="font-semibold">
                          ${eligibilityData.credit_limit?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Used</span>
                        <span className="font-semibold">
                          ${eligibilityData.credit_used?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Available</span>
                        <span className={`font-semibold ${
                          eligibilityData.available_credit > 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          ${eligibilityData.available_credit?.toLocaleString() || 0}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Loan Slots Card */}
                  <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
                    <CardHeader className="pb-3 pt-4">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                          <Target className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        Loan Slots
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Maximum</span>
                        <span className="font-semibold">
                          {eligibilityData.max_loans || 8}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">In Use</span>
                        <span className="font-semibold">
                          {eligibilityData.slots_used || eligibilityData.active_loans || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Available</span>
                        <span className={`font-semibold ${
                          (eligibilityData.slots_available !== undefined ? eligibilityData.slots_available : (eligibilityData.max_loans - eligibilityData.active_loans)) > 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {eligibilityData.slots_available !== undefined ? eligibilityData.slots_available : ((eligibilityData.max_loans - eligibilityData.active_loans) || 0)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading eligibility data...</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

    <div className="space-y-4">
      {/* Admin Controls */}
      {isAdmin && (
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50/80 to-gray-50/80 dark:from-slate-900/80 dark:to-slate-800/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <Settings className="w-5 h-5 text-white" />
              </div>
              Admin Controls
            </h3>
            <div className="space-y-3">
              {/* Set Custom Credit Limit */}
              <Button 
                variant="outline" 
                className="w-full justify-start bg-white/60 dark:bg-slate-800/60 hover:bg-white/80 dark:hover:bg-slate-800/80 border-slate-200/50 dark:border-slate-700/50 shadow-sm"
                onClick={() => {
                  // Refresh eligibility data before opening dialog
                  checkEligibility();
                  setShowCustomCreditDialog(true);
                }}
              >
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-3">
                  <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                Set Custom Credit Limit
              </Button>

              {/* Set Custom Loan Limit */}
              <Button 
                variant="outline" 
                className="w-full justify-start bg-white/60 dark:bg-slate-800/60 hover:bg-white/80 dark:hover:bg-slate-800/80 border-slate-200/50 dark:border-slate-700/50 shadow-sm"
                onClick={() => {
                  // Refresh eligibility data before opening dialog
                  checkEligibility();
                  setShowCustomLimitDialog(true);
                }}
              >
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mr-3">
                  <Target className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                Set Custom Loan Limit
              </Button>

              {/* View Details */}
              <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-start bg-white/60 dark:bg-slate-800/60 hover:bg-white/80 dark:hover:bg-slate-800/80 border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mr-3">
                      <Info className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    View Full Details
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-slate-50 dark:bg-slate-900 [&>button]:z-50">
                  <DialogHeader className="sticky top-0 bg-slate-50 dark:bg-slate-900 pb-4 pr-12 border-b border-slate-200 dark:border-slate-700 z-40">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 flex items-center justify-center shadow-lg flex-shrink-0">
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                          Loan Eligibility Details
                        </DialogTitle>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {customerService.getCustomerFullName(customer)}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500">•</span>
                          <span className="font-mono text-slate-600 dark:text-slate-400">
                            {customer.phone_number.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </DialogHeader>
                  {eligibilityData && (
                    <div className="space-y-5 pt-4">
                      {/* Status Banner */}
                      <div className={`p-5 rounded-xl border-2 shadow-sm ${
                        eligibilityData.eligible
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-500'
                      }`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-md ${
                            eligibilityData.eligible
                              ? 'bg-green-500 dark:bg-green-600'
                              : 'bg-red-500 dark:bg-red-600'
                          }`}>
                            {eligibilityData.eligible ? (
                              <CheckCircle className="w-7 h-7 text-white" />
                            ) : (
                              <XCircle className="w-7 h-7 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className={`font-bold text-xl ${
                              eligibilityData.eligible
                                ? 'text-green-700 dark:text-green-200'
                                : 'text-red-700 dark:text-red-200'
                            }`}>
                              {eligibilityData.eligible ? 'Eligible for New Loan' : 'Not Eligible for New Loan'}
                            </p>
                            {eligibilityData.reasons && eligibilityData.reasons.length > 0 && (
                              <p className={`text-sm mt-1.5 ${
                                eligibilityData.eligible
                                  ? 'text-green-600 dark:text-green-300'
                                  : 'text-red-600 dark:text-red-300'
                              }`}>
                                {eligibilityData.reasons.join(' • ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Credit Information Section */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          Credit Information
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {/* Credit Limit */}
                          <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                            <CardContent className="p-4">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Credit Limit</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">${eligibilityData.credit_limit?.toLocaleString()}</p>
                            </CardContent>
                          </Card>

                          {/* Credit Used */}
                          <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                            <CardContent className="p-4">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Credit Used</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">${eligibilityData.credit_used?.toLocaleString()}</p>
                            </CardContent>
                          </Card>

                          {/* Available Credit */}
                          <Card className={`border ${
                            eligibilityData.available_credit > 0
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                              : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                          }`}>
                            <CardContent className="p-4">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Available</p>
                              <p className={`text-2xl font-bold ${
                                eligibilityData.available_credit > 0
                                  ? 'text-green-700 dark:text-green-300'
                                  : 'text-red-700 dark:text-red-300'
                              }`}>
                                ${eligibilityData.available_credit?.toLocaleString()}
                              </p>
                            </CardContent>
                          </Card>

                          {/* Credit Utilization */}
                          <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                            <CardContent className="p-4">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Utilization</p>
                              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {eligibilityData.credit_limit > 0 ? Math.round((eligibilityData.credit_used / eligibilityData.credit_limit) * 100) : 0}%
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      <Separator />

                      {/* Loan Capacity Section */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                          <Target className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          Loan Capacity
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {/* Active Loans */}
                          <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                            <CardContent className="p-4">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Active Loans</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                {eligibilityData.slots_used || eligibilityData.active_loans}
                              </p>
                            </CardContent>
                          </Card>

                          {/* Maximum Loans */}
                          <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                            <CardContent className="p-4">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Maximum</p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                {eligibilityData.max_loans}
                              </p>
                            </CardContent>
                          </Card>

                          {/* Remaining Slots */}
                          <Card className={`border ${
                            (eligibilityData.slots_available !== undefined ? eligibilityData.slots_available : (eligibilityData.max_loans - eligibilityData.active_loans)) > 0
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                              : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                          }`}>
                            <CardContent className="p-4">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Remaining</p>
                              <p className={`text-2xl font-bold ${
                                (eligibilityData.slots_available !== undefined ? eligibilityData.slots_available : (eligibilityData.max_loans - eligibilityData.active_loans)) > 0
                                  ? 'text-green-700 dark:text-green-300'
                                  : 'text-red-700 dark:text-red-300'
                              }`}>
                                {eligibilityData.slots_available !== undefined ? eligibilityData.slots_available : ((eligibilityData.max_loans - eligibilityData.active_loans) || 0)}
                              </p>
                            </CardContent>
                          </Card>

                          {/* Slot Utilization */}
                          <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                            <CardContent className="p-4">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Utilization</p>
                              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                {Math.round(((eligibilityData.slots_used || eligibilityData.active_loans) / eligibilityData.max_loans) * 100)}%
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      <Separator />

                      {/* Customer Summary Section */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          Financial Summary
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Total Loan Value */}
                          <Card className="border border-amber-200 dark:border-amber-700 bg-gradient-to-br from-white to-amber-50/30 dark:from-slate-800 dark:to-amber-950/10 shadow-sm hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-2.5">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 flex items-center justify-center flex-shrink-0 shadow-md">
                                  <DollarSign className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">Total Portfolio</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                                    ${Math.round(customer.total_loan_value || 0).toLocaleString()}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400"></div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                                      {eligibilityData.active_loans || 0} active {eligibilityData.active_loans === 1 ? 'loan' : 'loans'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Customer Since */}
                          <Card className="border border-blue-200 dark:border-blue-700 bg-gradient-to-br from-white to-blue-50/30 dark:from-slate-800 dark:to-blue-950/10 shadow-sm hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-2.5">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center flex-shrink-0 shadow-md">
                                  <Calendar className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-1">Member Since</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                                    {new Date(customer.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400"></div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                                      {(() => {
                                        const months = Math.floor((new Date() - new Date(customer.created_at)) / (1000 * 60 * 60 * 24 * 30));
                                        if (months < 1) return 'New customer';
                                        if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} tenure`;
                                        const years = Math.floor(months / 12);
                                        return `${years} ${years === 1 ? 'year' : 'years'} tenure`;
                                      })()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* VIP Status */}
                          <Card className={`border shadow-sm hover:shadow-md transition-all ${
                            customer.is_vip
                              ? 'border-yellow-300 dark:border-yellow-600 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20 ring-2 ring-yellow-400/20 dark:ring-yellow-500/20'
                              : 'border-slate-200 dark:border-slate-700 bg-gradient-to-br from-white to-slate-50/30 dark:from-slate-800 dark:to-slate-900/30'
                          }`}>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-2.5">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md ${
                                  customer.is_vip
                                    ? 'bg-gradient-to-br from-yellow-400 to-amber-500 dark:from-yellow-500 dark:to-amber-600'
                                    : 'bg-gradient-to-br from-slate-400 to-slate-500 dark:from-slate-600 dark:to-slate-700'
                                }`}>
                                  <Award className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                                    customer.is_vip
                                      ? 'text-yellow-700 dark:text-yellow-400'
                                      : 'text-slate-600 dark:text-slate-400'
                                  }`}>
                                    Membership Tier
                                  </p>
                                  <div className="flex items-center gap-2 mb-1.5">
                                    {customer.is_vip ? (
                                      <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white border-0 text-sm font-bold px-2.5 py-0.5 shadow-sm">
                                        VIP
                                      </Badge>
                                    ) : (
                                      <span className="text-xl font-bold text-slate-700 dark:text-slate-300">Standard</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className={`w-1.5 h-1.5 rounded-full ${
                                      customer.is_vip ? 'bg-yellow-500 dark:bg-yellow-400' : 'bg-slate-400 dark:bg-slate-500'
                                    }`}></div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                                      {customer.is_vip ? 'Premium benefits active' : 'Regular customer'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}
    </div>

      {/* Custom Credit Limit Dialog */}
      <CustomCreditLimitDialog
        open={showCustomCreditDialog}
        onOpenChange={setShowCustomCreditDialog}
        customer={customer}
        eligibilityData={eligibilityData}
        onCustomerUpdate={(updatedCustomer) => {
          // Immediate local state update with optimistic UI
          if (updatedCustomer) {
            setEligibilityData(prev => prev ? {
              ...prev,
              // Update credit-related fields immediately for instant feedback
              credit_limit: parseFloat(updatedCustomer.credit_limit) || prev.credit_limit,
              available_credit: parseFloat(updatedCustomer.credit_limit) - (prev.credit_used || 0)
            } : null);
          }
          
          // Force refresh and call callback for complete accuracy
          checkEligibility(true);
          if (onEligibilityUpdate) {
            onEligibilityUpdate();
          }
        }}
        onEligibilityUpdate={(newEligibilityData) => {
          // Update eligibility data in real-time
          if (newEligibilityData) {
            setEligibilityData(newEligibilityData);
          }
        }}
      />

      {/* Custom Loan Limit Dialog */}
      <CustomLoanLimitDialog
        open={showCustomLimitDialog}
        onOpenChange={setShowCustomLimitDialog}
        customer={customer}
        eligibilityData={eligibilityData}
        onCustomerUpdate={(updatedCustomer) => {
          // Immediate local state update with optimistic UI
          if (updatedCustomer) {
            setEligibilityData(prev => prev ? {
              ...prev,
              // Update loan-related fields immediately for instant feedback
              max_loans: updatedCustomer.custom_loan_limit || prev.max_loans,
              slots_available: (updatedCustomer.custom_loan_limit || prev.max_loans) - (prev.slots_used || 0)
            } : null);
          }
          
          // Force refresh and call callback for complete accuracy
          checkEligibility(true);
          if (onEligibilityUpdate) {
            onEligibilityUpdate();
          }
        }}
        onEligibilityUpdate={(newEligibilityData) => {
          // Update eligibility data in real-time
          if (newEligibilityData) {
            setEligibilityData(newEligibilityData);
          }
        }}
      />
    </div>
  );
};

export default LoanEligibilityManager;