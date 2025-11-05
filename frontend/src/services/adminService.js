/**
 * Admin Service
 * Handles admin-only operations: system monitoring, health checks, consistency validation, user activity logs
 */

import authService from './authService';

const adminService = {
  // ==================== System Monitoring ====================

  /**
   * Get comprehensive system health information
   * @returns {Promise<Object>} System health data with metrics
   */
  async getSystemHealth() {
    return await authService.apiRequest('/api/v1/monitoring/system-health', {
      method: 'GET',
    });
  },

  /**
   * Get performance metrics
   * @returns {Promise<Object>} Performance metrics with thresholds
   */
  async getPerformanceMetrics() {
    return await authService.apiRequest('/api/v1/monitoring/performance-metrics', {
      method: 'GET',
    });
  },

  /**
   * Get business metrics
   * @returns {Promise<Object>} Business intelligence metrics
   */
  async getBusinessMetrics() {
    return await authService.apiRequest('/api/v1/monitoring/business-metrics', {
      method: 'GET',
    });
  },

  /**
   * Get security events summary
   * @returns {Promise<Object>} Recent security events
   */
  async getSecurityEvents() {
    return await authService.apiRequest('/api/v1/monitoring/security-events', {
      method: 'GET',
    });
  },

  /**
   * Get alerts status
   * @returns {Promise<Object>} Current alerts and system status
   */
  async getAlertsStatus() {
    return await authService.apiRequest('/api/v1/monitoring/alerts-status', {
      method: 'GET',
    });
  },

  // ==================== Database Health ====================

  /**
   * Get database health status
   * @returns {Promise<Object>} Database health information
   */
  async getDatabaseHealth() {
    return await authService.apiRequest('/api/v1/database/health', {
      method: 'GET',
    });
  },

  /**
   * Get database connection statistics
   * @returns {Promise<Object>} Connection pool information
   */
  async getDatabaseConnections() {
    return await authService.apiRequest('/api/v1/database/connections', {
      method: 'GET',
    });
  },

  /**
   * Get concurrency metrics
   * @returns {Promise<Object>} Optimistic locking and concurrency stats
   */
  async getConcurrencyMetrics() {
    return await authService.apiRequest('/api/v1/database/concurrency-metrics', {
      method: 'GET',
    });
  },

  /**
   * Test database transaction support
   * @returns {Promise<Object>} Transaction test results
   */
  async testTransactionSupport() {
    return await authService.apiRequest('/api/v1/database/transaction-support', {
      method: 'GET',
    });
  },

  /**
   * Reset concurrency metrics
   * @returns {Promise<Object>} Reset confirmation
   */
  async resetConcurrencyMetrics() {
    return await authService.apiRequest('/api/v1/database/reset-concurrency-metrics', {
      method: 'POST',
    });
  },

  // ==================== Consistency Validation ====================

  /**
   * Validate customer consistency
   * @param {string} phoneNumber - Customer phone number
   * @returns {Promise<Object>} Validation results
   */
  async validateCustomerConsistency(phoneNumber) {
    return await authService.apiRequest(`/api/v1/consistency/validate/${phoneNumber}`, {
      method: 'GET',
    });
  },

  /**
   * Fix customer consistency issues
   * @param {string} phoneNumber - Customer phone number
   * @returns {Promise<Object>} Fix results
   */
  async fixCustomerConsistency(phoneNumber) {
    return await authService.apiRequest(`/api/v1/consistency/fix/${phoneNumber}`, {
      method: 'POST',
    });
  },

  /**
   * Validate all customers
   * @param {Object} params - Query parameters
   * @param {number} params.limit - Limit number of customers
   * @param {boolean} params.fix_automatically - Auto-fix discrepancies
   * @returns {Promise<Object>} Bulk validation results
   */
  async validateAllCustomers(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.fix_automatically) queryParams.append('fix_automatically', 'true');

    return await authService.apiRequest(`/api/v1/consistency/validate-all?${queryParams}`, {
      method: 'GET',
    });
  },

  /**
   * Get consistency report
   * @returns {Promise<Object>} Comprehensive consistency report
   */
  async getConsistencyReport() {
    return await authService.apiRequest('/api/v1/consistency/report', {
      method: 'GET',
    });
  },

  // ==================== User Activity Logs ====================

  /**
   * Get activity logs for a specific user
   * @param {string} userId - User ID
   * @param {Object} params - Filter parameters
   * @returns {Promise<Object>} User activity logs
   */
  async getUserActivityLogs(userId, params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.per_page) queryParams.append('per_page', params.per_page);
    if (params.activity_types) {
      params.activity_types.forEach(type => queryParams.append('activity_types', type));
    }
    if (params.severities) {
      params.severities.forEach(severity => queryParams.append('severities', severity));
    }
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.is_success !== undefined) queryParams.append('is_success', params.is_success);
    if (params.search) queryParams.append('search', params.search);

    return await authService.apiRequest(`/api/v1/user-activity/${userId}?${queryParams}`, {
      method: 'GET',
    });
  },

  /**
   * List all activity logs with filtering
   * @param {Object} params - Filter parameters
   * @returns {Promise<Object>} Activity logs list
   */
  async listActivityLogs(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.user_id) queryParams.append('user_id', params.user_id);
    if (params.target_user_id) queryParams.append('target_user_id', params.target_user_id);
    if (params.page) queryParams.append('page', params.page);
    if (params.per_page) queryParams.append('per_page', params.per_page);
    if (params.activity_types) {
      params.activity_types.forEach(type => queryParams.append('activity_types', type));
    }
    if (params.severities) {
      params.severities.forEach(severity => queryParams.append('severities', severity));
    }
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.is_success !== undefined) queryParams.append('is_success', params.is_success);
    if (params.search) queryParams.append('search', params.search);

    return await authService.apiRequest(`/api/v1/user-activity/?${queryParams}`, {
      method: 'GET',
    });
  },

  /**
   * Get user activity statistics
   * @param {string} userId - User ID
   * @param {Object} params - Date range parameters
   * @returns {Promise<Object>} User activity statistics
   */
  async getUserActivityStats(userId, params = {}) {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);

    return await authService.apiRequest(`/api/v1/user-activity/${userId}/stats?${queryParams}`, {
      method: 'GET',
    });
  },

  /**
   * Get global activity statistics summary
   * @param {Object} params - Date range parameters
   * @returns {Promise<Object>} Activity statistics summary
   */
  async getActivityStatsSummary(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);

    return await authService.apiRequest(`/api/v1/user-activity/stats/summary?${queryParams}`, {
      method: 'GET',
    });
  },

  /**
   * Export activity logs to CSV
   * @param {Object} params - Filter parameters (same as listActivityLogs)
   * @returns {Promise<void>} Triggers CSV download
   */
  async exportActivityLogsCsv(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.user_id) queryParams.append('user_id', params.user_id);
    if (params.target_user_id) queryParams.append('target_user_id', params.target_user_id);
    if (params.activity_types) {
      params.activity_types.forEach(type => queryParams.append('activity_types', type));
    }
    if (params.severities) {
      params.severities.forEach(severity => queryParams.append('severities', severity));
    }
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.is_success !== undefined) queryParams.append('is_success', params.is_success);
    if (params.search) queryParams.append('search', params.search);

    // Get the token for the request
    const token = authService.getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    // Create a temporary link to download the file
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    const url = `${apiUrl}/api/v1/user-activity/export/csv?${queryParams}`;

    // Fetch the CSV file
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    // Get the filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'activity_logs.csv';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Create blob and download
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },
};

export default adminService;
