import React from "react";
import AppHeader from "../components/common/AppHeader";
import PageHeader from "../components/common/PageHeader";
import ErrorBoundary from "../components/common/ErrorBoundary";
import { useDashboardStats } from "../hooks/useDashboardStats";
import RevenueAndLoanTrends from "../components/dashboard/RevenueAndLoanTrends";
import { Card, CardContent } from "../components/ui/card";
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
} from "lucide-react";

// Stats card configuration with preserved gradient styling
const STATS_CONFIG = [
  {
    key: "this_month_revenue",
    title: "Month's Revenue",
    icon: DollarSign,
    gradient:
      "from-purple-50 to-violet-50 dark:from-purple-950/50 dark:to-violet-950/50",
    iconBg: "bg-purple-500/10 dark:bg-purple-400/10",
    iconColor: "text-purple-600 dark:text-purple-400",
    titleColor: "text-purple-700 dark:text-purple-300",
    valueColor: "text-purple-900 dark:text-purple-100",
    accentBg: "bg-purple-500/5 dark:bg-purple-400/5",
    loadingColor: "bg-purple-200/60 dark:bg-purple-700/40",
  },
  {
    key: "active_loans",
    title: "Active Loans",
    icon: CreditCard,
    gradient:
      "from-cyan-50 to-blue-50 dark:from-cyan-950/50 dark:to-blue-950/50",
    iconBg: "bg-cyan-500/20",
    iconColor: "text-cyan-600 dark:text-cyan-400",
    titleColor: "text-cyan-600 dark:text-cyan-400",
    valueColor: "text-cyan-900 dark:text-cyan-100",
    accentBg: "bg-cyan-500/10",
    loadingColor: "bg-cyan-200/60 dark:bg-cyan-700/40",
  },
  {
    key: "new_customers_this_month",
    title: "New Customers",
    icon: TrendingUp,
    gradient:
      "from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50",
    iconBg: "bg-emerald-500/10 dark:bg-emerald-400/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    titleColor: "text-emerald-700 dark:text-emerald-300",
    valueColor: "text-emerald-900 dark:text-emerald-100",
    accentBg: "bg-emerald-500/5 dark:bg-emerald-400/5",
    loadingColor: "bg-emerald-200/60 dark:bg-emerald-700/40",
  },
  {
    key: "went_overdue_this_week",
    title: "Overdue This Week",
    icon: AlertTriangle,
    gradient:
      "from-pink-50 to-rose-50 dark:from-pink-950/50 dark:to-rose-950/50",
    iconBg: "bg-pink-500/20",
    iconColor: "text-pink-600 dark:text-pink-400",
    titleColor: "text-pink-600 dark:text-pink-400",
    valueColor: "text-pink-900 dark:text-pink-100",
    accentBg: "bg-pink-500/10",
    loadingColor: "bg-pink-200/60 dark:bg-pink-700/40",
  },
  {
    key: "service_alerts",
    title: "Service Alerts",
    icon: AlertTriangle,
    gradient:
      "from-orange-50 to-red-50 dark:from-orange-950/50 dark:to-red-950/50",
    iconBg: "bg-orange-500/10 dark:bg-orange-400/10",
    iconColor: "text-orange-600 dark:text-orange-400",
    titleColor: "text-orange-700 dark:text-orange-300",
    valueColor: "text-orange-900 dark:text-orange-100",
    accentBg: "bg-orange-500/5 dark:bg-orange-400/5",
    loadingColor: "bg-orange-200/60 dark:bg-orange-700/40",
  },
];

// Trend indicator component (memoized for performance)
const TrendIndicator = React.memo(({ direction, percentage }) => {
  const numPercentage = parseFloat(percentage) || 0;

  if (direction === "stable" || Math.abs(numPercentage) < 0.1) {
    return (
      <div className="flex items-center space-x-1 text-slate-500 dark:text-slate-400">
        <span className="text-xs">Stable</span>
      </div>
    );
  }

  const isUp = direction === "up" || numPercentage > 0;
  const colorClass = isUp
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";
  const TrendIcon = isUp ? TrendingUp : TrendingDown;

  return (
    <div className={`flex items-center space-x-1 ${colorClass}`}>
      <TrendIcon className="w-3 h-3" />
      <span className="text-xs font-medium">
        {Math.abs(numPercentage).toFixed(1)}%
      </span>
    </div>
  );
});

// Individual stat card component with exact styling preservation (memoized)
const DashboardStatCard = React.memo(({ config, metric, loading }) => {
  const Icon = config.icon;

  return (
    <Card
      className={`border-0 shadow-lg bg-gradient-to-br relative overflow-hidden transition-all duration-300 hover:shadow-xl ${config.gradient}`}
    >
      {/* Decorative accent */}
      <div className={`absolute top-0 right-0 w-20 h-20 ${config.accentBg} rounded-full -mr-10 -mt-10`} />

      <CardContent className="p-6">
        {loading ? (
          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-2 animate-pulse">
              <div className={`h-4 ${config.loadingColor} rounded w-24`} />
              <div className={`h-8 ${config.loadingColor} rounded w-16`} />
            </div>
            <div
              className={`w-12 h-12 ${config.iconBg} rounded-xl flex items-center justify-center animate-pulse`}
            >
              <div className={`w-6 h-6 ${config.loadingColor} rounded`} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-2">
              <p className={`text-sm font-medium ${config.titleColor}`}>
                {config.title}
              </p>
              <div className="flex items-baseline space-x-2">
                <p className={`text-2xl font-bold ${config.valueColor}`}>
                  {metric?.display_value || "0"}
                </p>
                {metric?.trend_direction && (
                  <TrendIndicator
                    direction={metric.trend_direction}
                    percentage={metric.trend_percentage}
                  />
                )}
              </div>
            </div>
            <div
              className={`w-12 h-12 ${config.iconBg} rounded-xl flex items-center justify-center`}
            >
              <Icon className={`w-6 h-6 ${config.iconColor}`} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

const ReportsPage = () => {
  // Fetch dashboard stats with polling (silent background updates after initial load)
  const { metrics, isInitialLoad } = useDashboardStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <AppHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Reports"
          subtitle="Business analytics and reporting metrics"
        />

        {/* Stats Grid */}
        <ErrorBoundary
          title="Stats Loading Error"
          message="Unable to load dashboard statistics. Please refresh the page."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            {/* Render all 5 cards uniformly from config */}
            {STATS_CONFIG.map((config) => (
              <DashboardStatCard
                key={config.key}
                config={config}
                metric={metrics[config.key]}
                loading={isInitialLoad}
              />
            ))}
          </div>
        </ErrorBoundary>

        {/* Revenue and Loan Trends */}
        <ErrorBoundary
          title="Trends Loading Error"
          message="Unable to load revenue and loan trends. Please refresh the page."
        >
          <RevenueAndLoanTrends />
        </ErrorBoundary>
      </main>
    </div>
  );
};

export default ReportsPage;
