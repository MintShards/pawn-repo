/**
 * Utility functions for transaction formatting and management
 */

// Persistent store for transaction sequence numbers using localStorage
// This ensures sequence numbers survive page reloads
let transactionSequence = new Map();
let extensionSequence = new Map();
let nextSequenceNumber = 1;
let nextExtensionNumber = 1;

// Load existing sequence data from localStorage on initialization
const loadSequenceData = () => {
  try {
    const savedTransactionSeq = localStorage.getItem('transactionSequence');
    const savedExtensionSeq = localStorage.getItem('extensionSequence');
    const savedNextSequence = localStorage.getItem('nextSequenceNumber');
    const savedNextExtension = localStorage.getItem('nextExtensionNumber');
    
    if (savedTransactionSeq) {
      transactionSequence = new Map(JSON.parse(savedTransactionSeq));
    }
    if (savedExtensionSeq) {
      extensionSequence = new Map(JSON.parse(savedExtensionSeq));
    }
    if (savedNextSequence) {
      nextSequenceNumber = parseInt(savedNextSequence, 10) || 1;
    }
    if (savedNextExtension) {
      nextExtensionNumber = parseInt(savedNextExtension, 10) || 1;
    }
  } catch (e) {
    // Reset to defaults if loading fails
    transactionSequence = new Map();
    extensionSequence = new Map();
    nextSequenceNumber = 1;
    nextExtensionNumber = 1;
  }
};

// Save sequence data to localStorage
const saveSequenceData = () => {
  try {
    localStorage.setItem('transactionSequence', JSON.stringify([...transactionSequence]));
    localStorage.setItem('extensionSequence', JSON.stringify([...extensionSequence]));
    localStorage.setItem('nextSequenceNumber', nextSequenceNumber.toString());
    localStorage.setItem('nextExtensionNumber', nextExtensionNumber.toString());
  } catch (e) {
    // Silently handle localStorage errors
  }
};

// Initialize sequence data on module load
loadSequenceData();

/**
 * Get or assign a sequence number for a transaction
 * @param {string} transactionId - Full transaction ID hash
 * @returns {number} Sequential number starting from 1
 */
const getSequenceNumber = (transactionId) => {
  if (!transactionId) return 0;
  
  if (transactionSequence.has(transactionId)) {
    return transactionSequence.get(transactionId);
  }
  
  // Assign new sequence number
  const sequenceNumber = nextSequenceNumber++;
  transactionSequence.set(transactionId, sequenceNumber);
  saveSequenceData(); // Persist to localStorage
  return sequenceNumber;
};

/**
 * Get or assign a sequence number for an extension
 * @param {string} extensionId - Full extension ID hash
 * @returns {number} Sequential number starting from 1
 */
const getExtensionSequenceNumber = (extensionId) => {
  if (!extensionId) return 0;
  
  if (extensionSequence.has(extensionId)) {
    return extensionSequence.get(extensionId);
  }
  
  // Assign new sequence number
  const sequenceNumber = nextExtensionNumber++;
  extensionSequence.set(extensionId, sequenceNumber);
  saveSequenceData(); // Persist to localStorage
  return sequenceNumber;
};

/**
 * Initialize sequence numbers from a list of transactions
 * Call this when loading transactions to maintain consistency
 * @param {Array} transactions - List of transaction objects
 */
export const initializeSequenceNumbers = (transactions) => {
  if (!transactions || !Array.isArray(transactions)) return;
  
  // Sort by creation date to maintain consistent numbering
  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateA = new Date(a.pawn_date || a.created_at || '1970-01-01');
    const dateB = new Date(b.pawn_date || b.created_at || '1970-01-01');
    return dateA - dateB;
  });
  
  // Track if any new sequence numbers were assigned
  let hasNewSequences = false;
  
  // Assign sequence numbers in chronological order
  sortedTransactions.forEach(transaction => {
    if (transaction.transaction_id && !transactionSequence.has(transaction.transaction_id)) {
      transactionSequence.set(transaction.transaction_id, nextSequenceNumber++);
      hasNewSequences = true;
    }
    
    // Also initialize extension sequence numbers if extensions exist
    if (transaction.extensions && Array.isArray(transaction.extensions)) {
      const sortedExtensions = [...transaction.extensions].sort((a, b) => {
        const dateA = new Date(a.extension_date || a.created_at || '1970-01-01');
        const dateB = new Date(b.extension_date || b.created_at || '1970-01-01');
        return dateA - dateB;
      });
      
      sortedExtensions.forEach(extension => {
        if (extension.extension_id && !extensionSequence.has(extension.extension_id)) {
          extensionSequence.set(extension.extension_id, nextExtensionNumber++);
          hasNewSequences = true;
        }
      });
    }
  });
  
  // Save to localStorage if any new sequences were assigned
  if (hasNewSequences) {
    saveSequenceData();
  }
};

/**
 * Clear all sequence data (for admin use)
 * This will reset all transaction and extension numbering
 */
export const clearSequenceData = () => {
  transactionSequence.clear();
  extensionSequence.clear();
  nextSequenceNumber = 1;
  nextExtensionNumber = 1;
  
  // Clear from localStorage
  try {
    localStorage.removeItem('transactionSequence');
    localStorage.removeItem('extensionSequence');
    localStorage.removeItem('nextSequenceNumber');
    localStorage.removeItem('nextExtensionNumber');
  } catch (e) {
    // Silently handle localStorage errors
  }
};

/**
 * Format transaction ID for display
 * @param {Object} transaction - Transaction object
 * @param {string} transaction.transaction_id - Full transaction ID hash
 * @returns {string} Formatted transaction ID (e.g., "PW000001")
 */
export const formatTransactionId = (transaction) => {
  if (!transaction?.transaction_id) {
    return 'TXN-PENDING';
  }
  
  const sequenceNumber = getSequenceNumber(transaction.transaction_id);
  const paddedNumber = sequenceNumber.toString().padStart(6, '0');
  
  // Main transactions are always PW (Pawn)
  // Extensions and redemptions would have their own numbering system
  return `PW${paddedNumber}`;
};

/**
 * Format extension ID for display
 * @param {Object} extension - Extension object
 * @param {string} extension.extension_id - Full extension ID hash
 * @returns {string} Formatted extension ID (e.g., "EX000001")
 */
export const formatExtensionId = (extension) => {
  if (!extension?.extension_id) {
    return 'EXT-PENDING';
  }
  
  const sequenceNumber = getExtensionSequenceNumber(extension.extension_id);
  const paddedNumber = sequenceNumber.toString().padStart(6, '0');
  
  return `EX${paddedNumber}`;
};

/**
 * Extract searchable transaction number from formatted ID
 * @param {string} formattedId - Formatted ID like "PW000045"
 * @returns {string} Just the number part for searching
 */
export const extractTransactionNumber = (formattedId) => {
  if (!formattedId || formattedId === 'N/A') return '';
  return formattedId.replace(/^[A-Z]{2}/, ''); // Remove first 2 letters
};

/**
 * Check if a search term matches a transaction ID
 * @param {Object} transaction - Transaction object
 * @param {string} searchTerm - User's search input
 * @returns {boolean} Whether the transaction matches the search
 */
export const matchesTransactionSearch = (transaction, searchTerm) => {
  if (!searchTerm) return true;
  
  const formattedId = formatTransactionId(transaction);
  const searchLower = searchTerm.toLowerCase();
  
  // Allow searching by:
  // - Full formatted ID: "PW000045" or "EX000012"
  // - Just numbers: "000045" or "45"
  // - With or without prefix: "PW45" or "EX12"
  return (
    formattedId.toLowerCase().includes(searchLower) ||
    extractTransactionNumber(formattedId).includes(searchTerm) ||
    extractTransactionNumber(formattedId).replace(/^0+/, '').includes(searchTerm)
  );
};

/**
 * Check if a search term matches an extension ID
 * @param {Object} extension - Extension object
 * @param {string} searchTerm - User's search input
 * @returns {boolean} Whether the extension matches the search
 */
export const matchesExtensionSearch = (extension, searchTerm) => {
  if (!searchTerm) return true;
  
  const formattedId = formatExtensionId(extension);
  const searchLower = searchTerm.toLowerCase();
  
  return (
    formattedId.toLowerCase().includes(searchLower) ||
    extractTransactionNumber(formattedId).includes(searchTerm) ||
    extractTransactionNumber(formattedId).replace(/^0+/, '').includes(searchTerm)
  );
};

/**
 * Format storage location for display with proper capitalization
 * @param {string} location - Raw storage location from database
 * @returns {string} Properly capitalized location
 */
export const formatStorageLocation = (location) => {
  if (!location) return '';
  
  // Handle known locations with proper capitalization
  const locationMap = {
    'safe': 'Safe',
    'fire exit': 'Fire Exit',
    'small bins': 'Small Bins',
    'back room': 'Back Room',
    '152nd st': '152nd St',
    'large bins': 'Large Bins',
    'other': 'Other',
    'others': 'Other'
  };
  
  const lowerLocation = location.toLowerCase();
  return locationMap[lowerLocation] || location;
};

/**
 * Format currency for display, removing trailing .00 decimals
 * @param {number} amount - The amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '$0';
  
  // Format with currency
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
  
  // Remove .00 at the end
  return formatted.replace(/\.00$/, '');
};

const transactionUtils = {
  formatTransactionId,
  formatExtensionId,
  initializeSequenceNumbers,
  extractTransactionNumber,
  matchesTransactionSearch,
  matchesExtensionSearch,
  formatStorageLocation,
  formatCurrency
};

export default transactionUtils;