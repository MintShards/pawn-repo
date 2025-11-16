import React from 'react';
import { REVENUE_COLORS, LOAN_COLORS, REVENUE_LEGEND_ORDER, LOAN_LEGEND_ORDER } from '../constants/trendsConstants';
import { formatCurrency } from '../utils/trendsFormatters';

/**
 * Shared tooltip container styles for consistent appearance
 * @type {string}
 */
const tooltipContainerClass = "bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-4";
const tooltipTitleClass = "text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2";
const tooltipItemClass = "flex items-center justify-between gap-6 text-xs";
const tooltipColorDotClass = "w-3 h-3 rounded-full shadow-sm";
const tooltipLabelClass = "font-medium text-slate-700 dark:text-slate-300";
const tooltipValueClass = "font-bold text-slate-900 dark:text-slate-100 tabular-nums";

/**
 * Custom tooltip for revenue chart with premium styling and correct order
 * Displays revenue breakdown with currency formatting
 *
 * @param {Object} props
 * @param {boolean} props.active - Whether tooltip is active
 * @param {Array} props.payload - Data payload for tooltip
 * @param {string} props.label - Label for current data point (date)
 * @returns {JSX.Element|null}
 */
export const RevenueTooltip = React.memo(({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  // Sort payload by desired order using the legend order configuration
  const orderedNames = REVENUE_LEGEND_ORDER.map(item => item.name);
  const sortedPayload = [...payload].sort((a, b) => {
    return orderedNames.indexOf(a.name) - orderedNames.indexOf(b.name);
  });

  return (
    <div className={tooltipContainerClass}>
      <p className={tooltipTitleClass}>{label}</p>
      <div className="space-y-2">
        {sortedPayload.map((entry, index) => (
          <div key={index} className={tooltipItemClass}>
            <div className="flex items-center gap-2">
              <div
                className={tooltipColorDotClass}
                style={{ backgroundColor: REVENUE_COLORS[entry.name] }}
              />
              <span className={tooltipLabelClass}>{entry.name}</span>
            </div>
            <span className={tooltipValueClass}>
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

RevenueTooltip.displayName = 'RevenueTooltip';

/**
 * Custom tooltip for loan chart with premium styling and correct order
 * CRITICAL: Shows loan counts as numbers, NOT currency
 *
 * @param {Object} props
 * @param {boolean} props.active - Whether tooltip is active
 * @param {Array} props.payload - Data payload for tooltip
 * @param {string} props.label - Label for current data point (date)
 * @returns {JSX.Element|null}
 */
export const LoanTooltip = React.memo(({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  // Sort payload by desired order using the legend order configuration
  const orderedNames = LOAN_LEGEND_ORDER.map(item => item.name);
  const sortedPayload = [...payload].sort((a, b) => {
    return orderedNames.indexOf(a.name) - orderedNames.indexOf(b.name);
  });

  return (
    <div className={tooltipContainerClass}>
      <p className={tooltipTitleClass}>{label}</p>
      <div className="space-y-2">
        {sortedPayload.map((entry, index) => (
          <div key={index} className={tooltipItemClass}>
            <div className="flex items-center gap-2">
              <div
                className={tooltipColorDotClass}
                style={{ backgroundColor: LOAN_COLORS[entry.name] }}
              />
              <span className={tooltipLabelClass}>{entry.name}</span>
            </div>
            <span className={tooltipValueClass}>
              {new Intl.NumberFormat('en-US').format(entry.value)} loans
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

LoanTooltip.displayName = 'LoanTooltip';
