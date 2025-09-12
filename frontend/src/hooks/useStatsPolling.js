/**
 * Custom hook for transaction statistics polling
 * Uses REST API with improved polling and error handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';

// API endpoints
const STATS_API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Available metrics
export const METRIC_TYPES = {
  ACTIVE_LOANS: 'active_loans',
  NEW_THIS_MONTH: 'new_this_month', 
  OVERDUE_LOANS: 'overdue_loans',
  MATURITY_THIS_WEEK: 'maturity_this_week',
  TODAYS_COLLECTION: 'todays_collection'
};

// Default metric state
const createDefaultMetric = (type) => ({
  metric_type: type,
  value: 0,
  previous_value: 0,
  trend_direction: 'stable',
  trend_percentage: 0,
  last_updated: new Date().toISOString(),
  display_value: '0',
  description: '',
  triggered_by: null,
  calculation_duration_ms: null
});

/**
 * Hook for managing transaction statistics with improved polling
 */
export const useStatsPolling = (options = {}) => {
  const { isAuthenticated } = useAuth();
  const {
    refreshInterval = 5000, // Fast 5-second refresh for responsive updates
    autoStart = true
  } = options;

  // State
  const [metrics, setMetrics] = useState(() => {
    const initialMetrics = {};
    Object.values(METRIC_TYPES).forEach(type => {
      initialMetrics[type] = createDefaultMetric(type);
    });
    return initialMetrics;
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Refs
  const refreshIntervalRef = useRef(null);
  const isComponentMountedRef = useRef(true);
  const lastRequestTimeRef = useRef(null);
  const isPageVisibleRef = useRef(true);
  
  // Page visibility handling for efficient polling
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;
      if (!document.hidden && lastRequestTimeRef.current) {
        const timeSinceLastUpdate = Date.now() - lastRequestTimeRef.current;
        // If page was hidden for more than 30 seconds, refresh immediately
        if (timeSinceLastUpdate > 30000) {
          fetchAllMetrics();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    isComponentMountedRef.current = true;

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Get default/empty metrics structure
  const getEmptyMetrics = () => ({
    [METRIC_TYPES.ACTIVE_LOANS]: {
      metric_type: METRIC_TYPES.ACTIVE_LOANS,
      value: 0,
      previous_value: 0,
      trend_direction: 'stable',
      trend_percentage: 0,
      last_updated: new Date().toISOString(),
      display_value: '0',
      description: 'Active loan transactions',
      triggered_by: 'no_data'
    },
    [METRIC_TYPES.NEW_THIS_MONTH]: {
      metric_type: METRIC_TYPES.NEW_THIS_MONTH,
      value: 0,
      previous_value: 0,
      trend_direction: 'stable',
      trend_percentage: 0,
      last_updated: new Date().toISOString(),
      display_value: '0',
      description: 'New transactions this month',
      triggered_by: 'no_data'
    },
    [METRIC_TYPES.OVERDUE_LOANS]: {
      metric_type: METRIC_TYPES.OVERDUE_LOANS,
      value: 0,
      previous_value: 0,
      trend_direction: 'stable',
      trend_percentage: 0,
      last_updated: new Date().toISOString(),
      display_value: '0',
      description: 'Overdue loan transactions',
      triggered_by: 'no_data'
    },
    [METRIC_TYPES.MATURITY_THIS_WEEK]: {
      metric_type: METRIC_TYPES.MATURITY_THIS_WEEK,
      value: 0,
      previous_value: 0,
      trend_direction: 'stable',
      trend_percentage: 0,
      last_updated: new Date().toISOString(),
      display_value: '0',
      description: 'Loans maturing this week',
      triggered_by: 'no_data'
    },
    [METRIC_TYPES.TODAYS_COLLECTION]: {
      metric_type: METRIC_TYPES.TODAYS_COLLECTION,
      value: 0,
      previous_value: 0,
      trend_direction: 'stable',
      trend_percentage: 0,
      last_updated: new Date().toISOString(),
      display_value: '$0',
      description: 'Total collected today',
      triggered_by: 'no_data'
    }
  });

  // REST API functions with improved error handling and deduplication
  const fetchAllMetrics = useCallback(async (forceRefresh = false) => {
    const token = authService.getToken();
    if (!token) {
      return;
    }

    // Prevent concurrent requests
    const now = Date.now();
    if (!forceRefresh && lastRequestTimeRef.current && (now - lastRequestTimeRef.current) < 1000) {
      return; // Debounce requests within 1 second
    }

    // Only poll when page is visible unless forced
    if (!forceRefresh && !isPageVisibleRef.current) {
      return;
    }

    lastRequestTimeRef.current = now;
    
    try {
      const response = await fetch(`${STATS_API_BASE}/api/v1/stats/metrics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (isComponentMountedRef.current) {
        setMetrics(data.metrics || {});
        setError(null);
        setRetryCount(0); // Reset retry count on success
        setIsLoading(false);
      }
    } catch (err) {
      if (isComponentMountedRef.current) {
        const newRetryCount = retryCount + 1;
        setRetryCount(newRetryCount);
        
        // Exponential backoff for retries (max 3 attempts)
        if (newRetryCount <= 3) {
          const retryDelay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 10000);
          setTimeout(() => {
            if (isComponentMountedRef.current) {
              fetchAllMetrics(true);
            }
          }, retryDelay);
        } else {
          // After max retries, show fallback data
          setMetrics(getEmptyMetrics());
          setError(`Connection failed after ${newRetryCount} attempts`);
        }
        
        setIsLoading(false);
      }
    }
  }, [retryCount]);

  const fetchSpecificMetric = useCallback(async (metricType) => {
    const token = authService.getToken();
    if (!token) {
      return;
    }
    
    try {
      const response = await fetch(`${STATS_API_BASE}/api/v1/stats/metrics/${metricType}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (isComponentMountedRef.current) {
        setMetrics(prev => ({
          ...prev,
          [metricType]: data
        }));
      }
    } catch (err) {
      // Silently handle metric fetch errors in production
    }
  }, []);

  // Setup polling interval
  useEffect(() => {
    if (!isAuthenticated || !authService.getToken()) {
      // No token, show empty state
      setMetrics(getEmptyMetrics());
      setIsLoading(false);
      setError('Authentication required');
      return;
    }

    if (!autoStart) {
      return;
    }

    // Initial fetch
    fetchAllMetrics();

    // Set up periodic refresh
    if (refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(fetchAllMetrics, refreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [isAuthenticated, autoStart, refreshInterval, fetchAllMetrics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isComponentMountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // Cache invalidation function
  const invalidateCache = useCallback(async () => {
    try {
      const token = authService.getToken();
      if (!token) return;

      await fetch(`${STATS_API_BASE}/api/v1/stats/cache/invalidate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.warn('Cache invalidation failed:', error);
    }
  }, []);

  return {
    // Data
    metrics,
    
    // Individual metrics for convenience
    activeLoans: metrics[METRIC_TYPES.ACTIVE_LOANS],
    newThisMonth: metrics[METRIC_TYPES.NEW_THIS_MONTH],
    overdueLoans: metrics[METRIC_TYPES.OVERDUE_LOANS],
    maturityThisWeek: metrics[METRIC_TYPES.MATURITY_THIS_WEEK],
    todaysCollection: metrics[METRIC_TYPES.TODAYS_COLLECTION],
    
    // State
    isLoading,
    error,
    retryCount,
    
    // Actions
    invalidateCache,
    fetchSpecificMetric
  };
};

export default useStatsPolling;