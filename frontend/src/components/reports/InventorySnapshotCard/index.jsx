/**
 * Inventory Snapshot Card - Main Container Component (Enhanced)
 *
 * Enhanced with production-ready loading states:
 * - Retry mechanism with exponential backoff
 * - Progress tracking and visual indicators
 * - Request caching with stale data handling
 * - Smooth transitions and animations
 * - Graceful error recovery
 * - Last updated timestamp
 * - Accessible loading states
 *
 * Component Architecture:
 * - Main container handles data fetching and export coordination
 * - Sub-components handle specific UI sections
 * - Utilities provide reusable business logic
 * - Custom hook manages data fetching and processing
 */

import React, { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../ui/card";
import { Button } from "../../ui/button";
import { Download, Package, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "../../ui/alert";

// Custom hook for data management
import { useInventoryData } from "./hooks/useInventoryData";

// Sub-components
import InventoryLoadingSkeleton from "./InventoryLoadingSkeleton";
import InventorySummaryCards from "./InventorySummaryCards";
import InventoryStatusTable from "./InventoryStatusTable";
import InventoryAgingTable from "./InventoryAgingTable";
import InventoryAlerts from "./InventoryAlerts";
import InventoryTurnoverInsights from "./InventoryTurnoverInsights";

// Utilities
import { exportInventoryToCSV } from "./utils/inventoryExport";

/**
 * Enhanced Inventory Snapshot Card Component
 *
 * Features:
 * - Real-time inventory analytics
 * - Status breakdown and aging analysis
 * - High-value item alerts
 * - Turnover insights and operational metrics
 * - CSV export functionality
 * - Retry mechanism for failed loads
 * - Progress tracking
 * - Last updated indicator
 * - Stale data warnings
 */
const InventorySnapshotCard = () => {
  const { loading, retrying, error, data, progress, retry } =
    useInventoryData();

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  /**
   * Handle CSV export with error handling
   */
  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      setExportError(null);

      await exportInventoryToCSV(data, data.activeStatuses);
    } catch (err) {
      console.error("Export failed:", err);
      setExportError(err.message || "Failed to export CSV. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [data]);

  // Loading state (show skeleton while loading, even if error exists)
  if (loading && !data) {
    return <InventoryLoadingSkeleton />;
  }

  // Error state with retry button (only show after loading completes)
  if (error && !data && !loading) {
    return (
      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm h-full flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Inventory Snapshot
              </CardTitle>
              <CardDescription className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Storage analytics and aging alerts
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button
            onClick={retry}
            disabled={retrying}
            variant="outline"
            size="sm"
          >
            {retrying ? "Retrying..." : "Retry"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Data validation - if we reach here without data, show loading skeleton
  // (this handles edge cases where data hasn't arrived yet)
  if (!data) {
    return <InventoryLoadingSkeleton />;
  }

  const { summary, by_age, high_value_alert, activeStatuses, overdueStatus } =
    data;

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm h-full flex flex-col transition-opacity duration-300 ease-in-out">
      {/* CRITICAL-002 FIX: ARIA live region for screen reader announcements */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {loading
          ? "Loading inventory data"
          : data
            ? `Inventory snapshot loaded: ${data.summary.total_items} items, ${data.activeStatuses.length} active statuses`
            : "Inventory data unavailable"}
      </div>

      {/* Header */}
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 mt-[4px]">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Inventory Snapshot
              </CardTitle>
              <CardDescription className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Storage analytics and aging alerts
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Export button */}
            <Button
              onClick={handleExport}
              disabled={exporting}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              {exporting ? "Exporting..." : "Export"}
            </Button>

            {/* Export error */}
            {exportError && (
              <div className="text-xs text-red-600 dark:text-red-400">
                {exportError}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="space-y-6 flex-1 flex flex-col">
        {/* Summary Metrics */}
        <InventorySummaryCards summary={summary} by_age={by_age} />

        {/* By Loan Status */}
        <InventoryStatusTable activeStatuses={activeStatuses} />

        {/* Storage Aging Analysis */}
        <InventoryAgingTable by_age={by_age} />

        {/* High-Value Alert */}
        <InventoryAlerts high_value_alert={high_value_alert} />

        {/* Turnover Insights */}
        <InventoryTurnoverInsights
          summary={summary}
          activeStatuses={activeStatuses}
          overdueStatus={overdueStatus}
          data={data}
        />
      </CardContent>
    </Card>
  );
};

export default InventorySnapshotCard;
