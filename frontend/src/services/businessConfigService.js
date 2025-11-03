/**
 * Business Configuration Service
 *
 * Handles all business settings API calls including:
 * - Company information
 * - Financial policies
 * - Forfeiture rules
 * - Printer configuration
 */

import authService from './authService';

const businessConfigService = {
  // ==================== Company Configuration ====================

  /**
   * Get current company configuration
   */
  async getCompanyConfig() {
    return await authService.apiRequest('/api/v1/business-config/company', {
      method: 'GET',
    });
  },

  /**
   * Create or update company configuration
   * @param {Object} config - Company configuration data
   */
  async createCompanyConfig(config) {
    return await authService.apiRequest('/api/v1/business-config/company', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  /**
   * Get company configuration history
   */
  async getCompanyConfigHistory() {
    return await authService.apiRequest('/api/v1/business-config/company/history', {
      method: 'GET',
    });
  },

  /**
   * Upload company logo
   * @param {File} file - Logo image file
   * @returns {Promise<{logo_url: string, message: string}>}
   */
  async uploadLogo(file) {
    const formData = new FormData();
    formData.append('file', file);

    // Use custom fetch for file upload (multipart/form-data)
    const token = authService.getToken();
    const response = await fetch(
      `${process.env.REACT_APP_API_URL}/api/v1/business-config/company/upload-logo`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw errorData;
    }

    return await response.json();
  },

  // ==================== Financial Policy Configuration ====================

  /**
   * Get current financial policy configuration
   */
  async getFinancialPolicyConfig() {
    return await authService.apiRequest('/api/v1/business-config/financial-policy', {
      method: 'GET',
    });
  },

  /**
   * Create or update financial policy configuration
   * @param {Object} config - Financial policy configuration data
   */
  async createFinancialPolicyConfig(config) {
    return await authService.apiRequest('/api/v1/business-config/financial-policy', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  /**
   * Get financial policy configuration history
   */
  async getFinancialPolicyConfigHistory() {
    return await authService.apiRequest('/api/v1/business-config/financial-policy/history', {
      method: 'GET',
    });
  },

  // ==================== Forfeiture Configuration ====================

  /**
   * Get current forfeiture configuration
   */
  async getForfeitureConfig() {
    return await authService.apiRequest('/api/v1/business-config/forfeiture', {
      method: 'GET',
    });
  },

  /**
   * Create or update forfeiture configuration
   * @param {Object} config - Forfeiture configuration data
   */
  async createForfeitureConfig(config) {
    return await authService.apiRequest('/api/v1/business-config/forfeiture', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  /**
   * Get forfeiture configuration history
   */
  async getForfeitureConfigHistory() {
    return await authService.apiRequest('/api/v1/business-config/forfeiture/history', {
      method: 'GET',
    });
  },

  // ==================== Printer Configuration ====================

  /**
   * Get current printer configuration
   */
  async getPrinterConfig() {
    return await authService.apiRequest('/api/v1/business-config/printer', {
      method: 'GET',
    });
  },

  /**
   * Create or update printer configuration
   * @param {Object} config - Printer configuration data
   */
  async createPrinterConfig(config) {
    return await authService.apiRequest('/api/v1/business-config/printer', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  /**
   * Get printer configuration history
   */
  async getPrinterConfigHistory() {
    return await authService.apiRequest('/api/v1/business-config/printer/history', {
      method: 'GET',
    });
  },
};

export default businessConfigService;
