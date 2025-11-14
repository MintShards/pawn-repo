/**
 * Trends API Service
 *
 * Handles API calls for revenue and loan trend analytics
 */

import authService from './authService';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Get revenue trends for specified period
 *
 * @param {string} period - Time period: '7d', '30d', '90d', '1y'
 * @returns {Promise<Object>} Revenue trends data
 */
export const getRevenueTrends = async (period = '30d') => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/trends/revenue?period=${period}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken()}`,
          'X-Client-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      }
    );

    if (!response.ok) {
      // Try to refresh token if unauthorized
      if (response.status === 401) {
        const refreshed = await authService.refreshAccessToken();
        if (refreshed) {
          // Retry request with new token
          return getRevenueTrends(period);
        }
      }

      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch revenue trends');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching revenue trends:', error);
    throw error;
  }
};

/**
 * Get loan trends for specified period
 *
 * @param {string} period - Time period: '7d', '30d', '90d', '1y'
 * @returns {Promise<Object>} Loan trends data
 */
export const getLoanTrends = async (period = '30d') => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/trends/loans?period=${period}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken()}`,
          'X-Client-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      }
    );

    if (!response.ok) {
      // Try to refresh token if unauthorized
      if (response.status === 401) {
        const refreshed = await authService.refreshAccessToken();
        if (refreshed) {
          // Retry request with new token
          return getLoanTrends(period);
        }
      }

      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch loan trends');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching loan trends:', error);
    throw error;
  }
};

/**
 * Get both revenue and loan trends
 *
 * @param {string} period - Time period: '7d', '30d', '90d', '1y'
 * @returns {Promise<Object>} Combined trends data
 */
export const getAllTrends = async (period = '30d') => {
  try {
    const [revenueTrends, loanTrends] = await Promise.all([
      getRevenueTrends(period),
      getLoanTrends(period)
    ]);

    return {
      revenue: revenueTrends,
      loans: loanTrends,
      period
    };
  } catch (error) {
    console.error('Error fetching all trends:', error);
    throw error;
  }
};

export default {
  getRevenueTrends,
  getLoanTrends,
  getAllTrends
};
