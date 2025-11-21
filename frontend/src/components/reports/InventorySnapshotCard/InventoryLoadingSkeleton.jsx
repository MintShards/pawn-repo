/**
 * Enhanced loading skeleton UI for InventorySnapshotCard
 *
 * Features:
 * - Shimmer animation for better perceived performance
 * - Exact layout matching to prevent CLS (Cumulative Layout Shift)
 * - Progress indicator
 * - Dark mode support
 * - Accessible loading state
 */

import React from "react";
import { Card, CardContent, CardHeader } from "../../ui/card";

/**
 * Shimmer skeleton element
 *
 * @param {Object} props - Component props
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.width - Width class (e.g., 'w-20', 'w-full')
 * @param {string} props.height - Height class (e.g., 'h-4', 'h-8')
 */
const Shimmer = ({ className = "", width = "w-full", height = "h-4" }) => (
  <div
    className={`${width} ${height} bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded animate-shimmer bg-[length:200%_100%] ${className}`}
    role="presentation"
  />
);

/**
 * Summary card skeleton
 */
const SummaryCardSkeleton = () => (
  <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
    <div className="flex items-center gap-2 mb-1">
      <Shimmer width="w-4" height="h-4" />
      <Shimmer width="w-24" height="h-4" />
    </div>
    <Shimmer width="w-20" height="h-9" />
    <Shimmer width="w-28" height="h-4" />
  </div>
);

/**
 * Table skeleton
 *
 * @param {Object} props - Component props
 * @param {number} props.rows - Number of data rows
 * @param {number} props.columns - Number of columns
 */
const TableSkeleton = ({ rows = 4, columns = 5 }) => (
  <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
    {/* Header - matches py-2.5 px-3 from actual tables, text-xs line-height */}
    <div className="bg-slate-50 dark:bg-slate-800/50 py-2.5 px-3 border-b border-slate-200 dark:border-slate-700">
      <div className="flex justify-between gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Shimmer key={i} width="w-16" height="h-4" />
        ))}
      </div>
    </div>
    {/* Rows - matches py-2.5 px-3 from actual tables, text-xs line-height */}
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="py-2.5 px-3 border-b last:border-b-0 border-slate-100 dark:border-slate-800"
      >
        <div className="flex justify-between gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <Shimmer key={j} width="flex-1" height="h-4" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

/**
 * Main loading skeleton component
 *
 * Displays a shimmer-animated skeleton matching the exact layout
 * of the loaded component to prevent layout shift (CLS).
 */
const InventoryLoadingSkeleton = () => {
  return (
    <Card
      className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm h-full flex flex-col"
      role="status"
      aria-live="polite"
      aria-label="Loading inventory snapshot"
    >
      {/* Header - Exact match to loaded component */}
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 mt-[4px] opacity-50 animate-pulse" />
            <div>
              <Shimmer width="w-40" height="h-7" />
              <Shimmer width="w-56" height="h-4" className="mt-0.5" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Shimmer width="w-24" height="h-9" />
          </div>
        </div>
      </CardHeader>

      {/* Content - Exact match to loaded component layout */}
      <CardContent className="space-y-6 flex-1 flex flex-col">
        {/* Summary Metrics - 4 cards in grid */}
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SummaryCardSkeleton key={i} />
          ))}
        </div>

        {/* By Loan Status Section */}
        <div>
          <Shimmer width="w-32" height="h-5" className="mb-3" />
          <TableSkeleton rows={4} columns={5} />
        </div>

        {/* Storage Aging Analysis Section */}
        <div>
          <Shimmer width="w-44" height="h-5" className="mb-3" />
          <TableSkeleton rows={4} columns={4} />
        </div>

        {/* High-Value Alert Section - REMOVED: Conditional in actual component */}
        {/* Only shows if high_value_alert.count > 0, so excluded from skeleton */}

        {/* Turnover Insights Section */}
        <div>
          <Shimmer width="w-32" height="h-5" className="mb-4" />

          {/* Top 3 Insights Cards - p-3 matches actual component */}
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700"
              >
                <Shimmer width="w-28" height="h-4" className="mb-1" />
                <div className="space-y-1.5">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="flex justify-between items-center">
                      <Shimmer width="w-16" height="h-4" />
                      <Shimmer width="w-12" height="h-4" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Additional Metrics Row */}
          <div className="grid grid-cols-4 gap-4 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700"
              >
                <Shimmer width="w-16" height="h-4" className="mb-0.5" />
                <Shimmer width="w-20" height="h-7" />
                <Shimmer width="w-16" height="h-4" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        Loading inventory snapshot data. Please wait.
      </div>
    </Card>
  );
};

export default InventoryLoadingSkeleton;
