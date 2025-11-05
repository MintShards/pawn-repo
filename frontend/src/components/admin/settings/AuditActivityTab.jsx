import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import UnifiedPagination from '../../ui/unified-pagination';
import { getPaginationConfig } from '../../../utils/paginationConfig';
import UnifiedActivityCard from '../../activity/UnifiedActivityCard';
import {
  Activity,
  Search,
  RefreshCw,
  Download,
  Clock,
  User
} from 'lucide-react';
import adminService from '../../../services/adminService';
import { toast } from 'sonner';
import { AuditStatsCard } from './AuditStatsCard';

const AuditActivityTab = () => {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [exporting, setExporting] = useState(false);

  // Utility: Get date range parameters
  const getDateRangeParams = (range) => {
    const now = new Date();
    switch (range) {
      case 'today': {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        return { start_date: startOfDay.toISOString() };
      }
      case '7days': {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return { start_date: sevenDaysAgo.toISOString() };
      }
      case '30days': {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return { start_date: thirtyDaysAgo.toISOString() };
      }
      default:
        return {};
    }
  };


  // Utility: Format relative time
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'N/A';

    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    // Fallback to formatted date
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const fetchActivityLogs = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const dateParams = getDateRangeParams(dateRange);
      const params = {
        page,
        per_page: perPage,
        ...dateParams
      };

      if (search) params.search = search;
      if (userFilter) params.user_id = userFilter;
      if (severityFilter) params.severities = [severityFilter];

      const response = await adminService.listActivityLogs(params);
      setLogs(response.logs || []);
      setTotalLogs(response.total || 0);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast.error('Failed to fetch activity logs');
    } finally {
      setLoading(false);
    }
  }, [search, userFilter, severityFilter, perPage, dateRange]);

  useEffect(() => {
    fetchActivityLogs(1);
  }, [fetchActivityLogs]);

  // Handle CSV export
  const handleExport = async () => {
    try {
      setExporting(true);
      toast.info('Exporting activity logs...');

      const dateParams = getDateRangeParams(dateRange);
      const params = {
        search,
        user_id: userFilter || undefined,
        severities: severityFilter ? [severityFilter] : undefined,
        ...dateParams
      };

      await adminService.exportActivityLogsCsv(params);
      toast.success('Activity logs exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export activity logs');
    } finally {
      setExporting(false);
    }
  };

  // Handle page size change
  const handlePageSizeChange = (newSize) => {
    setPerPage(newSize);
    setCurrentPage(1); // Reset to page 1 when changing page size
  };


  const totalPages = Math.ceil(totalLogs / perPage);

  return (
    <div className="space-y-6 p-1">
      {/* Header with enhanced styling */}
      <div className="pb-2">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Audit & Activity Logs</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Monitor user actions and system events across the platform
            </p>
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <AuditStatsCard />

      {/* Filters & Search - Improved compact layout */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 via-slate-50 to-blue-50 dark:from-blue-950/10 dark:via-slate-900/20 dark:to-blue-950/10 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                <Search className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                  Filter & Search Logs
                </CardTitle>
                <CardDescription className="text-sm font-medium mt-0.5">
                  {totalLogs > 0 ? (
                    <span className="inline-flex items-center">
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">{totalLogs.toLocaleString()}</span>
                      <span className="text-slate-500 dark:text-slate-400 ml-1">total activities</span>
                    </span>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">No activities found</span>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleExport}
                variant="outline"
                size="sm"
                disabled={loading || logs.length === 0 || exporting}
                className="bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all shadow-sm"
              >
                <Download className="w-4 h-4 mr-2" />
                {exporting ? 'Exporting...' : 'Export CSV'}
              </Button>
              <Button
                onClick={() => fetchActivityLogs(currentPage)}
                variant="outline"
                size="sm"
                disabled={loading}
                className="bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Quick Filters - Compact button group with better visual feedback */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Quick Filters
              </Label>
              {(dateRange !== 'all' || search || userFilter || severityFilter) && (
                <button
                  onClick={() => {
                    setDateRange('all');
                    setSearch('');
                    setUserFilter('');
                    setSeverityFilter('');
                  }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={dateRange === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('today')}
                className={`transition-all ${
                  dateRange === 'today'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                    : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                <Clock className="w-3.5 h-3.5 mr-1.5" />
                Today
              </Button>
              <Button
                variant={dateRange === '7days' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('7days')}
                className={`transition-all ${
                  dateRange === '7days'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                    : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                Last 7 Days
              </Button>
              <Button
                variant={dateRange === '30days' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('30days')}
                className={`transition-all ${
                  dateRange === '30days'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                    : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                Last 30 Days
              </Button>
              <Button
                variant={dateRange === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('all')}
                className={`transition-all ${
                  dateRange === 'all'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                    : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                All Time
              </Button>
            </div>
          </div>

          {/* Advanced Filters - Improved spacing and visual hierarchy */}
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Advanced Filters
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Search
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="search"
                    placeholder="Search description or details..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-10 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="userFilter" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  User ID
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="userFilter"
                    placeholder="Filter by user ID..."
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="pl-10 h-10 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="severityFilter" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Severity Level
                </Label>
                <div className="relative">
                  <select
                    id="severityFilter"
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="w-full h-10 pl-3 pr-10 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">All Severities</option>
                    <option value="critical">🔴 Critical</option>
                    <option value="high">🟠 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">🔵 Low</option>
                    <option value="info">ℹ️ Info</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Logs List - Enhanced header styling matching Filter section */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-4 bg-gradient-to-r from-purple-50 via-slate-50 to-purple-50 dark:from-purple-950/10 dark:via-slate-900/20 dark:to-purple-950/10 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-sm">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                  Recent Activity
                </CardTitle>
                <CardDescription className="text-sm font-medium mt-0.5">
                  <span className="text-slate-500 dark:text-slate-400">Latest user actions and system events</span>
                </CardDescription>
              </div>
            </div>
            {!loading && logs.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Live
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="relative">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 dark:border-slate-700 border-t-blue-600 mx-auto"></div>
                  <Activity className="w-5 h-5 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-300">Loading activity logs...</p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Please wait</p>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16">
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <Activity className="w-10 h-10 text-slate-400 dark:text-slate-600" />
              </div>
              <p className="text-base font-medium text-slate-700 dark:text-slate-300">No activity logs found</p>
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
                Try adjusting your filters or date range
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <UnifiedActivityCard
                  key={log.id || log._id}
                  activity={log}
                  showUserId={true}
                  formatRelativeTime={formatRelativeTime}
                />
              ))}
            </div>
          )}

          {/* Unified Pagination */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            <UnifiedPagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={perPage}
              totalItems={totalLogs}
              onPageChange={fetchActivityLogs}
              onPageSizeChange={handlePageSizeChange}
              {...getPaginationConfig('activityLog')}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditActivityTab;
