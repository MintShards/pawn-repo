import React from 'react';

/**
 * StatCard Component
 * Displays a statistical metric with icon, label, value, and optional sub-value
 *
 * @param {Object} props
 * @param {React.ComponentType} props.icon - Lucide icon component
 * @param {string} props.label - Label text for the metric
 * @param {string} props.value - Main value to display
 * @param {string} [props.subValue] - Optional sub-value (e.g., percentage or count)
 * @param {string} props.iconColor - Tailwind class for icon color
 * @param {string} props.iconBg - Tailwind class for icon background
 * @returns {JSX.Element}
 */
const StatCard = React.memo(({ icon: Icon, label, value, subValue, iconColor, iconBg }) => (
  <div className="flex items-center gap-3">
    <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
      <Icon className={`w-5 h-5 ${iconColor}`} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap truncate">{label}</p>
      <p className="text-lg font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap truncate">{value}</p>
      {subValue && (
        <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap truncate">{subValue}</p>
      )}
    </div>
  </div>
));

StatCard.displayName = 'StatCard';

export default StatCard;
