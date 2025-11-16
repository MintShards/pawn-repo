/**
 * Trends API Service
 *
 * Handles API calls for revenue and loan trend analytics
 */

import authService from './authService';
import { getTimezoneHeaders } from '../utils/timezoneUtils';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Get revenue trends for specified period or custom date range
 *
 * @param {string|null} period - Time period: '7d', '30d', '90d', '1y' (optional if dates provided)
 * @param {AbortSignal} signal - AbortController signal for request cancellation
 * @param {Date} startDate - Custom start date (optional)
 * @param {Date} endDate - Custom end date (optional)
 * @returns {Promise<Object>} Revenue trends data
 */
export const getRevenueTrends = async (period = '30d', signal = null, startDate = null, endDate = null) => {
  try {
    // Build query parameters
    const params = new URLSearchParams();

    if (startDate && endDate) {
      // Custom date range
      params.append('start_date', startDate.toISOString());
      params.append('end_date', endDate.toISOString());
    } else if (period) {
      // Preset period
      params.append('period', period);
    } else {
      throw new Error('Either period or both startDate and endDate must be provided');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/v1/trends/revenue?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken()}`,
          ...getTimezoneHeaders()
        },
        signal // Pass AbortSignal to fetch
      }
    );

    if (!response.ok) {
      // Try to refresh token if unauthorized
      if (response.status === 401) {
        const refreshed = await authService.refreshAccessToken();
        if (refreshed) {
          // Retry request with new token
          return getRevenueTrends(period, signal, startDate, endDate);
        }
      }

      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch revenue trends');
    }

    return await response.json();
  } catch (error) {
    // Don't log or re-throw AbortError - it's expected behavior
    if (error.name === 'AbortError') {
      throw error;
    }
    console.error('Error fetching revenue trends:', error);
    throw error;
  }
};

/**
 * Get loan trends for specified period or custom date range
 *
 * @param {string|null} period - Time period: '7d', '30d', '90d', '1y' (optional if dates provided)
 * @param {AbortSignal} signal - AbortController signal for request cancellation
 * @param {Date} startDate - Custom start date (optional)
 * @param {Date} endDate - Custom end date (optional)
 * @returns {Promise<Object>} Loan trends data
 */
export const getLoanTrends = async (period = '30d', signal = null, startDate = null, endDate = null) => {
  try {
    // Build query parameters
    const params = new URLSearchParams();

    if (startDate && endDate) {
      // Custom date range
      params.append('start_date', startDate.toISOString());
      params.append('end_date', endDate.toISOString());
    } else if (period) {
      // Preset period
      params.append('period', period);
    } else {
      throw new Error('Either period or both startDate and endDate must be provided');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/v1/trends/loans?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken()}`,
          ...getTimezoneHeaders()
        },
        signal // Pass AbortSignal to fetch
      }
    );

    if (!response.ok) {
      // Try to refresh token if unauthorized
      if (response.status === 401) {
        const refreshed = await authService.refreshAccessToken();
        if (refreshed) {
          // Retry request with new token
          return getLoanTrends(period, signal, startDate, endDate);
        }
      }

      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch loan trends');
    }

    return await response.json();
  } catch (error) {
    // Don't log or re-throw AbortError - it's expected behavior
    if (error.name === 'AbortError') {
      throw error;
    }
    console.error('Error fetching loan trends:', error);
    throw error;
  }
};

/**
 * Get both revenue and loan trends
 *
 * @param {string|null} period - Time period: '7d', '30d', '90d', '1y' (optional if dates provided)
 * @param {AbortSignal} signal - AbortController signal for request cancellation
 * @param {Date} startDate - Custom start date (optional)
 * @param {Date} endDate - Custom end date (optional)
 * @returns {Promise<Object>} Combined trends data
 */
export const getAllTrends = async (period = '30d', signal = null, startDate = null, endDate = null) => {
  try {
    const [revenueTrends, loanTrends] = await Promise.all([
      getRevenueTrends(period, signal, startDate, endDate),
      getLoanTrends(period, signal, startDate, endDate)
    ]);

    return {
      revenue: revenueTrends,
      loans: loanTrends,
      period: period || 'custom'
    };
  } catch (error) {
    // Don't log AbortError - it's expected behavior
    if (error.name === 'AbortError') {
      throw error;
    }
    console.error('Error fetching all trends:', error);
    throw error;
  }
};

const trendsService = {
  getRevenueTrends,
  getLoanTrends,
  getAllTrends
};

export default trendsService;
