import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { DateRangePicker } from '../ui/date-range-picker';
import { useComponentLoading } from '../../contexts/ReportsLoadingContext';
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
  Wallet,
  Coins,
  Clock,
  AlertTriangle,
  Award,
  Calculator,
  RefreshCw,
  AlertCircle,
  BarChart3
} from 'lucide-react';
import trendsService from '../../services/trendsService';

// Optimized imports from extracted modules
import {
  PERIOD_OPTIONS,
  REVENUE_GRADIENTS,
  REVENUE_BAR_CONFIG,
  LOAN_LINE_CONFIG,
  CHART_STYLES
} from './constants/trendsConstants';
import { formatCurrency, formatNumber, formatAxisValue, formatLoanAxisValue, calculatePercentage } from './utils/trendsFormatters';
import StatCard from './components/StatCard';
import { CustomRevenueLegend, CustomLoanLegend } from './components/ChartLegends';
import { RevenueTooltip, LoanTooltip } from './components/ChartTooltips';
import TrendsLoadingSkeleton from './components/TrendsLoadingSkeleton';

/**
 * Validate trends data structure
 * @param {Object} data - Trends data from API
 * @returns {Object} Validated data
 * @throws {Error} If data structure is invalid
 */
const validateTrendsData = (data) => {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid trends data structure');
  }

  if (!data.revenue || !data.loans) {
    throw new Error('Missing required trends data fields');
  }

  // Validate summary fields
  const requiredRevenueSummary = ['total_revenue', 'avg_daily_revenue'];
  const requiredLoanSummary = ['total_redeemed', 'total_forfeited', 'total_sold', 'current_active_loans'];

  if (!requiredRevenueSummary.every(key => key in (data.revenue.summary || {}))) {
    throw new Error('Invalid revenue summary structure');
  }

  if (!requiredLoanSummary.every(key => key in (data.loans.summary || {}))) {
    throw new Error('Invalid loan summary structure');
  }

  // Validate data arrays
  if (!Array.isArray(data.revenue.data)) {
    throw new Error('Invalid revenue data array');
  }

  if (!Array.isArray(data.loans.data)) {
    throw new Error('Invalid loan data array');
  }

  return data;
};

/**
 * Revenue & Loan Trends Component
 * Displays comprehensive analytics for revenue and loan performance over time
 *
 * Features:
 * - Real-time period selection (7d, 30d, 90d, 1y)
 * - Revenue breakdown chart with stacked bars
 * - Loan activity chart with multi-line visualization
 * - Summary statistics with 7 key metrics
 * - Accessibility support with ARIA labels and screen reader tables
 * - Race condition prevention with AbortController
 * - Loading states with optimized skeleton
 * - Error handling with retry mechanism
 *
 * @returns {JSX.Element}
 */
const RevenueAndLoanTrends = () => {
  // Coordinated loading state
  const { showLoading, setReady, setFailed } = useComponentLoading('revenue_trends');

  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [customDateRange, setCustomDateRange] = useState(null);
  const [selectionMode, setSelectionMode] = useState('preset'); // 'preset' or 'custom'
  const [error, setError] = useState(null);
  const [revenueTrends, setRevenueTrends] = useState(null);
  const [loanTrends, setLoanTrends] = useState(null);
  const abortControllerRef = useRef(null);

  // Fetch trends data with abort controller for race condition prevention
  // Using useRef to avoid fetchTrends recreation on every render
  const fetchTrendsRef = useRef(null);
  fetchTrendsRef.current = useCallback(async () => {
    // Abort previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setError(null);

      let data;
      if (selectionMode === 'custom' && customDateRange?.from && customDateRange?.to) {
        // Use custom date range
        data = await trendsService.getAllTrends(
          null,
          controller.signal,
          customDateRange.from,
          customDateRange.to
        );
      } else {
        // Use preset period
        data = await trendsService.getAllTrends(selectedPeriod, controller.signal);
      }

      // Check if request was aborted
      if (controller.signal.aborted) {
        return;
      }

      // Validate data structure before setting state
      const validatedData = validateTrendsData(data);

      setRevenueTrends(validatedData.revenue);
      setLoanTrends(validatedData.loans);
      setReady(); // Notify coordinated loading system
    } catch (err) {
      // Ignore AbortError - it's expected when user changes period quickly
      if (err.name === 'AbortError') {
        return;
      }

      setError(err.message || 'Failed to load trends data');
      console.error('Error fetching trends:', err);
      setFailed(); // Notify coordinated loading system (don't block others)
    }
  }, [selectedPeriod, selectionMode, customDateRange, setReady, setFailed]);

  // Fetch on mount and period change - instant for all selections
  useEffect(() => {
    // Fetch immediately for all selection types (preset buttons and custom date ranges)
    // DateRangePicker only fires onChange on "Apply" click, so no need for debouncing
    fetchTrendsRef.current?.();

    // Cleanup: abort pending request on unmount or dependency change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedPeriod, selectionMode, customDateRange]);

  // Memoized summary statistics calculations
  const summaryStats = useMemo(() => {
    if (!revenueTrends || !loanTrends) return null;

    const { summary: revenueSummary } = revenueTrends;
    const { summary: loanSummary } = loanTrends;

    return {
      totalRevenue: {
        value: formatCurrency(revenueSummary.total_revenue || 0),
        subValue: `${formatCurrency(revenueSummary.avg_daily_revenue || 0)}/day`
      },
      principal: {
        value: formatCurrency(revenueSummary.total_principal || 0),
        subValue: `${calculatePercentage(revenueSummary.total_principal || 0, revenueSummary.total_revenue || 0)}%`
      },
      interest: {
        value: formatCurrency(revenueSummary.total_interest || 0),
        subValue: `${calculatePercentage(revenueSummary.total_interest || 0, revenueSummary.total_revenue || 0)}%`
      },
      extensions: {
        value: formatCurrency(revenueSummary.total_extension_fees || 0),
        subValue: `${calculatePercentage(revenueSummary.total_extension_fees || 0, revenueSummary.total_revenue || 0)}%`
      },
      overdues: {
        value: formatCurrency(revenueSummary.total_overdue_fees || 0),
        subValue: `${calculatePercentage(revenueSummary.total_overdue_fees || 0, revenueSummary.total_revenue || 0)}%`
      },
      redemptions: {
        value: formatCurrency(loanSummary.total_redeemed_amount || 0),
        subValue: `${formatNumber(loanSummary.total_redeemed || 0)} loans`
      },
      avgLoan: {
        value: formatCurrency(loanSummary.avg_loan_amount || 0),
        subValue: `${formatNumber((loanSummary.total_redeemed || 0) + (loanSummary.total_forfeited || 0) + (loanSummary.total_sold || 0))} closed`
      }
    };
  }, [revenueTrends, loanTrends]);

  // Memoized chart gradient definitions
  const revenueGradientDefs = useMemo(() => (
    <defs>
      {REVENUE_GRADIENTS.map(({ id, color1, color2 }) => (
        <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color1} stopOpacity={0.95} />
          <stop offset="100%" stopColor={color2} stopOpacity={0.90} />
        </linearGradient>
      ))}
    </defs>
  ), []);

  // Memoized glow filter definitions for loan chart
  const loanGlowFilters = useMemo(() => (
    <defs>
      {['blue', 'emerald', 'orange', 'purple'].map((color) => (
        <filter key={color} id={`glow-${color}`}>
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      ))}
    </defs>
  ), []);

  // Memoized period change handler - batched state update for immediate response
  const handlePeriodChange = useCallback((period) => {
    // Use React 18 automatic batching with startTransition for non-urgent updates
    React.startTransition(() => {
      setSelectedPeriod(period);
      setSelectionMode('preset');
      setCustomDateRange(null);
    });
  }, []);

  // Custom date range handler - batched state update
  const handleCustomDateRangeChange = useCallback((range) => {
    React.startTransition(() => {
      setCustomDateRange(range);
      setSelectionMode('custom');
    });
  }, []);

  // Clear custom date range and return to preset - batched state update
  const handleClearCustomRange = useCallback(() => {
    React.startTransition(() => {
      setCustomDateRange(null);
      setSelectionMode('preset');
    });
  }, []);

  // Render loading skeleton
  if (showLoading) {
    return <TrendsLoadingSkeleton />;
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
                onClick={() => fetchTrendsRef.current?.()}
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
                <BarChart3 className="w-5 h-5 text-white" />
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

            {/* Period selector and date range picker */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Date selection group (presets + custom) */}
              <div
                role="radiogroup"
                aria-label="Time period selection"
                className="flex flex-wrap items-center gap-2"
              >
                {/* Preset period buttons */}
                {PERIOD_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={selectionMode === 'preset' && selectedPeriod === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePeriodChange(option.value)}
                    aria-label={`Select ${option.label} period`}
                    role="radio"
                    aria-checked={selectionMode === 'preset' && selectedPeriod === option.value}
                    className={
                      selectionMode === 'preset' && selectedPeriod === option.value
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : ''
                    }
                  >
                    {option.label}
                  </Button>
                ))}

                {/* Custom date range picker */}
                <DateRangePicker
                  value={customDateRange}
                  onChange={handleCustomDateRangeChange}
                  onClear={handleClearCustomRange}
                  maxDate={new Date()}
                  maxRangeDays={365}
                  className={selectionMode === 'custom' ? 'ring-2 ring-blue-500 rounded-md' : ''}
                />
              </div>

              {/* Separator */}
              <div className="hidden sm:block h-6 w-px bg-slate-300 dark:bg-slate-600" />

              {/* Refresh action */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchTrendsRef.current?.()}
                title="Refresh data"
                aria-label="Refresh trends data"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Summary Statistics - Period-Based Trends */}
          {summaryStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <StatCard
                icon={Wallet}
                label="Total Revenue"
                value={summaryStats.totalRevenue.value}
                subValue={summaryStats.totalRevenue.subValue}
                iconColor="text-green-600 dark:text-green-400"
                iconBg="bg-green-100 dark:bg-green-900/30"
              />
              <StatCard
                icon={Coins}
                label="Principal"
                value={summaryStats.principal.value}
                subValue={summaryStats.principal.subValue}
                iconColor="text-blue-600 dark:text-blue-400"
                iconBg="bg-blue-100 dark:bg-blue-900/30"
              />
              <StatCard
                icon={TrendingUp}
                label="Interest"
                value={summaryStats.interest.value}
                subValue={summaryStats.interest.subValue}
                iconColor="text-yellow-600 dark:text-yellow-400"
                iconBg="bg-yellow-100 dark:bg-yellow-900/30"
              />
              <StatCard
                icon={Clock}
                label="Extensions"
                value={summaryStats.extensions.value}
                subValue={summaryStats.extensions.subValue}
                iconColor="text-orange-600 dark:text-orange-400"
                iconBg="bg-orange-100 dark:bg-orange-900/30"
              />
              <StatCard
                icon={AlertTriangle}
                label="Overdue Fees"
                value={summaryStats.overdues.value}
                subValue={summaryStats.overdues.subValue}
                iconColor="text-red-600 dark:text-red-400"
                iconBg="bg-red-100 dark:bg-red-900/30"
              />
              <StatCard
                icon={Award}
                label="Redemptions"
                value={summaryStats.redemptions.value}
                subValue={summaryStats.redemptions.subValue}
                iconColor="text-emerald-600 dark:text-emerald-400"
                iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              />
              <StatCard
                icon={Calculator}
                label="Avg Loan"
                value={summaryStats.avgLoan.value}
                subValue={summaryStats.avgLoan.subValue}
                iconColor="text-purple-600 dark:text-purple-400"
                iconBg="bg-purple-100 dark:bg-purple-900/30"
              />
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart with accessibility */}
            <div
              className="space-y-3"
              role="img"
              aria-label="Revenue breakdown showing principal, interest, and extension fees over selected time period"
            >
              <h3
                className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                id="revenue-chart-title"
              >
                Revenue Breakdown
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={revenueTrends?.data || []}
                  aria-labelledby="revenue-chart-title"
                  margin={{ top: 5, right: 5, bottom: 5, left: 30 }}
                >
                  {revenueGradientDefs}
                  <CartesianGrid {...CHART_STYLES.grid} />
                  <XAxis dataKey="date" {...CHART_STYLES.axis} />
                  <YAxis
                    {...CHART_STYLES.axis}
                    tickFormatter={formatAxisValue}
                    label={{
                      value: 'Revenue ($)',
                      angle: -90,
                      position: 'insideLeft',
                      style: {
                        fontSize: 12,
                        fill: '#64748b',
                        fontWeight: 500
                      }
                    }}
                  />
                  <Tooltip content={<RevenueTooltip />} {...CHART_STYLES.tooltip} />
                  <Legend content={<CustomRevenueLegend />} />
                  {REVENUE_BAR_CONFIG.map(({ dataKey, name, gradient, radius }) => (
                    <Bar
                      key={dataKey}
                      dataKey={dataKey}
                      stackId="a"
                      fill={gradient}
                      name={name}
                      radius={radius}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>

              {/* Hidden data table for screen readers */}
              <table className="sr-only" aria-label="Revenue data table">
                <caption>Revenue breakdown by date</caption>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Principal</th>
                    <th>Interest</th>
                    <th>Extensions</th>
                    <th>Overdue Fees</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueTrends?.data?.map((d, index) => (
                    <tr key={index}>
                      <td>{d.date}</td>
                      <td>{formatCurrency(d.principal_collected || 0)}</td>
                      <td>{formatCurrency(d.interest_collected || 0)}</td>
                      <td>{formatCurrency(d.extension_fees || 0)}</td>
                      <td>{formatCurrency(d.overdue_fees || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Loan Chart with accessibility */}
            <div
              className="space-y-3"
              role="img"
              aria-label="Loan activity showing new loans, redemptions, and active loans over selected time period"
            >
              <h3
                className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                id="loan-chart-title"
              >
                Loan Activity
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={loanTrends?.data || []}
                  aria-labelledby="loan-chart-title"
                  margin={{ top: 5, right: 5, bottom: 5, left: 30 }}
                >
                  {loanGlowFilters}
                  <CartesianGrid
                    {...CHART_STYLES.grid}
                    horizontalPoints={[0]}
                    horizontalCoordinatesGenerator={(props) => {
                      // Emphasize Y=0 baseline with custom rendering
                      return props.height ? [props.height] : [];
                    }}
                  />
                  <XAxis dataKey="date" {...CHART_STYLES.axis} />
                  <YAxis
                    {...CHART_STYLES.axis}
                    tickFormatter={formatLoanAxisValue}
                    label={{
                      value: 'Number of Loans',
                      angle: -90,
                      position: 'insideLeft',
                      style: {
                        fontSize: 12,
                        fill: '#64748b',
                        fontWeight: 500
                      }
                    }}
                  />
                  <Tooltip content={<LoanTooltip />} cursor={{ stroke: 'rgba(148, 163, 184, 0.2)', strokeWidth: 2 }} />
                  <Legend content={<CustomLoanLegend />} />
                  {LOAN_LINE_CONFIG.map(({ dataKey, name, color, filter }) => (
                    <Line
                      key={dataKey}
                      type="monotone"
                      dataKey={dataKey}
                      name={name}
                      stroke={color}
                      {...CHART_STYLES.line}
                      dot={{ ...CHART_STYLES.line.dot, fill: color }}
                      activeDot={{ ...CHART_STYLES.line.activeDot, fill: color }}
                      filter={filter}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>

              {/* Hidden data table for screen readers */}
              <table className="sr-only" aria-label="Loan activity data table">
                <caption>Loan activity by date</caption>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Active Loans</th>
                    <th>Redeemed</th>
                    <th>Forfeited</th>
                    <th>Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {loanTrends?.data?.map((d, index) => (
                    <tr key={index}>
                      <td>{d.date}</td>
                      <td>{d.active_loans || 0}</td>
                      <td>{d.redeemed || 0}</td>
                      <td>{d.forfeited || 0}</td>
                      <td>{d.sold || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

RevenueAndLoanTrends.displayName = 'RevenueAndLoanTrends';

// Error Boundary wrapper for component crash protection
class TrendsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Trends component crashed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card>
          <CardContent className="p-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  Component error occurred. Please refresh the page to continue.
                </span>
                <Button
                  onClick={() => window.location.reload()}
                  className="ml-4"
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Page
                </Button>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

TrendsErrorBoundary.displayName = 'TrendsErrorBoundary';

// Export with error boundary wrapper
export default function RevenueAndLoanTrendsWithBoundary(props) {
  return (
    <TrendsErrorBoundary>
      <RevenueAndLoanTrends {...props} />
    </TrendsErrorBoundary>
  );
}
