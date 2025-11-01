import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import UnifiedPagination from '../ui/unified-pagination';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Filter,
  Search,
  Activity,
  X
} from 'lucide-react';
import {
  formatBusinessDateTime,
  formatBusinessDate,
  getTimezoneHeaders,
  getBusinessToday,
  getBusinessYesterday,
  getBusinessDaysAgo,
  getBusinessMonthStart,
  getBusinessMonthEnd,
  getBusinessLastMonthStart,
  getBusinessLastMonthEnd,
  businessDateToISOStart,
  businessDateToISOEnd
} from '../../utils/timezoneUtils';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const UserActivityLogDialog = ({ user, open, onOpenChange }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalActivities, setTotalActivities] = useState(0);
  const [filters, setFilters] = useState({
    activityType: '',
    severity: '',
    search: '',
    isSuccess: '',
    startDate: '',
    endDate: ''
  });

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('pawn_repo_token');

      if (!token) {
        console.error('No access token found - user may need to log in');
        setActivities([]);
        setLoading(false);
        return;
      }

      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
      });

      if (filters.activityType) {
        params.append('activity_types', filters.activityType);
      }
      if (filters.severity) {
        params.append('severities', filters.severity);
      }
      if (filters.search) {
        params.append('search', filters.search);
      }
      if (filters.isSuccess !== '') {
        params.append('is_success', filters.isSuccess);
      }

      // Date filtering (using business timezone conversion)
      if (filters.startDate) {
        const startDateISO = businessDateToISOStart(filters.startDate);
        if (startDateISO) {
          params.append('start_date', startDateISO);
        }
      }
      if (filters.endDate) {
        const endDateISO = businessDateToISOEnd(filters.endDate);
        if (endDateISO) {
          params.append('end_date', endDateISO);
        }
      }

      const response = await fetch(
        `${API_URL}/api/v1/user-activity/${user.user_id}?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...getTimezoneHeaders(),
          }
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          console.error('Authentication failed - token may be expired. Please log out and log back in.');
          setActivities([]);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
        return;
      }

      const data = await response.json();
      setActivities(data.logs);
      setTotalPages(data.pages);
      setTotalActivities(data.total);
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [user, page, perPage, filters]);

  useEffect(() => {
    if (open && user) {
      fetchActivities();
    }
  }, [open, user, fetchActivities]);

  const getActivityIcon = () => {
    return <Activity className="h-4 w-4" />;
  };

  const getSeverityBadge = (severity) => {
    const severityConfig = {
      info: { bg: 'bg-blue-500', icon: Info },
      warning: { bg: 'bg-amber-500', icon: AlertTriangle },
      error: { bg: 'bg-red-500', icon: XCircle },
      critical: { bg: 'bg-purple-500', icon: AlertTriangle }
    };

    const config = severityConfig[severity] || severityConfig.info;
    const IconComponent = config.icon;

    return (
      <Badge className={`${config.bg} text-white border-0 gap-1.5`}>
        <IconComponent className="h-3 w-3" />
        {severity.charAt(0).toUpperCase() + severity.slice(1)}
      </Badge>
    );
  };

  const getSuccessIcon = (isSuccess) => {
    return isSuccess ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const formatTimestamp = (timestamp) => {
    try {
      return formatBusinessDateTime(timestamp, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      activityType: '',
      severity: '',
      search: '',
      isSuccess: '',
      startDate: '',
      endDate: ''
    });
    setPage(1);
  };

  // Handle date range change
  const handleDateRangeChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPage(1);
  };

  // Quick date preset handlers (using business timezone)
  const applyDatePreset = (preset) => {
    switch (preset) {
      case 'today':
        setFilters(prev => ({
          ...prev,
          startDate: getBusinessToday(),
          endDate: getBusinessToday()
        }));
        break;
      case 'yesterday':
        setFilters(prev => ({
          ...prev,
          startDate: getBusinessYesterday(),
          endDate: getBusinessYesterday()
        }));
        break;
      case 'last7days':
        setFilters(prev => ({
          ...prev,
          startDate: getBusinessDaysAgo(6), // 6 days ago to today = 7 days
          endDate: getBusinessToday()
        }));
        break;
      case 'last30days':
        setFilters(prev => ({
          ...prev,
          startDate: getBusinessDaysAgo(29), // 29 days ago to today = 30 days
          endDate: getBusinessToday()
        }));
        break;
      case 'thisMonth':
        setFilters(prev => ({
          ...prev,
          startDate: getBusinessMonthStart(),
          endDate: getBusinessMonthEnd()
        }));
        break;
      case 'lastMonth':
        setFilters(prev => ({
          ...prev,
          startDate: getBusinessLastMonthStart(),
          endDate: getBusinessLastMonthEnd()
        }));
        break;
      default:
        break;
    }
    setPage(1);
  };

  const handlePageSizeChange = (newPageSize) => {
    setPerPage(newPageSize);
    setPage(1); // Reset to page 1 when page size changes
  };

  // Group activities by date (day) using business timezone
  const groupActivitiesByDate = (activities) => {
    const groups = {};

    activities.forEach(activity => {
      // Format the timestamp in business timezone
      const dateKey = formatBusinessDate(activity.timestamp, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(activity);
    });

    // Convert to array and sort by date (newest first)
    return Object.entries(groups).map(([date, activities]) => ({
      date,
      activities
    }));
  };

  const groupedActivities = groupActivitiesByDate(activities);

  // Check if any filters are active
  const hasActiveFilters = filters.search || filters.severity || filters.isSuccess ||
                           filters.startDate || filters.endDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            Activity Log - {user?.first_name} {user?.last_name}
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <Card className="mb-4 border-2">
          <CardContent className="p-5">
            {/* Filter Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-blue-600" />
                <h3 className="font-semibold text-sm">Filters</h3>
                {hasActiveFilters && (
                  <Badge variant="secondary" className="text-xs">
                    {[filters.search, filters.severity, filters.isSuccess,
                      filters.startDate, filters.endDate]
                      .filter(Boolean).length} active
                  </Badge>
                )}
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear All
                </Button>
              )}
            </div>

            {/* Main Filters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {/* Search */}
              <div className="lg:col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1.5 block flex items-center gap-1.5">
                  <Search className="h-3 w-3" />
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search descriptions, details..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="pl-9 h-9"
                  />
                  {filters.search && (
                    <button
                      onClick={() => handleFilterChange('search', '')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Severity */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" />
                  Severity
                </label>
                <Select
                  value={filters.severity || 'all'}
                  onValueChange={(value) => handleFilterChange('severity', value === 'all' ? '' : value)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="info">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        Info
                      </div>
                    </SelectItem>
                    <SelectItem value="warning">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-amber-500" />
                        Warning
                      </div>
                    </SelectItem>
                    <SelectItem value="error">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        Error
                      </div>
                    </SelectItem>
                    <SelectItem value="critical">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-purple-500" />
                        Critical
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status Filter (Full Width) */}
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-600 mb-1.5 block flex items-center gap-1.5">
                <Activity className="h-3 w-3" />
                Status
              </label>
              <div className="flex gap-2">
                <Button
                  variant={filters.isSuccess === '' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleFilterChange('isSuccess', '')}
                  className="flex-1 h-8"
                >
                  All
                </Button>
                <Button
                  variant={filters.isSuccess === 'true' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleFilterChange('isSuccess', 'true')}
                  className="flex-1 h-8"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1.5" />
                  Success
                </Button>
                <Button
                  variant={filters.isSuccess === 'false' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleFilterChange('isSuccess', 'false')}
                  className="flex-1 h-8"
                >
                  <XCircle className="h-3 w-3 mr-1.5" />
                  Failed
                </Button>
              </div>
            </div>

            {/* Date Filters Section */}
            <div className="pt-4 border-t">
              <label className="text-xs font-medium text-gray-600 mb-2 block flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Quick Date Filters
              </label>
              <div className="flex items-center justify-between gap-4">
                {/* Quick Presets */}
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyDatePreset('today')}
                    className="h-7 text-xs px-3 whitespace-nowrap"
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyDatePreset('yesterday')}
                    className="h-7 text-xs px-3 whitespace-nowrap"
                  >
                    Yesterday
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyDatePreset('last7days')}
                    className="h-7 text-xs px-3 whitespace-nowrap"
                  >
                    Last 7d
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyDatePreset('last30days')}
                    className="h-7 text-xs px-3 whitespace-nowrap"
                  >
                    Last 30d
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyDatePreset('thisMonth')}
                    className="h-7 text-xs px-3 whitespace-nowrap"
                  >
                    This Mo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyDatePreset('lastMonth')}
                    className="h-7 text-xs px-3 whitespace-nowrap"
                  >
                    Last Mo
                  </Button>
                </div>

                {/* Divider */}
                <div className="h-5 w-px bg-gray-300" />

                {/* Custom Date Range */}
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                    className="h-7 text-xs w-36 px-2"
                  />
                  <span className="text-gray-400 text-xs">to</span>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                    className="h-7 text-xs w-36 px-2"
                    min={filters.startDate || undefined}
                  />
                </div>
              </div>

              {/* Date Range Confirmation */}
              {filters.startDate && filters.endDate && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {formatBusinessDate(businessDateToISOStart(filters.startDate), { month: 'short', day: 'numeric' })} - {formatBusinessDate(businessDateToISOEnd(filters.endDate), { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Activity List */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {loading ? (
            // Loading skeletons
            [...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : activities.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No activity logs found</p>
              </CardContent>
            </Card>
          ) : (
            groupedActivities.map((group) => (
              <div key={group.date} className="space-y-3">
                {/* Date Header */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-l-4 border-blue-500 px-4 py-2 rounded-r-md shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                      {group.date}
                    </h3>
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      {group.activities.length} {group.activities.length === 1 ? 'activity' : 'activities'}
                    </span>
                  </div>
                </div>

                {/* Activities for this date */}
                {group.activities.map((activity) => (
                  <Card key={activity.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className="flex-shrink-0 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-full">
                          {getActivityIcon()}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm mb-1">
                                {activity.description}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatTimestamp(activity.timestamp)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              {getSeverityBadge(activity.severity)}
                              {getSuccessIcon(activity.is_success)}
                            </div>
                          </div>

                          {/* Details */}
                          {activity.details && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                              {activity.details}
                            </p>
                          )}

                          {/* Error message */}
                          {!activity.is_success && activity.error_message && (
                            <p className="text-sm text-red-600 dark:text-red-400 mt-2 p-2 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-800">
                              <XCircle className="h-3 w-3 inline mr-1" />
                              {activity.error_message}
                            </p>
                          )}

                          {/* Metadata */}
                          {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {Object.entries(activity.metadata).map(([key, value]) => (
                                <Badge key={key} variant="outline" className="text-xs">
                                  {key}: {JSON.stringify(value)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="pt-4 border-t">
          <UnifiedPagination
            currentPage={page}
            totalPages={totalPages}
            pageSize={perPage}
            totalItems={totalActivities}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
            pageSizeOptions={[5, 10, 20, 50, 100]}
            theme={{ primary: 'blue' }}
            itemLabel="logs"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserActivityLogDialog;
