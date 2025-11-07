/**
 * Logger Utility
 * Centralized logging with environment-aware behavior
 * Replaces direct console.error/warn/log calls
 */

const LOG_LEVELS = {
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  DEBUG: "debug",
};

// Configuration
const config = {
  enableConsole: process.env.NODE_ENV !== "production",
  enableRemoteLogging: process.env.REACT_APP_ENABLE_REMOTE_LOGGING === "true",
  remoteEndpoint: process.env.REACT_APP_LOG_ENDPOINT || null,
};

/**
 * Format log message with timestamp and context
 */
const formatLogMessage = (level, message, context = {}) => {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    userAgent: navigator.userAgent,
    url: window.location.href,
  };
};

/**
 * Send log to remote service (if configured)
 */
const sendToRemote = async (logEntry) => {
  if (!config.enableRemoteLogging || !config.remoteEndpoint) {
    return;
  }

  try {
    await fetch(config.remoteEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logEntry),
      // Don't block on logging
      keepalive: true,
    });
  } catch (error) {
    // Silently fail - don't want logging to break the app
  }
};

/**
 * Log error with context
 * @param {string} message - Error message
 * @param {object} context - Additional context (error object, user data, etc.)
 */
export const logError = (message, context = {}) => {
  const logEntry = formatLogMessage(LOG_LEVELS.ERROR, message, context);

  // Console output in development
  if (config.enableConsole) {
    console.error(`[ERROR] ${message}`, context);
  }

  // Send to remote logging service
  sendToRemote(logEntry);
};

/**
 * Log warning with context
 * @param {string} message - Warning message
 * @param {object} context - Additional context
 */
export const logWarning = (message, context = {}) => {
  if (config.enableConsole) {
    console.warn(`[WARN] ${message}`, context);
  }

  const logEntry = formatLogMessage(LOG_LEVELS.WARN, message, context);
  sendToRemote(logEntry);
};

/**
 * Log info message
 * @param {string} message - Info message
 * @param {object} context - Additional context
 */
export const logInfo = (message, context = {}) => {
  if (config.enableConsole) {
    console.info(`[INFO] ${message}`, context);
  }

  // Don't send info logs remotely by default (too verbose)
  // const logEntry = formatLogMessage(LOG_LEVELS.INFO, message, context);
  // sendToRemote(logEntry);
};

/**
 * Log debug message (development only)
 * @param {string} message - Debug message
 * @param {object} context - Additional context
 */
export const logDebug = (message, context = {}) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[DEBUG] ${message}`, context);
  }
};

/**
 * Log API error with structured data
 * @param {string} endpoint - API endpoint that failed
 * @param {object} error - Error object from API call
 * @param {object} requestData - Request data sent to API (optional)
 */
export const logApiError = (endpoint, error, requestData = null) => {
  const context = {
    endpoint,
    status: error.status || error.response?.status,
    statusText: error.statusText || error.response?.statusText,
    errorData: error.response?.data || error.message,
    requestData: requestData
      ? JSON.stringify(requestData).substring(0, 500)
      : null, // Limit size
  };

  logError(`API Error: ${endpoint}`, context);
};

/**
 * Silent error logging (no console output, only remote)
 * Use for expected errors that don't need debugging output
 */
export const logSilentError = (message, context = {}) => {
  const logEntry = formatLogMessage(LOG_LEVELS.ERROR, message, context);
  sendToRemote(logEntry);
};

const logger = {
  error: logError,
  warn: logWarning,
  info: logInfo,
  debug: logDebug,
  apiError: logApiError,
  silent: logSilentError,
};

export default logger;
