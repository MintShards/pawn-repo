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
 * Uses business timezone (Pacific Time) for consistent calculations.
 *
 * @returns {Object} Headers object with timezone information
 */
export const getTimezoneHeaders = () => {
  return {
    'X-Client-Timezone': BUSINESS_TIMEZONE
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
 * Parse a UTC date string or Date object and format it in business timezone (Pacific Time).
 * This is the PRIMARY function to use for all business date displays.
 * 
 * CRITICAL: This function prevents timezone conversion bugs by always using Pacific Time.
 * 
 * @param {string|Date} utcDateString - UTC date string from backend (with or without 'Z') or Date object
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date in Pacific Time
 */
export const formatBusinessDate = (utcDateString, options = {}) => {
  if (!utcDateString) return 'Not Set';
  
  try {
    let utcDate;
    
    // Handle both Date objects and string inputs
    if (utcDateString instanceof Date) {
      utcDate = utcDateString;
    } else {
      // Ensure proper UTC parsing by adding 'Z' if missing timezone info
      let dateString = utcDateString.trim();
      const hasTimezoneInfo = dateString.endsWith('Z') ||
                             /[+-]\d{2}:\d{2}$/.test(dateString) ||
                             /[+-]\d{4}$/.test(dateString);
      if (!hasTimezoneInfo) {
        dateString = dateString + 'Z';
      }
      utcDate = new Date(dateString);
    }
    
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
 * Format a UTC date/time string or Date object in business timezone with time included.
 * 
 * @param {string|Date} utcDateString - UTC date string from backend or Date object
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

// ============================================================================
// BUSINESS DATE RANGE FUNCTIONS FOR FILTERS
// ============================================================================
// These functions provide business timezone-aware date ranges for filter presets

/**
 * Get today's date in business timezone formatted as YYYY-MM-DD.
 * Use for date filter inputs.
 *
 * @returns {string} Today's date in YYYY-MM-DD format (business timezone)
 */
export const getBusinessToday = () => {
  const now = new Date();
  const businessDate = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);

  // Convert from MM/DD/YYYY to YYYY-MM-DD
  const [month, day, year] = businessDate.split('/');
  return `${year}-${month}-${day}`;
};

/**
 * Get yesterday's date in business timezone formatted as YYYY-MM-DD.
 *
 * @returns {string} Yesterday's date in YYYY-MM-DD format (business timezone)
 */
export const getBusinessYesterday = () => {
  const now = new Date();
  // Subtract 1 day
  now.setDate(now.getDate() - 1);

  const businessDate = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);

  const [month, day, year] = businessDate.split('/');
  return `${year}-${month}-${day}`;
};

/**
 * Get date N days ago in business timezone formatted as YYYY-MM-DD.
 *
 * @param {number} days - Number of days to subtract
 * @returns {string} Date N days ago in YYYY-MM-DD format (business timezone)
 */
export const getBusinessDaysAgo = (days) => {
  const now = new Date();
  now.setDate(now.getDate() - days);

  const businessDate = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);

  const [month, day, year] = businessDate.split('/');
  return `${year}-${month}-${day}`;
};

/**
 * Get the first day of current month in business timezone formatted as YYYY-MM-DD.
 *
 * @returns {string} First day of current month in YYYY-MM-DD format (business timezone)
 */
export const getBusinessMonthStart = () => {
  // Get current date in business timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;

  return `${year}-${month}-01`;
};

/**
 * Get the last day of current month in business timezone formatted as YYYY-MM-DD.
 *
 * @returns {string} Last day of current month in YYYY-MM-DD format (business timezone)
 */
export const getBusinessMonthEnd = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit'
  });

  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year').value);
  const month = parseInt(parts.find(p => p.type === 'month').value);

  // Get last day by going to first day of next month and subtracting 1
  const lastDay = new Date(year, month, 0).getDate();
  const monthStr = month.toString().padStart(2, '0');
  const dayStr = lastDay.toString().padStart(2, '0');

  return `${year}-${monthStr}-${dayStr}`;
};

/**
 * Get the first day of last month in business timezone formatted as YYYY-MM-DD.
 *
 * @returns {string} First day of last month in YYYY-MM-DD format (business timezone)
 */
export const getBusinessLastMonthStart = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit'
  });

  const parts = formatter.formatToParts(now);
  let year = parseInt(parts.find(p => p.type === 'year').value);
  let month = parseInt(parts.find(p => p.type === 'month').value);

  // Go back one month
  month -= 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }

  const monthStr = month.toString().padStart(2, '0');
  return `${year}-${monthStr}-01`;
};

/**
 * Get the last day of last month in business timezone formatted as YYYY-MM-DD.
 *
 * @returns {string} Last day of last month in YYYY-MM-DD format (business timezone)
 */
export const getBusinessLastMonthEnd = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit'
  });

  const parts = formatter.formatToParts(now);
  let year = parseInt(parts.find(p => p.type === 'year').value);
  let month = parseInt(parts.find(p => p.type === 'month').value);

  // Go back one month
  month -= 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }

  // Get last day of that month
  const lastDay = new Date(year, month, 0).getDate();
  const monthStr = month.toString().padStart(2, '0');
  const dayStr = lastDay.toString().padStart(2, '0');

  return `${year}-${monthStr}-${dayStr}`;
};

/**
 * Convert a YYYY-MM-DD date string to ISO string representing start of day in business timezone.
 * This ensures proper date boundaries for API queries.
 *
 * Example: "2025-10-31" → "2025-10-31T07:00:00.000Z" (Oct 31 00:00 Pacific = Oct 31 07:00 UTC during DST)
 *
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} ISO string for start of day in business timezone (UTC)
 */
export const businessDateToISOStart = (dateString) => {
  if (!dateString) return null;

  try {
    // Parse the date components
    const [year, month, day] = dateString.split('-').map(Number);

    // Calculate the offset by creating a reference date
    // Create a local date object for the target date at noon (to avoid DST ambiguity)
    const referenceLocal = new Date(year, month - 1, day, 12, 0, 0);

    // See what that date/time is in business timezone
    const referenceBusinessParts = new Intl.DateTimeFormat('en-US', {
      timeZone: BUSINESS_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(referenceLocal);

    // Extract the components
    const businessYear = parseInt(referenceBusinessParts.find(p => p.type === 'year').value);
    const businessMonth = parseInt(referenceBusinessParts.find(p => p.type === 'month').value);
    const businessDay = parseInt(referenceBusinessParts.find(p => p.type === 'day').value);
    const businessHour = parseInt(referenceBusinessParts.find(p => p.type === 'hour').value);
    const businessMinute = parseInt(referenceBusinessParts.find(p => p.type === 'minute').value);
    const businessSecond = parseInt(referenceBusinessParts.find(p => p.type === 'second').value);

    // Calculate the offset
    const referenceBusinessDate = new Date(businessYear, businessMonth - 1, businessDay, businessHour, businessMinute, businessSecond);
    const offset = referenceLocal.getTime() - referenceBusinessDate.getTime();

    // Now apply this offset to get start of day (00:00:00) in business timezone
    const targetBusinessLocal = new Date(year, month - 1, day, 0, 0, 0, 0);
    const targetUTC = new Date(targetBusinessLocal.getTime() - offset);

    return targetUTC.toISOString();
  } catch (error) {
    console.error('Error converting business date to ISO start:', error, 'Input:', dateString);
    // Fallback: assume UTC
    return new Date(`${dateString}T00:00:00Z`).toISOString();
  }
};

/**
 * Convert a YYYY-MM-DD date string to ISO string representing end of day in business timezone.
 * This ensures proper date boundaries for API queries.
 *
 * Example: "2025-10-31" → "2025-11-01T06:59:59.999Z" (Oct 31 23:59 Pacific = Nov 1 06:59 UTC during DST)
 *
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} ISO string for end of day in business timezone (UTC)
 */
export const businessDateToISOEnd = (dateString) => {
  if (!dateString) return null;

  try {
    // Parse the date components
    const [year, month, day] = dateString.split('-').map(Number);

    // Use same offset calculation as start
    const referenceLocal = new Date(year, month - 1, day, 12, 0, 0);

    const referenceBusinessParts = new Intl.DateTimeFormat('en-US', {
      timeZone: BUSINESS_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(referenceLocal);

    const businessYear = parseInt(referenceBusinessParts.find(p => p.type === 'year').value);
    const businessMonth = parseInt(referenceBusinessParts.find(p => p.type === 'month').value);
    const businessDay = parseInt(referenceBusinessParts.find(p => p.type === 'day').value);
    const businessHour = parseInt(referenceBusinessParts.find(p => p.type === 'hour').value);
    const businessMinute = parseInt(referenceBusinessParts.find(p => p.type === 'minute').value);
    const businessSecond = parseInt(referenceBusinessParts.find(p => p.type === 'second').value);

    const referenceBusinessDate = new Date(businessYear, businessMonth - 1, businessDay, businessHour, businessMinute, businessSecond);
    const offset = referenceLocal.getTime() - referenceBusinessDate.getTime();

    // Apply offset to end of day (23:59:59.999) in business timezone
    const targetBusinessLocal = new Date(year, month - 1, day, 23, 59, 59, 999);
    const targetUTC = new Date(targetBusinessLocal.getTime() - offset);

    return targetUTC.toISOString();
  } catch (error) {
    console.error('Error converting business date to ISO end:', error, 'Input:', dateString);
    // Fallback: assume UTC
    return new Date(`${dateString}T23:59:59.999Z`).toISOString();
  }
};