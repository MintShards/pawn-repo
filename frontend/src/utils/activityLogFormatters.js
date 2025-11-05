/**
 * Activity Log Formatting Utilities
 *
 * Shared utilities for formatting activity logs across admin audit logs
 * and user-specific activity logs with consistent user-friendly display.
 */

// Activity Type Human-Readable Labels
export const ACTIVITY_TYPE_LABELS = {
  // Authentication
  'login_success': 'Successful Login',
  'login_failed': 'Failed Login Attempt',
  'logout': 'Logout',
  'session_expired': 'Session Expired',
  'token_refreshed': 'Token Refreshed',
  'account_locked': 'Account Locked',
  'account_unlocked': 'Account Unlocked',

  // User Management
  'user_created': 'User Created',
  'user_updated': 'User Profile Updated',
  'user_deleted': 'User Deleted',
  'status_changed': 'Account Status Changed',
  'role_changed': 'User Role Changed',
  'pin_reset': 'PIN Reset',
  'pin_changed': 'PIN Changed',

  // Session Management
  'session_created': 'Session Created',
  'session_revoked': 'Session Revoked',
  'concurrent_session_limit': 'Concurrent Session Limit Reached',

  // Customer Operations
  'customer_created': 'Customer Created',
  'customer_viewed': 'Customer Viewed',
  'customer_updated': 'Customer Updated',
  'customer_deleted': 'Customer Deleted',

  // Transaction Operations
  'transaction_created': 'Transaction Created',
  'transaction_viewed': 'Transaction Viewed',
  'transaction_updated': 'Transaction Updated',
  'transaction_status_changed': 'Transaction Status Changed',
  'transaction_voided': 'Transaction Voided',

  // Payment Operations
  'payment_processed': 'Payment Received',
  'payment_reversed': 'Payment Refunded',
  'extension_applied': 'Loan Extended',
  'extension_cancelled': 'Extension Cancelled',

  // System Actions
  'bulk_operation': 'Bulk Operation',
  'report_generated': 'Report Generated',
  'settings_changed': 'Business Settings Changed',

  // Security Events
  'unauthorized_access': 'Unauthorized Access Attempt',
  'permission_denied': 'Permission Denied',
  'suspicious_activity': 'Suspicious Activity Detected'
};

/**
 * Get human-readable label for activity type
 * @param {string} activityType - Raw activity type from backend
 * @returns {string} User-friendly label
 */
export const getActivityTypeLabel = (activityType) => {
  if (!activityType) return 'Unknown Activity';

  // Check predefined labels first
  if (ACTIVITY_TYPE_LABELS[activityType]) {
    return ACTIVITY_TYPE_LABELS[activityType];
  }

  // Fallback: Convert snake_case to Title Case
  return activityType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Format metadata key to user-friendly label
 * @param {string} key - Metadata key
 * @returns {string} User-friendly label
 */
export const formatMetadataKey = (key) => {
  const keyMap = {
    'loan_amount': 'Loan Amount',
    'items_count': 'Items',
    'amount': 'Amount',
    'months': 'Duration',
    'days': 'Duration',
    'old_status': 'Previous Status',
    'new_status': 'New Status',
    'notes': 'Notes',
    'status': 'Status',
    'role': 'Role',
    'first_name': 'First Name',
    'last_name': 'Last Name',
    'email': 'Email',
    'phone': 'Phone',
    'transaction_id': 'Transaction',
    'customer_name': 'Customer',
    'user_name': 'User',
    'previous_value': 'Old Value',
    'new_value': 'New Value',
    'changed_by': 'Changed By',
    'reason': 'Reason'
  };

  return keyMap[key] || key.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

/**
 * Format metadata value based on key and activity type
 * @param {string} key - Metadata key
 * @param {any} value - Metadata value
 * @param {string} activityType - Activity type for context
 * @returns {string} Formatted value
 */
export const formatMetadataValue = (key, value, activityType = '') => {
  if (value === null || value === undefined) return 'N/A';

  // Currency amounts with +/- signs based on activity type
  if (key === 'loan_amount' || key === 'amount') {
    const formattedAmount = `$${Number(value).toLocaleString()}`;

    // Add +/- signs for money flow clarity (business perspective)
    if (activityType === 'payment_reversed' || activityType === 'extension_cancelled') {
      return `-${formattedAmount}`; // Money going OUT (refund)
    } else if (activityType === 'payment_processed' || activityType === 'extension_applied') {
      return `+${formattedAmount}`; // Money coming IN (payment/fee received)
    }

    return formattedAmount;
  }

  // Item count
  if (key === 'items_count') {
    return `${value} ${value === 1 ? 'item' : 'items'}`;
  }

  // Duration in months
  if (key === 'months') {
    return `${value} ${value === 1 ? 'month' : 'months'}`;
  }

  // Duration in days
  if (key === 'days') {
    return `${value} ${value === 1 ? 'day' : 'days'}`;
  }

  // Status/role values - capitalize
  if (key === 'old_status' || key === 'new_status' || key === 'status' || key === 'role') {
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
  }

  // Handle nested objects (like status/role changes with old/new values)
  if (typeof value === 'object' && value !== null) {
    if (value.old !== undefined && value.new !== undefined) {
      // Format as "old → new" with capitalization
      const oldVal = String(value.old).charAt(0).toUpperCase() + String(value.old).slice(1);
      const newVal = String(value.new).charAt(0).toUpperCase() + String(value.new).slice(1);
      return `${oldVal} → ${newVal}`;
    }
    // For other objects, try to stringify
    return JSON.stringify(value);
  }

  return String(value);
};

/**
 * Format business settings metadata with enhanced readability
 * @param {Object} metadata - Metadata object
 * @returns {Array} Array of formatted items with labels and values
 */
export const formatBusinessSettingsMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return null;

  const formattedItems = [];

  // Special labels for business settings
  const configTypeLabels = {
    'company': 'Company Information',
    'company_logo': 'Company Logo',
    'financial_policy': 'Financial Policy',
    'forfeiture': 'Forfeiture Rules',
    'printer': 'Printer Settings'
  };

  const sectionLabels = {
    'interest_rates': 'Interest Rate Settings',
    'loan_limit': 'Loan Limit Settings',
    'credit_limit': 'Credit Limit Settings'
  };

  const fieldLabels = {
    'monthly_interest_rate': 'Monthly Interest Rate',
    'max_loan_amount': 'Maximum Loan Amount',
    'min_loan_amount': 'Minimum Loan Amount',
    'max_active_loans': 'Max Loans Per Customer',
    'customer_credit_limit': 'Customer Credit Limit',
    'company_name': 'Company Name',
    'address': 'Address',
    'phone': 'Phone Number',
    'forfeiture_days': 'Forfeiture Period',
    'config_type': 'Configuration Type',
    'section_updated': 'Section',
    'has_previous': 'Previous Value Exists',
    'reason': 'Reason for Change'
  };

  // Helper to format values based on field type
  const formatFieldValue = (key, value) => {
    // Skip internal tracking fields
    if (key === 'has_previous') return null;

    // Config type
    if (key === 'config_type') {
      return configTypeLabels[value] || String(value).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Section labels
    if (key === 'section_updated') {
      return sectionLabels[value] || String(value).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Interest rate
    if (key.includes('interest_rate') || key.includes('rate')) {
      return `${value}%`;
    }

    // Amounts and credit limits
    if (key.includes('amount') || key.includes('credit_limit')) {
      return `$${Number(value).toLocaleString()}`;
    }

    // Days
    if (key.includes('days')) {
      return `${value} days`;
    }

    // Loan counts
    if (key.includes('loans')) {
      return `${value} ${value === 1 ? 'loan' : 'loans'}`;
    }

    return String(value);
  };

  // Check if it's a settings change (has 'changes' array)
  if (metadata.changes && Array.isArray(metadata.changes)) {
    metadata.changes.forEach(change => {
      formattedItems.push({
        label: formatMetadataKey(change.field || change.key || 'Field'),
        value: `${change.old_value || change.from || 'N/A'} → ${change.new_value || change.to || 'N/A'}`,
        isChange: true
      });
    });
  } else {
    // Process metadata to detect old_/new_ pairs for changes
    const processedKeys = new Set();

    // First pass: look for old_/new_ pairs (changes)
    Object.keys(metadata).forEach(key => {
      if (key.startsWith('old_')) {
        const fieldName = key.replace(/^old_/, '');
        const newKey = `new_${fieldName}`;

        if (metadata[newKey] !== undefined && !processedKeys.has(fieldName)) {
          processedKeys.add(fieldName);
          processedKeys.add(key);
          processedKeys.add(newKey);

          const label = fieldLabels[fieldName] || formatMetadataKey(fieldName);
          const oldVal = formatFieldValue(fieldName, metadata[key]);
          const newVal = formatFieldValue(fieldName, metadata[newKey]);

          // Only show actual changes (skip if old and new values are identical)
          if (oldVal !== null && newVal !== null && oldVal !== newVal) {
            formattedItems.push({
              label,
              value: `${oldVal} → ${newVal}`,
              isChange: true
            });
          }
        }
      }
    });

    // Second pass: add non-change fields (context information)
    Object.entries(metadata).forEach(([key, value]) => {
      if (!processedKeys.has(key) && !key.startsWith('old_') && !key.startsWith('new_')) {
        const formattedValue = formatFieldValue(key, value);

        if (formattedValue !== null) {
          const label = fieldLabels[key] || formatMetadataKey(key);
          formattedItems.push({
            label,
            value: formattedValue,
            isChange: false,
            isContext: !key.includes('old_') && !key.includes('new_')
          });
        }
      }
    });

    // Reorder: context fields first, then changes
    formattedItems.sort((a, b) => {
      if (a.isContext && !b.isContext) return -1;
      if (!a.isContext && b.isContext) return 1;
      return 0;
    });
  }

  return formattedItems.length > 0 ? formattedItems : null;
};

/**
 * Get severity badge configuration
 * @param {string} severity - Severity level
 * @returns {Object} Badge configuration with color and icon
 */
export const getSeverityConfig = (severity) => {
  const configs = {
    info: {
      bgColor: 'bg-blue-500',
      lightBg: 'bg-blue-100',
      darkBg: 'bg-blue-900',
      textColor: 'text-blue-800',
      darkText: 'text-blue-200',
      label: 'Info',
      emoji: 'ℹ️'
    },
    warning: {
      bgColor: 'bg-amber-500',
      lightBg: 'bg-amber-100',
      darkBg: 'bg-amber-900',
      textColor: 'text-amber-800',
      darkText: 'text-amber-200',
      label: 'Warning',
      emoji: '⚠️'
    },
    error: {
      bgColor: 'bg-red-500',
      lightBg: 'bg-red-100',
      darkBg: 'bg-red-900',
      textColor: 'text-red-800',
      darkText: 'text-red-200',
      label: 'Error',
      emoji: '❌'
    },
    critical: {
      bgColor: 'bg-purple-500',
      lightBg: 'bg-purple-100',
      darkBg: 'bg-purple-900',
      textColor: 'text-purple-800',
      darkText: 'text-purple-200',
      label: 'Critical',
      emoji: '🔴'
    }
  };

  return configs[severity?.toLowerCase()] || configs.info;
};

/**
 * Format error message for user display
 * @param {string} errorMessage - Raw error message
 * @returns {string} User-friendly error message
 */
export const formatErrorMessage = (errorMessage) => {
  if (!errorMessage) return 'An error occurred';

  const errorMap = {
    'invalid credentials': 'The User ID or PIN you entered is incorrect',
    'account_locked': 'This account has been locked due to multiple failed login attempts',
    'insufficient_permissions': 'You do not have permission to perform this action',
    'session_expired': 'Your session has expired. Please log in again',
    'unauthorized': 'You are not authorized to access this resource',
    'not_found': 'The requested resource was not found',
    'validation_error': 'The data you entered is invalid'
  };

  // Check for exact match
  const lowerMsg = errorMessage.toLowerCase();
  for (const [key, value] of Object.entries(errorMap)) {
    if (lowerMsg.includes(key)) {
      return value;
    }
  }

  // Return original if no match
  return errorMessage;
};
