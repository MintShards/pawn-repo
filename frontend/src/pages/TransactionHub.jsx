import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Receipt, 
  DollarSign, 
  Clock, 
  Plus,
  LayoutDashboard,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle,
  Crown,
  UserCheck,
  FileBarChart,
  FileText,
  CreditCard,
  LogOut,
  Calendar,
  Package,
  Phone,
  TrendingUp,
  Mail,
  Trash2,
  X,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { handleError, handleSuccess } from '../utils/errorHandling';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { ThemeToggle } from '../components/ui/theme-toggle';
import TransactionList from '../components/transaction/TransactionList';
import CreatePawnDialogRedesigned from '../components/transaction/CreatePawnDialogRedesigned';
import PaymentForm from '../components/transaction/components/PaymentForm';
import ExtensionForm from '../components/transaction/components/ExtensionForm';
import StatusUpdateForm from '../components/transaction/components/StatusUpdateForm';
import StatusBadge from '../components/transaction/components/StatusBadge';
import TransactionNotesDisplay from '../components/transaction/TransactionNotesDisplay';
import { formatTransactionId, formatStorageLocation, formatCurrency } from '../utils/transactionUtils';
import { getRoleTitle, getUserDisplayString } from '../utils/roleUtils';
import { formatRedemptionDate, formatBusinessDate, canReversePayment, canCancelExtension } from '../utils/timezoneUtils';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../components/ui/resizable';
import { ScrollArea } from '../components/ui/scroll-area';
import StatsPanel from '../components/ui/realtime-stats-panel';
import useStatsPolling from '../hooks/useStatsPolling';
import transactionService from '../services/transactionService';
import extensionService from '../services/extensionService';
import customerService from '../services/customerService';
import authService from '../services/authService';
import statsCacheService from '../services/statsCacheService';
import paymentService from '../services/paymentService';
import reversalService from '../services/reversalService';
import AdminApprovalDialog from '../components/common/AdminApprovalDialog';

const TransactionHub = () => {
  const { user, logout, loading, fetchUserDataIfNeeded, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedTransactionCustomer, setSelectedTransactionCustomer] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showExtensionForm, setShowExtensionForm] = useState(false);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [showStatusUpdateForm, setShowStatusUpdateForm] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState(null);
  const [auditEntries, setAuditEntries] = useState([]);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [processingCancel, setProcessingCancel] = useState(null);
  const [loadingTransactionDetails, setLoadingTransactionDetails] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Add refresh key for TransactionList
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loadingCustomerDetails, setLoadingCustomerDetails] = useState(false);
  const [customerTransactions, setCustomerTransactions] = useState([]);
  const [showQuickPayment, setShowQuickPayment] = useState(false);
  const [showQuickExtension, setShowQuickExtension] = useState(false);
  
  // Admin approval dialog states
  const [showPaymentReversalDialog, setShowPaymentReversalDialog] = useState(false);
  const [showExtensionCancelDialog, setShowExtensionCancelDialog] = useState(false);
  const [showVoidApprovalDialog, setShowVoidApprovalDialog] = useState(false);
  const [pendingReversalPaymentId, setPendingReversalPaymentId] = useState(null);
  const [pendingReversalTransaction, setPendingReversalTransaction] = useState(null);
  const [pendingCancelExtensionId, setPendingCancelExtensionId] = useState(null);
  const [pendingCancelTransaction, setPendingCancelTransaction] = useState(null);
  const [pendingVoidTransaction, setPendingVoidTransaction] = useState(null);
  const [reversalEligibility, setReversalEligibility] = useState(null);
  
  // Get real-time stats data
  const { 
    newToday, 
    todaysCollection, 
    maturityThisWeek 
  } = useStatsPolling({ refreshInterval: 60000 });
  
  // Optimized timeline calculation with memoization and performance improvements
  const timelineData = useMemo(() => {
    const payments = paymentHistory?.payments || [];
    const extensions = selectedTransaction?.extensions || selectedTransaction?.transaction?.extensions || [];
    const audits = auditEntries || [];
    
    // Build timeline events array with filtering
    const timelineEvents = [];
    
    // Add payment events (reverse order for newest first)
    for (let i = payments.length - 1; i >= 0; i--) {
      const payment = payments[i];
      timelineEvents.push({
        type: 'payment',
        date: new Date(payment.payment_date || payment.created_at),
        data: payment,
        paymentIndex: i + 1,
        key: `payment-${payment.payment_id || i}-${payment.is_voided ? 'voided' : 'active'}`
      });
    }
    
    // Add extension events (reverse order for newest first)
    for (let i = extensions.length - 1; i >= 0; i--) {
      const extension = extensions[i];
      timelineEvents.push({
        type: 'extension',
        date: new Date(extension.extension_date || extension.created_at),
        data: extension,
        extensionIndex: i + 1,
        key: `extension-${extension.extension_id || i}-${extension.is_cancelled ? 'cancelled' : 'active'}`
      });
    }
    
    // Check if there are any voided payments to filter redemption-related audit entries
    const hasVoidedPayments = payments.some(payment => payment.is_voided);
    
    // Find redemption-related audit entries to merge
    const redemptionAudit = audits.find(audit => 
      audit.action_summary === 'Transaction redeemed' || 
      audit.action_type === 'redemption_completed'
    );
    
    // Add audit events with conditional filtering and merging
    for (let i = 0; i < audits.length; i++) {
      const audit = audits[i];
      
      // Skip if there are voided payments
      if (hasVoidedPayments && (
        audit.action_summary === 'Transaction redeemed' ||
        audit.action_summary === 'Payment processed' ||
        audit.action_type === 'redemption_completed' ||
        audit.action_type === 'payment_processed'
      )) {
        continue;
      }
      
      // Merge redemption and payment processed entries into one
      if (audit.action_summary === 'Transaction redeemed' || audit.action_type === 'redemption_completed') {
        // Use only the redemption details since "all amounts paid in full" already implies $0 balance
        const details = redemptionAudit?.details || 'All amounts paid in full. Items ready for pickup';
        
        timelineEvents.push({
          type: 'audit',
          date: new Date(audit.timestamp),
          data: {
            ...audit,
            action_summary: 'Transaction Redeemed',
            details: details
          },
          auditIndex: audits.length - i,
          key: `audit-${audit.related_id || i}-redemption-merged`
        });
        continue;
      }
      
      // Skip the separate "Payment processed" entry if we already handled redemption
      if ((audit.action_summary === 'Payment processed' || audit.action_type === 'payment_processed') && redemptionAudit) {
        continue;
      }
      
      timelineEvents.push({
        type: 'audit',
        date: new Date(audit.timestamp),
        data: audit,
        auditIndex: audits.length - i,
        key: `audit-${audit.related_id || i}-${audit.action_type}`
      });
    }
    
    // Sort all events by date (most recent first)
    return timelineEvents.sort((a, b) => b.date - a.date);
  }, [
    paymentHistory?.payments,
    selectedTransaction?.extensions,
    selectedTransaction?.transaction?.extensions,
    auditEntries
  ]);

  // Authentication check - redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
      return;
    }
    
    // Fetch user data if not already loaded
    if (isAuthenticated && !user && fetchUserDataIfNeeded) {
      fetchUserDataIfNeeded();
    }
  }, [user, loading, isAuthenticated, fetchUserDataIfNeeded, navigate]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }


  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Handle creating new transaction
  const handleCreateNew = () => {
    setShowCreateForm(true);
  };

  // Handle successful transaction creation
  const handleTransactionCreated = async (newTransaction) => {
    setShowCreateForm(false);
    
    // Invalidate stats cache for immediate updates
    await statsCacheService.invalidateAfterTransactionCreation(
      newTransaction.transaction_id || newTransaction.formatted_id
    );
    
    setRefreshKey(prev => prev + 1); // Trigger immediate TransactionList refresh
    handleSuccess(`Transaction #${formatTransactionId(newTransaction)} created successfully`);
  };

  // Optimized timeline refresh function for real-time updates
  const refreshTimelineData = async (transactionId, skipTransaction = false) => {
    try {
      // Clear any browser caches for immediate data fetch
      if (window.caches) {
        window.caches.keys().then(names => {
          names.forEach(name => {
            if (name.includes('api') || name.includes('transaction')) {
              window.caches.delete(name);
            }
          });
        }).catch(() => {}); // Ignore cache clearing errors
      }

      // Smart parallel fetch - skip transaction data if we just optimistically updated it
      const timestamp = Date.now();
      const fetchPromises = [
        paymentService.getPaymentHistory(transactionId).catch(error => {
          console.warn('Failed to refresh payment history:', error);
          return paymentHistory; // Keep existing data if fetch fails
        }),
        extensionService.getExtensionHistory(transactionId, true).catch(error => {
          console.warn('Failed to refresh extensions:', error);
          return selectedTransaction?.extensions || []; // Keep existing data if fetch fails
        }),
        transactionService.getAuditEntries(transactionId, 50, true).catch(error => {
          console.warn('Failed to refresh audit entries:', error);
          return auditEntries; // Keep existing data if fetch fails
        })
      ];

      // Only fetch transaction data if not skipped (for performance)
      if (!skipTransaction) {
        fetchPromises.push(
          authService.apiRequest(`/api/v1/pawn-transaction/${transactionId}/summary?_t=${timestamp}&refresh=true`, { 
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          }).catch(error => {
            console.warn('Failed to refresh transaction:', error);
            // If 403, user might need to re-authenticate
            if (error.message && error.message.includes('403')) {
              console.warn('Permission denied - user may need to re-authenticate');
              // Could optionally trigger a re-authentication flow here
              // For now, just gracefully handle the error
            }
            return selectedTransaction; // Keep existing data if fetch fails
          })
        );
      }

      const results = await Promise.all(fetchPromises);
      let paymentHistoryData, extensionsData, auditEntriesData, transactionData;
      
      if (skipTransaction) {
        [paymentHistoryData, extensionsData, auditEntriesData] = results;
      } else {
        [paymentHistoryData, extensionsData, auditEntriesData, transactionData] = results;
      }

      // Update payment history with validation
      if (paymentHistoryData && paymentHistoryData !== paymentHistory) {
        // Validate payment history structure
        if (paymentHistoryData.payments && Array.isArray(paymentHistoryData.payments)) {
          setPaymentHistory(paymentHistoryData);
        }
      }
      
      // Update audit entries with validation
      if (auditEntriesData && Array.isArray(auditEntriesData) && auditEntriesData !== auditEntries) {
        setAuditEntries(auditEntriesData);
      }

      // Update extensions with improved validation
      if (extensionsData) {
        let extensionArray = [];
        
        // Robust extension data parsing
        try {
          if (Array.isArray(extensionsData)) {
            extensionArray = extensionsData.filter(ext => ext && typeof ext === 'object');
          } else if (extensionsData && Array.isArray(extensionsData.extensions)) {
            extensionArray = extensionsData.extensions.filter(ext => ext && typeof ext === 'object');
          }
        } catch (error) {
          console.warn('Error processing extension data:', error);
          extensionArray = [];
        }
        
        // Update transaction with validated extension data
        const updatedTransaction = transactionData || selectedTransaction;
        if (updatedTransaction && typeof updatedTransaction === 'object') {
          updatedTransaction.extensions = extensionArray;
          updatedTransaction.hasExtensions = extensionArray.length > 0;
          setSelectedTransaction({...updatedTransaction});
        }
      }

      // Immediate list refresh for responsive UI
      setRefreshKey(prev => prev + 1);
      
    } catch (error) {
      console.error('Error in refreshTimelineData:', error);
      // Fallback to full refresh if optimized refresh fails
      if (selectedTransaction) {
        await handleViewTransaction(selectedTransaction);
      }
    }
  };

  // Handle viewing transaction details
  const handleViewTransaction = async (transaction) => {
    setLoadingTransactionDetails(true);
    setShowTransactionDetails(true);
    setSelectedTransaction(null); // Clear any stale data first
    setSelectedTransactionCustomer(null); // Reset customer data
    
    try {
      // Fetch comprehensive transaction summary with items and balance (with cache busting)
      const bustCacheUrl = `/api/v1/pawn-transaction/${transaction.transaction_id}/summary?_t=${Date.now()}`;
      const fullTransaction = await authService.apiRequest(bustCacheUrl, { method: 'GET' });
      // Transaction details loaded successfully
      
      // Fetch customer details if available
      const customerPhone = transaction.customer_id || transaction.customer_phone;
      if (customerPhone && customerPhone !== 'No Customer') {
        try {
          const customerData = await customerService.getCustomerByPhone(customerPhone);
          setSelectedTransactionCustomer(customerData);
        } catch (error) {
          console.warn('Could not fetch customer details:', error);
          // Continue without customer details
        }
      }
      
      // Fetch extensions separately with cache busting
      try {
        const extensions = await extensionService.getExtensionHistory(transaction.transaction_id, true); // bustCache = true
        // Handle different response formats
        let extensionArray = [];
        if (Array.isArray(extensions)) {
          extensionArray = extensions;
        } else if (extensions && Array.isArray(extensions.extensions)) {
          extensionArray = extensions.extensions;
        } else if (extensions && typeof extensions === 'object') {
          extensionArray = [extensions];
        }
        
        // Add extensions to the transaction data
        fullTransaction.extensions = extensionArray;
        fullTransaction.hasExtensions = extensionArray.length > 0;
      } catch (extensionError) {
        // Failed to load extensions - continue without them
        console.warn('Could not fetch extensions:', extensionError);
        fullTransaction.extensions = [];
        fullTransaction.hasExtensions = false;
      }
      
      // Fetch payment history
      try {
        const paymentHistoryData = await paymentService.getPaymentHistory(transaction.transaction_id);
        setPaymentHistory(paymentHistoryData);
      } catch (paymentError) {
        console.warn('Could not fetch payment history:', paymentError);
        setPaymentHistory(null);
      }
      
      // Fetch audit entries for timeline
      try {
        const auditData = await transactionService.getAuditEntries(transaction.transaction_id, 50);
        setAuditEntries(auditData);
      } catch (auditError) {
        console.warn('Could not fetch audit entries:', auditError);
        setAuditEntries([]);
      }
      
      // Set the final transaction data
      setSelectedTransaction(fullTransaction);
    } catch (error) {
      // Failed to load transaction details - try fallback
      // If summary fails, try to get basic transaction data
      try {
        const basicTransaction = await transactionService.getTransactionById(transaction.transaction_id);
        setSelectedTransaction(basicTransaction);
      } catch (fallbackError) {
        // Failed to load basic transaction data - use original data
        // Keep the original transaction data as fallback
        handleError(fallbackError, 'Loading transaction details');
      }
    } finally {
      setLoadingTransactionDetails(false);
    }
  };

  // Handle viewing customer details
  const handleViewCustomer = async (customerPhone) => {
    try {
      setLoadingCustomerDetails(true);
      setShowCustomerDetails(true);
      setSelectedCustomer(null); // Clear previous data
      setCustomerTransactions([]); // Clear previous transactions
      
      // Fetch customer data and transaction history in parallel
      const [customerData, transactionsData] = await Promise.all([
        customerService.getCustomerByPhone(customerPhone),
        transactionService.getAllTransactions({ customer_id: customerPhone, page_size: 100 })
      ]);
      
      if (customerData) {
        setSelectedCustomer(customerData);
        setCustomerTransactions(transactionsData.transactions || []);
      } else {
        handleError(new Error('Customer not found'), 'Loading customer details');
        setShowCustomerDetails(false);
      }
    } catch (error) {
      // Failed to load customer details
      handleError(error, 'Loading customer details');
      setShowCustomerDetails(false);
    } finally {
      setLoadingCustomerDetails(false);
    }
  };

  const findTransactionByDisplayId = async (displayId) => {
    try {
      // Use unified search for efficient transaction lookup
      const searchResult = await transactionService.unifiedSearch({
        search_text: displayId.trim(),
        search_type: 'auto_detect',
        include_extensions: true,
        include_items: true,
        include_customer: true,
        page: 1,
        page_size: 5 // Should only need 1, but use small buffer
      });
      
      const transactions = searchResult.transactions || [];
      
      if (transactions.length === 0) {
        throw new Error(`Transaction ${displayId} not found`);
      }
      
      // Return the first matching transaction (should be exact match)
      return transactions[0];
    } catch (error) {
      throw error;
    }
  };

  // Handle payment processing
  const handlePayment = (transaction) => {
    setSelectedTransaction(transaction);
    setShowPaymentForm(true);
  };

  // Handle successful payment
  const handlePaymentSuccess = async (paymentResult) => {
    setShowPaymentForm(false);
    
    // Optimistic UI update - immediately add the payment to the timeline
    if (paymentResult && selectedTransaction?.transaction_id) {
      const newPayment = {
        payment_id: paymentResult.payment_id || `temp-${Date.now()}`,
        payment_amount: paymentResult.payment_amount || paymentResult.amount,
        payment_date: paymentResult.payment_date || new Date().toISOString(),
        payment_method: paymentResult.payment_method || 'cash',
        created_at: new Date().toISOString(),
        created_by: user?.user_id,
        is_voided: false
      };

      // Add new payment to existing payment history for immediate timeline update
      const optimisticPaymentHistory = { ...paymentHistory };
      if (optimisticPaymentHistory?.payments) {
        optimisticPaymentHistory.payments = [newPayment, ...optimisticPaymentHistory.payments];
      } else {
        optimisticPaymentHistory.payments = [newPayment];
      }
      setPaymentHistory(optimisticPaymentHistory);
    }
    
    // Invalidate stats cache and transaction cache
    await statsCacheService.invalidateAfterPayment(
      paymentResult.transaction_id,
      paymentResult.payment_amount
    );
    transactionService.clearTransactionCache();
    
    // If transaction details dialog is open, refresh the transaction data
    if (showTransactionDetails && selectedTransaction) {
      // Use the optimized refresh function for faster updates (skip transaction since we have optimistic update)
      refreshTimelineData(selectedTransaction.transaction_id, true).catch(error => {
        console.error('Failed to refresh timeline after payment:', error);
        // Fallback to full refresh
        handleViewTransaction(selectedTransaction).catch(console.error);
      });
    }
    
    // Always refresh the transaction list to show updated balance/status
    setRefreshKey(prev => prev + 1);
    handleSuccess('Payment processed successfully');
  };

  // Handle successful extension
  const handleExtensionSuccess = async (extensionResult) => {
    setShowExtensionForm(false);
    
    // Optimistic UI update - immediately add the extension to the timeline
    if (extensionResult && selectedTransaction?.transaction_id) {
      const newExtension = {
        extension_id: extensionResult.extension_id || `temp-${Date.now()}`,
        extension_months: extensionResult.extension_months || 1,
        extension_fee: extensionResult.extension_fee || extensionResult.total_extension_fee,
        extension_date: extensionResult.extension_date || new Date().toISOString(),
        created_at: new Date().toISOString(),
        created_by: user?.user_id,
        is_cancelled: false
      };

      // Add new extension to existing extensions for immediate timeline update
      const optimisticTransaction = { ...selectedTransaction };
      if (optimisticTransaction?.extensions) {
        optimisticTransaction.extensions = [newExtension, ...optimisticTransaction.extensions];
      } else {
        optimisticTransaction.extensions = [newExtension];
      }
      optimisticTransaction.hasExtensions = true;
      setSelectedTransaction(optimisticTransaction);
    }
    
    // Invalidate stats cache and clear transaction/extension caches
    await statsCacheService.invalidateAfterExtension(
      extensionResult.transaction_id,
      extensionResult.extension_months || 3 // Default to 3 months if not provided
    );
    transactionService.clearTransactionCache();
    extensionService.clearExtensionCache();
    
    // If transaction details dialog is open, refresh the transaction data
    if (showTransactionDetails && selectedTransaction) {
      // Use the optimized refresh function for faster updates (skip transaction since we have optimistic update)
      refreshTimelineData(selectedTransaction.transaction_id, true).catch(error => {
        console.error('Failed to refresh timeline after extension:', error);
        // Fallback to full refresh
        handleViewTransaction(selectedTransaction).catch(console.error);
      });
    }
    
    // Always refresh the transaction list to show updated maturity date
    setRefreshKey(prev => prev + 1);
    handleSuccess('Extension processed successfully');
  };

  // Handle payment form cancellation - refresh transaction data to prevent stale state
  const handlePaymentCancel = async () => {
    setShowPaymentForm(false);
    
    // If transaction details dialog is open, refresh the transaction data
    if (showTransactionDetails && selectedTransaction) {
      try {
        const transactionId = selectedTransaction.transaction_id || selectedTransaction.transaction?.transaction_id;
        
        // Add cache busting to force fresh data
        const bustCacheUrl = `/api/v1/pawn-transaction/${transactionId}/summary?_t=${Date.now()}`;
        const updatedTransaction = await authService.apiRequest(bustCacheUrl, { method: 'GET' });
        
        // Always fetch extensions separately to ensure they're preserved
        try {
          const extensions = await extensionService.getExtensionHistory(transactionId, true);
          let extensionArray = [];
          if (Array.isArray(extensions)) {
            extensionArray = extensions;
          } else if (extensions && extensions.extensions) {
            extensionArray = extensions.extensions;
          }
          updatedTransaction.extensions = extensionArray;
        } catch (extError) {
          console.warn('Could not fetch extensions after payment cancel:', extError);
        }
        
        setSelectedTransaction(updatedTransaction);
      } catch (error) {
        console.error('Failed to refresh transaction after payment cancel:', error);
      }
    }
  };

  // Handle extension form cancellation - refresh transaction data to prevent stale state
  const handleExtensionCancel = async () => {
    setShowExtensionForm(false);
    
    // If transaction details dialog is open, refresh the transaction data
    if (showTransactionDetails && selectedTransaction) {
      try {
        const transactionId = selectedTransaction.transaction_id || selectedTransaction.transaction?.transaction_id;
        
        // Add cache busting to force fresh data
        const bustCacheUrl = `/api/v1/pawn-transaction/${transactionId}/summary?_t=${Date.now()}`;
        const updatedTransaction = await authService.apiRequest(bustCacheUrl, { method: 'GET' });
        
        // Always fetch extensions separately to ensure they're current
        try {
          const extensions = await extensionService.getExtensionHistory(transactionId, true);
          let extensionArray = [];
          if (Array.isArray(extensions)) {
            extensionArray = extensions;
          } else if (extensions && extensions.extensions) {
            extensionArray = extensions.extensions;
          }
          updatedTransaction.extensions = extensionArray;
        } catch (extError) {
          console.warn('Could not fetch extensions after extension cancel:', extError);
        }
        
        setSelectedTransaction(updatedTransaction);
      } catch (error) {
        console.error('Failed to refresh transaction after extension cancel:', error);
      }
    }
  };

  // Handle extension
  const handleExtension = (transaction) => {
    setSelectedTransaction(transaction);
    setShowExtensionForm(true);
  };

  // Handle status update
  const handleStatusUpdate = (transaction) => {
    setSelectedTransaction(transaction);
    setShowStatusUpdateForm(true);
  };

  // Handle transaction void (Admin only)
  const handleVoidTransaction = (transaction) => {
    // Check admin permissions
    if (!user?.role || user.role !== 'admin') {
      handleError(new Error('Only administrators can void transactions'), 'Permission denied');
      return;
    }

    // Check if transaction can be voided
    const voidableStatuses = ['active', 'overdue', 'extended', 'hold'];
    if (!voidableStatuses.includes(transaction.status)) {
      handleError(new Error(`Cannot void transaction with status: ${transaction.status}`), 'Invalid transaction state');
      return;
    }

    setPendingVoidTransaction(transaction);
    setShowVoidApprovalDialog(true);
  };
  
  // Handle payment reversal initiation
  const handlePaymentReversal = async (paymentId) => {
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
      setReversalEligibility(eligibility);
      setPendingReversalPaymentId(paymentId);
      setPendingReversalTransaction(selectedTransaction);
      setShowPaymentReversalDialog(true);
    } catch (error) {
      handleError(error, 'Failed to check reversal eligibility');
    }
  };

  // Handle approved payment reversal
  const handlePaymentReversalApproval = async (approvalData) => {
    if (!pendingReversalPaymentId) return;
    
    setProcessingCancel(`payment-${pendingReversalPaymentId}`);
    
    try {
      // Optimistic UI update - immediately mark payment as voided in local state
      const optimisticPaymentHistory = { ...paymentHistory };
      if (optimisticPaymentHistory?.payments) {
        optimisticPaymentHistory.payments = optimisticPaymentHistory.payments.map(payment => {
          if (payment.payment_id === pendingReversalPaymentId) {
            return {
              ...payment,
              is_voided: true,
              void_reason: `REVERSAL: ${approvalData.reason}`,
              voided_at: new Date().toISOString(),
              voided_by: user?.user_id
            };
          }
          return payment;
        });
        setPaymentHistory(optimisticPaymentHistory);
      }
      
      // Close dialog immediately for better UX
      setShowPaymentReversalDialog(false);
      setPendingReversalPaymentId(null);
      setPendingReversalTransaction(null);
      setReversalEligibility(null);
      
      // Process the reversal
      const reversalData = {
        reversal_reason: approvalData.reason,
        admin_pin: approvalData.admin_pin
      };
      
      await reversalService.reversePayment(pendingReversalPaymentId, reversalData);
      
      // Background refresh to sync with server
      if (selectedTransaction?.transaction_id) {
        refreshTimelineData(selectedTransaction.transaction_id).catch(console.error);
      }
      
      // Trigger a refresh of the transaction list
      setRefreshKey(prev => prev + 1);
      
      handleSuccess('Payment reversed successfully');
    } catch (error) {
      handleError(error, 'Payment reversal failed');
      // Revert optimistic update on failure
      if (selectedTransaction?.transaction_id) {
        refreshTimelineData(selectedTransaction.transaction_id).catch(console.error);
      }
    } finally {
      setProcessingCancel(null);
    }
  };

  // Handle payment reversal cancellation
  const handlePaymentReversalCancel = () => {
    setShowPaymentReversalDialog(false);
    setPendingReversalPaymentId(null);
    setPendingReversalTransaction(null);
    setReversalEligibility(null);
  };
  
  // Handle extension cancellation initiation
  const handleExtensionCancelAction = async (extensionId) => {
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
      setReversalEligibility(eligibility);
      setPendingCancelExtensionId(extensionId);
      setPendingCancelTransaction(selectedTransaction);
      setShowExtensionCancelDialog(true);
    } catch (error) {
      handleError(error, 'Failed to check cancellation eligibility');
    }
  };

  // Handle approved extension cancellation
  const handleExtensionCancelApproval = async (approvalData) => {
    if (!pendingCancelExtensionId) return;
    
    setProcessingCancel(`extension-${pendingCancelExtensionId}`);
    
    try {
      // Optimistic UI update - immediately mark extension as cancelled in local state
      const optimisticTransaction = { ...selectedTransaction };
      if (optimisticTransaction?.extensions) {
        optimisticTransaction.extensions = optimisticTransaction.extensions.map(extension => {
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
        });
        setSelectedTransaction(optimisticTransaction);
      }
      
      // Close dialog immediately for better UX
      setShowExtensionCancelDialog(false);
      setPendingCancelExtensionId(null);
      setPendingCancelTransaction(null);
      setReversalEligibility(null);
      
      // Process the cancellation
      const cancellationData = {
        cancellation_reason: approvalData.reason,
        admin_pin: approvalData.admin_pin
      };
      
      await reversalService.cancelExtension(pendingCancelExtensionId, cancellationData);
      
      // Background refresh to sync with server
      if (selectedTransaction?.transaction_id) {
        refreshTimelineData(selectedTransaction.transaction_id).catch(console.error);
      }
      
      // Trigger a refresh of the transaction list
      setRefreshKey(prev => prev + 1);
      
      handleSuccess('Extension cancelled successfully');
    } catch (error) {
      handleError(error, 'Extension cancellation failed');
      // Revert optimistic update on failure
      if (selectedTransaction?.transaction_id) {
        refreshTimelineData(selectedTransaction.transaction_id).catch(console.error);
      }
    } finally {
      setProcessingCancel(null);
    }
  };

  // Handle extension cancellation cancellation
  const handleExtensionCancelCancel = () => {
    setShowExtensionCancelDialog(false);
    setPendingCancelExtensionId(null);
    setPendingCancelTransaction(null);
    setReversalEligibility(null);
  };

  // Handle void transaction approval
  const handleVoidTransactionApproval = async (approvalData) => {
    if (!pendingVoidTransaction) return;

    try {
      setProcessingCancel(`void-${pendingVoidTransaction.transaction_id}`);

      const voidData = {
        void_reason: approvalData.reason,
        admin_pin: approvalData.adminPin
      };

      await transactionService.voidTransaction(pendingVoidTransaction.transaction_id, voidData);
      
      // Clear transaction cache to ensure fresh data
      transactionService.clearTransactionCache();
      
      // Close dialog and clear state
      setShowVoidApprovalDialog(false);
      setPendingVoidTransaction(null);

      // If transaction details dialog is open and it's the same transaction, refresh the timeline immediately
      if (showTransactionDetails && selectedTransaction?.transaction_id === pendingVoidTransaction.transaction_id) {
        // Small delay to ensure backend audit entry is created
        setTimeout(() => {
          refreshTimelineData(selectedTransaction.transaction_id).catch(error => {
            console.error('Failed to refresh timeline after void:', error);
            // Fallback to full refresh
            handleViewTransaction(selectedTransaction).catch(console.error);
          });
        }, 500);
      }
      
      // Trigger a refresh of the transaction list
      setRefreshKey(prev => prev + 1);
      
      handleSuccess('Transaction voided successfully');
      
    } catch (error) {
      // Handle error with detailed messages
      let errorMessage = 'Failed to void transaction';
      
      if (error.message?.includes('401') || error.message?.includes('403')) {
        errorMessage = 'Invalid admin credentials';
      } else if (error.message?.includes('400')) {
        errorMessage = error.message.includes('status') 
          ? 'Transaction cannot be voided in current status'
          : 'Invalid void request';
      } else if (error.message?.includes('404')) {
        errorMessage = 'Transaction not found';
      }
      
      handleError(error, errorMessage);
    } finally {
      setProcessingCancel(null);
    }
  };

  // Handle successful status update
  const handleStatusUpdateSuccess = async (statusUpdateResult) => {
    setShowStatusUpdateForm(false);
    
    // Optimistically update the current transaction status immediately
    if (selectedTransaction && statusUpdateResult) {
      const updatedTransaction = { ...selectedTransaction };
      // Update the status at both possible locations
      if (updatedTransaction.transaction) {
        updatedTransaction.transaction.status = statusUpdateResult.status || statusUpdateResult.new_status;
      }
      updatedTransaction.status = statusUpdateResult.status || statusUpdateResult.new_status;
      setSelectedTransaction(updatedTransaction);
    }
    
    // Invalidate stats cache for status changes
    if (statusUpdateResult && statusUpdateResult.transaction_id) {
      await statsCacheService.invalidateAfterStatusChange(
        statusUpdateResult.transaction_id,
        statusUpdateResult.old_status || 'unknown',
        statusUpdateResult.new_status || 'unknown'
      );
    }
    
    // Clear transaction cache to ensure fresh data
    transactionService.clearTransactionCache();
    
    // If transaction details dialog is open, refresh the timeline immediately
    if (showTransactionDetails && selectedTransaction) {
      // Skip transaction fetch to avoid 403 errors, just refresh timeline data
      refreshTimelineData(selectedTransaction.transaction_id, true).catch(error => {
        console.error('Failed to refresh timeline after status update:', error);
        // Don't fallback to full refresh if it's a 403 - the optimistic update already worked
        if (!error.message || !error.message.includes('403')) {
          handleViewTransaction(selectedTransaction).catch(console.error);
        }
      });
    }
    
    // Refresh transaction list
    setRefreshKey(prev => prev + 1);
  };

  // Format date helper
  // ============================================================================
  // TIMEZONE SAFETY: CRITICAL FOR PREVENTING RECURRING TIMEZONE BUGS
  // ============================================================================
  // This function uses the centralized business timezone utility to ensure
  // ALL dates in this component display in Pacific Time (business timezone).
  // 
  // NEVER modify this to use formatLocalDate() or user timezone functions!
  // 
  // For details, see: /frontend/TIMEZONE_GUIDELINES.md
  const formatDate = (dateString) => {
    return formatBusinessDate(dateString);
  };


  // Helper to get transaction field consistently
  const getTransactionField = (field) => {
    return selectedTransaction?.transaction?.[field] || selectedTransaction?.[field];
  };

  // Helper to get transaction status
  const getTransactionStatus = () => {
    return getTransactionField('status') || 'Unknown';
  };

  // Helper to check if status allows actions
  const canProcessActions = () => {
    const status = getTransactionStatus();
    return ['active', 'overdue', 'extended'].includes(status);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      {/* Modern Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            
            {/* Left: Brand & Navigation */}
            <div className="flex items-center space-x-8">
              {/* Vault Logo Brand */}
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full border-2 border-amber-500 bg-gradient-to-br from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700 shadow-lg flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full border border-amber-400 bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 bg-gradient-to-br from-orange-500 to-red-600 rounded-sm"></div>
                    </div>
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900"></div>
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                    PawnRepo
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1">
                    Transaction Hub
                  </p>
                </div>
              </div>

              {/* Navigation Pills */}
              <nav className="hidden md:flex items-center space-x-1">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/')}
                  className="h-9 px-3 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
                <div className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 rounded-lg border border-blue-100 dark:border-blue-900/50">
                  <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Transactions
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/customers')}
                  className="h-9 px-3 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  <UserCheck className="w-4 h-4 mr-2" />
                  Customers
                </Button>
              </nav>
            </div>

            {/* Right: User & Controls */}
            <div className="flex items-center space-x-4">
              {/* User Profile Card */}
              <Card className="border-0 shadow-sm bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center space-x-3 px-4 py-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage 
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.user_id || 'XX'}&backgroundColor=f59e0b`} 
                    />
                    <AvatarFallback className="bg-amber-500 text-white text-xs font-semibold">
                      {user?.user_id || 'XX'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {user?.first_name ? user.first_name : getUserDisplayString(user, loading)}
                      </span>
                      {user?.role === 'admin' && (
                        <Crown className="w-3 h-3 text-amber-500" />
                      )}
                      {user?.role === 'staff' && (
                        <UserCheck className="w-3 h-3 text-blue-500" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {getRoleTitle(user?.role, loading)}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Controls */}
              <div className="flex items-center space-x-2">
                <ThemeToggle />
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleLogout}
                  className="h-9 px-3 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline ml-2">Sign Out</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Transaction Management
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Manage pawn transactions, process payments, and track loan extensions
            </p>
          </div>
        </div>

        {/* Stats Panel - Only render when authenticated and user data loaded */}
        {isAuthenticated && user && (
          <div className="mb-8">
            <StatsPanel 
              refreshInterval={60000} // Reduced to 60-second refresh to prevent rate limiting
              refreshTrigger={refreshKey} // Pass refresh trigger to update stats after actions
              onStatClick={(filterType, filterValue) => {
              }}
            />
          </div>
        )}

        {/* Quick Actions & Transaction Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Quick Actions & Reports Sidebar */}
          <div className="lg:col-span-1 space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
            {/* Quick Actions Card */}
            <Card className="border-0 shadow-md bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-hidden relative z-10">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 pointer-events-none"></div>
              <CardHeader className="relative pb-3">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-900"></div>
                  </div>
                  <div>
                    <CardTitle className="text-slate-900 dark:text-white text-lg font-bold">Quick Actions</CardTitle>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Frequently used operations</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative space-y-3 pt-2 z-20">
                <Button 
                  onClick={handleCreateNew}
                  className="w-full justify-start h-11 bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-900 border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all duration-200 group relative z-30 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white dark:hover:text-white dark:border-slate-600/50 dark:hover:border-slate-500/70" 
                  variant="outline"
                >
                  <div className="w-6 h-6 bg-slate-200/60 dark:bg-slate-500/30 rounded-md flex items-center justify-center mr-2 group-hover:bg-slate-300/70 dark:group-hover:bg-slate-400/40 transition-colors">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">New Transaction</span>
                </Button>

                <Button 
                  onClick={() => setShowQuickPayment(true)}
                  className="w-full justify-start h-11 bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-900 border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all duration-200 group dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300 dark:hover:text-white dark:border-slate-600/30 dark:hover:border-slate-500/50" 
                  variant="outline"
                >
                  <div className="w-6 h-6 bg-slate-200/60 dark:bg-slate-600/30 rounded-md flex items-center justify-center mr-2 group-hover:bg-slate-300/70 dark:group-hover:bg-slate-500/40 transition-colors">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">Quick Payment</span>
                </Button>

                <Button 
                  onClick={() => setShowQuickExtension(true)}
                  className="w-full justify-start h-11 bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-900 border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all duration-200 group dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300 dark:hover:text-white dark:border-slate-600/30 dark:hover:border-slate-500/50" 
                  variant="outline"
                >
                  <div className="w-6 h-6 bg-slate-200/60 dark:bg-slate-600/30 rounded-md flex items-center justify-center mr-2 group-hover:bg-slate-300/70 dark:group-hover:bg-slate-500/40 transition-colors">
                    <Clock className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">Quick Extension</span>
                </Button>
                
                <Button 
                  className="w-full justify-start h-11 bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-900 border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all duration-200 group dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300 dark:hover:text-white dark:border-slate-600/30 dark:hover:border-slate-500/50" 
                  variant="outline"
                  onClick={() => navigate('/customers')}
                >
                  <div className="w-6 h-6 bg-slate-200/60 dark:bg-slate-600/30 rounded-md flex items-center justify-center mr-2 group-hover:bg-slate-300/70 dark:group-hover:bg-slate-500/40 transition-colors">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">Manage Customers</span>
                </Button>
              </CardContent>
            </Card>

            {/* Reports Section */}
            <Card className="border-0 shadow-md bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-hidden relative z-10">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 pointer-events-none"></div>
              <CardHeader className="relative pb-3">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                      <FileBarChart className="w-5 h-5 text-white" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-orange-500 rounded-full border-2 border-white dark:border-slate-900"></div>
                  </div>
                  <div>
                    <CardTitle className="text-slate-900 dark:text-white text-lg font-bold">Reports</CardTitle>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Analytics and documentation</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative space-y-3 pt-2 z-20">
                <Button 
                  className="w-full justify-start h-11 bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-900 border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all duration-200 group dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white dark:hover:text-white dark:border-slate-600/50 dark:hover:border-slate-500/70" 
                  variant="outline"
                >
                  <div className="w-6 h-6 bg-slate-200/60 dark:bg-slate-500/30 rounded-md flex items-center justify-center mr-2 group-hover:bg-slate-300/70 dark:group-hover:bg-slate-400/40 transition-colors">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">Today's Summary</span>
                </Button>

                <Button 
                  className="w-full justify-start h-11 bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-900 border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all duration-200 group dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300 dark:hover:text-white dark:border-slate-600/30 dark:hover:border-slate-500/50" 
                  variant="outline"
                >
                  <div className="w-6 h-6 bg-slate-200/60 dark:bg-slate-600/30 rounded-md flex items-center justify-center mr-2 group-hover:bg-slate-300/70 dark:group-hover:bg-slate-500/40 transition-colors">
                    <FileBarChart className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">Generate Report</span>
                </Button>
              </CardContent>
            </Card>
            
            {/* Quick Stats Mini Card */}
            <Card className="border-0 shadow-md bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5"></div>
              <CardContent className="relative p-5">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Today's Overview</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">New Loans</span>
                    <span className="text-sm font-bold text-emerald-400">{newToday?.value || 0}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Collections</span>
                    <span className="text-sm font-bold text-blue-400">${(todaysCollection?.value || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Due Soon</span>
                    <span className="text-sm font-bold text-indigo-400">{maturityThisWeek?.value || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-0 shadow-md bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5"></div>
              <CardHeader className="relative pb-6 border-b border-slate-200/50 dark:border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                      <CreditCard className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">All Transactions</CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Search, filter, and manage all pawn transactions</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="hidden sm:flex items-center space-x-2 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-300/50 dark:border-slate-700/50">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-xs text-slate-600 dark:text-slate-400">Auto-refresh</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative bg-white/50 dark:bg-slate-950/50 p-0">
                <TransactionList
                  refreshTrigger={refreshKey}
                  onCreateNew={handleCreateNew}
                  onViewTransaction={handleViewTransaction}
                  onViewCustomer={handleViewCustomer}
                  onPayment={handlePayment}
                  onExtension={handleExtension}
                  onStatusUpdate={handleStatusUpdate}
                  onVoidTransaction={handleVoidTransaction}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Create Transaction Form */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto p-0 border-0 bg-transparent" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>Create New Pawn Transaction</DialogTitle>
            <DialogDescription>Create a new pawn transaction with customer and item details</DialogDescription>
          </DialogHeader>
          <CreatePawnDialogRedesigned
            onSuccess={handleTransactionCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentForm} onOpenChange={setShowPaymentForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-transparent" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>Quick Payment</DialogTitle>
            <DialogDescription>Process payment for selected transaction</DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <PaymentForm
              transaction={selectedTransaction}
              onSuccess={handlePaymentSuccess}
              onCancel={handlePaymentCancel}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Extension Dialog */}
      <Dialog open={showExtensionForm} onOpenChange={setShowExtensionForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-transparent" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>Quick Extension</DialogTitle>
            <DialogDescription>Extend loan period for selected transaction</DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <ExtensionForm
              transaction={selectedTransaction}
              onSuccess={handleExtensionSuccess}
              onCancel={handleExtensionCancel}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Enhanced Three-Panel Transaction Details Dialog */}
      <Dialog open={showTransactionDetails} onOpenChange={(open) => {
        setShowTransactionDetails(open);
        if (!open) {
          setSelectedTransactionCustomer(null); // Reset customer data when closing
          setPaymentHistory(null); // Reset payment history
          setShowAllPayments(false); // Reset payment view
        }
      }}>
        <DialogContent className="max-w-7xl max-h-[95vh] p-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
          <DialogHeader className="px-4 md:px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <DialogTitle className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Transaction #{selectedTransaction ? formatTransactionId(selectedTransaction.transaction || selectedTransaction) : 'Loading...'}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {loadingTransactionDetails ? 'Loading transaction details...' : 'Three-panel transaction overview'}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="flex-1 min-h-0 h-[calc(95vh-120px)]">
              {/* Loading State */}
              {loadingTransactionDetails && (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="text-slate-600 dark:text-slate-400">Loading transaction details...</span>
                  </div>
                </div>
              )}

              {/* Three-Panel Layout */}
              {!loadingTransactionDetails && (
                <ResizablePanelGroup 
                  direction="horizontal" 
                  className="h-full hidden lg:flex"
                >
                  {/* LEFT PANEL - Customer, Financial & Info */}
                  <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
                    <div className="p-6 h-full bg-slate-50/70 dark:bg-slate-800/30">
                      <ScrollArea className="h-full">
                        <div className="space-y-4 pr-4">
                          {/* Status Badge */}
                          <div 
                            className="p-3 rounded-lg border-l-4"
                            style={{
                              backgroundColor: 
                                getTransactionStatus() === 'redeemed' ? '#4CAF5015' :
                                getTransactionStatus() === 'active' ? '#2196F315' :
                                getTransactionStatus() === 'extended' ? '#00BCD415' :
                                getTransactionStatus() === 'sold' ? '#9C27B015' :
                                getTransactionStatus() === 'hold' ? '#FFC10715' :
                                getTransactionStatus() === 'forfeited' ? '#FF572215' :
                                getTransactionStatus() === 'overdue' ? '#F4433615' :
                                getTransactionStatus() === 'damaged' ? '#79554815' :
                                getTransactionStatus() === 'voided' ? '#9E9E9E15' : '#E5E7EB15',
                              borderLeftColor:
                                getTransactionStatus() === 'redeemed' ? '#4CAF50' :
                                getTransactionStatus() === 'active' ? '#2196F3' :
                                getTransactionStatus() === 'extended' ? '#00BCD4' :
                                getTransactionStatus() === 'sold' ? '#9C27B0' :
                                getTransactionStatus() === 'hold' ? '#FFC107' :
                                getTransactionStatus() === 'forfeited' ? '#FF5722' :
                                getTransactionStatus() === 'overdue' ? '#F44336' :
                                getTransactionStatus() === 'damaged' ? '#795548' :
                                getTransactionStatus() === 'voided' ? '#9E9E9E' : '#E5E7EB'
                            }}
                          >
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{
                                  backgroundColor:
                                    getTransactionStatus() === 'redeemed' ? '#4CAF50' :
                                    getTransactionStatus() === 'active' ? '#2196F3' :
                                    getTransactionStatus() === 'extended' ? '#00BCD4' :
                                    getTransactionStatus() === 'sold' ? '#9C27B0' :
                                    getTransactionStatus() === 'hold' ? '#FFC107' :
                                    getTransactionStatus() === 'forfeited' ? '#FF5722' :
                                    getTransactionStatus() === 'overdue' ? '#F44336' :
                                    getTransactionStatus() === 'damaged' ? '#795548' :
                                    getTransactionStatus() === 'voided' ? '#9E9E9E' : '#E5E7EB'
                                }}
                              ></div>
                              <span className="font-bold capitalize text-slate-900 dark:text-slate-100">
                                {getTransactionStatus()}
                              </span>
                              {getTransactionStatus() === 'overdue' && (
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                          </div>

                          {/* Customer Section */}
                          <Card 
                            className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                            onClick={() => {
                              const customerPhone = getTransactionField('customer_phone') || getTransactionField('customer_id');
                              if (customerPhone && customerPhone !== 'No Customer') {
                                handleViewCustomer(customerPhone);
                              }
                            }}
                          >
                            <CardHeader className="pb-2">
                              <CardTitle className="flex items-center space-x-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                <Phone className="w-4 h-4 text-blue-600" />
                                <span>Customer</span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              {(() => {
                                const customerPhone = getTransactionField('customer_phone') || getTransactionField('customer_id');
                                
                                // Use fetched customer data if available
                                if (selectedTransactionCustomer && customerPhone && customerPhone !== 'No Customer') {
                                  const customerName = `${selectedTransactionCustomer.first_name || ''} ${selectedTransactionCustomer.last_name || ''}`.trim().toUpperCase();
                                  return (
                                    <div className="space-y-1">
                                      <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                                        {customerName}
                                      </div>
                                      <div className="text-sm text-slate-600 dark:text-slate-400 font-mono">
                                        {customerPhone}
                                      </div>
                                    </div>
                                  );
                                } else if (customerPhone && customerPhone !== 'No Customer') {
                                  return (
                                    <div className="space-y-1">
                                      <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                                        {customerPhone}
                                      </div>
                                      {loadingTransactionDetails && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                          Loading customer details...
                                        </div>
                                      )}
                                    </div>
                                  );
                                } else {
                                  return (
                                    <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                      No Customer
                                    </div>
                                  );
                                }
                              })()}
                              {(getTransactionField('customer_phone') || getTransactionField('customer_id')) !== 'No Customer' && (
                                <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                                  Click to view profile
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          {/* Financial Summary */}
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="flex items-center space-x-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                <DollarSign className="w-4 h-4 text-green-600" />
                                <span>Financial</span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-3">
                              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                                <div className="text-xs text-green-700 dark:text-green-400 font-medium">Loan Amount</div>
                                <div className="font-bold text-lg text-green-900 dark:text-green-100">
                                  {getTransactionField('loan_amount') 
                                    ? formatCurrency(getTransactionField('loan_amount')) 
                                    : 'Not Set'}
                                </div>
                              </div>
                              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="text-xs text-blue-700 dark:text-blue-400 font-medium">Monthly Interest</div>
                                <div className="font-bold text-lg text-blue-900 dark:text-blue-100">
                                  {getTransactionField('monthly_interest_amount') 
                                    ? formatCurrency(getTransactionField('monthly_interest_amount')) 
                                    : 'Not Set'}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <div className="text-xs text-slate-600 dark:text-slate-400">Maturity</div>
                                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                    {formatDate(getTransactionField('maturity_date'))}
                                  </div>
                                </div>
                                {getTransactionField('grace_period_end') && (
                                  <div className="flex justify-between items-center">
                                    <div className="text-xs text-slate-600 dark:text-slate-400">Grace End</div>
                                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                      {formatDate(getTransactionField('grace_period_end'))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>

                          {/* Info Section */}
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="flex items-center space-x-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                <Activity className="w-4 h-4 text-purple-600" />
                                <span>Info</span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-2">
                              <div className="flex justify-between items-center">
                                <div className="text-xs text-slate-600 dark:text-slate-400">Created by:</div>
                                <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                                  User #{getTransactionField('created_by_user_id') || 'Unknown'}
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <div className="text-xs text-slate-600 dark:text-slate-400">Loan Date:</div>
                                <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                                  {formatDate(getTransactionField('pawn_date'))}
                                </div>
                              </div>
                              {getTransactionField('storage_location') && (
                                <div className="flex justify-between items-center">
                                  <div className="text-xs text-slate-600 dark:text-slate-400">Storage:</div>
                                  <div className="text-xs font-mono font-medium text-slate-900 dark:text-slate-100">
                                    {formatStorageLocation(getTransactionField('storage_location'))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          {/* Transaction Notes Section */}
                          <TransactionNotesDisplay 
                            transaction={selectedTransaction?.transaction || selectedTransaction}
                            onNotesUpdate={() => {
                              // Refresh timeline when notes are updated
                              if (selectedTransaction?.transaction_id || selectedTransaction?.transaction?.transaction_id) {
                                const transactionId = selectedTransaction.transaction_id || selectedTransaction.transaction?.transaction_id;
                                refreshTimelineData(transactionId).catch(error => {
                                  console.error('Failed to refresh timeline after notes update:', error);
                                });
                              }
                            }}
                          />
                        </div>
                      </ScrollArea>
                    </div>
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  {/* CENTER PANEL - Pawn Items (Main Focus) */}
                  <ResizablePanel defaultSize={50} minSize={40}>
                    <div className="p-6 h-full">
                      <div className="h-full flex flex-col">
                        <div className="mb-4">
                          <div className="flex items-center space-x-3 mb-2">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                              <Package className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">Pawn Items</div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                {(getTransactionField('items'))?.length || 0} item(s) in this transaction
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <ScrollArea className="flex-1">
                          {getTransactionField('items') && getTransactionField('items').length > 0 ? (
                            <div className="space-y-2 pr-4 pb-6">
                              {getTransactionField('items').map((item, index) => (
                                <Card key={index} className="hover:shadow-md transition-shadow">
                                  <CardContent className="p-2.5">
                                    <div className="space-y-1.5">
                                      <div className="flex items-start justify-between">
                                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">#{index + 1}</span>
                                          </div>
                                          <div className="font-semibold text-base text-slate-900 dark:text-slate-100 break-words min-w-0">
                                            {item.description}
                                          </div>
                                        </div>
                                        {item.estimated_value && (
                                          <div className="bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full flex-shrink-0 ml-2">
                                            <span className="text-sm font-bold text-green-700 dark:text-green-300">
                                              {formatCurrency(item.estimated_value)}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      
                                      <div className="grid grid-cols-2 gap-2">
                                        {item.category && (
                                          <div className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                            <span className="text-sm text-slate-700 dark:text-slate-300 capitalize">{item.category}</span>
                                          </div>
                                        )}
                                        {item.condition && (
                                          <div className="flex items-center space-x-2">
                                            <div className={`w-2 h-2 rounded-full ${
                                              item.condition === 'excellent' ? 'bg-green-500' :
                                              item.condition === 'good' ? 'bg-yellow-500' :
                                              item.condition === 'fair' ? 'bg-orange-500' : 'bg-red-500'
                                            }`}></div>
                                            <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">{item.condition}</span>
                                          </div>
                                        )}
                                      </div>
                                      
                                      <div className="grid grid-cols-1 gap-1">
                                        {item.serial_number && (
                                          <div className="p-1.5 bg-slate-100 dark:bg-slate-700/50 rounded">
                                            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Serial Number</div>
                                            <div className="text-sm font-mono font-medium text-slate-900 dark:text-slate-100 break-all">
                                              {item.serial_number}
                                            </div>
                                          </div>
                                        )}
                                        {item.notes && (
                                          <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded">
                                            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Internal Notes</div>
                                            <div className="text-sm text-slate-700 dark:text-slate-300 break-words">
                                              {item.notes}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <Package className="w-8 h-8 text-slate-400" />
                              </div>
                              <div className="text-slate-500 dark:text-slate-400 font-medium">No items found</div>
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </div>
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  {/* RIGHT PANEL - Actions & Timeline */}
                  <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
                    <div className="p-6 h-full bg-slate-50/70 dark:bg-slate-800/30">
                      <div className="h-full flex flex-col">
                        <div className="mb-4">
                          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Quick Actions</div>
                        </div>
                        
                        <div className="space-y-3 mb-6">
                          {canProcessActions() && (
                            <>
                              <Button 
                                onClick={() => {
                                  handlePayment(selectedTransaction?.transaction || selectedTransaction);
                                }}
                                className="w-full bg-green-600 hover:bg-green-700 text-white"
                              >
                                <DollarSign className="w-4 h-4 mr-2" />
                                Process Payment
                              </Button>
                              <Button 
                                variant="outline"
                                onClick={() => {
                                  handleExtension(selectedTransaction?.transaction || selectedTransaction);
                                }}
                                className="w-full border-blue-300 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/20 dark:hover:text-blue-300 transition-colors duration-300"
                              >
                                <Calendar className="w-4 h-4 mr-2" />
                                Extend Loan
                              </Button>
                            </>
                          )}
                          <Button 
                            variant="outline"
                            onClick={() => {
                              handleStatusUpdate(selectedTransaction?.transaction || selectedTransaction);
                            }}
                            className="w-full"
                          >
                            <Activity className="w-4 h-4 mr-2" />
                            Update Status
                          </Button>
                          
                          {/* Admin-only Void Transaction Button */}
                          {user?.role === 'admin' && (
                            <Button 
                              variant="destructive"
                              onClick={() => {
                                handleVoidTransaction(selectedTransaction?.transaction || selectedTransaction);
                              }}
                              className="w-full"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Void Transaction
                            </Button>
                          )}
                        </div>

                        {/* Timeline Section */}
                        <div className="flex-1 min-h-0 overflow-hidden">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center justify-between">
                            <span>Timeline</span>
                            {(() => {
                              const extensions = selectedTransaction?.extensions || selectedTransaction?.transaction?.extensions || [];
                              if (extensions.length === 0) return null;
                              
                              const activeExtensions = extensions.filter(ext => !ext.is_cancelled);
                              const cancelledExtensions = extensions.filter(ext => ext.is_cancelled);
                              
                              return (
                                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-2">
                                  {activeExtensions.length > 0 && (
                                    <span>{activeExtensions.length} active</span>
                                  )}
                                  {cancelledExtensions.length > 0 && (
                                    <span className="text-red-500">
                                      {cancelledExtensions.length} cancelled
                                    </span>
                                  )}
                                  {activeExtensions.length === 0 && cancelledExtensions.length > 0 && (
                                    <span className="text-red-500">All extensions cancelled</span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          <ScrollArea className="h-[calc(100%-2rem)]">
                            <div className="space-y-3 pr-4 pb-4">
                              {/* Status indicator - Most Recent */}
                              {getTransactionStatus() !== 'active' && (
                                <div className="flex space-x-3">
                                  <div 
                                    className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                                    style={{ 
                                      backgroundColor: (() => {
                                        const status = getTransactionStatus();
                                        switch (status) {
                                          case 'redeemed': return '#4CAF50';
                                          case 'active': return '#2196F3';
                                          case 'extended': return '#00BCD4';
                                          case 'sold': return '#9C27B0';
                                          case 'hold': return '#FFC107';
                                          case 'forfeited': return '#FF5722';
                                          case 'overdue': return '#F44336';
                                          case 'damaged': return '#795548';
                                          case 'voided': return '#9E9E9E';
                                          default: return '#9E9E9E';
                                        }
                                      })()
                                    }}
                                  ></div>
                                  <div>
                                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 capitalize">
                                      {getTransactionStatus()}
                                    </div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400">
                                      {(() => {
                                        const status = getTransactionStatus();
                                        if (status === 'redeemed') {
                                          // Get the raw timestamp
                                          const rawDate = getTransactionField('redeemed_date') || 
                                                         getTransactionField('redemption_date') || 
                                                         getTransactionField('updated_at');
                                          
                                          // Use the centralized business timezone utility to prevent timezone bugs
                                          const displayDate = formatRedemptionDate(rawDate);
                                          
                                          const redeemedBy = getTransactionField('redeemed_by_user_id') ||
                                                            getTransactionField('updated_by_user_id') ||
                                                            getTransactionField('processed_by_user_id') ||
                                                            getTransactionField('last_updated_by') ||
                                                            user?.user_id;
                                          
                                          return (
                                            <div>
                                              {displayDate && (
                                                <div>{displayDate}</div>
                                              )}
                                              {redeemedBy && <div>by User #{redeemedBy}</div>}
                                            </div>
                                          );
                                        }
                                        return 'Current status';
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Unified Timeline - Most Recent First (Payments + Extensions) - Optimized */}
                              {(() => {
                                const displayLimit = 10;
                                const hasMany = timelineData.length > displayLimit;
                                const displayEvents = showAllPayments ? timelineData : timelineData.slice(0, displayLimit);
                                
                                return (
                                  <>
                                    {displayEvents.map((event) => (
                                      <React.Fragment key={event.key}>
                                        {event.type === 'payment' ? (
                                          // Payment Timeline Entry
                                          <div className="flex space-x-3">
                                            <div 
                                              className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                                              style={{
                                                backgroundColor: event.data.is_voided ? '#F44336' : '#4CAF50'
                                              }}
                                            ></div>
                                            <div className="flex-1">
                                              <div className="flex items-center justify-between">
                                                <div className={`text-sm font-medium ${event.data.is_voided ? 'text-red-700 dark:text-red-300 line-through' : 'text-slate-900 dark:text-slate-100'}`}>
                                                  Payment #{event.paymentIndex} 
                                                  {event.data.type === 'full' && ' (Full Redemption)'}
                                                  {event.data.type === 'partial' && ' (Partial)'}
                                                  {event.data.is_voided && (
                                                    <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full border border-red-200 dark:border-red-800">
                                                      REVERSED
                                                    </span>
                                                  )}
                                                </div>
                                                {user?.role === 'admin' && !event.data.is_voided && (() => {
                                                  // Check if payment is within same business day (auto-hide at midnight)
                                                  const canReverse = canReversePayment(event.data.payment_date || event.data.created_at);
                                                  
                                                  if (!canReverse) return null;
                                                  
                                                  return (
                                                    <button
                                                      onClick={() => handlePaymentReversal(event.data.payment_id)}
                                                      disabled={processingCancel === `payment-${event.data.payment_id}`}
                                                      className="ml-2 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors disabled:opacity-50"
                                                      title="Cancel payment (admin only, same-day)"
                                                    >
                                                      {processingCancel === `payment-${event.data.payment_id}` ? '...' : 'Cancel'}
                                                    </button>
                                                  );
                                                })()}
                                              </div>
                                              <div className="flex items-center justify-between mt-1">
                                                <div className={`text-xs ${event.data.is_voided ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                                  {formatBusinessDate(event.data.payment_date || event.data.created_at)}
                                                </div>
                                                <div className={`text-xs ${event.data.is_voided ? 'text-red-600 dark:text-red-400 line-through' : 'text-green-600 dark:text-green-400'} font-medium`}>
                                                  {formatCurrency(event.data.payment_amount || event.data.amount)}
                                                </div>
                                              </div>
                                              {event.data.is_voided && event.data.void_reason && (
                                                <div className="text-xs text-red-600 dark:text-red-400 italic mt-1">
                                                  {event.data.void_reason.replace('REVERSAL: ', '')}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ) : event.type === 'extension' ? (
                                          // Extension Timeline Entry
                                          <div className="flex space-x-3">
                                            <div 
                                              className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                                              style={{
                                                backgroundColor: event.data.is_cancelled ? '#F44336' : '#00BCD4'
                                              }}
                                            ></div>
                                            <div className="flex-1">
                                              <div className="flex items-center justify-between">
                                                <div className={`text-sm font-medium ${
                                                  event.data.is_cancelled 
                                                    ? 'text-red-600 dark:text-red-400 line-through' 
                                                    : 'text-slate-900 dark:text-slate-100'
                                                }`}>
                                                  {event.data.formatted_id ? `${event.data.formatted_id} - ` : ''}Extension #{event.extensionIndex} ({event.data.extension_months}mo)
                                                  {event.data.is_cancelled && (
                                                    <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full border border-red-200 dark:border-red-800">
                                                      CANCELLED
                                                    </span>
                                                  )}
                                                </div>
                                                {user?.role === 'admin' && !event.data.is_cancelled && (() => {
                                                  // Check if extension is within same business day (auto-hide at midnight)
                                                  const canCancel = canCancelExtension(event.data.extension_date || event.data.created_at);
                                                  
                                                  if (!canCancel) return null;
                                                  
                                                  return (
                                                    <button
                                                      onClick={() => handleExtensionCancelAction(event.data.extension_id)}
                                                      disabled={processingCancel === `extension-${event.data.extension_id}`}
                                                      className="ml-2 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors disabled:opacity-50"
                                                      title="Cancel extension (admin only, same-day)"
                                                    >
                                                      {processingCancel === `extension-${event.data.extension_id}` ? '...' : 'Cancel'}
                                                    </button>
                                                  );
                                                })()}
                                              </div>
                                              <div className="flex items-center justify-between mt-1">
                                                <div className="text-xs text-slate-600 dark:text-slate-400">
                                                  {formatBusinessDate(event.data.extension_date || event.data.created_at)}
                                                </div>
                                                <div 
                                                  className={`text-xs font-medium ${
                                                    event.data.is_cancelled 
                                                      ? 'text-red-500 dark:text-red-400 line-through' 
                                                      : ''
                                                  }`}
                                                  style={{
                                                    color: event.data.is_cancelled ? undefined : '#00BCD4'
                                                  }}
                                                >
                                                  Fee: {formatCurrency(
                                                    event.data.total_extension_fee || 
                                                    event.data.extension_fee || 
                                                    event.data.fee || 
                                                    (event.data.extension_months * (event.data.extension_fee_per_month || 0))
                                                  )}
                                                  {event.data.is_cancelled && (
                                                    <span className="ml-2 text-red-600 dark:text-red-400 font-normal">
                                                      (Refunded)
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              {event.data.is_cancelled && event.data.cancellation_reason && (
                                                <div className="text-xs text-red-600 dark:text-red-400 mt-1 italic">
                                                  Reason: {event.data.cancellation_reason}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ) : event.type === 'audit' ? (
                                          // Check if this is a voided or canceled transaction for clean display
                                          (event.data.new_value === 'voided' || event.data.new_value === 'TransactionStatus.VOIDED' || event.data.new_value?.toLowerCase().includes('voided')) ? (
                                            // Clean Voided Transaction Display (like extensions)
                                            <div className="flex space-x-3">
                                              <div 
                                                className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                                                style={{ backgroundColor: '#9E9E9E' }}
                                              ></div>
                                              <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                  <div className="text-sm font-medium text-red-700 dark:text-red-300">
                                                    Transaction VOIDED
                                                    <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full border border-red-200 dark:border-red-800">
                                                      VOIDED
                                                    </span>
                                                  </div>
                                                </div>
                                                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                                  {formatBusinessDate(event.data.timestamp)}
                                                </div>
                                                {event.data.staff_member && (
                                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                                    by User #{event.data.staff_member}
                                                  </div>
                                                )}
                                                {event.data.details && (event.data.details.includes('VOIDED:') || event.data.details.includes('Reason:')) && (
                                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                                    Reason: {
                                                      event.data.details.includes('VOIDED:') 
                                                        ? event.data.details.split('VOIDED:')[1]?.split('|')[0]?.trim()
                                                        : event.data.details.includes('Reason:')
                                                        ? event.data.details.split('Reason:')[1]?.trim()
                                                        : event.data.details
                                                    }
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          ) : (event.data.new_value === 'canceled' || event.data.new_value === 'TransactionStatus.CANCELED' || event.data.new_value?.toLowerCase().includes('canceled')) ? (
                                            // Clean Canceled Transaction Display (like extensions)
                                            <div className="flex space-x-3">
                                              <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-yellow-500"></div>
                                              <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                  <div className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                                                    Transaction CANCELED
                                                    <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full border border-yellow-200 dark:border-yellow-800">
                                                      CANCELED
                                                    </span>
                                                  </div>
                                                </div>
                                                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                                  {formatBusinessDate(event.data.timestamp)}
                                                </div>
                                                {event.data.staff_member && (
                                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                                    by User #{event.data.staff_member}
                                                  </div>
                                                )}
                                                {event.data.details && (event.data.details.includes('CANCELED:') || event.data.details.includes('Reason:')) && (
                                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                                    Reason: {
                                                      event.data.details.includes('CANCELED:') 
                                                        ? event.data.details.split('CANCELED:')[1]?.split('|')[0]?.trim()
                                                        : event.data.details.includes('Reason:')
                                                        ? event.data.details.split('Reason:')[1]?.trim()
                                                        : event.data.details
                                                    }
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          ) : event.data.action_type === 'status_changed' ? (
                                            // Clean Status Change Display (like extensions)
                                            <div className="flex space-x-3">
                                              <div 
                                                className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                                                style={{ 
                                                  backgroundColor: (() => {
                                                    const status = event.data.new_value?.toLowerCase().replace('transactionstatus.', '');
                                                    switch (status) {
                                                      case 'redeemed': return '#4CAF50';
                                                      case 'active': return '#2196F3';
                                                      case 'extended': return '#00BCD4';
                                                      case 'sold': return '#9C27B0';
                                                      case 'hold': return '#FFC107';
                                                      case 'forfeited': return '#FF5722';
                                                      case 'overdue': return '#F44336';
                                                      case 'damaged': return '#795548';
                                                      case 'voided': return '#9E9E9E';
                                                      default: return '#2196F3';
                                                    }
                                                  })()
                                                }}
                                              ></div>
                                              <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                    Status Changed
                                                    <span 
                                                      className="ml-2 px-2 py-0.5 text-xs rounded-full border text-white"
                                                      style={{ 
                                                        backgroundColor: (() => {
                                                          const status = event.data.new_value?.toLowerCase().replace('transactionstatus.', '');
                                                          switch (status) {
                                                            case 'redeemed': return '#4CAF50';
                                                            case 'active': return '#2196F3';
                                                            case 'extended': return '#00BCD4';
                                                            case 'sold': return '#9C27B0';
                                                            case 'hold': return '#FFC107';
                                                            case 'forfeited': return '#FF5722';
                                                            case 'overdue': return '#F44336';
                                                            case 'damaged': return '#795548';
                                                            case 'voided': return '#9E9E9E';
                                                            default: return '#2196F3';
                                                          }
                                                        })(),
                                                        borderColor: (() => {
                                                          const status = event.data.new_value?.toLowerCase().replace('transactionstatus.', '');
                                                          switch (status) {
                                                            case 'redeemed': return '#4CAF50';
                                                            case 'active': return '#2196F3';
                                                            case 'extended': return '#00BCD4';
                                                            case 'sold': return '#9C27B0';
                                                            case 'hold': return '#FFC107';
                                                            case 'forfeited': return '#FF5722';
                                                            case 'overdue': return '#F44336';
                                                            case 'damaged': return '#795548';
                                                            case 'voided': return '#9E9E9E';
                                                            default: return '#2196F3';
                                                          }
                                                        })(),
                                                        color: event.data.new_value?.toLowerCase().replace('transactionstatus.', '') === 'hold' ? '#000' : '#fff'
                                                      }}
                                                    >
                                                      {event.data.new_value?.replace('TransactionStatus.', '').toUpperCase() || 'STATUS CHANGE'}
                                                    </span>
                                                  </div>
                                                </div>
                                                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                                  {formatBusinessDate(event.data.timestamp || event.data.created_at)}
                                                </div>
                                                {event.data.staff_member && (
                                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                                    by User #{event.data.staff_member}
                                                  </div>
                                                )}
                                                {event.data.previous_value && event.data.new_value && (
                                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                                    From: {event.data.previous_value?.replace('TransactionStatus.', '')} → {event.data.new_value?.replace('TransactionStatus.', '')}
                                                  </div>
                                                )}
                                                {event.data.details && event.data.details.includes('Reason:') && (
                                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                                    Reason: {event.data.details.split('Reason:')[1]?.trim()}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          ) : (
                                            // Other Audit Timeline Entries
                                            <div className="flex space-x-3">
                                              <div 
                                                className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                                                style={{ 
                                                  backgroundColor: (() => {
                                                    const status = event.data.new_value?.toLowerCase().replace('transactionstatus.', '');
                                                    switch (status) {
                                                      case 'redeemed': return '#4CAF50';
                                                      case 'active': return '#2196F3';
                                                      case 'extended': return '#00BCD4';
                                                      case 'sold': return '#9C27B0';
                                                      case 'hold': return '#FFC107';
                                                      case 'forfeited': return '#FF5722';
                                                      case 'overdue': return '#F44336';
                                                      case 'damaged': return '#795548';
                                                      case 'voided': return '#9E9E9E';
                                                      default: return '#9E9E9E';
                                                    }
                                                  })()
                                                }}
                                              ></div>
                                              <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                    {event.data.action_summary}
                                                  </div>
                                                </div>
                                                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                                  {formatBusinessDate(event.data.timestamp || event.data.created_at)}
                                                </div>
                                                {event.data.staff_member && (
                                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                                    by User #{event.data.staff_member}
                                                  </div>
                                                )}
                                                {event.data.details && (
                                                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                                    {event.data.details}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          )
                                        ) : null}
                                      </React.Fragment>
                                    ))}
                                    
                                    {hasMany && !showAllPayments && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => setShowAllPayments(true)}
                                        className="w-full text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                                      >
                                        Show {timelineData.length - displayLimit} more timeline events
                                      </Button>
                                    )}
                                    
                                    {hasMany && showAllPayments && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => setShowAllPayments(false)}
                                        className="w-full text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                                      >
                                        Show less
                                      </Button>
                                    )}
                                  </>
                                );
                              })()}
                              
                              {/* Transaction Creation Event - Oldest */}
                              <div className="flex space-x-3">
                                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                                <div>
                                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    Transaction Created
                                  </div>
                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                    {formatDate(getTransactionField('pawn_date'))}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-500">
                                    by User #{getTransactionField('created_by_user_id')}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </ScrollArea>
                        </div>

                        {/* Close Button */}
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
                          <Button 
                            variant="outline"
                            onClick={() => setShowTransactionDetails(false)}
                            className="w-full"
                          >
                            Close
                          </Button>
                        </div>
                      </div>
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              )}

              {/* Mobile/Tablet Layout - Stacked Panels */}
              {!loadingTransactionDetails && (
                <div className="lg:hidden p-4 space-y-6">
                  {/* Customer & Financial Summary (Mobile) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card 
                      className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                      onClick={() => {
                        const customerPhone = getTransactionField('customer_phone') || getTransactionField('customer_id');
                        if (customerPhone && customerPhone !== 'No Customer') {
                          handleViewCustomer(customerPhone);
                        }
                      }}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center space-x-2 text-sm">
                          <Phone className="w-4 h-4 text-blue-600" />
                          <span>Customer</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg font-bold">
                          {getTransactionField('customer_phone') ||
                           getTransactionField('customer_name') ||
                           getTransactionField('customer_id') || 'No Customer'}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center space-x-2 text-sm">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          <span>Financial</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">Loan Amount</div>
                          <div className="font-bold text-lg text-green-900 dark:text-green-100">
                            {formatCurrency(getTransactionField('loan_amount') || 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">Monthly Interest</div>
                          <div className="font-bold text-lg text-blue-900 dark:text-blue-100">
                            {formatCurrency(getTransactionField('monthly_interest_amount') || 0)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Pawn Items (Mobile) */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-3">
                        <Package className="w-5 h-5 text-blue-600" />
                        <span>Pawn Items ({getTransactionField('items')?.length || 0})</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {getTransactionField('items')?.length > 0 ? (
                        <div className="space-y-3">
                          {getTransactionField('items').map((item, index) => (
                            <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                  {index + 1}
                                </span>
                                <div className="font-semibold">{item.description}</div>
                              </div>
                              {item.serial_number && (
                                <div className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                                  SN: {item.serial_number}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-slate-500 py-4">No items found</div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Quick Actions (Mobile) */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {canProcessActions() && (
                        <>
                          <Button 
                            onClick={() => {
                              setShowTransactionDetails(false);
                              handlePayment(selectedTransaction?.transaction || selectedTransaction);
                            }}
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                          >
                            <DollarSign className="w-4 h-4 mr-2" />
                            Process Payment
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => {
                              setShowTransactionDetails(false);
                              handleExtension(selectedTransaction?.transaction || selectedTransaction);
                            }}
                            className="w-full"
                          >
                            <Calendar className="w-4 h-4 mr-2" />
                            Extend Loan
                          </Button>
                        </>
                      )}
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setShowTransactionDetails(false);
                          handleStatusUpdate(selectedTransaction?.transaction || selectedTransaction);
                        }}
                        className="w-full"
                      >
                        <Activity className="w-4 h-4 mr-2" />
                        Update Status
                      </Button>
                      
                      {/* Admin-only Void Transaction Button */}
                      {user?.role === 'admin' && (
                        <Button 
                          variant="destructive"
                          onClick={() => {
                            setShowTransactionDetails(false);
                            handleVoidTransaction(selectedTransaction?.transaction || selectedTransaction);
                          }}
                          className="w-full"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Void Transaction
                        </Button>
                      )}
                      <Button 
                        variant="outline"
                        onClick={() => setShowTransactionDetails(false)}
                        className="w-full"
                      >
                        Close
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </DialogContent>
        </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={showStatusUpdateForm} onOpenChange={setShowStatusUpdateForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-full bg-blue-100">
                <RefreshCw className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-xl text-blue-500 font-bold">Transaction Status Update</DialogTitle>
                <p className="text-xs text-blue-600 font-medium mt-1">STATUS CHANGE</p>
              </div>
            </div>
            <DialogDescription className="mt-3">
              Change the status of the selected transaction. This action will be recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <StatusUpdateForm
              transaction={selectedTransaction}
              customer={selectedTransactionCustomer}
              onSuccess={handleStatusUpdateSuccess}
              onCancel={() => setShowStatusUpdateForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Customer Details Dialog */}
      <Dialog open={showCustomerDetails} onOpenChange={setShowCustomerDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
          <DialogHeader className="pb-6 border-b border-slate-200 dark:border-slate-700">
            <DialogTitle className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : 'Loading...'}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {loadingCustomerDetails ? 'Loading customer details...' : 'Customer profile and transaction history'}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="space-y-6">
              {/* Loading State */}
              {loadingCustomerDetails && (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <span className="text-slate-600 dark:text-slate-400">Loading customer details...</span>
                  </div>
                </div>
              )}
              
              {!loadingCustomerDetails && (
                <>
                  {/* Customer Info Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                            <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <div className="text-sm text-blue-600 dark:text-blue-400">Phone Number</div>
                            <div className="font-bold text-lg text-blue-900 dark:text-blue-100">
                              {customerService.formatPhoneNumber(selectedCustomer.phone_number)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <div className="text-sm text-green-600 dark:text-green-400">Status</div>
                            <div className="font-bold text-lg text-green-900 dark:text-green-100 capitalize">
                              {selectedCustomer.status}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Email if available */}
                  {selectedCustomer.email && (
                    <Card className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-slate-500/20 rounded-lg flex items-center justify-center">
                            <Mail className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                          </div>
                          <div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">Email</div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {selectedCustomer.email}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Notes if available */}
                  {selectedCustomer.notes && (
                    <Card className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center space-x-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
                          <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                          <span>Internal Notes</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                          <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {selectedCustomer.notes}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Transaction History */}
                  <Card className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center space-x-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
                        <CreditCard className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        <span>Transaction History ({customerTransactions.length})</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {customerTransactions.length > 0 ? (
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {customerTransactions.map((transaction) => (
                            <div 
                              key={transaction.transaction_id}
                              className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-all"
                              onClick={() => {
                                setShowCustomerDetails(false);
                                handleViewTransaction(transaction);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div 
                                    className="w-3 h-3 rounded-full"
                                    style={{ 
                                      backgroundColor: 
                                        transaction.status === 'redeemed' ? '#4CAF50' :
                                        transaction.status === 'active' ? '#2196F3' :
                                        transaction.status === 'extended' ? '#00BCD4' :
                                        transaction.status === 'sold' ? '#9C27B0' :
                                        transaction.status === 'hold' ? '#FFC107' :
                                        transaction.status === 'forfeited' ? '#FF5722' :
                                        transaction.status === 'overdue' ? '#F44336' :
                                        transaction.status === 'damaged' ? '#795548' :
                                        transaction.status === 'voided' ? '#9E9E9E' : '#E5E7EB'
                                    }}
                                  ></div>
                                  <div>
                                    <div className="font-medium text-slate-900 dark:text-slate-100">
                                      #{formatTransactionId(transaction)}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                      {formatDate(transaction.pawn_date)} • {transaction.status}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {formatCurrency(transaction.loan_amount || 0)}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {transaction.items?.length || 0} item{transaction.items?.length !== 1 ? 's' : ''}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <CreditCard className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                          <p className="text-slate-500 dark:text-slate-400">No transactions found for this customer</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-6 border-t border-slate-200 dark:border-slate-700">
                    <Button 
                      variant="outline"
                      onClick={() => setShowCustomerDetails(false)}
                      className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      Close
                    </Button>
                    
                    <Button 
                      onClick={() => navigate('/customers')}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg"
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      Manage Customer
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Payment Dialog */}
      <Dialog open={showQuickPayment} onOpenChange={setShowQuickPayment}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Payment</DialogTitle>
            <DialogDescription>
              Enter the transaction number to process a payment. Only active, overdue, or extended transactions can accept payments.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="paymentTransactionId">Transaction Number</Label>
              <Input
                id="paymentTransactionId"
                placeholder="Enter transaction number (e.g., PW000001 or 1) - Press Enter"
onKeyPress={async (e) => {
                  if (e.key === 'Enter') {
                    const displayId = e.target.value.trim();
                    if (displayId) {
                      try {
                        const transaction = await findTransactionByDisplayId(displayId);
                        
                        // Validate transaction status for payment
                        if (!['active', 'overdue', 'extended'].includes(transaction.status)) {
                          handleError(new Error(`Cannot process payment for ${transaction.status} transaction`), 'Invalid Status');
                          return;
                        }
                        
                        setSelectedTransaction(transaction);
                        setShowQuickPayment(false);
                        setShowPaymentForm(true);
                      } catch (error) {
                        handleError(error, 'Loading transaction');
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Extension Dialog */}
      <Dialog open={showQuickExtension} onOpenChange={setShowQuickExtension}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Extension</DialogTitle>
            <DialogDescription>
              Enter the transaction number to extend the loan. Only active, overdue, or extended transactions can be extended.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="extensionTransactionId">Transaction Number</Label>
              <Input
                id="extensionTransactionId"
                placeholder="Enter transaction number (e.g., PW000001 or 1) - Press Enter"
onKeyPress={async (e) => {
                  if (e.key === 'Enter') {
                    const displayId = e.target.value.trim();
                    if (displayId) {
                      try {
                        const transaction = await findTransactionByDisplayId(displayId);
                        
                        // Validate transaction status for extension
                        if (!['active', 'overdue', 'extended'].includes(transaction.status)) {
                          handleError(new Error(`Cannot extend ${transaction.status} transaction`), 'Invalid Status');
                          return;
                        }
                        
                        setSelectedTransaction(transaction);
                        setShowQuickExtension(false);
                        setShowExtensionForm(true);
                      } catch (error) {
                        handleError(error, 'Loading transaction');
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Approval Dialog for Payment Reversal */}
      <AdminApprovalDialog
        open={showPaymentReversalDialog}
        onOpenChange={setShowPaymentReversalDialog}
        title="Payment Reversal Authorization"
        description="This action will reverse the selected payment and update the transaction balance. Please provide your admin credentials and reason for this reversal."
        onApprove={handlePaymentReversalApproval}
        onCancel={handlePaymentReversalCancel}
        loading={processingCancel === `payment-${pendingReversalPaymentId}`}
        actionType="reversal"
        requireReason={true}
        warningMessage={reversalEligibility?.warnings ? reversalEligibility.warnings.join(' ') : undefined}
      >
        {(pendingReversalTransaction || selectedTransaction || reversalEligibility) && (
          <div className="bg-amber-50 border border-amber-300 rounded-md p-3">
            <h4 className="text-sm font-medium text-amber-900 mb-2">Reversal Details</h4>
            <div className="text-sm text-amber-900 space-y-1">
              {(() => {
                const transactionData = pendingReversalTransaction?.transaction || selectedTransaction?.transaction;
                return transactionData ? (
                  <>
                    <p><strong>Transaction ID:</strong> {formatTransactionId(transactionData)}</p>
                    <div><strong>Current Status:</strong> <StatusBadge status={transactionData.status} /></div>
                    {selectedTransactionCustomer && (
                      <p><strong>Customer:</strong> {`${selectedTransactionCustomer.first_name || ''} ${selectedTransactionCustomer.last_name || ''}`.trim().toUpperCase()}</p>
                    )}
                    {transactionData.loan_amount && (
                      <p><strong>Loan Amount:</strong> {formatCurrency(transactionData.loan_amount)}</p>
                    )}
                  </>
                ) : (
                  <p><strong>Payment ID:</strong> {pendingReversalPaymentId}</p>
                );
              })()}
              {reversalEligibility?.payment_amount && (
                <p><strong>Payment Amount:</strong> {formatCurrency(reversalEligibility.payment_amount)}</p>
              )}
              {reversalEligibility?.payment_date && (
                <p><strong>Payment Date:</strong> {formatBusinessDate(reversalEligibility.payment_date)}</p>
              )}
            </div>
          </div>
        )}
      </AdminApprovalDialog>

      {/* Admin Approval Dialog for Extension Cancellation */}
      <AdminApprovalDialog
        open={showExtensionCancelDialog}
        onOpenChange={setShowExtensionCancelDialog}
        title="Extension Cancellation Authorization"
        description="This action will cancel the selected extension, refund fees, and revert the maturity date. Please provide your admin credentials and reason for this cancellation."
        onApprove={handleExtensionCancelApproval}
        onCancel={handleExtensionCancelCancel}
        loading={processingCancel === `extension-${pendingCancelExtensionId}`}
        actionType="cancellation"
        requireReason={true}
        warningMessage={reversalEligibility?.warnings ? reversalEligibility.warnings.join(' ') : undefined}
      >
        {(pendingCancelTransaction || selectedTransaction || reversalEligibility) && (
          <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
            <h4 className="text-sm font-medium text-orange-900 mb-2">Cancellation Details</h4>
            <div className="text-sm text-orange-900 space-y-1">
              {(() => {
                const transactionData = pendingCancelTransaction?.transaction || selectedTransaction?.transaction;
                return transactionData ? (
                  <>
                    <p><strong>Transaction ID:</strong> {formatTransactionId(transactionData)}</p>
                    <div><strong>Current Status:</strong> <StatusBadge status={transactionData.status} /></div>
                    {selectedTransactionCustomer && (
                      <p><strong>Customer:</strong> {`${selectedTransactionCustomer.first_name || ''} ${selectedTransactionCustomer.last_name || ''}`.trim().toUpperCase()}</p>
                    )}
                    {transactionData.loan_amount && (
                      <p><strong>Loan Amount:</strong> {formatCurrency(transactionData.loan_amount)}</p>
                    )}
                  </>
                ) : (
                  <p><strong>Extension ID:</strong> {pendingCancelExtensionId}</p>
                );
              })()}
              {reversalEligibility?.extension_fee && (
                <p><strong>Extension Fee:</strong> {formatCurrency(reversalEligibility.extension_fee)}</p>
              )}
              {reversalEligibility?.extension_date && (
                <p><strong>Extension Date:</strong> {formatBusinessDate(reversalEligibility.extension_date)}</p>
              )}
              {reversalEligibility?.extension_months && (
                <p><strong>Extension Period:</strong> {reversalEligibility.extension_months} month(s)</p>
              )}
            </div>
          </div>
        )}
      </AdminApprovalDialog>

      {/* Transaction Void Dialog */}
      <Dialog open={showVoidApprovalDialog} onOpenChange={setShowVoidApprovalDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-full bg-red-100">
                <X className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <DialogTitle className="text-xl text-red-800 font-bold">Transaction Void Authorization</DialogTitle>
                <p className="text-xs text-red-600 font-medium mt-1">PERMANENT ACTION</p>
              </div>
            </div>
            <DialogDescription className="mt-3">
              This action will permanently void the transaction and mark it as canceled. This action cannot be reversed.
            </DialogDescription>
          </DialogHeader>
          {pendingVoidTransaction && (
            <div className="space-y-4">
              {/* Transaction Details */}
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <h4 className="text-sm font-medium text-red-900 mb-2">Transaction Details</h4>
                <div className="text-sm text-red-900 space-y-1">
                  <p><strong>Transaction ID:</strong> {formatTransactionId(pendingVoidTransaction)}</p>
                  <div><strong>Current Status:</strong> <StatusBadge status={pendingVoidTransaction.status} /></div>
                  {selectedTransactionCustomer && (
                    <p><strong>Customer:</strong> {`${selectedTransactionCustomer.first_name || ''} ${selectedTransactionCustomer.last_name || ''}`.trim().toUpperCase()}</p>
                  )}
                  {pendingVoidTransaction.loan_amount && (
                    <p><strong>Loan Amount:</strong> {formatCurrency(pendingVoidTransaction.loan_amount)}</p>
                  )}
                </div>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const approvalData = {
                  admin_pin: formData.get('admin-pin'),
                  reason: formData.get('void-reason')
                };
                handleVoidTransactionApproval(approvalData);
              }} className="space-y-4">
                {/* Reason */}
                <div className="space-y-2">
                  <Label htmlFor="void-reason">Reason for void *</Label>
                  <Textarea
                    id="void-reason"
                    name="void-reason"
                    placeholder="Describe the specific reason for voiding this transaction (e.g., data entry error, customer request, duplicate entry)..."
                    rows={3}
                    required
                  />
                </div>

                {/* Admin PIN */}
                <div className="space-y-2">
                  <Label htmlFor="admin-pin">Admin PIN *</Label>
                  <Input
                    id="admin-pin"
                    name="admin-pin"
                    type="password"
                    placeholder="Enter your admin PIN"
                    required
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowVoidApprovalDialog(false)}
                    disabled={processingCancel === `void-${pendingVoidTransaction.transaction_id}`}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    disabled={processingCancel === `void-${pendingVoidTransaction.transaction_id}`}
                  >
                    {processingCancel === `void-${pendingVoidTransaction.transaction_id}` ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      'Authorize Void'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransactionHub;