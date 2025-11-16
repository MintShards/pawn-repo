import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Download, Package, AlertTriangle } from 'lucide-react';
import reportsService from '../../services/reportsService';
import { Alert, AlertDescription } from '../ui/alert';

const InventorySnapshotCard = () => {
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
      const result = await reportsService.getInventorySnapshot();
      setData(result);
    } catch (err) {
      setError('Failed to load inventory snapshot. Please try again.');
      console.error('Inventory snapshot error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await reportsService.exportInventoryCSV();
      const filename = `inventory-snapshot-${new Date().toISOString().split('T')[0]}.csv`;
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

  const getStatusColor = (status) => {
    const colors = {
      'Active': 'bg-blue-500',
      'Overdue': 'bg-orange-500',
      'Extended': 'bg-green-500',
      'Forfeited': 'bg-red-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'Active': '🟦',
      'Overdue': '🟧',
      'Extended': '🟩',
      'Forfeited': '🟥'
    };
    return icons[status] || '';
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm h-full flex flex-col">
        <CardHeader className="pb-4">
          <div className="animate-pulse">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                {/* Icon badge skeleton */}
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg opacity-50" />
                <div className="space-y-2">
                  {/* Title skeleton */}
                  <div className="h-6 bg-slate-200/60 dark:bg-slate-700/40 rounded w-44" />
                  {/* Description skeleton */}
                  <div className="h-3 bg-slate-200/60 dark:bg-slate-700/40 rounded w-52" />
                </div>
              </div>
              {/* Export button skeleton */}
              <div className="h-9 w-28 bg-slate-200/60 dark:bg-slate-700/40 rounded-md" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 flex-1 flex flex-col">
          <div className="animate-pulse space-y-4">
            {/* Summary metrics grid skeleton */}
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                  <div className="h-3 bg-slate-200/60 dark:bg-slate-700/40 rounded w-24 mb-1" />
                  <div className="h-7 bg-slate-200/60 dark:bg-slate-700/40 rounded w-16 mb-1" />
                  <div className="h-3 bg-slate-200/60 dark:bg-slate-700/40 rounded w-20" />
                </div>
              ))}
            </div>

            {/* By Status table skeleton */}
            <div className="space-y-2">
              <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-32" />
              <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Table header */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2">
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-3 bg-slate-200/60 dark:bg-slate-700/40 rounded" />
                    ))}
                  </div>
                </div>
                {/* Table rows */}
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="border-t border-slate-100 dark:border-slate-800 p-2">
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j} className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status distribution skeleton */}
            <div className="space-y-2">
              <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-40" />
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-200/60 dark:bg-slate-700/40 rounded-full h-6" />
                    <div className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded w-32" />
                  </div>
                ))}
              </div>
            </div>

            {/* Storage aging table skeleton */}
            <div className="space-y-2">
              <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-48" />
              <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Table header */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2">
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-3 bg-slate-200/60 dark:bg-slate-700/40 rounded" />
                    ))}
                  </div>
                </div>
                {/* Table rows */}
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="border-t border-slate-100 dark:border-slate-800 p-2">
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j} className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts section skeleton */}
            <div className="mt-auto space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded w-full" />
              ))}
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

  const { summary, by_status, by_age, high_value_alert } = data;

  // Find 90+ day aging data
  const aged90Plus = by_age.find(age => age.age_range === '90+ days');

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center shadow-sm">
                <Package className="w-5 h-5 text-white" />
              </div>
              Inventory Snapshot
            </CardTitle>
            <CardDescription className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Storage analytics and aging alerts
            </CardDescription>
          </div>
          <Button
            onClick={handleExport}
            disabled={exporting}
            variant="outline"
            size="sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col">
        {/* Summary Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">📊 Total Items</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {summary.total_items}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">items stored</div>
          </div>

          <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">💰 Total Value</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(summary.total_loan_value)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">total loan val</div>
          </div>

          <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">⏱️ Avg Days</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {summary.avg_storage_days}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">days in storage</div>
          </div>
        </div>

        {/* By Status Table */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
            By Loan Status
          </h3>
          <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                  <th className="text-right py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Items</th>
                  <th className="text-right py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Value</th>
                  <th className="text-right py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">%</th>
                </tr>
              </thead>
              <tbody>
                {by_status.map((status) => (
                  <tr key={status.status} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-2 text-slate-700 dark:text-slate-300">
                      {getStatusIcon(status.status)} {status.status}
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-slate-900 dark:text-slate-100">
                      {status.item_count}
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(status.loan_value)}
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-slate-900 dark:text-slate-100">
                      {status.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Status Distribution Visual */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Status Distribution
          </h3>
          <div className="space-y-2">
            {by_status.map((status) => (
              <div key={status.status} className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                  <div
                    className={`h-full ${getStatusColor(status.status)} flex items-center justify-center text-xs text-white font-medium transition-all`}
                    style={{ width: `${status.percentage}%` }}
                  >
                    {status.percentage >= 10 && `${status.percentage.toFixed(0)}%`}
                  </div>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 w-32">
                  {status.status} ({status.item_count})
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Storage Aging Analysis */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Storage Aging Analysis
          </h3>
          <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Days</th>
                  <th className="text-right py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Items</th>
                  <th className="text-right py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Value</th>
                  <th className="text-right py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">%</th>
                </tr>
              </thead>
              <tbody>
                {by_age.map((age) => (
                  <tr
                    key={age.age_range}
                    className={`border-b border-slate-100 dark:border-slate-800 ${
                      age.alert ? 'bg-orange-50/50 dark:bg-orange-900/20' : ''
                    }`}
                  >
                    <td className="py-2 px-2 text-slate-700 dark:text-slate-300">
                      {age.alert && '⚠️ '}
                      {age.age_range}
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-slate-900 dark:text-slate-100">
                      {age.item_count}
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(age.loan_value)}
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-slate-900 dark:text-slate-100">
                      {age.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* High-Value Alert */}
        {high_value_alert && high_value_alert.count > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <div className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                  High-Value Items Alert
                </div>
                <div className="text-yellow-800 dark:text-yellow-200 space-y-1">
                  <div>
                    Loans over $5,000: {high_value_alert.count} transactions ({formatCurrency(high_value_alert.total_value)} total)
                  </div>
                  {high_value_alert.highest && (
                    <div>
                      Highest value: {formatCurrency(high_value_alert.highest.amount)} ({high_value_alert.highest.description} - {high_value_alert.highest.days_in_storage} days in storage)
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alerts & Recommendations */}
        <div className="mt-auto space-y-2 text-xs">
          {aged90Plus && aged90Plus.item_count > 0 && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <span>⚠️</span>
              <span>{aged90Plus.item_count} items aged 90+ days - Review forfeiture status</span>
            </div>
          )}
          {by_status.find(s => s.status === 'Overdue') && by_status.find(s => s.status === 'Overdue').item_count > 0 && (
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <span>💡</span>
              <span>{by_status.find(s => s.status === 'Overdue').item_count} items overdue - Consider collection follow-up</span>
            </div>
          )}
          {by_status.find(s => s.status === 'Active') && by_status.find(s => s.status === 'Active').item_count > 0 && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <span>✅</span>
              <span>{by_status.find(s => s.status === 'Active').item_count} items in active status with recent activity</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default InventorySnapshotCard;
