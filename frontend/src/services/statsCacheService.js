/**
 * Stats cache invalidation service
 * Handles cache invalidation after transaction operations
 */

import authService from './authService';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class StatsCacheService {
  /**
   * Invalidate all stats cache
   * Call this after any operation that might affect multiple metrics
   */
  async invalidateAll(triggeredBy = 'manual') {
    try {
      const token = authService.getToken();
      if (!token) return false;

      const response = await fetch(`${API_BASE}/api/v1/stats/cache/invalidate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Cache invalidated successfully
        return true;
      } else {
        console.warn('Failed to invalidate stats cache:', response.statusText);
        return false;
      }
    } catch (error) {
      console.warn('Error invalidating stats cache:', error);
      return false;
    }
  }

  /**
   * Invalidate cache after transaction creation
   */
  async invalidateAfterTransactionCreation(transactionId) {
    return this.invalidateAll(`transaction_creation:${transactionId}`);
  }

  /**
   * Invalidate cache after transaction status change
   */
  async invalidateAfterStatusChange(transactionId, oldStatus, newStatus) {
    return this.invalidateAll(`status_change:${transactionId}:${oldStatus}→${newStatus}`);
  }

  /**
   * Invalidate cache after payment processing
   */
  async invalidateAfterPayment(transactionId, paymentAmount) {
    return this.invalidateAll(`payment:${transactionId}:$${paymentAmount}`);
  }

  /**
   * Invalidate cache after loan extension
   */
  async invalidateAfterExtension(transactionId, extensionMonths) {
    return this.invalidateAll(`extension:${transactionId}:${extensionMonths}mo`);
  }

  /**
   * Invalidate cache after bulk operations
   */
  async invalidateAfterBulkOperation(operationType, affectedCount) {
    return this.invalidateAll(`bulk_operation:${operationType}:count_${affectedCount}`);
  }
}

// Export singleton instance
const statsCacheService = new StatsCacheService();
export default statsCacheService;