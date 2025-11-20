/**
 * Summary metrics cards for inventory snapshot
 */

import React from "react";
import { BarChart3, DollarSign, Clock, ShieldAlert } from "lucide-react";
import {
  formatCurrency,
  formatCompactCurrency,
} from "./utils/inventoryFormatters";
import { calculateValueAtRisk } from "./utils/inventoryCalculations";

/**
 * Static color class mappings for production build compatibility
 * Avoids dynamic class construction which Tailwind purges during build
 */
const COLOR_CLASSES = {
  blue: {
    icon: "text-blue-600 dark:text-blue-400",
    label: "text-blue-700 dark:text-blue-300",
    value: "text-blue-900 dark:text-blue-100",
  },
  green: {
    icon: "text-green-600 dark:text-green-400",
    label: "text-green-700 dark:text-green-300",
    value: "text-green-900 dark:text-green-100",
  },
  purple: {
    icon: "text-purple-600 dark:text-purple-400",
    label: "text-purple-700 dark:text-purple-300",
    value: "text-purple-900 dark:text-purple-100",
  },
  orange: {
    icon: "text-orange-600 dark:text-orange-400",
    label: "text-orange-700 dark:text-orange-300",
    value: "text-orange-900 dark:text-orange-100",
  },
};

/**
 * Configuration for summary cards
 */
const SUMMARY_CARDS_CONFIG = [
  {
    id: "total-items",
    icon: BarChart3,
    label: "Total Items",
    colorClass: "blue",
    getValue: (summary) => summary.total_items.toLocaleString(),
    getTitle: (summary) =>
      `${summary.total_items.toLocaleString()} items in inventory`,
    subtitle: "items stored",
    isCompact: false,
  },
  {
    id: "total-value",
    icon: DollarSign,
    label: "Total Value",
    colorClass: "green",
    getValue: (summary) => formatCompactCurrency(summary.total_loan_value),
    getTitle: (summary) =>
      `Exact value: ${formatCurrency(summary.total_loan_value)}`,
    subtitle: "total loan val",
    isCompact: true,
  },
  {
    id: "avg-days",
    icon: Clock,
    label: "Avg Days",
    colorClass: "purple",
    getValue: (summary) => summary.avg_storage_days,
    getTitle: (summary) =>
      `Average storage duration: ${summary.avg_storage_days} days`,
    subtitle: "days in storage",
    isCompact: false,
  },
  {
    id: "at-risk",
    icon: ShieldAlert,
    label: "At Risk",
    colorClass: "orange",
    getValue: (summary, by_age) =>
      formatCompactCurrency(calculateValueAtRisk(by_age)),
    getTitle: (summary, by_age) =>
      `Exact value at risk: ${formatCurrency(calculateValueAtRisk(by_age))} in loans 90+ days old`,
    subtitle: "90+ days old",
    isCompact: true,
  },
];

/**
 * Individual summary card component
 *
 * @param {Object} props - Component props
 * @param {Object} props.config - Card configuration
 * @param {Object} props.summary - Summary data
 * @param {Array} props.by_age - Age breakdown data (for at-risk calculation)
 */
const SummaryCard = ({ config, summary, by_age }) => {
  const Icon = config.icon;
  const value = config.getValue(summary, by_age);
  const title = config.getTitle(summary, by_age);
  const colorClasses = COLOR_CLASSES[config.colorClass];

  return (
    <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${colorClasses.icon}`} />
        <div className={`text-xs font-medium ${colorClasses.label}`}>
          {config.label}
        </div>
      </div>
      <div
        className={`text-2xl font-bold ${colorClasses.value} ${config.isCompact ? "cursor-help" : ""}`}
        title={title}
      >
        {value}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {config.subtitle}
      </div>
    </div>
  );
};

/**
 * Summary cards container component
 *
 * CRITICAL-002 FIX: Added ARIA live region for screen reader announcements
 *
 * @param {Object} props - Component props
 * @param {Object} props.summary - Summary metrics data
 * @param {Array} props.by_age - Age breakdown data
 */
const InventorySummaryCards = ({ summary, by_age }) => {
  return (
    <>
      {/* CRITICAL-002 FIX: ARIA live region for summary metrics */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        Summary metrics: {summary.total_items} total items,
        {formatCurrency(summary.total_loan_value)} total value,
        {summary.avg_storage_days} average days in storage,
        {formatCurrency(calculateValueAtRisk(by_age))} at risk
      </div>

      <div className="grid grid-cols-4 gap-4">
        {SUMMARY_CARDS_CONFIG.map((config) => (
          <SummaryCard
            key={config.id}
            config={config}
            summary={summary}
            by_age={by_age}
          />
        ))}
      </div>
    </>
  );
};

export default InventorySummaryCards;
