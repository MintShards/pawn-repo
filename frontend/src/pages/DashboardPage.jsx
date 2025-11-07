import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/common/AppHeader';
import PageHeader from '../components/common/PageHeader';
import QuickActions from '../components/dashboard/QuickActions';
import SystemStatus from '../components/dashboard/SystemStatus';
import RecentActivity from '../components/dashboard/RecentActivity';
import { getWelcomeMessage } from '../utils/roleUtils';
import { useDashboardStats } from '../hooks/useDashboardStats';
import serviceAlertService from '../services/serviceAlertService';
import { Card, CardContent } from '../components/ui/card';
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  AlertTriangle
} from 'lucide-react';

// Trend indicator component
const TrendIndicator = ({ direction, percentage }) => {
  const numPercentage = parseFloat(percentage) || 0;

  if (direction === 'stable' || Math.abs(numPercentage) < 0.1) {
    return (
      <div className="flex items-center space-x-1 text-slate-500 dark:text-slate-400">
        <Minus className="w-3 h-3" />
        <span className="text-xs">Stable</span>
      </div>
    );
  }

  const isUp = direction === 'up' || numPercentage > 0;
  const IconComponent = isUp ? TrendingUp : TrendingDown;
  const colorClass = isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className={`flex items-center space-x-1 ${colorClass}`}>
      <IconComponent className="w-3 h-3" />
      <span className="text-xs font-medium">
        {Math.abs(numPercentage).toFixed(1)}%
      </span>
    </div>
  );
};

const DashboardPage = () => {
  const { user, loading, fetchUserDataIfNeeded } = useAuth();
  const [alertStats, setAlertStats] = useState({
    unique_customer_count: 0,
    total_alert_count: 0,
    trend_direction: null,
    trend_percentage: 0
  });
  const [alertStatsInitialLoad, setAlertStatsInitialLoad] = useState(true);

  // Fetch user data if needed on component mount
  React.useEffect(() => {
    if (!user && !loading) {
      fetchUserDataIfNeeded();
    }
  }, [user, loading, fetchUserDataIfNeeded]);

  // Fetch dashboard stats with polling (silent background updates after initial load)
  const { metrics, isInitialLoad: metricsInitialLoad } = useDashboardStats();

  // Fetch service alert stats (silent background updates after initial load)
  React.useEffect(() => {
    const fetchAlertStats = async () => {
      try {
        const stats = await serviceAlertService.getUniqueCustomerAlertStats();
        setAlertStats(stats);
        setAlertStatsInitialLoad(false); // Clear initial load flag after first success
      } catch (error) {
        setAlertStats({
          unique_customer_count: 0,
          total_alert_count: 0,
          trend_direction: null,
          trend_percentage: 0
        });
        setAlertStatsInitialLoad(false);
      }
    };

    if (user) {
      fetchAlertStats();
      const interval = setInterval(fetchAlertStats, 60000); // Silent updates every 60s
      return () => clearInterval(interval);
    }
  }, [user]);

  // Unified loading state for ALL 5 cards (only on initial page load)
  const allCardsLoading = metricsInitialLoad || alertStatsInitialLoad;

  // Listen for service alert updates
  React.useEffect(() => {
    const handleAlertUpdate = async () => {
      try {
        serviceAlertService.clearCacheByPattern('unique_customer_alert_stats');
        const stats = await serviceAlertService.getUniqueCustomerAlertStats();
        setAlertStats(stats);
      } catch (error) {
        // Handle error silently
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <PageHeader
          title={getWelcomeMessage(user, loading)}
          subtitle="Your daily overview and key metrics at a glance"
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/50 dark:to-violet-950/50 hover:shadow-lg transition-all">
            <CardContent className="p-6">
              {allCardsLoading ? (
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-3 animate-pulse">
                    <div className="h-4 bg-purple-200/60 dark:bg-purple-700/40 rounded w-28" />
                    <div className="h-8 bg-purple-200/60 dark:bg-purple-700/40 rounded w-20" />
                  </div>
                  <div className="w-12 h-12 bg-purple-500/10 dark:bg-purple-400/10 rounded-xl flex items-center justify-center animate-pulse">
                    <div className="w-6 h-6 bg-purple-200/60 dark:bg-purple-700/40 rounded" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                      Month's Revenue
                    </p>
                    <div className="flex items-baseline space-x-2">
                      <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {metrics.this_month_revenue?.display_value || '$0'}
                      </p>
                      {metrics.this_month_revenue?.trend_direction && (
                        <TrendIndicator
                          direction={metrics.this_month_revenue.trend_direction}
                          percentage={metrics.this_month_revenue.trend_percentage}
                        />
                      )}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-purple-500/10 dark:bg-purple-400/10 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              )}
              <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/5 dark:bg-purple-400/5 rounded-full -mr-10 -mt-10"></div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/50 dark:to-blue-950/50 hover:shadow-lg transition-all">
            <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              {allCardsLoading ? (
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-3 animate-pulse">
                    <div className="h-4 bg-cyan-200/60 dark:bg-cyan-700/40 rounded w-24" />
                    <div className="h-8 bg-cyan-200/60 dark:bg-cyan-700/40 rounded w-16" />
                  </div>
                  <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center animate-pulse">
                    <div className="w-6 h-6 bg-cyan-200/60 dark:bg-cyan-700/40 rounded" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-cyan-600 dark:text-cyan-400">
                      Active Loans
                    </p>
                    <div className="flex items-baseline space-x-2">
                      <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">
                        {metrics.active_loans?.display_value || '0'}
                      </p>
                      {metrics.active_loans?.trend_direction && (
                        <TrendIndicator
                          direction={metrics.active_loans.trend_direction}
                          percentage={metrics.active_loans.trend_percentage}
                        />
                      )}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50 hover:shadow-lg transition-all">
            <CardContent className="p-6">
              {allCardsLoading ? (
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-3 animate-pulse">
                    <div className="h-4 bg-emerald-200/60 dark:bg-emerald-700/40 rounded w-28" />
                    <div className="h-8 bg-emerald-200/60 dark:bg-emerald-700/40 rounded w-12" />
                  </div>
                  <div className="w-12 h-12 bg-emerald-500/10 dark:bg-emerald-400/10 rounded-xl flex items-center justify-center animate-pulse">
                    <div className="w-6 h-6 bg-emerald-200/60 dark:bg-emerald-700/40 rounded" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      New Customers
                    </p>
                    <div className="flex items-baseline space-x-2">
                      <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                        {metrics.new_customers_this_month?.display_value || '0'}
                      </p>
                      {metrics.new_customers_this_month?.trend_direction && (
                        <TrendIndicator
                          direction={metrics.new_customers_this_month.trend_direction}
                          percentage={metrics.new_customers_this_month.trend_percentage}
                        />
                      )}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-emerald-500/10 dark:bg-emerald-400/10 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              )}
              <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 dark:bg-emerald-400/5 rounded-full -mr-10 -mt-10"></div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/50 dark:to-rose-950/50 hover:shadow-lg transition-all">
            <div className="absolute top-0 right-0 w-20 h-20 bg-pink-500/10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              {allCardsLoading ? (
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-3 animate-pulse">
                    <div className="h-4 bg-pink-200/60 dark:bg-pink-700/40 rounded w-28" />
                    <div className="h-8 bg-pink-200/60 dark:bg-pink-700/40 rounded w-12" />
                  </div>
                  <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center animate-pulse">
                    <div className="w-6 h-6 bg-pink-200/60 dark:bg-pink-700/40 rounded" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-pink-600 dark:text-pink-400">
                      Overdue This Week
                    </p>
                    <div className="flex items-baseline space-x-2">
                      <p className="text-2xl font-bold text-pink-900 dark:text-pink-100">
                        {metrics.went_overdue_this_week?.display_value || '0'}
                      </p>
                      {metrics.went_overdue_this_week?.trend_direction && (
                        <TrendIndicator
                          direction={metrics.went_overdue_this_week.trend_direction}
                          percentage={metrics.went_overdue_this_week.trend_percentage}
                        />
                      )}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-pink-600 dark:text-pink-400" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/50 dark:to-red-950/50 hover:shadow-lg transition-all">
            <CardContent className="p-6">
              {allCardsLoading ? (
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-3 animate-pulse">
                    <div className="h-4 bg-orange-200/60 dark:bg-orange-700/40 rounded w-28" />
                    <div className="h-8 bg-orange-200/60 dark:bg-orange-700/40 rounded w-12" />
                  </div>
                  <div className="w-12 h-12 bg-orange-500/10 dark:bg-orange-400/10 rounded-xl flex items-center justify-center animate-pulse">
                    <div className="w-6 h-6 bg-orange-200/60 dark:bg-orange-700/40 rounded" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                      Service Alerts
                    </p>
                    <div className="flex items-baseline space-x-2">
                      <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                        {alertStats.unique_customer_count}
                      </p>
                      {alertStats.trend_direction && (
                        <TrendIndicator
                          direction={alertStats.trend_direction}
                          percentage={alertStats.trend_percentage}
                        />
                      )}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-orange-500/10 dark:bg-orange-400/10 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
              )}
              <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/5 dark:bg-orange-400/5 rounded-full -mr-10 -mt-10"></div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Quick Actions & System Status */}
          <div className="lg:col-span-1 space-y-6">
            <QuickActions userRole={user?.role} />
            <SystemStatus />
          </div>

          {/* Right Column - Recent Activity */}
          <div className="lg:col-span-2">
            <RecentActivity />
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;