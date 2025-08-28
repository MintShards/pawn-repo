import authService from './authService';

class ExtensionService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 5000; // 5 second cache
  }

  // Process a new extension
  async processExtension(extensionData) {
    try {
      const result = await authService.apiRequest('/api/v1/extension/', {
        method: 'POST',
        body: JSON.stringify(extensionData),
      });
      this.clearExtensionCache();
      return result;
    } catch (error) {
      // Error handled
      throw error;
    }
  }

  // Get extension history for a transaction
  async getExtensionHistory(transactionId) {
    try {
      return await authService.apiRequest(`/api/v1/extension/transaction/${transactionId}`, {
        method: 'GET',
      });
    } catch (error) {
      // Error handled
      throw error;
    }
  }

  // Check extension eligibility
  async checkExtensionEligibility(transactionId, extensionMonths = 1) {
    try {
      const params = `?extension_months=${extensionMonths}`;
      return await authService.apiRequest(`/api/v1/extension/transaction/${transactionId}/eligibility${params}`, {
        method: 'GET',
      });
    } catch (error) {
      // Error handled
      throw error;
    }
  }

  // Get extension summary
  async getExtensionSummary(transactionId) {
    try {
      return await authService.apiRequest(`/api/v1/extension/transaction/${transactionId}/summary`, {
        method: 'GET',
      });
    } catch (error) {
      // Error handled
      throw error;
    }
  }

  // Get specific extension by ID
  async getExtensionById(extensionId) {
    try {
      return await authService.apiRequest(`/api/v1/extension/${extensionId}`, {
        method: 'GET',
      });
    } catch (error) {
      if (error.message.includes('404')) {
        throw new Error(`Extension ${extensionId} not found`);
      }
      // Error handled
      throw error;
    }
  }

  // Clear cache
  clearExtensionCache() {
    this.cache.clear();
  }
}

const extensionService = new ExtensionService();
export default extensionService;