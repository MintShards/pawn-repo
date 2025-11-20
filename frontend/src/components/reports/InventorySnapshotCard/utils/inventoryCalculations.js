/**
 * Business logic calculations for inventory analytics
 *
 * BLOCKER-003: All calculation functions include defensive validation
 * to handle negative values, null/undefined inputs, and invalid ranges.
 */

/**
 * Calculate value at risk (90+ days aging)
 *
 * @param {Array} ageData - Array of age range objects
 * @returns {number} - Total loan value for items 90+ days old
 */
export const calculateValueAtRisk = (ageData) => {
  if (!ageData || !Array.isArray(ageData)) return 0;
  const aged90Plus = ageData.find((age) => age.age_range === "90+ days");
  if (!aged90Plus) return 0;

  // Defensive validation: loan_value must be non-negative
  return Math.max(0, aged90Plus.loan_value || 0);
};

/**
 * Calculate loan-to-age ratio (value per day per item)
 *
 * BLOCKER-003: Defensive validation for all inputs
 * HIGH-002 FIX: Added finite number validation to prevent Infinity/NaN
 *
 * @param {number} totalValue - Total loan value
 * @param {number} avgDays - Average storage days
 * @param {number} totalItems - Total item count
 * @returns {number} - Value per day per item
 */
export const calculateValuePerDay = (totalValue, avgDays, totalItems) => {
  // Defensive validation: all inputs must be non-negative
  const validTotalValue = Math.max(0, totalValue || 0);
  const validAvgDays = Math.max(0, avgDays || 0);
  const validTotalItems = Math.max(0, totalItems || 0);

  if (validAvgDays === 0 || validTotalItems === 0) {
    return 0;
  }

  // HIGH-002 FIX: Calculate with finite number validation
  const result = validTotalValue / validAvgDays / validTotalItems;
  if (!Number.isFinite(result)) {
    console.warn("[calculateValuePerDay] Non-finite result detected:", {
      totalValue: validTotalValue,
      avgDays: validAvgDays,
      totalItems: validTotalItems,
      result,
    });
    return 0;
  }

  return result;
};

/**
 * Calculate high-value concentration percentage
 *
 * BLOCKER-003: Range clamping and input validation
 * HIGH-002 FIX: Added finite number validation to prevent Infinity/NaN
 *
 * @param {Object} highValueAlert - High value alert object
 * @param {number} totalValue - Total loan value
 * @returns {number} - Percentage of total value in high-value items (0-100)
 */
export const calculateHighValuePercentage = (highValueAlert, totalValue) => {
  if (!highValueAlert || !highValueAlert.total_value) {
    return 0;
  }

  // Defensive validation: totalValue must be positive
  const validTotalValue = Math.max(0, totalValue || 0);
  if (validTotalValue === 0) {
    return 0;
  }

  // Defensive validation: high value total must be non-negative
  const validHighValue = Math.max(0, highValueAlert.total_value || 0);

  // HIGH-002 FIX: Calculate with finite number validation
  const percentage = (validHighValue / validTotalValue) * 100;
  if (!Number.isFinite(percentage)) {
    console.warn("[calculateHighValuePercentage] Non-finite result detected:", {
      highValue: validHighValue,
      totalValue: validTotalValue,
      percentage,
    });
    return 0;
  }

  // Clamp to valid range [0, 100]
  return Math.max(0, Math.min(100, percentage));
};

/**
 * Calculate aging health score (percentage of items NOT 90+ days old)
 *
 * BLOCKER-003: Comprehensive defensive validation
 * HIGH-002 FIX: Added finite number validation to prevent Infinity/NaN
 *
 * @param {Array} ageData - Array of age range objects with item counts
 * @param {number} totalItems - Total item count
 * @returns {number} - Aging health percentage (0-100)
 */
export const calculateAgingHealth = (ageData, totalItems) => {
  // Defensive validation: null/undefined/empty array
  if (!ageData || !Array.isArray(ageData) || ageData.length === 0) {
    return 100; // Perfect health if no data
  }

  // Defensive validation: totalItems must be positive
  const validTotalItems = Math.max(0, totalItems || 0);
  if (validTotalItems === 0) {
    return 100; // Perfect health if no items
  }

  // Find 90+ days bucket
  const aged90Plus = ageData.find((age) => age.age_range === "90+ days");
  if (!aged90Plus) {
    return 100; // Perfect health if no aged items
  }

  // Defensive validation: item_count must be non-negative
  const validAgedCount = Math.max(0, aged90Plus.item_count || 0);

  // HIGH-002 FIX: Calculate with finite number validation
  const healthScore = 100 - (validAgedCount / validTotalItems) * 100;
  if (!Number.isFinite(healthScore)) {
    console.warn("[calculateAgingHealth] Non-finite result detected:", {
      agedCount: validAgedCount,
      totalItems: validTotalItems,
      healthScore,
    });
    return 100; // Default to perfect health on calculation error
  }

  // Clamp to valid range [0, 100]
  return Math.max(0, Math.min(100, healthScore));
};
