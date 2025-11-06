# Dashboard Implementation Guide
## Step-by-Step Development Instructions

**Related Document**: [DASHBOARD_DESIGN.md](./DASHBOARD_DESIGN.md)
**Target**: DashboardPage.jsx
**Timeline**: 4-6 hours for complete implementation

---

## Quick Start

### Prerequisites
- Backend running with stats API (`/api/v1/stats/metrics`)
- WebSocket endpoint available (`/ws/stats`)
- ShadCN UI components installed
- React Router configured

### Implementation Order
1. **Create reusable components** (StatsCard, QuickActions, etc.)
2. **Implement data hooks** (useDashboardStats, useStatsWebSocket)
3. **Build dashboard layout** with components
4. **Add real-time updates** via WebSocket
5. **Implement role-based features**
6. **Polish with loading states and error handling**

---

## Step 1: Create Reusable Components

### 1.1 StatsCard Component

**File**: `frontend/src/components/dashboard/StatsCard.jsx`

```jsx
import React from 'react';
import { Card, CardContent } from '../ui/card';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

const StatsCard = ({
  title,
  value,
  subText,
  icon: Icon,
  color = 'blue',
  trend,
  onClick,
  loading = false,
  clickable = false
}) => {
  const colorConfig = {
    blue: {
      bg: 'from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50',
      accent: 'bg-blue-500/10',
      text: 'text-blue-600 dark:text-blue-400',
      textDark: 'text-blue-900 dark:text-blue-100',
      iconBg: 'bg-blue-500/20',
      subtext: 'text-blue-600/70 dark:text-blue-400/70'
    },
    emerald: {
      bg: 'from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50',
      accent: 'bg-emerald-500/10',
      text: 'text-emerald-600 dark:text-emerald-400',
      textDark: 'text-emerald-900 dark:text-emerald-100',
      iconBg: 'bg-emerald-500/20',
      subtext: 'text-emerald-600/70 dark:text-emerald-400/70'
    },
    red: {
      bg: 'from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50',
      accent: 'bg-red-500/10',
      text: 'text-red-600 dark:text-red-400',
      textDark: 'text-red-900 dark:text-red-100',
      iconBg: 'bg-red-500/20',
      subtext: 'text-red-600/70 dark:text-red-400/70'
    },
    amber: {
      bg: 'from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50',
      accent: 'bg-amber-500/10',
      text: 'text-amber-600 dark:text-amber-400',
      textDark: 'text-amber-900 dark:text-amber-100',
      iconBg: 'bg-amber-500/20',
      subtext: 'text-amber-600/70 dark:text-amber-400/70'
    },
    violet: {
      bg: 'from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50',
      accent: 'bg-violet-500/10',
      text: 'text-violet-600 dark:text-violet-400',
      textDark: 'text-violet-900 dark:text-violet-100',
      iconBg: 'bg-violet-500/20',
      subtext: 'text-violet-600/70 dark:text-violet-400/70'
    }
  };

  const colors = colorConfig[color] || colorConfig.blue;

  const TrendIcon = trend?.direction === 'up' ? ArrowUpRight :
                    trend?.direction === 'down' ? ArrowDownRight : Minus;

  return (
    <Card
      className={`border-0 shadow-lg bg-gradient-to-br ${colors.bg} relative overflow-hidden
                  ${clickable ? 'cursor-pointer hover:shadow-xl transition-shadow' : ''}`}
      onClick={clickable ? onClick : undefined}
    >
      <div className={`absolute top-0 right-0 w-20 h-20 ${colors.accent} rounded-full -mr-10 -mt-10`} />
      <CardContent className="p-6">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24" />
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16" />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-32" />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${colors.text}`}>
                {title}
              </p>
              <p className={`text-2xl font-bold ${colors.textDark}`}>
                {value}
              </p>
              <p className={`text-xs ${colors.subtext} flex items-center mt-1`}>
                {trend && <TrendIcon className="w-3 h-3 mr-1" />}
                {subText}
              </p>
            </div>
            <div className={`w-12 h-12 ${colors.iconBg} rounded-xl flex items-center justify-center`}>
              <Icon className={`w-6 h-6 ${colors.text}`} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StatsCard;
```

### 1.2 QuickActions Component

**File**: `frontend/src/components/dashboard/QuickActions.jsx`

```jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Zap, Plus, Users, CreditCard, Bell, FileText, Settings } from 'lucide-react';

const QuickActions = ({ userRole }) => {
  const navigate = useNavigate();

  const actions = [
    {
      label: 'New Pawn Transaction',
      icon: Plus,
      route: '/transactions',
      gradient: 'from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
      hover: 'hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/50 dark:hover:to-teal-900/50'
    },
    {
      label: 'Manage Customers',
      icon: Users,
      route: '/customers',
      gradient: 'from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
      hover: 'hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50'
    },
    {
      label: 'View Service Alerts',
      icon: Bell,
      route: '/service-alerts',
      gradient: 'from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50',
      text: 'text-red-700 dark:text-red-300',
      border: 'border-red-200 dark:border-red-800',
      hover: 'hover:from-red-100 hover:to-rose-100 dark:hover:from-red-900/50 dark:hover:to-rose-900/50'
    },
    {
      label: 'Process Payment',
      icon: CreditCard,
      route: '/payments',
      gradient: 'from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
      hover: 'hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900/50 dark:hover:to-orange-900/50'
    }
  ];

  // Admin-only actions
  if (userRole === 'admin') {
    actions.push(
      {
        label: 'Generate Report',
        icon: FileText,
        route: '/reports',
        gradient: 'from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50',
        text: 'text-slate-700 dark:text-slate-300',
        border: 'border-slate-200 dark:border-slate-700',
        hover: 'hover:from-slate-100 hover:to-slate-200 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50'
      },
      {
        label: 'Business Settings',
        icon: Settings,
        route: '/settings',
        gradient: 'from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50',
        text: 'text-violet-700 dark:text-violet-300',
        border: 'border-violet-200 dark:border-violet-800',
        hover: 'hover:from-violet-100 hover:to-purple-100 dark:hover:from-violet-900/50 dark:hover:to-purple-900/50'
      }
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-slate-900 dark:text-slate-100">Quick Actions</CardTitle>
            <CardDescription>Common daily tasks</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action) => (
          <Button
            key={action.route}
            onClick={() => navigate(action.route)}
            className={`w-full justify-start bg-gradient-to-r ${action.gradient} ${action.text} ${action.border} ${action.hover}`}
            variant="outline"
          >
            <action.icon className="w-4 h-4 mr-2" />
            {action.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
};

export default QuickActions;
```

### 1.3 SystemStatus Component

**File**: `frontend/src/components/dashboard/SystemStatus.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Shield, Database, Zap } from 'lucide-react';

const SystemStatus = () => {
  const [status, setStatus] = useState({
    database: 'connected',
    api: 'online',
    auth: 'secure'
  });

  useEffect(() => {
    // Health check (simplified - could ping actual endpoints)
    const checkHealth = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/stats/health`);
        if (response.ok) {
          setStatus({
            database: 'connected',
            api: 'online',
            auth: 'secure'
          });
        }
      } catch (error) {
        setStatus({
          database: 'disconnected',
          api: 'offline',
          auth: 'issues'
        });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const indicators = [
    {
      label: 'Database',
      icon: Database,
      status: status.database,
      statusText: status.database === 'connected' ? 'Connected' : 'Disconnected'
    },
    {
      label: 'API Service',
      icon: Zap,
      status: status.api,
      statusText: status.api === 'online' ? 'Online' : 'Offline'
    },
    {
      label: 'Authentication',
      icon: Shield,
      status: status.auth,
      statusText: status.auth === 'secure' ? 'Secure' : 'Issues'
    }
  ];

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-slate-900 dark:text-slate-100">System Status</CardTitle>
            <CardDescription>All systems operational</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {indicators.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <item.icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span className="text-sm text-slate-600 dark:text-slate-400">{item.label}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                item.status === 'connected' || item.status === 'online' || item.status === 'secure'
                  ? 'bg-emerald-500'
                  : 'bg-red-500'
              }`} />
              <span className={`text-xs font-medium ${
                item.status === 'connected' || item.status === 'online' || item.status === 'secure'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {item.statusText}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default SystemStatus;
```

### 1.4 RecentActivity Component

**File**: `frontend/src/components/dashboard/RecentActivity.jsx`

```jsx
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
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/v1/pawn-transaction/?limit=10&sort=-created_at`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const data = await response.json();
      setActivities(data.transactions || []);
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
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
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
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="border-l-2 border-violet-200 dark:border-violet-800 pl-4 pb-4 last:pb-0 hover:border-violet-400 dark:hover:border-violet-600 transition-colors cursor-pointer"
                onClick={() => navigate(`/transactions/${activity.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {activity.customer?.first_name} {activity.customer?.last_name}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      ${activity.loan_amount.toFixed(2)} • {activity.status}
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
```

---

## Step 2: Create Data Hooks

### 2.1 useDashboardStats Hook

**File**: `frontend/src/hooks/useDashboardStats.js`

```javascript
import { useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const useDashboardStats = (useWebSocket = true) => {
  const [metrics, setMetrics] = useState({
    active_loans: { value: 0, loading: true },
    new_this_month: { value: 0, loading: true },
    overdue_loans: { value: 0, loading: true },
    maturity_this_week: { value: 0, loading: true },
    todays_collection: { value: 0, loading: true }
  });
  const [error, setError] = useState(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(`${API_BASE}/api/v1/stats/metrics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const updatedMetrics = {};

        Object.keys(data.metrics).forEach((key) => {
          updatedMetrics[key] = {
            ...data.metrics[key],
            loading: false
          };
        });

        setMetrics(updatedMetrics);
        setError(null);
      } else {
        throw new Error('Failed to fetch metrics');
      }
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError(err.message);

      // Set default values on error
      const defaultMetrics = {};
      Object.keys(metrics).forEach((key) => {
        defaultMetrics[key] = { value: 0, loading: false };
      });
      setMetrics(defaultMetrics);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();

    // Polling fallback (every 30 seconds)
    if (!useWebSocket) {
      const interval = setInterval(fetchMetrics, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchMetrics, useWebSocket]);

  return { metrics, error, refetch: fetchMetrics };
};
```

### 2.2 useStatsWebSocket Hook

**File**: `frontend/src/hooks/useStatsWebSocket.js`

```javascript
import { useEffect, useRef, useState } from 'react';
import authService from '../services/authService';

const WS_BASE = process.env.REACT_APP_API_URL?.replace('http', 'ws') || 'ws://localhost:8000';

export const useStatsWebSocket = (onMessage) => {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = authService.getToken();
    if (!token) return;

    try {
      ws.current = new WebSocket(`${WS_BASE}/ws/stats?token=${token}`);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        setError(null);
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessage) onMessage(data);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.current.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('WebSocket connection failed');
        setConnected(false);
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
      };

    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError(err.message);
    }

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [onMessage]);

  return { connected, error };
};
```

---

## Step 3: Update DashboardPage.jsx

**File**: `frontend/src/pages/DashboardPage.jsx`

```jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/common/AppHeader';
import StatsCard from '../components/dashboard/StatsCard';
import QuickActions from '../components/dashboard/QuickActions';
import SystemStatus from '../components/dashboard/SystemStatus';
import RecentActivity from '../components/dashboard/RecentActivity';
import { getWelcomeMessage } from '../utils/roleUtils';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useStatsWebSocket } from '../hooks/useStatsWebSocket';
import serviceAlertService from '../services/serviceAlertService';
import {
  CreditCard,
  TrendingUp,
  DollarSign,
  Calendar,
  Bell
} from 'lucide-react';

const DashboardPage = () => {
  const { user, loading, fetchUserDataIfNeeded } = useAuth();
  const [alertStats, setAlertStats] = useState({
    unique_customer_count: 0,
    total_alert_count: 0
  });
  const [alertStatsLoading, setAlertStatsLoading] = useState(true);

  // Fetch user data if needed
  React.useEffect(() => {
    if (!user && !loading) {
      fetchUserDataIfNeeded();
    }
  }, [user, loading, fetchUserDataIfNeeded]);

  // Fetch dashboard stats (with WebSocket support)
  const { metrics, refetch } = useDashboardStats(true);

  // WebSocket connection for real-time updates
  const { connected } = useStatsWebSocket((data) => {
    console.log('Real-time stats update:', data);
    refetch(); // Refresh metrics when WebSocket message received
  });

  // Fetch service alert stats
  React.useEffect(() => {
    const fetchAlertStats = async () => {
      try {
        setAlertStatsLoading(true);
        const stats = await serviceAlertService.getUniqueCustomerAlertStats();
        setAlertStats(stats);
      } catch (error) {
        setAlertStats({
          unique_customer_count: 0,
          total_alert_count: 0
        });
      } finally {
        setAlertStatsLoading(false);
      }
    };

    if (user) {
      fetchAlertStats();
      const interval = setInterval(fetchAlertStats, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Listen for service alert updates
  React.useEffect(() => {
    const handleAlertUpdate = async () => {
      try {
        serviceAlertService.clearCacheByPattern('unique_customer_alert_stats');
        const stats = await serviceAlertService.getUniqueCustomerAlertStats();
        setAlertStats(stats);
      } catch (error) {
        // Handle error silently
      }
    };

    window.addEventListener('refreshAlertCounts', handleAlertUpdate);
    window.addEventListener('refreshCustomerAlerts', handleAlertUpdate);

    return () => {
      window.removeEventListener('refreshAlertCounts', handleAlertUpdate);
      window.removeEventListener('refreshCustomerAlerts', handleAlertUpdate);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <AppHeader pageTitle="Dashboard" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {getWelcomeMessage(user, loading)}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Here's what's happening with your pawn shop today
            {connected && <span className="ml-2 text-emerald-600">• Live</span>}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatsCard
            title="Active Loans"
            value={metrics.active_loans?.value || 0}
            subText={`${metrics.active_loans?.context_message || 'Loading...'}`}
            icon={CreditCard}
            color="blue"
            loading={metrics.active_loans?.loading}
          />

          <StatsCard
            title="New This Month"
            value={metrics.new_this_month?.value || 0}
            subText={metrics.new_this_month?.context_message || 'Loading...'}
            icon={TrendingUp}
            color="emerald"
            loading={metrics.new_this_month?.loading}
          />

          <StatsCard
            title="Service Alerts"
            value={alertStatsLoading ? '-' : alertStats.unique_customer_count}
            subText={alertStatsLoading ? 'Loading...' : (
              alertStats.unique_customer_count === 0 ? 'No active alerts' :
              `${alertStats.unique_customer_count} customer${alertStats.unique_customer_count !== 1 ? 's' : ''} with alerts`
            )}
            icon={Bell}
            color="red"
            clickable
            loading={alertStatsLoading}
          />

          <StatsCard
            title="Due This Week"
            value={metrics.maturity_this_week?.value || 0}
            subText={metrics.overdue_loans?.value > 0 ?
              `${metrics.overdue_loans.value} overdue` : 'No overdue items'}
            icon={Calendar}
            color="amber"
            loading={metrics.maturity_this_week?.loading}
          />

          <StatsCard
            title="Today's Collection"
            value={`$${(metrics.todays_collection?.value || 0).toFixed(2)}`}
            subText={metrics.todays_collection?.context_message || 'Loading...'}
            icon={DollarSign}
            color="violet"
            loading={metrics.todays_collection?.loading}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Quick Actions & System Status */}
          <div className="lg:col-span-1 space-y-6">
            <QuickActions userRole={user?.role} />
            <SystemStatus />
          </div>

          {/* Right Column - Recent Activity */}
          <div className="lg:col-span-2">
            <RecentActivity />
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
```

---

## Step 4: Testing Checklist

### Unit Testing
- [ ] StatsCard renders correctly with different props
- [ ] QuickActions shows correct buttons for Admin vs Staff
- [ ] SystemStatus updates on health check
- [ ] RecentActivity handles empty state
- [ ] Hooks handle errors gracefully

### Integration Testing
- [ ] Dashboard loads all metrics from API
- [ ] WebSocket connection establishes successfully
- [ ] Service alert stats update correctly
- [ ] Navigation from quick actions works
- [ ] Role-based rendering works (Admin vs Staff)

### E2E Testing
- [ ] Complete dashboard load with real data
- [ ] Real-time updates via WebSocket
- [ ] Manual refresh functionality
- [ ] Mobile responsive layout
- [ ] Dark mode compatibility

---

## Step 5: Performance Optimization

### Caching Strategy
```javascript
// In useDashboardStats hook
const CACHE_KEY = 'dashboard_metrics';
const CACHE_TTL = 30000; // 30 seconds

const getCachedMetrics = () => {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL) {
      return data;
    }
  }
  return null;
};

const setCachedMetrics = (data) => {
  localStorage.setItem(CACHE_KEY, JSON.stringify({
    data,
    timestamp: Date.now()
  }));
};
```

### Debouncing Refresh
```javascript
import { debounce } from 'lodash';

const debouncedRefresh = debounce(() => {
  refetch();
}, 1000);
```

---

## Step 6: Troubleshooting

### Common Issues

1. **WebSocket not connecting**
   - Check REACT_APP_API_URL environment variable
   - Verify backend WebSocket endpoint is running
   - Check JWT token is valid

2. **Stats not updating**
   - Verify API endpoint returns correct data structure
   - Check browser console for errors
   - Ensure cache invalidation is working

3. **Service alerts not loading**
   - Check serviceAlertService implementation
   - Verify API endpoint permissions
   - Check for rate limiting issues

4. **Dark mode issues**
   - Ensure all Tailwind dark: classes are applied
   - Check theme provider is configured
   - Verify gradient colors support dark mode

---

## Next Steps

After implementing the dashboard:

1. **Add analytics tracking** for dashboard interactions
2. **Implement custom date ranges** for metrics
3. **Add export functionality** for dashboard data
4. **Create dashboard widgets** for customization
5. **Build admin dashboard** with advanced metrics

---

**End of Implementation Guide**
