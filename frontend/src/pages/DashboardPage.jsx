import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import LoanLimitConfig from '../components/admin/LoanLimitConfig';
import AppHeader from '../components/common/AppHeader';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  Plus,
  CreditCard,
  TrendingUp,
  DollarSign,
  Clock,
  Activity,
  Users,
  Database,
  Shield,
  Zap,
  FileText,
  Calendar,
  ArrowUpRight,
  RefreshCw,
  Bell,
  Settings
} from 'lucide-react';
import { getWelcomeMessage } from '../utils/roleUtils';
import serviceAlertService from '../services/serviceAlertService';

const DashboardPage = () => {
  const { user, loading, fetchUserDataIfNeeded } = useAuth();
  const navigate = useNavigate();
  const [alertStats, setAlertStats] = React.useState({
    unique_customer_count: 0,
    total_alert_count: 0
  });
  const [alertStatsLoading, setAlertStatsLoading] = React.useState(true);
  const [showAdminSettings, setShowAdminSettings] = useState(false);

  // Fetch user data if needed on component mount
  React.useEffect(() => {
    if (!user && !loading) {
      fetchUserDataIfNeeded();
    }
  }, [user, loading, fetchUserDataIfNeeded]);

  // Fetch service alert stats
  React.useEffect(() => {
    const fetchAlertStats = async () => {
      try {
        setAlertStatsLoading(true);
        const stats = await serviceAlertService.getUniqueCustomerAlertStats();
        setAlertStats(stats);
      } catch (error) {
        // Failed to fetch alert stats
        // Set default values on error
        setAlertStats({
          unique_customer_count: 0,
          total_alert_count: 0
        });
      } finally {
        setAlertStatsLoading(false);
      }
    };

    if (user) {
      fetchAlertStats();
      // Refresh stats every 60 seconds for rate limit safety
      const interval = setInterval(fetchAlertStats, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Listen for service alert updates
  React.useEffect(() => {
    const handleAlertUpdate = async () => {
      try {
        // Clear cache to force fresh fetch
        serviceAlertService.clearCacheByPattern('unique_customer_alert_stats');
        const stats = await serviceAlertService.getUniqueCustomerAlertStats();
        setAlertStats(stats);
      } catch (error) {
        // Failed to refresh alert stats
      }
    };

    window.addEventListener('refreshAlertCounts', handleAlertUpdate);
    window.addEventListener('refreshCustomerAlerts', handleAlertUpdate);
    
    return () => {
      window.removeEventListener('refreshAlertCounts', handleAlertUpdate);
      window.removeEventListener('refreshCustomerAlerts', handleAlertUpdate);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <AppHeader pageTitle="Dashboard" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                {getWelcomeMessage(user, loading)}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                Here's what's happening with your pawn shop today
              </p>
            </div>
            <Button 
              onClick={() => navigate('/transactions')}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Transaction
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          {/* Today's Revenue */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Today's Revenue</p>
                  <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">$0.00</p>
                  <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 flex items-center mt-1">
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                    +0% from yesterday
                  </p>
                </div>
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Loans */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 relative overflow-hidden select-none pointer-events-none">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Active Loans</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">0</p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70 flex items-center mt-1">
                    <Activity className="w-3 h-3 mr-1" />
                    0 new this week
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Alerts */}
          <Card 
            className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50 relative overflow-hidden cursor-pointer"
            onClick={async () => {
              setAlertStatsLoading(true);
              try {
                serviceAlertService.clearCacheByPattern('unique_customer_alert_stats');
                const stats = await serviceAlertService.getUniqueCustomerAlertStats();
                setAlertStats(stats);
              } catch (error) {
                // Manual refresh failed
              }
              setAlertStatsLoading(false);
            }}
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Service Alerts</p>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                    {alertStatsLoading ? '-' : alertStats.unique_customer_count}
                  </p>
                  <p className="text-xs text-red-600/70 dark:text-red-400/70 flex items-center mt-1">
                    <Bell className="w-3 h-3 mr-1" />
                    {alertStatsLoading ? 'Loading...' : (
                      alertStats.unique_customer_count === 0 ? 'No active alerts' :
                      `${alertStats.unique_customer_count} customer${alertStats.unique_customer_count !== 1 ? 's' : ''} with alerts`
                    )}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                  <Bell className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Due This Week */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Due This Week</p>
                  <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">0</p>
                  <p className="text-xs text-amber-600/70 dark:text-amber-400/70 flex items-center mt-1">
                    <Clock className="w-3 h-3 mr-1" />
                    No overdue items
                  </p>
                </div>
                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Count */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-violet-600 dark:text-violet-400">Total Customers</p>
                  <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">0</p>
                  <p className="text-xs text-violet-600/70 dark:text-violet-400/70 flex items-center mt-1">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    All active accounts
                  </p>
                </div>
                <div className="w-12 h-12 bg-violet-500/20 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Settings Section */}
        {user?.role === 'admin' && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Admin Settings
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  System configuration and management tools
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowAdminSettings(!showAdminSettings)}
              >
                {showAdminSettings ? 'Hide Settings' : 'Show Settings'}
              </Button>
            </div>
            
            {showAdminSettings && (
              <div className="mt-6">
                <LoanLimitConfig />
              </div>
            )}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Quick Actions & Today's Summary */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Actions */}
            <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-slate-900 dark:text-slate-100">Quick Actions</CardTitle>
                    <CardDescription>Common daily tasks</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={() => navigate('/transactions')}
                  className="w-full justify-start bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/50 dark:hover:to-teal-900/50" 
                  variant="outline"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Pawn Transaction
                </Button>
                <Button 
                  className="w-full justify-start bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50" 
                  variant="outline"
                  onClick={() => navigate('/customers')}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Manage Customers
                </Button>
                <Button className="w-full justify-start bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900/50 dark:hover:to-orange-900/50" variant="outline">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Process Payment
                </Button>
                <Button className="w-full justify-start bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:from-slate-100 hover:to-slate-200 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50" variant="outline">
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-slate-900 dark:text-slate-100">System Status</CardTitle>
                    <CardDescription>All systems operational</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Database className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Database</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Connected</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Zap className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">API Service</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Online</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Shield className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Authentication</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Secure</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Recent Activity */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm h-full">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/25">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-slate-900 dark:text-slate-100">Recent Activity</CardTitle>
                      <CardDescription>Latest transactions and updates</CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <FileText className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    No Recent Activity
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
                    When you create transactions, payments, or other activities, they'll appear here for quick access.
                  </p>
                  <Button 
                    onClick={() => navigate('/transactions')}
                    className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Transaction
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;