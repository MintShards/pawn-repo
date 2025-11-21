import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Download, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { DateRangePicker } from '../ui/date-range-picker';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import reportsService from '../../services/reportsService';
import { Alert, AlertDescription } from '../ui/alert';
import { useComponentLoading } from '../../contexts/ReportsLoadingContext';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

// Period options for preset selection
const PERIOD_OPTIONS = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '1y', label: '1 Year' }
];

const CollectionsAnalytics = () => {
  // Coordinated loading state
  const { showLoading, setReady, setFailed } = useComponentLoading('collections');

  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [customDateRange, setCustomDateRange] = useState(null);
  const [selectionMode, setSelectionMode] = useState('preset'); // 'preset' or 'custom'
  const [isTransitioning, setIsTransitioning] = useState(false); // Track data transitions
  const abortControllerRef = useRef(null);

  // Convert period to date range
  const periodToDateRange = (period) => {
    const now = new Date();
    const end = endOfDay(now);
    let start;

    switch (period) {
      case '7d':
        start = startOfDay(subDays(now, 7));
        break;
      case '30d':
        start = startOfDay(subDays(now, 30));
        break;
      case '90d':
        start = startOfDay(subDays(now, 90));
        break;
      case '1y':
        start = startOfDay(subDays(now, 365));
        break;
      default:
        start = startOfDay(subDays(now, 30));
    }

    return { start, end };
  };

  // Fetch data with race condition prevention
  // Using useRef to avoid fetchData recreation on every render
  const fetchDataRef = useRef(null);
  fetchDataRef.current = useCallback(async () => {
    // Abort previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setError(null);
      setIsTransitioning(true); // Mark as transitioning when fetch starts

      let result;
      if (selectionMode === 'custom' && customDateRange?.from && customDateRange?.to) {
        // Custom date range
        result = await reportsService.getCollectionsAnalytics(
          format(customDateRange.from, 'yyyy-MM-dd'),
          format(customDateRange.to, 'yyyy-MM-dd'),
          controller.signal
        );
      } else {
        // Preset period - convert to dates
        const { start, end } = periodToDateRange(selectedPeriod);
        result = await reportsService.getCollectionsAnalytics(
          format(start, 'yyyy-MM-dd'),
          format(end, 'yyyy-MM-dd'),
          controller.signal
        );
      }

      if (!controller.signal.aborted) {
        setData(result);
        setIsTransitioning(false); // Clear transitioning state on success
        setReady(); // Notify coordinated loading system
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('Failed to load collections analytics. Please try again.');
        console.error('Collections analytics error:', err);
        setIsTransitioning(false); // Clear transitioning state on error
        setFailed(); // Notify coordinated loading system (don't block others)
      }
    }
  }, [selectedPeriod, selectionMode, customDateRange, setReady, setFailed]);

  // OPTIMIZATION: Memoize chart data transformation (MUST be before early returns)
  const chartData = useMemo(() => data?.historical || [], [data?.historical]);

  // OPTIMIZATION: Memoize tooltip configuration (MUST be before early returns)
  const tooltipConfig = useMemo(() => ({
    formatter: (value) => {
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
      return [formatted, 'Overdue Amount'];
    },
    labelFormatter: (date) => new Date(date).toLocaleDateString(),
    contentStyle: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      border: '1px solid #f43f5e',
      borderRadius: '8px'
    }
  }), []);

  // OPTIMIZATION: Memoize date formatter for X-axis (MUST be before early returns)
  const xAxisFormatter = useCallback((date) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }, []);

  // OPTIMIZATION: Memoize Y-axis formatter (MUST be before early returns)
  const yAxisFormatter = useCallback((value) => `$${(value / 1000).toFixed(0)}K`, []);

  // Fetch on mount and when dependencies change - instant for all selections
  useEffect(() => {
    // Fetch immediately for all selection types (preset buttons and custom date ranges)
    // DateRangePicker only fires onChange on "Apply" click, so no need for debouncing
    fetchDataRef.current?.();

    // Cleanup: abort pending request on unmount or dependency change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedPeriod, selectionMode, customDateRange]);

  // Event handlers - batched state updates for immediate response
  const handlePeriodChange = useCallback((period) => {
    React.startTransition(() => {
      setSelectedPeriod(period);
      setSelectionMode('preset');
      setCustomDateRange(null);
    });
  }, []);

  const handleCustomDateRangeChange = useCallback((range) => {
    React.startTransition(() => {
      setCustomDateRange(range);
      setSelectionMode('custom');
    });
  }, []);

  const handleClearCustomRange = useCallback(() => {
    React.startTransition(() => {
      setCustomDateRange(null);
      setSelectionMode('preset');
    });
  }, []);

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await reportsService.exportCollectionsCSV();
      const filename = `collections-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      reportsService.downloadCSV(blob, filename);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  // OPTIMIZATION: Memoize currency formatter to avoid recreation on every render
  const formatCurrency = useMemo(() => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    return (amount) => formatter.format(amount);
  }, []);

  // OPTIMIZATION: Memoize TrendIndicator component to prevent re-renders
  const TrendIndicator = useMemo(() => {
    return ({ value, isPercentage = false }) => {
      if (Math.abs(value) < 0.1) {
        return <span className="text-xs text-slate-500 dark:text-slate-400">Stable</span>;
      }

      const isPositive = value > 0;
      const Icon = isPositive ? TrendingUp : TrendingDown;
      const colorClass = isPositive
        ? 'text-red-600 dark:text-red-400'  // Positive trend is bad for overdue
        : 'text-green-600 dark:text-green-400';  // Negative trend is good

      return (
        <div className={`flex items-center space-x-1 ${colorClass}`}>
          <Icon className="w-3 h-3" />
          <span className="text-xs font-medium">
            {Math.abs(value).toFixed(1)}{isPercentage ? '%' : ''}
          </span>
        </div>
      );
    };
  }, []);

  // Render loading skeleton
  if (showLoading) {
    return (
      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            {/* Title section skeleton */}
            <div className="flex items-center gap-2">
              {/* Icon badge skeleton with pulse */}
              <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-lg opacity-50 animate-pulse" />
              <div className="space-y-2">
                {/* Title skeleton with shimmer */}
                <div className="h-6 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded w-48 animate-shimmer bg-[length:200%_100%]" />
                {/* Description skeleton */}
                <div className="h-3 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded w-64 animate-shimmer bg-[length:200%_100%]" />
              </div>
            </div>

            {/* Date selection controls skeleton */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Preset period buttons skeleton */}
              <div className="flex flex-wrap items-center gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-8 w-16 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded-md animate-shimmer bg-[length:200%_100%]"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  />
                ))}

                {/* Date range picker skeleton */}
                <div className="h-8 w-56 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded-md animate-shimmer bg-[length:200%_100%]" style={{ animationDelay: '0.2s' }} />
              </div>

              {/* Export button skeleton */}
              <div className="h-8 w-28 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded-md animate-shimmer bg-[length:200%_100%]" style={{ animationDelay: '0.25s' }} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary metrics skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { delay: '0s', width: 'w-24' },
              { delay: '0.1s', width: 'w-28' },
              { delay: '0.2s', width: 'w-20' }
            ].map((config, i) => (
              <div key={i} className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-6 border border-slate-200 dark:border-slate-700 transition-all duration-300 hover:shadow-md">
                {/* Label */}
                <div
                  className={`h-4 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded ${config.width} mb-3 animate-shimmer bg-[length:200%_100%]`}
                  style={{ animationDelay: config.delay }}
                />
                {/* Value */}
                <div
                  className="h-8 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded w-32 mb-2 animate-shimmer bg-[length:200%_100%]"
                  style={{ animationDelay: config.delay }}
                />
                {/* Trend indicator */}
                <div
                  className="h-3 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded w-28 animate-shimmer bg-[length:200%_100%]"
                  style={{ animationDelay: config.delay }}
                />
              </div>
            ))}
          </div>

          {/* Table skeleton */}
          <div className="space-y-3">
            {/* Table title */}
            <div className="h-5 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded w-48 animate-shimmer bg-[length:200%_100%]" />
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              {/* Table header */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4">
                <div className="grid grid-cols-4 gap-4">
                  {['Age Range', 'Count', 'Amount', 'Percentage'].map((_, i) => (
                    <div
                      key={i}
                      className="h-4 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded animate-shimmer bg-[length:200%_100%]"
                      style={{ animationDelay: `${i * 0.05}s` }}
                    />
                  ))}
                </div>
              </div>
              {/* Table rows */}
              {[0, 1, 2, 3].map((rowIndex) => (
                <div key={rowIndex} className="border-t border-slate-100 dark:border-slate-800 p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="grid grid-cols-4 gap-4">
                    {[0, 1, 2, 3].map((colIndex) => (
                      <div
                        key={colIndex}
                        className="h-4 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded animate-shimmer bg-[length:200%_100%]"
                        style={{
                          animationDelay: `${(rowIndex * 4 + colIndex) * 0.03}s`,
                          width: colIndex === 0 ? '75%' : colIndex === 3 ? '50%' : '85%'
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chart skeleton with realistic graph pattern */}
          <div className="space-y-3">
            {/* Chart title */}
            <div className="h-5 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded w-56 animate-shimmer bg-[length:200%_100%]" />
            <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-6 border border-slate-200 dark:border-slate-700 h-80 relative overflow-hidden">
              {/* Chart axes skeleton */}
              <div className="absolute bottom-6 left-6 right-6 h-px bg-slate-300 dark:bg-slate-600" />
              <div className="absolute bottom-6 left-6 top-6 w-px bg-slate-300 dark:bg-slate-600" />

              {/* Y-axis labels */}
              <div className="absolute left-0 top-6 bottom-6 flex flex-col justify-between w-12 pr-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-3 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded w-10 animate-shimmer bg-[length:200%_100%]"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  />
                ))}
              </div>

              {/* X-axis labels */}
              <div className="absolute bottom-0 left-12 right-6 flex justify-between h-4">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-3 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded w-8 animate-shimmer bg-[length:200%_100%]"
                    style={{ animationDelay: `${i * 0.04}s` }}
                  />
                ))}
              </div>

              {/* Simulated trend line */}
              <svg className="absolute left-12 top-6 right-6 bottom-12" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path
                  d="M 0,80 L 15,75 L 30,60 L 45,55 L 60,45 L 75,40 L 90,35 L 100,30"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-rose-300 dark:text-rose-500 opacity-30 animate-pulse"
                  strokeDasharray="5,5"
                />
                {/* Data points */}
                {[0, 15, 30, 45, 60, 75, 90, 100].map((x, i) => (
                  <circle
                    key={i}
                    cx={x}
                    cy={80 - (i * 6)}
                    r="2"
                    className="fill-rose-400 dark:fill-rose-500 opacity-40 animate-pulse"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </svg>

              {/* Loading text */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                    <span className="animate-pulse">Loading trend data...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const { summary, aging_buckets } = data;

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Title section */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-lg flex items-center justify-center shadow-sm">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Collections Analytics
              </CardTitle>
              <CardDescription className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Overdue loan tracking and aging analysis
              </CardDescription>
            </div>
          </div>

          {/* Date selection controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Period selector and date range picker */}
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
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
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
                className={selectionMode === 'custom' ? 'ring-2 ring-rose-500 rounded-md' : ''}
              />
            </div>

            {/* Export button */}
            <Button
              onClick={handleExport}
              disabled={exporting}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Overdue */}
          <Card className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  💵 Total Overdue
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                {formatCurrency(summary.total_overdue)}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <TrendIndicator value={summary.total_overdue_trend} isPercentage />
                <span>vs. last period</span>
              </div>
            </CardContent>
          </Card>

          {/* Overdue Count */}
          <Card className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  📊 Overdue Count
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                {summary.count}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <TrendIndicator value={summary.count_trend} />
                <span>{Math.abs(summary.count_trend)} loans vs. last period</span>
              </div>
            </CardContent>
          </Card>

          {/* Avg Days Overdue */}
          <Card className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  ⏱️ Avg Days Overdue
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                {summary.avg_days_overdue.toFixed(1)}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <TrendIndicator value={summary.avg_days_trend} />
                <span>{Math.abs(summary.avg_days_trend).toFixed(1)} days vs. last period</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Aging Breakdown Table */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Overdue Aging Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Age Range
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Count
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Amount
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    % of Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {aging_buckets.map((bucket, index) => (
                  <tr
                    key={bucket.range}
                    className={`border-b border-slate-100 dark:border-slate-800 ${
                      bucket.range === '30+ days' ? 'bg-orange-50/50 dark:bg-orange-900/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4 text-sm text-slate-700 dark:text-slate-300">
                      {bucket.range === '30+ days' ? '⚠️ ' : ''}
                      {bucket.range}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                      {bucket.count}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(bucket.amount)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                      {bucket.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-100/50 dark:bg-slate-800/50 font-bold">
                  <td className="py-3 px-4 text-sm text-slate-900 dark:text-slate-100">TOTAL</td>
                  <td className="py-3 px-4 text-sm text-right text-slate-900 dark:text-slate-100">
                    {summary.count}
                  </td>
                  <td className="py-3 px-4 text-sm text-right text-slate-900 dark:text-slate-100">
                    {formatCurrency(summary.total_overdue)}
                  </td>
                  <td className="py-3 px-4 text-sm text-right text-slate-900 dark:text-slate-100">
                    100.0%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Historical Trend Chart */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            {selectionMode === 'custom' && customDateRange?.from && customDateRange?.to
              ? `Overdue Trend - ${format(customDateRange.from, 'MMM d')} to ${format(customDateRange.to, 'MMM d, yyyy')}`
              : `Overdue Trend - Last ${
                  selectedPeriod === '7d' ? '7 Days' :
                  selectedPeriod === '30d' ? '30 Days' :
                  selectedPeriod === '90d' ? '90 Days' :
                  '365 Days'
                }`
            }
          </h3>
          <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700 relative">
            {/* Loading overlay during data transitions */}
            {isTransitioning && (
              <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium">Loading trend data...</span>
                </div>
              </div>
            )}
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                  tickFormatter={xAxisFormatter}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                  tickFormatter={yAxisFormatter}
                />
                <Tooltip
                  formatter={tooltipConfig.formatter}
                  labelFormatter={tooltipConfig.labelFormatter}
                  contentStyle={tooltipConfig.contentStyle}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  dot={{ fill: '#f43f5e', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
              {summary.total_overdue_trend < 0 ? (
                <span className="text-green-600 dark:text-green-400">
                  ↓ Decreasing (Good!) | Target: &lt; $10,000
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-400">
                  ↑ Increasing (Needs Attention) | Target: &lt; $10,000
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CollectionsAnalytics;
