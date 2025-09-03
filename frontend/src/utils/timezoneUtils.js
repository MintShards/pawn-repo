/**
 * Timezone utility functions for frontend timezone detection and handling.
 * 
 * Provides automatic timezone detection from browser and utilities for
 * sending timezone information to the backend API.
 */

/**
 * Get the user's timezone from the browser.
 * 
 * @returns {string} IANA timezone identifier (e.g., "America/New_York")
 */
export const getUserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('Failed to detect timezone, using UTC:', error);
    return 'UTC';
  }
};

/**
 * Get timezone-aware headers for API requests.
 * 
 * @returns {Object} Headers object with timezone information
 */
export const getTimezoneHeaders = () => {
  return {
    'X-Client-Timezone': getUserTimezone()
  };
};

/**
 * Format a UTC datetime string for display in user's timezone.
 * 
 * @param {string} utcDateTimeString - ISO datetime string in UTC
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted datetime string in user's timezone
 */
export const formatLocalDateTime = (utcDateTimeString, options = {}) => {
  if (!utcDateTimeString) return '';
  
  try {
    const date = new Date(utcDateTimeString);
    const userTimezone = getUserTimezone();
    
    const defaultOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone: userTimezone,
      ...options
    };
    
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
  } catch (error) {
    console.warn('Failed to format datetime:', error);
    return utcDateTimeString;
  }
};

/**
 * Format a UTC date string for display in user's timezone (date only).
 * 
 * @param {string} utcDateString - ISO date string in UTC
 * @returns {string} Formatted date string in user's timezone with abbreviated months
 */
export const formatLocalDate = (utcDateString) => {
  return formatAbbreviatedDate(utcDateString);
};


/**
 * Format a UTC date string with abbreviated month names.
 * 
 * @param {string} utcDateString - ISO date string in UTC
 * @returns {string} Formatted date string with abbreviated month (e.g., "Jan. 1, 2025")
 */
export const formatAbbreviatedDate = (utcDateString) => {
  if (!utcDateString) return '';
  
  try {
    const date = new Date(utcDateString);
    const userTimezone = getUserTimezone();
    
    const months = [
      'Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.',
      'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'
    ];
    
    // Convert to user's timezone
    const localDate = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).formatToParts(date);
    
    const month = months[parseInt(localDate.find(part => part.type === 'month').value) - 1];
    const day = parseInt(localDate.find(part => part.type === 'day').value);
    const year = localDate.find(part => part.type === 'year').value;
    
    return `${month} ${day}, ${year}`;
  } catch (error) {
    console.warn('Failed to format abbreviated date:', error);
    return utcDateString;
  }
};

/**
 * Get current date/time in user's timezone.
 * 
 * @returns {Date} Current date in user's timezone
 */
export const getUserNow = () => {
  return new Date();
};

/**
 * Convert a local date/time to UTC for API submission.
 * 
 * @param {Date|string} localDateTime - Local date/time
 * @returns {string} ISO string in UTC
 */
export const localToUTC = (localDateTime) => {
  try {
    const date = localDateTime instanceof Date ? localDateTime : new Date(localDateTime);
    return date.toISOString();
  } catch (error) {
    console.warn('Failed to convert to UTC:', error);
    return new Date().toISOString();
  }
};

/**
 * Enhanced API fetch with automatic timezone headers.
 * 
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise} Fetch promise with timezone headers included
 */
export const fetchWithTimezone = (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...getTimezoneHeaders(),
    ...(options.headers || {})
  };
  
  return fetch(url, {
    ...options,
    headers
  });
};

/**
 * Get timezone information for debugging and display.
 * 
 * @returns {Object} Timezone information object
 */
export const getTimezoneInfo = () => {
  const timezone = getUserTimezone();
  const now = new Date();
  
  return {
    timezone,
    offset: now.getTimezoneOffset(),
    offsetHours: now.getTimezoneOffset() / -60,
    localTime: now.toLocaleString(),
    utcTime: now.toISOString(),
    isDST: isDaylightSavingTime(now)
  };
};

/**
 * Check if a date is in daylight saving time.
 * 
 * @param {Date} date - Date to check
 * @returns {boolean} True if in DST
 */
const isDaylightSavingTime = (date) => {
  const january = new Date(date.getFullYear(), 0, 1);
  const july = new Date(date.getFullYear(), 6, 1);
  return Math.max(january.getTimezoneOffset(), july.getTimezoneOffset()) !== date.getTimezoneOffset();
};