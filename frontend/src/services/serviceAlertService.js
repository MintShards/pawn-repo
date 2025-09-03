import authService from './authService';
import { getTimezoneHeaders } from '../utils/timezoneUtils';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class ServiceAlertService {
  constructor() {
    // Enhanced caching and rate limiting with intelligent cache expiry
    this.requestQueue = new Map();
    this.requestCache = new Map();
    this.batchQueue = new Map(); // For batching similar requests
    this.lastRequestTime = 0;
    this.minRequestInterval = 500; // Increased to 500ms to prevent rate limiting
    this.batchTimeout = 1000; // Increased to 1 second batch window
    
    // Intelligent cache expiry based on data type
    this.cacheExpiry = {
      alert_count: 60000,     // 1 minute - counts change less frequently
      alert_list: 45000,      // 45 seconds - alert lists need moderate freshness
      customer_items: 300000, // 5 minutes - customer items rarely change
      stats: 120000,          // 2 minutes - stats can be cached longer
      default: 30000          // 30 seconds - fallback for other data
    };
  }

  /**
   * Get auth headers for API requests
   */
  getAuthHeaders() {
    const token = localStorage.getItem('pawn_repo_token');
    return {
      'Content-Type': 'application/json',
      ...getTimezoneHeaders(),
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  /**
   * Handle API response with error checking
   */
  async handleResponse(response) {
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.detail || errorData.message || 'Service Alert API Error';
      } catch {
        errorMessage = errorText || `HTTP Error: ${response.status}`;
      }
      
      throw new Error(errorMessage);
    }
    
    return response.json();
  }

  /**
   * Create a new service alert
   */
  async createAlert(alertData) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/service-alert/`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(alertData)
      });

      const result = await this.handleResponse(response);
      
      // Clear stats cache since we created a new alert
      this.clearCacheByPattern('unique_customer_alert_stats');
      
      // Also clear customer stats cache to trigger refresh
      this.clearCacheByPattern('customer_stats');
      
      return result;
    } catch (error) {
      // Failed to create service alert
      throw error;
    }
  }

  /**
   * Get all alerts for a customer (bypassing cache)
   */
  async getCustomerAlertsFresh(customerPhone, status = null, page = 1, perPage = 50) {
    try {
      let url = `${API_BASE_URL}/api/v1/service-alert/customer/${customerPhone}?page=${page}&per_page=${perPage}`;
      if (status) {
        url += `&status=${status}`;
      }
      // Add cache-busting parameter
      url += `&_t=${Date.now()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      
      // Update cache with fresh data
      const cacheKey = `alerts_${customerPhone}_${status}_${page}_${perPage}`;
      this.requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      // Failed to get customer alerts (fresh)
      throw error;
    }
  }

  /**
   * Get all alerts for a customer
   */
  async getCustomerAlerts(customerPhone, status = null, page = 1, perPage = 50) {
    try {
      const cacheKey = `alerts_${customerPhone}_${status}_${page}_${perPage}`;
      
      // Check cache first
      const cached = this.requestCache.get(cacheKey);
      const expiry = this.getCacheExpiry(cacheKey);
      if (cached && Date.now() - cached.timestamp < expiry) {
        return cached.data;
      }

      let url = `${API_BASE_URL}/api/v1/service-alert/customer/${customerPhone}?page=${page}&per_page=${perPage}`;
      if (status) {
        url += `&status=${status}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      
      // Cache the result
      this.requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      // Failed to get customer alerts
      throw error;
    }
  }

  /**
   * Batch multiple alert count requests for better performance
   */
  async getBatchAlertCounts(customerPhones) {
    try {
      const results = {};
      const phonesToFetch = [];
      
      // Check cache first for each phone
      for (const phone of customerPhones) {
        const cacheKey = `alert_count_${phone}`;
        const cached = this.requestCache.get(cacheKey);
        
        const expiry = this.getCacheExpiry(cacheKey);
        if (cached && Date.now() - cached.timestamp < expiry) {
          results[phone] = cached.data;
        } else {
          phonesToFetch.push(phone);
        }
      }
      
      // If all results are cached, return them
      if (phonesToFetch.length === 0) {
        return results;
      }
      
      // Fetch uncached results individually (backend doesn't support batch endpoint yet)
      const fetchPromises = phonesToFetch.map(async (phone) => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/service-alert/customer/${phone}/count`, {
            method: 'GET',
            headers: this.getAuthHeaders()
          });
          
          const data = await this.handleResponse(response);
          
          // Cache the result
          this.requestCache.set(`alert_count_${phone}`, {
            data,
            timestamp: Date.now()
          });
          
          return { phone, data };
        } catch (error) {
          // Return 0 count on error for individual customer
          return { phone, data: { count: 0 } };
        }
      });
      
      const fetchedResults = await Promise.all(fetchPromises);
      
      // Combine cached and fetched results
      for (const { phone, data } of fetchedResults) {
        results[phone] = data;
      }
      
      return results;
    } catch (error) {
      // Return empty object on batch error
      return {};
    }
  }

  /**
   * Get alert count for a customer (for badge display) - with enhanced caching
   */
  async getCustomerAlertCount(customerPhone) {
    try {
      const cacheKey = `alert_count_${customerPhone}`;
      
      // Check cache first
      const cached = this.requestCache.get(cacheKey);
      const expiry = this.getCacheExpiry(cacheKey);
      if (cached && Date.now() - cached.timestamp < expiry) {
        return cached.data;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/service-alert/customer/${customerPhone}/count`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      
      // Cache the result
      this.requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      // Failed to get customer alert count
      throw error;
    }
  }

  /**
   * Get a specific alert by ID
   */
  async getAlert(alertId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/service-alert/${alertId}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      return await this.handleResponse(response);
    } catch (error) {
      // Failed to get service alert
      throw error;
    }
  }

  /**
   * Update an existing service alert
   */
  async updateAlert(alertId, updateData) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/service-alert/${alertId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(updateData)
      });

      const result = await this.handleResponse(response);
      
      // Clear relevant cache entries
      // Use selective cache invalidation
      this.invalidateCustomerCache(result.customer_phone, 'alert_created');
      this.invalidateCustomerCache(result.customer_phone, 'stats_update');
      
      return result;
    } catch (error) {
      // Failed to update service alert
      throw error;
    }
  }

  /**
   * Resolve a specific service alert
   */
  async resolveAlert(alertId, resolutionNotes = null) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/service-alert/${alertId}/resolve`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          resolution_notes: resolutionNotes
        })
      });

      const result = await this.handleResponse(response);
      
      // Clear relevant cache entries
      // Use selective cache invalidation
      this.invalidateCustomerCache(result.customer_phone, 'alert_created');
      this.invalidateCustomerCache(result.customer_phone, 'stats_update');
      
      return result;
    } catch (error) {
      // Failed to resolve service alert
      throw error;
    }
  }

  /**
   * Resolve all active alerts for a customer
   */
  async resolveAllCustomerAlerts(customerPhone, resolutionNotes = null) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/service-alert/customer/${customerPhone}/resolve-all`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          resolution_notes: resolutionNotes
        })
      });

      const result = await this.handleResponse(response);
      
      // Clear relevant cache entries
      // Use selective cache invalidation for resolved alerts
      this.invalidateCustomerCache(customerPhone, 'alert_resolved');
      this.invalidateCustomerCache(customerPhone, 'stats_update');
      
      return result;
    } catch (error) {
      // Failed to resolve all customer alerts
      throw error;
    }
  }

  /**
   * Get customer's pawn items for alert item selection
   */
  async getCustomerItems(customerPhone) {
    try {
      const cacheKey = `customer_items_${customerPhone}`;
      
      // Check cache first
      const cached = this.requestCache.get(cacheKey);
      const expiry = this.getCacheExpiry(cacheKey);
      if (cached && Date.now() - cached.timestamp < expiry) {
        return cached.data;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/service-alert/customer/${customerPhone}/items`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      
      // Cache the result
      this.requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      // Failed to get customer items
      throw error;
    }
  }

  /**
   * Delete a service alert (admin only)
   */
  async deleteAlert(alertId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/service-alert/${alertId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      const result = await this.handleResponse(response);
      
      // Clear all cache entries since we don't know which customer this affects
      this.requestCache.clear();
      
      return result;
    } catch (error) {
      // Failed to delete service alert
      throw error;
    }
  }

  /**
   * Get appropriate cache expiry based on data type
   */
  getCacheExpiry(cacheKey) {
    if (cacheKey.includes('alert_count_')) return this.cacheExpiry.alert_count;
    if (cacheKey.includes('alerts_')) return this.cacheExpiry.alert_list;
    if (cacheKey.includes('customer_items_')) return this.cacheExpiry.customer_items;
    if (cacheKey.includes('stats') || cacheKey.includes('unique_customer')) return this.cacheExpiry.stats;
    return this.cacheExpiry.default;
  }
  
  /**
   * Selective cache invalidation - only clear relevant caches
   */
  invalidateCustomerCache(customerPhone, operation) {
    const invalidationMap = {
      'alert_resolved': [`alert_count_${customerPhone}`, `alerts_${customerPhone}`],
      'alert_created': [`alert_count_${customerPhone}`, `alerts_${customerPhone}`],
      'customer_updated': [`customer_items_${customerPhone}`],
      'stats_update': ['unique_customer_alert_stats', 'customer_stats']
    };
    
    const patternsToInvalidate = invalidationMap[operation] || [];
    patternsToInvalidate.forEach(pattern => this.clearCacheByPattern(pattern));
  }
  
  /**
   * Clear cache entries that match a pattern - optimized
   */
  clearCacheByPattern(pattern) {
    const keysToDelete = [];
    for (const key of this.requestCache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.requestCache.delete(key));
  }

  /**
   * Clear all cache entries
   */
  clearCache() {
    this.requestCache.clear();
  }

  /**
   * Get alert type options for dropdown
   */
  getAlertTypes() {
    return [
      { value: 'hold_request', label: 'Hold Request' },
      { value: 'payment_arrangement', label: 'Payment Arrangement' },
      { value: 'extension_request', label: 'Extension Request' },
      { value: 'pickup_arrangement', label: 'Pickup Arrangement' },
      { value: 'item_inquiry', label: 'Item Inquiry' },
      { value: 'general_note', label: 'General Note' }
    ];
  }

  /**
   * Get unique customer alert stats for dashboard
   */
  async getUniqueCustomerAlertStats() {
    try {
      const cacheKey = 'unique_customer_alert_stats';
      
      // Check cache first
      const cached = this.requestCache.get(cacheKey);
      const expiry = this.getCacheExpiry(cacheKey);
      if (cached && Date.now() - cached.timestamp < expiry) {
        return cached.data;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/service-alert/stats/unique-customers`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      
      // Cache the result
      this.requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      // Failed to get unique customer alert stats
      throw error;
    }
  }

}

const serviceAlertService = new ServiceAlertService();
export default serviceAlertService;