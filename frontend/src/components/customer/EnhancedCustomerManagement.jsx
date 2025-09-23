import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Plus, 
  Filter, 
  MoreHorizontal, 
  Eye, 
  Edit2, 
  User, 
  Users,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  CreditCard,
  Mail,
  Phone,
  Gauge,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Archive,
  Calendar,
  Loader2,
  DollarSign,
  FileText,
  Activity,
  Package,
  Clock,
  X,
  Trash2
} from 'lucide-react';
import { Button } from '../ui/button';
import { StatusBadge } from '../ui/enhanced-badge';
import { CustomerTableSkeleton, StatsCardSkeleton, SearchSkeleton } from '../ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Progress } from '../ui/progress';
import { Command, CommandInput } from '../ui/command';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import customerService from '../../services/customerService';
import serviceAlertService from '../../services/serviceAlertService';
import transactionService from '../../services/transactionService';
import paymentService from '../../services/paymentService';
import extensionService from '../../services/extensionService';
import authService from '../../services/authService';
import CustomerDialog from './CustomerDialog';
import AlertBellAction from './AlertBellAction';
import ServiceAlertDialog from './ServiceAlertDialog';
import LoanEligibilityManager from './LoanEligibilityManager';
import { useToast } from '../ui/toast';
import { useAuth } from '../../context/AuthContext';
import { useAlertCount } from '../../context/AlertCountContext';
import { isAdmin as isAdminRole } from '../../utils/roleUtils';
import { formatBusinessDate, formatRedemptionDate, canCancelExtension } from '../../utils/timezoneUtils';
import { formatCurrency, formatStorageLocation, formatTransactionId } from '../../utils/transactionUtils';
import { handleError } from '../../utils/errorHandling';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../ui/resizable';
import { ScrollArea } from '../ui/scroll-area';
import TransactionNotesDisplay from '../transaction/TransactionNotesDisplay';
import CustomerCard from './CustomerCard';
import CustomLoanLimitDialog from './CustomLoanLimitDialog';
import TransactionCard from '../transaction/TransactionCard';
import CreatePawnDialogRedesigned from '../transaction/CreatePawnDialogRedesigned';
import PaymentForm from '../transaction/components/PaymentForm';
import ExtensionForm from '../transaction/components/ExtensionForm';
import StatusUpdateForm from '../transaction/components/StatusUpdateForm';

// Transactions Tab Content Component
const TransactionsTabContent = ({ selectedCustomer }) => {
  const { user } = useAuth(); // Add useAuth hook for user context
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  
  // Dialog states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showExtensionForm, setShowExtensionForm] = useState(false);
  const [showStatusUpdateForm, setShowStatusUpdateForm] = useState(false);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [loadingTransactionDetails, setLoadingTransactionDetails] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState(null);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [auditEntries, setAuditEntries] = useState([]);
  const [selectedTransactionCustomer, setSelectedTransactionCustomer] = useState(null);

  // Date formatting helper (exact copy from TransactionHub)
  const formatDate = (dateString) => {
    return formatBusinessDate(dateString);
  };

  // Helper to get transaction field consistently (must be before useMemo)
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

  // Simplified timeline - only payments and extensions (match original clean format)
  const timelineData = useMemo(() => {
    const payments = paymentHistory?.payments || [];
    const extensions = selectedTransaction?.extensions || selectedTransaction?.transaction?.extensions || [];
    
    // Build timeline events array - only essential entries
    const timelineEvents = [];
    
    // Add payment events (reverse order for newest first)
    for (let i = payments.length - 1; i >= 0; i--) {
      const payment = payments[i];
      timelineEvents.push({
        type: 'payment',
        date: new Date(payment.payment_date || payment.created_at),
        data: payment,
        paymentIndex: payments.length - i,  // Fixed: newest gets highest number
        key: `payment-${payment.payment_id || i}`
      });
    }
    
    // Add extension events (reverse order for newest first)
    for (let i = extensions.length - 1; i >= 0; i--) {
      const extension = extensions[i];
      timelineEvents.push({
        type: 'extension',
        date: new Date(extension.extension_date || extension.created_at),
        data: extension,
        extensionIndex: extensions.length - i,  // Fixed: newest gets highest number
        key: `extension-${extension.extension_id || i}`
      });
    }
    
    // Skip audit events to keep timeline simple like original
    
    // Sort all events by date (newest first) and return
    return timelineEvents.sort((a, b) => b.date - a.date);
  }, [paymentHistory, selectedTransaction, getTransactionStatus]);

  // Fetch customer transactions
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!selectedCustomer?.phone_number) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await transactionService.getCustomerTransactions(selectedCustomer.phone_number);
        
        // Handle different API response formats
        let transactionArray = [];
        if (Array.isArray(response)) {
          transactionArray = response;
        } else if (response && Array.isArray(response.transactions)) {
          transactionArray = response.transactions;
        } else if (response && Array.isArray(response.data)) {
          transactionArray = response.data;
        } else if (response && typeof response === 'object') {
          // If response is an object but not an array, log it for debugging
          console.log('Unexpected API response format:', response);
          transactionArray = [];
        }
        
        setTransactions(transactionArray);
      } catch (err) {
        console.error('Failed to fetch customer transactions:', err);
        setError(err.message || 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [selectedCustomer?.phone_number]);

  if (loading) {
    return (
      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            <span className="ml-3 text-slate-600 dark:text-slate-400">Loading transactions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Error Loading Transactions</h3>
            <p className="text-slate-500 dark:text-slate-400">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return (
      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="text-center py-12">
            <CreditCard className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">No Transactions</h3>
            <p className="text-slate-500 dark:text-slate-400">This customer has no transaction records.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleNewTransaction = () => {
    setShowCreateForm(true);
  };

  // Handle viewing transaction details (exact copy from TransactionHub)

  const handleViewTransaction = async (transaction) => {
    setLoadingTransactionDetails(true);
    setShowTransactionDetails(true);
    setSelectedTransaction(null); // Clear any stale data first
    setSelectedTransactionCustomer(null); // Reset customer data
    
    try {
      // Fetch comprehensive transaction summary with items and balance (with cache busting)
      const bustCacheUrl = `/api/v1/pawn-transaction/${transaction.transaction_id}/summary?_t=${Date.now()}`;
      console.log('Fetching transaction summary from:', bustCacheUrl); // Debug log
      const fullTransaction = await authService.apiRequest(bustCacheUrl, { method: 'GET' });
      console.log('Received transaction summary:', fullTransaction); // Debug log
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
      console.log('Setting transaction data:', fullTransaction); // Debug log
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

  // Optimized timeline refresh function for real-time updates (exact copy from TransactionHub)
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

      // Immediate list refresh for responsive UI - refresh customer transactions
      await refreshTransactions();
      
    } catch (error) {
      console.error('Error in refreshTimelineData:', error);
      // Fallback to full refresh if optimized refresh fails
      if (selectedTransaction) {
        await handleViewTransaction(selectedTransaction);
      }
    }
  };

  // Helper functions for transaction details dialog (copied from TransactionHub)

  // const formatDate = (dateString) => {
  //   return formatBusinessDate(dateString);
  // };

  const handlePayment = (transaction) => {
    setSelectedTransaction(transaction);
    setShowPaymentForm(true);
  };

  const handleExtension = (transaction) => {
    setSelectedTransaction(transaction);
    setShowExtensionForm(true);
  };

  const handleStatusUpdate = (transaction) => {
    setSelectedTransaction(transaction);
    setShowStatusUpdateForm(true);
  };

  const handleVoidTransaction = (transaction) => {
    // This should open a void transaction dialog (not implemented yet)
    console.log('Void transaction:', transaction.transaction_id);
  };

  const refreshTransactions = async () => {
    if (!selectedCustomer?.phone_number) return;
    
    try {
      const response = await transactionService.getCustomerTransactions(selectedCustomer.phone_number);
      
      // Handle different API response formats
      let transactionArray = [];
      if (Array.isArray(response)) {
        transactionArray = response;
      } else if (response && Array.isArray(response.transactions)) {
        transactionArray = response.transactions;
      } else if (response && Array.isArray(response.data)) {
        transactionArray = response.data;
      } else if (response && typeof response === 'object') {
        console.log('Unexpected API response format:', response);
        transactionArray = [];
      }
      
      setTransactions(transactionArray);
    } catch (err) {
      console.error('Failed to refresh customer transactions:', err);
    }
  };

  // Dialog success handlers
  const handleTransactionCreated = () => {
    setShowCreateForm(false);
    refreshTransactions();
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentForm(false);
    
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
    refreshTransactions();
  };

  const handleExtensionSuccess = async () => {
    setShowExtensionForm(false);
    
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
    refreshTransactions();
  };

  const handleStatusUpdateSuccess = async () => {
    setShowStatusUpdateForm(false);
    
    // If transaction details dialog is open, refresh the timeline
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
    refreshTransactions();
  };

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            Transaction History
          </CardTitle>
          <Button
            size="sm"
            onClick={handleNewTransaction}
            className="h-8 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25"
          >
            <Plus className="w-4 h-4" />
            <span className="ml-1 hidden sm:inline">New Transaction</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.isArray(transactions) && transactions.map((transaction) => (
            <TransactionCard
              key={transaction.transaction_id}
              transaction={transaction}
              onView={() => handleViewTransaction(transaction)}
              onPayment={() => handlePayment(transaction)}
              onExtension={() => handleExtension(transaction)}
              onStatusUpdate={() => handleStatusUpdate(transaction)}
              customerData={{
                [transaction.customer_phone]: {
                  first_name: selectedCustomer.first_name,
                  last_name: selectedCustomer.last_name,
                  phone_number: selectedCustomer.phone_number
                }
              }}
            />
          ))}
        </div>
      </CardContent>

      {/* Create Transaction Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto p-0 border-0 bg-transparent" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>Create New Pawn Transaction</DialogTitle>
            <DialogDescription>Create a new pawn transaction for {selectedCustomer?.first_name} {selectedCustomer?.last_name}</DialogDescription>
          </DialogHeader>
          <CreatePawnDialogRedesigned
            onSuccess={handleTransactionCreated}
            onCancel={() => setShowCreateForm(false)}
            prefilledCustomer={selectedCustomer}
          />
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentForm} onOpenChange={setShowPaymentForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-transparent" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>Process Payment</DialogTitle>
            <DialogDescription>Process payment for transaction</DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <PaymentForm
              transaction={selectedTransaction}
              onSuccess={handlePaymentSuccess}
              onCancel={() => setShowPaymentForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Extension Dialog */}
      <Dialog open={showExtensionForm} onOpenChange={setShowExtensionForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-transparent" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>Extend Loan</DialogTitle>
            <DialogDescription>Extend loan period for transaction</DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <ExtensionForm
              transaction={selectedTransaction}
              onSuccess={handleExtensionSuccess}
              onCancel={() => setShowExtensionForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={showStatusUpdateForm} onOpenChange={setShowStatusUpdateForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Update Transaction Status</DialogTitle>
            <DialogDescription>Change the status of this transaction</DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <StatusUpdateForm
              transaction={selectedTransaction}
              onSuccess={handleStatusUpdateSuccess}
              onCancel={() => setShowStatusUpdateForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Enhanced Three-Panel Transaction Details Dialog (EXACT COPY FROM TRANSACTIONHUB) */}
      <Dialog open={showTransactionDetails} onOpenChange={(open) => {
        setShowTransactionDetails(open);
        if (!open) {
          setSelectedTransaction(null);
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
                  {/* LEFT PANEL - Customer & Financial Info */}
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
                                // In customer management, we're already viewing the customer
                                // Could potentially switch to overview tab or show customer details
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

                          {/* Transaction Info */}
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

                          {/* Transaction Notes */}
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

                  {/* CENTER PANEL - Pawn Items */}
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
                                {getTransactionField('items')?.length || 0} item(s) in this transaction
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <ScrollArea className="flex-1">
                          {getTransactionField('items') && getTransactionField('items').length > 0 ? (
                            <div className="space-y-2 pr-4 pb-6">
                              {getTransactionField('items').map((item, index) => (
                                <Card key={index} className="hover:shadow-md transition-shadow min-h-[4rem]">
                                  <CardContent className="p-2.5">
                                    <div className="space-y-3">
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
                                      
                                      <div className="grid grid-cols-1 gap-1">
                                        {item.serial_number && (
                                          <div className="p-1.5 bg-slate-100 dark:bg-slate-700/50 rounded">
                                            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Serial Number</div>
                                            <div className="text-sm font-mono font-medium text-slate-900 dark:text-slate-100 break-all">
                                              {item.serial_number}
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
                              <Package className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
                              <p className="text-slate-500 dark:text-slate-400 font-medium">No items found</p>
                              <p className="text-slate-400 dark:text-slate-500 text-sm">This transaction has no associated items</p>
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </div>
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  {/* RIGHT PANEL - Actions & Timeline (EXACT COPY FROM TRANSACTIONHUB) */}
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
                                          default: return '#2196F3';
                                        }
                                      })()
                                    }}
                                  ></div>
                                  <div className="flex-1">
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
                                              {redeemedBy && (
                                                <div>by User #{redeemedBy}</div>
                                              )}
                                              <div className="text-slate-600 dark:text-slate-400 mt-1">
                                                All amounts paid in full. Items ready for pickup.
                                              </div>
                                            </div>
                                          );
                                        }
                                        
                                        // For other statuses, show basic info
                                        return (
                                          <div>
                                            Current status
                                          </div>
                                        );
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
                                          // Payment Entry - Match Original Format Exactly
                                          <div className="flex space-x-3">
                                            <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-red-500"></div>
                                            <div className="flex-1">
                                              <div className="flex items-center justify-between">
                                                <div className={`text-sm font-medium ${(event.data.is_reversed || event.data.is_voided) ? 'text-red-700 dark:text-red-300 line-through' : 'text-slate-900 dark:text-slate-100'}`}>
                                                  Payment #{event.paymentIndex}
                                                  {(event.data.is_reversed || event.data.is_voided) && (
                                                    <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full border border-red-200 dark:border-red-800">
                                                      REVERSED
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="flex items-center justify-between mt-1">
                                                <div className={`text-xs ${(event.data.is_reversed || event.data.is_voided) ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                                  {formatBusinessDate(event.data.payment_date || event.data.created_at)}
                                                </div>
                                                <div className={`text-xs ${(event.data.is_reversed || event.data.is_voided) ? 'text-red-600 dark:text-red-400 line-through' : 'text-green-600 dark:text-green-400'} font-medium`}>
                                                  {formatCurrency(event.data.payment_amount || event.data.amount)}
                                                </div>
                                              </div>
                                              {(event.data.is_reversed || event.data.is_voided) && event.data.void_reason && (
                                                <div className="text-xs text-red-600 dark:text-red-400 italic mt-1">
                                                  {event.data.void_reason.replace('REVERSAL: ', '')}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ) : event.type === 'extension' ? (
                                          // Simple Extension Entry  
                                          <div className="flex space-x-3">
                                            <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-cyan-500"></div>
                                            <div className="flex-1">
                                              <div className="flex items-center justify-between">
                                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                  {event.data.formatted_id || `EX${String(event.extensionIndex).padStart(6, '0')}`} - Extension #{event.extensionIndex} ({event.data.extension_months || 1}mo)
                                                </div>
                                                {canCancelExtension(event.data.extension_date) && (
                                                  <button
                                                    className="ml-2 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors disabled:opacity-50"
                                                    title="Cancel extension (admin only, same-day)"
                                                  >
                                                    Cancel
                                                  </button>
                                                )}
                                              </div>
                                              <div className="flex items-center justify-between mt-1">
                                                <div className="text-xs text-slate-600 dark:text-slate-400">
                                                  {formatBusinessDate(event.data.extension_date || event.data.created_at)}
                                                </div>
                                                <div 
                                                  className="text-xs font-medium"
                                                  style={{ color: '#00BCD4' }}
                                                >
                                                  Fee: {formatCurrency(
                                                    event.data.total_extension_fee || 
                                                    event.data.extension_fee || 
                                                    event.data.fee || 
                                                    35
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ) : null}
                                      </React.Fragment>
                                    ))}

                                    {hasMany && !showAllPayments && (
                                      <button
                                        onClick={() => setShowAllPayments(true)}
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline w-full text-left"
                                      >
                                        Show {timelineData.length - displayLimit} more timeline events
                                      </button>
                                    )}

                                    {showAllPayments && hasMany && (
                                      <button
                                        onClick={() => setShowAllPayments(false)}
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline w-full text-left"
                                      >
                                        Show less
                                      </button>
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
                                    by User #{getTransactionField('created_by_user_id') || 'Unknown'}
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

              {/* Mobile Layout */}
              {!loadingTransactionDetails && (
                <div className="lg:hidden p-6 space-y-6">
                  <div className="text-center">
                    <p className="text-slate-500 dark:text-slate-400">
                      Mobile view - detailed transaction view is optimized for desktop
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

const EnhancedCustomerManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { initializeAlertCounts } = useAlertCount();
  const [customers, setCustomers] = useState([]);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [customerStats, setCustomerStats] = useState({
    total: 0,
    active: 0,
    suspended: 0,
    archived: 0,
    newThisMonth: 0,
    goodStanding: 0,
    needsFollowUp: 0,
    eligibleForIncrease: 0
  });
  const [loading, setLoading] = useState(true);
  const [customerListLoading, setCustomerListLoading] = useState(false);
  const [customerListError, setCustomerListError] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchFields, setSearchFields] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: ''
  });
  const [debouncedSearchFields, setDebouncedSearchFields] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: ''
  });
  const searchTimeoutRef = useRef(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [alertFilter, setAlertFilter] = useState(false); // Filter for customers with alerts
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const customersPerPage = 10;
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [advancedFilters, setAdvancedFilters] = useState({
    status: 'all',
    creditLimit: 'all',
    paymentHistory: 'all',
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveConfirmation, setArchiveConfirmation] = useState('');
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [showBulkActivateDialog, setShowBulkActivateDialog] = useState(false);
  const [showBulkSuspendDialog, setShowBulkSuspendDialog] = useState(false);
  const [showBulkArchiveDialog, setShowBulkArchiveDialog] = useState(false);
  
  // Loan limit configuration state
  const [maxActiveLoans, setMaxActiveLoans] = useState(8); // Default fallback
  
  // Service Alert Dialog State
  const [showServiceAlertDialog, setShowServiceAlertDialog] = useState(false);
  const [selectedCustomerForAlert, setSelectedCustomerForAlert] = useState(null);
  const [bulkConfirmation, setBulkConfirmation] = useState('');
  
  // Custom Loan Limit Dialog State
  const [showCustomLimitDialog, setShowCustomLimitDialog] = useState(false);
  const [selectedCustomerForLimit, setSelectedCustomerForLimit] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [saveNotesLoading, setSaveNotesLoading] = useState(false);

  const isAdmin = isAdminRole(user);

  // Responsive detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch current loan limit on component mount
  useEffect(() => {
    const fetchLoanLimit = async () => {
      try {
        const currentLimit = await customerService.getCurrentMaxLoans();
        setMaxActiveLoans(currentLimit);
      } catch (error) {
        console.warn('Failed to fetch loan limit, using default:', error);
        // Keep the default fallback value of 8
      }
    };

    fetchLoanLimit();
  }, []);

  // Debounce search query (500ms delay)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Show loading if user is typing
    if (searchQuery !== debouncedSearchQuery) {
      setSearchLoading(true);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setSearchLoading(false);
    }, 500);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, debouncedSearchQuery]);
  
  // Debounce advanced search fields (500ms delay)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Show loading if advanced search fields are being typed
    const fieldsChanged = JSON.stringify(searchFields) !== JSON.stringify(debouncedSearchFields);
    if (fieldsChanged) {
      setSearchLoading(true);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchFields(searchFields);
      setSearchLoading(false);
    }, 500);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchFields, debouncedSearchFields]);

  // Add debounce ref for stats loading to prevent duplicate calls
  const statsLoadingRef = useRef(false);
  const statsTimeoutRef = useRef(null);

  // Load customer statistics using optimized backend API with debounce protection
  const loadCustomerStats = useCallback(async () => {
    // Prevent duplicate simultaneous calls
    if (statsLoadingRef.current) {
      return;
    }

    // Clear any pending timeout
    if (statsTimeoutRef.current) {
      clearTimeout(statsTimeoutRef.current);
      statsTimeoutRef.current = null;
    }

    // Set loading flag
    statsLoadingRef.current = true;

    try {
      // Use the optimized backend stats endpoint - single efficient API call
      const stats = await customerService.getCustomerStatistics();
      
      if (stats) {
        setCustomerStats({
          total: stats.total_customers || 0,
          active: stats.active_customers || 0,
          suspended: stats.suspended_customers || 0,
          archived: stats.archived_customers || 0,
          newThisMonth: stats.new_this_month || 0,
          serviceAlerts: stats.service_alerts || 0,
          needsFollowUp: stats.needs_follow_up || 0,
          eligibleForIncrease: stats.eligible_for_increase || 0
        });
      }
    } catch (error) {
      
      // Fallback with safe defaults
      setCustomerStats({
        total: 0,
        active: 0,
        suspended: 0,
        archived: 0,
        newThisMonth: 0,
        goodStanding: 0,
        needsFollowUp: 0,
        eligibleForIncrease: 0
      });
      
      // Show user-friendly error message
      toast({
        title: 'Stats Loading Error',
        description: 'Unable to load customer statistics. Please refresh the page.',
        variant: 'destructive'
      });
    } finally {
      // Reset loading flag after a short delay to prevent rapid successive calls
      setTimeout(() => {
        statsLoadingRef.current = false;
      }, 1000);
    }
  }, [toast]);

  // Debounced version of loadCustomerStats
  const debouncedLoadCustomerStats = useCallback(() => {
    if (statsTimeoutRef.current) {
      clearTimeout(statsTimeoutRef.current);
    }
    
    statsTimeoutRef.current = setTimeout(() => {
      loadCustomerStats();
    }, 300); // 300ms debounce
  }, [loadCustomerStats]);

  // Listen for service alert changes and auto-refresh stats
  useEffect(() => {
    const handleServiceAlertUpdate = async () => {
      // Refresh customer stats when service alerts change (debounced)
      try {
        await customerService.forceRefresh(); // Clear cache
        debouncedLoadCustomerStats(); // Use debounced version
      } catch (error) {
        // Error handled
      }
    };

    // Listen for global alert events
    window.addEventListener('refreshAlertCounts', handleServiceAlertUpdate);
    window.addEventListener('refreshCustomerAlerts', handleServiceAlertUpdate);
    
    // Set up periodic refresh for stats (every 60 seconds, but debounced)
    const statsRefreshInterval = setInterval(() => {
      debouncedLoadCustomerStats();
    }, 60000);
    
    return () => {
      window.removeEventListener('refreshAlertCounts', handleServiceAlertUpdate);
      window.removeEventListener('refreshCustomerAlerts', handleServiceAlertUpdate);
      clearInterval(statsRefreshInterval);
      
      // Clean up timeout on unmount
      if (statsTimeoutRef.current) {
        clearTimeout(statsTimeoutRef.current);
      }
    };
  }, [debouncedLoadCustomerStats]);

  // Helper function to check if advanced search is active (for Clear button logic)
  const isAdvancedSearchActive = () => {
    return searchFields.firstName || searchFields.lastName || searchFields.phone || searchFields.email;
  };

  // Helper function to get current search term (for immediate actions)
  const getCurrentSearchTerm = useCallback(() => {
    if (searchQuery) {
      return searchQuery.trim();
    } else if (searchFields.phone && searchFields.phone.trim()) {
      return searchFields.phone.trim();
    } else {
      const firstName = searchFields.firstName?.trim() || '';
      const lastName = searchFields.lastName?.trim() || '';
      const email = searchFields.email?.trim() || '';
      
      if (firstName && lastName) {
        return `${firstName} ${lastName}`;
      } else if (firstName) {
        return firstName;
      } else if (lastName) {
        return lastName;
      } else if (email) {
        return email;
      }
    }
    return '';
  }, [searchQuery, searchFields.phone, searchFields.firstName, searchFields.lastName, searchFields.email]);

  const clearSearchFields = () => {
    // Clear timeout to prevent pending searches
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Clear all search states immediately
    setSearchFields({
      firstName: '',
      lastName: '',
      phone: '',
      email: ''
    });
    setDebouncedSearchFields({
      firstName: '',
      lastName: '',
      phone: '',
      email: ''
    });
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setStatusFilter('all');
    setSearchLoading(false);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <ChevronUp className="h-4 w-4 text-muted-foreground" />;
    }
    return sortOrder === 'asc' ? 
      <ChevronUp className="h-4 w-4" /> : 
      <ChevronDown className="h-4 w-4" />;
  };

  const handleSuspendCustomer = async () => {
    try {
      const updatedCustomer = await customerService.updateCustomer(selectedCustomer.phone_number, {
        status: 'suspended'
      });
      
      // Update the selected customer
      setSelectedCustomer(updatedCustomer);
      
      // Update customer in the list
      setCustomers(prevCustomers => 
        prevCustomers.map(customer => 
          customer.phone_number === selectedCustomer.phone_number 
            ? updatedCustomer 
            : customer
        )
      );
      
      toast({
        title: 'Customer Suspended',
        description: 'Customer account has been suspended and access is temporarily restricted'
      });
      
      setShowSuspendDialog(false);
      
      // Refresh stats to reflect status change
      await loadCustomerStats();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to suspend customer. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleArchiveCustomer = async () => {
    if (archiveConfirmation !== 'ARCHIVE') {
      toast({
        title: 'Invalid Confirmation',
        description: 'Please type "ARCHIVE" to confirm this action',
        variant: 'destructive'
      });
      return;
    }

    try {
      await customerService.archiveCustomer(
        selectedCustomer.phone_number, 
        'Admin action - permanent archive'
      );
      
      // Remove customer from the list since they're archived
      setCustomers(prevCustomers => 
        prevCustomers.filter(customer => 
          customer.phone_number !== selectedCustomer.phone_number
        )
      );
      
      // Clear selected customer since it's now archived
      setSelectedCustomer(null);
      setShowDetails(false);
      
      toast({
        title: 'Customer Archived',
        description: 'Customer has been permanently archived and moved to archived records'
      });
      
      setShowArchiveDialog(false);
      setArchiveConfirmation('');
      
      // Force refresh both stats and customer list to ensure immediate data consistency
      await loadCustomers(currentPage, getCurrentSearchTerm(), statusFilter, true, alertFilter);
      
    } catch (error) {
      
      // Handle specific error cases
      let errorMessage = 'Failed to archive customer. Please try again.';
      if (error.message && error.message.includes('active loans')) {
        errorMessage = 'Cannot archive customer with active loans. Please resolve all loans first.';
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  };

  // Apply advanced filters
  const applyAdvancedFilters = () => {
    // Close the filter sheet
    setShowFilters(false);
    
    // Update the main status filter to sync with advanced filters
    setStatusFilter(advancedFilters.status);
    
    // Reset to first page when applying filters
    setCurrentPage(1);
    
    // Load customers with the applied filters
    loadCustomerList(1, getCurrentSearchTerm(), advancedFilters.status === 'all' ? null : advancedFilters.status, alertFilter);
    
    // Show appropriate toast message
    if (advancedFilters.status !== 'all') {
      const statusText = advancedFilters.status === 'active' ? 'Active' : 
                        advancedFilters.status === 'suspended' ? 'Suspended' : 
                        'Archived';
      toast({
        title: 'Filter Applied',
        description: `Showing ${statusText} customers only`,
        duration: 3000
      });
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    // Reset all filter states
    setAdvancedFilters({
      status: 'all',
      creditLimit: 'all',
      paymentHistory: 'all',
      });
    setStatusFilter('all');
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setSearchFields({
      firstName: '',
      lastName: '',
      phone: '',
      email: ''
    });
    
    // Close the filter sheet
    setShowFilters(false);
    
    // Reset to first page
    setCurrentPage(1);
    
    // Clear alert filter too
    setAlertFilter(false);
    
    // Load customers without filters
    loadCustomerList(1, '', null, false); // Clear alert filter when clearing all filters
    
    // Show confirmation toast
    toast({
      title: 'Filters Cleared',
      description: 'All filters have been removed',
      duration: 2000
    });
  };

  // Note: loadCustomerStats has been moved earlier in the file to fix hoisting issue

  // Load only customer list (for search/pagination) 
  const loadCustomerList = useCallback(async (page = 1, search = '', status = null, filterByAlerts = null) => {
    setCustomerListLoading(true);
    setCustomerListError(null);
    try {
      const params = {
        per_page: customersPerPage,
        page: page,
      };
      
      // Add search parameter if provided
      if (search) {
        params.search = search;
      }
      
      // Add status filter if provided
      if (status && status !== 'all') {
        params.status = status;
      }
      
      // Add sorting
      params.sort_by = sortField === 'customer' ? 'first_name' : 
                       sortField === 'contact' ? 'phone_number' :
                       sortField === 'loan_activity' ? 'active_loans' :
                       sortField === 'last_visit' ? 'last_transaction_date' :
                       sortField;
      params.sort_order = sortOrder;
      
      // Use enhanced search if we have a search term, otherwise use getAllCustomers
      let response = search ? 
        await customerService.searchCustomers(search, params) : 
        await customerService.getAllCustomers(params);
      
      // Apply alert filtering if requested
      if (filterByAlerts) {
        try {
          // Get customers with alerts from service alert service
          const alertStats = await serviceAlertService.getUniqueCustomerAlertStats();
          const customersWithAlerts = alertStats.customers_with_alerts || [];
          
          if (response && response.customers) {
            // Filter customers to only include those with alerts
            const filteredCustomers = response.customers.filter(customer => 
              customersWithAlerts.includes(customer.phone_number)
            );
            
            response = {
              ...response,
              customers: filteredCustomers,
              total: filteredCustomers.length
            };
          }
        } catch (error) {
          // Error handled
          // Continue with unfiltered results if alert filtering fails
        }
      }
      
      // Handle paginated response with metadata
      if (response && response.customers) {
        setCustomers(response.customers);
        setTotalCustomers(response.total || 0);
        setCustomerListError(null);
        
        // Batch initialize alert counts for all loaded customers
        const customerPhones = response.customers.map(customer => customer.phone_number);
        if (customerPhones.length > 0) {
          initializeAlertCounts(customerPhones).catch(error => {
            // Silent error handling - alert counts will show as 0 if failed
            console.warn('Failed to initialize alert counts:', error);
          });
        }
      } else {
        // Fallback for unexpected response
        setCustomers([]);
        setTotalCustomers(0);
      }
      
    } catch (error) {
      
      // Enhanced error handling for different error types
      let errorMessage = 'Failed to load customers';
      let userMessage = 'Failed to load customers';
      
      if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
        errorMessage = 'Rate limit exceeded - too many requests';
        userMessage = 'System is busy. Please wait a moment and try again.';
        
        // Auto-retry after rate limit delay with current parameters
        setTimeout(() => {
          loadCustomerList(page, search, status, filterByAlerts);
        }, 3000);
      } else if (error.message?.includes('Authentication')) {
        errorMessage = 'Authentication error';
        userMessage = 'Session expired. Please log in again.';
      } else if (error.message?.includes('Network')) {
        errorMessage = 'Network connection error';
        userMessage = 'Connection problem. Check your internet and try again.';
      } else {
        errorMessage = error.message || 'Unknown error';
        userMessage = 'Unable to load customer data. Please try again.';
      }
      
      setCustomerListError(errorMessage);
      toast({
        title: 'Error Loading Customers',
        description: userMessage,
        variant: 'destructive'
      });
    } finally {
      setCustomerListLoading(false);
    }
  }, [customersPerPage, sortField, sortOrder, toast, initializeAlertCounts]);

  // Force complete data refresh - clears all caches and reloads
  const forceRefreshAllData = useCallback(async () => {
    setLoading(true);
    try {
      // Force cache invalidation
      await customerService.forceRefresh();
      
      // Load stats and customer list in parallel with fresh data
      await Promise.all([
        loadCustomerStats(),
        loadCustomerList(currentPage, getCurrentSearchTerm(), statusFilter, alertFilter)
      ]);
      
      toast({
        title: 'Data Refreshed',
        description: 'All customer data has been refreshed with the latest information.',
        duration: 2000
      });
    } catch (error) {
      toast({
        title: 'Refresh Failed',
        description: 'Failed to refresh data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [loadCustomerStats, loadCustomerList, currentPage, getCurrentSearchTerm, statusFilter, alertFilter, toast]);

  // Load full page data (initial load with stats)
  const loadCustomers = useCallback(async (page = 1, search = '', status = null, forceRefresh = false, filterByAlerts = null) => {
    setLoading(true);
    try {
      // Clear cache if force refresh requested
      if (forceRefresh) {
        await customerService.forceRefresh();
      }
      
      // Load stats and customer list in parallel
      await Promise.all([
        loadCustomerStats(),
        loadCustomerList(page, search, status, filterByAlerts)
      ]);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [loadCustomerStats, loadCustomerList]);




  // EMERGENCY FIX: Single consolidated useEffect to prevent rate limit errors
  const hasInitialLoadRef = useRef(false);
  const lastRequestRef = useRef('');
  
  useEffect(() => {
    // Build search term
    let searchTerm = '';
    
    if (debouncedSearchQuery) {
      searchTerm = debouncedSearchQuery.trim();
    } else if (debouncedSearchFields.phone && debouncedSearchFields.phone.trim()) {
      searchTerm = debouncedSearchFields.phone.trim();
    } else {
      const firstName = debouncedSearchFields.firstName?.trim() || '';
      const lastName = debouncedSearchFields.lastName?.trim() || '';
      const email = debouncedSearchFields.email?.trim() || '';
      
      if (firstName && lastName) {
        searchTerm = `${firstName} ${lastName}`;
      } else if (firstName) {
        searchTerm = firstName;
      } else if (lastName) {
        searchTerm = lastName;
      } else if (email) {
        searchTerm = email;
      }
    }
    
    // Create request signature to prevent duplicate requests
    const requestSignature = `${currentPage}-${searchTerm}-${statusFilter}-${sortField}-${sortOrder}`;
    
    // Prevent duplicate API calls
    if (lastRequestRef.current === requestSignature) {
      return;
    }
    
    lastRequestRef.current = requestSignature;
    
    // Throttle API calls - only allow one every 500ms
    const now = Date.now();
    const lastCallTime = lastRequestRef.lastCall || 0;
    const timeSinceLastCall = now - lastCallTime;
    
    const makeRequest = () => {
      lastRequestRef.lastCall = Date.now();
      
      if (!hasInitialLoadRef.current) {
        // First load - get both stats and customers
        hasInitialLoadRef.current = true;
        loadCustomers(currentPage, searchTerm, statusFilter, false, alertFilter);
      } else {
        // Subsequent loads - only get customer list
        loadCustomerList(currentPage, searchTerm, statusFilter, alertFilter);
      }
    };
    
    if (timeSinceLastCall >= 500) {
      makeRequest();
    } else {
      // Debounce rapid requests
      const timeoutId = setTimeout(makeRequest, 500 - timeSinceLastCall);
      return () => clearTimeout(timeoutId);
    }
  }, [currentPage, debouncedSearchQuery, debouncedSearchFields, statusFilter, alertFilter, sortField, sortOrder, loadCustomers, loadCustomerList]);

  // For server-side pagination, we don't need client-side filtering
  const totalPages = Math.ceil(totalCustomers / customersPerPage);
  const currentCustomers = customers; // Use the loaded customers directly

  // Reset to page 1 when search or filters change (immediate response for UI)
  useEffect(() => {
    setCurrentPage(1);
    setSelectedCustomerIds([]); // Clear selections when filters change
  }, [searchQuery, searchFields, statusFilter, alertFilter]);


  const handleSelectAll = (checked) => {
    if (checked) {
      const currentPageIds = currentCustomers.map(c => c.phone_number);
      setSelectedCustomerIds(currentPageIds);
    } else {
      setSelectedCustomerIds([]);
    }
  };

  const handleSelectCustomer = (customerId, checked) => {
    if (checked) {
      setSelectedCustomerIds(prev => [...prev, customerId]);
    } else {
      setSelectedCustomerIds(prev => prev.filter(id => id !== customerId));
    }
  };

  const handleBulkStatusChange = async (newStatus) => {
    if (!selectedCustomerIds.length) return;
    
    // Show modal dialogs for all actions
    if (newStatus === 'active') {
      setShowBulkActivateDialog(true);
    } else if (newStatus === 'suspended') {
      setShowBulkSuspendDialog(true);
    } else if (newStatus === 'archived') {
      setShowBulkArchiveDialog(true);
    }
  };

  const performBulkStatusChange = async (newStatus) => {
    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const phoneNumber of selectedCustomerIds) {
        try {
          const customer = customers.find(c => c.phone_number === phoneNumber);
          if (customer) {
            await customerService.updateCustomer(phoneNumber, { status: newStatus });
            successCount++;
          }
        } catch (error) {
          failCount++;
        }
      }

      // Force refresh data to ensure immediate consistency
      await loadCustomers(currentPage, getCurrentSearchTerm(), statusFilter, true, alertFilter);
      setSelectedCustomerIds([]);

      // Show result toast
      if (successCount > 0) {
        toast({
          title: 'Bulk Update Complete',
          description: `Successfully updated ${successCount} customer${successCount > 1 ? 's' : ''}${failCount > 0 ? `. ${failCount} failed.` : '.'}`,
          variant: failCount > 0 ? 'warning' : 'default'
        });
      } else {
        toast({
          title: 'Bulk Update Failed',
          description: 'Failed to update customers',
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewCustomer = (customer) => {
    setSelectedCustomer(customer);
    setShowDetails(true);
  };

  const handleSetCustomLimit = (customer) => {
    if (isAdmin) {
      setSelectedCustomerForLimit(customer);
      setShowCustomLimitDialog(true);
    } else {
      toast({
        title: "Access Denied",
        description: "Only admin users can set custom loan limits.",
        variant: "destructive",
      });
    }
  };

  const handleCustomerUpdate = (updatedCustomer) => {
    // Update the customer in the list
    setCustomers(prevCustomers => 
      prevCustomers.map(customer => 
        customer.phone_number === updatedCustomer.phone_number 
          ? updatedCustomer 
          : customer
      )
    );
    
    // Update selected customer if it's the same one
    if (selectedCustomer && selectedCustomer.phone_number === updatedCustomer.phone_number) {
      setSelectedCustomer(updatedCustomer);
    }
  };

  const handleEditCustomer = (customer) => {
    if (isAdminRole(user)) {
      // For admins, use the tabbed interface
      setSelectedCustomer(customer);
      setShowDetails(true);
      setTimeout(() => setActiveTab('admin'), 100);
      toast({
        title: 'Edit Customer',
        description: 'Switched to Admin Actions for customer editing.',
        duration: 2000
      });
    } else {
      // For staff, use the dialog
      setEditingCustomer(customer);
      setShowAddDialog(true);
    }
  };

  // Handle Service Alert Bell Click
  const handleBellClick = (customerPhone, alertCount, refreshCount) => {
    const customer = customers.find(c => c.phone_number === customerPhone);
    if (customer) {
      setSelectedCustomerForAlert({
        phone: customer.phone_number,
        name: `${customer.first_name} ${customer.last_name}`,
        refreshCount
      });
      setShowServiceAlertDialog(true);
    }
  };

  // Handle Alert Resolved (callback from dialog)
  const handleAlertResolved = () => {
    // Refresh the alert counts for all visible bells
    window.dispatchEvent(new CustomEvent('refreshAlertCounts'));
    
    // Also refresh the specific customer if we have that info
    if (selectedCustomerForAlert?.phone) {
      window.dispatchEvent(new CustomEvent('refreshCustomerAlerts', {
        detail: { customerPhone: selectedCustomerForAlert.phone }
      }));
    }
    
    // Clear service alert cache to ensure fresh data
    if (typeof serviceAlertService?.clearCache === 'function') {
      serviceAlertService.clearCache();
    }
  };

  const handleCustomerSaved = async (savedCustomer) => {
    setShowAddDialog(false);
    setEditingCustomer(null);
    
    // Force complete cache invalidation for immediate refresh
    await customerService.forceRefresh();
    
    // Refresh both customer list and stats with immediate effect
    await Promise.all([
      loadCustomerList(currentPage, getCurrentSearchTerm(), statusFilter, alertFilter),
      loadCustomerStats() // Refresh stats including Eligible for Loans count
    ]);
    
    // If we have a selected customer open, refresh their data
    if (selectedCustomer && savedCustomer) {
      // Update the selected customer with fresh data
      try {
        // Clear specific customer cache and get fresh data
        customerService.clearCustomerCache(savedCustomer.phone_number);
        const updatedCustomer = await customerService.getCustomerByPhone(savedCustomer.phone_number);
        if (updatedCustomer) {
          setSelectedCustomer(updatedCustomer);
        }
      } catch (error) {
      }
    }
    
    // Show success message
    toast({
      title: editingCustomer ? 'Customer Updated' : 'Customer Created',
      description: savedCustomer ? 
        `${customerService.getCustomerFullName(savedCustomer)} has been ${editingCustomer ? 'updated' : 'created'} successfully.` :
        `Customer has been ${editingCustomer ? 'updated' : 'created'} successfully.`,
    });
  };

  const handleStartEditingNotes = () => {
    setNotesText(selectedCustomer?.notes || '');
    setIsEditingNotes(true);
  };

  const handleCancelEditingNotes = () => {
    setIsEditingNotes(false);
    setNotesText('');
  };

  const handleSaveNotes = async () => {
    if (!selectedCustomer) return;
    
    setSaveNotesLoading(true);
    try {
      const updatedCustomer = await customerService.updateCustomer(selectedCustomer.phone_number, {
        notes: notesText.trim()
      });
      
      // Force cache clear and refresh for immediate UI update
      await customerService.forceRefresh();
      customerService.clearCustomerCache(selectedCustomer.phone_number);
      
      // Update the selected customer with new notes
      setSelectedCustomer(updatedCustomer);
      
      // Update the customer in the list as well
      setCustomers(prevCustomers => 
        prevCustomers.map(customer => 
          customer.phone_number === selectedCustomer.phone_number 
            ? updatedCustomer 
            : customer
        )
      );
      
      setIsEditingNotes(false);
      setNotesText('');
      
      toast({
        title: 'Success',
        description: 'Customer notes updated successfully'
      });
      
      // Force refresh list to ensure immediate data consistency
      await loadCustomers(currentPage, getCurrentSearchTerm(), statusFilter, true, alertFilter);
      
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save notes. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSaveNotesLoading(false);
    }
  };


  const formatDate = (dateString) => {
    return formatBusinessDate(dateString);
  };

  const getRelativeTime = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
    return `${Math.ceil(diffDays / 365)} years ago`;
  };

  const getCustomerInitials = (customer) => {
    const firstName = customer.first_name || '';
    const lastName = customer.last_name || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getCustomerAvatarUrl = (customer) => {
    const fullName = customerService.getCustomerFullName(customer);
    // Shapes, icons, or abstract designs - using full name + phone for uniqueness
    return `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(fullName + customer.phone_number)}`;
    // Options: shapes, icons, identicon (no human features)
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 transition-colors duration-300">
        <div className="p-6">
          {/* Action Button Skeleton */}
          <div className="flex justify-end mb-6">
            <div className="h-11 w-[140px] bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
          </div>

          {/* Customer Stats Cards Skeleton */}
          <div className={`grid grid-cols-1 gap-4 mb-6 ${isAdmin ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
            {Array.from({ length: isAdmin ? 5 : 4 }).map((_, i) => (
              <StatsCardSkeleton key={i} />
            ))}
          </div>

          {/* Search Section Skeleton */}
          <SearchSkeleton />

          {/* Table Skeleton */}
          <div className="mt-6">
            <CustomerTableSkeleton rows={8} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Customer Management
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage customer records and track loan eligibility
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => {
              setEditingCustomer(null);
              setShowAddDialog(true);
            }}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 border-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
          <Button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              forceRefreshAllData();
            }}
            variant="outline"
            disabled={loading}
            className="border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 shadow-sm dark:shadow-slate-800/50 transition-all duration-200"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600 dark:text-blue-400" />
            ) : (
              <svg className="h-4 w-4 mr-2 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Modern Stats Grid */}
      <div className={`grid gap-6 ${isAdmin ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
        {/* Active/Eligible Customers */}
        <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 hover:shadow-md transition-shadow cursor-pointer group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 group-hover:text-emerald-800 dark:group-hover:text-emerald-200">
                  Active Customers
                </p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                  {customerStats.active}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-500/10 dark:bg-emerald-400/10 rounded-xl flex items-center justify-center group-hover:bg-emerald-500/20 dark:group-hover:bg-emerald-400/20">
                <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 dark:bg-emerald-400/5 rounded-full -mr-10 -mt-10"></div>
          </CardContent>
        </Card>

        {/* New Customers This Month */}
        <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/50 dark:to-blue-950/50 hover:shadow-md transition-shadow cursor-pointer group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 group-hover:text-indigo-800 dark:group-hover:text-indigo-200">
                  New This Month
                </p>
                <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
                  {customerStats.newThisMonth}
                </p>
              </div>
              <div className="w-12 h-12 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-xl flex items-center justify-center group-hover:bg-indigo-500/20 dark:group-hover:bg-indigo-400/20">
                <TrendingUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 dark:bg-indigo-400/5 rounded-full -mr-10 -mt-10"></div>
          </CardContent>
        </Card>

        {/* Needs Follow-Up */}
        <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50 hover:shadow-md transition-shadow cursor-pointer group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300 group-hover:text-red-800 dark:group-hover:text-red-200">
                  Needs Follow-Up
                </p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                  {customerStats.needsFollowUp}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-500/10 dark:bg-red-400/10 rounded-xl flex items-center justify-center group-hover:bg-red-500/20 dark:group-hover:bg-red-400/20">
                <Phone className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/5 dark:bg-red-400/5 rounded-full -mr-10 -mt-10"></div>
          </CardContent>
        </Card>

        {/* Service Alerts */}
        <Card 
          className={`relative overflow-hidden border-0 shadow-sm bg-gradient-to-r transition-all cursor-pointer group ${
            alertFilter 
              ? 'from-yellow-100 to-amber-100 dark:from-yellow-900/70 dark:to-amber-900/70 shadow-md ring-2 ring-yellow-400 dark:ring-yellow-500' 
              : 'from-yellow-50 to-amber-50 dark:from-yellow-950/50 dark:to-amber-950/50 hover:shadow-md'
          }`}
          onClick={async () => {
            // Toggle alert filter
            const newAlertFilter = !alertFilter;
            setAlertFilter(newAlertFilter);
            setCurrentPage(1); // Reset to first page
            setSelectedCustomerIds([]); // Clear selections
            
            // Clear search when applying alert filter
            if (newAlertFilter) {
              setSearchQuery('');
              setDebouncedSearchQuery('');
              setSearchFields({ firstName: '', lastName: '', phone: '', email: '' });
              setDebouncedSearchFields({ firstName: '', lastName: '', phone: '', email: '' });
              setStatusFilter('all'); // Clear status filter
            }
            
            // Load filtered customers
            await loadCustomerList(1, '', null, newAlertFilter);
            
            // Show appropriate toast message
            toast({
              title: newAlertFilter ? 'Showing Customers with Alerts' : 'Showing All Customers',
              description: newAlertFilter 
                ? 'Displaying only customers who have active service alerts.' 
                : 'Alert filter has been removed. Showing all customers.'
            });
          }}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300 group-hover:text-yellow-800 dark:group-hover:text-yellow-200">
                  Service Alerts {loading ? '(Refreshing...)' : ''}
                </p>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                  {loading ? '-' : customerStats.serviceAlerts}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-500/10 dark:bg-yellow-400/10 rounded-xl flex items-center justify-center group-hover:bg-yellow-500/20 dark:group-hover:bg-yellow-400/20">
                <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-500/5 dark:bg-yellow-400/5 rounded-full -mr-10 -mt-10"></div>
          </CardContent>
        </Card>

        {/* Admin-only Credit Limit Increase */}
        {isAdmin && (
          <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/50 dark:to-violet-950/50 hover:shadow-md transition-shadow cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300 group-hover:text-purple-800 dark:group-hover:text-purple-200">
                    Credit Increase
                  </p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {customerStats.eligibleForIncrease}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-500/10 dark:bg-purple-400/10 rounded-xl flex items-center justify-center group-hover:bg-purple-500/20 dark:group-hover:bg-purple-400/20">
                  <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/5 dark:bg-purple-400/5 rounded-full -mr-10 -mt-10"></div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modern Search & Filter Section */}
      <Card className="border-0 shadow-sm bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
        <CardContent className="p-6 space-y-6">
          {/* Search Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Search & Filter
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Find customers by name, phone, or email
              </p>
            </div>
          </div>

          {/* Search Controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Main Search Input */}
            <div className="flex-1">
              <div className="relative">
                <Command className="rounded-xl border-0 bg-slate-100/50 dark:bg-slate-700/50">
                  <CommandInput 
                    placeholder="Search customers by name, phone, or email..." 
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    className="h-12 text-base"
                  />
                </Command>
                {searchLoading && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  </div>
                )}
              </div>
            </div>
            
            {/* Status Filter */}
            <div className="sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-12 rounded-xl border-0 bg-slate-100/50 dark:bg-slate-700/50">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">✅ Active</SelectItem>
                  <SelectItem value="suspended">⏸️ Suspended</SelectItem>
                  <SelectItem value="archived">📦 Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={clearSearchFields}
                disabled={!searchQuery && !isAdvancedSearchActive() && statusFilter === 'all' && !alertFilter}
                className="h-12 px-4 rounded-xl border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Clear
              </Button>
              <Sheet open={showFilters} onOpenChange={setShowFilters}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="h-12 px-4 gap-2 rounded-xl border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700">
                    <Filter className="h-4 w-4" />
                    Filters
                  </Button>
                </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Quick Filters</SheetTitle>
                        <SheetDescription>
                          Apply filters to refine the customer list display
                        </SheetDescription>
                      </SheetHeader>
                      
                      <div className="mt-6 space-y-4">
                        <div>
                          <label className="text-sm font-medium">Account Status</label>
                          <Select 
                            value={advancedFilters.status} 
                            onValueChange={(value) => setAdvancedFilters(prev => ({ ...prev, status: value }))}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Status</SelectItem>
                              <SelectItem value="active">✅ Active</SelectItem>
                              <SelectItem value="suspended">⚠️ Suspended</SelectItem>
                              <SelectItem value="archived">📋 Archived</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium">Credit Limit Range <span className="text-xs text-muted-foreground">(Coming Soon)</span></label>
                          <Select 
                            value={advancedFilters.creditLimit} 
                            onValueChange={(value) => setAdvancedFilters(prev => ({ ...prev, creditLimit: value }))}
                            disabled
                          >
                            <SelectTrigger className="mt-1" disabled>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Limits</SelectItem>
                              <SelectItem value="under1000">💵 Under $1,000</SelectItem>
                              <SelectItem value="1000to5000">💰 $1,000 - $5,000</SelectItem>
                              <SelectItem value="over5000">💸 Over $5,000</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        
                        <div className="pt-4 space-y-2">
                          <Button 
                            className="w-full" 
                            onClick={applyAdvancedFilters}
                          >
                            Apply Filters
                          </Button>
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={clearAllFilters}
                          >
                            Clear All Filters
                          </Button>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>

              {/* Advanced Search Toggle */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                  className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 h-8 px-2"
                >
                  <Gauge className="w-4 h-4 mr-2" />
                  Advanced Search
                  {showAdvancedSearch ? (
                    <ChevronUp className="w-4 h-4 ml-2" />
                  ) : (
                    <ChevronDown className="w-4 h-4 ml-2" />
                  )}
                  {(searchFields.firstName || searchFields.lastName || searchFields.phone || searchFields.email) && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full ml-2"></div>
                  )}
                </Button>
              </div>

              {/* Advanced Search Section - Collapsible */}
              {showAdvancedSearch && (
                <div className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">First Name</Label>
                      <Input
                        placeholder="Search by first name..."
                        value={searchFields.firstName}
                        onChange={(e) => setSearchFields(prev => ({ ...prev, firstName: e.target.value }))}
                        className="h-9 rounded-lg border-0 bg-slate-100/50 dark:bg-slate-700/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">Last Name</Label>
                      <Input
                        placeholder="Search by last name..."
                        value={searchFields.lastName}
                        onChange={(e) => setSearchFields(prev => ({ ...prev, lastName: e.target.value }))}
                        className="h-9 rounded-lg border-0 bg-slate-100/50 dark:bg-slate-700/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">Phone Number</Label>
                      <Input
                        placeholder="Search by phone..."
                        value={searchFields.phone}
                        onChange={(e) => setSearchFields(prev => ({ ...prev, phone: e.target.value }))}
                        className="h-9 rounded-lg border-0 bg-slate-100/50 dark:bg-slate-700/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">Email Address</Label>
                      <Input
                        placeholder="Search by email..."
                        value={searchFields.email}
                        onChange={(e) => setSearchFields(prev => ({ ...prev, email: e.target.value }))}
                        className="h-9 rounded-lg border-0 bg-slate-100/50 dark:bg-slate-700/50"
                      />
                    </div>
                  </div>
                  
                  {(searchFields.firstName || searchFields.lastName || searchFields.phone || searchFields.email) && (
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <CheckCircle className="w-3 h-3" />
                        Advanced search active
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSearchFields({ firstName: '', lastName: '', phone: '', email: '' })}
                        className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        Clear advanced filters
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alert Filter Indicator */}
          {alertFilter && (
            <Card className="mb-4 p-3 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">Showing customers with service alerts only</span>
                  <span className="text-xs opacity-75">({totalCustomers} found)</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAlertFilter(false);
                    setCurrentPage(1);
                    loadCustomerList(1, getCurrentSearchTerm(), statusFilter, false);
                  }}
                  className="h-7 px-3 text-xs text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100 dark:text-yellow-300 dark:hover:text-yellow-100 dark:hover:bg-yellow-900/20"
                >
                  Clear filter
                </Button>
              </div>
            </Card>
          )}

      {/* Enhanced Customer Table */}
      {/* Bulk Actions Bar */}
      {selectedCustomerIds.length > 0 && (
          <Card className="mb-4 p-4 bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {selectedCustomerIds.length} customer{selectedCustomerIds.length > 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCustomerIds([])}
                >
                  Clear Selection
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Bulk Actions:</span>
                {isAdmin && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkStatusChange('active')}
                      className="text-green-600 hover:text-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Activate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkStatusChange('suspended')}
                      className="text-yellow-600 hover:text-yellow-700"
                    >
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Suspend
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkStatusChange('archived')}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Archive className="h-4 w-4 mr-1" />
                      Archive
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Responsive Customer Display */}
        {isMobile ? (
          /* Mobile Card View */
          <div className="space-y-4">
            {customerListLoading ? (
              <CustomerTableSkeleton rows={6} />
            ) : customerListError ? (
              <Card className="p-8 text-center">
                <div className="flex flex-col items-center gap-2">
                  <AlertTriangle className="h-8 w-8 text-orange-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-red-600">Failed to load customers</p>
                    <p className="text-xs text-muted-foreground">
                      {customerListError.includes('Rate limit') ? 'Too many requests. Please wait a moment and try again.' : customerListError}
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => loadCustomerList(currentPage, getCurrentSearchTerm(), statusFilter, alertFilter)}
                      className="mt-2"
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              </Card>
            ) : currentCustomers.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="flex flex-col items-center gap-2">
                  <User className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery || statusFilter !== 'all' || alertFilter ? 'No customers found' : 'No customers yet'}
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {currentCustomers.map((customer) => (
                  <CustomerCard
                    key={customer.phone_number}
                    customer={customer}
                    isSelected={selectedCustomerIds.includes(customer.phone_number)}
                    onSelect={handleSelectCustomer}
                    onView={handleViewCustomer}
                    onEdit={handleEditCustomer}
                    onViewTransactions={(customer) => {
                      handleViewCustomer(customer);
                      setTimeout(() => setActiveTab('transactions'), 100);
                    }}
                    onManageEligibility={(customer) => {
                      handleViewCustomer(customer);
                      setTimeout(() => setActiveTab('overview'), 100);
                    }}
                    onSetCustomLimit={handleSetCustomLimit}
                    maxActiveLoans={maxActiveLoans}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Desktop Table View */
          <Card className="shadow-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 relative overflow-hidden">
            {/* Gold accent line matching login page */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600"></div>
            
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 dark:border-slate-700">
                  <TableHead className="w-[50px] pt-6">
                    <Checkbox
                      checked={currentCustomers.length > 0 && selectedCustomerIds.length === currentCustomers.length}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all customers"
                      className="border-slate-300 dark:border-slate-600"
                    />
                  </TableHead>
                  <TableHead className="w-[300px] pt-6">
                    <button 
                      className="flex items-center gap-2 hover:text-amber-600 dark:hover:text-amber-400 transition-colors font-medium"
                      onClick={() => handleSort('customer')}
                    >
                      Customer {getSortIcon('customer')}
                    </button>
                  </TableHead>
                  <TableHead className="pt-6">
                    <button 
                      className="flex items-center gap-2 hover:text-amber-600 dark:hover:text-amber-400 transition-colors font-medium"
                      onClick={() => handleSort('contact')}
                    >
                      Contact {getSortIcon('contact')}
                    </button>
                  </TableHead>
                  <TableHead className="pt-6">
                    <button 
                      className="flex items-center gap-2 hover:text-amber-600 dark:hover:text-amber-400 transition-colors font-medium"
                      onClick={() => handleSort('status')}
                    >
                      Status {getSortIcon('status')}
                    </button>
                  </TableHead>
                  <TableHead className="pt-6">
                    <button 
                      className="flex items-center gap-2 hover:text-amber-600 dark:hover:text-amber-400 transition-colors font-medium"
                      onClick={() => handleSort('loan_activity')}
                    >
                      Activity {getSortIcon('loan_activity')}
                    </button>
                  </TableHead>
                  <TableHead className="pt-6">
                    <button 
                      className="flex items-center gap-2 hover:text-amber-600 dark:hover:text-amber-400 transition-colors font-medium"
                      onClick={() => handleSort('last_visit')}
                    >
                      Last Visit {getSortIcon('last_visit')}
                    </button>
                  </TableHead>
                  <TableHead className="text-right pt-6 font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {customerListLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Loading customers...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : customerListError ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="h-8 w-8 text-orange-500" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-red-600">Failed to load customers</p>
                        <p className="text-xs text-muted-foreground">
                          {customerListError.includes('Rate limit') ? 'Too many requests. Please wait a moment and try again.' : customerListError}
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => loadCustomerList(currentPage, getCurrentSearchTerm(), statusFilter, alertFilter)}
                          className="mt-2"
                        >
                          Try Again
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : currentCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <User className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {searchQuery || statusFilter !== 'all' || alertFilter ? 'No customers found' : 'No customers yet'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                currentCustomers.map((customer) => (
                  <TableRow 
                    key={customer.phone_number}
                    className="hover:bg-muted/50 group transition-colors"
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedCustomerIds.includes(customer.phone_number)}
                        onCheckedChange={(checked) => handleSelectCustomer(customer.phone_number, checked)}
                        aria-label={`Select ${customerService.getCustomerFullName(customer)}`}
                      />
                    </TableCell>
                    <TableCell 
                      className="cursor-pointer"
                      onClick={() => handleViewCustomer(customer)}
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage 
                            src={getCustomerAvatarUrl(customer)} 
                            alt={customerService.getCustomerFullName(customer)}
                          />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {getCustomerInitials(customer)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {customerService.getCustomerFullName(customer)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell 
                      className="cursor-pointer"
                      onClick={() => handleViewCustomer(customer)}
                    >
                      <div>
                        <p className="font-mono text-sm">{customerService.formatPhoneNumber(customer.phone_number)}</p>
                        {customer.email && (
                          <p className="text-sm text-muted-foreground">{customer.email}</p>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell 
                      className="cursor-pointer"
                      onClick={() => handleViewCustomer(customer)}
                    >
                      <div className="flex items-center space-x-2">
                        <StatusBadge status={customer.status} />
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>Active: {customer.active_loans || 0}</span>
                        </div>
                        <Progress 
                          value={Math.min(((customer.active_loans || 0) / maxActiveLoans) * 100, 100)} 
                          className="h-1"
                        />
                        <p className="text-xs text-muted-foreground">
                          {customer.total_transactions || 0} total loans
                        </p>
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-muted-foreground">
                      <div>
                        <p className="text-sm">
                          {customer.last_visit ? formatDate(customer.last_visit) : 'Never'}
                        </p>
                        {customer.last_visit && (
                          <p className="text-xs">{getRelativeTime(customer.last_visit)}</p>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCustomer(customer);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewCustomer(customer);
                            // Ensure Overview tab is selected
                            setTimeout(() => setActiveTab('overview'), 100);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <AlertBellAction
                          customerPhone={customer.phone_number}
                          onBellClick={handleBellClick}
                        />
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSetCustomLimit(customer);
                            }}
                            title="Set Custom Loan Limit (Admin Only)"
                          >
                            <Gauge className="h-4 w-4" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              handleViewCustomer(customer);
                              // Ensure Overview tab is selected
                              setTimeout(() => setActiveTab('overview'), 100);
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditCustomer(customer)}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit Customer
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              handleViewCustomer(customer);
                              // Auto-switch to transactions tab for transaction history
                              setTimeout(() => setActiveTab('transactions'), 100);
                              toast({
                                title: 'Transaction History',
                                description: 'Switched to Transactions tab to view customer transaction history.',
                                duration: 2000
                              });
                            }}>
                              <CreditCard className="h-4 w-4 mr-2" />
                              View Transactions
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleViewCustomer(customer);
                                
                                // Auto-switch to overview tab for loan eligibility management
                                setTimeout(() => {
                                  setActiveTab('overview');
                                  toast({
                                    title: 'Loan Eligibility Management',
                                    description: 'Switched to Overview tab for comprehensive loan eligibility tools.',
                                    duration: 3000
                                  });
                                }, 100);
                              }}
                            >
                              <TrendingUp className="h-4 w-4 mr-2" />
                              Manage Eligibility
                            </DropdownMenuItem>
                            {isAdmin && (
                              <DropdownMenuItem onClick={() => handleSetCustomLimit(customer)}>
                                <Gauge className="h-4 w-4 mr-2" />
                                Set Loan Limit
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Results Summary and Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {Math.min((currentPage - 1) * customersPerPage + 1, totalCustomers)}-{Math.min(currentPage * customersPerPage, totalCustomers)} of {totalCustomers} customers
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, index) => {
                  const pageNumber = index + 1;
                  // Show first page, last page, current page, and pages around current
                  if (
                    pageNumber === 1 ||
                    pageNumber === totalPages ||
                    (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                  ) {
                    return (
                      <Button
                        key={pageNumber}
                        variant={currentPage === pageNumber ? "default" : "outline"}
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={() => setCurrentPage(pageNumber)}
                      >
                        {pageNumber}
                      </Button>
                    );
                  } else if (
                    pageNumber === currentPage - 2 ||
                    pageNumber === currentPage + 2
                  ) {
                    return <span key={pageNumber} className="px-1">...</span>;
                  }
                  return null;
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>

        {/* Modern Customer Details Sidebar */}
      <Sheet open={showDetails} onOpenChange={setShowDetails}>
        <SheetContent side="right" className="w-[50vw] min-w-[600px] max-w-[800px] bg-gradient-to-br from-slate-50/95 via-blue-50/30 to-indigo-50/40 dark:from-slate-950/95 dark:via-slate-900/95 dark:to-slate-800/95 backdrop-blur-xl border-0">
          <div className="h-full flex flex-col">
            {/* Modern Header with Glass Effect */}
            <SheetHeader className="flex-shrink-0 pb-6 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-lg -mx-6 -mt-6 px-6 pt-6">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Avatar className="h-16 w-16 shadow-xl ring-4 ring-white/20 dark:ring-slate-700/20">
                    <AvatarImage 
                      src={selectedCustomer && getCustomerAvatarUrl(selectedCustomer)} 
                      alt={selectedCustomer && customerService.getCustomerFullName(selectedCustomer)}
                    />
                    <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold text-lg">
                      {selectedCustomer && getCustomerInitials(selectedCustomer)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-3 border-white dark:border-slate-900 flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100 truncate mb-1">
                    {selectedCustomer && customerService.getCustomerFullName(selectedCustomer)}
                  </SheetTitle>
                  <SheetDescription className="text-slate-600 dark:text-slate-400 font-mono text-lg mb-2">
                    {selectedCustomer && customerService.formatPhoneNumber(selectedCustomer.phone_number)}
                  </SheetDescription>
                  {selectedCustomer && (
                    <StatusBadge status={selectedCustomer.status} className="shadow-sm" />
                  )}
                </div>
              </div>
            </SheetHeader>
            
            <div className="flex-1 overflow-y-auto py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

          {selectedCustomer && (
            <div>
              {/* Modern Navigation Pills */}
              <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-lg rounded-2xl p-3 mb-6 shadow-lg border border-white/20 dark:border-slate-700/20">
                <div className={`grid w-full ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'} gap-3`}>
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`flex items-center justify-center space-x-2 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeTab === 'overview' 
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span className="hidden sm:inline">Overview</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('transactions')}
                    className={`flex items-center justify-center space-x-2 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeTab === 'transactions' 
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span className="hidden sm:inline">Transactions</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={`flex items-center justify-center space-x-2 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeTab === 'notes' 
                        ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span className="hidden sm:inline">Notes</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setActiveTab('admin')}
                      className={`flex items-center justify-center space-x-2 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                        activeTab === 'admin' 
                          ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25' 
                          : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                    >
                      <Gauge className="w-4 h-4" />
                      <span className="hidden sm:inline">Admin</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Overview Tab Content */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Modern Stats Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full -mr-8 -mt-8"></div>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Active Loans</p>
                            <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{selectedCustomer.active_loans || 0}</p>
                          </div>
                          <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                            <CreditCard className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full -mr-8 -mt-8"></div>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Total Paid</p>
                            <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">{formatCurrency(selectedCustomer.total_paid || 0)}</p>
                          </div>
                          <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Contact Information Card */}
                  <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-slate-500 to-slate-700 rounded-xl flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        Contact Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl">
                        <div className="flex items-center gap-3 min-w-0 shrink-0">
                          <Phone className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                          <span className="text-slate-600 dark:text-slate-400">Phone:</span>
                        </div>
                        <span className="font-mono font-medium break-all text-right">{customerService.formatPhoneNumber(selectedCustomer.phone_number)}</span>
                      </div>
                      
                      {selectedCustomer.email && (
                        <div className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl">
                          <div className="flex items-center gap-3 min-w-0 shrink-0">
                            <Mail className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                            <span className="text-slate-600 dark:text-slate-400">Email:</span>
                          </div>
                          <span className="font-medium break-all text-right min-w-0">{selectedCustomer.email}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          <span className="text-slate-600 dark:text-slate-400">Member Since:</span>
                        </div>
                        <span className="font-medium">{formatDate(selectedCustomer.created_at)}</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          <span className="text-slate-600 dark:text-slate-400">Status:</span>
                        </div>
                        <StatusBadge status={selectedCustomer.status} />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Loan Eligibility Section */}
                  <LoanEligibilityManager 
                    customer={selectedCustomer}
                    onEligibilityUpdate={(eligibility) => {
                      // Handle eligibility updates if needed
                    }}
                  />
                </div>
              )}

              {/* Transactions Tab Content */}
              {activeTab === 'transactions' && (
                <TransactionsTabContent selectedCustomer={selectedCustomer} />
              )}

              {/* Notes Tab Content */}
              {activeTab === 'notes' && (
                <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        Customer Notes
                      </CardTitle>
                      {!isEditingNotes && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleStartEditingNotes}
                          className="text-violet-600 border-violet-200 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-700 dark:hover:bg-violet-950/50"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          {selectedCustomer?.notes ? 'Edit Notes' : 'Add Notes'}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isEditingNotes ? (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="customerNotes" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Internal Notes
                          </Label>
                          <Textarea
                            id="customerNotes"
                            placeholder="Add internal notes about this customer (confidential staff use only)..."
                            value={notesText}
                            onChange={(e) => setNotesText(e.target.value)}
                            className="mt-2 min-h-[120px] bg-white/70 dark:bg-slate-700/70 border-violet-200 dark:border-violet-700 focus:border-violet-500 dark:focus:border-violet-400 focus:ring-violet-500/20 resize-none"
                            disabled={saveNotesLoading}
                          />
                        </div>
                        <div className="flex gap-3">
                          <Button
                            onClick={handleSaveNotes}
                            disabled={saveNotesLoading}
                            className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25"
                          >
                            {saveNotesLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Save Notes
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={handleCancelEditingNotes}
                            disabled={saveNotesLoading}
                            className="border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : selectedCustomer?.notes ? (
                      <div className="p-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                        <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {selectedCustomer.notes}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/50 dark:to-purple-900/50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                          <FileText className="w-10 h-10 text-violet-400 dark:text-violet-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                          No Notes Available
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
                          Click "Add Notes" to create internal staff notes for this customer.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Admin Tab Content */}
              {activeTab === 'admin' && isAdmin && (
                <div className="space-y-6">
                  {/* Admin Header */}
                  <div className="p-5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-amber-200/50 dark:border-amber-700/50 shadow-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Gauge className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Admin Controls</h3>
                        <p className="text-sm text-amber-600 dark:text-amber-400">Administrative actions and customer management</p>
                      </div>
                    </div>
                  </div>

                  {/* Customer Management Section */}
                  <div className="p-5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-blue-200/50 dark:border-blue-700/50 shadow-lg">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                        <Edit2 className="w-4 h-4 text-white" />
                      </div>
                      <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Customer Management</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      <Button 
                        variant="outline" 
                        className="justify-start h-auto py-3 px-4 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        onClick={() => {
                          setEditingCustomer(selectedCustomer);
                          setShowAddDialog(true);
                        }}
                      >
                        <Edit2 className="w-4 h-4 mr-3 shrink-0" />
                        <div className="text-left min-w-0 flex-1">
                          <p className="font-medium break-words">Edit Customer Details</p>
                          <p className="text-xs text-blue-600/70 dark:text-blue-400/70 break-words leading-relaxed">Modify personal information and contact details</p>
                        </div>
                      </Button>
                    </div>
                  </div>

                  {/* Account Status Actions */}
                  <div className="p-5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-amber-200/50 dark:border-amber-700/50 shadow-lg">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Account Status</h4>
                    </div>
                    
                    <div className="space-y-3">
                      <Button 
                        variant="outline" 
                        className="justify-start h-auto py-3 px-4 w-full bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                        onClick={() => setShowSuspendDialog(true)}
                      >
                        <AlertTriangle className="w-4 h-4 mr-3 shrink-0" />
                        <div className="text-left min-w-0 flex-1">
                          <p className="font-medium break-words">Suspend Customer</p>
                          <p className="text-xs text-amber-600/70 dark:text-amber-400/70 break-words leading-relaxed">Temporarily restrict account access (reversible)</p>
                        </div>
                      </Button>
                      
                      {selectedCustomer?.status === 'suspended' && (
                        <Button 
                          variant="outline" 
                          className="justify-start h-auto py-3 px-4 w-full bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                          onClick={async () => {
                            try {
                              const updatedCustomer = await customerService.updateCustomer(selectedCustomer.phone_number, {
                                status: 'active'
                              });
                              
                              // Update the selected customer
                              setSelectedCustomer(updatedCustomer);
                              
                              // Update customer in the list
                              setCustomers(prevCustomers => 
                                prevCustomers.map(customer => 
                                  customer.phone_number === selectedCustomer.phone_number 
                                    ? updatedCustomer 
                                    : customer
                                )
                              );
                              
                              toast({
                                title: 'Customer Reactivated',
                                description: 'Customer account has been reactivated and can now access all services'
                              });
                              
                              // Refresh stats to reflect status change
                              await loadCustomerStats();
                              
                            } catch (error) {
                              toast({
                                title: 'Error',
                                description: 'Failed to reactivate customer. Please try again.',
                                variant: 'destructive'
                              });
                            }
                          }}
                        >
                          <CheckCircle className="w-4 h-4 mr-3 shrink-0" />
                          <div className="text-left min-w-0 flex-1">
                            <p className="font-medium break-words">Reactivate Customer</p>
                            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 break-words leading-relaxed">Remove suspension and restore full access</p>
                          </div>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Dangerous Actions Section */}
                  <div className="p-5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-red-200/50 dark:border-red-700/50 shadow-lg">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-white" />
                      </div>
                      <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Dangerous Actions</h4>
                    </div>
                    
                    <div className="p-4 bg-red-50/50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800 mb-4">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-red-700 dark:text-red-300 break-words leading-relaxed">
                          These actions have permanent consequences. Use with extreme caution and ensure proper authorization.
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <Button 
                        variant="outline" 
                        className="justify-start h-auto py-3 px-4 w-full bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300"
                        onClick={() => setShowArchiveDialog(true)}
                      >
                        <Archive className="w-4 h-4 mr-3 shrink-0" />
                        <div className="text-left min-w-0 flex-1">
                          <p className="font-medium break-words">Archive Customer</p>
                          <p className="text-xs text-red-600/70 dark:text-red-400/70 break-words leading-relaxed">Permanently move to archived records (cannot be undone)</p>
                        </div>
                      </Button>
                    </div>
                  </div>

                  {/* System Information */}
                  <div className="p-5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-br from-slate-500 to-slate-600 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">System Information</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div className="min-w-0">
                        <p className="text-slate-500 dark:text-slate-400 break-words">Customer ID</p>
                        <p className="font-mono text-slate-900 dark:text-slate-100 break-all">{selectedCustomer?.phone_number}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-slate-500 dark:text-slate-400 break-words">Account Status</p>
                        <p className="font-semibold text-slate-900 dark:text-slate-100 capitalize break-words">{selectedCustomer?.status}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-slate-500 dark:text-slate-400 break-words">Created Date</p>
                        <p className="text-slate-900 dark:text-slate-100 break-words">
                          {selectedCustomer?.created_at ? formatBusinessDate(selectedCustomer.created_at) : 'N/A'}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-slate-500 dark:text-slate-400 break-words">Last Updated</p>
                        <p className="text-slate-900 dark:text-slate-100 break-words">
                          {selectedCustomer?.updated_at ? formatBusinessDate(selectedCustomer.updated_at) : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Audit Trail Notice */}
                  <div className="p-4 bg-slate-100/50 dark:bg-slate-800/30 rounded-xl border border-slate-300 dark:border-slate-600">
                    <div className="flex items-start space-x-3">
                      <Gauge className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          🔒 Security Notice
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-words">
                          All administrative actions are logged with your user ID and timestamp for audit compliance. 
                          Customer data modifications are subject to regulatory oversight and data protection policies.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
        </SheetContent>
      </Sheet>

      {/* Suspend Customer Confirmation Dialog */}
      <Dialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <DialogContent className="sm:max-w-[550px] bg-gradient-to-br from-slate-50/95 via-amber-50/30 to-orange-50/40 dark:from-slate-950/95 dark:via-amber-950/30 dark:to-orange-950/40 backdrop-blur-xl border-0 shadow-2xl">
          {/* Warning accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500"></div>
          
          <DialogHeader className="pb-6 pt-4">
            <div className="flex items-center space-x-4 mb-4">
              {/* Warning Icon with Vault-style border */}
              <div className="w-14 h-14 rounded-full border-3 border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 shadow-lg flex items-center justify-center relative">
                <AlertTriangle className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center">
                  <span className="text-xs text-white font-bold">!</span>
                </div>
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-1">
                  Suspend Customer Account
                </DialogTitle>
                <DialogDescription className="text-amber-700 dark:text-amber-300">
                  Temporarily restrict account access and transaction privileges
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Customer Information Card */}
            <div className="p-5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-amber-200/50 dark:border-amber-700/50 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Customer Details</h3>
              </div>
              
              <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                <p className="text-slate-700 dark:text-slate-300 mb-2">
                  <span className="font-medium text-amber-900 dark:text-amber-100">
                    {selectedCustomer?.first_name} {selectedCustomer?.last_name}
                  </span> will be temporarily suspended from the PawnRepo system.
                </p>
                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <p>• Account access will be restricted</p>
                  <p>• New pawn transactions will be prevented</p>
                  <p>• Existing active loans remain unaffected</p>
                  <p>• Suspension can be reversed by administrators</p>
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="p-4 bg-amber-100/50 dark:bg-amber-900/20 rounded-xl border border-amber-300 dark:border-amber-700">
              <div className="flex items-start space-x-3">
                <Gauge className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1">
                    Security & Audit Trail
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                    This action will be logged with your admin ID and timestamp for compliance and audit purposes. 
                    Customer will receive automatic system notification.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setShowSuspendDialog(false)}
                className="px-6 py-2 bg-white/70 dark:bg-slate-700/70 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 backdrop-blur-sm"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSuspendCustomer}
                className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Suspend Customer</span>
                </div>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Customer Confirmation Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent className="sm:max-w-[550px] bg-gradient-to-br from-slate-50/95 via-red-50/30 to-rose-50/40 dark:from-slate-950/95 dark:via-red-950/30 dark:to-rose-950/40 backdrop-blur-xl border-0 shadow-2xl">
          {/* Danger accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-rose-500 to-red-600"></div>
          
          <DialogHeader className="pb-6 pt-4">
            <div className="flex items-center space-x-4 mb-4">
              {/* Danger Icon with Vault-style border */}
              <div className="w-14 h-14 rounded-full border-3 border-red-500 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950 shadow-lg flex items-center justify-center relative">
                <Archive className="w-7 h-7 text-red-600 dark:text-red-400" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center">
                  <AlertTriangle className="w-2 h-2 text-white" />
                </div>
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-red-900 dark:text-red-100 mb-1">
                  Archive Customer Account
                </DialogTitle>
                <DialogDescription className="text-red-700 dark:text-red-300">
                  Permanently move customer to archived records
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Customer Information Card */}
            <div className="p-5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-red-200/50 dark:border-red-700/50 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Customer Details</h3>
              </div>
              
              <div className="bg-red-50/50 dark:bg-red-950/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                <p className="text-slate-700 dark:text-slate-300 mb-2">
                  <span className="font-medium text-red-900 dark:text-red-100">
                    {selectedCustomer?.first_name} {selectedCustomer?.last_name}
                  </span> will be permanently archived from the PawnRepo system.
                </p>
                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <p>• Customer account will be moved to archived records</p>
                  <p>• All transaction history will be preserved</p>
                  <p>• Customer will no longer appear in active listings</p>
                  <p className="text-red-600 dark:text-red-400 font-medium">• This action cannot be undone</p>
                </div>
              </div>
            </div>

            {/* Permanent Action Warning */}
            <div className="p-4 bg-red-100/60 dark:bg-red-900/20 rounded-xl border-2 border-red-300 dark:border-red-700">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-900 dark:text-red-100 mb-1">
                    ⚠️ PERMANENT ACTION WARNING
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                    This is a permanent action that cannot be reversed. The customer account will be moved to archived 
                    records and cannot be restored to active status. All audit logs will be maintained for compliance.
                  </p>
                </div>
              </div>
            </div>

            {/* Confirmation Required */}
            <div className="p-4 bg-slate-100/50 dark:bg-slate-800/20 rounded-xl border border-slate-300 dark:border-slate-600">
              <div className="flex items-start space-x-3">
                <Gauge className="w-5 h-5 text-slate-600 dark:text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                    Security & Compliance
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Archive action will be logged with admin credentials. Customer data retention follows regulatory 
                    compliance requirements. All transaction history preserved for audit purposes.
                  </p>
                </div>
              </div>
            </div>

            {/* Confirmation Required Input */}
            <div className="p-4 bg-red-50/50 dark:bg-red-950/20 rounded-xl border-2 border-red-200 dark:border-red-800">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <p className="text-sm font-medium text-red-900 dark:text-red-100">
                    Confirmation Required
                  </p>
                </div>
                <div>
                  <Label htmlFor="archiveConfirmation" className="text-sm text-red-700 dark:text-red-300">
                    Type <strong>"ARCHIVE"</strong> to confirm this permanent action:
                  </Label>
                  <Input
                    id="archiveConfirmation"
                    type="text"
                    value={archiveConfirmation}
                    onChange={(e) => setArchiveConfirmation(e.target.value)}
                    placeholder="Type ARCHIVE to confirm"
                    className="mt-2 bg-white/70 dark:bg-slate-800/70 border-red-300 dark:border-red-700 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-500/20"
                  />
                  {archiveConfirmation && archiveConfirmation !== 'ARCHIVE' && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Please type "ARCHIVE" exactly as shown
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setShowArchiveDialog(false)}
                className="px-6 py-2 bg-white/70 dark:bg-slate-700/70 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 backdrop-blur-sm"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleArchiveCustomer}
                disabled={archiveConfirmation !== 'ARCHIVE'}
                className="px-6 py-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white shadow-lg shadow-red-500/25 disabled:shadow-gray-500/25"
              >
                <div className="flex items-center gap-2">
                  <Archive className="w-4 h-4" />
                  <span>Archive Customer</span>
                </div>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Status Change Confirmation Dialog */}
      <Dialog open={showBulkStatusDialog} onOpenChange={setShowBulkStatusDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-800">
              <Users className="h-5 w-5" />
              Bulk Status Change
            </DialogTitle>
            <DialogDescription>
              You are about to change the status of {selectedCustomerIds.length} selected customer{selectedCustomerIds.length > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Please select the new status for the selected customers:
            </p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowBulkStatusDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="outline"
                className="border-green-300 text-green-800 hover:bg-green-50"
                onClick={() => setShowBulkActivateDialog(true)}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Activate
              </Button>
              <Button 
                variant="outline"
                className="border-yellow-300 text-yellow-800 hover:bg-yellow-50"
                onClick={() => setShowBulkSuspendDialog(true)}
              >
                <AlertCircle className="mr-2 h-4 w-4" />
                Suspend
              </Button>
              <Button 
                variant="destructive"
                onClick={() => setShowBulkArchiveDialog(true)}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Activate Confirmation Dialog */}
      <Dialog open={showBulkActivateDialog} onOpenChange={setShowBulkActivateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              Bulk Activate Confirmation
            </DialogTitle>
            <DialogDescription>
              You are about to activate {selectedCustomerIds.length} customer{selectedCustomerIds.length > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">This action will:</h4>
              <ul className="space-y-1 text-sm text-green-700">
                <li>• Restore full account access</li>
                <li>• Enable new transactions</li>
                <li>• Return customers to active status</li>
                <li>• Be logged with your admin ID</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bulkActivateConfirm" className="text-sm font-medium">
                Type <strong>ACTIVATE</strong> to confirm this action:
              </Label>
              <Input
                id="bulkActivateConfirm"
                value={bulkConfirmation}
                onChange={(e) => setBulkConfirmation(e.target.value)}
                placeholder="Type ACTIVATE here"
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowBulkActivateDialog(false);
                setBulkConfirmation('');
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="outline"
              className="border-green-300 text-green-800 hover:bg-green-50"
              onClick={async () => {
                setShowBulkActivateDialog(false);
                setBulkConfirmation('');
                await performBulkStatusChange('active');
              }}
              disabled={bulkConfirmation !== 'ACTIVATE'}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Activate {selectedCustomerIds.length} Customer{selectedCustomerIds.length > 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Suspend Confirmation Dialog */}
      <Dialog open={showBulkSuspendDialog} onOpenChange={setShowBulkSuspendDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              Bulk Suspend Warning
            </DialogTitle>
            <DialogDescription>
              You are about to suspend {selectedCustomerIds.length} customer{selectedCustomerIds.length > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-2">This action will:</h4>
              <ul className="space-y-1 text-sm text-yellow-700">
                <li>• Temporarily restrict account access</li>
                <li>• Prevent new transactions</li>
                <li>• Can be reversed by reactivating</li>
                <li>• Be logged with your admin ID</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bulkSuspendConfirm" className="text-sm font-medium">
                Type <strong>SUSPEND</strong> to confirm this action:
              </Label>
              <Input
                id="bulkSuspendConfirm"
                value={bulkConfirmation}
                onChange={(e) => setBulkConfirmation(e.target.value)}
                placeholder="Type SUSPEND here"
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowBulkSuspendDialog(false);
                setBulkConfirmation('');
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="outline"
              className="border-yellow-300 text-yellow-800 hover:bg-yellow-50"
              onClick={async () => {
                setShowBulkSuspendDialog(false);
                setBulkConfirmation('');
                await performBulkStatusChange('suspended');
              }}
              disabled={bulkConfirmation !== 'SUSPEND'}
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              Suspend {selectedCustomerIds.length} Customer{selectedCustomerIds.length > 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Archive Confirmation Dialog */}
      <Dialog open={showBulkArchiveDialog} onOpenChange={setShowBulkArchiveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-800">
              <Archive className="h-5 w-5" />
              Permanent Bulk Action Warning
            </DialogTitle>
            <DialogDescription>
              You are about to permanently archive {selectedCustomerIds.length} customer{selectedCustomerIds.length > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-medium text-red-800 mb-2">This action will:</h4>
              <ul className="space-y-1 text-sm text-red-700">
                <li>• Permanently archive all records</li>
                <li>• Cannot be undone</li>
                <li>• Remove customers from active lists</li>
                <li>• Be logged with your admin ID</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bulkArchiveConfirm" className="text-sm font-medium">
                Type <strong>ARCHIVE</strong> to confirm this permanent action:
              </Label>
              <Input
                id="bulkArchiveConfirm"
                value={bulkConfirmation}
                onChange={(e) => setBulkConfirmation(e.target.value)}
                placeholder="Type ARCHIVE here"
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowBulkArchiveDialog(false);
                setBulkConfirmation('');
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={async () => {
                setShowBulkArchiveDialog(false);
                setBulkConfirmation('');
                await performBulkStatusChange('archived');
              }}
              disabled={bulkConfirmation !== 'ARCHIVE'}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive {selectedCustomerIds.length} Customer{selectedCustomerIds.length > 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Customer Dialog */}
      <CustomerDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        customer={editingCustomer}
        onSave={handleCustomerSaved}
      />

      {/* Service Alert Dialog */}
      {selectedCustomerForAlert && (
        <ServiceAlertDialog
          isOpen={showServiceAlertDialog}
          onClose={() => {
            setShowServiceAlertDialog(false);
            setSelectedCustomerForAlert(null);
          }}
          customerPhone={selectedCustomerForAlert.phone}
          customerName={selectedCustomerForAlert.name}
          onAlertResolved={handleAlertResolved}
        />
      )}

      {/* Custom Loan Limit Dialog */}
      <CustomLoanLimitDialog
        open={showCustomLimitDialog}
        onOpenChange={(open) => {
          setShowCustomLimitDialog(open);
          if (!open) {
            setSelectedCustomerForLimit(null);
          }
        }}
        customer={selectedCustomerForLimit}
        onCustomerUpdate={handleCustomerUpdate}
      />
    </div>
  );
};

export default EnhancedCustomerManagement;