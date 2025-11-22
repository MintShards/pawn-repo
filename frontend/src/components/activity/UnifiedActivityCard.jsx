import React from 'react';
import { Badge } from '../ui/badge';
import {
  Clock,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  LogIn,
  LogOut,
  UserPlus,
  UserCog,
  Eye,
  DollarSign,
  CalendarPlus,
  CalendarX,
  FileText,
  Settings,
  ShieldAlert,
  Key,
  Shield,
  Undo2,
  Activity,
  Tag
} from 'lucide-react';
import {
  getActivityTypeLabel,
  formatMetadataKey,
  formatMetadataValue,
  formatBusinessSettingsMetadata,
  getSeverityConfig,
  formatErrorMessage
} from '../../utils/activityLogFormatters';
import { formatBusinessDateTime } from '../../utils/timezoneUtils';

/**
 * Unified Activity Card Component
 *
 * Consistent styling and formatting for activity logs across admin audit
 * and user-specific activity views.
 *
 * @param {Object} activity - Activity log object
 * @param {boolean} showUserId - Whether to display user ID badge
 * @param {Function} formatRelativeTime - Optional relative time formatter
 */
const UnifiedActivityCard = ({ activity, showUserId = true, formatRelativeTime }) => {
  /**
   * Check if this is a transaction type update
   */
  const isTransactionTypeUpdate = () => {
    return activity.activity_type === 'transaction_updated' &&
           activity.metadata?.old_type &&
           activity.metadata?.new_type;
  };

  /**
   * Format transaction type update description for user-friendly display
   */
  const formatTransactionTypeDescription = () => {
    if (!isTransactionTypeUpdate()) {
      return null;
    }

    // Extract metadata for transaction type changes
    const metadata = activity.metadata || {};
    const oldType = metadata.old_type || metadata.previous_value;
    const newType = metadata.new_type || metadata.new_value;
    const oldBarcode = metadata.old_barcode;
    const newBarcode = metadata.new_barcode;

    // Format transaction type values (convert enum format to display names)
    const formatTypeValue = (value) => {
      if (!value) return 'Unknown';
      if (String(value).includes('TransactionType.')) {
        const enumValue = String(value).split('.')[1];
        if (enumValue === 'MANUAL') return 'New Entry';
        if (enumValue === 'IMPORTED') return 'Imported';
      }
      if (value === 'New Entry' || value === 'Imported') return value;
      return String(value).charAt(0).toUpperCase() + String(value).slice(1);
    };

    const formattedOldType = formatTypeValue(oldType);
    const formattedNewType = formatTypeValue(newType);

    // Build user-friendly description
    let description = `Transaction type changed from ${formattedOldType} to ${formattedNewType}`;

    // Add barcode context if present
    if (formattedNewType === 'Imported' && newBarcode && newBarcode !== 'N/A') {
      description += ` (${newBarcode})`;
    }

    return description;
  };

  /**
   * Get activity icon based on activity type
   */
  const getActivityIcon = (activityType) => {
    // Special case: Check if it's a transaction type update
    if (isTransactionTypeUpdate()) {
      return <Tag className="w-4 h-4 text-purple-600" />;
    }

    const iconMap = {
      // Authentication
      'login_success': <LogIn className="w-4 h-4 text-green-600" />,
      'login_failed': <LogIn className="w-4 h-4 text-red-600" />,
      'logout': <LogOut className="w-4 h-4 text-slate-600" />,
      'session_expired': <Clock className="w-4 h-4 text-orange-600" />,

      // User management
      'user_created': <UserPlus className="w-4 h-4 text-green-600" />,
      'user_updated': <UserCog className="w-4 h-4 text-blue-600" />,
      'user_deleted': <XCircle className="w-4 h-4 text-red-600" />,

      // Customer operations
      'customer_created': <UserPlus className="w-4 h-4 text-green-600" />,
      'customer_updated': <UserCog className="w-4 h-4 text-blue-600" />,
      'customer_viewed': <Eye className="w-4 h-4 text-slate-600" />,

      // Transaction operations
      'transaction_created': <FileText className="w-4 h-4 text-green-600" />,
      'transaction_updated': <FileText className="w-4 h-4 text-blue-600" />,
      'transaction_viewed': <Eye className="w-4 h-4 text-slate-600" />,
      'transaction_status_changed': <CheckCircle2 className="w-4 h-4 text-blue-600" />,
      'transaction_voided': <XCircle className="w-4 h-4 text-red-600" />,

      // Payment operations
      'payment_processed': <DollarSign className="w-4 h-4 text-green-600" />,
      'payment_reversed': <Undo2 className="w-4 h-4 text-orange-600" />,

      // Extension operations
      'extension_applied': <CalendarPlus className="w-4 h-4 text-blue-600" />,
      'extension_cancelled': <CalendarX className="w-4 h-4 text-red-600" />,

      // Status and role changes
      'status_changed': <CheckCircle2 className="w-4 h-4 text-blue-600" />,
      'role_changed': <Shield className="w-4 h-4 text-purple-600" />,

      // PIN activities
      'pin_reset': <Key className="w-4 h-4 text-orange-600" />,
      'pin_changed': <Key className="w-4 h-4 text-orange-600" />,

      // System actions
      'settings_changed': <Settings className="w-4 h-4 text-blue-600" />,
      'report_generated': <FileText className="w-4 h-4 text-slate-600" />,

      // Security events
      'unauthorized_access': <ShieldAlert className="w-4 h-4 text-red-600" />,
      'permission_denied': <ShieldAlert className="w-4 h-4 text-red-600" />,
      'suspicious_activity': <AlertTriangle className="w-4 h-4 text-orange-600" />,
    };

    return iconMap[activityType] || <Activity className="w-4 h-4 text-slate-600" />;
  };

  /**
   * Render severity badge with icon
   */
  const renderSeverityBadge = () => {
    const severity = activity.severity || 'info';

    // Severity-specific badge styling with proper colors for light and dark mode
    const severityClasses = {
      info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border-0',
      warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-0',
      error: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border-0',
      critical: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border-0'
    };

    const severityIcons = {
      warning: <AlertTriangle className="h-3 w-3" />,
      error: <XCircle className="h-3 w-3" />,
      critical: <AlertTriangle className="h-3 w-3" />,
      info: <Info className="h-3 w-3" />
    };

    const severityLabels = {
      info: 'Info',
      warning: 'Warning',
      error: 'Error',
      critical: 'Critical'
    };

    return (
      <Badge className={`${severityClasses[severity]} gap-1.5`}>
        {severityIcons[severity]}
        {severityLabels[severity]}
      </Badge>
    );
  };

  /**
   * Render success/failure badge
   */
  const renderSuccessBadge = () => {
    if (activity.is_success === undefined || activity.is_success === null) return null;

    return activity.is_success ? (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 border border-green-200 dark:border-green-800 gap-1">
        <CheckCircle2 className="w-3 h-3" />
        Success
      </Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border border-red-200 dark:border-red-800 gap-1">
        <XCircle className="w-3 h-3" />
        Failed
      </Badge>
    );
  };

  /**
   * Format timestamp with optional relative time
   */
  const formatTimestamp = () => {
    try {
      const formatted = formatBusinessDateTime(activity.timestamp, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });

      return formatted;
    } catch {
      return 'Invalid date';
    }
  };

  /**
   * Render metadata badges
   */
  const renderMetadata = () => {
    if (!activity.metadata || Object.keys(activity.metadata).length === 0) {
      return null;
    }

    // For transaction type updates, skip metadata badges since description already has all info
    if (isTransactionTypeUpdate()) {
      return null; // Description already shows "Transaction type changed from X to Y (barcode)"
    }

    // Standard metadata badges for other activity types
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(activity.metadata).map(([key, value]) => (
          <Badge key={key} variant="outline" className="text-xs">
            {formatMetadataKey(key)}: {formatMetadataValue(key, value, activity.activity_type)}
          </Badge>
        ))}
      </div>
    );
  };

  /**
   * Render enhanced details section
   */
  const renderDetails = () => {
    if (!activity.details && !activity.metadata) return null;

    return (
      <details className="mt-3 group/details">
        <summary className="flex items-center space-x-2 text-xs font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
          <Info className="w-3.5 h-3.5" />
          <span className="group-hover/details:underline">View Additional Details</span>
        </summary>
        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 text-xs overflow-x-auto">
          {activity.details && (
            <div className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 mb-2 leading-relaxed">
              {activity.details}
            </div>
          )}
          {activity.metadata && (() => {
            const formattedItems = formatBusinessSettingsMetadata(activity.metadata);
            if (formattedItems) {
              return (
                <div className="space-y-1.5">
                  {formattedItems.map((item, idx) => (
                    <div key={idx} className={`flex items-start gap-1.5 text-sm ${item.isChange ? 'p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800' : ''}`}>
                      <span className="font-semibold text-slate-600 dark:text-slate-400 shrink-0">{item.label}:</span>
                      <span className={`font-mono ${item.isChange ? 'text-amber-800 dark:text-amber-200 font-semibold' : 'text-slate-700 dark:text-slate-300'}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              );
            } else {
              return <pre className="text-slate-600 dark:text-slate-400 font-mono text-xs">{JSON.stringify(activity.metadata, null, 2)}</pre>;
            }
          })()}
        </div>
      </details>
    );
  };

  return (
    <div className="group p-4 bg-white dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5 p-2.5 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-colors">
            {getActivityIcon(activity.activity_type)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header with badges */}
            <div className="flex items-center flex-wrap gap-2 mb-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {formatTransactionTypeDescription() || activity.description || getActivityTypeLabel(activity.activity_type)}
              </p>
              {renderSeverityBadge()}
              {renderSuccessBadge()}
            </div>

            {/* Metadata row */}
            <div className="flex items-center flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-400">
              {showUserId && (
                <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded">
                  <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span className="font-medium">User {activity.user_id}</span>
                </div>
              )}
              <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded">
                <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span title={formatTimestamp()}>
                  {formatRelativeTime ? formatRelativeTime(activity.timestamp) : formatTimestamp()}
                </span>
              </div>
              {activity.activity_type && (
                <Badge variant="outline" className="text-xs font-medium">
                  {getActivityTypeLabel(activity.activity_type)}
                </Badge>
              )}
            </div>

            {/* Error message for failed activities */}
            {!activity.is_success && activity.error_message && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400 flex items-start gap-1.5">
                  <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{formatErrorMessage(activity.error_message)}</span>
                </p>
              </div>
            )}

            {/* Metadata badges (if not showing details) */}
            {!activity.details && renderMetadata()}

            {/* Expandable details */}
            {renderDetails()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedActivityCard;
