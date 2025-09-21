/**
 * Custom hook for transaction statistics polling
 * Uses REST API with improved polling and error handling
 * Implements singleton pattern to prevent multiple polling instances
 */

import { useState, useEffect } from 'react';
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

// Singleton polling manager
class StatsPollingManager {
  constructor() {
    this.subscribers = new Map(); // Changed to Map to track refresh intervals
    this.metrics = {};
    this.isPolling = false;
    this.intervalId = null;
    this.refreshInterval = 60000; // Default 60 seconds (increased for production stability)
    this.isLoading = true;
    this.error = null;
    this.retryCount = 0;
    this.connectionHealth = 'good';
    this.consecutiveFailures = 0;
    this.lastRequestTime = null;
    this.isPageVisible = true;
    this.circuitBreaker = { state: 'closed', failureCount: 0, lastFailureTime: null };
    this.adaptiveInterval = this.refreshInterval;
    this.immediateRefreshTimer = null;

    // Initialize default metrics
    Object.values(METRIC_TYPES).forEach(type => {
      this.metrics[type] = createDefaultMetric(type);
    });

    this.setupPageVisibilityHandling();
  }

  setupPageVisibilityHandling() {
    const handleVisibilityChange = () => {
      this.isPageVisible = !document.hidden;
      if (!document.hidden && this.lastRequestTime) {
        const timeSinceLastUpdate = Date.now() - this.lastRequestTime;
        // If page was hidden for more than 2 minutes, refresh immediately
        if (timeSinceLastUpdate > 120000) {
          this.fetchMetrics();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  // Calculate optimal refresh interval based on all subscribers
  updateRefreshInterval() {
    if (this.subscribers.size === 0) {
      this.refreshInterval = 60000; // Default when no subscribers
      return;
    }

    // Use the longest interval for production stability and rate limit safety
    const intervals = Array.from(this.subscribers.values());
    this.refreshInterval = Math.max(...intervals);
    this.adaptiveInterval = this.refreshInterval;

    // Restart polling with new interval if currently polling
    if (this.isPolling) {
      this.setupPollingInterval();
    }
  }

  subscribe(callback, refreshInterval = 60000) {
    // Store callback with its preferred refresh interval
    this.subscribers.set(callback, refreshInterval);
    
    // Update the polling interval based on all subscribers
    this.updateRefreshInterval();
    
    // Start polling if this is the first subscriber
    if (this.subscribers.size === 1) {
      this.startPolling();
    }

    // Immediately notify with current data
    callback({
      metrics: this.metrics,
      isLoading: this.isLoading,
      error: this.error,
      retryCount: this.retryCount,
      connectionHealth: this.connectionHealth
    });

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
      
      // Update interval after removing subscriber
      this.updateRefreshInterval();
      
      // Stop polling if no subscribers
      if (this.subscribers.size === 0) {
        this.stopPolling();
      }
    };
  }

  notifySubscribers() {
    const data = {
      metrics: this.metrics,
      isLoading: this.isLoading,
      error: this.error,
      retryCount: this.retryCount,
      connectionHealth: this.connectionHealth
    };

    this.subscribers.forEach((interval, callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error notifying subscriber:', error);
      }
    });
  }

  checkCircuitBreaker() {
    const now = Date.now();
    
    if (this.circuitBreaker.state === 'open') {
      // Check if enough time has passed to try again (30 seconds)
      if (this.circuitBreaker.lastFailureTime && (now - this.circuitBreaker.lastFailureTime) > 30000) {
        this.circuitBreaker.state = 'half-open';
        return true; // Allow one request
      }
      return false; // Circuit is open, block request
    }
    
    return true; // Circuit is closed or half-open, allow request
  }

  async fetchMetrics(forceRefresh = false) {
    const token = authService.getToken();
    if (!token) {
      return;
    }

    // Circuit breaker check
    if (!this.checkCircuitBreaker()) {
      return;
    }

    // Prevent concurrent requests with longer debounce
    const now = Date.now();
    if (!forceRefresh && this.lastRequestTime && (now - this.lastRequestTime) < 5000) {
      return; // Debounce requests within 5 seconds for production stability
    }

    // Only poll when page is visible unless forced
    if (!forceRefresh && !this.isPageVisible) {
      return;
    }

    this.lastRequestTime = now;
    
    try {
      const response = await fetch(`${STATS_API_BASE}/api/v1/stats/metrics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Client-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      });

      if (!response.ok) {
        // Handle rate limiting specifically
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const backoffTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000; // Default 1 minute
          
          // Exponentially increase polling interval when rate limited
          this.adaptiveInterval = Math.min(backoffTime * 2, 300000); // Max 5 minutes
          this.connectionHealth = 'poor';
          
          throw new Error(`Rate limited. Slowing down requests. Retry after ${Math.floor(backoffTime/1000)}s`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      this.metrics = data.metrics || {};
      this.error = null;
      this.retryCount = 0;
      this.consecutiveFailures = 0;
      this.connectionHealth = 'good';
      this.adaptiveInterval = this.refreshInterval; // Reset to normal interval
      
      // Reset circuit breaker on success
      this.circuitBreaker.state = 'closed';
      this.circuitBreaker.failureCount = 0;
      this.circuitBreaker.lastFailureTime = null;
      
      this.isLoading = false;
      this.notifySubscribers();

    } catch (err) {
      const newRetryCount = this.retryCount + 1;
      this.consecutiveFailures += 1;
      this.retryCount = newRetryCount;
      
      // Update circuit breaker
      this.circuitBreaker.failureCount += 1;
      this.circuitBreaker.lastFailureTime = Date.now();
      
      // Open circuit after 5 consecutive failures
      if (this.circuitBreaker.failureCount >= 5) {
        this.circuitBreaker.state = 'open';
        this.connectionHealth = 'offline';
        this.adaptiveInterval = 300000; // 5 minutes when circuit is open
      } else if (this.consecutiveFailures >= 3) {
        this.connectionHealth = 'poor';
        this.adaptiveInterval = Math.min(this.refreshInterval * 2, 120000); // Max 2 minutes
      }
      
      // Exponential backoff for retries (max 3 attempts)
      if (newRetryCount <= 3) {
        const retryDelay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 10000);
        setTimeout(() => {
          this.fetchMetrics(true);
        }, retryDelay);
      } else {
        // After max retries, show fallback data
        this.error = `Connection failed after ${newRetryCount} attempts`;
      }
      
      this.isLoading = false;
      this.notifySubscribers();
    }
  }

  startPolling() {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    
    // Initial fetch
    this.fetchMetrics();
    
    // Set up periodic refresh with adaptive interval
    this.setupPollingInterval();
  }

  setupPollingInterval() {
    // Clear any existing interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    // Set up new interval with current adaptive interval
    this.intervalId = setInterval(() => {
      this.fetchMetrics();
    }, this.adaptiveInterval);
  }

  stopPolling() {
    this.isPolling = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async invalidateCache() {
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
  }

  // Trigger immediate refresh after user actions with debouncing
  triggerImmediateRefresh() {
    // Clear any existing immediate refresh timer
    if (this.immediateRefreshTimer) {
      clearTimeout(this.immediateRefreshTimer);
    }
    
    // Debounce immediate refreshes to prevent rapid fire requests
    this.immediateRefreshTimer = setTimeout(() => {
      this.fetchMetrics(true);
    }, 100); // Small delay to batch multiple rapid triggers
  }
}

// Global singleton instance
const pollingManager = new StatsPollingManager();

/**
 * Hook for managing transaction statistics with singleton polling
 */
export const useStatsPolling = (options = {}) => {
  const { refreshInterval = 60000 } = options; // Default 60 seconds
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState({
    metrics: pollingManager.metrics,
    isLoading: true,
    error: null,
    retryCount: 0,
    connectionHealth: 'good'
  });

  useEffect(() => {
    if (!isAuthenticated || !authService.getToken()) {
      setState({
        metrics: {},
        isLoading: false,
        error: 'Authentication required',
        retryCount: 0,
        connectionHealth: 'offline'
      });
      return;
    }

    // Subscribe to the singleton manager with refresh interval
    const unsubscribe = pollingManager.subscribe((data) => {
      setState(data);
    }, refreshInterval);

    return unsubscribe;
  }, [isAuthenticated, refreshInterval]);

  // Individual metrics for convenience
  const metrics = state.metrics;
  
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
    isLoading: state.isLoading,
    error: state.error,
    retryCount: state.retryCount,
    connectionHealth: state.connectionHealth,
    
    // Actions
    invalidateCache: pollingManager.invalidateCache.bind(pollingManager),
    triggerRefresh: pollingManager.triggerImmediateRefresh.bind(pollingManager),
    fetchSpecificMetric: () => {} // Placeholder for backward compatibility
  };
};

export default useStatsPolling;