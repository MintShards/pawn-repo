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
      console.error('Get all customers error:', error);
      throw error;
    }
  }


  // Create new customer
  async createCustomer(customerData) {
    try {
      return await authService.apiRequest('/api/v1/customer/create', {
        method: 'POST',
        body: JSON.stringify(customerData),
      });
    } catch (error) {
      console.error('Create customer error:', error);
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
      console.error('Get customer by phone error:', error);
      throw error;
    }
  }

  // Update customer
  async updateCustomer(phoneNumber, customerData) {
    try {
      return await authService.apiRequest(`/api/v1/customer/${phoneNumber}`, {
        method: 'PUT',
        body: JSON.stringify(customerData),
      });
    } catch (error) {
      console.error('Update customer error:', error);
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

  // Get customer statistics (admin only)
  async getCustomerStatistics() {
    try {
      return await authService.apiRequest('/api/v1/customer/stats', {
        method: 'GET',
      });
    } catch (error) {
      console.error('Get customer statistics error:', error);
      throw error;
    }
  }


  // Archive customer account (admin only)
  async archiveCustomer(phoneNumber, reason = '') {
    try {
      return await authService.apiRequest(`/api/v1/customer/${phoneNumber}/archive`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    } catch (error) {
      console.error('Archive customer error:', error);
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
      console.error('Check loan eligibility error:', error);
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
      console.error('Deactivate customer error:', error);
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
      console.error('Update customer status error:', error);
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
      console.error('Search customers error:', error);
      throw error;
    }
  }

  // Get customer risk level display string
  getRiskLevelDisplay(customer) {
    if (!customer || !customer.risk_level) return 'Unknown';
    const riskLevel = customer.risk_level.toLowerCase();
    const riskColors = {
      low: 'text-green-600',
      medium: 'text-yellow-600', 
      high: 'text-red-600'
    };
    return {
      level: customer.risk_level,
      color: riskColors[riskLevel] || 'text-gray-600'
    };
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

  // Clear customer cache when needed
  clearCustomerCache(phoneNumber = null) {
    if (phoneNumber) {
      authService.clearCache(`/api/v1/customer/${phoneNumber}`);
    } else {
      authService.clearCache('/api/v1/customer');
    }
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
      console.error('Get multiple customers error:', error);
      throw error;
    }
  }

}

const customerService = new CustomerService();
export default customerService;