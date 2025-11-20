/**
 * Status breakdown table component
 */

import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "./utils/inventoryFormatters";

/**
 * Status color mapping
 * Matches StatusBadge.jsx and TransactionTableView.jsx color scheme
 */
const STATUS_COLORS = {
  Active: "bg-blue-500",
  Overdue: "bg-red-500",
  Extended: "bg-cyan-500",
  Hold: "bg-amber-400",
  Damaged: "bg-amber-800",
  Redeemed: "bg-green-500",
  Forfeited: "bg-orange-600",
  Sold: "bg-purple-500",
  Voided: "bg-gray-500",
};

/**
 * Get status color class
 *
 * @param {string} status - Status name
 * @returns {string} - Tailwind color class
 */
const getStatusColor = (status) => {
  return STATUS_COLORS[status] || "bg-gray-500";
};

/**
 * Status table row component
 *
 * @param {Object} props - Component props
 * @param {Object} props.status - Status data object
 * @param {Function} props.onStatusClick - Click handler
 */
const StatusRow = ({ status, onStatusClick }) => {
  const handleClick = useCallback(() => {
    onStatusClick(status.status);
  }, [status.status, onStatusClick]);

  return (
    <tr
      className="border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      onClick={handleClick}
      title={`View ${status.status} transactions`}
    >
      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
        <span className="inline-flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded ${getStatusColor(status.status)}`}
          />
          <span>{status.status}</span>
        </span>
      </td>
      <td className="py-2.5 px-3 text-right font-medium text-slate-900 dark:text-slate-100">
        {status.item_count}
      </td>
      <td className="py-2.5 px-3 text-right font-medium text-slate-900 dark:text-slate-100">
        {formatCurrency(status.loan_value)}
      </td>
      <td className="py-2.5 px-3 text-right font-medium text-slate-900 dark:text-slate-100">
        {formatCurrency(
          status.item_count > 0
            ? (() => {
                // HIGH-002 FIX: Ensure division produces finite number
                const avgLoan = status.loan_value / status.item_count;
                return Number.isFinite(avgLoan) ? avgLoan : 0;
              })()
            : 0,
        )}
      </td>
      <td className="py-2.5 px-3 text-right font-medium text-slate-900 dark:text-slate-100">
        {status.percentage.toFixed(1)}%
      </td>
    </tr>
  );
};

/**
 * Inventory status table component
 *
 * CRITICAL-002 FIX: Added ARIA live region for screen reader announcements
 *
 * @param {Object} props - Component props
 * @param {Array} props.activeStatuses - Array of status objects with items > 0
 */
const InventoryStatusTable = ({ activeStatuses }) => {
  const navigate = useNavigate();

  /**
   * Navigate to filtered transactions view
   *
   * @param {string} statusName - Status name to filter by
   */
  const handleStatusClick = useCallback(
    (statusName) => {
      const statusParam = statusName.toLowerCase();
      navigate(`/transactions?status=${statusParam}`);
    },
    [navigate],
  );

  if (activeStatuses.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
          By Loan Status
        </h3>
        <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
          No items currently in inventory
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* CRITICAL-002 FIX: ARIA live region for status table updates */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        Status breakdown: {activeStatuses.length} active statuses,
        {activeStatuses.reduce((sum, s) => sum + s.item_count, 0)} total items
      </div>

      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
        By Loan Status
      </h3>
      <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                Status
              </th>
              <th className="text-right py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                Items
              </th>
              <th className="text-right py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                Value
              </th>
              <th className="text-right py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                Avg Loan
              </th>
              <th className="text-right py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {activeStatuses.map((status) => (
              <StatusRow
                key={status.status}
                status={status}
                onStatusClick={handleStatusClick}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryStatusTable;
