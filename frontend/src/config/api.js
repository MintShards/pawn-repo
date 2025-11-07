/**
 * Centralized API Configuration
 * Single source of truth for API base URL and polling intervals
 */

export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || "http://localhost:8000",
};

/**
 * Polling interval constants (in milliseconds)
 */
export const POLLING_INTERVALS = {
  STATS: 30000, // Dashboard stats - 30 seconds
  ALERTS: 60000, // Service alerts - 60 seconds
  HEALTH: 60000, // System health check - 60 seconds
  ACTIVITY: 120000, // Recent activity - 120 seconds (optional, for future use)
};

export default API_CONFIG;
