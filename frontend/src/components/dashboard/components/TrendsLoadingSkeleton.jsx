import React from 'react';
import { Card, CardContent } from '../../ui/card';
import { Skeleton } from '../../ui/skeleton';

/**
 * Optimized loading skeleton for Revenue & Loan Trends component
 * Reduces duplication and improves rendering performance
 *
 * @returns {JSX.Element}
 */
const TrendsLoadingSkeleton = React.memo(() => (
  <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
    <CardContent className="p-6">
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>

          {/* Period selector and actions skeleton */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Date selection group skeleton */}
            <div className="flex flex-wrap items-center gap-2">
              {/* 4 preset period buttons + 1 custom range button */}
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton
                  key={i}
                  className={i === 4 ? "h-9 w-44" : "h-9 w-20"}
                />
              ))}
            </div>

            {/* Separator */}
            <div className="hidden sm:block h-6 w-px bg-slate-300 dark:bg-slate-600" />

            {/* Refresh button skeleton */}
            <Skeleton className="h-9 w-9" />
          </div>
        </div>

        {/* 7 Summary Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Breakdown Chart */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <div className="space-y-2">
              <Skeleton className="h-[300px] w-full rounded-lg" />
              <div className="flex justify-center gap-4 mt-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="w-3 h-3 rounded-sm" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Loan Activity Chart */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <div className="space-y-2">
              <Skeleton className="h-[300px] w-full rounded-lg" />
              <div className="flex justify-center gap-4 mt-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="w-3 h-3 rounded-sm" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
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
