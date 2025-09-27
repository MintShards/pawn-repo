import authService from './authService';

class CustomerService {
  // Get all customers with optional parameters
  async getAllCustomers(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const endpoint = queryString ? `/api/v1/customer/?${queryString}` : '/api/v1/customer/';
      
      const result = await authService.apiRequest(endpoint, {
        method: 'GET',
      });
      // The API returns a paginated response with customers array and metadata
      if (result && result.customers && Array.isArray(result.customers)) {
        // Return the full response to access pagination metadata
        return result;
      }
      // Fallback for unexpected response format
      return Array.isArray(result) ? { customers: result, total: result.length } : { customers: [], total: 0 };
    } catch (error) {
      throw error;
    }
  }

  // Create new customer
  async createCustomer(customerData) {
    try {
      const result = await authService.apiRequest('/api/v1/customer/create', {
        method: 'POST',
        body: JSON.stringify(customerData),
      });
      // Force immediate cache clear for instant UI updates
      this.clearCustomerCache();
      return result;
    } catch (error) {
      throw error;
    }
  }

  // Get customer by phone number
  async getCustomerByPhone(phoneNumber) {
    try {
      return await authService.apiRequest(`/api/v1/customer/${phoneNumber}`, {
        method: 'GET',
      });
    } catch (error) {
      if (error.message.includes('404')) {
        return null; // Customer not found
      }
      throw error;
    }
  }

  // Update customer
  async updateCustomer(phoneNumber, customerData) {
    try {
      const result = await authService.apiRequest(`/api/v1/customer/${phoneNumber}`, {
        method: 'PUT',
        body: JSON.stringify(customerData),
      });
      // Force immediate cache clear for instant UI updates
      this.clearCustomerCache();
      this.clearCustomerCache(phoneNumber);
      return result;
    } catch (error) {
      throw error;
    }
  }

  // Format phone number for display (123) 456-7890
  formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';
    const cleaned = phoneNumber.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phoneNumber;
  }

  // Get customer full name
  getCustomerFullName(customer) {
    if (!customer) return '';
    const firstName = customer.first_name ? customer.first_name.toUpperCase() : '';
    const lastName = customer.last_name ? customer.last_name.toUpperCase() : '';
    return `${firstName} ${lastName}`.trim();
  }

  // Get customer name in DOE, J. format
  getCustomerNameFormatted(customer) {
    if (!customer || !customer.first_name || !customer.last_name) return '';
    const firstName = customer.first_name.toUpperCase();
    const lastName = customer.last_name.toUpperCase();
    const firstInitial = firstName.charAt(0);
    return `${lastName}, ${firstInitial}.`;
  }

  // Get customer statistics (admin only) with enhanced caching
  async getCustomerStatistics() {
    try {
      // Check for cached stats first (reduced cache time for stats)
      const cacheKey = 'customer_stats';
      const cached = this._getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const stats = await authService.apiRequest('/api/v1/customer/stats', {
        method: 'GET',
      });

      // Cache stats for 2 minutes (shorter than other data)
      this._setCache(cacheKey, stats, 2 * 60 * 1000);
      
      return stats;
    } catch (error) {
      throw error;
    }
  }

  // Get current loan limit configuration (admin only)
  async getLoanLimitConfig() {
    try {
      // Check for cached config first
      const cacheKey = 'loan_limit_config';
      const cached = this._getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const config = await authService.apiRequest('/api/v1/customer/loan-limit-config', {
        method: 'GET',
      });

      // Cache config for 10 minutes (longer since it changes less frequently)
      this._setCache(cacheKey, config, 10 * 60 * 1000);
      
      return config;
    } catch (error) {
      // Fallback to default limit if API call fails
      console.warn('Failed to fetch loan limit config, using default:', error);
      return { current_limit: 8, updated_by: 'system', reason: 'Default fallback' };
    }
  }

  // Update loan limit configuration (admin only)
  async updateLoanLimitConfig(maxActiveLoans, reason) {
    try {
      const config = await authService.apiRequest('/api/v1/customer/loan-limit-config', {
        method: 'PUT',
        body: JSON.stringify({
          max_active_loans: maxActiveLoans,
          reason: reason
        })
      });

      // Clear cache after update
      this._removeFromCache('loan_limit_config');
      
      return config;
    } catch (error) {
      throw error;
    }
  }

  // Get current max active loans limit (for UI components)
  async getCurrentMaxLoans() {
    try {
      const config = await this.getLoanLimitConfig();
      return config.current_limit || 8; // Default fallback
    } catch (error) {
      console.warn('Failed to get max loans, using default:', error);
      return 8; // Default fallback
    }
  }

  // Simple local cache implementation
  _getFromCache(key) {
    const cached = localStorage.getItem(`customer_cache_${key}`);
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() < data.expiry) {
        return data.value;
      } else {
        localStorage.removeItem(`customer_cache_${key}`);
      }
    }
    return null;
  }

  _setCache(key, value, ttlMs) {
    const data = {
      value,
      expiry: Date.now() + ttlMs
    };
    localStorage.setItem(`customer_cache_${key}`, JSON.stringify(data));
  }

  _removeFromCache(key) {
    localStorage.removeItem(`customer_cache_${key}`);
  }

  // Archive customer account (admin only)
  async archiveCustomer(phoneNumber, reason = '') {
    try {
      return await authService.apiRequest(`/api/v1/customer/${phoneNumber}/archive`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    } catch (error) {
      throw error;
    }
  }

  // Check loan eligibility for customer
  async checkLoanEligibility(phoneNumber, loanAmount = null) {
    try {
      const params = loanAmount ? `?loan_amount=${loanAmount}` : '';
      return await authService.apiRequest(`/api/v1/customer/${phoneNumber}/loan-eligibility${params}`, {
        method: 'GET',
      });
    } catch (error) {
      throw error;
    }
  }

  // Deactivate customer account (admin only)
  async deactivateCustomer(phoneNumber, reason = 'Customer requested account closure') {
    try {
      return await authService.apiRequest(`/api/v1/customer/${phoneNumber}/deactivate`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    } catch (error) {
      throw error;
    }
  }

  // Update customer status (admin only)
  async updateCustomerStatus(phoneNumber, status, reason = '') {
    try {
      return await authService.apiRequest(`/api/v1/customer/${phoneNumber}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, reason }),
      });
    } catch (error) {
      throw error;
    }
  }

  // Enhanced search customers with advanced filtering
  async searchCustomers(searchTerm, options = {}) {
    try {
      const params = {
        search: searchTerm,
        ...options
      };
      return await this.getAllCustomers(params);
    } catch (error) {
      throw error;
    }
  }

  // Get customer borrow amount display
  getBorrowAmountDisplay(customer) {
    if (!customer || typeof customer.can_borrow_amount !== 'number') return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(customer.can_borrow_amount);
  }

  // Validate phone number format
  validatePhoneNumber(phoneNumber) {
    if (!phoneNumber) return { valid: false, error: 'Phone number is required' };
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      return { valid: false, error: 'Phone number must be exactly 10 digits' };
    }
    return { valid: true, cleaned };
  }

  // Clear customer cache when needed - enhanced for immediate refresh
  clearCustomerCache(phoneNumber = null) {
    if (phoneNumber) {
      authService.clearCache(`/api/v1/customer/${phoneNumber}`);
      authService.clearCache('/api/v1/customer/'); // Clear list cache too
    } else {
      authService.clearCache('/api/v1/customer');
      authService.clearCache('/api/v1/customer/');
    }
  }

  // Force refresh - clears cache and returns fresh data immediately
  async forceRefresh() {
    this.clearCustomerCache();
    this._clearLocalCache();
    authService.invalidateDataCache();
  }
  
  // Get customer data with automatic real-time refresh
  async getCustomer(phoneNumber) {
    try {
      const customer = await this.getCustomerByPhone(phoneNumber);
      
      // Trigger real-time update event for listening components
      if (customer && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('customer-data-refreshed', {
          detail: { customer, type: 'fetch' }
        }));
      }
      
      return customer;
    } catch (error) {
      throw error;
    }
  }
  
  // Enhanced update with immediate real-time feedback
  async updateCustomerWithRealtime(phoneNumber, customerData) {
    try {
      // Perform update
      const result = await this.updateCustomer(phoneNumber, customerData);
      
      // Trigger immediate real-time update event
      if (result && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('customer-data-updated', {
          detail: { customer: result, type: 'update', phoneNumber }
        }));
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  // Clear local cache
  _clearLocalCache() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('customer_cache_')) {
        localStorage.removeItem(key);
      }
    });
  }

  // Bulk operations helper
  async getMultipleCustomers(phoneNumbers) {
    try {
      const promises = phoneNumbers.map(phone => this.getCustomerByPhone(phone));
      const results = await Promise.allSettled(promises);
      
      return results.map((result, index) => ({
        phone: phoneNumbers[index],
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null
      }));
    } catch (error) {
      throw error;
    }
  }

}

const customerService = new CustomerService();
export default customerService;