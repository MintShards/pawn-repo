import authService from './authService';

class PaymentService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 5000; // 5 second cache
  }

  // Process payment
  async processPayment(paymentData) {
    const result = await authService.apiRequest('/api/v1/payment/', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
    this.clearPaymentCache();

    // Clear transaction cache to ensure fresh data
    const transactionService = await import('./transactionService');
    if (transactionService.default) {
      transactionService.default.clearTransactionCache();
    }

    return result;
  }

  // Get payment history for transaction
  async getPaymentHistory(transactionId) {
    return await authService.apiRequest(`/api/v1/payment/transaction/${transactionId}`, {
      method: 'GET',
    });
  }

  // Get payment summary for transaction
  async getPaymentSummary(transactionId) {
    return await authService.apiRequest(`/api/v1/payment/transaction/${transactionId}/summary`, {
      method: 'GET',
    });
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
      throw error;
    }
  }

  // Validate payment before processing
  async validatePayment(paymentData) {
    return await authService.apiRequest('/api/v1/payment/validate', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  }

  // Get payment receipt
  async getPaymentReceipt(paymentId) {
    return await authService.apiRequest(`/api/v1/payment/${paymentId}/receipt`, {
      method: 'GET',
    });
  }

  // Void payment (Admin only)
  async voidPayment(paymentId, reason = null) {
    const params = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    const result = await authService.apiRequest(`/api/v1/payment/${paymentId}/void${params}`, {
      method: 'POST',
    });
    this.clearPaymentCache();
    return result;
  }

  // Get overdue fee info for transaction
  async getOverdueFeeInfo(transactionId) {
    try {
      return await authService.apiRequest(`/api/v1/overdue-fee/${transactionId}/info`, {
        method: 'GET',
      });
    } catch (error) {
      // Return null if no overdue fee or error
      return null;
    }
  }

  // Set overdue fee for transaction
  async setOverdueFee(transactionId, overdueFee, notes = null) {
    return await authService.apiRequest(`/api/v1/overdue-fee/${transactionId}/set`, {
      method: 'POST',
      body: JSON.stringify({
        overdue_fee: Math.round(parseFloat(overdueFee)),
        notes: notes
      }),
    });
  }

  // Clear cache
  clearPaymentCache() {
    this.cache.clear();
  }
}

const paymentService = new PaymentService();
export default paymentService;