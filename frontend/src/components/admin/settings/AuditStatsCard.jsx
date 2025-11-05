/**
 * AuditStatsCard Component
 *
 * Displays summary statistics for audit activity logs.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import {
  Activity,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  BarChart3,
  User
} from 'lucide-react';
import adminService from '../../../services/adminService';
import { toast } from 'sonner';

export function AuditStatsCard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await adminService.getActivityStatsSummary();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch activity stats:', error);
      toast.error('Failed to load activity statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-sm border-slate-200 dark:border-slate-700">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 dark:border-slate-700 border-t-blue-600"></div>
              <BarChart3 className="w-4 h-4 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const successRate = stats.total_activities > 0
    ? Math.round((stats.success_count / (stats.success_count + stats.failure_count)) * 100)
    : 0;

  return (
    <Card className="shadow-sm border-slate-200 dark:border-slate-700 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Activity Statistics</CardTitle>
              <CardDescription className="text-sm">Overview of system activity</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Key Metrics - Enhanced grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* Total Activities */}
          <div className="group p-4 bg-white dark:bg-slate-800/30 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Total Activities</span>
              <Activity className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.total_activities.toLocaleString()}</p>
          </div>

          {/* Active Users */}
          <div className="group p-4 bg-white dark:bg-slate-800/30 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Active Users</span>
              <Users className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.total_users}</p>
          </div>

          {/* Success Rate */}
          <div className="group p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border-2 border-green-200 dark:border-green-800 hover:border-green-300 dark:hover:border-green-700 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">Success Rate</span>
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-3xl font-bold text-green-900 dark:text-green-300">{successRate}%</p>
            <p className="text-xs font-medium text-green-600 dark:text-green-400 mt-1.5">{stats.success_count.toLocaleString()} successful</p>
          </div>

          {/* Failures */}
          <div className="group p-4 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 rounded-lg border-2 border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">Failures</span>
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-3xl font-bold text-red-900 dark:text-red-300">{stats.failure_count}</p>
          </div>
        </div>

        {/* Severity Breakdown - Enhanced section */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">Severity Breakdown</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-red-200 dark:border-red-900">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Critical</span>
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border border-red-300 dark:border-red-800 text-base font-bold px-3 py-1">
                {stats.critical_count}
              </Badge>
            </div>
            <div className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-orange-200 dark:border-orange-900">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Error</span>
              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 border border-orange-300 dark:border-orange-800 text-base font-bold px-3 py-1">
                {stats.error_count}
              </Badge>
            </div>
            <div className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-yellow-200 dark:border-yellow-900">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Warning</span>
              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-800 text-base font-bold px-3 py-1">
                {stats.warning_count}
              </Badge>
            </div>
            <div className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-300 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Info</span>
              <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-700/50 dark:text-slate-200 border border-slate-300 dark:border-slate-600 text-base font-bold px-3 py-1">
                {stats.info_count}
              </Badge>
            </div>
          </div>
        </div>

        {/* Two-column layout for users and activities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Most Active Users */}
          {stats.most_active_users && stats.most_active_users.length > 0 && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800 overflow-hidden">
              <div className="p-4 border-b border-indigo-200 dark:border-indigo-800 bg-white/50 dark:bg-slate-800/50">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">Most Active Users</h3>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {stats.most_active_users.map((user, index) => (
                  <div key={index} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800/50 rounded-lg border border-indigo-100 dark:border-indigo-900 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center justify-center w-6 h-6 bg-indigo-100 dark:bg-indigo-900/50 rounded-full text-xs font-bold text-indigo-700 dark:text-indigo-300">
                        {index + 1}
                      </div>
                      <User className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">User {user.user_id}</span>
                    </div>
                    <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 font-semibold">
                      {user.count} activities
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Most Common Activities */}
          {stats.most_common_activities && stats.most_common_activities.length > 0 && (
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden">
              <div className="p-4 border-b border-blue-200 dark:border-blue-800 bg-white/50 dark:bg-slate-800/50">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">Most Common Activities</h3>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {stats.most_common_activities.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800/50 rounded-lg border border-blue-100 dark:border-blue-900 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center justify-center w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full text-xs font-bold text-blue-700 dark:text-blue-300">
                        {index + 1}
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {activity.activity_type.split('_').map(word =>
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ')}
                      </span>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border border-blue-200 dark:border-blue-800 font-semibold">
                      {activity.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
