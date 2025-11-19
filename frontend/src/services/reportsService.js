/**
 * Reports Service
 *
 * API client for Reports & Analytics endpoints.
 * Handles Collections Analytics, Top Customers, and Inventory Snapshot.
 */

import authService from './authService';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Escapes CSV field values with formula injection protection and RFC 4180 compliance
 *
 * SECURITY: Prevents CSV formula injection by prefixing dangerous characters with single quote
 * Excel/LibreOffice/Google Sheets execute formulas starting with: = + - @ \t \r
 *
 * OWASP Reference: https://owasp.org/www-community/attacks/CSV_Injection
 *
 * Attack Vector: Malicious formulas executed when CSV opened in spreadsheet applications
 * Defense Strategy: Prefix dangerous characters with single quote to force text interpretation
 *
 * Coverage:
 * - Formula starters: = + - @
 * - Control chars: \t \r
 *
 * False Positives: Numbers like +123/-456 (rare in customer names, acceptable security trade-off)
 *
 * RFC 4180: If field contains commas, quotes, or newlines, wrap in quotes
 * and escape internal quotes by doubling them.
 *
 * @param {*} value - The value to escape
 * @returns {string} - The escaped CSV field value
 *
 * @example
 * escapeCSV('=2+2')                    // Returns: '=2+2 (blocks formula)
 * escapeCSV('Smith, John')             // Returns: "Smith, John" (RFC 4180)
 * escapeCSV('=cmd|"/c calc"!A1')       // Returns: '=cmd|"/c calc"!A1 (blocks command injection)
 */
const escapeCSV = (value) => {
  if (value == null) return '';
  let str = String(value);

  // CRITICAL SECURITY FIX: Prevent CSV formula injection
  // Excel executes formulas starting with these characters
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerousChars.some(char => str.startsWith(char))) {
    // Prefix with single quote to force Excel to treat as text
    str = `'${str}`;
  }

  // RFC 4180: If field contains comma, quote, newline, or carriage return, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const reportsService = {
  /**
   * Get collections analytics with overdue tracking and aging breakdown
   *
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {AbortSignal} signal - Optional abort signal for request cancellation
   * @returns {Promise<Object>} Collections analytics data
   */
  getCollectionsAnalytics: async (startDate = null, endDate = null, signal = null) => {
    try {
      const params = new URLSearchParams();

      if (startDate) {
        params.append('start_date', startDate); // Format: YYYY-MM-DD
      }
      if (endDate) {
        params.append('end_date', endDate); // Format: YYYY-MM-DD
      }

      const queryString = params.toString();
      const url = `${API_BASE_URL}/api/v1/reports/collections${queryString ? `?${queryString}` : ''}`;
      const token = authService.getToken();

      const fetchOptions = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Client-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      if (signal) {
        fetchOptions.signal = signal;
      }

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        throw new Error(`Failed to fetch collections analytics: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // Don't log AbortError - it's expected
      if (error.name !== 'AbortError') {
        console.error('Error fetching collections analytics:', error);
      }
      throw error;
    }
  },

  /**
   * Get top customers by active loans or staff performance
   *
   * @param {Object} params - Query parameters
   * @param {number} params.limit - Number of top items (default 10)
   * @param {string} params.view - View type: 'customers' or 'staff' (default 'customers')
   * @param {AbortSignal} params.signal - Optional abort signal for request cancellation
   * @returns {Promise<Object>} Top customers or staff data
   */
  getTopCustomers: async (params = {}) => {
    const queryParams = new URLSearchParams();

    if (params.limit) {
      queryParams.append('limit', params.limit);
    }
    if (params.view) {
      queryParams.append('view', params.view);
    }

    const url = `${API_BASE_URL}/api/v1/reports/top-customers${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const token = authService.getToken();

    // P1-002 FIX: Build fetch options with optional AbortSignal support
    const fetchOptions = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Client-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    // P1-002 FIX: Add signal to fetch options if provided
    if (params.signal) {
      fetchOptions.signal = params.signal;
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`Failed to fetch top customers: ${response.statusText}`);
    }

    return await response.json();
  },

  /**
   * Get inventory snapshot with storage analytics
   *
   * @returns {Promise<Object>} Inventory snapshot data
   */
  getInventorySnapshot: async () => {
    const url = `${API_BASE_URL}/api/v1/reports/inventory-snapshot`;
    const token = authService.getToken();

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Client-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch inventory snapshot: ${response.statusText}`);
    }

    return await response.json();
  },

  /**
   * Export collections analytics to CSV
   *
   * @param {Object} params - Query parameters
   * @returns {Promise<Blob>} CSV file blob
   */
  exportCollectionsCSV: async (params = {}) => {
    // For now, we'll generate CSV client-side from the analytics data
    const data = await reportsService.getCollectionsAnalytics(params);

    // Generate CSV content
    const rows = [
      ['Collections Analytics Report'],
      ['Generated:', new Date().toLocaleString()],
      [''],
      ['Summary Metrics'],
      ['Total Overdue', `$${data.summary.total_overdue.toLocaleString()}`],
      ['Count', data.summary.count],
      ['Avg Days Overdue', data.summary.avg_days_overdue],
      [''],
      ['Aging Breakdown'],
      ['Age Range', 'Count', 'Amount', 'Percentage'],
      ...data.aging_buckets.map(bucket => [
        bucket.range,
        bucket.count,
        `$${bucket.amount.toLocaleString()}`,
        `${bucket.percentage}%`
      ])
    ];

    const csvContent = rows.map(row => row.join(',')).join('\n');
    return new Blob([csvContent], { type: 'text/csv' });
  },

  /**
   * Export top customers to CSV
   *
   * @param {Object} params - Query parameters
   * @returns {Promise<Blob>} CSV file blob
   */
  exportTopCustomersCSV: async (params = {}) => {
    const data = await reportsService.getTopCustomers(params);

    if (data.customers) {
      // Customer view CSV with proper escaping
      const rows = [
        ['Top Customers Report'],
        ['Generated:', new Date().toLocaleString()],
        [''],
        ['Rank', 'Name', 'Phone', 'Active Loans', 'Total Loan Value', 'Total Transactions'],
        ...data.customers.map(customer => [
          customer.rank,
          escapeCSV(customer.name),           // CRITICAL-002 FIX: Escape name (contains comma: "Lastname, Firstname")
          escapeCSV(customer.phone_number),   // CRITICAL-002 FIX: Escape phone (may contain extensions)
          customer.active_loans,
          `$${customer.total_loan_value.toLocaleString()}`,
          customer.total_transactions
        ])
      ];

      const csvContent = rows.map(row => row.join(',')).join('\n');
      return new Blob([csvContent], { type: 'text/csv' });
    } else if (data.staff) {
      // Staff view CSV with proper escaping
      const rows = [
        ['Staff Performance Report'],
        ['Generated:', new Date().toLocaleString()],
        [''],
        ['Rank', 'Name', 'User ID', 'Transaction Count', 'Total Value'],
        ...data.staff.map(staff => [
          staff.rank,
          escapeCSV(staff.name),              // CRITICAL-002 FIX: Escape name (contains comma: "Lastname, Firstname")
          escapeCSV(staff.user_id),           // CRITICAL-002 FIX: Escape user ID (could contain special chars)
          staff.transaction_count,
          `$${staff.total_value.toLocaleString()}`
        ])
      ];

      const csvContent = rows.map(row => row.join(',')).join('\n');
      return new Blob([csvContent], { type: 'text/csv' });
    }
  },

  /**
   * Export inventory snapshot to CSV
   *
   * @returns {Promise<Blob>} CSV file blob
   */
  exportInventoryCSV: async () => {
    const data = await reportsService.getInventorySnapshot();

    const rows = [
      ['Inventory Snapshot Report'],
      ['Generated:', new Date().toLocaleString()],
      [''],
      ['Summary'],
      ['Total Items', data.summary.total_items],
      ['Total Loan Value', `$${data.summary.total_loan_value.toLocaleString()}`],
      ['Avg Storage Days', data.summary.avg_storage_days],
      [''],
      ['By Status'],
      ['Status', 'Item Count', 'Loan Value', 'Percentage', 'Avg Days in Storage'],
      ...data.by_status.map(status => [
        status.status,
        status.item_count,
        `$${status.loan_value.toLocaleString()}`,
        `${status.percentage}%`,
        status.avg_days_in_storage
      ]),
      [''],
      ['By Age'],
      ['Age Range', 'Item Count', 'Loan Value', 'Percentage'],
      ...data.by_age.map(age => [
        age.age_range,
        age.item_count,
        `$${age.loan_value.toLocaleString()}`,
        `${age.percentage}%`
      ])
    ];

    const csvContent = rows.map(row => row.join(',')).join('\n');
    return new Blob([csvContent], { type: 'text/csv' });
  },

  /**
   * Helper to download CSV blob
   *
   * @param {Blob} blob - CSV blob
   * @param {string} filename - Filename for download
   */
  downloadCSV: (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
};

export default reportsService;
