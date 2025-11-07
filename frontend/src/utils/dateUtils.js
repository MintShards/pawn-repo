import { formatDistanceToNow, format, parseISO, isValid } from "date-fns";

/**
 * Date Utilities
 * Centralized date formatting functions using date-fns library
 */

/**
 * Format current date in a human-readable format
 * Example: "Friday, November 7, 2025"
 * @param {string|null} timezone - IANA timezone string (e.g., 'America/Vancouver')
 */
export const formatCurrentDate = (timezone = null) => {
  const now = new Date();

  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(timezone && { timeZone: timezone }),
  };

  return now.toLocaleDateString("en-US", options);
};

/**
 * Format timestamp as relative time (e.g., "5 minutes ago", "2 hours ago", "3 days ago")
 * @param {string|Date} timestamp - ISO date string or Date object
 * @returns {string} Formatted relative time
 */
export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "Unknown";

  try {
    const date =
      typeof timestamp === "string" ? parseISO(timestamp) : timestamp;

    if (!isValid(date)) {
      return "Invalid date";
    }

    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.warn("Error formatting relative time:", error);
    return "Unknown";
  }
};

/**
 * Format date as short date string (e.g., "Jan 15, 2025")
 * @param {string|Date} timestamp - ISO date string or Date object
 * @returns {string} Formatted date string
 */
export const formatShortDate = (timestamp) => {
  if (!timestamp) return "Unknown";

  try {
    const date =
      typeof timestamp === "string" ? parseISO(timestamp) : timestamp;

    if (!isValid(date)) {
      return "Invalid date";
    }

    return format(date, "MMM d, yyyy");
  } catch (error) {
    console.warn("Error formatting short date:", error);
    return "Unknown";
  }
};

/**
 * Format date as long date string (e.g., "January 15, 2025")
 * @param {string|Date} timestamp - ISO date string or Date object
 * @returns {string} Formatted date string
 */
export const formatLongDate = (timestamp) => {
  if (!timestamp) return "Unknown";

  try {
    const date =
      typeof timestamp === "string" ? parseISO(timestamp) : timestamp;

    if (!isValid(date)) {
      return "Invalid date";
    }

    return format(date, "MMMM d, yyyy");
  } catch (error) {
    console.warn("Error formatting long date:", error);
    return "Unknown";
  }
};

/**
 * Format date with time (e.g., "Jan 15, 2025 at 2:30 PM")
 * @param {string|Date} timestamp - ISO date string or Date object
 * @returns {string} Formatted date and time string
 */
export const formatDateTime = (timestamp) => {
  if (!timestamp) return "Unknown";

  try {
    const date =
      typeof timestamp === "string" ? parseISO(timestamp) : timestamp;

    if (!isValid(date)) {
      return "Invalid date";
    }

    return format(date, "MMM d, yyyy 'at' h:mm a");
  } catch (error) {
    console.warn("Error formatting date time:", error);
    return "Unknown";
  }
};

/**
 * Check if a date is today
 * @param {string|Date} timestamp - ISO date string or Date object
 * @returns {boolean} True if date is today
 */
export const isToday = (timestamp) => {
  if (!timestamp) return false;

  try {
    const date =
      typeof timestamp === "string" ? parseISO(timestamp) : timestamp;
    const today = new Date();

    return date.toDateString() === today.toDateString();
  } catch (error) {
    return false;
  }
};

/**
 * Format date as ISO string for API requests
 * @param {Date} date - Date object
 * @returns {string} ISO date string
 */
export const toISOString = (date) => {
  if (!date || !isValid(date)) {
    return new Date().toISOString();
  }
  return date.toISOString();
};
