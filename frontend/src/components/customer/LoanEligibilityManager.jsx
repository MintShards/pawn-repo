import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  DollarSign,
  Shield,
  AlertTriangle,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../ui/alert';
import { Separator } from '../ui/separator';
import { Progress } from '../ui/progress';
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
        description: 'Failed to update credit limit',
        variant: 'destructive'
      });
    }
  };

  const getEligibilityColor = (eligible) => {
    return eligible ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
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
      {/* Main Eligibility Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Loan Eligibility
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkEligibility()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Refresh'
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && !eligibilityData ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Checking eligibility...</span>
            </div>
          ) : eligibilityData ? (
            <div className="space-y-4">
              {/* Eligibility Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {eligibilityData.eligible ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className={`font-semibold ${getEligibilityColor(eligibilityData.eligible)}`}>
                    {eligibilityData.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                  </span>
                </div>
                <Badge variant="default">
                  ELIGIBLE
                </Badge>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Credit Limit</p>
                  <p className="text-xl font-bold text-blue-600">
                    ${eligibilityData.credit_limit?.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Available Credit</p>
                  <p className="text-xl font-bold text-green-600">
                    ${eligibilityData.available_credit?.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Loan Usage Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Active Loans</span>
                  <span>{eligibilityData.active_loans} / {eligibilityData.max_loans}</span>
                </div>
                <Progress 
                  value={(eligibilityData.active_loans / eligibilityData.max_loans) * 100} 
                  className="h-2"
                />
              </div>

              {/* Reasons */}
              {eligibilityData.reasons && eligibilityData.reasons.length > 0 && (
                <Alert variant={eligibilityData.eligible ? "default" : "destructive"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>
                    {eligibilityData.eligible ? 'Important Notes' : 'Eligibility Issues'}
                  </AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2">
                      {eligibilityData.reasons.map((reason, index) => (
                        <li key={index} className="text-sm">{reason}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground">Click refresh to check eligibility</p>
            </div>
          )}
        </CardContent>
      </Card>

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
                    </div>
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
                          <Badge variant="default">
                            ELIGIBLE
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-semibold">Loan Capacity</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>Active Loans: {eligibilityData.active_loans}</div>
                          <div>Maximum Loans: {eligibilityData.max_loans}</div>
                          <div>Remaining Slots: {eligibilityData.max_loans - eligibilityData.active_loans}</div>
                          <div>Utilization: {((eligibilityData.active_loans / eligibilityData.max_loans) * 100).toFixed(1)}%</div>
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
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LoanEligibilityManager;