import { useState } from 'react';
import { toast } from 'sonner';
import reversalService from '../services/reversalService';
import transactionService from '../services/transactionService';
import paymentService from '../services/paymentService';

/**
 * Custom hook for managing payment reversal functionality
 * Consolidates the duplicate payment reversal logic from multiple components
 * 
 * @param {Object} options - Configuration options
 * @param {Function} options.user - Current user object
 * @param {Function} options.handleError - Error handler function
 * @param {Function} options.onSuccess - Success callback after reversal
 * @param {Function} options.onStateChange - Callback for state changes (optional)
 * @returns {Object} Payment reversal state and handlers
 */
export const usePaymentReversal = ({ 
  user, 
  handleError, 
  onSuccess,
  onStateChange 
}) => {
  // State management
  const [showPaymentReversalDialog, setShowPaymentReversalDialog] = useState(false);
  const [pendingReversalPaymentId, setPendingReversalPaymentId] = useState(null);
  const [pendingReversalTransaction, setPendingReversalTransaction] = useState(null);
  const [reversalEligibility, setReversalEligibility] = useState(null);
  const [processingCancel, setProcessingCancel] = useState(null);

  /**
   * Handle payment reversal initiation
   * @param {string} paymentId - The payment ID to reverse
   * @param {Object} transactionData - The transaction context (optional)
   */
  const handlePaymentReversalAction = async (paymentId, transactionData = null) => {
    // Admin role validation
    if (!user?.role || user.role !== 'admin') {
      handleError(new Error('Only administrators can cancel payments'), 'Permission denied');
      return;
    }
    
    try {
      // Check eligibility first
      const eligibility = await reversalService.checkPaymentReversalEligibility(paymentId);
      
      if (!eligibility.is_eligible) {
        handleError(new Error(eligibility.reason || 'Payment cannot be reversed'), 'Reversal not allowed');
        return;
      }
      
      // Store eligibility, payment ID, and transaction data, then show dialog
      const newState = {
        reversalEligibility: eligibility,
        pendingReversalPaymentId: paymentId,
        pendingReversalTransaction: transactionData,
        showPaymentReversalDialog: true
      };
      
      setReversalEligibility(eligibility);
      setPendingReversalPaymentId(paymentId);
      setPendingReversalTransaction(transactionData);
      setShowPaymentReversalDialog(true);
      
      // Notify parent component of state change if callback provided
      if (onStateChange) {
        onStateChange(newState);
      }
    } catch (error) {
      handleError(error, 'Failed to check reversal eligibility');
    }
  };

  /**
   * Handle approved payment reversal
   * @param {Object} approvalData - The approval data from AdminApprovalDialog
   * @param {Object} selectedTransaction - Current transaction context for optimistic updates
   * @param {Array} paymentHistory - Current payment history for optimistic updates
   */
  const handlePaymentReversalApproval = async (approvalData, selectedTransaction = null, paymentHistory = null) => {
    if (!pendingReversalPaymentId) return;
    
    setProcessingCancel(`payment-${pendingReversalPaymentId}`);
    
    try {
      // Optimistic update for payment history if provided
      let optimisticPaymentHistory = null;
      if (paymentHistory?.payments) {
        optimisticPaymentHistory = {
          ...paymentHistory,
          payments: paymentHistory.payments.map(payment => {
            if (payment.payment_id === pendingReversalPaymentId) {
              return {
                ...payment,
                is_voided: true,
                void_reason: approvalData.reason,
                voided_at: new Date().toISOString(),
                voided_by: user?.user_id
              };
            }
            return payment;
          })
        };
      }

      // Prepare reversal data
      const reversalData = {
        reversal_reason: approvalData.reason,
        admin_pin: approvalData.admin_pin
      };

      // Call the API to reverse the payment
      const result = await reversalService.reversePayment(pendingReversalPaymentId, reversalData);
      
      // Only close dialog and reset state on successful API call
      handlePaymentReversalCancel();
      
      // Clear caches to ensure fresh data on next fetch
      transactionService.clearTransactionCache();
      paymentService.clearPaymentCache();
      
      // Create optimistic update data for parent components
      const optimisticUpdate = selectedTransaction ? {
        ...selectedTransaction,
        // Update payment history if available
        paymentHistory: optimisticPaymentHistory
      } : null;
      
      // Notify success with results
      if (onSuccess) {
        onSuccess({
          result,
          optimisticUpdate,
          optimisticPaymentHistory,
          paymentId: pendingReversalPaymentId,
          reversalData
        });
      }
      
    } catch (error) {
      // Enhanced error handling with specific messages for admin operations
      let errorMessage = 'Payment reversal failed';
      let isAdminPinError = false;
      
      // Check for admin PIN validation errors specifically
      if (error.status === 401 || error.response?.status === 401 || 
          error.message?.includes('Invalid admin PIN') || 
          error.response?.data?.detail?.includes('Invalid admin PIN')) {
        errorMessage = 'Invalid PIN. Try again.';
        isAdminPinError = true;
      } else if (error.status === 403 || error.response?.status === 403) {
        errorMessage = 'Access denied';
      } else if (error.status === 400 || error.response?.status === 400) {
        if (error.message?.includes('same-day') || error.response?.data?.detail?.includes('same-day')) {
          errorMessage = 'Payment can only be reversed on the same business day it was made.';
        } else if (error.message?.includes('daily limit') || error.response?.data?.detail?.includes('daily limit')) {
          errorMessage = 'Daily reversal limit reached for this transaction.';
        } else {
          errorMessage = 'Payment cannot be reversed. Please check business rules.';
        }
      } else if (error.status === 404 || error.response?.status === 404) {
        errorMessage = 'Payment not found or already processed.';
      }
      
      // For admin PIN errors, show simple message without going through parseApiError
      if (isAdminPinError) {
        // Show error directly without the generic error handling that adds "Session expired"
        toast.error(errorMessage, { duration: 4000 });
      } else {
        handleError(error, errorMessage);
      }
    } finally {
      setProcessingCancel(null);
    }
  };

  /**
   * Handle payment reversal dialog cancellation/close
   */
  const handlePaymentReversalCancel = () => {
    const newState = {
      showPaymentReversalDialog: false,
      pendingReversalPaymentId: null,
      pendingReversalTransaction: null,
      reversalEligibility: null
    };
    
    setShowPaymentReversalDialog(false);
    setPendingReversalPaymentId(null);
    setPendingReversalTransaction(null);
    setReversalEligibility(null);
    
    // Notify parent component of state change if callback provided
    if (onStateChange) {
      onStateChange(newState);
    }
  };

  /**
   * Check if a payment can be reversed based on date
   * @param {string} paymentDate - The payment date to check
   * @returns {boolean} Whether the payment can be reversed
   */
  const canReversePayment = (paymentDate) => {
    if (!user?.role || user.role !== 'admin') return false;
    
    try {
      const today = new Date();
      const pDate = new Date(paymentDate);
      
      // Check if the payment was made today (same-day reversal rule)
      return (
        today.getFullYear() === pDate.getFullYear() &&
        today.getMonth() === pDate.getMonth() &&
        today.getDate() === pDate.getDate()
      );
    } catch (error) {
      return false;
    }
  };

  /**
   * Get the current processing state for a specific payment
   * @param {string} paymentId - The payment ID to check
   * @returns {boolean} Whether this payment is currently being processed
   */
  const isProcessingPayment = (paymentId) => {
    return processingCancel === `payment-${paymentId}`;
  };

  // Return all state and handlers
  return {
    // State
    showPaymentReversalDialog,
    pendingReversalPaymentId,
    pendingReversalTransaction,
    reversalEligibility,
    processingCancel,
    
    // Handlers
    handlePaymentReversalAction,
    handlePaymentReversalApproval,
    handlePaymentReversalCancel,
    
    // Utilities
    canReversePayment,
    isProcessingPayment,
    
    // Direct state setters (for advanced use cases)
    setShowPaymentReversalDialog,
    setPendingReversalPaymentId,
    setPendingReversalTransaction,
    setReversalEligibility,
    setProcessingCancel
  };
};

export default usePaymentReversal;