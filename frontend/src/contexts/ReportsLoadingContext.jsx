import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

/**
 * Coordinated Loading Context for Reports Page
 *
 * Purpose: Ensure all report components load and display simultaneously
 * to prevent jarring one-by-one loading experience
 *
 * Strategy:
 * 1. Each component registers when it starts loading
 * 2. Each component reports when its data is ready
 * 3. All components stay in loading state until ALL are ready
 * 4. All components display data simultaneously
 */

const ReportsLoadingContext = createContext(null);

/**
 * Component registration status
 */
const REPORT_COMPONENTS = {
  REVENUE_TRENDS: 'revenue_trends',
  COLLECTIONS: 'collections',
  TOP_PERFORMERS: 'top_performers',
  INVENTORY: 'inventory',
};

export const ReportsLoadingProvider = ({ children }) => {
  // Track loading status for each component
  const [componentStatus, setComponentStatus] = useState({
    [REPORT_COMPONENTS.REVENUE_TRENDS]: { loading: true, ready: false },
    [REPORT_COMPONENTS.COLLECTIONS]: { loading: true, ready: false },
    [REPORT_COMPONENTS.TOP_PERFORMERS]: { loading: true, ready: false },
    [REPORT_COMPONENTS.INVENTORY]: { loading: true, ready: false },
  });

  // Global loading state - true until ALL components are ready
  const [globalLoading, setGlobalLoading] = useState(true);

  /**
   * Check if all components are ready
   */
  useEffect(() => {
    const allReady = Object.values(componentStatus).every(status => status.ready);

    if (allReady && globalLoading) {
      // Small delay for smooth transition
      const timer = setTimeout(() => {
        setGlobalLoading(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [componentStatus, globalLoading]);

  /**
   * Register component as loading
   */
  const registerComponent = useCallback((componentId) => {
    setComponentStatus(prev => ({
      ...prev,
      [componentId]: { loading: true, ready: false }
    }));
  }, []);

  /**
   * Mark component as ready (data loaded successfully)
   */
  const markComponentReady = useCallback((componentId) => {
    setComponentStatus(prev => ({
      ...prev,
      [componentId]: { loading: false, ready: true }
    }));
  }, []);

  /**
   * Mark component as failed (show skeleton but don't block others)
   */
  const markComponentFailed = useCallback((componentId) => {
    setComponentStatus(prev => ({
      ...prev,
      [componentId]: { loading: false, ready: true } // Treat as "ready" to not block others
    }));
  }, []);

  /**
   * Reset all components (for page refresh)
   */
  const resetAll = useCallback(() => {
    setComponentStatus({
      [REPORT_COMPONENTS.REVENUE_TRENDS]: { loading: true, ready: false },
      [REPORT_COMPONENTS.COLLECTIONS]: { loading: true, ready: false },
      [REPORT_COMPONENTS.TOP_PERFORMERS]: { loading: true, ready: false },
      [REPORT_COMPONENTS.INVENTORY]: { loading: true, ready: false },
    });
    setGlobalLoading(true);
  }, []);

  /**
   * Get loading state for specific component
   * Returns true until global loading is complete
   */
  const isComponentLoading = useCallback((componentId) => {
    return globalLoading || componentStatus[componentId]?.loading;
  }, [globalLoading, componentStatus]);

  const value = {
    // Component IDs
    COMPONENTS: REPORT_COMPONENTS,

    // Global state
    globalLoading,
    componentStatus,

    // Actions
    registerComponent,
    markComponentReady,
    markComponentFailed,
    resetAll,
    isComponentLoading,
  };

  return (
    <ReportsLoadingContext.Provider value={value}>
      {children}
    </ReportsLoadingContext.Provider>
  );
};

/**
 * Hook to use coordinated loading
 */
export const useReportsLoading = () => {
  const context = useContext(ReportsLoadingContext);

  if (!context) {
    throw new Error('useReportsLoading must be used within ReportsLoadingProvider');
  }

  return context;
};

/**
 * Hook for individual components to manage their loading state
 *
 * @param {string} componentId - Component identifier from REPORT_COMPONENTS
 * @returns {Object} Loading state and control functions
 */
export const useComponentLoading = (componentId) => {
  const {
    isComponentLoading,
    markComponentReady,
    markComponentFailed
  } = useReportsLoading();

  // Components are pre-registered in provider initial state
  // No need to register on mount

  return {
    // Should show loading skeleton
    showLoading: isComponentLoading(componentId),

    // Call when data is ready
    setReady: useCallback(() => {
      markComponentReady(componentId);
    }, [componentId, markComponentReady]),

    // Call if data fetch fails
    setFailed: useCallback(() => {
      markComponentFailed(componentId);
    }, [componentId, markComponentFailed]),
  };
};
