import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Download, Users, Briefcase } from 'lucide-react';
import reportsService from '../../services/reportsService';
import { Alert, AlertDescription } from '../ui/alert';

const TopCustomersCard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [view, setView] = useState('customers');  // 'customers' or 'staff'
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [view]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await reportsService.getTopCustomers({ limit: 10, view });
      setData(result);
    } catch (err) {
      setError('Failed to load top customers. Please try again.');
      console.error('Top customers error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await reportsService.exportTopCustomersCSV({ limit: 10, view });
      const filename = `top-${view}-${new Date().toISOString().split('T')[0]}.csv`;
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

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm h-full flex flex-col">
        <CardHeader className="pb-4">
          <div className="animate-pulse">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                {/* Icon badge skeleton */}
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg opacity-50" />
                <div className="space-y-2">
                  {/* Title skeleton */}
                  <div className="h-6 bg-slate-200/60 dark:bg-slate-700/40 rounded w-40" />
                  {/* Description skeleton */}
                  <div className="h-3 bg-slate-200/60 dark:bg-slate-700/40 rounded w-56" />
                </div>
              </div>
            </div>

            {/* View toggle buttons skeleton */}
            <div className="flex gap-2">
              <div className="h-9 w-32 bg-slate-200/60 dark:bg-slate-700/40 rounded-md" />
              <div className="h-9 w-24 bg-slate-200/60 dark:bg-slate-700/40 rounded-md" />
              <div className="h-9 w-28 bg-slate-200/60 dark:bg-slate-700/40 rounded-md ml-auto" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 flex-1 flex flex-col">
          <div className="animate-pulse flex-1 space-y-4">
            {/* Section title skeleton */}
            <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-48" />

            {/* Leaderboard table skeleton */}
            <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Table header */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3">
                <div className="grid grid-cols-4 gap-4">
                  <div className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded w-16" />
                  <div className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded w-20" />
                  <div className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded w-16 ml-auto" />
                  <div className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded w-20 ml-auto" />
                </div>
              </div>
              {/* Table rows */}
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <div key={i} className="border-t border-slate-100 dark:border-slate-800 p-3">
                  <div className="grid grid-cols-4 gap-4 items-center">
                    <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-8" />
                    <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-32" />
                    <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-12 ml-auto" />
                    <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-20 ml-auto" />
                  </div>
                </div>
              ))}
            </div>

            {/* Summary metrics skeleton */}
            <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-36 mb-3" />
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-1">
                    <div className="h-3 bg-slate-200/60 dark:bg-slate-700/40 rounded w-32" />
                    <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-24" />
                  </div>
                ))}
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

  const isCustomerView = view === 'customers';
  const displayData = isCustomerView ? data.customers : data.staff;

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start mb-4">
          <div>
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-sm">
                {isCustomerView ? (
                  <Users className="w-5 h-5 text-white" />
                ) : (
                  <Briefcase className="w-5 h-5 text-white" />
                )}
              </div>
              Top {isCustomerView ? 'Customers' : 'Staff'}
            </CardTitle>
            <CardDescription className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {isCustomerView ? 'Customer performance leaderboard' : 'Staff performance by transactions'}
            </CardDescription>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <Button
            onClick={() => setView('customers')}
            variant={isCustomerView ? 'default' : 'outline'}
            size="sm"
            className={isCustomerView
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : ''
            }
          >
            <Users className="w-4 h-4 mr-2" />
            Customers
          </Button>
          <Button
            onClick={() => setView('staff')}
            variant={!isCustomerView ? 'default' : 'outline'}
            size="sm"
            className={!isCustomerView
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : ''
            }
          >
            <Briefcase className="w-4 h-4 mr-2" />
            Staff
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting}
            variant="outline"
            size="sm"
            className="ml-auto"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col">
        {/* Leaderboard Table */}
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            {isCustomerView ? 'By Active Loan Volume' : 'By Transaction Count'}
          </h3>
          <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Rank
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Name
                  </th>
                  {isCustomerView ? (
                    <>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Loans
                      </th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Value
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Trans
                      </th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Value
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {displayData && displayData.slice(0, 10).map((item) => (
                  <tr
                    key={isCustomerView ? item.phone_number : item.user_id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-2 px-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {getMedalEmoji(item.rank)}
                    </td>
                    <td className="py-2 px-3 text-sm text-slate-700 dark:text-slate-300">
                      {item.name}
                    </td>
                    <td className="py-2 px-3 text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                      {isCustomerView ? item.active_loans : item.transaction_count}
                    </td>
                    <td className="py-2 px-3 text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(isCustomerView ? item.total_loan_value : item.total_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Metrics (Customer View Only) */}
        {isCustomerView && data.summary && (
          <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Summary Metrics
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-slate-600 dark:text-slate-400">Total Customers:</div>
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  {data.summary.total_customers}
                </div>
              </div>
              <div>
                <div className="text-slate-600 dark:text-slate-400">Avg Active Loans:</div>
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  {data.summary.avg_active_loans.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-slate-600 dark:text-slate-400">Avg Loan Value:</div>
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(data.summary.avg_loan_value)}
                </div>
              </div>
              <div>
                <div className="text-slate-600 dark:text-slate-400">Total Active Value:</div>
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(data.summary.total_active_value)}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TopCustomersCard;
