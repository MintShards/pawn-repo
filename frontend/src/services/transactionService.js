import authService from './authService';
import extensionService from './extensionService';


class TransactionService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 15000; // Reduced to 15 seconds for more responsive data
    this.pendingRequests = new Map(); // Track pending requests to prevent duplicates
    this.requestQueue = []; // Track request timing for monitoring only
    this.maxRequestsPerMinute = 100; // High limit - monitoring only
    this.throttleWindow = 60000; // 1 minute window
    this.lastRefresh = 0; // Track last refresh time
    this.minRefreshInterval = 100; // Minimal debounce for better responsiveness
  }

  // Rate limiting check
  canMakeRequest() {
    const now = Date.now();
    // Remove requests older than the throttle window
    this.requestQueue = this.requestQueue.filter(timestamp => now - timestamp < this.throttleWindow);
    
    // Check if we're under the rate limit
    return this.requestQueue.length < this.maxRequestsPerMinute;
  }

  // Add request to rate limiting queue
  trackRequest() {
    this.requestQueue.push(Date.now());
  }

  // Wait for rate limit window to clear (unused - kept for compatibility)
  async waitForRateLimit() {
    // No longer used - rate limiting disabled for development
    return;
  }

  // Debounced refresh to prevent rapid successive calls
  canRefresh() {
    const now = Date.now();
    if (now - this.lastRefresh < this.minRefreshInterval) {
      return false;
    }
    this.lastRefresh = now;
    return true;
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
      
      // Check cache first
      const cacheKey = endpoint;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }
      
      // Debounce rapid refresh calls - but allow API calls if no cached data
      if (!this.canRefresh()) {
        // Return cached data if available, even if expired
        if (cached) {
          return cached.data;
        }
        // If no cached data available, allow the request (no warning needed - this is normal behavior)
        // Don't return early - proceed with the API call
      }
      
      // Check if request is already pending to prevent duplicate calls
      if (this.pendingRequests.has(cacheKey)) {
        return await this.pendingRequests.get(cacheKey);
      }
      
      // Skip aggressive rate limiting - just track requests for monitoring
      this.trackRequest();
      
      // Create pending request promise
      const requestPromise = (async () => {
        try {          
          const result = await authService.apiRequest(endpoint, {
            method: 'GET',
          });
          
          // Handle paginated response
          const processedResult = result && result.transactions && Array.isArray(result.transactions) 
            ? result 
            : Array.isArray(result) 
              ? { transactions: result, total: result.length } 
              : { transactions: [], total: 0 };
          
          // Cache the result
          this.cache.set(cacheKey, {
            data: processedResult,
            timestamp: Date.now()
          });
          
          return processedResult;
        } finally {
          // Remove from pending requests
          this.pendingRequests.delete(cacheKey);
        }
      })();
      
      // Store pending request
      this.pendingRequests.set(cacheKey, requestPromise);
      
      return await requestPromise;
    } catch (error) {
      console.error('Error in getAllTransactions:', error);
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
      // Error handled
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
      // Error handled
      throw error;
    }
  }

  // Get transaction summary with items and balance
  async getTransactionSummary(transactionId) {
    try {
      return await authService.apiRequest(`/api/v1/pawn-transaction/${transactionId}/summary`, {
        method: 'GET',
      });
    } catch (error) {
      if (error.message.includes('404')) {
        throw new Error(`Transaction ${transactionId} not found`);
      }
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
      // Error handled
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
      // Error handled
      throw error;
    }
  }

  // Void transaction (Admin only)
  async voidTransaction(transactionId, voidData) {
    try {
      const result = await authService.apiRequest(`/api/v1/pawn-transaction/${transactionId}/void`, {
        method: 'POST',
        body: JSON.stringify(voidData),
      });
      this.clearTransactionCache();
      return result;
    } catch (error) {
      // Error handled
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
      // Error handled
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
      // Error handled
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
      // Error handled
      throw error;
    }
  }

  // Enrich transactions with extension data
  async enrichTransactionsWithExtensions(transactions, bustCache = false) {
    if (!transactions || !Array.isArray(transactions)) return transactions;
    
    try {
      // Load extension data for all transactions in parallel
      const enrichedTransactions = await Promise.all(
        transactions.map(async (transaction) => {
          try {
            const extensions = await extensionService.getExtensionHistory(transaction.transaction_id, bustCache);
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
            // Failed to load extensions for transaction
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
      // Error handled
      return transactions; // Return original transactions if enrichment fails
    }
  }

  // Unified search method using the new backend endpoint
  async unifiedSearch(searchParams) {
    try {
      const {
        search_text,
        search_type = 'auto_detect',
        include_extensions = true,
        include_items = true,
        include_customer = true,
        page = 1,
        page_size = 20
      } = searchParams;
      
      // Generate cache key for request deduplication
      const cacheKey = `unified_search:${JSON.stringify(searchParams)}`;
      
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }
      
      // Prevent duplicate concurrent requests
      if (this.pendingRequests.has(cacheKey)) {
        return await this.pendingRequests.get(cacheKey);
      }
      
      // Create request promise
      const requestPromise = (async () => {
        try {
          const result = await authService.apiRequest('/api/v1/pawn-transaction/search', {
            method: 'POST',
            body: JSON.stringify({
              search_text,
              search_type,
              include_extensions,
              include_items,
              include_customer,
              page,
              page_size
            }),
          });
          
          // Cache the result
          this.cache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
          });
          
          return result;
        } finally {
          // Remove from pending requests
          this.pendingRequests.delete(cacheKey);
        }
      })();
      
      // Store pending request
      this.pendingRequests.set(cacheKey, requestPromise);
      
      return await requestPromise;
    } catch (error) {
      console.error('Error in unified search:', error);
      throw error;
    }
  }

  // Alias for searchTransactions to match expected method name
  async searchTransactions(searchParams) {
    return this.unifiedSearch(searchParams);
  }

  // Get transaction status counts in a single optimized request
  async getStatusCounts() {
    try {
      const cacheKey = 'status_counts';
      
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }
      
      // Prevent duplicate concurrent requests
      if (this.pendingRequests.has(cacheKey)) {
        return await this.pendingRequests.get(cacheKey);
      }
      
      // Create request promise
      const requestPromise = (async () => {
        try {
          const result = await authService.apiRequest('/api/v1/pawn-transaction/status-counts', {
            method: 'GET',
          });
          
          // Cache the result for 60 seconds
          this.cache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
          });
          
          return result;
        } finally {
          // Remove from pending requests
          this.pendingRequests.delete(cacheKey);
        }
      })();
      
      // Store pending request
      this.pendingRequests.set(cacheKey, requestPromise);
      
      return await requestPromise;
    } catch (error) {
      console.error('Error getting status counts:', error);
      throw error;
    }
  }

  // Get audit entries for timeline display with optimized caching
  async getAuditEntries(transactionId, limit = 20, bustCache = false) {
    try {
      const endpoint = `/api/v1/notes/transaction/${transactionId}/audit-entries?limit=${limit}`;
      const cacheKey = `audit-${transactionId}-${limit}`;
      
      // Check cache first unless busting cache
      if (!bustCache) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
          return cached.data;
        }
        
        // Check if request is already pending
        if (this.pendingRequests.has(cacheKey)) {
          return await this.pendingRequests.get(cacheKey);
        }
      }
      
      // Create pending request promise
      const requestPromise = (async () => {
        try {
          const cacheBuster = bustCache ? `&_t=${Date.now()}` : '';
          const response = await authService.apiRequest(`${endpoint}${cacheBuster}`, {
            method: 'GET',
          });
          
          const result = response || [];
          
          // Cache the result
          this.cache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
          });
          
          return result;
        } finally {
          // Remove from pending requests
          this.pendingRequests.delete(cacheKey);
        }
      })();
      
      // Store pending request
      this.pendingRequests.set(cacheKey, requestPromise);
      
      return await requestPromise;
    } catch (error) {
      console.error('Error fetching audit entries:', error);
      // Return empty array on error (don't throw to avoid breaking timeline)
      return [];
    }
  }

  // Clear cache and pending requests
  clearTransactionCache() {
    this.cache.clear();
    this.pendingRequests.clear();
  }
  
  // Clear cache for specific endpoint
  clearCacheForEndpoint(endpoint) {
    this.cache.delete(endpoint);
    this.pendingRequests.delete(endpoint);
  }
}

const transactionService = new TransactionService();
export default transactionService;