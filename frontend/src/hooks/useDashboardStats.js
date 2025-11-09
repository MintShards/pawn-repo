import { useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import { getTimezoneHeaders } from '../utils/timezoneUtils';
import { API_CONFIG, POLLING_INTERVALS } from '../config/api';

const API_BASE = API_CONFIG.BASE_URL;

export const useDashboardStats = () => {
  const [metrics, setMetrics] = useState({
    active_loans: { value: 0, loading: true },
    this_month_revenue: { value: 0, loading: true },
    new_customers_this_month: { value: 0, loading: true },
    went_overdue_this_week: { value: 0, loading: true },
    overdue_loans: { value: 0, loading: true },
    service_alerts: { value: 0, loading: true }
  });
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Track initial load only
  const [error, setError] = useState(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const token = authService.getToken();
      if (!token) {
        setError('Not authenticated');
        setIsInitialLoad(false);
        return;
      }

      const response = await fetch(`${API_BASE}/api/v1/stats/metrics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...getTimezoneHeaders()
        }
      });

      if (response.ok) {
        const data = await response.json();
        const updatedMetrics = {};

        // Map API response to component state
        Object.keys(data.metrics).forEach((key) => {
          const metric = data.metrics[key];
          updatedMetrics[key] = {
            value: metric.value,
            display_value: metric.display_value,
            context_message: metric.context_message,
            trend_direction: metric.trend_direction,
            trend_percentage: metric.trend_percentage,
            loading: false
          };
        });

        // Update metrics silently (no loading state on refresh)
        setMetrics(updatedMetrics);
        setIsInitialLoad(false); // Clear initial load flag after first success
        setError(null);
      } else {
        throw new Error('Failed to fetch metrics');
      }
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError(err.message);

      // Set default values on error
      const defaultMetrics = {};
      Object.keys(metrics).forEach((key) => {
        defaultMetrics[key] = {
          value: 0,
          display_value: '0',
          context_message: 'Unable to load',
          loading: false
        };
      });
      setMetrics(defaultMetrics);
      setIsInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();

    // Poll for updates (silent background updates)
    const interval = setInterval(fetchMetrics, POLLING_INTERVALS.STATS);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return { metrics, isInitialLoad, error, refetch: fetchMetrics };
};
