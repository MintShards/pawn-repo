import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/common/AppHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import {
  Settings,
  Activity,
  Shield,
  Database,
  RefreshCw
} from 'lucide-react';
import BusinessSettingsTab from '../components/admin/settings/BusinessSettingsTab';
import SystemHealthTab from '../components/admin/settings/SystemHealthTab';
import AuditActivityTab from '../components/admin/settings/AuditActivityTab';
import { toast } from 'sonner';

const AdminSettingsPage = () => {
  const { user, loading, isAuthenticated, fetchUserDataIfNeeded } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('system');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const fetchingUserRef = React.useRef(false);

  // Refresh all metrics
  const handleRefreshAll = async () => {
    try {
      setRefreshing(true);

      // Trigger refresh based on active tab
      if (activeTab === 'system') {
        // System health metrics will be refreshed by SystemHealthTab
        window.dispatchEvent(new Event('refreshSystemHealth'));
      }

      setLastUpdated(new Date());
      toast.success('Metrics refreshed successfully');
    } catch (error) {
      console.error('Error refreshing metrics:', error);
      toast.error('Failed to refresh metrics');
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch user data if authenticated but user data not loaded
  React.useEffect(() => {
    if (isAuthenticated && !user && !loading && !fetchingUserRef.current) {
      fetchingUserRef.current = true;
      fetchUserDataIfNeeded().finally(() => {
        fetchingUserRef.current = false;
      });
    }
  }, [isAuthenticated, user, loading, fetchUserDataIfNeeded]);

  // Redirect if not admin (only if user is loaded and not admin)
  React.useEffect(() => {
    if (!loading && user && user.role !== 'admin') {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  // Show loading while auth is initializing OR user data is being fetched
  if (loading || (isAuthenticated && !user)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
        <AppHeader pageTitle="Admin Settings" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-slate-600 dark:text-slate-400">Loading admin settings...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Only check role once user data is loaded
  if (user && user.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      <AppHeader pageTitle="Admin Settings" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                System Administration
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                Manage system settings, monitor health, and view activity logs
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-400">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              </div>
              <Button
                onClick={handleRefreshAll}
                disabled={refreshing}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm dark:bg-blue-600 dark:hover:bg-blue-700 px-3 py-2 h-auto text-xs font-medium"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Admin Access Notice */}
        <Alert className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
          <Shield className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>Admin Access:</strong> You are viewing sensitive system information.
            All actions are logged and auditable.
          </AlertDescription>
        </Alert>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 shadow-sm">
            <TabsTrigger
              value="system"
              className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all dark:data-[state=active]:bg-blue-500 dark:data-[state=active]:text-white"
            >
              <Database className="w-4 h-4" />
              <span>System Health</span>
            </TabsTrigger>
            <TabsTrigger
              value="business"
              className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all dark:data-[state=active]:bg-blue-500 dark:data-[state=active]:text-white"
            >
              <Settings className="w-4 h-4" />
              <span>Business Settings</span>
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all dark:data-[state=active]:bg-blue-500 dark:data-[state=active]:text-white"
            >
              <Activity className="w-4 h-4" />
              <span>Audit & Activity</span>
            </TabsTrigger>
          </TabsList>

          {/* System Health Tab */}
          <TabsContent value="system" className="space-y-6">
            <SystemHealthTab />
          </TabsContent>

          {/* Business Settings Tab */}
          <TabsContent value="business" className="space-y-6">
            <BusinessSettingsTab />
          </TabsContent>

          {/* Audit & Activity Tab */}
          <TabsContent value="activity" className="space-y-6">
            <AuditActivityTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
