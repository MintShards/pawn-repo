import authService from './authService';

class ReversalService {
  // Check if payment can be reversed
  async checkPaymentReversalEligibility(paymentId) {
    try {
      const response = await authService.apiRequest(`/api/v1/reversal/payment/${paymentId}/validate`, {
        method: 'GET',
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Reverse a payment
  async reversePayment(paymentId, reversalData) {
    try {
      const response = await authService.apiRequest(`/api/v1/reversal/payment/${paymentId}/reverse`, {
        method: 'POST',
        body: JSON.stringify(reversalData),
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Check if extension can be cancelled
  async checkExtensionCancellationEligibility(extensionId) {
    try {
      const response = await authService.apiRequest(`/api/v1/reversal/extension/${extensionId}/validate`, {
        method: 'GET',
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Cancel an extension
  async cancelExtension(extensionId, cancellationData) {
    try {
      const response = await authService.apiRequest(`/api/v1/reversal/extension/${extensionId}/cancel`, {
        method: 'POST',
        body: JSON.stringify(cancellationData),
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Get daily reversal report
  async getDailyReversalReport(date) {
    try {
      const params = date ? `?date=${date}` : '';
      const response = await authService.apiRequest(`/api/v1/reversal/report/daily${params}`, {
        method: 'GET',
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Get reversal count for a transaction
  async getTransactionReversalCount(transactionId) {
    try {
      const response = await authService.apiRequest(`/api/v1/reversal/transaction/${transactionId}/count`, {
        method: 'GET',
      });
      return response;
    } catch (error) {
      throw error;
    }
  }
}

const reversalService = new ReversalService();
export default reversalService;