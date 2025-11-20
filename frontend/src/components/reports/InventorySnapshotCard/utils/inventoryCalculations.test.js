/**
 * Inventory Calculations Tests
 *
 * BLOCKER-003: Comprehensive test suite for defensive validation
 * Tests edge cases, negative values, null/undefined inputs, and range clamping
 */

import {
  calculateAgingHealth,
  calculateValuePerDay,
  calculateHighValuePercentage,
  calculateValueAtRisk,
} from "./inventoryCalculations";

describe("inventoryCalculations", () => {
  describe("calculateAgingHealth", () => {
    test("returns 100 for perfect health (no aged items)", () => {
      const ageData = [
        { age_range: "0-30 days", item_count: 50 },
        { age_range: "31-60 days", item_count: 30 },
        { age_range: "61-90 days", item_count: 20 },
        { age_range: "90+ days", item_count: 0 },
      ];
      expect(calculateAgingHealth(ageData, 100)).toBe(100);
    });

    test("calculates correct percentage with aged items", () => {
      const ageData = [
        { age_range: "0-30 days", item_count: 70 },
        { age_range: "90+ days", item_count: 30 },
      ];
      expect(calculateAgingHealth(ageData, 100)).toBe(70);
    });

    test("handles negative item_count gracefully", () => {
      const ageData = [
        { age_range: "90+ days", item_count: -10 }, // Invalid data
      ];
      // Should treat as 0, return 100% health
      expect(calculateAgingHealth(ageData, 100)).toBe(100);
    });

    test("handles negative totalItems gracefully", () => {
      const ageData = [{ age_range: "90+ days", item_count: 10 }];
      // Should treat as 0, return 100% health
      expect(calculateAgingHealth(ageData, -50)).toBe(100);
    });

    test("handles null ageData", () => {
      expect(calculateAgingHealth(null, 100)).toBe(100);
    });

    test("handles undefined ageData", () => {
      expect(calculateAgingHealth(undefined, 100)).toBe(100);
    });

    test("handles empty ageData array", () => {
      expect(calculateAgingHealth([], 100)).toBe(100);
    });

    test("handles zero totalItems", () => {
      const ageData = [{ age_range: "90+ days", item_count: 10 }];
      expect(calculateAgingHealth(ageData, 0)).toBe(100);
    });

    test("handles missing 90+ days bucket", () => {
      const ageData = [
        { age_range: "0-30 days", item_count: 50 },
        { age_range: "31-60 days", item_count: 50 },
      ];
      expect(calculateAgingHealth(ageData, 100)).toBe(100);
    });

    test("clamps result to 0-100 range (data corruption scenario)", () => {
      const ageData = [
        { age_range: "90+ days", item_count: 150 }, // More than total (data corruption)
      ];
      const result = calculateAgingHealth(ageData, 100);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    test("handles non-array ageData", () => {
      expect(calculateAgingHealth({}, 100)).toBe(100);
      expect(calculateAgingHealth("invalid", 100)).toBe(100);
      expect(calculateAgingHealth(123, 100)).toBe(100);
    });

    test("handles null item_count in 90+ bucket", () => {
      const ageData = [{ age_range: "90+ days", item_count: null }];
      expect(calculateAgingHealth(ageData, 100)).toBe(100);
    });

    test("handles undefined item_count in 90+ bucket", () => {
      const ageData = [{ age_range: "90+ days", item_count: undefined }];
      expect(calculateAgingHealth(ageData, 100)).toBe(100);
    });
  });

  describe("calculateValuePerDay", () => {
    test("calculates correct value per day", () => {
      expect(calculateValuePerDay(10000, 100, 10)).toBe(10);
    });

    test("handles zero avgDays", () => {
      expect(calculateValuePerDay(10000, 0, 10)).toBe(0);
    });

    test("handles zero totalItems", () => {
      expect(calculateValuePerDay(10000, 100, 0)).toBe(0);
    });

    test("handles negative totalValue gracefully", () => {
      expect(calculateValuePerDay(-1000, 100, 10)).toBe(0);
    });

    test("handles negative avgDays gracefully", () => {
      expect(calculateValuePerDay(10000, -50, 10)).toBe(0);
    });

    test("handles negative totalItems gracefully", () => {
      expect(calculateValuePerDay(10000, 100, -10)).toBe(0);
    });

    test("handles all negative inputs", () => {
      expect(calculateValuePerDay(-1000, -50, -10)).toBe(0);
    });

    test("handles null inputs", () => {
      expect(calculateValuePerDay(null, null, null)).toBe(0);
    });

    test("handles undefined inputs", () => {
      expect(calculateValuePerDay(undefined, undefined, undefined)).toBe(0);
    });

    test("handles mixed null and valid inputs", () => {
      expect(calculateValuePerDay(10000, null, 10)).toBe(0);
      expect(calculateValuePerDay(null, 100, 10)).toBe(0);
      expect(calculateValuePerDay(10000, 100, null)).toBe(0);
    });

    test("returns valid number (not NaN or Infinity)", () => {
      const result = calculateValuePerDay(10000, 100, 10);
      expect(isNaN(result)).toBe(false);
      expect(isFinite(result)).toBe(true);
    });
  });

  describe("calculateHighValuePercentage", () => {
    test("calculates correct percentage", () => {
      const highValueAlert = { total_value: 5000 };
      expect(calculateHighValuePercentage(highValueAlert, 10000)).toBe(50);
    });

    test("handles zero totalValue", () => {
      const highValueAlert = { total_value: 5000 };
      expect(calculateHighValuePercentage(highValueAlert, 0)).toBe(0);
    });

    test("handles null highValueAlert", () => {
      expect(calculateHighValuePercentage(null, 10000)).toBe(0);
    });

    test("handles undefined highValueAlert", () => {
      expect(calculateHighValuePercentage(undefined, 10000)).toBe(0);
    });

    test("handles highValueAlert without total_value", () => {
      expect(calculateHighValuePercentage({}, 10000)).toBe(0);
      expect(calculateHighValuePercentage({ count: 5 }, 10000)).toBe(0);
    });

    test("handles negative totalValue gracefully", () => {
      const highValueAlert = { total_value: 5000 };
      expect(calculateHighValuePercentage(highValueAlert, -10000)).toBe(0);
    });

    test("handles negative high value gracefully", () => {
      const highValueAlert = { total_value: -1000 };
      expect(calculateHighValuePercentage(highValueAlert, 10000)).toBe(0);
    });

    test("clamps result to 0-100 range (high value exceeds total)", () => {
      const highValueAlert = { total_value: 15000 }; // More than total
      const result = calculateHighValuePercentage(highValueAlert, 10000);
      expect(result).toBeLessThanOrEqual(100);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    test("handles null total_value in alert", () => {
      const highValueAlert = { total_value: null };
      expect(calculateHighValuePercentage(highValueAlert, 10000)).toBe(0);
    });

    test("handles undefined total_value in alert", () => {
      const highValueAlert = { total_value: undefined };
      expect(calculateHighValuePercentage(highValueAlert, 10000)).toBe(0);
    });

    test("returns valid number (not NaN or Infinity)", () => {
      const highValueAlert = { total_value: 5000 };
      const result = calculateHighValuePercentage(highValueAlert, 10000);
      expect(isNaN(result)).toBe(false);
      expect(isFinite(result)).toBe(true);
    });
  });

  describe("calculateValueAtRisk", () => {
    test("calculates correct value at risk", () => {
      const ageData = [
        { age_range: "0-30 days", loan_value: 1000 },
        { age_range: "90+ days", loan_value: 5000 },
      ];
      expect(calculateValueAtRisk(ageData)).toBe(5000);
    });

    test("returns 0 for missing 90+ bucket", () => {
      const ageData = [
        { age_range: "0-30 days", loan_value: 1000 },
        { age_range: "31-60 days", loan_value: 2000 },
      ];
      expect(calculateValueAtRisk(ageData)).toBe(0);
    });

    test("handles null ageData", () => {
      expect(calculateValueAtRisk(null)).toBe(0);
    });

    test("handles undefined ageData", () => {
      expect(calculateValueAtRisk(undefined)).toBe(0);
    });

    test("handles empty array", () => {
      expect(calculateValueAtRisk([])).toBe(0);
    });

    test("handles non-array ageData", () => {
      expect(calculateValueAtRisk({})).toBe(0);
      expect(calculateValueAtRisk("invalid")).toBe(0);
    });

    test("handles negative loan_value gracefully", () => {
      const ageData = [{ age_range: "90+ days", loan_value: -5000 }];
      expect(calculateValueAtRisk(ageData)).toBe(0);
    });

    test("handles null loan_value in 90+ bucket", () => {
      const ageData = [{ age_range: "90+ days", loan_value: null }];
      expect(calculateValueAtRisk(ageData)).toBe(0);
    });

    test("handles undefined loan_value in 90+ bucket", () => {
      const ageData = [{ age_range: "90+ days", loan_value: undefined }];
      expect(calculateValueAtRisk(ageData)).toBe(0);
    });
  });

  describe("Edge Case Integration Tests", () => {
    test("all functions handle completely invalid data gracefully", () => {
      const invalidInputs = [null, undefined, {}, [], "", 0, -1, NaN, Infinity];

      invalidInputs.forEach((input) => {
        expect(() => calculateAgingHealth(input, input)).not.toThrow();
        expect(() => calculateValuePerDay(input, input, input)).not.toThrow();
        expect(() => calculateHighValuePercentage(input, input)).not.toThrow();
        expect(() => calculateValueAtRisk(input)).not.toThrow();
      });
    });

    test("all functions return valid numbers (not NaN or Infinity)", () => {
      const result1 = calculateAgingHealth(
        [{ age_range: "90+ days", item_count: 10 }],
        100,
      );
      const result2 = calculateValuePerDay(10000, 100, 10);
      const result3 = calculateHighValuePercentage(
        { total_value: 5000 },
        10000,
      );
      const result4 = calculateValueAtRisk([
        { age_range: "90+ days", loan_value: 5000 },
      ]);

      [result1, result2, result3, result4].forEach((result) => {
        expect(isNaN(result)).toBe(false);
        expect(isFinite(result)).toBe(true);
      });
    });

    test("percentage functions never exceed 100", () => {
      // Data corruption scenario: aged items > total items
      const corruptAgeData = [{ age_range: "90+ days", item_count: 200 }];
      const health = calculateAgingHealth(corruptAgeData, 100);
      expect(health).toBeLessThanOrEqual(100);

      // High value exceeds total value
      const highValue = calculateHighValuePercentage(
        { total_value: 20000 },
        10000,
      );
      expect(highValue).toBeLessThanOrEqual(100);
    });

    test("all functions return non-negative values", () => {
      const result1 = calculateAgingHealth(
        [{ age_range: "90+ days", item_count: -10 }],
        -50,
      );
      const result2 = calculateValuePerDay(-1000, -100, -10);
      const result3 = calculateHighValuePercentage(
        { total_value: -5000 },
        -10000,
      );
      const result4 = calculateValueAtRisk([
        { age_range: "90+ days", loan_value: -5000 },
      ]);

      [result1, result2, result3, result4].forEach((result) => {
        expect(result).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
