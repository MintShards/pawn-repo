/**
 * CSV export logic for inventory snapshot
 *
 * SECURITY: Uses escapeCSV from shared utility to prevent CSV formula injection
 * Reference: https://owasp.org/www-community/attacks/CSV_Injection
 */

import { formatCurrency } from "./inventoryFormatters";
import { calculateValueAtRisk } from "./inventoryCalculations";
import {
  escapeCSV,
  formatCurrencyForCSV,
  rowsToCSV,
} from "../../../../utils/csvUtils";
import reportsService from "../../../../services/reportsService";

/**
 * Build CSV rows from inventory data with secure escaping
 *
 * CRITICAL-002 FIX: Applies escapeCSV to all user-generated data fields
 * to prevent CSV formula injection attacks
 *
 * @param {Object} data - Inventory snapshot data
 * @param {Array} activeStatuses - Filtered active statuses
 * @returns {Array<Array<string>>} - Array of CSV rows with secure escaping
 */
const buildCSVRows = (data, activeStatuses) => {
  const { summary, by_status, by_age, high_value_alert } = data;

  const rows = [
    ["Inventory Snapshot Report"],
    ["Generated:", new Date().toLocaleString()],
    [""],
    ["SUMMARY METRICS"],
    ["Total Items", summary.total_items],
    ["Total Loan Value", formatCurrencyForCSV(summary.total_loan_value)],
    ["Average Storage Days", summary.avg_storage_days],
    [
      "Value at Risk (90+ days)",
      formatCurrencyForCSV(calculateValueAtRisk(by_age)),
    ],
    [""],
    ["BY LOAN STATUS"],
    [
      "Status",
      "Items",
      "Total Value",
      "Avg Loan",
      "Percentage",
      "Avg Storage Days",
    ],
    ...activeStatuses.map((s) => {
      // CRITICAL-002 FIX: Division-by-zero guard
      const avgLoan = s.item_count > 0 ? s.loan_value / s.item_count : 0;

      return [
        escapeCSV(s.status), // 🔒 CRITICAL-002 FIX: Escape status name (defense in depth)
        s.item_count,
        formatCurrencyForCSV(s.loan_value),
        formatCurrencyForCSV(avgLoan), // Safe division
        `${s.percentage.toFixed(1)}%`,
        s.avg_days_in_storage,
      ];
    }),
    [""],
    ["STORAGE AGING ANALYSIS"],
    ["Age Range", "Items", "Loan Value", "Percentage", "Alert"],
    ...by_age.map((a) => [
      escapeCSV(a.age_range), // 🔒 CRITICAL-002 FIX: Escape age range (defense in depth)
      a.item_count,
      formatCurrencyForCSV(a.loan_value),
      `${a.percentage.toFixed(1)}%`,
      a.alert ? "Yes" : "No",
    ]),
    [""],
  ];

  // Add high-value alert section if applicable
  if (high_value_alert && high_value_alert.count > 0) {
    rows.push(
      ["HIGH-VALUE ITEMS ALERT"],
      ["Loans Over $5,000", high_value_alert.count],
      ["Total High-Value", formatCurrencyForCSV(high_value_alert.total_value)],
    );

    if (high_value_alert.highest) {
      rows.push(
        [
          "Highest Value Loan",
          formatCurrencyForCSV(high_value_alert.highest.amount),
        ],
        ["Item Description", escapeCSV(high_value_alert.highest.description)], // 🔒 CRITICAL-002 FIX: PRIMARY ATTACK VECTOR
        ["Days in Storage", high_value_alert.highest.days_in_storage],
      );
    }
  }

  return rows;
};

/**
 * REMOVED: escapeCSVCell function replaced with secure escapeCSV from csvUtils.js
 *
 * CRITICAL-002 FIX: The old escapeCSVCell function did NOT prevent CSV formula injection.
 * Now using shared escapeCSV utility that properly handles dangerous characters (=, +, -, @, \t, \r)
 *
 * Migration: All escaping is now handled by rowsToCSV from csvUtils.js
 */

/**
 * Export inventory snapshot to CSV file with secure escaping
 *
 * CRITICAL-002 FIX: Uses secure CSV export pipeline from csvUtils.js
 * Prevents CSV formula injection attacks via escapeCSV function
 *
 * @param {Object} data - Inventory snapshot data
 * @param {Array} activeStatuses - Filtered active statuses
 * @throws {Error} - If data is invalid or export fails
 */
export const exportInventoryToCSV = async (data, activeStatuses) => {
  if (!data) {
    throw new Error("No data available to export");
  }

  // Build CSV content with secure escaping
  const rows = buildCSVRows(data, activeStatuses);
  const csvContent = rowsToCSV(rows); // Uses secure escapeCSV internally

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const filename = `inventory-snapshot-${new Date().toISOString().split("T")[0]}.csv`;

  // Use service download method
  reportsService.downloadCSV(blob, filename);
};
