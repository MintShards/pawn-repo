import React from "react";
import { AlertCircle, Package, RefreshCw } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../ui/card";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button } from "../../ui/button";

/**
 * Error fallback UI for Inventory Snapshot component
 *
 * Displayed when ErrorBoundary catches an error.
 * Provides context-specific recovery options.
 *
 * BLOCKER-002: Custom error state for graceful error handling
 */
const InventorySnapshotErrorState = ({ error, resetError }) => {
  const handleRefresh = () => {
    if (resetError) {
      resetError();
    } else {
      window.location.reload();
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm h-full flex flex-col">
      {/* Header matching normal component style */}
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Inventory Snapshot Unavailable
            </CardTitle>
            <CardDescription className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              An error occurred while loading inventory data
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-center">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold mb-1">
              Unable to Load Inventory Analytics
            </div>
            <div className="text-sm">
              An unexpected error occurred. This issue has been logged
              automatically. Please try refreshing the component or contact
              support if the problem persists.
            </div>
          </AlertDescription>
        </Alert>

        {/* Recovery Options */}
        <div className="space-y-3">
          <Button
            onClick={handleRefresh}
            className="w-full sm:w-auto"
            variant="default"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>

          {/* Optional: Link to help documentation */}
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <p>If this error continues:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Check your internet connection</li>
              <li>Clear your browser cache and refresh</li>
              <li>Contact support with error details</li>
            </ul>
          </div>
        </div>

        {/* Development Error Details */}
        {process.env.NODE_ENV === "development" && error && (
          <details className="mt-6 p-3 bg-slate-100 dark:bg-slate-800 rounded text-xs">
            <summary className="cursor-pointer font-semibold mb-2 text-red-600 dark:text-red-400">
              Error Details (Development Mode)
            </summary>
            <pre className="overflow-auto text-slate-700 dark:text-slate-300">
              {error.toString()}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
};

export default InventorySnapshotErrorState;
