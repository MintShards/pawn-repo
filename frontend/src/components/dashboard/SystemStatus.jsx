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
    // Health check - ping stats endpoint as proxy for system health
    const checkHealth = async () => {
      try {
        const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        const response = await fetch(`${API_BASE}/api/v1/stats/health`, {
          method: 'GET'
        });

        if (response.ok) {
          setStatus({
            database: 'connected',
            api: 'online',
            auth: 'secure'
          });
        } else {
          setStatus({
            database: 'disconnected',
            api: 'offline',
            auth: 'issues'
          });
        }
      } catch (error) {
        // If health check fails, mark systems as down
        setStatus({
          database: 'disconnected',
          api: 'offline',
          auth: 'issues'
        });
      }
    };

    checkHealth();
    // Check health every minute
    const interval = setInterval(checkHealth, 60000);
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
              <item.icon className="w-4 h-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              <span className="text-sm text-slate-600 dark:text-slate-400">{item.label}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  item.status === 'connected' || item.status === 'online' || item.status === 'secure'
                    ? 'bg-emerald-500'
                    : 'bg-red-500'
                }`}
                aria-label={`${item.label} status indicator`}
              />
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
