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

}

const customerService = new CustomerService();
export default customerService;