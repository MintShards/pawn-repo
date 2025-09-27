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
  Target
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState(null);

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
      const { customer: updatedCustomer, type } = event.detail;
      
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
                          ? 'text-white' 
                          : 'text-white'
                      }`}>
                        {eligibilityData.eligible ? 'Eligible for New Loan' : 'Not Eligible'}
                      </p>
                      {eligibilityData.reasons && eligibilityData.reasons.length > 0 && (
                        <p className={`text-sm mt-1 ${
                          eligibilityData.eligible 
                            ? 'text-green-100' 
                            : 'text-red-100'
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

              {/* View Detailed Info */}
              <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-start bg-white/60 dark:bg-slate-800/60 hover:bg-white/80 dark:hover:bg-slate-800/80 border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mr-3">
                      <Info className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    View Detailed Information
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Detailed Eligibility Information</DialogTitle>
                    <DialogDescription>
                      Complete eligibility analysis for {customerService.getCustomerFullName(customer)}
                    </DialogDescription>
                  </DialogHeader>
                  {eligibilityData && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Card>
                          <CardContent className="p-4">
                            <div className="text-center">
                              <Target className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                              <p className="text-sm text-muted-foreground">Credit Limit</p>
                              <p className="text-xl font-bold">${eligibilityData.credit_limit?.toLocaleString()}</p>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="text-center">
                              <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-600" />
                              <p className="text-sm text-muted-foreground">Available</p>
                              <p className="text-xl font-bold">${eligibilityData.available_credit?.toLocaleString()}</p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        <h4 className="font-semibold">Eligibility Status</h4>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          <span>Status: </span>
                          <Badge variant={eligibilityData.eligible ? "default" : "destructive"}>
                            {eligibilityData.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-semibold">Loan Capacity</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>Active Loans: {eligibilityData.slots_used || eligibilityData.active_loans}</div>
                          <div>Maximum Loans: {eligibilityData.max_loans}</div>
                          <div>Remaining Slots: {eligibilityData.slots_available !== undefined ? eligibilityData.slots_available : (eligibilityData.max_loans - eligibilityData.active_loans)}</div>
                          <div>Utilization: {(((eligibilityData.slots_used || eligibilityData.active_loans) / eligibilityData.max_loans) * 100).toFixed(1)}%</div>
                        </div>
                      </div>

                      {eligibilityData.reasons && eligibilityData.reasons.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-semibold">Notes & Conditions</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            {eligibilityData.reasons.map((reason, index) => (
                              <li key={index}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {isAdmin && (
                        <div className="space-y-2">
                          <h4 className="font-semibold">Admin Information</h4>
                          <div className="text-sm space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Custom Slot Limit:</span>
                              <span>{customer.custom_loan_limit ? `${customer.custom_loan_limit} slots` : 'Using system default'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Last Updated:</span>
                              <span>{new Date(customer.updated_at).toLocaleDateString()}</span>
                            </div>
                            {customer.updated_by && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Updated By:</span>
                                <span>User {customer.updated_by}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
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