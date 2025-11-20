/**
 * Currency and data formatting utilities for inventory components
 */

/**
 * Format currency in standard notation ($1,234)
 *
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format currency in compact notation ($1.1k, $2.5M)
 * For header summary cards - shows approximate value
 *
 * @param {number} amount - Amount to format
 * @returns {string} - Compact formatted currency string
 */
export const formatCompactCurrency = (amount) => {
  if (amount === 0) return "$0";

  // Use compact notation for values >= 1000
  if (Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(amount);
  }

  // For values < 1000, use standard format
  return formatCurrency(amount);
};
