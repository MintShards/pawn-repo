import { useState } from 'react';
import { toast } from 'sonner';
import transactionService from '../services/transactionService';

/**
 * Custom hook for managing transaction void functionality
 * Consolidates the duplicate transaction void logic from multiple components
 * 
 * @param {Object} options - Configuration options
 * @param {Function} options.user - Current user object
 * @param {Function} options.handleError - Error handler function
 * @param {Function} options.onSuccess - Success callback after void
 * @param {Function} options.onStateChange - Callback for state changes (optional)
 * @returns {Object} Transaction void state and handlers
 */
export const useTransactionVoid = ({ 
  user, 
  handleError, 
  onSuccess,
  onStateChange 
}) => {
  // State management
  const [showVoidApprovalDialog, setShowVoidApprovalDialog] = useState(false);
  const [pendingVoidTransaction, setPendingVoidTransaction] = useState(null);
  const [processingCancel, setProcessingCancel] = useState(null);

  /**
   * Handle transaction void initiation
   * @param {Object} transaction - The transaction to void
   */
  const handleVoidTransaction = (transaction) => {
    // Admin role validation
    if (!user?.role || user.role !== 'admin') {
      handleError(new Error('Only administrators can void transactions'), 'Permission denied');
      return;
    }
    
    // Store transaction and show dialog
    const newState = {
      pendingVoidTransaction: transaction,
      showVoidApprovalDialog: true
    };
    
    setPendingVoidTransaction(transaction);
    setShowVoidApprovalDialog(true);
    
    // Notify parent component of state change if callback provided
    if (onStateChange) {
      onStateChange(newState);
    }
  };

  /**
   * Handle approved transaction void
   * @param {Object} approvalData - The approval data from AdminApprovalDialog
   * @param {Object} selectedTransaction - Current transaction context for optimistic updates
   */
  const handleVoidTransactionApproval = async (approvalData, selectedTransaction = null) => {
    if (!pendingVoidTransaction) return;
    
    setProcessingCancel(`void-${pendingVoidTransaction.transaction_id}`);
    
    try {
      // Prepare void data
      const voidData = {
        void_reason: approvalData.reason,
        admin_pin: approvalData.admin_pin
      };

      // Call the API to void the transaction
      const result = await transactionService.voidTransaction(pendingVoidTransaction.transaction_id, voidData);
      
      // Only close dialog and reset state on successful API call
      handleVoidTransactionCancel();
      
      // Clear transaction cache to ensure fresh data
      transactionService.clearTransactionCache();
      
      // Create optimistic update data for parent components
      const optimisticUpdate = selectedTransaction ? {
        ...selectedTransaction,
        status: 'voided',
        void_reason: approvalData.reason,
        voided_at: new Date().toISOString(),
        voided_by: user?.user_id
      } : null;
      
      // Notify success with results
      if (onSuccess) {
        onSuccess({
          result,
          optimisticUpdate,
          transactionId: pendingVoidTransaction.transaction_id,
          voidData
        });
      }
      
    } catch (error) {
      // Enhanced error handling with specific messages for admin operations
      let errorMessage = 'Transaction void failed';
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
        if (error.message?.includes('cannot be voided') || error.response?.data?.detail?.includes('cannot be voided')) {
          errorMessage = 'Transaction cannot be voided. Please check business rules.';
        } else {
          errorMessage = 'Transaction void failed. Please check business rules.';
        }
      } else if (error.status === 404 || error.response?.status === 404) {
        errorMessage = 'Transaction not found or already processed.';
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
   * Handle transaction void dialog cancellation/close
   */
  const handleVoidTransactionCancel = () => {
    const newState = {
      showVoidApprovalDialog: false,
      pendingVoidTransaction: null
    };
    
    setShowVoidApprovalDialog(false);
    setPendingVoidTransaction(null);
    
    // Notify parent component of state change if callback provided
    if (onStateChange) {
      onStateChange(newState);
    }
  };

  /**
   * Check if a transaction can be voided
   * @param {Object} transaction - The transaction to check
   * @returns {boolean} Whether the transaction can be voided
   */
  const canVoidTransaction = (transaction) => {
    if (!user?.role || user.role !== 'admin') return false;
    if (!transaction) return false;
    
    // Voidable statuses must match backend validation (from pawn_transaction.py)
    const voidableStatuses = ['active', 'overdue', 'extended', 'hold'];
    
    // Non-voidable statuses that should be blocked
    const nonVoidableStatuses = ['redeemed', 'forfeited', 'sold', 'voided', 'canceled'];
    
    const currentStatus = transaction.status?.toLowerCase();
    
    // Block explicitly non-voidable statuses
    if (nonVoidableStatuses.includes(currentStatus)) {
      return false;
    }
    
    // Allow only explicitly voidable statuses
    return voidableStatuses.includes(currentStatus);
  };

  /**
   * Get the current processing state for a specific transaction
   * @param {string} transactionId - The transaction ID to check
   * @returns {boolean} Whether this transaction is currently being processed
   */
  const isProcessingTransaction = (transactionId) => {
    return processingCancel === `void-${transactionId}`;
  };

  // Return all state and handlers
  return {
    // State
    showVoidApprovalDialog,
    pendingVoidTransaction,
    processingCancel,
    
    // Handlers
    handleVoidTransaction,
    handleVoidTransactionApproval,
    handleVoidTransactionCancel,
    
    // Utilities
    canVoidTransaction,
    isProcessingTransaction,
    
    // Direct state setters (for advanced use cases)
    setShowVoidApprovalDialog,
    setPendingVoidTransaction,
    setProcessingCancel
  };
};

export default useTransactionVoid;