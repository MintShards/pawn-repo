import React, { useState, useEffect } from 'react';
import { formatLocalDateTime } from '../../utils/timezoneUtils';
import {
  Settings,
  Save,
  RefreshCcw,
  AlertTriangle,
  CheckCircle,
  Info,
  Clock,
  User,
  Edit2,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
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
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import customerService from '../../services/customerService';
import { useToast } from '../ui/toast';
import { useAuth } from '../../context/AuthContext';
import { isAdmin as isAdminRole } from '../../utils/roleUtils';

const LoanLimitConfig = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [newLimit, setNewLimit] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  const isAdmin = isAdminRole(user);

  useEffect(() => {
    if (isAdmin) {
      loadConfig();
    }
  }, [isAdmin]);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const currentConfig = await customerService.getLoanLimitConfig();
      setConfig(currentConfig);
    } catch (error) {
      console.error('Failed to load loan limit config:', error);
      setError('Failed to load configuration. Please try again.');
      // Try fallback
      setConfig({
        current_limit: 8,
        updated_by: 'system',
        reason: 'Default configuration (API unavailable)',
        updated_at: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLimit = async () => {
    if (!newLimit || !reason.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide both a new limit and a reason for the change.",
        variant: "destructive",
      });
      return;
    }

    const limitNumber = parseInt(newLimit);
    if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 20) {
      toast({
        title: "Invalid Limit",
        description: "Loan limit must be between 1 and 20.",
        variant: "destructive",
      });
      return;
    }

    setUpdating(true);
    try {
      const updatedConfig = await customerService.updateLoanLimitConfig(limitNumber, reason.trim());
      setConfig(updatedConfig);
      setShowUpdateDialog(false);
      setNewLimit('');
      setReason('');
      
      toast({
        title: "Configuration Updated",
        description: `Loan limit successfully updated to ${limitNumber}.`,
        variant: "success",
      });

      // Force refresh customer data to reflect new limits
      await customerService.forceRefresh();
      
    } catch (error) {
      console.error('Failed to update loan limit config:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update loan limit configuration.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const formatDateTime = (dateString) => {
    return formatLocalDateTime(dateString);
  };

  if (!isAdmin) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              This feature is only available to admin users.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Loan Limit Configuration
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage the maximum number of active loans per customer
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadConfig}
          disabled={loading}
        >
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Current Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Current Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading configuration...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Current Limit */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Maximum Active Loans</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-2xl font-bold px-4 py-2">
                      {config?.current_limit || 8}
                    </Badge>
                    <span className="text-sm text-slate-600 dark:text-slate-400">loans per customer</span>
                  </div>
                </div>

                {/* Last Updated */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Last Updated</Label>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Clock className="h-4 w-4" />
                    {config?.updated_at ? formatDateTime(config.updated_at) : 'Unknown'}
                  </div>
                </div>

                {/* Updated By */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Updated By</Label>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" />
                    <Badge variant="secondary">{config?.updated_by || 'system'}</Badge>
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600 font-medium">Active</span>
                  </div>
                </div>
              </div>

              {/* Reason */}
              {config?.reason && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Reason for Change</Label>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-md p-3 text-sm">
                    {config.reason}
                  </div>
                </div>
              )}

              <Separator />

              {/* Update Button */}
              <div className="flex justify-end">
                <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      className="flex items-center gap-2"
                      onClick={() => {
                        setNewLimit(config?.current_limit?.toString() || '8');
                        setReason('');
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                      Update Limit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Update Loan Limit</DialogTitle>
                      <DialogDescription>
                        Change the maximum number of active loans allowed per customer.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="newLimit">New Limit (1-20)</Label>
                        <Input
                          id="newLimit"
                          type="number"
                          min="1"
                          max="20"
                          value={newLimit}
                          onChange={(e) => setNewLimit(e.target.value)}
                          placeholder="Enter new limit"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reason">Reason for Change</Label>
                        <Textarea
                          id="reason"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Explain why this change is being made..."
                          rows={3}
                        />
                      </div>
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          This change will affect all customer loan eligibility calculations immediately.
                        </AlertDescription>
                      </Alert>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowUpdateDialog(false)}
                        disabled={updating}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleUpdateLimit}
                        disabled={updating}
                      >
                        {updating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Update Limit
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardContent className="p-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Important Information</AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              <p>• Changes to the loan limit affect all customers immediately</p>
              <p>• Customer loan eligibility calculations will use the new limit</p>
              <p>• All changes are logged with timestamps and admin information</p>
              <p>• The system supports limits between 1 and 20 active loans per customer</p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoanLimitConfig;