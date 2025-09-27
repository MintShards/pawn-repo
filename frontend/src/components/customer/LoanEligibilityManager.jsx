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

const LoanEligibilityManager = ({ customer, onEligibilityUpdate }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [eligibilityData, setEligibilityData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCreditLimitDialog, setShowCreditLimitDialog] = useState(false);
  const [newCreditLimit, setNewCreditLimit] = useState('');
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showSlotLimitDialog, setShowSlotLimitDialog] = useState(false);
  const [newSlotLimit, setNewSlotLimit] = useState('');

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


  const updateCreditLimit = async () => {
    const newLimit = parseFloat(newCreditLimit);
    if (isNaN(newLimit) || newLimit < 0) {
      toast({
        title: 'Invalid Credit Limit',
        description: 'Please enter a valid credit limit',
        variant: 'destructive'
      });
      return;
    }

    // Validate against current usage
    const currentUsed = eligibilityData?.credit_used || 0;
    if (newLimit < currentUsed) {
      toast({
        title: 'Invalid Credit Limit',
        description: `Cannot set credit limit below current usage ($${currentUsed.toLocaleString()})`,
        variant: 'destructive'
      });
      return;
    }

    try {
      // Update customer credit limit
      await customerService.updateCustomer(customer.phone_number, {
        ...customer,
        credit_limit: newLimit.toString()
      });

      toast({
        title: 'Credit Limit Updated',
        description: `Credit limit updated to $${newLimit.toLocaleString()}`
      });

      setShowCreditLimitDialog(false);
      setNewCreditLimit('');
      
      // Refresh eligibility data and notify parent of change
      checkEligibility(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to update credit limit',
        variant: 'destructive'
      });
    }
  };

  const updateSlotLimit = async () => {
    const newLimit = parseInt(newSlotLimit);
    if (isNaN(newLimit) || newLimit < 1 || newLimit > 50) {
      toast({
        title: 'Invalid Slot Limit',
        description: 'Please enter a valid slot limit (1-50)',
        variant: 'destructive'
      });
      return;
    }

    // Validate against current usage
    const currentUsed = eligibilityData?.slots_used || eligibilityData?.active_loans || 0;
    if (newLimit < currentUsed) {
      toast({
        title: 'Invalid Slot Limit',
        description: `Cannot set slot limit below current usage (${currentUsed} slots)`,
        variant: 'destructive'
      });
      return;
    }

    try {
      // Update customer slot limit
      await customerService.updateCustomer(customer.phone_number, {
        ...customer,
        custom_loan_limit: newLimit
      });

      toast({
        title: 'Slot Limit Updated',
        description: `Loan slots updated to ${newLimit}`
      });

      setShowSlotLimitDialog(false);
      setNewSlotLimit('');
      
      // Refresh eligibility data
      checkEligibility(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to update slot limit',
        variant: 'destructive'
      });
    }
  };


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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Admin Controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Update Credit Limit */}
              <Dialog open={showCreditLimitDialog} onOpenChange={setShowCreditLimitDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Update Credit Limit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update Credit Limit</DialogTitle>
                    <DialogDescription>
                      Set a new credit limit for {customerService.getCustomerFullName(customer)}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="newCreditLimit">New Credit Limit</Label>
                      <Input
                        id="newCreditLimit"
                        type="number"
                        placeholder="Enter new credit limit"
                        value={newCreditLimit}
                        onChange={(e) => setNewCreditLimit(e.target.value)}
                        min="0"
                        step="0.01"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Current: ${eligibilityData?.credit_limit?.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        In use: ${eligibilityData?.credit_used?.toLocaleString() || 0}
                      </p>
                    </div>
                    {eligibilityData?.credit_used > 0 && (
                      <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800 p-3">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          <Info className="h-4 w-4 inline mr-1" />
                          Customer is currently using ${eligibilityData?.credit_used?.toLocaleString()} of credit
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button onClick={updateCreditLimit} disabled={!newCreditLimit}>
                        Update Limit
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setShowCreditLimitDialog(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Update Slot Limit */}
              <Dialog open={showSlotLimitDialog} onOpenChange={setShowSlotLimitDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Target className="mr-2 h-4 w-4" />
                    Update Slot Limit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update Loan Slot Limit</DialogTitle>
                    <DialogDescription>
                      Set a custom loan slot limit for {customerService.getCustomerFullName(customer)}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="newSlotLimit">Maximum Loan Slots</Label>
                      <Input
                        id="newSlotLimit"
                        type="number"
                        placeholder="Enter new slot limit"
                        value={newSlotLimit}
                        onChange={(e) => setNewSlotLimit(e.target.value)}
                        min="1"
                        max="50"
                        step="1"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Current: {eligibilityData?.max_loans || 8} slots
                      </p>
                      <p className="text-sm text-muted-foreground">
                        In use: {eligibilityData?.slots_used || eligibilityData?.active_loans || 0} slots
                      </p>
                    </div>
                    {eligibilityData?.credit_used > 0 && (
                      <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800 p-3">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          <Info className="h-4 w-4 inline mr-1" />
                          Customer is currently using {eligibilityData?.slots_used || eligibilityData?.active_loans || 0} slots
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button onClick={updateSlotLimit} disabled={!newSlotLimit}>
                        Update Slots
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setShowSlotLimitDialog(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* View Detailed Info */}
              <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Info className="mr-2 h-4 w-4" />
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
    </div>
  );
};

export default LoanEligibilityManager;