/**
 * Secure CSV Utility Functions
 *
 * Provides enterprise-grade CSV escaping with formula injection prevention
 * and RFC 4180 compliance.
 *
 * SECURITY: Prevents CSV Formula Injection (CWE-1236)
 * Reference: https://owasp.org/www-community/attacks/CSV_Injection
 */

/**
 * Escapes CSV field values with formula injection protection and RFC 4180 compliance
 *
 * SECURITY FEATURES:
 * - Prevents CSV formula injection by prefixing dangerous characters with single quote
 * - Excel/LibreOffice/Google Sheets execute formulas starting with: = + - @ \t \r
 * - Defense strategy: Prefix with single quote to force text interpretation
 *
 * ATTACK VECTOR:
 * Malicious formulas executed when CSV opened in spreadsheet applications
 * Example: =2+5+cmd|'/c calc'!A1 (executes calculator application)
 *
 * RFC 4180 COMPLIANCE:
 * - If field contains commas, quotes, or newlines, wrap in quotes
 * - Escape internal quotes by doubling them
 *
 * @param {*} value - Value to escape (will be converted to string)
 * @returns {string} Safely escaped CSV cell value
 *
 * @example
 * escapeCSV('=2+2')                    // Returns: '=2+2 (blocks formula)
 * escapeCSV('Smith, John')             // Returns: "Smith, John" (RFC 4180)
 * escapeCSV('=cmd|"/c calc"!A1')       // Returns: '=cmd|"/c calc"!A1 (blocks command injection)
 * escapeCSV('+1-555-0100')             // Returns: '+1-555-0100 (blocks formula)
 * escapeCSV(null)                      // Returns: '' (empty string)
 *
 * @see https://owasp.org/www-community/attacks/CSV_Injection
 * @see https://www.rfc-editor.org/rfc/rfc4180
 */
export const escapeCSV = (value) => {
  if (value === null || value === undefined) return "";

  let str = String(value);

  // CRITICAL SECURITY: Prevent CSV formula injection
  // Excel/LibreOffice/Google Sheets execute formulas starting with these characters
  const dangerousChars = ["=", "+", "-", "@", "\t", "\r"];
  if (dangerousChars.some((char) => str.startsWith(char))) {
    // Prefix with single quote to force Excel to treat as text
    str = `'${str}`;
  }

  // RFC 4180: Escape internal quotes by doubling them
  if (str.includes('"')) {
    str = str.replace(/"/g, '""');
  }

  // RFC 4180: Wrap in quotes if contains special characters
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    str = `"${str}"`;
  }

  return str;
};

/**
 * Format currency for CSV export
 *
 * Uses Intl.NumberFormat for consistent currency formatting across locales.
 * Returns formatted string suitable for CSV export.
 *
 * @param {number} value - Numeric value to format
 * @returns {string} Formatted currency string
 *
 * @example
 * formatCurrencyForCSV(1234.56)  // Returns: "$1,234.56"
 * formatCurrencyForCSV(0)        // Returns: "$0.00"
 * formatCurrencyForCSV(null)     // Returns: "$0.00"
 */
export const formatCurrencyForCSV = (value) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
};

/**
 * Format percentage for CSV export
 *
 * @param {number} value - Numeric value to format (0-100 range)
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage string
 *
 * @example
 * formatPercentageForCSV(25.567)      // Returns: "25.6%"
 * formatPercentageForCSV(25.567, 2)   // Returns: "25.57%"
 */
export const formatPercentageForCSV = (value, decimals = 1) => {
  return `${(value || 0).toFixed(decimals)}%`;
};

/**
 * Format phone number for CSV export
 *
 * Formats US phone numbers in (XXX) XXX-XXXX format.
 * Returns original value if not a valid 10-digit number.
 *
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 *
 * @example
 * formatPhoneForCSV('5551234567')    // Returns: "(555) 123-4567"
 * formatPhoneForCSV('555-123-4567')  // Returns: "(555) 123-4567"
 */
export const formatPhoneForCSV = (phone) => {
  if (!phone) return "";

  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");

  // Format if exactly 10 digits
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return phone; // Return original if not 10 digits
};

/**
 * Convert array of rows to CSV string with secure escaping
 *
 * Applies escapeCSV to all string values and joins into CSV format.
 * Numbers are converted to strings without escaping.
 *
 * @param {Array<Array<*>>} rows - Array of CSV rows (array of arrays)
 * @returns {string} CSV formatted string
 *
 * @example
 * const rows = [
 *   ['Name', 'Value'],
 *   ['=malicious', 1234],
 *   ['Smith, John', 5678]
 * ];
 * rowsToCSV(rows);
 * // Returns:
 * // Name,Value
 * // '=malicious,1234
 * // "Smith, John",5678
 */
export const rowsToCSV = (rows) => {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          // Numbers pass through without escaping
          if (typeof cell === "number") return cell;
          // All other values get secure escaping
          return escapeCSV(cell);
        })
        .join(","),
    )
    .join("\n");
};

/**
 * Create and download CSV file
 *
 * Creates a Blob from CSV content and triggers browser download.
 * Automatically cleans up object URL after download.
 *
 * @param {string} csvContent - CSV formatted string
 * @param {string} filename - Filename for download (should end in .csv)
 *
 * @example
 * const csvContent = rowsToCSV(rows);
 * downloadCSV(csvContent, 'inventory-snapshot-2025-11-19.csv');
 */
export const downloadCSV = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
