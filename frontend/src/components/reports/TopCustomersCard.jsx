import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { Button } from "../ui/button";
import { Download, Users, Briefcase } from "lucide-react";
import reportsService from "../../services/reportsService";
import { Alert, AlertDescription } from "../ui/alert";
import { formatCurrency, getMedalEmoji } from "./utils/reportUtils";
import { toast } from "sonner";

const TopCustomersCard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customersData, setCustomersData] = useState(null);
  const [staffData, setStaffData] = useState(null);
  const [customersError, setCustomersError] = useState(null);
  const [staffError, setStaffError] = useState(null);
  // P1-001 FIX: Unified export state object (eliminates duplication)
  const [exporting, setExporting] = useState({
    customers: false,
    staff: false,
  });

  // P1-002 FIX: Memory leak prevention with cleanup
  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setCustomersError(null);
        setStaffError(null);

        // CRITICAL-002 FIX: Use Promise.allSettled for partial data recovery
        // This ensures that if one request fails, we still get data from the other
        // P1-002 FIX: Pass AbortController signal for cancellation support
        const results = await Promise.allSettled([
          reportsService.getTopCustomers({
            limit: 5,
            view: "customers",
            signal: abortController.signal,
          }),
          reportsService.getTopCustomers({
            limit: 5,
            view: "staff",
            signal: abortController.signal,
          }),
        ]);

        // P1-002 FIX: Prevent state updates on unmounted component
        if (!isMounted) return;

        // Process customers data result
        if (results[0].status === "fulfilled") {
          setCustomersData(results[0].value);
        } else {
          const customersErrorMsg =
            "Failed to load customer data. Please try again.";
          setCustomersError(customersErrorMsg);
          console.error("Top customers error:", results[0].reason);
        }

        // Process staff data result
        if (results[1].status === "fulfilled") {
          setStaffData(results[1].value);
        } else {
          const staffErrorMsg = "Failed to load staff data. Please try again.";
          setStaffError(staffErrorMsg);
          console.error("Top staff error:", results[1].reason);
        }

        // Only set global error if both requests failed
        if (
          results[0].status === "rejected" &&
          results[1].status === "rejected"
        ) {
          setError("Failed to load performance data. Please try again.");
        }
      } catch (err) {
        // P1-002 FIX: Don't log expected AbortError
        if (err.name === "AbortError") return;

        // Catch-all for unexpected errors
        if (isMounted) {
          setError("An unexpected error occurred. Please try again.");
          console.error("Top performance unexpected error:", err);
        }
      } finally {
        // P1-002 FIX: Only update loading state if still mounted
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    // P1-002 FIX: Cleanup function to prevent memory leaks
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  // P1-001 FIX: Unified export handler (eliminates 95% duplication)
  const handleExport = async (view, filename) => {
    try {
      setExporting((prev) => ({ ...prev, [view]: true }));
      const blob = await reportsService.exportTopCustomersCSV({
        limit: 5,
        view,
      });
      reportsService.downloadCSV(blob, filename);
      toast.success(
        `Top ${view === "customers" ? "Customers" : "Staff"} exported successfully`,
        {
          description: `Downloaded as ${filename}`,
        },
      );
    } catch (err) {
      console.error(`Export ${view} failed:`, err);
      // ENHANCEMENT-002: Enhanced error context with error message
      toast.error("Export failed", {
        description: `Unable to export Top ${view === "customers" ? "Customers" : "Staff"} data: ${err.message || "Unknown error"}. Please try again or contact support.`,
      });
    } finally {
      setExporting((prev) => ({ ...prev, [view]: false }));
    }
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="animate-pulse">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg opacity-50" />
                <div className="space-y-2">
                  <div className="h-6 bg-slate-200/60 dark:bg-slate-700/40 rounded w-48" />
                  <div className="h-3 bg-slate-200/60 dark:bg-slate-700/40 rounded w-64" />
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="animate-pulse space-y-6">
            {/* Customers section skeleton */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-amber-500/50 rounded" />
                  <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-32" />
                </div>
                <div className="h-9 w-28 bg-slate-200/60 dark:bg-slate-700/40 rounded-md" />
              </div>

              {/* Table skeleton */}
              <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded w-16" />
                    <div className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded w-20" />
                    <div className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded w-16 ml-auto" />
                    <div className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded w-20 ml-auto" />
                  </div>
                </div>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="border-t border-slate-100 dark:border-slate-800 p-4"
                  >
                    <div className="grid grid-cols-4 gap-4 items-center">
                      <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-8" />
                      <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-32" />
                      <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-12 ml-auto" />
                      <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-20 ml-auto" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary metrics skeleton */}
              <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center space-y-2">
                    <div className="h-3 bg-slate-200/60 dark:bg-slate-700/40 rounded w-28 mx-auto" />
                    <div className="h-6 bg-slate-200/60 dark:bg-slate-700/40 rounded w-24 mx-auto" />
                  </div>
                  <div className="text-center space-y-2 border-l border-r border-slate-200 dark:border-slate-700 px-4">
                    <div className="h-3 bg-slate-200/60 dark:bg-slate-700/40 rounded w-24 mx-auto" />
                    <div className="h-6 bg-slate-200/60 dark:bg-slate-700/40 rounded w-20 mx-auto" />
                  </div>
                  <div className="text-center space-y-2">
                    <div className="h-3 bg-slate-200/60 dark:bg-slate-700/40 rounded w-24 mx-auto" />
                    <div className="h-6 bg-slate-200/60 dark:bg-slate-700/40 rounded w-16 mx-auto" />
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-200 dark:border-slate-700" />

            {/* Staff section skeleton */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-500/50 rounded" />
                  <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-24" />
                </div>
                <div className="h-9 w-28 bg-slate-200/60 dark:bg-slate-700/40 rounded-md" />
              </div>

              {/* Table skeleton */}
              <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded w-16" />
                    <div className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded w-20" />
                    <div className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded w-16 ml-auto" />
                    <div className="h-4 bg-slate-200/60 dark:bg-slate-700/40 rounded w-20 ml-auto" />
                  </div>
                </div>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={`staff-${i}`}
                    className="border-t border-slate-100 dark:border-slate-800 p-4"
                  >
                    <div className="grid grid-cols-4 gap-4 items-center">
                      <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-8" />
                      <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-32" />
                      <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-12 ml-auto" />
                      <div className="h-5 bg-slate-200/60 dark:bg-slate-700/40 rounded w-20 ml-auto" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Staff summary metrics skeleton */}
              <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center space-y-2">
                    <div className="h-3 bg-slate-200/60 dark:bg-slate-700/40 rounded w-20 mx-auto" />
                    <div className="h-6 bg-slate-200/60 dark:bg-slate-700/40 rounded w-24 mx-auto" />
                  </div>
                  <div className="text-center space-y-2 border-l border-r border-slate-200 dark:border-slate-700 px-4">
                    <div className="h-3 bg-slate-200/60 dark:bg-slate-700/40 rounded w-28 mx-auto" />
                    <div className="h-6 bg-slate-200/60 dark:bg-slate-700/40 rounded w-16 mx-auto" />
                  </div>
                  <div className="text-center space-y-2">
                    <div className="h-3 bg-slate-200/60 dark:bg-slate-700/40 rounded w-24 mx-auto" />
                    <div className="h-6 bg-slate-200/60 dark:bg-slate-700/40 rounded w-24 mx-auto" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show global error only if both requests failed and no partial data exists
  if (error && !customersData && !staffData) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  // Show nothing if loading and no partial data yet
  if (loading && !customersData && !staffData) {
    return null;
  }

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm mt-[4px]">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Top Performers
            </CardTitle>
            <CardDescription className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Customer and staff performance leaderboards
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* TOP CUSTOMERS SECTION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-yellow-600 rounded flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Top Customers
              </h3>
            </div>
            <Button
              onClick={() =>
                handleExport(
                  "customers",
                  `top-customers-${new Date().toISOString().split("T")[0]}.csv`,
                )
              }
              disabled={exporting.customers || !customersData}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          {/* Show inline error if customers data failed to load */}
          {customersError && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription className="text-sm">
                {customersError}
              </AlertDescription>
            </Alert>
          )}

          {/* Only show customers table if data is available */}
          {customersData && (
            <>
              <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col className="w-[14%]" />
                    <col className="w-[36%]" />
                    <col className="w-[20%]" />
                    <col className="w-[30%]" />
                  </colgroup>
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="py-3.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 h-11">
                        <div className="flex items-center justify-start h-full">
                          Rank
                        </div>
                      </th>
                      <th className="py-3.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 h-11">
                        <div className="flex items-center justify-start h-full">
                          Name
                        </div>
                      </th>
                      <th className="py-3.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 h-11">
                        <div className="flex items-center justify-end h-full">
                          Loans
                        </div>
                      </th>
                      <th className="py-3.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 h-11">
                        <div className="flex items-center justify-end h-full">
                          Value
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customersData.customers.slice(0, 5).map((customer) => (
                      <tr
                        key={customer.phone_number}
                        className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3.5 px-4 h-12">
                          <div className="flex items-center justify-start h-full">
                            <span
                              className={`text-base leading-none ${customer.rank > 3 ? "pl-1.5" : ""}`}
                            >
                              {getMedalEmoji(customer.rank)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 h-12">
                          <div className="flex items-center justify-start h-full">
                            <span className="text-sm text-slate-700 dark:text-slate-300 leading-tight truncate block">
                              {customer.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 h-12">
                          <div className="flex items-center justify-end h-full">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                              {customer.active_loans}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 h-12">
                          <div className="flex items-center justify-end h-full">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                              {formatCurrency(customer.total_loan_value)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Customer Summary Metrics */}
              {customersData.summary && (
                <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-3 gap-6 text-xs">
                    <div className="text-center">
                      <div className="text-slate-600 dark:text-slate-400 mb-2">
                        Total Active Value
                      </div>
                      <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(
                          customersData.summary?.total_active_value ?? 0,
                        )}
                      </div>
                    </div>
                    <div className="text-center border-l border-r border-slate-200 dark:border-slate-700 px-4">
                      <div className="text-slate-600 dark:text-slate-400 mb-2">
                        Avg Loan Value
                      </div>
                      <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(
                          customersData.summary?.avg_loan_value ?? 0,
                        )}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-600 dark:text-slate-400 mb-2">
                        Avg Active Loans
                      </div>
                      <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {(customersData.summary?.avg_active_loans ?? 0).toFixed(
                          1,
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* DIVIDER */}
        <div className="border-t border-slate-200 dark:border-slate-700" />

        {/* TOP STAFF SECTION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Top Staff
              </h3>
            </div>
            <Button
              onClick={() =>
                handleExport(
                  "staff",
                  `top-staff-${new Date().toISOString().split("T")[0]}.csv`,
                )
              }
              disabled={exporting.staff || !staffData}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          {/* Show inline error if staff data failed to load */}
          {staffError && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription className="text-sm">
                {staffError}
              </AlertDescription>
            </Alert>
          )}

          {/* Only show staff table if data is available */}
          {staffData && (
            <>
              <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col className="w-[14%]" />
                    <col className="w-[36%]" />
                    <col className="w-[20%]" />
                    <col className="w-[30%]" />
                  </colgroup>
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="py-3.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 h-11">
                        <div className="flex items-center justify-start h-full">
                          Rank
                        </div>
                      </th>
                      <th className="py-3.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 h-11">
                        <div className="flex items-center justify-start h-full">
                          Name
                        </div>
                      </th>
                      <th className="py-3.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 h-11">
                        <div className="flex items-center justify-end h-full">
                          Trans
                        </div>
                      </th>
                      <th className="py-3.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 h-11">
                        <div className="flex items-center justify-end h-full">
                          Value
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.staff.slice(0, 5).map((staff) => (
                      <tr
                        key={staff.user_id}
                        className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3.5 px-4 h-12">
                          <div className="flex items-center justify-start h-full">
                            <span
                              className={`text-base leading-none ${staff.rank > 3 ? "pl-1.5" : ""}`}
                            >
                              {getMedalEmoji(staff.rank)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 h-12">
                          <div className="flex items-center justify-start h-full">
                            <span className="text-sm text-slate-700 dark:text-slate-300 leading-tight truncate block">
                              {staff.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 h-12">
                          <div className="flex items-center justify-end h-full">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                              {staff.transaction_count}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 h-12">
                          <div className="flex items-center justify-end h-full">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                              {formatCurrency(staff.total_value)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Staff Summary Metrics */}
              {staffData.summary && (
                <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-3 gap-6 text-xs">
                    <div className="text-center">
                      <div className="text-slate-600 dark:text-slate-400 mb-2">
                        Total Value
                      </div>
                      <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(staffData.summary?.total_value ?? 0)}
                      </div>
                    </div>
                    <div className="text-center border-l border-r border-slate-200 dark:border-slate-700 px-4">
                      <div className="text-slate-600 dark:text-slate-400 mb-2">
                        Avg Transactions
                      </div>
                      <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {(staffData.summary?.avg_transactions ?? 0).toFixed(1)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-600 dark:text-slate-400 mb-2">
                        Avg Value/Staff
                      </div>
                      <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(
                          staffData.summary?.avg_value_per_staff ?? 0,
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TopCustomersCard;
