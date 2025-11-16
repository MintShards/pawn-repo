import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Download, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import reportsService from '../../services/reportsService';
import { Alert, AlertDescription } from '../ui/alert';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const CollectionsAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await reportsService.getCollectionsAnalytics();
      setData(result);
    } catch (err) {
      setError('Failed to load collections analytics. Please try again.');
      console.error('Collections analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const TrendIndicator = ({ value, isPercentage = false }) => {
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

  if (loading) {
    return (
      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="animate-pulse">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                {/* Icon badge skeleton */}
                <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-lg opacity-50" />
                <div className="space-y-2">
                  {/* Title skeleton */}
                  <div className="h-6 bg-slate-200/60 dark:bg-slate-700/40 rounded w-48" />
                  {/* Description skeleton */}
                  <div className="h-3 bg-slate-200/60 dark:bg-slate-700/40 rounded w-64" />
                </div>
              </div>
              {/* Export button skeleton */}
              <div className="h-9 w-28 bg-slate-200/60 dark:bg-slate-700/40 rounded-md" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="animate-pulse space-y-6">
            {/* Summary metrics skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                  <div className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded w-24 mb-2" />
                  <div className="h-8 bg-slate-200/60 dark:bg-slate-700/40 rounded w-32 mb-1" />
                  <div className="h-3 bg-slate-200/60 dark:bg-slate-700/40 rounded w-28" />
                </div>
              ))}
            </div>

            {/* Table skeleton */}
            <div className="space-y-3">
              <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-48" />
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3">
                  <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded" />
                    ))}
                  </div>
                </div>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border-t border-slate-100 dark:border-slate-800 p-3">
                    <div className="grid grid-cols-4 gap-4">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j} className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart skeleton */}
            <div className="space-y-3">
              <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-56" />
              <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700 h-80" />
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

  const { summary, aging_buckets, historical } = data;

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-lg flex items-center justify-center shadow-sm">
                <Clock className="w-5 h-5 text-white" />
              </div>
              Collections Analytics
            </CardTitle>
            <CardDescription className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Overdue loan tracking and aging analysis
            </CardDescription>
          </div>
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
            Overdue Trend - Last 90 Days
          </h3>
          <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historical}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                  tickFormatter={(date) => {
                    const d = new Date(date);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value), 'Overdue Amount']}
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #f43f5e',
                    borderRadius: '8px'
                  }}
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
