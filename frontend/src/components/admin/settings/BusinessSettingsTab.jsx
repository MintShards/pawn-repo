import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Alert, AlertDescription } from '../../ui/alert';
import {
  Settings,
  DollarSign,
  Calendar,
  Shield,
  Building2,
  AlertTriangle,
  Info,
  Wrench,
  Users,
  UserCheck,
  LogIn,
  Lock
} from 'lucide-react';
import LoanLimitConfig from '../LoanLimitConfig';
import adminService from '../../../services/adminService';
import { toast } from 'sonner';

const BusinessSettingsTab = () => {
  const [consistencyReport, setConsistencyReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [runningValidation, setRunningValidation] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);

  // Fetch system health for user statistics
  useEffect(() => {
    const fetchSystemHealth = async () => {
      try {
        const health = await adminService.getSystemHealth();
        setSystemHealth(health);
      } catch (error) {
        console.error('Error fetching system health:', error);
      }
    };

    fetchSystemHealth();
  }, []);

  const fetchConsistencyReport = async () => {
    try {
      setLoadingReport(true);
      const report = await adminService.getConsistencyReport();
      setConsistencyReport(report);
    } catch (error) {
      console.error('Error fetching consistency report:', error);
      toast.error('Failed to fetch consistency report');
    } finally {
      setLoadingReport(false);
    }
  };

  const runConsistencyValidation = async (autoFix = false) => {
    try {
      setRunningValidation(true);
      const result = await adminService.validateAllCustomers({
        fix_automatically: autoFix
      });

      toast.success(
        autoFix
          ? `Validation complete. Fixed ${result.fixed_count || 0} issues.`
          : `Validation complete. Found ${result.discrepancies_count || 0} issues.`
      );

      // Refresh report
      await fetchConsistencyReport();
    } catch (error) {
      console.error('Error running validation:', error);
      toast.error('Failed to run consistency validation');
    } finally {
      setRunningValidation(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Business Settings</h2>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Configure loan policies, fees, and system business rules
        </p>
      </div>

      {/* Loan Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <CardTitle>Loan Configuration</CardTitle>
              <CardDescription>Maximum active loans per customer</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <LoanLimitConfig />
        </CardContent>
      </Card>

      {/* Interest & Fee Rates */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
            <div>
              <CardTitle>Interest & Fee Rates</CardTitle>
              <CardDescription>Default rates for loans and extensions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-500" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> Interest rates and extension fees are currently configured per-transaction
              by staff during loan creation. Global default rate configuration will be available in a future update.
            </AlertDescription>
          </Alert>

          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Monthly Interest</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">Variable</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Set per transaction</p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Extension Fee</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">Variable</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">30/60/90 day options</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Forfeiture Rules */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Calendar className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            <div>
              <CardTitle>Forfeiture Rules</CardTitle>
              <CardDescription>Automatic item forfeiture threshold</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Forfeiture Threshold</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">97 Days</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  From original loan date (currently hardcoded)
                </p>
              </div>
              <Shield className="w-12 h-12 text-orange-400 dark:text-orange-600" />
            </div>
          </div>

          <Alert className="mt-4 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-900">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              Forfeiture threshold configuration interface coming soon. Currently managed in backend code.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Building2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <div>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>Business details for receipts and documents</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-500" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <strong>Configuration:</strong> Company information is currently managed via environment variables.
              UI-based configuration will be available in a future update.
            </AlertDescription>
          </Alert>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Company Name</span>
              <span className="text-sm text-slate-600 dark:text-slate-400">Configured via .env</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Business Address</span>
              <span className="text-sm text-slate-600 dark:text-slate-400">Configured via .env</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number</span>
              <span className="text-sm text-slate-600 dark:text-slate-400">Configured via .env</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">License Number</span>
              <span className="text-sm text-slate-600 dark:text-slate-400">Configured via .env</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Metrics */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <div>
              <CardTitle>Business Metrics</CardTitle>
              <CardDescription>User activity and authentication statistics</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Statistics */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center">
                <UserCheck className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                User Statistics
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Total Users</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">
                    {systemHealth?.user_stats?.total_users || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Active Users</span>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {systemHealth?.user_stats?.active_users || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Admin Users</span>
                  <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {systemHealth?.user_stats?.admin_users || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Staff Users</span>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {systemHealth?.user_stats?.staff_users || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Authentication Activity */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center">
                <LogIn className="w-4 h-4 mr-2 text-cyan-600 dark:text-cyan-400" />
                Authentication Activity
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Today's Logins</span>
                  <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                    {systemHealth?.user_stats?.todays_logins || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Locked Accounts</span>
                  <span className="text-lg font-bold text-red-600 dark:text-red-400">
                    {systemHealth?.user_stats?.locked_accounts || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Consistency Tools */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Wrench className="w-6 h-6 text-red-600 dark:text-red-400" />
            <div>
              <CardTitle>Data Consistency Tools</CardTitle>
              <CardDescription>Validate and fix customer transaction data integrity</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-500" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                <strong>Caution:</strong> These tools modify customer data. Use with care and always
                review reports before applying automatic fixes.
              </AlertDescription>
            </Alert>

            <div className="flex items-center space-x-3">
              <Button
                onClick={() => fetchConsistencyReport()}
                disabled={loadingReport}
                variant="outline"
                size="sm"
              >
                {loadingReport ? 'Loading...' : 'View Consistency Report'}
              </Button>

              <Button
                onClick={() => runConsistencyValidation(false)}
                disabled={runningValidation}
                variant="outline"
                size="sm"
              >
                {runningValidation ? 'Running...' : 'Validate All Customers'}
              </Button>

              <Button
                onClick={() => runConsistencyValidation(true)}
                disabled={runningValidation}
                variant="default"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {runningValidation ? 'Running...' : 'Validate & Auto-Fix'}
              </Button>
            </div>

            {consistencyReport && (
              <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                  Latest Consistency Report
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Total Customers</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {consistencyReport.total_customers || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Consistent</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {consistencyReport.consistent_count || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Discrepancies</p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">
                      {consistencyReport.discrepancies_count || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Accuracy</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {consistencyReport.consistency_percentage?.toFixed(1) || 0}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessSettingsTab;
