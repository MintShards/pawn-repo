/**
 * Constants for Revenue & Loan Trends Component
 * Centralized configuration for colors, periods, and chart settings
 */

/**
 * Time period options for trend analysis
 * @type {Array<{value: string, label: string}>}
 */
export const PERIOD_OPTIONS = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '1y', label: '1 Year' }
];

/**
 * Modern, gender-neutral color mapping for revenue chart
 * Matches balanced color palette for visual consistency
 * @type {Object<string, string>}
 */
export const REVENUE_COLORS = {
  Principal: '#0891B2',  // Balanced Cyan
  Interest: '#14B8A6',   // Balanced Teal
  Extensions: '#F59E0B', // Balanced Amber
  Overdue: '#EF4444'     // Balanced Red
};

/**
 * Color mapping for loan chart
 * Must match StatusBadge.jsx exactly for consistency
 * @type {Object<string, string>}
 */
export const LOAN_COLORS = {
  'Active': '#3B82F6',       // blue-500 (matches active status badge)
  'Redeemed': '#10B981',     // green-500 (matches redeemed status badge)
  'Forfeited': '#EA580C',    // orange-600 (matches forfeited status badge)
  'Sold': '#A855F7'          // purple-500 (matches sold status badge)
};

/**
 * Ordered display configuration for revenue categories
 * Ensures consistent ordering across tooltips and legends
 * @type {Array<{name: string, color: string}>}
 */
export const REVENUE_LEGEND_ORDER = [
  { name: 'Principal', color: '#0891B2' },
  { name: 'Interest', color: '#14B8A6' },
  { name: 'Extensions', color: '#F59E0B' },
  { name: 'Overdue', color: '#EF4444' }
];

/**
 * Ordered display configuration for loan status categories
 * Ensures consistent ordering across tooltips and legends
 * @type {Array<{name: string, color: string}>}
 */
export const LOAN_LEGEND_ORDER = [
  { name: 'Active', color: '#3B82F6' },
  { name: 'Redeemed', color: '#10B981' },
  { name: 'Forfeited', color: '#EA580C' },
  { name: 'Sold', color: '#A855F7' }
];

/**
 * Chart gradient configurations for revenue visualization
 * @type {Array<{id: string, color1: string, color2: string}>}
 */
export const REVENUE_GRADIENTS = [
  { id: 'principalGradient', color1: '#0891B2', color2: '#0E7490' },
  { id: 'interestGradient', color1: '#14B8A6', color2: '#0D9488' },
  { id: 'extensionGradient', color1: '#F59E0B', color2: '#D97706' },
  { id: 'overdueGradient', color1: '#EF4444', color2: '#DC2626' }
];

/**
 * Bar chart data key configurations for revenue
 * @type {Array<{dataKey: string, name: string, gradient: string, radius: number[]}>}
 */
export const REVENUE_BAR_CONFIG = [
  { dataKey: 'principal_collected', name: 'Principal', gradient: 'url(#principalGradient)', radius: [0, 0, 0, 0] },
  { dataKey: 'interest_collected', name: 'Interest', gradient: 'url(#interestGradient)', radius: [0, 0, 0, 0] },
  { dataKey: 'extension_fees', name: 'Extensions', gradient: 'url(#extensionGradient)', radius: [0, 0, 0, 0] },
  { dataKey: 'overdue_fees', name: 'Overdue', gradient: 'url(#overdueGradient)', radius: [6, 6, 0, 0] }
];

/**
 * Line chart data key configurations for loans
 * @type {Array<{dataKey: string, name: string, color: string, filter: string}>}
 */
export const LOAN_LINE_CONFIG = [
  { dataKey: 'active_loans', name: 'Active', color: LOAN_COLORS['Active'], filter: 'url(#glow-blue)' },
  { dataKey: 'redeemed', name: 'Redeemed', color: LOAN_COLORS['Redeemed'], filter: 'url(#glow-emerald)' },
  { dataKey: 'forfeited', name: 'Forfeited', color: LOAN_COLORS['Forfeited'], filter: 'url(#glow-orange)' },
  { dataKey: 'sold', name: 'Sold', color: LOAN_COLORS['Sold'], filter: 'url(#glow-purple)' }
];

/**
 * Shared chart styling configuration
 * @type {Object}
 */
export const CHART_STYLES = {
  grid: {
    strokeDasharray: '3 3',
    stroke: '#e5e7eb',
    className: 'opacity-50'
  },
  axis: {
    tick: { fontSize: 11, fill: '#64748b' },
    stroke: '#cbd5e1',
    axisLine: { strokeWidth: 1.5 }
  },
  tooltip: {
    cursor: { fill: 'rgba(148, 163, 184, 0.1)' }
  },
  line: {
    strokeWidth: 2.5,
    dot: { r: 4, strokeWidth: 2, stroke: '#fff' },
    activeDot: { r: 6, strokeWidth: 2, stroke: '#fff' }
  }
};
