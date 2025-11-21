/**
 * Enhanced custom hook for inventory data fetching with retry, progress tracking, and caching
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Progress tracking for loading states
 * - Request caching with TTL
 * - Graceful error recovery
 * - Stale data handling
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import reportsService from "../../../../services/reportsService";

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY = "inventory_snapshot_cache";

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Get cached data if available and not stale
 *
 * HIGH-003 FIX: Validates cache structure before returning
 * to prevent corrupted cache from breaking the component
 *
 * @returns {Object|null} Cached data or null
 */
const getCachedData = () => {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached);

    // HIGH-003 FIX: Validate cache structure
    if (!parsed.data || !parsed.timestamp) {
      console.warn("Invalid cache structure: missing data or timestamp");
      sessionStorage.removeItem(CACHE_KEY); // Clean up corrupted cache
      return null;
    }

    // HIGH-003 FIX: Validate data fields
    if (!parsed.data.by_status || !Array.isArray(parsed.data.by_status)) {
      console.warn(
        "Invalid cache structure: by_status is missing or not an array",
      );
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    if (!parsed.data.by_age || !Array.isArray(parsed.data.by_age)) {
      console.warn(
        "Invalid cache structure: by_age is missing or not an array",
      );
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    if (!parsed.data.summary) {
      console.warn("Invalid cache structure: summary is missing");
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    const age = Date.now() - parsed.timestamp;

    if (age < CACHE_TTL) {
      return { data: parsed.data, age, isStale: age > CACHE_TTL / 2 };
    }
  } catch (error) {
    console.warn("Failed to retrieve cached data:", error);
    // Clean up corrupted cache
    try {
      sessionStorage.removeItem(CACHE_KEY);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
  }
  return null;
};

/**
 * Save data to cache
 *
 * @param {Object} data - Data to cache
 */
const setCachedData = (data) => {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      }),
    );
  } catch (error) {
    console.warn("Failed to cache data:", error);
  }
};

/**
 * Process raw inventory data into usable format
 *
 * @param {Object} rawData - Raw data from API
 * @returns {Object} - Processed data with cached calculations
 */
const processInventoryData = (rawData) => {
  if (!rawData) return null;

  const { summary, by_status, by_age, high_value_alert } = rawData;

  // Data validation - log detailed error for debugging
  if (!summary || !by_status || !by_age) {
    console.error(
      "[InventorySnapshot] Invalid data structure received from server",
    );
    console.error(
      "Expected fields: summary, by_status, by_age, high_value_alert",
    );
    console.error("Received data:", {
      hasSummary: !!summary,
      hasByStatus: !!by_status,
      hasByAge: !!by_age,
      hasHighValueAlert: !!high_value_alert,
      actualKeys: Object.keys(rawData || {}),
    });
    return null;
  }

  /**
   * Filter and sort active statuses with deterministic ordering
   *
   * CRITICAL-001 FIX: Multi-level sorting to prevent non-deterministic order
   * when multiple statuses have same item_count
   *
   * Sorting Priority:
   * 1. Primary: item_count (descending) - highest concentration first
   * 2. Secondary: loan_value (descending) - higher value first for ties
   * 3. Tertiary: status name (alphabetical) - full determinism guarantee
   *
   * This ensures consistent "Top Status" display across renders and exports
   */
  const activeStatuses = by_status
    .filter((status) => status.item_count > 0)
    .sort((a, b) => {
      // Primary: Sort by item_count descending
      if (b.item_count !== a.item_count) {
        return b.item_count - a.item_count;
      }
      // Secondary: Sort by loan_value descending for ties
      if (b.loan_value !== a.loan_value) {
        return b.loan_value - a.loan_value;
      }
      // Tertiary: Alphabetical by status name for full determinism
      return a.status.localeCompare(b.status);
    });

  // Cache expensive find operations (must be done before duplicate check)
  const aged90Plus = by_age.find((age) => age.age_range === "90+ days");
  const overdueStatus = by_status.find((s) => s.status === "Overdue");
  const activeStatus = by_status.find((s) => s.status === "Active");

  // CRITICAL-001 FIX: Defensive programming - detect duplicate statuses
  // This should never happen with correct backend data, but we validate anyway
  const statusNames = activeStatuses.map((s) => s.status);
  const uniqueStatusCount = new Set(statusNames).size;
  if (uniqueStatusCount !== statusNames.length) {
    console.error(
      "[CRITICAL] Duplicate statuses detected in backend response:",
      statusNames,
    );
    console.error("Active statuses data:", activeStatuses);

    // Remove duplicates if found (defensive measure)
    const seen = new Set();
    const deduplicatedStatuses = activeStatuses.filter((s) => {
      if (seen.has(s.status)) {
        console.warn(`Removing duplicate status: ${s.status}`);
        return false;
      }
      seen.add(s.status);
      return true;
    });

    // Use deduplicated array
    return {
      summary,
      by_status,
      by_age,
      high_value_alert,
      activeStatuses: deduplicatedStatuses,
      aged90Plus,
      overdueStatus,
      activeStatus,
    };
  }

  return {
    summary,
    by_status,
    by_age,
    high_value_alert,
    activeStatuses,
    aged90Plus,
    overdueStatus,
    activeStatus,
  };
};

/**
 * Delay utility for retry backoff
 *
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after delay
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Enhanced custom hook for inventory data management
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Progress tracking (0-100%)
 * - Request caching with TTL
 * - Manual retry capability
 * - Stale data indication
 * - Last updated timestamp
 *
 * @returns {Object} - Inventory data state and controls
 * @returns {boolean} loading - Data loading state
 * @returns {boolean} retrying - Retry in progress
 * @returns {string|null} error - Error message if any
 * @returns {Object|null} data - Processed inventory data
 * @returns {number} progress - Loading progress (0-100)
 * @returns {Function} retry - Manual retry function
 * @returns {Date|null} lastUpdated - Last successful data fetch timestamp
 * @returns {boolean} isStale - Data is >2.5 minutes old
 * @returns {boolean} isCached - Currently displaying cached data
 */
export const useInventoryData = (onReady, onFailed) => {
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [progress, setProgress] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [isCached, setIsCached] = useState(false);

  const abortControllerRef = useRef(null);
  const retryCountRef = useRef(0);

  /**
   * Fetch data with retry logic and progress tracking
   *
   * CRITICAL-001 FIX: Moved to useCallback with empty dependency array
   * to ensure stable reference and proper cleanup lifecycle
   *
   * @param {boolean} isManualRetry - Whether this is a user-initiated retry
   */
  const fetchData = useCallback(async (isManualRetry = false) => {
    // HIGH-001 FIX: Abort controller cleanup will be handled by useEffect
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      // Set initial state
      if (isManualRetry) {
        setRetrying(true);
        retryCountRef.current = 0;
      } else {
        setLoading(true);
      }
      setError(null);
      setProgress(0);
      setIsCached(false);

      // HIGH-003 FIX: Validate cache structure before using
      const cached = getCachedData();
      if (cached && !isManualRetry) {
        setRawData(cached.data);
        setLastUpdated(new Date(Date.now() - cached.age));
        setIsStale(cached.isStale);
        setIsCached(true);
        setProgress(100);
        setLoading(false);

        // Notify coordinated loading system when using cache
        if (onReady) onReady();

        // Continue to fetch fresh data in background if stale
        if (cached.isStale) {
          // Don't return - continue to fetch fresh data
        } else {
          return; // Use cached data and exit
        }
      }

      // Simulate progress during fetch
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      let attempt = 0;
      let lastError = null;

      while (attempt < MAX_RETRIES) {
        try {
          const result = await reportsService.getInventorySnapshot(
            abortControllerRef.current.signal,
          );

          // Success - update state
          clearInterval(progressInterval);
          setProgress(100);
          setRawData(result);
          setLastUpdated(new Date());
          setIsStale(false);
          setIsCached(false);

          // Cache the result
          setCachedData(result);

          // Reset retry counter
          retryCountRef.current = 0;

          // Notify coordinated loading system via callback
          if (onReady) onReady();

          return; // Success
        } catch (err) {
          if (err.name === "AbortError") {
            // Request was aborted - don't retry
            clearInterval(progressInterval);
            throw err;
          }

          lastError = err;
          attempt++;

          if (attempt < MAX_RETRIES) {
            // Exponential backoff: 1s, 2s, 4s
            const delayMs = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
            console.log(
              `Retry attempt ${attempt}/${MAX_RETRIES} after ${delayMs}ms`,
            );
            await delay(delayMs);
          }
        }
      }

      // All retries failed
      clearInterval(progressInterval);
      throw lastError;
    } catch (err) {
      if (err.name !== "AbortError") {
        const errorMessage =
          retryCountRef.current >= MAX_RETRIES
            ? `Failed to load inventory data after ${MAX_RETRIES} attempts. Please check your connection and try again.`
            : "Failed to load inventory snapshot. Please try again.";

        setError(errorMessage);
        setProgress(0);
        console.error("Inventory snapshot error:", err);

        // Notify coordinated loading system via callback (don't block others)
        if (onFailed) onFailed();
      }
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, [onReady, onFailed]); // Include coordinated loading callbacks

  /**
   * Manual retry function for user-initiated retries
   */
  const retry = useCallback(() => {
    retryCountRef.current++;
    fetchData(true);
  }, [fetchData]);

  // Initial data fetch on mount
  useEffect(() => {
    fetchData(false);

    // Cleanup: Cancel pending requests on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  // Auto-refresh when data becomes stale (optional)
  useEffect(() => {
    if (isStale && !loading && !retrying) {
      // Could implement auto-refresh here if desired
      // For now, just indicate staleness
    }
  }, [isStale, loading, retrying]);

  // Memoize processed data to avoid recalculation on every render
  // If processing fails, set error state appropriately
  const data = useMemo(() => {
    const processed = processInventoryData(rawData);

    // If we have raw data but processing failed, set error state
    if (rawData && !processed && !error) {
      setError(
        "Invalid data structure received from server. Please refresh the page.",
      );
    }

    return processed;
  }, [rawData, error]);

  return {
    loading,
    retrying,
    error,
    data,
    progress,
    retry,
    lastUpdated,
    isStale,
    isCached,
  };
};
