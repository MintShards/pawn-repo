import authService from './authService';
import extensionService from './extensionService';
import { formatExtensionId, matchesExtensionSearch } from '../utils/transactionUtils';

class TransactionService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 5000; // 5 second cache
  }

  // Get all transactions with optional parameters
  async getAllTransactions(params = {}) {
    try {
      // Clean up params - remove empty strings and null/undefined values
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, value]) => value !== '' && value !== null && value !== undefined)
      );
      
      const queryString = new URLSearchParams(cleanParams).toString();
      const endpoint = queryString ? `/api/v1/pawn-transaction/?${queryString}` : '/api/v1/pawn-transaction/';
      
      const result = await authService.apiRequest(endpoint, {
        method: 'GET',
      });
      
      // Handle paginated response
      if (result && result.transactions && Array.isArray(result.transactions)) {
        return result;
      }
      return Array.isArray(result) ? { transactions: result, total: result.length } : { transactions: [], total: 0 };
    } catch (error) {
      console.error('Get all transactions error:', error);
      throw error;
    }
  }

  // Create new pawn transaction
  async createTransaction(transactionData) {
    try {
      const result = await authService.apiRequest('/api/v1/pawn-transaction/', {
        method: 'POST',
        body: JSON.stringify(transactionData),
      });
      this.clearTransactionCache();
      return result;
    } catch (error) {
      console.error('Create transaction error:', error);
      throw error;
    }
  }

  // Get transaction by ID
  async getTransactionById(transactionId) {
    try {
      return await authService.apiRequest(`/api/v1/pawn-transaction/${transactionId}`, {
        method: 'GET',
      });
    } catch (error) {
      if (error.message.includes('404')) {
        throw new Error(`Transaction ${transactionId} not found`);
      }
      console.error('Get transaction by ID error:', error);
      throw error;
    }
  }

  // Get transaction balance
  async getTransactionBalance(transactionId, asOfDate = null) {
    try {
      const params = asOfDate ? `?as_of_date=${asOfDate}` : '';
      return await authService.apiRequest(`/api/v1/pawn-transaction/${transactionId}/balance${params}`, {
        method: 'GET',
      });
    } catch (error) {
      console.error('Get transaction balance error:', error);
      throw error;
    }
  }

  // Update transaction status
  async updateTransactionStatus(transactionId, statusData) {
    try {
      const result = await authService.apiRequest(`/api/v1/pawn-transaction/${transactionId}/status`, {
        method: 'PUT',
        body: JSON.stringify(statusData),
      });
      this.clearTransactionCache();
      return result;
    } catch (error) {
      console.error('Update transaction status error:', error);
      throw error;
    }
  }

  // Redeem transaction
  async redeemTransaction(transactionId) {
    try {
      const result = await authService.apiRequest(`/api/v1/pawn-transaction/${transactionId}/redeem`, {
        method: 'POST',
      });
      this.clearTransactionCache();
      return result;
    } catch (error) {
      console.error('Redeem transaction error:', error);
      throw error;
    }
  }

  // Forfeit transaction
  async forfeitTransaction(transactionId, reason = null) {
    try {
      const params = reason ? `?reason=${encodeURIComponent(reason)}` : '';
      const result = await authService.apiRequest(`/api/v1/pawn-transaction/${transactionId}/forfeit${params}`, {
        method: 'POST',
      });
      this.clearTransactionCache();
      return result;
    } catch (error) {
      console.error('Forfeit transaction error:', error);
      throw error;
    }
  }

  // Get customer transactions
  async getCustomerTransactions(customerPhone, filters = {}) {
    try {
      const queryString = new URLSearchParams(filters).toString();
      const params = queryString ? `?${queryString}` : '';
      return await authService.apiRequest(`/api/v1/pawn-transaction/customer/${customerPhone}/transactions${params}`, {
        method: 'GET',
      });
    } catch (error) {
      console.error('Get customer transactions error:', error);
      throw error;
    }
  }

  // Enrich transactions with extension data
  async enrichTransactionsWithExtensions(transactions) {
    if (!transactions || !Array.isArray(transactions)) return transactions;
    
    try {
      // Load extension data for all transactions in parallel
      const enrichedTransactions = await Promise.all(
        transactions.map(async (transaction) => {
          try {
            const extensions = await extensionService.getExtensionHistory(transaction.transaction_id);
            // Handle different API response formats
            let extensionArray = [];
            
            if (Array.isArray(extensions)) {
              extensionArray = extensions;
            } else if (extensions && Array.isArray(extensions.extensions)) {
              extensionArray = extensions.extensions;
            } else if (extensions && typeof extensions === 'object') {
              // If it's a single extension object, wrap it in an array
              extensionArray = [extensions];
            }
            
            
            return {
              ...transaction,
              extensions: extensionArray,
              hasExtensions: extensionArray.length > 0
            };
          } catch (error) {
            // Handle 404 errors (no extensions found) gracefully
            if (error.message.includes('404') || error.message.includes('not found')) {
              return {
                ...transaction,
                extensions: [],
                hasExtensions: false
              };
            }
            
            // If extension loading fails for other reasons, continue with transaction but log the error
            console.warn(`Failed to load extensions for transaction ${transaction.transaction_id}:`, error);
            return {
              ...transaction,
              extensions: [],
              hasExtensions: false
            };
          }
        })
      );
      
      return enrichedTransactions;
    } catch (error) {
      console.error('Error enriching transactions with extensions:', error);
      return transactions; // Return original transactions if enrichment fails
    }
  }

  // Search for transactions by extension ID
  async searchTransactionsByExtension(extensionSearchTerm) {
    try {
      // Get all transactions first
      const allTransactions = await this.getAllTransactions({ page_size: 100 }); // Get more transactions for search
      const transactions = allTransactions.transactions || [];
      
      // Enrich with extensions
      const enrichedTransactions = await this.enrichTransactionsWithExtensions(transactions);
      
      // Filter transactions that have matching extensions
      const matchingTransactions = enrichedTransactions.filter(transaction => {
        // Ensure extensions exists and is an array
        if (!transaction.extensions || !Array.isArray(transaction.extensions) || transaction.extensions.length === 0) {
          return false;
        }
        
        return transaction.extensions.some(extension => {
          return matchesExtensionSearch(extension, extensionSearchTerm);
        });
      });
      
      return {
        transactions: matchingTransactions,
        searchType: 'extension',
        searchTerm: extensionSearchTerm
      };
    } catch (error) {
      console.error('Error searching transactions by extension:', error);
      throw error;
    }
  }

  // Clear cache
  clearTransactionCache() {
    this.cache.clear();
  }
}

export default new TransactionService();