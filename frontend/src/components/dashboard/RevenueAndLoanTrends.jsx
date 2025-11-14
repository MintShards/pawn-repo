import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Alert, AlertDescription } from '../ui/alert';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  CreditCard,
  Calendar,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import trendsService from '../../services/trendsService';

// Time period options
const PERIOD_OPTIONS = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '1y', label: '1 Year' }
];

// Custom tooltip for revenue chart
const RevenueTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
          {label}
        </p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-xs">
            <span style={{ color: entry.color }}>{entry.name}:</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              ${entry.value.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Custom tooltip for loan chart
const LoanTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
          {label}
        </p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-xs">
            <span style={{ color: entry.color }}>{entry.name}:</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Stat card component
const StatCard = ({ icon: Icon, label, value, subValue, iconColor, iconBg }) => (
  <div className="flex items-center gap-3">
    <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>
      <Icon className={`w-5 h-5 ${iconColor}`} />
    </div>
    <div>
      <p className="text-xs text-slate-600 dark:text-slate-400">{label}</p>
      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p>
      {subValue && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{subValue}</p>
      )}
    </div>
  </div>
);

const RevenueAndLoanTrends = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revenueTrends, setRevenueTrends] = useState(null);
  const [loanTrends, setLoanTrends] = useState(null);

  // Fetch trends data
  const fetchTrends = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await trendsService.getAllTrends(selectedPeriod);
      setRevenueTrends(data.revenue);
      setLoanTrends(data.loans);
    } catch (err) {
      setError(err.message || 'Failed to load trends data');
      console.error('Error fetching trends:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  // Fetch on mount and period change
  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Format number
  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  // Render loading skeleton
  if (loading) {
    return (
      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-10 w-64" />
            </div>

            {/* Stats skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>

            {/* Chart skeletons */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-80" />
              <Skeleton className="h-80" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="ml-2">
              {error}
              <Button
                variant="outline"
                size="sm"
                className="ml-4"
                onClick={fetchTrends}
              >
                <RefreshCw className="w-3 h-3 mr-2" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Revenue & Loan Trends
                </CardTitle>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Performance analytics and insights
                </p>
              </div>
            </div>

            {/* Period selector */}
            <div className="flex items-center gap-2">
              {PERIOD_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={selectedPeriod === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPeriod(option.value)}
                  className={
                    selectedPeriod === option.value
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : ''
                  }
                >
                  {option.label}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchTrends}
                title="Refresh data"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <StatCard
              icon={DollarSign}
              label="Total Revenue"
              value={formatCurrency(revenueTrends?.summary?.total_revenue || 0)}
              subValue={`Avg: ${formatCurrency(revenueTrends?.summary?.avg_daily_revenue || 0)}/day`}
              iconColor="text-green-600 dark:text-green-400"
              iconBg="bg-green-100 dark:bg-green-900/30"
            />
            <StatCard
              icon={CreditCard}
              label="Total Payments"
              value={formatNumber(revenueTrends?.summary?.total_payments || 0)}
              subValue={`${formatCurrency(revenueTrends?.summary?.total_interest || 0)} interest`}
              iconColor="text-blue-600 dark:text-blue-400"
              iconBg="bg-blue-100 dark:bg-blue-900/30"
            />
            <StatCard
              icon={TrendingUp}
              label="New Loans"
              value={formatNumber(loanTrends?.summary?.total_new_loans || 0)}
              subValue={`${formatCurrency(loanTrends?.summary?.avg_loan_amount || 0)} avg`}
              iconColor="text-purple-600 dark:text-purple-400"
              iconBg="bg-purple-100 dark:bg-purple-900/30"
            />
            <StatCard
              icon={Calendar}
              label="Active Loans"
              value={formatNumber(loanTrends?.summary?.current_active_loans || 0)}
              subValue={`${formatNumber(loanTrends?.summary?.total_redemptions || 0)} redeemed`}
              iconColor="text-orange-600 dark:text-orange-400"
              iconBg="bg-orange-100 dark:bg-orange-900/30"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Revenue Breakdown
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueTrends?.data || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    stroke="#94a3b8"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="#94a3b8"
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    dataKey="principal_collected"
                    stackId="a"
                    fill="#3b82f6"
                    name="Principal"
                  />
                  <Bar
                    dataKey="interest_collected"
                    stackId="a"
                    fill="#8b5cf6"
                    name="Interest"
                  />
                  <Bar
                    dataKey="extension_fees"
                    stackId="a"
                    fill="#f59e0b"
                    name="Extensions"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Loan Chart */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Loan Activity
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={loanTrends?.data || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    stroke="#94a3b8"
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip content={<LoanTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="new_loans"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="New Loans"
                    dot={{ fill: '#10b981', r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="redemptions"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Redemptions"
                    dot={{ fill: '#ef4444', r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="active_loans"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Active"
                    dot={{ fill: '#3b82f6', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

RevenueAndLoanTrends.displayName = 'RevenueAndLoanTrends';

export default React.memo(RevenueAndLoanTrends);
