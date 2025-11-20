/**
 * Turnover insights and operational metrics component
 */

import React from "react";
import { formatCurrency } from "./utils/inventoryFormatters";
import {
  calculateValuePerDay,
  calculateHighValuePercentage,
  calculateAgingHealth,
} from "./utils/inventoryCalculations";

/**
 * Metric card configuration
 */
const METRIC_CARDS_CONFIG = [
  {
    id: "value-per-day",
    label: "Value/Day",
    getValue: (summary) => {
      const value = calculateValuePerDay(
        summary.total_loan_value,
        summary.avg_storage_days,
        summary.total_items,
      );
      return formatCurrency(value);
    },
    subtitle: "per item",
  },
  {
    id: "active-statuses",
    label: "Active Statuses",
    getValue: (summary, data) => data.activeStatuses.length,
    subtitle: "of 9 total",
  },
  {
    id: "high-value-pct",
    label: "High-Value %",
    getValue: (summary, data) => {
      const pct = calculateHighValuePercentage(
        data.high_value_alert,
        summary.total_loan_value,
      );
      return `${pct.toFixed(1)}%`;
    },
    subtitle: "of total value",
  },
  {
    id: "aging-health",
    label: "Aging Health",
    getValue: (summary, data) => {
      const health = calculateAgingHealth(data.by_age, summary.total_items);
      return `${health.toFixed(0)}%`;
    },
    subtitle: "quality score",
  },
];

/**
 * Individual metric card component
 *
 * @param {Object} props - Component props
 * @param {Object} props.config - Card configuration
 * @param {Object} props.summary - Summary data
 * @param {Object} props.data - Full inventory data
 */
const MetricCard = ({ config, summary, data }) => {
  const value = config.getValue(summary, data);

  return (
    <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
      <div className="text-xs text-slate-600 dark:text-slate-400 mb-0.5">
        {config.label}
      </div>
      <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
        {value}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {config.subtitle}
      </div>
    </div>
  );
};

/**
 * Turnover insights component
 *
 * @param {Object} props - Component props
 * @param {Object} props.summary - Summary metrics
 * @param {Array} props.activeStatuses - Active status data
 * @param {Object} props.overdueStatus - Overdue status data
 * @param {Object} props.data - Full inventory data for additional metrics
 */
const InventoryTurnoverInsights = ({
  summary,
  activeStatuses,
  overdueStatus,
  data,
}) => {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
        Turnover Insights
      </h3>

      {/* Top 3 Insights Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Average Days by Status */}
        <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 font-medium">
            Avg Days by Status
          </div>
          <div className="space-y-1.5">
            {activeStatuses.slice(0, 3).map((status) => (
              <div
                key={status.status}
                className="flex justify-between items-center text-xs"
              >
                <span className="text-slate-700 dark:text-slate-300">
                  {status.status}:
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {status.avg_days_in_storage} days
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Value Concentration */}
        <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 font-medium">
            Value Concentration
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-700 dark:text-slate-300">
                Top Status:
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {activeStatuses.length > 0 ? activeStatuses[0].status : "N/A"}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-700 dark:text-slate-300">
                % of Value:
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {activeStatuses.length > 0
                  ? `${activeStatuses[0].percentage.toFixed(1)}%`
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-700 dark:text-slate-300">
                Avg Loan:
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {activeStatuses.length > 0 && activeStatuses[0].item_count > 0
                  ? formatCurrency(
                      activeStatuses[0].loan_value /
                        activeStatuses[0].item_count,
                    )
                  : "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Risk Indicators */}
        <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 font-medium">
            Risk Indicators
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-700 dark:text-slate-300">
                Overdue Rate:
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {overdueStatus
                  ? `${overdueStatus.percentage.toFixed(1)}%`
                  : "0%"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Metrics Row */}
      <div className="grid grid-cols-4 gap-4 mt-4">
        {METRIC_CARDS_CONFIG.map((config) => (
          <MetricCard
            key={config.id}
            config={config}
            summary={summary}
            data={data}
          />
        ))}
      </div>
    </div>
  );
};

export default InventoryTurnoverInsights;
