import authService from './authService';

class PaymentService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 5000; // 5 second cache
  }

  // Process payment
  async processPayment(paymentData) {
    try {
      const result = await authService.apiRequest('/api/v1/payment/', {
        method: 'POST',
        body: JSON.stringify(paymentData),
      });
      this.clearPaymentCache();
      return result;
    } catch (error) {
      // Error handled
      throw error;
    }
  }

  // Get payment history for transaction
  async getPaymentHistory(transactionId) {
    try {
      return await authService.apiRequest(`/api/v1/payment/transaction/${transactionId}`, {
        method: 'GET',
      });
    } catch (error) {
      // Error handled
      throw error;
    }
  }

  // Get payment summary for transaction
  async getPaymentSummary(transactionId) {
    try {
      return await authService.apiRequest(`/api/v1/payment/transaction/${transactionId}/summary`, {
        method: 'GET',
      });
    } catch (error) {
      // Error handled
      throw error;
    }
  }

  // Get payment by ID
  async getPaymentById(paymentId) {
    try {
      return await authService.apiRequest(`/api/v1/payment/${paymentId}`, {
        method: 'GET',
      });
    } catch (error) {
      if (error.message.includes('404')) {
        throw new Error(`Payment ${paymentId} not found`);
      }
      // Error handled
      throw error;
    }
  }

  // Validate payment before processing
  async validatePayment(paymentData) {
    try {
      return await authService.apiRequest('/api/v1/payment/validate', {
        method: 'POST',
        body: JSON.stringify(paymentData),
      });
    } catch (error) {
      // Error handled
      throw error;
    }
  }

  // Get payment receipt
  async getPaymentReceipt(paymentId) {
    try {
      return await authService.apiRequest(`/api/v1/payment/${paymentId}/receipt`, {
        method: 'GET',
      });
    } catch (error) {
      // Error handled
      throw error;
    }
  }

  // Void payment (Admin only)
  async voidPayment(paymentId, reason = null) {
    try {
      const params = reason ? `?reason=${encodeURIComponent(reason)}` : '';
      const result = await authService.apiRequest(`/api/v1/payment/${paymentId}/void${params}`, {
        method: 'POST',
      });
      this.clearPaymentCache();
      return result;
    } catch (error) {
      // Error handled
      throw error;
    }
  }

  // Clear cache
  clearPaymentCache() {
    this.cache.clear();
  }
}

const paymentService = new PaymentService();
export default paymentService;