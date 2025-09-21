/**
 * StatsPanel component
 * Displays all 5 stat cards with periodic polling updates via REST API
 */

import { memo, useEffect, useRef } from 'react';
import { 
  CreditCard, 
  Plus, 
  AlertTriangle, 
  Calendar, 
  DollarSign
} from 'lucide-react';
import { StatCard } from './stat-card';
import { useStatsPolling } from '../../hooks/useStatsPolling';
import { cn } from '../../lib/utils';

/**
 * Main StatsPanel component
 */
export const StatsPanel = memo(({ 
  className,
  refreshInterval = 60000, // Optimized 60-second refresh for production stability and rate limit safety
  onStatClick,
  refreshTrigger, // Add trigger to force refresh on important actions
  ...props 
}) => {
  const {
    activeLoans,
    newThisMonth,
    overdueLoans,
    maturityThisWeek,
    todaysCollection,
    isLoading,
    error,
    triggerRefresh
  } = useStatsPolling({
    refreshInterval,
    autoStart: true
  });

  // Use ref to track last trigger value to prevent duplicates
  const lastTriggerRef = useRef(0);

  // Trigger refresh when refreshTrigger prop changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0 && refreshTrigger !== lastTriggerRef.current && triggerRefresh) {
      // Update ref to prevent duplicate triggers
      lastTriggerRef.current = refreshTrigger;
      
      // Add a small delay to ensure backend has processed the update
      const timer = setTimeout(() => {
        triggerRefresh();
      }, 500); // 500ms delay for backend processing
      
      return () => clearTimeout(timer);
    }
  }, [refreshTrigger, triggerRefresh]);

  // Stats configuration with click handlers and accessibility
  const statsConfig = [
    {
      id: 'active_loans',
      title: 'Active Loans',
      metric: activeLoans,
      icon: CreditCard,
      theme: 'cyan',
      filterType: 'status',
      filterValue: 'active',
      ariaLabel: 'Active loans count. Click to view active transactions.'
    },
    {
      id: 'new_this_month',
      title: 'New This Month',
      metric: newThisMonth,
      icon: Plus,
      theme: 'green',
      filterType: 'date_range',
      filterValue: 'this_month',
      ariaLabel: 'New transactions this month. Click to view recent transactions.'
    },
    {
      id: 'overdue_loans',
      title: 'Overdue Loans',
      metric: overdueLoans,
      icon: AlertTriangle,
      theme: 'pink',
      filterType: 'status',
      filterValue: 'overdue',
      ariaLabel: 'Overdue loans count. Click to view overdue transactions.'
    },
    {
      id: 'maturity_this_week',
      title: 'Maturity This Week',
      metric: maturityThisWeek,
      icon: Calendar,
      theme: 'orange', // Changed from amber for better contrast
      filterType: 'maturity',
      filterValue: 'this_week',
      ariaLabel: 'Loans maturing this week. Click to view maturing transactions.'
    },
    {
      id: 'todays_collection',
      title: "Today's Collection",
      metric: todaysCollection,
      icon: DollarSign,
      theme: 'purple',
      filterType: 'payments',
      filterValue: 'today',
      ariaLabel: "Today's collection total. Click to view today's payments."
    }
  ];

  const handleStatClick = (stat) => {
    if (onStatClick) {
      onStatClick(stat.filterType, stat.filterValue);
    }
  };

  return (
    <div className={cn("space-y-6", className)} {...props}>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-800 dark:text-red-200">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6" role="region" aria-label="Transaction statistics">
        {statsConfig.map((stat) => (
          
            <StatCard
              key={stat.id}
              title={stat.title}
              value={stat.metric?.value}
              displayValue={stat.metric?.display_value}
              previousValue={stat.metric?.previous_value}
              trendDirection={stat.metric?.trend_direction}
              trendPercentage={stat.metric?.trend_percentage}
              icon={stat.icon}
              theme={stat.theme}
              isLoading={isLoading}
              description={stat.metric?.description}
              className="transition-all duration-300 hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={() => handleStatClick(stat)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleStatClick(stat);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={stat.ariaLabel}
            />
        ))}
      </div>

    </div>
  );
});

StatsPanel.displayName = 'StatsPanel';

// Export with backward compatibility
export const RealtimeStatsPanel = StatsPanel; // Deprecated name for backward compatibility
export default StatsPanel;