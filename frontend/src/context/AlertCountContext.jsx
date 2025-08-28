import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import serviceAlertService from '../services/serviceAlertService';

const AlertCountContext = createContext({});

export const useAlertCount = () => {
  const context = useContext(AlertCountContext);
  if (!context) {
    throw new Error('useAlertCount must be used within an AlertCountProvider');
  }
  return context;
};

export const AlertCountProvider = ({ children }) => {
  const [alertCounts, setAlertCounts] = useState(new Map());
  const [loading, setLoading] = useState(new Set());
  const batchTimeout = useRef(null);
  const pendingRequests = useRef(new Set());
  const refreshTimeouts = useRef(new Map()); // Track refresh debouncing per customer
  const activeRequests = useRef(new Map()); // Track ongoing requests for deduplication

  // Batch fetch alert counts for multiple customers
  const batchFetchAlertCounts = useCallback(async (customerPhones) => {
    try {
      setLoading(prev => {
        const newSet = new Set(prev);
        customerPhones.forEach(phone => newSet.add(phone));
        return newSet;
      });

      const results = await serviceAlertService.getBatchAlertCounts(customerPhones);
      
      setAlertCounts(prev => {
        const newMap = new Map(prev);
        Object.entries(results).forEach(([phone, data]) => {
          newMap.set(phone, data.active_count || 0);
        });
        return newMap;
      });

      setLoading(prev => {
        const newSet = new Set(prev);
        customerPhones.forEach(phone => newSet.delete(phone));
        return newSet;
      });

      return results;
    } catch (error) {
      // Set counts to 0 on error
      setAlertCounts(prev => {
        const newMap = new Map(prev);
        customerPhones.forEach(phone => newMap.set(phone, 0));
        return newMap;
      });
      
      setLoading(prev => {
        const newSet = new Set(prev);
        customerPhones.forEach(phone => newSet.delete(phone));
        return newSet;
      });
      
      throw error;
    }
  }, []);

  // Stable alert count getter - removed dependencies to prevent excessive re-renders
  const getAlertCount = useCallback((customerPhone) => {
    if (!customerPhone) return 0;
    
    // Return cached value if available (read current value directly)
    const cachedCount = alertCounts.get(customerPhone);
    if (cachedCount !== undefined) {
      return cachedCount;
    }
    
    // Add to pending batch only if not already pending
    if (!pendingRequests.current.has(customerPhone)) {
      pendingRequests.current.add(customerPhone);
    }

    // Clear existing timeout for new batch
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }

    // Optimized batching with longer window for better API efficiency
    batchTimeout.current = setTimeout(async () => {
      const phonesToFetch = Array.from(pendingRequests.current);
      pendingRequests.current.clear();
      
      if (phonesToFetch.length > 0) {
        await batchFetchAlertCounts(phonesToFetch);
      }
    }, 1000); // 1000ms for better batching efficiency (target: 5+ requests per batch)

    return 0; // Return 0 for new customers while loading
  }, [batchFetchAlertCounts]); // Only depend on stable batchFetchAlertCounts

  // Optimized debounced refresh with request deduplication
  const refreshAlertCount = useCallback(async (customerPhone) => {
    if (!customerPhone) return;
    
    // Check if request is already active
    if (activeRequests.current.has(customerPhone)) {
      return activeRequests.current.get(customerPhone);
    }
    
    // Clear existing timeout for this customer to prevent race conditions
    if (refreshTimeouts.current.has(customerPhone)) {
      clearTimeout(refreshTimeouts.current.get(customerPhone));
      refreshTimeouts.current.delete(customerPhone);
    }
    
    // Create the request promise for deduplication
    const requestPromise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(async () => {
        try {
          await batchFetchAlertCounts([customerPhone]);
          refreshTimeouts.current.delete(customerPhone);
          activeRequests.current.delete(customerPhone);
          resolve();
        } catch (error) {
          refreshTimeouts.current.delete(customerPhone);
          activeRequests.current.delete(customerPhone);
          reject(error);
        }
      }, 800); // Optimized debounce window
      
      refreshTimeouts.current.set(customerPhone, timeoutId);
    });
    
    activeRequests.current.set(customerPhone, requestPromise);
    return requestPromise;
  }, [batchFetchAlertCounts]);

  // Refresh all alert counts
  const refreshAllAlertCounts = useCallback(async () => {
    const allPhones = Array.from(alertCounts.keys());
    if (allPhones.length > 0) {
      await batchFetchAlertCounts(allPhones);
    }
  }, [batchFetchAlertCounts]); // Remove alertCounts dependency to stabilize

  // Initialize alert counts for a list of customers
  const initializeAlertCounts = useCallback(async (customerPhones) => {
    // Only fetch for customers we don't have cached data for
    const phonesToFetch = customerPhones.filter(phone => 
      !alertCounts.has(phone) && !loading.has(phone)
    );
    
    if (phonesToFetch.length > 0) {
      await batchFetchAlertCounts(phonesToFetch);
    }
  }, [batchFetchAlertCounts]); // Remove alertCounts/loading deps to stabilize

  // Cleanup function for performance monitoring
  const cleanup = useCallback(() => {
    // Clear all timeouts
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }
    
    refreshTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
    refreshTimeouts.current.clear();
    
    // Clear active requests
    activeRequests.current.clear();
    pendingRequests.current.clear();
  }, []);
  
  // Context value with optimized memoization
  const value = useMemo(() => ({
    alertCounts,
    loading,
    getAlertCount,
    refreshAlertCount,
    refreshAllAlertCounts,
    initializeAlertCounts,
    batchFetchAlertCounts,
    cleanup
  }), [alertCounts, loading, getAlertCount, refreshAlertCount, refreshAllAlertCounts, initializeAlertCounts, batchFetchAlertCounts, cleanup]);

  return (
    <AlertCountContext.Provider value={value}>
      {children}
    </AlertCountContext.Provider>
  );
};