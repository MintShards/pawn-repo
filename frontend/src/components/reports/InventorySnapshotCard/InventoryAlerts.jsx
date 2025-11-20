/**
 * Alert components for inventory warnings
 */

import React from "react";
import { AlertTriangle } from "lucide-react";
import { formatCurrency } from "./utils/inventoryFormatters";

/**
 * High-value items alert component
 *
 * @param {Object} props - Component props
 * @param {Object} props.high_value_alert - High value alert data
 */
const InventoryAlerts = ({ high_value_alert }) => {
  // Don't render if no high-value items
  if (!high_value_alert || high_value_alert.count === 0) {
    return null;
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 border border-yellow-200 dark:border-yellow-800">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-xs">
          <div className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
            High-Value Items Alert
          </div>
          <div className="text-yellow-800 dark:text-yellow-200 space-y-1">
            <div>
              Loans over $5,000: {high_value_alert.count} transactions (
              {formatCurrency(high_value_alert.total_value)} total)
            </div>
            {high_value_alert.highest && (
              <div>
                Highest value: {formatCurrency(high_value_alert.highest.amount)}{" "}
                ({high_value_alert.highest.description} -{" "}
                {high_value_alert.highest.days_in_storage} days in storage)
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryAlerts;
