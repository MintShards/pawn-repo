/**
 * Premium loading skeleton for TopCustomersCard
 *
 * Features:
 * - Shimmer animation for better perceived performance
 * - Exact layout matching to prevent CLS (Cumulative Layout Shift)
 * - Dark mode support
 * - Accessible loading state
 * - Matches InventorySnapshotCard loading pattern
 */

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
} from "../ui/card";

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
 * Table skeleton for leaderboards
 *
 * @param {Object} props - Component props
 * @param {number} props.rows - Number of data rows (default: 5)
 */
const LeaderboardTableSkeleton = ({ rows = 5 }) => (
  <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
    {/* Header - h-11 matches actual component */}
    <div className="bg-slate-50 dark:bg-slate-800/50 py-3 px-3.5 border-b border-slate-200 dark:border-slate-700 h-11">
      <div className="grid grid-cols-4 gap-4 items-center h-full">
        <Shimmer width="w-12" height="h-3" />
        <Shimmer width="w-20" height="h-3" />
        <Shimmer width="w-16" height="h-3" className="ml-auto" />
        <Shimmer width="w-20" height="h-3" className="ml-auto" />
      </div>
    </div>
    {/* Rows - h-12 matches actual component */}
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="py-3 px-3.5 border-b last:border-b-0 border-slate-100 dark:border-slate-800 h-12"
      >
        <div className="grid grid-cols-4 gap-4 items-center h-full">
          <Shimmer width="w-6" height="h-5" />
          <Shimmer width="w-32" height="h-4" />
          <Shimmer width="w-12" height="h-5" className="ml-auto" />
          <Shimmer width="w-20" height="h-5" className="ml-auto" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Summary metrics skeleton
 */
const SummaryMetricsSkeleton = () => (
  <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
    <div className="grid grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="text-center space-y-2">
          <Shimmer width="w-24" height="h-3" className="mx-auto" />
          <Shimmer width="w-20" height="h-6" className="mx-auto" />
        </div>
      ))}
    </div>
  </div>
);

/**
 * Main loading skeleton component
 *
 * Displays a shimmer-animated skeleton matching the exact layout
 * of the loaded TopCustomersCard component to prevent layout shift (CLS).
 */
const TopCustomersLoadingSkeleton = () => {
  return (
    <Card
      className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm h-full flex flex-col"
      role="status"
      aria-live="polite"
      aria-label="Loading top performers data"
    >
      {/* Header - Exact match to loaded component */}
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-sm mt-[4px] opacity-50 animate-pulse" />
          <div>
            <Shimmer width="w-36" height="h-6" />
            <Shimmer width="w-64" height="h-3" className="mt-1" />
          </div>
        </div>
      </CardHeader>

      {/* Content - Exact match to loaded component layout */}
      <CardContent className="space-y-6 flex-1 flex flex-col">
        {/* Top Customers Section */}
        <div className="space-y-3">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-yellow-600 rounded opacity-50 animate-pulse" />
              <Shimmer width="w-28" height="h-4" />
            </div>
            <Shimmer width="w-24" height="h-9" />
          </div>

          {/* Customers Table */}
          <LeaderboardTableSkeleton rows={5} />

          {/* Summary Metrics */}
          <SummaryMetricsSkeleton />
        </div>

        {/* Top Staff Section */}
        <div className="space-y-3 pt-[12px]">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded opacity-50 animate-pulse" />
              <Shimmer width="w-20" height="h-4" />
            </div>
            <Shimmer width="w-24" height="h-9" />
          </div>

          {/* Staff Table */}
          <LeaderboardTableSkeleton rows={5} />

          {/* Summary Metrics */}
          <SummaryMetricsSkeleton />
        </div>
      </CardContent>

      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        Loading top performers data. Please wait.
      </div>
    </Card>
  );
};

export default TopCustomersLoadingSkeleton;
