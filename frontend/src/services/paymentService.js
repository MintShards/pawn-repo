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

  // Get payment history for transaction with caching
  async getPaymentHistory(transactionId) {
    const cacheKey = `payment-history-${transactionId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    const data = await authService.apiRequest(`/api/v1/payment/transaction/${transactionId}`, {
      method: 'GET',
    });

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    return data;
  }

  // Get payment summary for transaction with caching
  async getPaymentSummary(transactionId) {
    const cacheKey = `payment-summary-${transactionId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    const data = await authService.apiRequest(`/api/v1/payment/transaction/${transactionId}/summary`, {
      method: 'GET',
    });

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    return data;
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

  // Validate discount eligibility
  async validateDiscount(transactionId, paymentAmount, discountAmount) {
    return await authService.apiRequest('/api/v1/discount/validate', {
      method: 'POST',
      body: JSON.stringify({
        transaction_id: transactionId,
        payment_amount: Math.round(parseFloat(paymentAmount)),
        discount_amount: Math.round(parseFloat(discountAmount))
      }),
    });
  }

  // Process payment with admin-approved discount
  async processPaymentWithDiscount(paymentData) {
    const payload = {
      transaction_id: paymentData.transaction_id,
      payment_amount: Math.round(parseFloat(paymentData.payment_amount)),
      discount_amount: Math.round(parseFloat(paymentData.discount_amount)),
      discount_reason: paymentData.discount_reason,
      admin_pin: paymentData.admin_pin
    };

    const result = await authService.apiRequest('/api/v1/discount/apply', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.clearPaymentCache();

    // Clear transaction cache to ensure fresh data
    const transactionService = await import('./transactionService');
    if (transactionService.default) {
      transactionService.default.clearTransactionCache();
    }

    return result;
  }

  // Get daily discount report (Admin only)
  async getDailyDiscountReport(reportDate = null) {
    const params = reportDate ? `?report_date=${reportDate}` : '';
    return await authService.apiRequest(`/api/v1/discount/report/daily${params}`, {
      method: 'GET',
    });
  }

  // Clear cache
  clearPaymentCache() {
    this.cache.clear();
  }
}

const paymentService = new PaymentService();
export default paymentService;