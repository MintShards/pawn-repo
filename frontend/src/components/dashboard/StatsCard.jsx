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
      bg: 'bg-white dark:bg-slate-800',
      border: 'border-blue-200 dark:border-blue-900/30',
      accent: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-600 dark:text-blue-400',
      textDark: 'text-slate-900 dark:text-slate-100',
      iconBg: 'bg-blue-500/10 dark:bg-blue-500/20',
      subtext: 'text-slate-600 dark:text-slate-400'
    },
    emerald: {
      bg: 'bg-white dark:bg-slate-800',
      border: 'border-emerald-200 dark:border-emerald-900/30',
      accent: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-600 dark:text-emerald-400',
      textDark: 'text-slate-900 dark:text-slate-100',
      iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      subtext: 'text-slate-600 dark:text-slate-400'
    },
    red: {
      bg: 'bg-white dark:bg-slate-800',
      border: 'border-red-200 dark:border-red-900/30',
      accent: 'bg-red-50 dark:bg-red-950/40',
      text: 'text-red-600 dark:text-red-400',
      textDark: 'text-slate-900 dark:text-slate-100',
      iconBg: 'bg-red-500/10 dark:bg-red-500/20',
      subtext: 'text-slate-600 dark:text-slate-400'
    },
    amber: {
      bg: 'bg-white dark:bg-slate-800',
      border: 'border-amber-200 dark:border-amber-900/30',
      accent: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-600 dark:text-amber-400',
      textDark: 'text-slate-900 dark:text-slate-100',
      iconBg: 'bg-amber-500/10 dark:bg-amber-500/20',
      subtext: 'text-slate-600 dark:text-slate-400'
    },
    violet: {
      bg: 'bg-white dark:bg-slate-800',
      border: 'border-violet-200 dark:border-violet-900/30',
      accent: 'bg-violet-50 dark:bg-violet-950/40',
      text: 'text-violet-600 dark:text-violet-400',
      textDark: 'text-slate-900 dark:text-slate-100',
      iconBg: 'bg-violet-500/10 dark:bg-violet-500/20',
      subtext: 'text-slate-600 dark:text-slate-400'
    }
  };

  const colors = colorConfig[color] || colorConfig.blue;

  const TrendIcon = trend?.direction === 'up' ? ArrowUpRight :
                    trend?.direction === 'down' ? ArrowDownRight : Minus;

  return (
    <Card
      className={`border ${colors.border} shadow-sm ${colors.bg} relative overflow-hidden transition-all duration-200
                  ${clickable ? 'cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600' : ''}`}
      onClick={clickable ? onClick : undefined}
      role={clickable ? 'button' : 'region'}
      aria-label={`${title} metric`}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className={`absolute top-0 right-0 w-20 h-20 ${colors.accent} rounded-full -mr-10 -mt-10 opacity-50`} />
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
              <p className={`text-2xl font-bold ${colors.textDark}`} aria-live="polite">
                {value}
              </p>
              <p className={`text-xs ${colors.subtext} flex items-center mt-1`}>
                {trend && <TrendIcon className="w-3 h-3 mr-1" aria-hidden="true" />}
                {subText}
              </p>
            </div>
            <div className={`w-12 h-12 ${colors.iconBg} rounded-xl flex items-center justify-center`}>
              <Icon className={`w-6 h-6 ${colors.text}`} aria-hidden="true" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StatsCard;
