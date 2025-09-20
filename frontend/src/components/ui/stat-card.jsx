/**
 * Enhanced StatCard component with real-time updates and trend indicators
 * Integrates with WebSocket for live metric updates
 */

import React, { memo } from 'react';
import { Card, CardContent } from './card';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';

// Trend direction indicators
const TrendIndicator = ({ direction, percentage, className }) => {
  // Convert percentage to number to handle string values from API
  const numPercentage = parseFloat(percentage) || 0;
  
  if (direction === 'stable' || Math.abs(numPercentage) < 0.1) {
    return (
      <div className={cn("flex items-center space-x-1 text-slate-500 dark:text-slate-400", className)}>
        <Minus className="w-3 h-3" />
        <span className="text-xs">Stable</span>
      </div>
    );
  }

  const isUp = direction === 'up' || numPercentage > 0;
  const IconComponent = isUp ? TrendingUp : TrendingDown;
  const colorClass = isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className={cn("flex items-center space-x-1", colorClass, className)}>
      <IconComponent className="w-3 h-3" />
      <span className="text-xs font-medium">
        {Math.abs(numPercentage).toFixed(1)}%
      </span>
    </div>
  );
};


// Loading skeleton
const StatCardSkeleton = ({ theme = 'default' }) => {
  const themeClasses = {
    cyan: 'from-cyan-50 to-blue-50 dark:from-cyan-950/50 dark:to-blue-950/50',
    green: 'from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50',
    pink: 'from-pink-50 to-rose-50 dark:from-pink-950/50 dark:to-rose-950/50',
    amber: 'from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50',
    purple: 'from-purple-50 to-violet-50 dark:from-purple-950/50 dark:to-violet-950/50'
  };

  return (
    <Card className={cn(
      "border-0 shadow-lg bg-gradient-to-br relative overflow-hidden",
      themeClasses[theme] || themeClasses.default
    )}>
      <div className="absolute top-0 right-0 w-20 h-20 bg-slate-500/10 dark:bg-slate-400/10 rounded-full -mr-10 -mt-10" />
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
          <div className="w-12 h-12 bg-slate-200/50 dark:bg-slate-700/50 rounded-xl animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Enhanced StatCard with periodic updates and improved accessibility
 */
export const StatCard = memo(({
  title,
  value,
  displayValue,
  previousValue,
  trendDirection = 'stable',
  trendPercentage = 0,
  icon: IconComponent,
  theme = 'default',
  isLoading = false,
  className,
  description,
  onClick,
  onKeyDown,
  tabIndex,
  role,
  ...props
}) => {
  // Show skeleton during loading
  if (isLoading) {
    return <StatCardSkeleton theme={theme} />;
  }

  // Theme configuration
  const themeConfig = {
    cyan: {
      gradient: 'from-cyan-50 to-blue-50 dark:from-cyan-950/50 dark:to-blue-950/50',
      accent: 'bg-cyan-500/10',
      textPrimary: 'text-cyan-600 dark:text-cyan-400',
      textSecondary: 'text-cyan-900 dark:text-cyan-100',
      iconBg: 'bg-cyan-500/20',
      iconColor: 'text-cyan-600 dark:text-cyan-400'
    },
    green: {
      gradient: 'from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50',
      accent: 'bg-green-500/10',
      textPrimary: 'text-green-600 dark:text-green-400',
      textSecondary: 'text-green-900 dark:text-green-100',
      iconBg: 'bg-green-500/20',
      iconColor: 'text-green-600 dark:text-green-400'
    },
    pink: {
      gradient: 'from-pink-50 to-rose-50 dark:from-pink-950/50 dark:to-rose-950/50',
      accent: 'bg-pink-500/10',
      textPrimary: 'text-pink-600 dark:text-pink-400',
      textSecondary: 'text-pink-900 dark:text-pink-100',
      iconBg: 'bg-pink-500/20',
      iconColor: 'text-pink-600 dark:text-pink-400'
    },
    amber: {
      gradient: 'from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50',
      accent: 'bg-amber-500/10',
      textPrimary: 'text-amber-800 dark:text-amber-200', // Improved contrast for WCAG AA
      textSecondary: 'text-amber-900 dark:text-amber-100',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-800 dark:text-amber-200' // Improved contrast for WCAG AA
    },
    orange: {
      gradient: 'from-orange-50 to-red-50 dark:from-orange-950/50 dark:to-red-950/50',
      accent: 'bg-orange-500/10',
      textPrimary: 'text-orange-600 dark:text-orange-400',
      textSecondary: 'text-orange-900 dark:text-orange-100',
      iconBg: 'bg-orange-500/20',
      iconColor: 'text-orange-600 dark:text-orange-400'
    },
    purple: {
      gradient: 'from-purple-50 to-violet-50 dark:from-purple-950/50 dark:to-violet-950/50',
      accent: 'bg-purple-500/10',
      textPrimary: 'text-purple-600 dark:text-purple-400',
      textSecondary: 'text-purple-900 dark:text-purple-100',
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-600 dark:text-purple-400'
    }
  };

  const config = themeConfig[theme] || themeConfig.cyan;

  return (
    <Card 
      className={cn(
        "border-0 shadow-lg bg-gradient-to-br relative overflow-hidden transition-all duration-300 hover:shadow-xl",
        config.gradient,
        className
      )}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
      role={role}
      {...props}
    >
      {/* Decorative accent */}
      <div className={cn("absolute top-0 right-0 w-20 h-20 rounded-full -mr-10 -mt-10", config.accent)} />
      
      
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 space-y-2">
            {/* Title */}
            <p className={cn("text-sm font-medium", config.textPrimary)}>
              {title}
            </p>
            
            {/* Main Value */}
            <div className="flex items-baseline space-x-2">
              <p className={cn("text-2xl font-bold", config.textSecondary)}>
                {displayValue || (value !== undefined ? value : '-')}
              </p>
              
              {/* Trend indicator */}
              {(trendDirection !== 'stable' || Math.abs(parseFloat(trendPercentage) || 0) >= 0.1) && (
                <TrendIndicator 
                  direction={trendDirection} 
                  percentage={trendPercentage}
                  className="ml-2"
                />
              )}
            </div>
            
            
          </div>
          
          {/* Icon */}
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", config.iconBg)}>
            {IconComponent ? (
              <IconComponent className={cn("w-6 h-6", config.iconColor)} />
            ) : (
              <Activity className={cn("w-6 h-6", config.iconColor)} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

StatCard.displayName = 'StatCard';

export default StatCard;