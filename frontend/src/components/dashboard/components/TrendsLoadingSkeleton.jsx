import React from 'react';
import { Card, CardContent } from '../../ui/card';

/**
 * Premium loading skeleton for Revenue & Loan Trends component
 * Enhanced with shimmer effects and realistic chart placeholders
 * Matches Collections Analytics premium styling
 *
 * @returns {JSX.Element}
 */
const TrendsLoadingSkeleton = React.memo(() => (
  <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
    <CardContent className="p-6">
      <div className="space-y-6">
        {/* Header skeleton with shimmer */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            {/* Title */}
            <div className="h-8 w-64 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded animate-shimmer bg-[length:200%_100%]" />
            {/* Description */}
            <div className="h-4 w-48 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded animate-shimmer bg-[length:200%_100%]" />
          </div>

          {/* Period selector and actions skeleton */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Date selection group skeleton */}
            <div className="flex flex-wrap items-center gap-2">
              {/* 4 preset period buttons + 1 custom range button */}
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className={`${i === 4 ? "h-9 w-44" : "h-9 w-20"} bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded animate-shimmer bg-[length:200%_100%]`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                />
              ))}
            </div>

            {/* Separator */}
            <div className="hidden sm:block h-6 w-px bg-slate-300 dark:bg-slate-600" />

            {/* Refresh button skeleton */}
            <div className="h-9 w-9 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded animate-shimmer bg-[length:200%_100%]" />
          </div>
        </div>

        {/* 7 Summary Cards Skeleton with staggered delays */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              {/* Icon skeleton */}
              <div
                className="w-10 h-10 rounded-lg flex-shrink-0 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]"
                style={{ animationDelay: `${i * 0.06}s` }}
              />
              <div className="flex-1 space-y-2">
                {/* Label */}
                <div
                  className="h-3 w-16 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded animate-shimmer bg-[length:200%_100%]"
                  style={{ animationDelay: `${i * 0.06}s` }}
                />
                {/* Value */}
                <div
                  className="h-5 w-20 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded animate-shimmer bg-[length:200%_100%]"
                  style={{ animationDelay: `${i * 0.06}s` }}
                />
                {/* Trend */}
                <div
                  className="h-3 w-12 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded animate-shimmer bg-[length:200%_100%]"
                  style={{ animationDelay: `${i * 0.06}s` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Charts Skeleton with realistic placeholders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Breakdown Chart */}
          <div className="space-y-3">
            {/* Chart title */}
            <div className="h-5 w-40 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded animate-shimmer bg-[length:200%_100%]" />

            <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-6 border border-slate-200 dark:border-slate-700 h-80 relative overflow-hidden">
              {/* Loading text */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <div className="w-4 h-4 border-2 border-slate-400 dark:border-slate-500 border-t-transparent rounded-full animate-spin" />
                    <span className="animate-pulse">Loading trend data...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Loan Activity Chart */}
          <div className="space-y-3">
            {/* Chart title */}
            <div className="h-5 w-32 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded animate-shimmer bg-[length:200%_100%]" />

            <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-6 border border-slate-200 dark:border-slate-700 h-80 relative overflow-hidden">
              {/* Loading text */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <div className="w-4 h-4 border-2 border-slate-400 dark:border-slate-500 border-t-transparent rounded-full animate-spin" />
                    <span className="animate-pulse">Loading trend data...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
));

TrendsLoadingSkeleton.displayName = 'TrendsLoadingSkeleton';

export default TrendsLoadingSkeleton;
