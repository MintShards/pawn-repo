/**
 * Timezone utility functions for frontend timezone detection and handling.
 * 
 * Provides automatic timezone detection from browser and utilities for
 * sending timezone information to the backend API.
 * 
 * IMPORTANT: Business operates in Pacific Time (America/Vancouver).
 * Use business timezone functions for consistent date display.
 */

// Business timezone configuration
const BUSINESS_TIMEZONE = 'America/Vancouver';

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

// ============================================================================
// BUSINESS TIMEZONE FUNCTIONS
// ============================================================================
// These functions ensure consistent date handling in Pacific Time (business timezone)
// Always use these for transaction dates, redemption dates, and business operations

/**
 * Parse a UTC date string and format it in business timezone (Pacific Time).
 * This is the PRIMARY function to use for all business date displays.
 * 
 * CRITICAL: This function prevents timezone conversion bugs by always using Pacific Time.
 * 
 * @param {string} utcDateString - UTC date string from backend (with or without 'Z')
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date in Pacific Time
 */
export const formatBusinessDate = (utcDateString, options = {}) => {
  if (!utcDateString) return 'Not Set';
  
  try {
    // Ensure proper UTC parsing by adding 'Z' if missing
    let dateString = utcDateString;
    if (!dateString.endsWith('Z') && !dateString.includes('+') && !dateString.includes('-')) {
      dateString = dateString + 'Z';
    }
    
    const utcDate = new Date(dateString);
    
    // Validate the date
    if (isNaN(utcDate.getTime())) {
      console.warn('Invalid date string:', utcDateString);
      return 'Invalid Date';
    }
    
    const defaultOptions = {
      timeZone: BUSINESS_TIMEZONE,
      month: 'short',
      day: 'numeric', 
      year: 'numeric',
      ...options
    };
    
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(utcDate);
  } catch (error) {
    console.error('Error formatting business date:', error, 'Input:', utcDateString);
    return 'Invalid Date';
  }
};

/**
 * Format a UTC date/time string in business timezone with time included.
 * 
 * @param {string} utcDateString - UTC date string from backend
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date/time in Pacific Time
 */
export const formatBusinessDateTime = (utcDateString, options = {}) => {
  const defaultOptions = {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
    ...options
  };
  
  return formatBusinessDate(utcDateString, defaultOptions);
};

/**
 * Parse UTC timestamp and return a Date object adjusted for business timezone display.
 * Use this when you need the Date object rather than formatted string.
 * 
 * @param {string} utcDateString - UTC date string from backend
 * @returns {Date} Date object (still in UTC but represents business timezone moment)
 */
export const parseBusinessDate = (utcDateString) => {
  if (!utcDateString) return null;
  
  try {
    // Ensure proper UTC parsing
    let dateString = utcDateString;
    if (!dateString.endsWith('Z') && !dateString.includes('+') && !dateString.includes('-')) {
      dateString = dateString + 'Z';
    }
    
    return new Date(dateString);
  } catch (error) {
    console.error('Error parsing business date:', error, 'Input:', utcDateString);
    return null;
  }
};

/**
 * Get current date/time in business timezone.
 * 
 * @returns {string} Current date/time formatted in Pacific Time
 */
export const getBusinessNow = () => {
  return formatBusinessDateTime(new Date().toISOString());
};

/**
 * Legacy function compatibility - redirects to business timezone formatting.
 * This ensures existing code automatically uses Pacific Time.
 * 
 * @deprecated Use formatBusinessDate() for new code
 * @param {string} utcDateString - UTC date string
 * @returns {string} Formatted date in Pacific Time
 */
export const formatTransactionDate = (utcDateString) => {
  return formatBusinessDate(utcDateString);
};

/**
 * BULLETPROOF redemption date formatter that can't be affected by other code.
 * This completely independent function prevents any timezone conversion bugs.
 * 
 * @param {string} utcDateString - UTC date string from redemption
 * @returns {string} Formatted redemption date in Pacific Time
 */
export const formatRedemptionDate = (utcDateString) => {
  if (!utcDateString) {
    return 'Not Set';
  }

  try {
    // CRITICAL FIX: Always add 'Z' for UTC parsing unless it has explicit timezone
    let cleanDateString = utcDateString.trim();
    
    // Check if it already has timezone info (Z, +XX:XX, -XX:XX format)
    const hasTimezoneInfo = cleanDateString.endsWith('Z') || 
                           /[+-]\d{2}:\d{2}$/.test(cleanDateString) ||
                           /[+-]\d{4}$/.test(cleanDateString);
    
    if (!hasTimezoneInfo) {
      cleanDateString = cleanDateString + 'Z';
    }
    
    // Parse as UTC date
    const utcDate = new Date(cleanDateString);
    
    if (isNaN(utcDate.getTime())) {
      console.error('Invalid redemption date:', utcDateString);
      return 'Invalid Date';
    }
    
    // BULLETPROOF: Direct formatting in Pacific timezone
    const pacificFormatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Vancouver',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(utcDate);
    
    return pacificFormatted;
    
  } catch (error) {
    console.error('Error formatting redemption date:', error, 'Input:', utcDateString);
    return 'Error';
  }
};

// ============================================================================
// BUSINESS DAY VALIDATION FUNCTIONS
// ============================================================================
// These functions handle business day logic for cancel button auto-hide functionality

/**
 * Check if a given UTC date/time is within the same business day as today.
 * Uses business timezone (Pacific Time) for consistent day boundary calculation.
 * 
 * @param {string} utcDateString - UTC date string from backend
 * @returns {boolean} True if same business day, false if different day or invalid
 */
export const isSameBusinessDay = (utcDateString) => {
  if (!utcDateString) {
    return false;
  }

  try {
    // Parse the event date
    const eventDate = parseBusinessDate(utcDateString);
    if (!eventDate) {
      return false;
    }

    // Get current date in business timezone
    const now = new Date();
    
    // Format both dates as business dates (Pacific Time) and compare
    const eventBusinessDate = formatBusinessDate(utcDateString, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const currentBusinessDate = formatBusinessDate(now.toISOString(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    // Compare date strings (YYYY-MM-DD format)
    const isSameDay = eventBusinessDate === currentBusinessDate;
    
    // Debug logging for development
    if (process.env.NODE_ENV === 'development') {
      console.log('Business day check:', {
        eventDate: utcDateString,
        eventBusinessDate,
        currentBusinessDate,
        isSameDay,
        timezone: BUSINESS_TIMEZONE
      });
    }
    
    return isSameDay;
    
  } catch (error) {
    console.error('Error checking business day:', error, 'Input:', utcDateString);
    return false; // Err on side of caution - hide cancel button
  }
};

/**
 * Check if a payment can be reversed (same business day only).
 * 
 * @param {string} paymentDateString - UTC payment date string
 * @returns {boolean} True if payment can be reversed
 */
export const canReversePayment = (paymentDateString) => {
  return isSameBusinessDay(paymentDateString);
};

/**
 * Check if an extension can be cancelled (same business day only).
 * 
 * @param {string} extensionDateString - UTC extension date string
 * @returns {boolean} True if extension can be cancelled
 */
export const canCancelExtension = (extensionDateString) => {
  return isSameBusinessDay(extensionDateString);
};