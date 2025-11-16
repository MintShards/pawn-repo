/**
 * Formatting utilities for Revenue & Loan Trends Component
 * Centralized formatting logic for consistency
 */

/**
 * Format currency values for display
 * CRITICAL: System uses whole dollars only (no cents)
 *
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string (e.g., "$1,500")
 */
export const formatCurrency = (amount) => {
  // System uses whole numbers only - no cents
  return `$${Math.round(amount).toLocaleString('en-US')}`;
};

/**
 * Format number with thousands separator
 *
 * @param {number} value - Number to format
 * @returns {string} Formatted number string (e.g., "1,500")
 */
export const formatNumber = (value) => {
  return new Intl.NumberFormat('en-US').format(value);
};

/**
 * Format large numbers for Y-axis display (abbreviates thousands)
 *
 * @param {number} value - Value to format
 * @returns {string} Abbreviated value (e.g., "$1.5k")
 */
export const formatAxisValue = (value) => {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value}`;
};

/**
 * Format loan count for Y-axis display (abbreviates thousands)
 *
 * @param {number} value - Value to format
 * @returns {string} Abbreviated value (e.g., "1.5k")
 */
export const formatLoanAxisValue = (value) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return `${value}`;
};

/**
 * Calculate percentage of total
 *
 * @param {number} value - Partial value
 * @param {number} total - Total value
 * @returns {string} Formatted percentage (e.g., "25.5%")
 */
export const calculatePercentage = (value, total) => {
  if (total === 0) return '0';
  return ((value / total) * 100).toFixed(1);
};
