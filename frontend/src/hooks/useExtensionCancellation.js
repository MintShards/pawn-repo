import { useState } from 'react';
import { toast } from 'sonner';
import reversalService from '../services/reversalService';
import transactionService from '../services/transactionService';
import extensionService from '../services/extensionService';

/**
 * Custom hook for managing extension cancellation functionality
 * Consolidates the duplicate extension cancellation logic from multiple components
 * 
 * @param {Object} options - Configuration options
 * @param {Function} options.user - Current user object
 * @param {Function} options.handleError - Error handler function
 * @param {Function} options.onSuccess - Success callback after cancellation
 * @param {Function} options.onStateChange - Callback for state changes (optional)
 * @returns {Object} Extension cancellation state and handlers
 */
export const useExtensionCancellation = ({ 
  user, 
  handleError, 
  onSuccess,
  onStateChange 
}) => {
  // State management
  const [showExtensionCancelDialog, setShowExtensionCancelDialog] = useState(false);
  const [pendingCancelExtensionId, setPendingCancelExtensionId] = useState(null);
  const [pendingCancelTransaction, setPendingCancelTransaction] = useState(null);
  const [reversalEligibility, setReversalEligibility] = useState(null);
  const [processingCancel, setProcessingCancel] = useState(null);

  /**
   * Handle extension cancellation initiation
   * @param {string} extensionId - The extension ID to cancel
   * @param {Object} transactionData - The transaction context (optional)
   */
  const handleExtensionCancelAction = async (extensionId, transactionData = null) => {
    // Admin role validation
    if (!user?.role || user.role !== 'admin') {
      handleError(new Error('Only administrators can cancel extensions'), 'Permission denied');
      return;
    }
    
    try {
      // Check eligibility first
      const eligibility = await reversalService.checkExtensionCancellationEligibility(extensionId);
      
      if (!eligibility.is_eligible) {
        handleError(new Error(eligibility.reason || 'Extension cannot be cancelled'), 'Cancellation not allowed');
        return;
      }
      
      // Store eligibility, extension ID, and transaction data, then show dialog
      const newState = {
        reversalEligibility: eligibility,
        pendingCancelExtensionId: extensionId,
        pendingCancelTransaction: transactionData,
        showExtensionCancelDialog: true
      };
      
      setReversalEligibility(eligibility);
      setPendingCancelExtensionId(extensionId);
      setPendingCancelTransaction(transactionData);
      setShowExtensionCancelDialog(true);
      
      // Notify parent component of state change if callback provided
      if (onStateChange) {
        onStateChange(newState);
      }
    } catch (error) {
      handleError(error, 'Failed to check cancellation eligibility');
    }
  };

  /**
   * Handle approved extension cancellation
   * @param {Object} approvalData - The approval data from AdminApprovalDialog
   * @param {Object} selectedTransaction - Current transaction context for optimistic updates
   */
  const handleExtensionCancelApproval = async (approvalData, selectedTransaction = null) => {
    if (!pendingCancelExtensionId) return;
    
    setProcessingCancel(`extension-${pendingCancelExtensionId}`);
    
    try {
      // Prepare cancellation data
      const cancellationData = {
        cancellation_reason: approvalData.reason,
        admin_pin: approvalData.admin_pin
      };

      // Call the API to cancel the extension
      const result = await reversalService.cancelExtension(pendingCancelExtensionId, cancellationData);
      
      // Only close dialog and reset state on successful API call
      handleExtensionCancelCancel();
      
      // Clear caches to ensure fresh data on next fetch
      transactionService.clearTransactionCache();
      extensionService.clearExtensionCache();
      
      // Create optimistic update data for parent components
      const optimisticUpdate = selectedTransaction ? {
        ...selectedTransaction,
        extensions: selectedTransaction.extensions?.map(extension => {
          if (extension.extension_id === pendingCancelExtensionId) {
            return {
              ...extension,
              is_cancelled: true,
              cancellation_reason: approvalData.reason,
              cancelled_at: new Date().toISOString(),
              cancelled_by: user?.user_id
            };
          }
          return extension;
        })
      } : null;
      
      // Notify success with results
      if (onSuccess) {
        onSuccess({
          result,
          optimisticUpdate,
          extensionId: pendingCancelExtensionId,
          cancellationData
        });
      }
      
    } catch (error) {
      // Enhanced error handling with specific messages for admin operations
      let errorMessage = 'Extension cancellation failed';
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
          errorMessage = 'Extension can only be cancelled on the same business day it was created.';
        } else if (error.message?.includes('daily limit') || error.response?.data?.detail?.includes('daily limit')) {
          errorMessage = 'Daily cancellation limit reached for this transaction.';
        } else {
          errorMessage = 'Extension cannot be cancelled. Please check business rules.';
        }
      } else if (error.status === 404 || error.response?.status === 404) {
        errorMessage = 'Extension not found or already processed.';
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
   * Handle extension cancellation dialog cancellation/close
   */
  const handleExtensionCancelCancel = () => {
    const newState = {
      showExtensionCancelDialog: false,
      pendingCancelExtensionId: null,
      pendingCancelTransaction: null,
      reversalEligibility: null
    };
    
    setShowExtensionCancelDialog(false);
    setPendingCancelExtensionId(null);
    setPendingCancelTransaction(null);
    setReversalEligibility(null);
    
    // Notify parent component of state change if callback provided
    if (onStateChange) {
      onStateChange(newState);
    }
  };

  /**
   * Check if an extension can be cancelled based on date
   * @param {string} extensionDate - The extension date to check
   * @returns {boolean} Whether the extension can be cancelled
   */
  const canCancelExtension = (extensionDate) => {
    if (!user?.role || user.role !== 'admin') return false;
    
    try {
      const today = new Date();
      const extDate = new Date(extensionDate);
      
      // Check if the extension was created today (same-day cancellation rule)
      return (
        today.getFullYear() === extDate.getFullYear() &&
        today.getMonth() === extDate.getMonth() &&
        today.getDate() === extDate.getDate()
      );
    } catch (error) {
      return false;
    }
  };

  /**
   * Get the current processing state for a specific extension
   * @param {string} extensionId - The extension ID to check
   * @returns {boolean} Whether this extension is currently being processed
   */
  const isProcessingExtension = (extensionId) => {
    return processingCancel === `extension-${extensionId}`;
  };

  // Return all state and handlers
  return {
    // State
    showExtensionCancelDialog,
    pendingCancelExtensionId,
    pendingCancelTransaction,
    reversalEligibility,
    processingCancel,
    
    // Handlers
    handleExtensionCancelAction,
    handleExtensionCancelApproval,
    handleExtensionCancelCancel,
    
    // Utilities
    canCancelExtension,
    isProcessingExtension,
    
    // Direct state setters (for advanced use cases)
    setShowExtensionCancelDialog,
    setPendingCancelExtensionId,
    setPendingCancelTransaction,
    setReversalEligibility,
    setProcessingCancel
  };
};

export default useExtensionCancellation;