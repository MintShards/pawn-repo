/**
 * Pagination Configuration Utility
 *
 * Provides standardized pagination settings across the application
 * to ensure consistent UX for activity logs, customers, and transactions.
 */

/**
 * Standard pagination configuration
 * Used across all modules for consistent pagination behavior
 */
export const STANDARD_PAGINATION = {
  pageSizeOptions: [5, 10, 20, 50, 100],
  defaultPageSize: 10,
  showPageSizeSelector: true,
  maxVisiblePages: 7,
};

/**
 * Module-specific pagination themes
 * Maps each module to its designated theme color
 */
export const PAGINATION_THEMES = {
  activityLog: { primary: 'blue' },
  customers: { primary: 'cyan' },
  transactions: { primary: 'orange' },
  users: { primary: 'purple' },
  default: { primary: 'blue' },
};

/**
 * Module-specific item labels for "Showing X-Y of Z [label]"
 */
export const ITEM_LABELS = {
  activityLog: 'logs',
  customers: 'customers',
  transactions: 'transactions',
  users: 'users',
  default: 'items',
};

/**
 * Get pagination configuration for a specific module
 *
 * @param {string} module - Module name (activityLog, customers, transactions, users)
 * @param {Object} overrides - Optional configuration overrides
 * @returns {Object} Complete pagination configuration
 *
 * @example
 * const config = getPaginationConfig('customers', { defaultPageSize: 25 });
 */
export const getPaginationConfig = (module = 'default', overrides = {}) => {
  return {
    ...STANDARD_PAGINATION,
    theme: PAGINATION_THEMES[module] || PAGINATION_THEMES.default,
    itemLabel: ITEM_LABELS[module] || ITEM_LABELS.default,
    ...overrides,
  };
};

/**
 * Validate pagination parameters
 * Ensures page size and current page are within valid ranges
 *
 * @param {number} currentPage - Current page number (1-indexed)
 * @param {number} pageSize - Items per page
 * @param {number} totalItems - Total number of items
 * @returns {Object} Validated pagination parameters with corrected values
 */
export const validatePaginationParams = (currentPage, pageSize, totalItems) => {
  const validPageSize = Math.max(1, Math.min(pageSize, 100));
  const totalPages = Math.max(1, Math.ceil(totalItems / validPageSize));
  const validCurrentPage = Math.max(1, Math.min(currentPage, totalPages));

  return {
    currentPage: validCurrentPage,
    pageSize: validPageSize,
    totalPages,
    isValid: currentPage === validCurrentPage && pageSize === validPageSize,
  };
};

/**
 * Calculate pagination display range
 * Returns the range of items being displayed (e.g., "1-10 of 262")
 *
 * @param {number} currentPage - Current page number (1-indexed)
 * @param {number} pageSize - Items per page
 * @param {number} totalItems - Total number of items
 * @returns {Object} Display range with start, end, and total
 */
export const getPaginationRange = (currentPage, pageSize, totalItems) => {
  if (totalItems === 0) {
    return { start: 0, end: 0, total: 0 };
  }

  const start = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const end = Math.min(currentPage * pageSize, totalItems);

  return { start, end, total: totalItems };
};
