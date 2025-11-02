import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Activity,
  User,
  Clock,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import adminService from '../../../services/adminService';
import { toast } from 'sonner';

const AuditActivityTab = () => {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(20);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const fetchActivityLogs = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = {
        page,
        per_page: perPage,
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
  }, [search, userFilter, severityFilter, perPage]);

  useEffect(() => {
    fetchActivityLogs(1);
  }, [fetchActivityLogs]);

  const getSeverityBadge = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Critical
        </Badge>;
      case 'high':
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
          <AlertTriangle className="w-3 h-3 mr-1" />
          High
        </Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <Info className="w-3 h-3 mr-1" />
          Medium
        </Badge>;
      case 'low':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <Info className="w-3 h-3 mr-1" />
          Low
        </Badge>;
      default:
        return <Badge variant="outline">
          <Info className="w-3 h-3 mr-1" />
          {severity || 'Info'}
        </Badge>;
    }
  };

  const getActivityIcon = (activityType) => {
    if (activityType?.includes('LOGIN')) return <User className="w-4 h-4" />;
    if (activityType?.includes('CREATE') || activityType?.includes('UPDATE')) return <Activity className="w-4 h-4" />;
    if (activityType?.includes('DELETE')) return <XCircle className="w-4 h-4" />;
    return <Activity className="w-4 h-4" />;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const totalPages = Math.ceil(totalLogs / perPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Audit & Activity Logs</h2>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Monitor user actions and system events across the platform
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Search className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <CardTitle>Filter Activity Logs</CardTitle>
              <CardDescription>Search and filter by user, severity, or keywords</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search description or details..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="userFilter">User ID</Label>
              <Input
                id="userFilter"
                placeholder="Filter by user ID..."
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="severityFilter">Severity</Label>
              <select
                id="severityFilter"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="info">Info</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Showing {logs.length} of {totalLogs.toLocaleString()} total logs
            </p>
            <Button
              onClick={() => fetchActivityLogs(currentPage)}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Activity Logs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest user actions and system events</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-slate-600 dark:text-slate-400">Loading activity logs...</p>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">No activity logs found</p>
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id || log._id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="mt-1 p-2 bg-white dark:bg-slate-700 rounded-lg">
                        {getActivityIcon(log.activity_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {log.description || log.activity_type}
                          </p>
                          {getSeverityBadge(log.severity)}
                          {log.is_success !== undefined && (
                            log.is_success ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Success
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                <XCircle className="w-3 h-3 mr-1" />
                                Failed
                              </Badge>
                            )
                          )}
                        </div>

                        <div className="flex items-center space-x-4 text-xs text-slate-600 dark:text-slate-400">
                          <div className="flex items-center space-x-1">
                            <User className="w-3 h-3" />
                            <span>User {log.user_id}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatTimestamp(log.timestamp)}</span>
                          </div>
                          {log.activity_type && (
                            <Badge variant="outline" className="text-xs">
                              {log.activity_type}
                            </Badge>
                          )}
                        </div>

                        {log.details && typeof log.details === 'object' && Object.keys(log.details).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                              View Details
                            </summary>
                            <pre className="mt-2 p-2 bg-white dark:bg-slate-900 rounded text-xs overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => fetchActivityLogs(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  variant="outline"
                  size="sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => fetchActivityLogs(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                  variant="outline"
                  size="sm"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditActivityTab;
