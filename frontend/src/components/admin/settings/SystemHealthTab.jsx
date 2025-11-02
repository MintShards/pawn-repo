import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import {
  Database,
  Activity,
  Cpu,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Zap,
  Clock,
  Info,
  Users,
  UserCheck,
  Layers,
  Server
} from 'lucide-react';
import adminService from '../../../services/adminService';
import { toast } from 'sonner';

const SystemHealthTab = () => {
  const [loading, setLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState(null);
  const [databaseHealth, setDatabaseHealth] = useState(null);
  const [connectionStats, setConnectionStats] = useState(null);
  const [performanceMetrics, setPerformanceMetrics] = useState(null);
  const [alertsStatus, setAlertsStatus] = useState(null);

  const fetchAllMetrics = useCallback(async (showToast = false) => {
    try {
      setLoading(true);

      const [health, dbHealth, connStats, perf, alerts] = await Promise.all([
        adminService.getSystemHealth().catch(() => null),
        adminService.getDatabaseHealth().catch(() => null),
        adminService.getDatabaseConnections().catch(() => null),
        adminService.getPerformanceMetrics().catch(() => null),
        adminService.getAlertsStatus().catch(() => null),
      ]);

      setSystemHealth(health);
      setDatabaseHealth(dbHealth);
      setConnectionStats(connStats);
      setPerformanceMetrics(perf);
      setAlertsStatus(alerts);

      if (showToast) {
        toast.success('Metrics refreshed successfully');
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast.error('Failed to fetch system metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllMetrics();
  }, [fetchAllMetrics]);

  // Listen for refresh event from parent
  useEffect(() => {
    const handleRefresh = () => {
      fetchAllMetrics(true);
    };

    window.addEventListener('refreshSystemHealth', handleRefresh);
    return () => window.removeEventListener('refreshSystemHealth', handleRefresh);
  }, [fetchAllMetrics]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Healthy
        </Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Warning
        </Badge>;
      case 'unhealthy':
      case 'error':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          <XCircle className="w-3 h-3 mr-1" />
          Unhealthy
        </Badge>;
      default:
        return <Badge variant="outline">
          <Info className="w-3 h-3 mr-1" />
          Unknown
        </Badge>;
    }
  };

  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (mb) => {
    if (!mb) return 'N/A';
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(0)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading system health...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Active Alerts */}
      {alertsStatus?.alerts && alertsStatus.alerts.length > 0 && (
        <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-500" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            <strong>Active Alerts ({alertsStatus.alerts.length}):</strong>
            <ul className="mt-2 space-y-1">
              {alertsStatus.alerts.map((alert, idx) => (
                <li key={idx} className="text-sm">
                  • {alert.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* System Overview Cards - Business-Critical Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* System Status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Activity className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              {getStatusBadge(systemHealth?.status || alertsStatus?.system_status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {systemHealth?.status === 'healthy' ? 'Operational' : 'Issues Detected'}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              System Status
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              Uptime: {formatUptime(systemHealth?.uptime_seconds)}
            </p>
          </CardContent>
        </Card>

        {/* Database Connection */}
        <Card>
          <CardHeader className="pb-3">
            <Database className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
              {databaseHealth?.database_info?.connection === 'active' ? 'Connected' : 'Disconnected'}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Database Status
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              Latency: {databaseHealth?.database_info?.latency_ms || 0}ms
            </p>
          </CardContent>
        </Card>

        {/* Total Documents */}
        <Card>
          <CardHeader className="pb-3">
            <Layers className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {connectionStats?.connection_stats?.documents?.total?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Total Documents
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              Across {databaseHealth?.database_info?.collections_count || 0} collections
            </p>
          </CardContent>
        </Card>

        {/* Storage Size */}
        <Card>
          <CardHeader className="pb-3">
            <HardDrive className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {connectionStats?.connection_stats?.storage?.total_size_mb?.toFixed(2) || databaseHealth?.database_info?.database_size_mb || '0'} MB
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Database Size
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              Data: {connectionStats?.connection_stats?.storage?.data_size_mb?.toFixed(2) || '0'} MB
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Database Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <div>
                <CardTitle>Database Health</CardTitle>
                <CardDescription>Connection status, storage metrics, and document statistics</CardDescription>
              </div>
            </div>
            {databaseHealth && getStatusBadge(databaseHealth.status)}
          </div>
        </CardHeader>
        <CardContent>
          {databaseHealth ? (
            <div className="space-y-6">
              {/* Connection & Configuration */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Connection & Configuration</h4>
                  {databaseHealth.status === 'healthy' ? (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Operational
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Issues Detected
                    </Badge>
                  )}
                </div>

                {/* Core Database Info */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="flex items-start space-x-3">
                    <Database className="w-5 h-5 text-blue-500 dark:text-blue-400 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Database Name</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                        {databaseHealth.database_info?.database || 'pawn-repo'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Info className="w-5 h-5 text-cyan-500 dark:text-cyan-400 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">MongoDB Version</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                        {databaseHealth.database_info?.mongodb_version || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Server className="w-5 h-5 text-violet-500 dark:text-violet-400 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Server Type</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                        {databaseHealth.database_info?.server_type || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Connection</p>
                      <p className={`text-lg font-bold mt-1 ${
                        databaseHealth.database_info?.connection === 'active'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {databaseHealth.database_info?.connection === 'active'
                          ? `Active (${databaseHealth.database_info?.latency_ms || 0}ms)`
                          : 'Disconnected'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Activity className="w-5 h-5 text-purple-500 dark:text-purple-400 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Transactions</p>
                      <p className={`text-lg font-bold mt-1 ${
                        databaseHealth.database_info?.transaction_support
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-yellow-600 dark:text-yellow-400'
                      }`}>
                        {databaseHealth.database_info?.transaction_support ? 'Supported' : 'Not Supported'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Storage Metrics */}
              {connectionStats?.connection_stats?.storage && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center">
                    <HardDrive className="w-4 h-4 mr-2" />
                    Storage & Size Metrics
                  </h4>

                  {/* Storage Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Total Database Size</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                          {connectionStats.connection_stats.storage.total_size_mb.toFixed(2)} MB
                        </span>
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Data Size</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                          {connectionStats.connection_stats.storage.data_size_mb.toFixed(2)} MB
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Index Size</p>
                          {(() => {
                            const dataSize = connectionStats.connection_stats.storage.data_size_mb;
                            const indexSize = connectionStats.connection_stats.storage.index_size_mb;
                            const ratio = dataSize > 0 ? indexSize / dataSize : 0;
                            if (ratio > 5) {
                              return (
                                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] px-1.5 py-0">
                                  <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                  High Ratio
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                          {connectionStats.connection_stats.storage.index_size_mb.toFixed(2)} MB
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-1">
                          {(() => {
                            const dataSize = connectionStats.connection_stats.storage.data_size_mb;
                            const indexSize = connectionStats.connection_stats.storage.index_size_mb;
                            const ratio = dataSize > 0 ? (indexSize / dataSize).toFixed(1) : 0;
                            return `${ratio}x data size`;
                          })()}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Storage Size</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                          {connectionStats.connection_stats.storage.storage_size_mb.toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Database Activity */}
              {connectionStats?.connection_stats?.activity && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center">
                    <Zap className="w-4 h-4 mr-2" />
                    Operations & Performance
                  </h4>

                  {/* Operations per Second */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Total Ops/sec</p>
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                        {connectionStats.connection_stats.activity.ops_per_second?.total?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Inserts/sec</p>
                      <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">
                        {connectionStats.connection_stats.activity.ops_per_second?.insert?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Queries/sec</p>
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                        {connectionStats.connection_stats.activity.ops_per_second?.query?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Updates/sec</p>
                      <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                        {connectionStats.connection_stats.activity.ops_per_second?.update?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Deletes/sec</p>
                      <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">
                        {connectionStats.connection_stats.activity.ops_per_second?.delete?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>

                  {/* Total Operations */}
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Total Operations</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        {connectionStats.connection_stats.activity.total_operations?.toLocaleString() || '0'}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Database Uptime</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        {connectionStats.connection_stats.performance?.uptime_hours?.toFixed(1) || '0'} hrs
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Document Statistics - Always show if we have connectionStats */}
              {connectionStats && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center">
                    <Layers className="w-4 h-4 mr-2" />
                    Document Statistics
                  </h4>

                  {connectionStats.connection_stats?.documents ? (
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                      <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-lg p-3 border border-indigo-200 dark:border-indigo-800">
                        <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Total Documents</p>
                        <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 mt-1">
                          {connectionStats.connection_stats.documents.total?.toLocaleString() || '0'}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Customers</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                          {connectionStats.connection_stats.documents.by_collection?.customers?.toLocaleString() || '0'}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Transactions</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                          {connectionStats.connection_stats.documents.by_collection?.pawn_transactions?.toLocaleString() || '0'}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Payments</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                          {connectionStats.connection_stats.documents.by_collection?.payments?.toLocaleString() || '0'}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Extensions</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                          {connectionStats.connection_stats.documents.by_collection?.extensions?.toLocaleString() || '0'}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Users</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                          {connectionStats.connection_stats.documents.by_collection?.users?.toLocaleString() || '0'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Document statistics unavailable (MongoDB Atlas may restrict access)
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-600 dark:text-slate-400">Database health information unavailable</p>
          )}
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      {performanceMetrics?.performance && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Zap className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <CardTitle>Performance Metrics</CardTitle>
                  <CardDescription>System resource utilization and thresholds</CardDescription>
                </div>
              </div>
              {/* Overall Health Badge */}
              {(() => {
                const cpuCritical = performanceMetrics.performance.cpu_percent > 90;
                const memCritical = performanceMetrics.performance.memory_mb > 1024;
                const cpuHigh = performanceMetrics.performance.cpu_percent > 70;
                const memHigh = performanceMetrics.performance.memory_mb > 512;

                if (cpuCritical || memCritical) {
                  return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Critical
                  </Badge>;
                } else if (cpuHigh || memHigh) {
                  return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    High Usage
                  </Badge>;
                } else {
                  return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Optimal
                  </Badge>;
                }
              })()}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* CPU Performance */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">CPU Usage</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-lg font-bold ${
                      performanceMetrics.performance.cpu_percent > 90
                        ? 'text-red-600 dark:text-red-400'
                        : performanceMetrics.performance.cpu_percent > 70
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {performanceMetrics.performance.cpu_percent?.toFixed(1)}%
                    </span>
                    {performanceMetrics.performance.cpu_percent > 90 ? (
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    ) : performanceMetrics.performance.cpu_percent > 70 ? (
                      <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                </div>
                <div className="relative w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                  {/* Threshold markers */}
                  <div className="absolute top-0 h-3 w-px bg-yellow-400 dark:bg-yellow-500" style={{ left: '70%' }} title="High threshold (70%)"></div>
                  <div className="absolute top-0 h-3 w-px bg-red-400 dark:bg-red-500" style={{ left: '90%' }} title="Critical threshold (90%)"></div>

                  {/* Progress bar */}
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      performanceMetrics.performance.cpu_percent > 90
                        ? 'bg-red-600 dark:bg-red-500'
                        : performanceMetrics.performance.cpu_percent > 70
                        ? 'bg-yellow-600 dark:bg-yellow-500'
                        : 'bg-green-600 dark:bg-green-500'
                    }`}
                    style={{ width: `${Math.min(performanceMetrics.performance.cpu_percent, 100)}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>
                    High: {performanceMetrics.thresholds?.high_cpu_percent}%
                    <span className="inline-block w-2 h-2 bg-red-500 rounded-full ml-3 mr-1"></span>
                    Critical: {performanceMetrics.thresholds?.critical_cpu_percent}%
                  </p>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {performanceMetrics.performance.cpu_percent > 90 ? (
                      <span className="text-red-600 dark:text-red-400">⚠️ Action Required</span>
                    ) : performanceMetrics.performance.cpu_percent > 70 ? (
                      <span className="text-yellow-600 dark:text-yellow-400">⚠️ Monitor Closely</span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">✓ Normal</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Memory Performance */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Memory Usage</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-lg font-bold ${
                      performanceMetrics.performance.memory_mb > 1024
                        ? 'text-red-600 dark:text-red-400'
                        : performanceMetrics.performance.memory_mb > 512
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {formatBytes(performanceMetrics.performance.memory_mb)}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      ({((performanceMetrics.performance.memory_mb / 1024) * 100).toFixed(1)}%)
                    </span>
                    {performanceMetrics.performance.memory_mb > 1024 ? (
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    ) : performanceMetrics.performance.memory_mb > 512 ? (
                      <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                </div>
                <div className="relative w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                  {/* Threshold markers */}
                  <div className="absolute top-0 h-3 w-px bg-yellow-400 dark:bg-yellow-500" style={{ left: '50%' }} title="High threshold (512MB)"></div>
                  <div className="absolute top-0 h-3 w-px bg-red-400 dark:bg-red-500" style={{ left: '100%' }} title="Critical threshold (1024MB)"></div>

                  {/* Progress bar */}
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      performanceMetrics.performance.memory_mb > 1024
                        ? 'bg-red-600 dark:bg-red-500'
                        : performanceMetrics.performance.memory_mb > 512
                        ? 'bg-yellow-600 dark:bg-yellow-500'
                        : 'bg-green-600 dark:bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min((performanceMetrics.performance.memory_mb / 1024) * 100, 100)}%`
                    }}
                  ></div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>
                    High: {performanceMetrics.thresholds?.high_memory_mb}MB
                    <span className="inline-block w-2 h-2 bg-red-500 rounded-full ml-3 mr-1"></span>
                    Critical: {performanceMetrics.thresholds?.critical_memory_mb}MB
                  </p>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {performanceMetrics.performance.memory_mb > 1024 ? (
                      <span className="text-red-600 dark:text-red-400">⚠️ Action Required</span>
                    ) : performanceMetrics.performance.memory_mb > 512 ? (
                      <span className="text-yellow-600 dark:text-yellow-400">⚠️ Monitor Closely</span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">✓ Normal</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Performance & Connections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Performance Metrics */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <Zap className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              <div>
                <CardTitle>API Performance</CardTitle>
                <CardDescription>Request processing and response metrics</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Average Response Time */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Clock className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Avg Response Time</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Last 5 minutes</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {databaseHealth?.database_info?.latency_ms || 0}ms
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">Optimal</p>
                </div>
              </div>

              {/* Error Rate */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Error Rate</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Last hour</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">0.0%</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">0 errors</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Connections */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              <div>
                <CardTitle>Active Connections</CardTitle>
                <CardDescription>Database connections and active users</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Database Connections */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Database className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Database Pool</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Active connections</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {databaseHealth?.database_info?.connection === 'active' ? '1' : '0'}/100
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">Healthy</p>
                </div>
              </div>

              {/* Active Users */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <UserCheck className="w-5 h-5 text-violet-500 dark:text-violet-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Active Users</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Currently active</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {systemHealth?.business?.users?.active_users || 0}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">users</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SystemHealthTab;
