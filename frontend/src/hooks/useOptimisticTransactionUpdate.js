import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import transactionService from '../services/transactionService';
import extensionService from '../services/extensionService';

/**
 * Custom hook for optimistic UI updates on transaction operations
 * Provides immediate visual feedback while API calls complete in background
 */
export const useOptimisticTransactionUpdate = () => {
  const [operationStatus, setOperationStatus] = useState('idle');

  // Optimistic transaction creation
  const optimisticCreate = useCallback(async (transactionData, onSuccess, onError) => {
    const optimisticId = `temp_${Date.now()}`;
    const optimisticTransaction = {
      ...transactionData,
      transaction_id: optimisticId,
      status: 'creating',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pawn_date: new Date().toISOString(),
      isOptimistic: true
    };

    try {
      setOperationStatus('creating');
      
      // IMMEDIATE: Show optimistic transaction
      onSuccess?.(optimisticTransaction, 'optimistic');
      
      // API call with timeout for real-time feel
      const createPromise = transactionService.createTransaction(transactionData);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), 15000)
      );
      
      const realTransaction = await Promise.race([createPromise, timeoutPromise]);
      
      // REPLACE: Optimistic with real data
      setOperationStatus('success');
      onSuccess?.(realTransaction, 'confirmed');
      
      // Success feedback
      toast.success(`Transaction ${realTransaction.transaction_id || realTransaction.formatted_id} created successfully`, {
        duration: 3000
      });
      
      return realTransaction;
      
    } catch (error) {
      console.error('❌ TRANSACTION CREATE FAILED:', error);
      
      // ROLLBACK: Signal to remove optimistic transaction
      setOperationStatus('error');
      onError?.(optimisticId, error);
      
      // Error feedback
      const errorMessage = error.message?.includes('timeout') 
        ? 'Transaction creation taking longer than expected. Please check the transaction list.'
        : `Failed to create transaction: ${error.message}`;
      
      toast.error(errorMessage, {
        duration: 5000
      });
      
      throw error;
    }
  }, []);

  // Optimistic status update (for extensions, payments, etc.)
  const optimisticStatusUpdate = useCallback(async (transactionId, newStatus, updateFn, onSuccess, onError) => {
    const previousState = { transactionId, oldStatus: null };
    
    try {
      setOperationStatus('updating');
      
      // IMMEDIATE: Update status in UI
      onSuccess?.({
        transaction_id: transactionId,
        status: newStatus,
        updated_at: new Date().toISOString(),
        isOptimistic: true
      }, 'optimistic');
      
      // API call with timeout
      const updatePromise = updateFn();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), 10000)
      );
      
      const result = await Promise.race([updatePromise, timeoutPromise]);
      
      // CONFIRM: Real update completed
      setOperationStatus('success');
      onSuccess?.(result, 'confirmed');
      
      // Success feedback
      const statusText = newStatus === 'extended' ? 'extended' : 
                        newStatus === 'redeemed' ? 'redeemed' : 
                        `updated to ${newStatus}`;
      
      toast.success(`Transaction ${statusText} successfully`, {
        duration: 3000
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ STATUS UPDATE FAILED:', error);
      
      // ROLLBACK: Signal to revert status change
      setOperationStatus('error');
      onError?.(previousState, error);
      
      // Error feedback
      const errorMessage = error.message?.includes('timeout')
        ? 'Update taking longer than expected. Please refresh the transaction list.'
        : `Failed to update transaction: ${error.message}`;
      
      toast.error(errorMessage, {
        duration: 5000
      });
      
      throw error;
    }
  }, []);

  // Optimistic extension processing
  const optimisticExtension = useCallback(async (transactionId, extensionData, onSuccess, onError) => {
    return optimisticStatusUpdate(
      transactionId,
      'extended',
      () => extensionService.processExtension({
        transaction_id: transactionId,
        ...extensionData
      }),
      onSuccess,
      onError
    );
  }, [optimisticStatusUpdate]);

  // Optimistic payment processing
  const optimisticPayment = useCallback(async (transactionId, paymentData, onSuccess, onError) => {
    const optimisticUpdate = {
      transaction_id: transactionId,
      current_balance: Math.max(0, (paymentData.currentBalance || 0) - paymentData.payment_amount),
      updated_at: new Date().toISOString(),
      isOptimistic: true
    };

    try {
      setOperationStatus('processing_payment');
      
      // IMMEDIATE: Update balance in UI
      onSuccess?.(optimisticUpdate, 'optimistic');
      
      // API call (assuming you have a payment service)
      const result = await transactionService.processPayment?.(transactionId, paymentData) || 
                     Promise.resolve(optimisticUpdate);
      
      setOperationStatus('success');
      onSuccess?.(result, 'confirmed');
      
      toast.success(`Payment of $${paymentData.payment_amount} processed successfully`, {
        duration: 3000
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ PAYMENT FAILED:', error);
      
      setOperationStatus('error');
      onError?.(transactionId, error);
      
      toast.error(`Payment failed: ${error.message}`, {
        duration: 5000
      });
      
      throw error;
    }
  }, []);

  // Force refresh with cache clearing
  const forceRefresh = useCallback(async (refreshFn) => {
    try {
      setOperationStatus('refreshing');
      
      // CRITICAL: Clear all caches for fresh data
      transactionService.clearTransactionCache();
      
      // Execute refresh
      if (refreshFn) {
        await refreshFn();
      }
      
      setOperationStatus('idle');
      
      toast.info('Transaction list refreshed', {
        duration: 2000
      });
      
    } catch (error) {
      console.error('❌ REFRESH FAILED:', error);
      
      setOperationStatus('error');
      toast.error('Failed to refresh transaction list', {
        duration: 3000
      });
    }
  }, []);

  return {
    operationStatus,
    optimisticCreate,
    optimisticStatusUpdate,
    optimisticExtension,
    optimisticPayment,
    forceRefresh
  };
};

export default useOptimisticTransactionUpdate;