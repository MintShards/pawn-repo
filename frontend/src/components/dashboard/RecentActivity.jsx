import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Activity, RefreshCw, FileText, Plus } from 'lucide-react';
import authService from '../../services/authService';

const RecentActivity = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRecentActivity = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      if (!token) {
        setActivities([]);
        return;
      }

      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const response = await fetch(
        `${API_BASE}/api/v1/pawn-transaction/?limit=10&sort=-created_at`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setActivities(data.transactions || []);
      } else {
        setActivities([]);
      }
    } catch (error) {
      console.error('Failed to fetch recent activity:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentActivity();
  }, []);

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'text-blue-600 dark:text-blue-400',
      overdue: 'text-red-600 dark:text-red-400',
      extended: 'text-amber-600 dark:text-amber-400',
      redeemed: 'text-emerald-600 dark:text-emerald-400',
      forfeited: 'text-slate-600 dark:text-slate-400',
      sold: 'text-violet-600 dark:text-violet-400'
    };
    return colors[status?.toLowerCase()] || 'text-slate-600 dark:text-slate-400';
  };

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-slate-900 dark:text-slate-100">Recent Activity</CardTitle>
              <CardDescription>Latest transactions and updates</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            onClick={fetchRecentActivity}
            disabled={loading}
            aria-label="Refresh recent activity"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
              <FileText className="w-10 h-10 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              No Recent Activity
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
              When you create transactions, payments, or other activities, they'll appear here for quick access.
            </p>
            <Button
              onClick={() => navigate('/transactions')}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Transaction
            </Button>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {activities.map((activity) => (
              <div
                key={activity.transaction_id}
                className="border-l-2 border-violet-200 dark:border-violet-800 pl-4 pb-4 last:pb-0 hover:border-violet-400 dark:hover:border-violet-600 transition-colors cursor-pointer"
                onClick={() => navigate(`/transactions/${activity.transaction_id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    navigate(`/transactions/${activity.transaction_id}`);
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {activity.customer?.first_name} {activity.customer?.last_name}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      ${activity.loan_amount?.toFixed(2) || '0.00'} • {' '}
                      <span className={getStatusColor(activity.status)}>
                        {activity.status}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {formatTimestamp(activity.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
