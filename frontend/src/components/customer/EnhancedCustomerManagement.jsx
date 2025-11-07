import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plus,
  FilePlus,
  Bell,
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
  DollarSign,
  Clock,
  XCircle,
  RefreshCw,
  FileText,
  Calendar,
  Loader2,
  Activity,
  Package,
  X,
  Trash2,
  Circle,
  ShoppingBag,
  ArrowUp,
  ArrowDown,
  MessageCircle,
  Shield,
  Settings,
  UserCog,
  Lock,
  Info,
  UserCheck,
  LayoutGrid,
  TableIcon,
  Award,
  Search,
  PauseCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { CustomerTableSkeleton, StatsCardSkeleton, SearchSkeleton } from '../ui/skeleton';
import { StatusBadge as CustomerStatusBadge } from '../ui/enhanced-badge';
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
import UnifiedPagination from '../ui/unified-pagination';
import { getPaginationConfig } from '../../utils/paginationConfig';
import CustomerDialog from './CustomerDialog';
import AlertBellAction from './AlertBellAction';
import ServiceAlertDialog from './ServiceAlertDialog';
import LoanEligibilityManager from './LoanEligibilityManager';
import { useToast } from '../ui/toast';
import { useAuth } from '../../context/AuthContext';
import { useAlertCount } from '../../context/AlertCountContext';
import { isAdmin as isAdminRole } from '../../utils/roleUtils';
import { formatBusinessDate, canReversePayment } from '../../utils/timezoneUtils';
import { formatCurrency, formatStorageLocation, formatTransactionId, formatCount } from '../../utils/transactionUtils';
import { handleError } from '../../utils/errorHandling';
import useExtensionCancellation from '../../hooks/useExtensionCancellation';
import usePaymentReversal from '../../hooks/usePaymentReversal';
import useTransactionVoid from '../../hooks/useTransactionVoid';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../ui/resizable';
import { ScrollArea } from '../ui/scroll-area';
import TransactionNotesDisplay from '../transaction/TransactionNotesDisplay';
import AdminApprovalDialog from '../common/AdminApprovalDialog';
import CustomerCard from './CustomerCard';
import CustomLoanLimitDialog from './CustomLoanLimitDialog';
import TransactionCard from '../transaction/TransactionCard';
import TransactionTableView from '../transaction/TransactionTableView';
import CreatePawnDialogRedesigned from '../transaction/CreatePawnDialogRedesigned';
import PaymentForm from '../transaction/components/PaymentForm';
import ExtensionForm from '../transaction/components/ExtensionForm';
import StatusUpdateForm from '../transaction/components/StatusUpdateForm';
import { ExtensionSuccessDialog } from '../extension/ExtensionSuccessDialog';
import StatusBadge from '../transaction/components/StatusBadge';
import AdvancedFilters from './AdvancedFilters';

// Sort field mapping: Frontend display name -> Backend database field
const CUSTOMER_SORT_FIELD_MAP = {
  'customer': 'first_name',
  'loan_activity': 'active_loans',
  'last_visit': 'last_transaction_date',
  'contact': 'phone_number',
  'status': 'status',
  'created_at': 'created_at',
  'last_accessed_at': 'last_accessed_at'
};

// Transaction sort field mapping
const TRANSACTION_SORT_FIELD_MAP = {
  'transaction_date': 'pawn_date',
  'status_priority': 'status',
  'balance': 'loan_amount'
};

// Transactions Tab Content Component
const TransactionsTabContent = ({ selectedCustomer }) => {
  const { user } = useAuth(); // Add useAuth hook for user context
  const { toast } = useToast();
  const [transactions, setTransactions] = useState([]);
  const [totalTransactionCount, setTotalTransactionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [transactionBalances, setTransactionBalances] = useState({});
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 10 items per page (now adjustable)
  
  // Sorting state
  const [sortBy, setSortBy] = useState('transaction_date'); // Default to newest first
  const [sortDirection, setSortDirection] = useState('desc');

  // Refresh trigger for re-fetching transactions
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // View mode state (card or table) with localStorage persistence
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('transactionsViewMode');
    return saved || 'table';
  });

  // Save view mode to localStorage when changed
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('transactionsViewMode', mode);
  };

  // Dialog states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showExtensionForm, setShowExtensionForm] = useState(false);
  const [showExtensionSuccess, setShowExtensionSuccess] = useState(false);
  const [extensionSuccessData, setExtensionSuccessData] = useState(null);
  const [showStatusUpdateForm, setShowStatusUpdateForm] = useState(false);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [loadingTransactionDetails, setLoadingTransactionDetails] = useState(false);
  const [showItemsDialog, setShowItemsDialog] = useState(false);
  const [selectedTransactionItems, setSelectedTransactionItems] = useState(null);
  // Transaction void hook - consolidates duplicate logic
  const {
    showVoidApprovalDialog,
    pendingVoidTransaction,
    processingCancel: voidProcessingCancel,
    handleVoidTransaction,
    handleVoidTransactionApproval,
    handleVoidTransactionCancel,
    canVoidTransaction
  } = useTransactionVoid({
    user,
    handleError,
    onSuccess: async (data) => {
      // If transaction details dialog is open and it's the same transaction, refresh the timeline immediately
      if (showTransactionDetails && selectedTransaction?.transaction_id === data.transactionId) {
        // Small delay to ensure backend audit entry is created
        setTimeout(() => {
          refreshTimelineData(selectedTransaction.transaction_id).catch(() => {
            // Fallback to full refresh
            handleViewTransaction(selectedTransaction).catch(() => {});
          });
        }, 500);
      }
      
      // Refresh transactions
      await refreshTransactions();
      
      toast({
        title: "Transaction Voided",
        description: `Transaction #${formatTransactionId(selectedTransaction?.transaction || selectedTransaction)} has been voided successfully`,
        variant: "default"
      });
    }
  });
  const [paymentHistory, setPaymentHistory] = useState(null);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [auditEntries, setAuditEntries] = useState([]);
  const [selectedTransactionCustomer, setSelectedTransactionCustomer] = useState(null);

  // Extension cancellation hook - consolidates duplicate logic
  const {
    showExtensionCancelDialog,
    pendingCancelExtensionId,
    pendingCancelTransaction,
    reversalEligibility: extensionEligibility,
    processingCancel: extensionProcessingCancel,
    handleExtensionCancelAction,
    handleExtensionCancelApproval,
    handleExtensionCancelCancel,
    canCancelExtension: canCancelExtensionFromHook
  } = useExtensionCancellation({
    user,
    handleError,
    onSuccess: async (data) => {
      // Update selectedTransaction with the optimistic update to refresh timeline immediately
      if (data.optimisticUpdate && selectedTransaction) {
        setSelectedTransaction(data.optimisticUpdate);
      }
      
      // Trigger immediate transaction list refresh to show updated status
      await refreshTransactions();
      
      toast({
        title: "Extension Cancelled",
        description: `Extension cancelled successfully. ${formatCurrency(data.result?.extension_fee || 0)} extension fee has been refunded and maturity date restored.`,
        variant: "success"
      });
    }
  });

  // Use payment reversal hook for consolidated payment reversal logic
  const {
    showPaymentReversalDialog: paymentReversalDialogOpen,
    pendingReversalPaymentId: pendingPaymentReversalId,
    pendingReversalTransaction: pendingPaymentTransaction,
    reversalEligibility: paymentReversalEligibility,
    handlePaymentReversalAction,
    handlePaymentReversalApproval,
    handlePaymentReversalCancel,
    isProcessingPayment
  } = usePaymentReversal({
    user,
    handleError,
    onSuccess: async (data) => {
      // Update payment history with optimistic update if available
      if (data.optimisticPaymentHistory) {
        setPaymentHistory(data.optimisticPaymentHistory);
      }
      
      // Background refresh to sync with server
      if (selectedTransaction?.transaction_id) {
        refreshTimelineData(selectedTransaction.transaction_id).catch(() => {});
      }
      
      // Trigger immediate transaction list refresh to show updated balance
      await refreshTransactions();
      
      toast({
        title: "Payment Reversed",
        description: `Payment reversed successfully. ${formatCurrency(paymentReversalEligibility?.payment_amount || 0)} has been credited back to the transaction balance.`,
        variant: "success"
      });
    }
  });

  // Date formatting helper (exact copy from TransactionHub)
  const formatDate = (dateString) => {
    return formatBusinessDate(dateString);
  };

  // Handle sort change
  const handleSortChange = async (field) => {
    if (sortBy === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc'); // Default to descending for new field
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  // Apply sorting when sort parameters change

  // Helper to get transaction field consistently (must be before useMemo)
  const getTransactionField = (field) => {
    return selectedTransaction?.transaction?.[field] || selectedTransaction?.[field];
  };

  // Helper to get transaction status - calculates effective status based on extensions
  const getTransactionStatus = () => {
    const baseStatus = getTransactionField('status') || 'Unknown';
    
    // Check if transaction has any active (non-cancelled) extensions
    const extensions = selectedTransaction?.extensions || selectedTransaction?.transaction?.extensions || [];
    const hasActiveExtensions = extensions.some(ext => !ext.is_cancelled);
    
    // If there are active extensions, status should be 'extended'
    if (hasActiveExtensions && ['active', 'overdue'].includes(baseStatus)) {
      return 'extended';
    }
    
    return baseStatus;
  };

  // Helper to check if status allows actions
  const canProcessActions = () => {
    const status = getTransactionStatus();
    return ['active', 'overdue', 'extended'].includes(status);
  };

  // Timeline with payments, extensions, and audit events (including void events)
  const timelineData = useMemo(() => {
    const payments = paymentHistory?.payments || [];
    const extensions = selectedTransaction?.extensions || selectedTransaction?.transaction?.extensions || [];
    const audits = auditEntries || [];
    
    // Build timeline events array
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
      
      // Add all other audit events
      timelineEvents.push({
        type: 'audit',
        date: new Date(audit.timestamp),
        data: audit,
        auditIndex: audits.length - i,
        key: `audit-${audit.related_id || i}-${audit.action_type}`
      });
    }

    // Sort all events by date (newest first), with secondary sort by type
    // to ensure proper order: Transaction Redeemed -> Payment -> Overdue Fee -> Discount
    return timelineEvents.sort((a, b) => {
      // Primary sort: by date (most recent first)
      const dateDiff = b.date - a.date;

      // If dates are equal or within same second (1000ms), apply secondary sort
      if (Math.abs(dateDiff) < 1000) {
        // Define type priority to control display order:
        // 1. Transaction Redeemed audits (show first)
        // 2. Payments (show after redeemed)
        // 3. Overdue fee audits (show after payments, before discounts)
        // 4. Discount audits (show after overdue fees)
        // 5. Extensions and other audits (default priority)
        const getPriority = (event) => {
          if (event.type === 'audit') {
            const summary = event.data.action_summary?.toLowerCase() || '';
            // "Transaction Redeemed" should come first
            if (summary.includes('redeemed') || event.data.action_type === 'redemption_completed') return 1;
            // Overdue fee audits should come after payments
            if (summary.includes('overdue fee')) return 3;
            // Discount audits should come after overdue fees
            if (summary.includes('discount')) return 4;
            // Other audits have default priority
            return 5;
          }
          if (event.type === 'payment') return 2;
          if (event.type === 'extension') return 5;
          return 6;
        };

        return getPriority(a) - getPriority(b);
      }

      return dateDiff;
    });
  }, [paymentHistory, selectedTransaction, auditEntries]);

  // Fetch transaction balances
  const fetchTransactionBalances = async (transactionList) => {
    const balances = {};

    try {
      // Fetch balances in parallel for better performance
      const balancePromises = transactionList.map(async (transaction) => {
        try {
          const balance = await transactionService.getTransactionBalance(transaction.transaction_id);
          return { id: transaction.transaction_id, balance };
        } catch (error) {
          return { id: transaction.transaction_id, balance: null };
        }
      });

      const results = await Promise.all(balancePromises);

      results.forEach(({ id, balance }) => {
        balances[id] = balance;
      });

      setTransactionBalances(balances);
    } catch (error) {
      // Failed to fetch transaction balances - continue without them
    }
  };

  // Fetch customer transactions
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!selectedCustomer?.phone_number) return;

      setLoading(true);
      setError(null);

      try {
        // Map frontend sort fields to backend field names using centralized mapping
        const backendSortBy = TRANSACTION_SORT_FIELD_MAP[sortBy] || sortBy;

        const params = {
          page: currentPage,
          page_size: pageSize,
          sort_by: backendSortBy,
          sort_order: sortDirection
        };

        const response = await transactionService.getCustomerTransactions(selectedCustomer.phone_number, params);

        // Handle different API response formats
        let transactionArray = [];
        let totalCount = 0;

        if (Array.isArray(response)) {
          transactionArray = response;
          totalCount = response.length;
        } else if (response && Array.isArray(response.transactions)) {
          transactionArray = response.transactions;
          totalCount = response.total_count || response.transactions.length;
        } else if (response && Array.isArray(response.data)) {
          transactionArray = response.data;
          totalCount = response.total || response.total_count || response.data.length;
        } else if (response && typeof response === 'object') {
          // If response is an object but not an array, log it for debugging
          transactionArray = [];
          totalCount = 0;
        }

        // Server already sorted the data, so just set it
        setTransactions(transactionArray);
        setTotalTransactionCount(totalCount);

        // Fetch balances for active transactions
        const activeTransactions = transactionArray.filter(t =>
          ['active', 'overdue', 'extended'].includes(t.status)
        );

        if (activeTransactions.length > 0) {
          await fetchTransactionBalances(activeTransactions);
        }
      } catch (err) {
        setError(err.message || 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [selectedCustomer?.phone_number, currentPage, sortBy, sortDirection, pageSize, refreshTrigger]);

  if (loading) {
    return (
      <Card className="border-0 shadow-lg bg-gradient-to-br from-cyan-50/80 to-sky-50/80 dark:from-cyan-950/80 dark:to-sky-950/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            <span className="ml-3 text-cyan-700 dark:text-cyan-400">Loading transactions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-0 shadow-lg bg-gradient-to-br from-cyan-50/80 to-sky-50/80 dark:from-cyan-950/80 dark:to-sky-950/80 backdrop-blur-sm">
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
      <>
        <Card className="border-0 shadow-lg bg-gradient-to-br from-cyan-50/80 to-sky-50/80 dark:from-cyan-950/80 dark:to-sky-950/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="text-center py-12">
              <CreditCard className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">No Transactions</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-4">This customer has no transaction records.</p>
              <Button
                onClick={() => setShowCreateForm(true)}
                className="mt-2"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Transaction
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Create Transaction Dialog */}
        <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
          <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none" showCloseButton={false}>
            <DialogHeader className="sr-only">
              <DialogTitle>Create New Pawn Transaction</DialogTitle>
              <DialogDescription>Create a new pawn transaction for {selectedCustomer?.first_name} {selectedCustomer?.last_name}</DialogDescription>
            </DialogHeader>
            <CreatePawnDialogRedesigned
              onSuccess={() => {
                setShowCreateForm(false);
                // Trigger a re-fetch of transactions
                setRefreshTrigger(prev => prev + 1);
              }}
              onCancel={() => setShowCreateForm(false)}
              prefilledCustomer={selectedCustomer}
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Handle viewing items in simple dialog
  const handleViewItems = async (transaction) => {
    try {
      const summary = await transactionService.getTransactionSummary(transaction.transaction_id);
      setSelectedTransactionItems({
        ...summary.transaction,
        items: summary.items
      });
      setShowItemsDialog(true);
    } catch (error) {
      // Failed to fetch transaction summary - use basic data
      setSelectedTransactionItems(transaction);
      setShowItemsDialog(true);
    }
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
      const fullTransaction = await authService.apiRequest(bustCacheUrl, { method: 'GET' });
      // Transaction details loaded successfully
      
      // Fetch customer details if available
      const customerPhone = transaction.customer_id || transaction.customer_phone;
      if (customerPhone && customerPhone !== 'No Customer') {
        try {
          const customerData = await customerService.getCustomerByPhone(customerPhone);
          setSelectedTransactionCustomer(customerData);
        } catch (error) {
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
        fullTransaction.extensions = [];
        fullTransaction.hasExtensions = false;
      }
      
      // Fetch payment history
      try {
        const paymentHistoryData = await paymentService.getPaymentHistory(transaction.transaction_id);
        setPaymentHistory(paymentHistoryData);
      } catch (paymentError) {
        setPaymentHistory(null);
      }
      
      // Fetch audit entries for timeline
      try {
        const auditData = await transactionService.getAuditEntries(transaction.transaction_id, 50);
        setAuditEntries(auditData);
      } catch (auditError) {
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
          return paymentHistory; // Keep existing data if fetch fails
        }),
        extensionService.getExtensionHistory(transactionId, true).catch(error => {
          return selectedTransaction?.extensions || []; // Keep existing data if fetch fails
        }),
        transactionService.getAuditEntries(transactionId, 50, true).catch(error => {
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
            // If 403, user might need to re-authenticate
            if (error.message && error.message.includes('403')) {
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

  // Check if a transaction status can be updated
  const canUpdateStatus = (transaction) => {
    if (!transaction) return false;
    
    // Finalized statuses that cannot be changed
    const finalizedStatuses = ['redeemed', 'sold', 'voided'];
    
    const currentStatus = transaction.status?.toLowerCase();
    
    // Block status updates for finalized transactions
    return !finalizedStatuses.includes(currentStatus);
  };

  const refreshTransactions = async () => {
    if (!selectedCustomer?.phone_number) return;

    try {
      // Map frontend sort fields to backend field names using centralized mapping
      const backendSortBy = TRANSACTION_SORT_FIELD_MAP[sortBy] || sortBy;

      const params = {
        page: currentPage,
        page_size: pageSize,
        sort_by: backendSortBy,
        sort_order: sortDirection
      };

      const response = await transactionService.getCustomerTransactions(selectedCustomer.phone_number, params);

      // Handle different API response formats
      let transactionArray = [];
      let totalCount = 0;

      if (Array.isArray(response)) {
        transactionArray = response;
        totalCount = response.length;
      } else if (response && Array.isArray(response.transactions)) {
        transactionArray = response.transactions;
        totalCount = response.total_count || response.transactions.length;
      } else if (response && Array.isArray(response.data)) {
        transactionArray = response.data;
        totalCount = response.total || response.total_count || response.data.length;
      } else if (response && typeof response === 'object') {
        transactionArray = [];
        totalCount = 0;
      }

      setTransactions(transactionArray);
      setTotalTransactionCount(totalCount);

      // Fetch balances for active transactions
      const activeTransactions = transactionArray.filter(t =>
        ['active', 'overdue', 'extended'].includes(t.status)
      );

      if (activeTransactions.length > 0) {
        await fetchTransactionBalances(activeTransactions);
      }
    } catch (err) {
    }
  };

  // Dialog success handlers
  const handleTransactionCreated = () => {
    setShowCreateForm(false);
    refreshTransactions();
  };

  const handleNewTransaction = () => {
    setShowCreateForm(true);
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentForm(false);
    
    // If transaction details dialog is open, refresh the transaction data
    if (showTransactionDetails && selectedTransaction) {
      // Use the optimized refresh function for faster updates (skip transaction since we have optimistic update)
      refreshTimelineData(selectedTransaction.transaction_id, true).catch(error => {
        // Fallback to full refresh
        handleViewTransaction(selectedTransaction).catch(() => {});
      });
    }
    
    // Always refresh the transaction list to show updated balance/status
    refreshTransactions();
  };

  const handleExtensionSuccess = async (extensionData) => {
    setShowExtensionForm(false);

    // Show success dialog with extension data
    if (extensionData) {
      setExtensionSuccessData(extensionData);
      setShowExtensionSuccess(true);
    }

    // If transaction details dialog is open, refresh the transaction data
    if (showTransactionDetails && selectedTransaction) {
      // Use the optimized refresh function for faster updates (skip transaction since we have optimistic update)
      refreshTimelineData(selectedTransaction.transaction_id, true).catch(error => {
        // Fallback to full refresh
        handleViewTransaction(selectedTransaction).catch(() => {});
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
        // Don't fallback to full refresh if it's a 403 - the optimistic update already worked
        if (!error.message || !error.message.includes('403')) {
          handleViewTransaction(selectedTransaction).catch(() => {});
        }
      });
    }
    
    // Refresh transaction list
    refreshTransactions();
  };

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-cyan-50/80 to-sky-50/80 dark:from-cyan-950/80 dark:to-sky-950/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-sky-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <CardTitle className="text-lg">Transaction History</CardTitle>
          </div>

          <div className="flex items-center gap-3">
            {totalTransactionCount > 0 && (
              <span className="px-3 py-1 text-sm bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 rounded-full font-semibold">
                {formatCount(totalTransactionCount)}
              </span>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewModeChange('table')}
                className={`h-7 px-3 ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
                title="Table View"
              >
                <TableIcon className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewModeChange('card')}
                className={`h-7 px-3 ${
                  viewMode === 'card'
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
                title="Card View"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>

            <Button
              size="sm"
              onClick={handleNewTransaction}
              className="h-8 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-600 hover:to-sky-700 text-white shadow-lg shadow-cyan-500/25 transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              <span className="ml-1 hidden sm:inline">New Transaction</span>
            </Button>
          </div>
        </div>
        
        {/* Sorting Controls */}
        {Array.isArray(transactions) && transactions.length > 1 && (
          <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mr-2">Sort by:</span>
            
            <Button
              variant={sortBy === 'transaction_date' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleSortChange('transaction_date')}
              className={`h-8 text-xs ${
                sortBy === 'transaction_date'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Calendar className="w-3 h-3 mr-1" />
              Date
              {sortBy === 'transaction_date' && (
                sortDirection === 'desc' ? <ArrowDown className="w-3 h-3 ml-1" /> : <ArrowUp className="w-3 h-3 ml-1" />
              )}
            </Button>
            
            <Button
              variant={sortBy === 'status_priority' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleSortChange('status_priority')}
              className={`h-8 text-xs ${
                sortBy === 'status_priority'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Activity className="w-3 h-3 mr-1" />
              Status
              {sortBy === 'status_priority' && (
                sortDirection === 'desc' ? <ArrowDown className="w-3 h-3 ml-1" /> : <ArrowUp className="w-3 h-3 ml-1" />
              )}
            </Button>
            
            <Button
              variant={sortBy === 'balance' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleSortChange('balance')}
              className={`h-8 text-xs ${
                sortBy === 'balance'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <DollarSign className="w-3 h-3 mr-1" />
              Balance
              {sortBy === 'balance' && (
                sortDirection === 'desc' ? <ArrowDown className="w-3 h-3 ml-1" /> : <ArrowUp className="w-3 h-3 ml-1" />
              )}
            </Button>
            
            <div className="ml-auto text-xs text-slate-500 dark:text-slate-400">
              {sortBy === 'transaction_date' 
                ? (sortDirection === 'desc' ? 'Newest First' : 'Oldest First')
                : sortBy === 'status_priority'
                ? (sortDirection === 'desc' ? 'High Priority First' : 'Low Priority First') 
                : (sortDirection === 'desc' ? 'Highest to Lowest' : 'Lowest to Highest')
              }
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-6">
        {/* Conditional rendering based on view mode */}
        {viewMode === 'card' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.isArray(transactions) && transactions.map((transaction) => (
              <TransactionCard
                key={transaction.transaction_id}
                transaction={transaction}
                onView={() => handleViewTransaction(transaction)}
                onPayment={() => handlePayment(transaction)}
                onExtension={() => handleExtension(transaction)}
                onStatusUpdate={() => handleStatusUpdate(transaction)}
                onVoidTransaction={() => handleVoidTransaction(transaction)}
                customerData={{
                  [transaction.customer_phone]: {
                    first_name: selectedCustomer.first_name,
                    last_name: selectedCustomer.last_name,
                    phone_number: selectedCustomer.phone_number
                  }
                }}
                balance={transactionBalances[transaction.transaction_id]}
              />
            ))}
          </div>
        ) : (
          <TransactionTableView
            transactions={Array.isArray(transactions) ? transactions : []}
            onView={handleViewTransaction}
            onViewItems={handleViewItems}
            onPayment={handlePayment}
            onExtension={handleExtension}
            balances={transactionBalances}
            customerData={{
              [selectedCustomer.phone_number]: {
                first_name: selectedCustomer.first_name,
                last_name: selectedCustomer.last_name,
                phone_number: selectedCustomer.phone_number
              }
            }}
          />
        )}
        
        {/* Pagination */}
        {totalTransactionCount > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
            <UnifiedPagination
              currentPage={currentPage}
              totalPages={Math.ceil(totalTransactionCount / pageSize)}
              pageSize={pageSize}
              totalItems={totalTransactionCount}
              onPageChange={setCurrentPage}
              onPageSizeChange={(value) => {
                setPageSize(value);
                setCurrentPage(1); // Reset to page 1 when page size changes
              }}
              {...getPaginationConfig('customers')}
            />
          </div>
        )}
      </CardContent>

      {/* Create Transaction Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none" showCloseButton={false}>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none" showCloseButton={false}>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none" showCloseButton={false}>
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

      {/* Extension Success Dialog */}
      <ExtensionSuccessDialog
        open={showExtensionSuccess}
        extensionData={extensionSuccessData}
        onClose={() => {
          setShowExtensionSuccess(false);
          setExtensionSuccessData(null);
        }}
      />

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

      {/* Enhanced Three-Panel Transaction Details Dialog (EXACT COPY FROM TRANSACTIONHUB) */}
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
                  {/* LEFT PANEL - Customer & Financial Info */}
                  <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
                    <div className="p-6 h-full bg-slate-50/70 dark:bg-slate-800/30">
                      <ScrollArea className="h-full">
                        <div className="space-y-4 pr-4">
                          {/* Transaction Status Section */}
                          <Card className="border-0 shadow-sm">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center space-x-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                <Activity className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                <span>Status</span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              {/* Status Display */}
                              <div className="p-3 rounded-lg bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
                                {(() => {
                                  const currentStatus = getTransactionStatus();
                                  
                                  // Status configuration with proper icons and colors
                                  const statusConfig = {
                                    'active': {
                                      icon: Circle,
                                      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
                                      iconColor: 'text-blue-600 dark:text-blue-400',
                                      borderColor: 'border-blue-200 dark:border-blue-800',
                                      pulse: false
                                    },
                                    'overdue': {
                                      icon: AlertTriangle,
                                      bgColor: 'bg-red-100 dark:bg-red-900/30',
                                      iconColor: 'text-red-600 dark:text-red-400',
                                      borderColor: 'border-red-200 dark:border-red-800',
                                      pulse: true,
                                      pulseColor: 'bg-red-500'
                                    },
                                    'extended': {
                                      icon: Calendar,
                                      bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
                                      iconColor: 'text-cyan-600 dark:text-cyan-400',
                                      borderColor: 'border-cyan-200 dark:border-cyan-800',
                                      pulse: false
                                    },
                                    'redeemed': {
                                      icon: CheckCircle,
                                      bgColor: 'bg-green-100 dark:bg-green-900/30',
                                      iconColor: 'text-green-600 dark:text-green-400',
                                      borderColor: 'border-green-200 dark:border-green-800',
                                      pulse: false
                                    },
                                    'sold': {
                                      icon: ShoppingBag,
                                      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
                                      iconColor: 'text-purple-600 dark:text-purple-400',
                                      borderColor: 'border-purple-200 dark:border-purple-800',
                                      pulse: false
                                    },
                                    'hold': {
                                      icon: Clock,
                                      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
                                      iconColor: 'text-amber-600 dark:text-amber-400',
                                      borderColor: 'border-amber-200 dark:border-amber-800',
                                      pulse: false
                                    },
                                    'forfeited': {
                                      icon: XCircle,
                                      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
                                      iconColor: 'text-orange-600 dark:text-orange-400',
                                      borderColor: 'border-orange-200 dark:border-orange-800',
                                      pulse: true,
                                      pulseColor: 'bg-orange-500'
                                    },
                                    'damaged': {
                                      icon: AlertCircle,
                                      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
                                      iconColor: 'text-amber-800 dark:text-amber-600',
                                      borderColor: 'border-amber-200 dark:border-amber-800',
                                      pulse: false
                                    },
                                    'voided': {
                                      icon: XCircle,
                                      bgColor: 'bg-gray-100 dark:bg-gray-900/30',
                                      iconColor: 'text-gray-600 dark:text-gray-400',
                                      borderColor: 'border-gray-200 dark:border-gray-800',
                                      pulse: false
                                    }
                                  };
                                  
                                  const config = statusConfig[currentStatus] || {
                                    icon: Circle,
                                    bgColor: 'bg-slate-100 dark:bg-slate-900/30',
                                    iconColor: 'text-slate-600 dark:text-slate-400',
                                    borderColor: 'border-slate-200 dark:border-slate-800',
                                    pulse: false
                                  };
                                  
                                  const StatusIcon = config.icon;
                                  
                                  return (
                                    <div className="flex items-center gap-3">
                                      <div className="relative">
                                        {/* Pulse animation for critical statuses */}
                                        {config.pulse && (
                                          <div className={`absolute inset-0 rounded-full animate-ping opacity-25 ${config.pulseColor || ''}`} />
                                        )}
                                        <div className={`relative w-10 h-10 rounded-full flex items-center justify-center ${config.bgColor} border ${config.borderColor} transition-all duration-300`}>
                                          <StatusIcon className={`w-5 h-5 ${config.iconColor}`} />
                                        </div>
                                      </div>
                                      <div className="flex-1">
                                        <StatusBadge status={currentStatus} />
                                        <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                          {(() => {
                                            switch (currentStatus) {
                                              case 'active': return 'Transaction is active and current';
                                              case 'redeemed': return 'All amounts paid, items ready for pickup';
                                              case 'overdue': return 'Past maturity date, interest accruing';
                                              case 'extended': return 'Maturity date has been extended';
                                              case 'hold': return 'Transaction is on administrative hold';
                                              case 'forfeited': return 'Items forfeited, ready for sale';
                                              case 'voided': return 'Transaction has been cancelled';
                                              case 'sold': return 'Forfeited items have been sold';
                                              case 'damaged': return 'Items damaged, pending assessment';
                                              default: return 'Status information';
                                            }
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </CardContent>
                          </Card>

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
                            <CardHeader className="pb-1.5">
                              <CardTitle className="flex items-center space-x-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                <Phone className="w-3.5 h-3.5 text-blue-600" />
                                <span>Customer</span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 pb-2">
                              {(() => {
                                const customerPhone = getTransactionField('customer_phone') || getTransactionField('customer_id');

                                // Use fetched customer data if available
                                if (selectedTransactionCustomer && customerPhone && customerPhone !== 'No Customer') {
                                  const customerName = `${selectedTransactionCustomer.first_name || ''} ${selectedTransactionCustomer.last_name || ''}`.trim().toUpperCase();
                                  return (
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                        {customerName}
                                      </div>
                                      <div className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                                        {customerPhone?.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') || customerPhone}
                                      </div>
                                    </div>
                                  );
                                } else if (customerPhone && customerPhone !== 'No Customer') {
                                  return (
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                        {customerPhone?.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') || customerPhone}
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
                                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                      No Customer
                                    </div>
                                  );
                                }
                              })()}
                              {(getTransactionField('customer_phone') || getTransactionField('customer_id')) !== 'No Customer' && (
                                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                  Click to view profile
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          {/* Financial Summary */}
                          <Card>
                            <CardHeader className="pb-1.5">
                              <CardTitle className="flex items-center space-x-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                <DollarSign className="w-3.5 h-3.5 text-green-600" />
                                <span>Financial</span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 pb-2 space-y-2">
                              <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-800">
                                <div className="text-xs text-green-700 dark:text-green-400 font-medium">Loan Amount</div>
                                <div className="font-bold text-base text-green-900 dark:text-green-100">
                                  {getTransactionField('loan_amount')
                                    ? formatCurrency(getTransactionField('loan_amount'))
                                    : 'Not Set'}
                                </div>
                              </div>
                              <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
                                <div className="text-xs text-blue-700 dark:text-blue-400 font-medium">Monthly Interest</div>
                                <div className="font-bold text-base text-blue-900 dark:text-blue-100">
                                  {getTransactionField('monthly_interest_amount')
                                    ? formatCurrency(getTransactionField('monthly_interest_amount'))
                                    : 'Not Set'}
                                </div>
                              </div>
                              <div className="space-y-1.5">
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
                            <CardHeader className="pb-1.5">
                              <CardTitle className="flex items-center space-x-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                <Activity className="w-3.5 h-3.5 text-purple-600" />
                                <span>Info</span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 pb-2 space-y-1.5">
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
                          
                          {/* Admin-only Update Status Button */}
                          {user?.role === 'admin' && (
                            <Button 
                              variant="outline"
                              onClick={() => {
                                handleStatusUpdate(selectedTransaction?.transaction || selectedTransaction);
                              }}
                              disabled={!canUpdateStatus(selectedTransaction?.transaction || selectedTransaction)}
                              className="w-full"
                              title={!canUpdateStatus(selectedTransaction?.transaction || selectedTransaction) ? 
                                "Cannot update status for finalized transactions: redeemed, sold, or voided" : 
                                "Update transaction status (admin only)"
                              }
                            >
                              <Activity className="w-4 h-4 mr-2" />
                              Update Status
                            </Button>
                          )}
                          
                          {/* Admin-only Void Transaction Button */}
                          {user?.role === 'admin' && (
                            <Button 
                              variant="destructive"
                              onClick={() => {
                                handleVoidTransaction(selectedTransaction?.transaction || selectedTransaction);
                              }}
                              disabled={!canVoidTransaction(selectedTransaction?.transaction || selectedTransaction)}
                              className="w-full"
                              title={!canVoidTransaction(selectedTransaction?.transaction || selectedTransaction) ? 
                                "Cannot void transactions with status: redeemed, forfeited, sold, voided, or canceled" : 
                                "Void this transaction (admin only)"
                              }
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
                              {/* Current status indicator - always visible */}
                              {(() => {
                                const currentStatus = getTransactionStatus();
                                
                                // Use the same status configuration as the main status display
                                const statusConfig = {
                                  'active': {
                                    icon: Circle,
                                    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
                                    iconColor: 'text-blue-600 dark:text-blue-400',
                                    borderColor: 'border-blue-200 dark:border-blue-800',
                                    pulse: false
                                  },
                                  'overdue': {
                                    icon: AlertTriangle,
                                    bgColor: 'bg-red-100 dark:bg-red-900/30',
                                    iconColor: 'text-red-600 dark:text-red-400',
                                    borderColor: 'border-red-200 dark:border-red-800',
                                    pulse: true,
                                    pulseColor: 'bg-red-500'
                                  },
                                  'extended': {
                                    icon: Calendar,
                                    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
                                    iconColor: 'text-cyan-600 dark:text-cyan-400',
                                    borderColor: 'border-cyan-200 dark:border-cyan-800',
                                    pulse: false
                                  },
                                  'redeemed': {
                                    icon: CheckCircle,
                                    bgColor: 'bg-green-100 dark:bg-green-900/30',
                                    iconColor: 'text-green-600 dark:text-green-400',
                                    borderColor: 'border-green-200 dark:border-green-800',
                                    pulse: false
                                  },
                                  'sold': {
                                    icon: ShoppingBag,
                                    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
                                    iconColor: 'text-purple-600 dark:text-purple-400',
                                    borderColor: 'border-purple-200 dark:border-purple-800',
                                    pulse: false
                                  },
                                  'hold': {
                                    icon: Clock,
                                    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
                                    iconColor: 'text-amber-600 dark:text-amber-400',
                                    borderColor: 'border-amber-200 dark:border-amber-800',
                                    pulse: false
                                  },
                                  'forfeited': {
                                    icon: XCircle,
                                    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
                                    iconColor: 'text-orange-600 dark:text-orange-400',
                                    borderColor: 'border-orange-200 dark:border-orange-800',
                                    pulse: true,
                                    pulseColor: 'bg-orange-500'
                                  },
                                  'damaged': {
                                    icon: AlertCircle,
                                    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
                                    iconColor: 'text-amber-800 dark:text-amber-600',
                                    borderColor: 'border-amber-200 dark:border-amber-800',
                                    pulse: false
                                  },
                                  'voided': {
                                    icon: XCircle,
                                    bgColor: 'bg-gray-100 dark:bg-gray-900/30',
                                    iconColor: 'text-gray-600 dark:text-gray-400',
                                    borderColor: 'border-gray-200 dark:border-gray-800',
                                    pulse: false
                                  }
                                };
                                
                                const config = statusConfig[currentStatus] || {
                                  icon: Circle,
                                  bgColor: 'bg-slate-100 dark:bg-slate-900/30',
                                  iconColor: 'text-slate-600 dark:text-slate-400'
                                };
                                
                                const StatusIcon = config.icon;
                                
                                return (
                                  <div className="flex space-x-3 group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 rounded-lg p-2 -m-2 transition-colors">
                                    <div className="flex-shrink-0 mt-1.5">
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${config.bgColor}`}>
                                        <StatusIcon className={`w-3 h-3 ${config.iconColor}`} />
                                      </div>
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 capitalize">
                                          {currentStatus}
                                        </div>
                                      </div>
                                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                        Current status
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                              
                              {/* Unified Timeline - Most Recent First (Payments + Extensions + Audits) - EXACT COPY FROM TRANSACTIONHUB */}
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
                                          <div className="flex space-x-3 group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 rounded-lg p-2 -m-2 transition-colors">
                                            <div className="flex-shrink-0 mt-1.5">
                                              <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                                <DollarSign className="w-3 h-3 text-red-600 dark:text-red-400" />
                                              </div>
                                            </div>
                                            <div className="flex-1">
                                              <div className="flex items-center justify-between">
                                                <div className={`text-sm font-medium ${(event.data.is_reversed || event.data.is_voided) ? 'text-red-600 dark:text-red-400 line-through' : 'text-slate-900 dark:text-slate-100'}`}>
                                                  Payment #{event.paymentIndex}
                                                  {event.data.type === 'full' && ' (Full Redemption)'}
                                                  {event.data.type === 'partial' && ' (Partial)'}
                                                  {(event.data.is_reversed || event.data.is_voided) && (
                                                    <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full border border-red-200 dark:border-red-800">
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
                                                      onClick={() => handlePaymentReversalAction(event.data.payment_id, selectedTransaction)}
                                                      disabled={isProcessingPayment(event.data.payment_id)}
                                                      className="ml-2 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors disabled:opacity-50"
                                                      title="Cancel payment (admin only, same-day)"
                                                    >
                                                      {isProcessingPayment(event.data.payment_id) ? '...' : 'Cancel'}
                                                    </button>
                                                  );
                                                })()}
                                              </div>
                                              <div className="flex items-center justify-between mt-1">
                                                <div className={`text-xs ${(event.data.is_reversed || event.data.is_voided) ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                                  {formatBusinessDate(event.data.payment_date || event.data.created_at)}
                                                </div>
                                                <div className={`text-xs ${(event.data.is_reversed || event.data.is_voided) ? 'text-red-600 dark:text-red-400 line-through' : 'text-green-600 dark:text-green-400'} font-medium`}>
                                                  {formatCurrency(event.data.payment_amount || event.data.amount)}
                                                </div>
                                              </div>
                                              {(event.data.processed_by_user_id || event.data.created_by_user_id || event.data.user_id) && (
                                                <div className={`text-xs ${(event.data.is_reversed || event.data.is_voided) ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                                  by User #{event.data.processed_by_user_id || event.data.created_by_user_id || event.data.user_id}
                                                </div>
                                              )}
                                              {(event.data.is_reversed || event.data.is_voided) && event.data.void_reason && (
                                                <div className="text-xs text-red-600 dark:text-red-400 italic mt-1">
                                                  Reason: {event.data.void_reason.replace('REVERSAL: ', '')}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ) : event.type === 'extension' ? (
                                          // Extension Entry with Cancel Support
                                          <div className="flex space-x-3 group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 rounded-lg p-2 -m-2 transition-colors">
                                            <div className="flex-shrink-0 mt-1.5">
                                              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                                event.data.is_cancelled 
                                                  ? 'bg-red-100 dark:bg-red-900/30' 
                                                  : 'bg-cyan-100 dark:bg-cyan-900/30'
                                              }`}>
                                                <Calendar className={`w-3 h-3 ${
                                                  event.data.is_cancelled 
                                                    ? 'text-red-600 dark:text-red-400' 
                                                    : 'text-cyan-600 dark:text-cyan-400'
                                                }`} />
                                              </div>
                                            </div>
                                            <div className="flex-1">
                                              <div className="flex items-center justify-between">
                                                <div className={`text-sm font-medium ${
                                                  event.data.is_cancelled 
                                                    ? 'text-red-600 dark:text-red-400 line-through' 
                                                    : 'text-slate-900 dark:text-slate-100'
                                                }`}>
                                                  {event.data.formatted_id ? `${event.data.formatted_id} - ` : ''}Extension #{event.extensionIndex} ({event.data.extension_months}mo)
                                                  {event.data.is_cancelled && (
                                                    <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full border border-red-200 dark:border-red-800">
                                                      CANCELLED
                                                    </span>
                                                  )}
                                                </div>
                                                {canCancelExtensionFromHook(event.data.extension_date) && !event.data.is_cancelled && (
                                                  <button
                                                    onClick={() => handleExtensionCancelAction(event.data.extension_id, selectedTransaction)}
                                                    disabled={extensionProcessingCancel === `extension-${event.data.extension_id}`}
                                                    className="ml-2 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors disabled:opacity-50"
                                                    title="Cancel extension (admin only, same-day)"
                                                  >
                                                    Cancel
                                                  </button>
                                                )}
                                              </div>
                                              <div className="flex items-center justify-between mt-1">
                                                <div className={`text-xs ${event.data.is_cancelled ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
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
                                                    35
                                                  )}
                                                  {event.data.is_cancelled && (
                                                    <span className="ml-2 text-red-600 dark:text-red-400 font-normal">
                                                      (Refunded)
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              {(event.data.processed_by_user_id || event.data.created_by_user_id || event.data.user_id) && (
                                                <div className={`text-xs ${event.data.is_cancelled ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                                  by User #{event.data.processed_by_user_id || event.data.created_by_user_id || event.data.user_id}
                                                </div>
                                              )}
                                              {event.data.is_cancelled && event.data.cancellation_reason && (
                                                <div className="text-xs text-red-600 dark:text-red-400 italic mt-1">
                                                  Reason: {event.data.cancellation_reason}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ) : event.type === 'audit' ? (
                                          // Check if this is a voided or canceled transaction for clean display
                                          (event.data.new_value === 'voided' || event.data.new_value === 'TransactionStatus.VOIDED' || event.data.new_value?.toLowerCase().includes('voided')) ? (
                                            // Clean Voided Transaction Display (like extensions)
                                            <div className="flex space-x-3 group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 rounded-lg p-2 -m-2 transition-colors">
                                              <div className="flex-shrink-0 mt-1.5">
                                                <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                                  <XCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
                                                </div>
                                              </div>
                                              <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                  <div className="text-sm font-medium text-red-600 dark:text-red-400">
                                                    Transaction VOIDED
                                                    <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full border border-red-200 dark:border-red-800">
                                                      VOIDED
                                                    </span>
                                                  </div>
                                                </div>
                                                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                                                  {formatBusinessDate(event.data.timestamp)}
                                                </div>
                                                {(event.data.staff_member || event.data.user_id) && (
                                                  <div className="text-xs text-red-600 dark:text-red-400">
                                                    by User #{event.data.staff_member || event.data.user_id}
                                                  </div>
                                                )}
                                                {event.data.details && (event.data.details.includes('VOIDED:') || event.data.details.includes('Reason:')) && (
                                                  <div className="text-xs text-red-600 dark:text-red-400">
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
                                            <div className="flex space-x-3 group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 rounded-lg p-2 -m-2 transition-colors">
                                              <div className="flex-shrink-0 mt-1.5">
                                                <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                                  <XCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
                                                </div>
                                              </div>
                                              <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                  <div className="text-sm font-medium text-red-600 dark:text-red-400">
                                                    Transaction CANCELED
                                                    <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full border border-red-200 dark:border-red-800">
                                                      CANCELED
                                                    </span>
                                                  </div>
                                                </div>
                                                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                                                  {formatBusinessDate(event.data.timestamp)}
                                                </div>
                                                {(event.data.staff_member || event.data.user_id) && (
                                                  <div className="text-xs text-red-600 dark:text-red-400">
                                                    by User #{event.data.staff_member || event.data.user_id}
                                                  </div>
                                                )}
                                                {event.data.details && (event.data.details.includes('CANCELED:') || event.data.details.includes('Reason:')) && (
                                                  <div className="text-xs text-red-600 dark:text-red-400">
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
                                            // Status Change Timeline - Use unified theming system
                                            <div className="flex space-x-3 group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 rounded-lg p-2 -m-2 transition-colors">
                                              <div className="flex-shrink-0 mt-1.5">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${(() => {
                                                  const status = event.data.new_value?.toLowerCase().replace('transactionstatus.', '');
                                                  // Use the same status configuration as the main status display
                                                  const statusColors = {
                                                    'active': 'bg-blue-100 dark:bg-blue-900/30',
                                                    'overdue': 'bg-red-100 dark:bg-red-900/30',
                                                    'extended': 'bg-cyan-100 dark:bg-cyan-900/30',
                                                    'redeemed': 'bg-green-100 dark:bg-green-900/30',
                                                    'sold': 'bg-purple-100 dark:bg-purple-900/30',
                                                    'hold': 'bg-amber-100 dark:bg-amber-900/30',
                                                    'forfeited': 'bg-orange-100 dark:bg-orange-900/30',
                                                    'damaged': 'bg-amber-100 dark:bg-amber-900/30',
                                                    'voided': 'bg-gray-100 dark:bg-gray-900/30'
                                                  };
                                                  return statusColors[status] || 'bg-blue-100 dark:bg-blue-900/30';
                                                })()}`}>
                                                  {(() => {
                                                    const status = event.data.new_value?.toLowerCase().replace('transactionstatus.', '');
                                                    const statusIcons = {
                                                      'active': <Circle className="w-3 h-3 text-blue-600 dark:text-blue-400" />,
                                                      'overdue': <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />,
                                                      'extended': <Calendar className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />,
                                                      'redeemed': <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />,
                                                      'sold': <ShoppingBag className="w-3 h-3 text-purple-600 dark:text-purple-400" />,
                                                      'hold': <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />,
                                                      'forfeited': <XCircle className="w-3 h-3 text-orange-600 dark:text-orange-400" />,
                                                      'damaged': <AlertCircle className="w-3 h-3 text-amber-800 dark:text-amber-600" />,
                                                      'voided': <XCircle className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                                                    };
                                                    return statusIcons[status] || <RefreshCw className="w-3 h-3 text-blue-600 dark:text-blue-400" />;
                                                  })()}
                                                </div>
                                              </div>
                                              <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                    Status Changed
                                                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full border ${(() => {
                                                      const status = event.data.new_value?.toLowerCase().replace('transactionstatus.', '');
                                                      const statusBadges = {
                                                        'active': 'bg-blue-600 border-blue-600 text-white',
                                                        'overdue': 'bg-red-600 border-red-600 text-white',
                                                        'extended': 'bg-cyan-600 border-cyan-600 text-white',
                                                        'redeemed': 'bg-green-600 border-green-600 text-white',
                                                        'sold': 'bg-purple-600 border-purple-600 text-white',
                                                        'hold': 'bg-amber-600 border-amber-600 text-white',
                                                        'forfeited': 'bg-orange-600 border-orange-600 text-white',
                                                        'damaged': 'bg-amber-700 border-amber-700 text-white',
                                                        'voided': 'bg-gray-600 border-gray-600 text-white'
                                                      };
                                                      return statusBadges[status] || 'bg-blue-600 border-blue-600 text-white';
                                                    })()}`}>
                                                      {event.data.new_value?.replace('TransactionStatus.', '').toUpperCase() || 'STATUS CHANGE'}
                                                    </span>
                                                  </div>
                                                </div>
                                                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                                  {formatBusinessDate(event.data.timestamp)}
                                                </div>
                                                {(event.data.staff_member || event.data.user_id) && (
                                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                                    by User #{event.data.staff_member || event.data.user_id}
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
                                            <div className="flex space-x-3 group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 rounded-lg p-2 -m-2 transition-colors">
                                              <div className="flex-shrink-0 mt-1.5">
                                                {(() => {
                                                  // Use specific icons for audit entries based on action_summary
                                                  if (event.data.action_summary === 'Transaction Redeemed') {
                                                    return (
                                                      <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                                        <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                                                      </div>
                                                    );
                                                  } else if (event.data.action_summary === 'Transaction Created') {
                                                    return (
                                                      <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                                        <Plus className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                                      </div>
                                                    );
                                                  } else {
                                                    // Default audit entry styling
                                                    return (
                                                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                        <FileText className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                                                      </div>
                                                    );
                                                  }
                                                })()}
                                              </div>
                                              <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                    {event.data.action_summary}
                                                  </div>
                                                </div>
                                                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                                  {formatBusinessDate(event.data.timestamp || event.data.created_at)}
                                                </div>
                                                {(event.data.staff_member || event.data.user_id) && (
                                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                                    by User #{event.data.staff_member || event.data.user_id}
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
                              <div className="flex space-x-3 group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 rounded-lg p-2 -m-2 transition-colors">
                                <div className="flex-shrink-0 mt-1.5">
                                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <Plus className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                  </div>
                                </div>
                                <div className="flex-1">
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

              {/* Mobile/Tablet Layout - Stacked Panels */}
              {!loadingTransactionDetails && (
                <div className="lg:hidden p-4 space-y-6">
                  {/* Customer & Financial Summary (Mobile) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center space-x-2 text-sm">
                          <Phone className="w-4 h-4 text-blue-600" />
                          <span>Customer</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg font-bold">
                          {(() => {
                            const phone = getTransactionField('customer_phone') || getTransactionField('customer_id');
                            const name = getTransactionField('customer_name');
                            if (phone && phone !== 'No Customer') {
                              return phone?.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') || phone;
                            }
                            return name || 'No Customer';
                          })()}
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
                      {/* Admin-only Update Status Button */}
                      {user?.role === 'admin' && (
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setShowTransactionDetails(false);
                            handleStatusUpdate(selectedTransaction?.transaction || selectedTransaction);
                          }}
                          disabled={!canUpdateStatus(selectedTransaction?.transaction || selectedTransaction)}
                          className="w-full"
                          title={!canUpdateStatus(selectedTransaction?.transaction || selectedTransaction) ? 
                            "Cannot update status for finalized transactions: redeemed, sold, or voided" : 
                            "Update transaction status (admin only)"
                          }
                        >
                          <Activity className="w-4 h-4 mr-2" />
                          Update Status
                        </Button>
                      )}
                      
                      {/* Admin-only Void Transaction Button */}
                      {user?.role === 'admin' && (
                        <Button 
                          variant="destructive"
                          onClick={() => {
                            handleVoidTransaction(selectedTransaction?.transaction || selectedTransaction);
                          }}
                          disabled={!canVoidTransaction(selectedTransaction?.transaction || selectedTransaction)}
                          className="w-full"
                          title={!canVoidTransaction(selectedTransaction?.transaction || selectedTransaction) ? 
                            "Cannot void transactions with status: redeemed, forfeited, sold, voided, or canceled" : 
                            "Void this transaction (admin only)"
                          }
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
                        <X className="w-4 h-4 mr-2" />
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

      {/* Admin Approval Dialog for Payment Reversal */}
      <AdminApprovalDialog
        open={paymentReversalDialogOpen}
        onOpenChange={handlePaymentReversalCancel}
        title="Payment Reversal Authorization"
        description="This action will reverse the selected payment and update the transaction balance. Please provide your admin credentials and reason for this reversal."
        onApprove={(approvalData) => handlePaymentReversalApproval(approvalData, selectedTransaction, paymentHistory)}
        onCancel={handlePaymentReversalCancel}
        loading={isProcessingPayment(pendingPaymentReversalId)}
        actionType="reversal"
        requireReason={true}
        warningMessage={paymentReversalEligibility?.warnings ? paymentReversalEligibility.warnings.join(' ') : undefined}
      >
        {(pendingPaymentTransaction || selectedTransaction || paymentReversalEligibility) && (
          <div className="bg-amber-50 border border-amber-300 rounded-md p-3">
            <h4 className="text-sm font-medium text-amber-900 mb-2">Reversal Details</h4>
            <div className="text-sm text-amber-900 space-y-1">
              {(() => {
                const transactionData = pendingPaymentTransaction?.transaction || selectedTransaction?.transaction || selectedTransaction;
                if (transactionData) {
                  return (
                    <>
                      <p><strong>Transaction ID:</strong> {formatTransactionId(transactionData)}</p>
                      <div><strong>Current Status:</strong> <StatusBadge status={getTransactionStatus()} /></div>
                      {selectedTransactionCustomer && (
                        <p><strong>Customer:</strong> {`${selectedTransactionCustomer.first_name || ''} ${selectedTransactionCustomer.last_name || ''}`.trim().toUpperCase()}</p>
                      )}
                      {transactionData.loan_amount && (
                        <p><strong>Loan Amount:</strong> {formatCurrency(transactionData.loan_amount)}</p>
                      )}
                    </>
                  );
                }
                return null; // Don't show incomplete data
              })()}
              {paymentReversalEligibility?.payment_amount && (
                <p><strong>Payment Amount:</strong> {formatCurrency(paymentReversalEligibility.payment_amount)}</p>
              )}
              {paymentReversalEligibility?.payment_date && (
                <p><strong>Payment Date:</strong> {formatBusinessDate(paymentReversalEligibility.payment_date)}</p>
              )}
            </div>
          </div>
        )}
      </AdminApprovalDialog>

      {/* Admin Approval Dialog for Extension Cancellation */}
      <AdminApprovalDialog
        open={showExtensionCancelDialog}
        onOpenChange={handleExtensionCancelCancel}
        title="Extension Cancellation Authorization"
        description="This action will cancel the selected extension, refund fees, and revert the maturity date. Please provide your admin credentials and reason for this cancellation."
        onApprove={(approvalData) => handleExtensionCancelApproval(approvalData, selectedTransaction)}
        onCancel={handleExtensionCancelCancel}
        loading={extensionProcessingCancel === `extension-${pendingCancelExtensionId}`}
        actionType="cancellation"
        requireReason={true}
        warningMessage={extensionEligibility?.warnings ? extensionEligibility.warnings.join(' ') : undefined}
      >
        {(pendingCancelTransaction || selectedTransaction || extensionEligibility) && (
          <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
            <h4 className="text-sm font-medium text-orange-900 mb-2">Cancellation Details</h4>
            <div className="text-sm text-orange-900 space-y-1">
              {(() => {
                const transactionData = pendingCancelTransaction?.transaction || selectedTransaction?.transaction;
                return transactionData ? (
                  <>
                    <p><strong>Transaction ID:</strong> {formatTransactionId(transactionData)}</p>
                    <div><strong>Current Status:</strong> <StatusBadge status={getTransactionStatus()} /></div>
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
              {extensionEligibility?.extension_fee && (
                <p><strong>Extension Fee:</strong> {formatCurrency(extensionEligibility.extension_fee)}</p>
              )}
              {extensionEligibility?.extension_date && (
                <p><strong>Extension Date:</strong> {formatBusinessDate(extensionEligibility.extension_date)}</p>
              )}
              {extensionEligibility?.extension_months && (
                <p><strong>Extension Period:</strong> {extensionEligibility.extension_months} month(s)</p>
              )}
            </div>
          </div>
        )}
      </AdminApprovalDialog>

      {/* Admin Approval Dialog for Transaction Void */}
      <AdminApprovalDialog
        open={showVoidApprovalDialog}
        onOpenChange={(open) => !open && handleVoidTransactionCancel()}
        title="Transaction Void Authorization"
        description="This action will permanently void the transaction and mark it as canceled. This action cannot be reversed."
        onApprove={(approvalData) => handleVoidTransactionApproval(approvalData, selectedTransaction)}
        onCancel={handleVoidTransactionCancel}
        loading={voidProcessingCancel === `void-${pendingVoidTransaction?.transaction_id}`}
        actionType="void"
        requireReason={true}
        warningMessage="This is a permanent action that cannot be undone. All transaction data will be marked as voided."
      >
        {pendingVoidTransaction && (
          <div className="bg-red-50 border border-red-300 rounded-md p-3">
            <h4 className="text-sm font-medium text-red-900 mb-2">Transaction Details</h4>
            <div className="text-sm text-red-900 space-y-1">
              <p><strong>Transaction ID:</strong> {formatTransactionId(pendingVoidTransaction)}</p>
              <div><strong>Current Status:</strong> <StatusBadge status={pendingVoidTransaction.status} /></div>
              {selectedCustomer && (
                <p><strong>Customer:</strong> {`${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim().toUpperCase()}</p>
              )}
              {pendingVoidTransaction.loan_amount && (
                <p><strong>Loan Amount:</strong> {formatCurrency(pendingVoidTransaction.loan_amount)}</p>
              )}
            </div>
          </div>
        )}
      </AdminApprovalDialog>

      {/* Items Dialog */}
      <Dialog open={showItemsDialog} onOpenChange={setShowItemsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-details-light dark:bg-details-dark border border-details-medium/20 dark:border-details-medium/40">
          <DialogHeader className="border-b border-details-medium/20 dark:border-details-medium/40 pb-4">
            <DialogTitle className="text-slate-800 dark:text-slate-200 flex items-center">
              <div className="p-2 rounded-lg bg-details-accent text-white shadow-lg mr-3">
                <Eye className="h-5 w-5" />
              </div>
              Transaction Details
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              View all items associated with transaction {selectedTransactionItems && formatTransactionId(selectedTransactionItems)}
            </DialogDescription>
          </DialogHeader>
          {selectedTransactionItems && (
            <div className="space-y-4">
              {/* Transaction Info */}
              <div className="flex items-center justify-between p-4 bg-details-light dark:bg-details-medium/30 rounded-lg border border-details-medium/20">
                <div className="flex-1 space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    #{formatTransactionId(selectedTransactionItems)}
                  </h3>
                  {selectedCustomer && (
                    <div className="text-base font-semibold text-slate-800 dark:text-slate-200">
                      {selectedCustomer.first_name} {selectedCustomer.last_name}
                    </div>
                  )}
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {(selectedTransactionItems.customer_phone || selectedTransactionItems.customer_id)?.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') || selectedTransactionItems.customer_phone || selectedTransactionItems.customer_id}
                  </div>
                </div>
                <StatusBadge status={selectedTransactionItems.status} />
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <h4 className="font-medium text-slate-800 dark:text-slate-200 flex items-center">
                  <Package className="w-4 h-4 mr-2 text-details-accent" />
                  Items ({selectedTransactionItems.items?.length || 0})
                </h4>

                {selectedTransactionItems.items && selectedTransactionItems.items.length > 0 ? (
                  <div className="grid gap-4">
                    {selectedTransactionItems.items.map((item, index) => (
                      <Card key={index} className="border border-details-medium/20 dark:border-details-medium/40 bg-white/70 dark:bg-slate-800/70">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-xs bg-details-accent/10 dark:bg-details-accent/20 text-details-accent px-2 py-1 rounded">
                                  Item #{index + 1}
                                </span>
                                {item.serial_number && (
                                  <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded">
                                    S/N: {item.serial_number}
                                  </span>
                                )}
                              </div>
                              <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-base">
                                {item.description}
                              </h5>
                              {item.condition && (
                                <div className="flex items-center space-x-2 text-sm">
                                  <span className="text-slate-500 dark:text-slate-400">Condition:</span>
                                  <Badge variant="outline" className="capitalize">
                                    {item.condition}
                                  </Badge>
                                </div>
                              )}
                              {item.estimated_value && (
                                <div className="flex items-center space-x-2 text-sm">
                                  <span className="text-slate-500 dark:text-slate-400">Estimated Value:</span>
                                  <span className="font-medium text-green-600 dark:text-green-400">
                                    ${item.estimated_value.toLocaleString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-slate-400">No items found for this transaction</p>
                  </div>
                )}
              </div>
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
    vipCustomers: 0
  });
  const [loading, setLoading] = useState(true);
  const [customerListLoading, setCustomerListLoading] = useState(false);
  const [customerListError, setCustomerListError] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchTimeoutRef = useRef(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [alertFilter, setAlertFilter] = useState(false); // Filter for customers with alerts
  const [vipFilter, setVipFilter] = useState(false); // Filter for VIP customers only
  const [followUpFilter, setFollowUpFilter] = useState(false); // Filter for customers needing follow-up
  const [newThisMonthFilter, setNewThisMonthFilter] = useState(false); // Filter for customers created this month
  const [advancedFilters, setAdvancedFilters] = useState({}); // Advanced filters state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  
  // Overview tab specific state
  const [overviewTransactions, setOverviewTransactions] = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Customer list transaction data for last activity calculation
  const [customerTransactionsMap, setCustomerTransactionsMap] = useState({});
  const [loadingCustomerActivities, setLoadingCustomerActivities] = useState(false);

  // Number formatting utility for large counts
  const formatCount = (count) => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(count % 1000000 === 0 ? 0 : 1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(count % 1000 === 0 ? 0 : 1) + 'K';
    }
    return count.toString();
  };

  // Calculate last activity date from transaction data
  const calculateLastActivityFromTransactions = (transactions) => {
    if (!transactions || transactions.length === 0) {
      return null;
    }
    
    // Collect all activity dates from transactions and their updates
    const activityDates = [];
    
    transactions.forEach(transaction => {
      // Transaction creation date (loan origination)
      if (transaction.pawn_date) {
        activityDates.push(new Date(transaction.pawn_date));
      } else if (transaction.transaction_date) {
        activityDates.push(new Date(transaction.transaction_date));
      } else if (transaction.created_at) {
        activityDates.push(new Date(transaction.created_at));
      }
      
      // Transaction update date (captures payments, extensions, status changes)
      // This is the most reliable indicator of recent customer activity
      if (transaction.updated_at) {
        const updatedDate = new Date(transaction.updated_at);
        const createdDate = new Date(transaction.created_at || transaction.pawn_date || transaction.transaction_date);
        
        // Only include update date if it's meaningfully different from creation (>1 minute)
        if (Math.abs(updatedDate - createdDate) > 60000) {
          activityDates.push(updatedDate);
        }
      }
      
      // Future enhancement: Include payment and extension dates when API provides them
      // These would be fetched from separate endpoints or enriched transaction data
      if (transaction.payments && Array.isArray(transaction.payments)) {
        transaction.payments.forEach(payment => {
          if (payment.payment_date && !payment.is_voided) {
            activityDates.push(new Date(payment.payment_date));
          }
        });
      }
      
      if (transaction.extensions && Array.isArray(transaction.extensions)) {
        transaction.extensions.forEach(extension => {
          if (extension.extension_date && !extension.is_cancelled) {
            activityDates.push(new Date(extension.extension_date));
          }
        });
      }
    });
    
    // Find the most recent activity date
    if (activityDates.length === 0) {
      return null;
    }
    
    // Sort dates descending and get the most recent
    activityDates.sort((a, b) => b - a);
    return activityDates[0].toISOString();
  };

  // Get last activity date for overview tab (uses overviewTransactions)
  const getLastActivityDate = () => {
    return calculateLastActivityFromTransactions(overviewTransactions);
  };

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  // Sort preferences with localStorage persistence
  const [sortField, setSortField] = useState(() => {
    const saved = localStorage.getItem('customerSortField');
    return saved || 'last_accessed_at';
  });
  const [sortOrder, setSortOrder] = useState(() => {
    const saved = localStorage.getItem('customerSortOrder');
    return saved || 'desc';
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [customersPerPage, setCustomersPerPage] = useState(10);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
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

  // Customer view mode state (list or card) with localStorage persistence
  const [customerViewMode, setCustomerViewMode] = useState(() => {
    const saved = localStorage.getItem('customerViewMode');
    return saved || 'list';
  });

  // Handler for customer view mode change
  const handleCustomerViewModeChange = useCallback((mode) => {
    setCustomerViewMode(mode);
    localStorage.setItem('customerViewMode', mode);
  }, []);

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
          vipCustomers: stats.vip_customers || 0
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
        vipCustomers: 0
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

  // Helper function to get current search term (for immediate actions)
  const getCurrentSearchTerm = useCallback(() => {
    return searchQuery.trim();
  }, [searchQuery]);

  const handleSort = (field) => {
    if (sortField === field) {
      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      setSortOrder(newOrder);
      localStorage.setItem('customerSortOrder', newOrder);
    } else {
      setSortField(field);
      setSortOrder('asc');
      localStorage.setItem('customerSortField', field);
      localStorage.setItem('customerSortOrder', 'asc');
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
      await loadCustomers(currentPage, getCurrentSearchTerm(), statusFilter, true, alertFilter, vipFilter, followUpFilter);
      
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


  // Note: loadCustomerStats has been moved earlier in the file to fix hoisting issue

  // Load only customer list (for search/pagination)
  const loadCustomerList = useCallback(async (page = 1, search = '', status = null, filterByAlerts = null, filterByVip = null, filterByFollowUp = null, filterByNewThisMonth = null, advFilters = {}) => {
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

      // Add VIP filter if requested
      if (filterByVip) {
        params.vip_only = true;
      }

      // Add alerts filter if requested (server-side filtering)
      if (filterByAlerts) {
        params.alerts_only = true;
      }

      // Add follow-up filter if requested (server-side filtering)
      if (filterByFollowUp) {
        params.follow_up_only = true;
      }

      // Add new this month filter if requested (server-side filtering)
      if (filterByNewThisMonth) {
        params.new_this_month = true;
      }

      // Add advanced filters
      if (advFilters && Object.keys(advFilters).length > 0) {
        Object.assign(params, advFilters);
      }

      // Add sorting using centralized field mapping
      params.sort_by = CUSTOMER_SORT_FIELD_MAP[sortField] || sortField;
      params.sort_order = sortOrder;

      // Use enhanced search if we have a search term, otherwise use getAllCustomers
      let response = search ?
        await customerService.searchCustomers(search, params) :
        await customerService.getAllCustomers(params);

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
          loadCustomerList(page, search, status, filterByAlerts, filterByVip, filterByFollowUp);
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
        loadCustomerList(currentPage, getCurrentSearchTerm(), statusFilter, alertFilter, vipFilter, followUpFilter)
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
  }, [loadCustomerStats, loadCustomerList, currentPage, getCurrentSearchTerm, statusFilter, alertFilter, vipFilter, followUpFilter, toast]);

  // Load full page data (initial load with stats)
  const loadCustomers = useCallback(async (page = 1, search = '', status = null, forceRefresh = false, filterByAlerts = null, filterByVip = null, filterByFollowUp = null, filterByNewThisMonth = null) => {
    setLoading(true);
    try {
      // Clear cache if force refresh requested
      if (forceRefresh) {
        await customerService.forceRefresh();
      }

      // Load stats and customer list in parallel
      await Promise.all([
        loadCustomerStats(),
        loadCustomerList(page, search, status, filterByAlerts, filterByVip, filterByFollowUp, filterByNewThisMonth)
      ]);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [loadCustomerStats, loadCustomerList]);

  // Single consolidated useEffect for customer list loading
  const hasInitialLoadRef = useRef(false);
  const lastRequestRef = useRef('');
  
  useEffect(() => {
    // Build search term
    const searchTerm = debouncedSearchQuery ? debouncedSearchQuery.trim() : '';

    // Create request signature to prevent duplicate requests (include advanced filters)
    const advFiltersKey = JSON.stringify(advancedFilters);
    const requestSignature = `${currentPage}-${searchTerm}-${statusFilter}-${alertFilter}-${vipFilter}-${followUpFilter}-${newThisMonthFilter}-${advFiltersKey}-${sortField}-${sortOrder}`;

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
        loadCustomers(currentPage, searchTerm, statusFilter, false, alertFilter, vipFilter, followUpFilter, newThisMonthFilter);
      } else {
        // Subsequent loads - only get customer list
        loadCustomerList(currentPage, searchTerm, statusFilter, alertFilter, vipFilter, followUpFilter, newThisMonthFilter, advancedFilters);
      }
    };

    if (timeSinceLastCall >= 500) {
      makeRequest();
    } else {
      // Debounce rapid requests
      const timeoutId = setTimeout(makeRequest, 500 - timeSinceLastCall);
      return () => clearTimeout(timeoutId);
    }
  }, [currentPage, debouncedSearchQuery, statusFilter, alertFilter, vipFilter, followUpFilter, newThisMonthFilter, advancedFilters, sortField, sortOrder, customersPerPage, loadCustomers, loadCustomerList]);

  // Handle page size change
  const handlePageSizeChange = useCallback((value) => {
    const newPageSize = parseInt(value);
    setCustomersPerPage(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);

  // For server-side pagination, we don't need client-side filtering
  const totalPages = Math.ceil(totalCustomers / customersPerPage);
  const currentCustomers = customers; // Use the loaded customers directly

  // Reset to page 1 when search or filters change (immediate response for UI)
  useEffect(() => {
    setCurrentPage(1);
    setSelectedCustomerIds([]); // Clear selections when filters change
  }, [searchQuery, statusFilter, alertFilter, vipFilter, followUpFilter, newThisMonthFilter, advancedFilters]);

  // Advanced Filters Handlers
  const handleAdvancedFilterChange = useCallback((filters) => {
    setAdvancedFilters(filters);
    setCurrentPage(1);
    setSelectedCustomerIds([]);
  }, []);

  const handleAdvancedFilterReset = useCallback(() => {
    setAdvancedFilters({});
    setCurrentPage(1);
  }, []);

  // Simple reload when customersPerPage changes
  const [prevPageSize, setPrevPageSize] = useState(customersPerPage);
  useEffect(() => {
    if (prevPageSize !== customersPerPage) {
      setPrevPageSize(customersPerPage);
      // Direct API call to reload with new page size
      const loadWithNewPageSize = async () => {
        // Skip initial load
        if (!hasInitialLoadRef.current) return;
        
        setCustomerListLoading(true);
        setCustomerListError(null);
        try {
          const params = {
            per_page: customersPerPage,
            page: 1, // Always page 1 when changing size
            sort_by: sortField,
            sort_order: sortOrder,
          };
          
          // Add current search if any
          const searchTerm = getCurrentSearchTerm();
          if (searchTerm) {
            params.search = searchTerm;
          }
          
          // Add status filter if not 'all'
          if (statusFilter && statusFilter !== 'all') {
            params.status = statusFilter;
          }
          
          // Add alert filter if active
          if (alertFilter) {
            params.alerts_only = true;
          }

          // Add VIP filter if active
          if (vipFilter) {
            params.vip_only = true;
          }

          // Add follow-up filter if active
          if (followUpFilter) {
            params.follow_up_only = true;
          }

          // Add new this month filter if active
          if (newThisMonthFilter) {
            params.new_this_month = true;
          }

          // Use the same API call pattern as loadCustomerList
          const response = searchTerm ?
            await customerService.searchCustomers(searchTerm, params) :
            await customerService.getAllCustomers(params);
          setCustomers(response.customers || []);
          setTotalCustomers(response.total || 0);
          
          // Initialize alert counts after loading
          if (response.customers && response.customers.length > 0) {
            await initializeAlertCounts(response.customers);
          }
        } catch (error) {
          console.error('Error loading customers with new page size:', error);
          setCustomerListError(error.message || 'Failed to load customers');
          toast({
            title: 'Error',
            description: 'Failed to load customers',
            variant: 'destructive'
          });
        } finally {
          setCustomerListLoading(false);
        }
      };
      
      loadWithNewPageSize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customersPerPage, prevPageSize]);

  // Refresh overview transactions (called by activity triggers)
  const refreshOverviewTransactions = useCallback(async () => {
    if (!selectedCustomer?.phone_number) return;
    
    setOverviewLoading(true);
    try {
      // Fetch ALL transactions by using a large page size
      const params = {
        page: 1,
        page_size: 100 // Fetch up to 100 transactions for overview stats
      };
      
      const response = await transactionService.getCustomerTransactions(selectedCustomer.phone_number, params);
      
      // Handle different API response formats
      let transactionArray = [];
      if (Array.isArray(response)) {
        transactionArray = response;
      } else if (response && Array.isArray(response.transactions)) {
        transactionArray = response.transactions;
      } else if (response && Array.isArray(response.data)) {
        transactionArray = response.data;
      }
      
      setOverviewTransactions(transactionArray);
    } catch (error) {
      console.error('Failed to fetch overview transactions:', error);
      setOverviewTransactions([]);
    } finally {
      setOverviewLoading(false);
    }
  }, [selectedCustomer?.phone_number]);

  // Load transaction data for customers in the list to calculate last activity
  const loadCustomerActivities = useCallback(async (customers) => {
    if (!customers || customers.length === 0) return;
    
    setLoadingCustomerActivities(true);
    const newTransactionsMap = {};
    
    try {
      // Load transactions for each customer in parallel (limit to avoid overwhelming the server)
      const batchSize = 5;
      for (let i = 0; i < customers.length; i += batchSize) {
        const batch = customers.slice(i, i + batchSize);
        const promises = batch.map(async (customer) => {
          try {
            // Get ALL transactions by fetching multiple pages if needed
            let allTransactions = [];
            let page = 1;
            let hasMorePages = true;
            const pageSize = 100; // Maximum allowed by backend
            
            while (hasMorePages) {
              const response = await transactionService.getCustomerTransactions(customer.phone_number, {
                page_size: pageSize,
                page: page
              });
              
              let transactionArray = [];
              
              if (Array.isArray(response)) {
                transactionArray = response;
              } else if (response && Array.isArray(response.transactions)) {
                transactionArray = response.transactions;
              } else if (response && Array.isArray(response.data)) {
                transactionArray = response.data;
              }
              
              allTransactions = allTransactions.concat(transactionArray);
              
              // Check if we've loaded all transactions
              if (transactionArray.length < pageSize) {
                // Last page reached (fewer items than page size)
                hasMorePages = false;
              } else if (response.total_count && allTransactions.length >= response.total_count) {
                // All transactions loaded based on total count
                hasMorePages = false;
              } else if (page >= 10) {
                // Safety limit: don't fetch more than 10 pages (1000 transactions)
                console.warn(`Customer ${customer.phone_number} has more than 1000 transactions. Limiting to first 1000 for performance.`);
                hasMorePages = false;
              }
              
              page++;
            }
            
            return { phone: customer.phone_number, transactions: allTransactions };
          } catch (error) {
            console.error(`Failed to fetch transactions for ${customer.phone_number}:`, error);
            return { phone: customer.phone_number, transactions: [] };
          }
        });
        
        const results = await Promise.all(promises);
        results.forEach(({ phone, transactions }) => {
          newTransactionsMap[phone] = transactions;
        });
      }
      
      setCustomerTransactionsMap(newTransactionsMap);
    } catch (error) {
      console.error('Failed to load customer activities:', error);
    } finally {
      setLoadingCustomerActivities(false);
    }
  }, []);

  // Refresh Credit & Slots data specifically for real-time updates
  const refreshCreditSlotsData = useCallback(async () => {
    if (currentCustomers && currentCustomers.length > 0) {
      await loadCustomerActivities(currentCustomers);
    }
  }, [currentCustomers, loadCustomerActivities]);

  // Load customer activities when customer list changes
  useEffect(() => {
    if (currentCustomers && currentCustomers.length > 0) {
      loadCustomerActivities(currentCustomers);
    }
  }, [currentCustomers, loadCustomerActivities]);

  // Load transactions for overview tab
  useEffect(() => {
    if (activeTab === 'overview') {
      refreshOverviewTransactions();
    }
  }, [selectedCustomer?.phone_number, activeTab, refreshOverviewTransactions]);

  // Listen for transaction activity updates to refresh last activity
  useEffect(() => {
    const handleTransactionUpdate = (event) => {
      const { customer_phone } = event.detail || {};
      
      // Refresh overview if this update is for the currently selected customer
      if (customer_phone === selectedCustomer?.phone_number && activeTab === 'overview') {
        refreshOverviewTransactions();
      }
      
      // Immediate refresh for Credit & Slots data (no delay for real-time responsiveness)
      clearTimeout(window.creditSlotsRefreshTimeout);
      window.creditSlotsRefreshTimeout = setTimeout(() => {
        if (currentCustomers && currentCustomers.length > 0) {
          loadCustomerActivities(currentCustomers);
        }
      }, 500); // Faster refresh for Credit & Slots
      
      // Also refresh customer list to update last transaction dates
      // Use a small delay to avoid multiple rapid refreshes
      clearTimeout(window.customerListRefreshTimeout);
      window.customerListRefreshTimeout = setTimeout(() => {
        loadCustomerList(currentPage, getCurrentSearchTerm(), statusFilter, alertFilter, vipFilter, followUpFilter);
      }, 1500); // Longer delay for full customer list
    };

    // Listen for various transaction activities
    window.addEventListener('transaction-updated', handleTransactionUpdate);
    window.addEventListener('payment-processed', handleTransactionUpdate);
    window.addEventListener('extension-applied', handleTransactionUpdate);
    window.addEventListener('transaction-created', handleTransactionUpdate);
    
    return () => {
      window.removeEventListener('transaction-updated', handleTransactionUpdate);
      window.removeEventListener('payment-processed', handleTransactionUpdate);
      window.removeEventListener('extension-applied', handleTransactionUpdate);
      window.removeEventListener('transaction-created', handleTransactionUpdate);
      clearTimeout(window.customerListRefreshTimeout);
    };
  }, [selectedCustomer?.phone_number, activeTab, refreshOverviewTransactions, currentPage, statusFilter, alertFilter, vipFilter, followUpFilter, loadCustomerList, getCurrentSearchTerm, currentCustomers, loadCustomerActivities]);

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
      await loadCustomers(currentPage, getCurrentSearchTerm(), statusFilter, true, alertFilter, vipFilter, followUpFilter);
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

  const handleViewCustomer = async (customer) => {
    setSelectedCustomer(customer);
    setShowDetails(true);

    // Mark customer as accessed (non-blocking, updates last_accessed_at timestamp)
    customerService.markCustomerAccessed(customer.phone_number);
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

  const handleNewTransaction = () => {
    // Switch to transactions tab where the New Transaction button is available
    setActiveTab('transactions');
  };

  const handleSetCustomLimit = (customer) => {
    setSelectedCustomerForLimit(customer);
    setShowCustomLimitDialog(true);
  };

  // Handle Service Alert Bell Click
  const handleBellClick = (customerPhone, alertCount, refreshCount) => {
    const customer = customers.find(c => c.phone_number === customerPhone);
    if (customer) {
      setSelectedCustomerForAlert({
        phone: customer.phone_number,
        name: customerService.getCustomerFullName(customer),
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
      loadCustomerList(currentPage, getCurrentSearchTerm(), statusFilter, alertFilter, vipFilter, followUpFilter),
      loadCustomerStats() // Refresh stats including VIP count
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
      await loadCustomers(currentPage, getCurrentSearchTerm(), statusFilter, true, alertFilter, vipFilter, followUpFilter);
      
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
      {/* Modern Stats Grid */}
      <div className={`grid gap-6 ${isAdmin ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
        {/* Active/Eligible Customers */}
        <Card
          className={`relative overflow-hidden border-0 shadow-sm bg-gradient-to-r transition-all cursor-pointer group ${
            statusFilter === 'active'
              ? 'from-blue-100 to-sky-100 dark:from-blue-900/70 dark:to-sky-900/70 shadow-md ring-2 ring-blue-400 dark:ring-blue-500'
              : 'from-blue-50 to-sky-50 dark:from-blue-950/50 dark:to-sky-950/50 hover:shadow-md'
          }`}
          onClick={async () => {
            const newStatus = statusFilter === 'active' ? 'all' : 'active';
            setStatusFilter(newStatus);
            setCurrentPage(1);
            setSelectedCustomerIds([]);

            // Clear all other card filters (independent filter behavior)
            setSearchQuery('');
            setDebouncedSearchQuery('');
            setNewThisMonthFilter(false);
            setFollowUpFilter(false);
            setVipFilter(false);
            setAlertFilter(false);

            await loadCustomerList(1, '', newStatus === 'active' ? 'active' : null, false, false, false, false);

            toast({
              title: newStatus === 'active' ? 'Active Customers Filter Applied' : 'Active Customers Filter Removed',
              description: newStatus === 'active'
                ? 'Displaying only active customers.'
                : 'Active customers filter has been removed.'
            });
          }}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300 group-hover:text-blue-800 dark:group-hover:text-blue-200">
                  Active Customers {loading ? '(Refreshing...)' : ''}
                </p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {loading ? '-' : formatCount(customerStats.active)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 dark:bg-blue-400/10 rounded-xl flex items-center justify-center group-hover:bg-blue-500/20 dark:group-hover:bg-blue-400/20">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 dark:bg-blue-400/5 rounded-full -mr-10 -mt-10"></div>
          </CardContent>
        </Card>

        {/* New Customers This Month */}
        <Card
          className={`relative overflow-hidden border-0 shadow-sm bg-gradient-to-r transition-all cursor-pointer group ${
            newThisMonthFilter
              ? 'from-emerald-100 to-green-100 dark:from-emerald-900/70 dark:to-green-900/70 shadow-md ring-2 ring-emerald-400 dark:ring-emerald-500'
              : 'from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50 hover:shadow-md'
          }`}
          onClick={async () => {
            const newFilter = !newThisMonthFilter;
            setNewThisMonthFilter(newFilter);
            setCurrentPage(1);
            setSelectedCustomerIds([]);

            // Clear all other card filters (independent filter behavior)
            setSearchQuery('');
            setDebouncedSearchQuery('');
            setStatusFilter('all');
            setFollowUpFilter(false);
            setVipFilter(false);
            setAlertFilter(false);

            await loadCustomerList(1, '', null, false, false, false, newFilter);

            toast({
              title: newFilter ? 'New This Month Filter Applied' : 'New This Month Filter Removed',
              description: newFilter
                ? 'Displaying customers created in the current calendar month.'
                : 'New this month filter has been removed.'
            });
          }}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 group-hover:text-emerald-800 dark:group-hover:text-emerald-200">
                  New This Month {loading ? '(Refreshing...)' : ''}
                </p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                  {loading ? '-' : formatCount(customerStats.newThisMonth)}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-500/10 dark:bg-emerald-400/10 rounded-xl flex items-center justify-center group-hover:bg-emerald-500/20 dark:group-hover:bg-emerald-400/20">
                <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 dark:bg-emerald-400/5 rounded-full -mr-10 -mt-10"></div>
          </CardContent>
        </Card>

        {/* Needs Follow-Up */}
        <Card
          className={`relative overflow-hidden border-0 shadow-sm bg-gradient-to-r transition-all cursor-pointer group ${
            followUpFilter
              ? 'from-purple-100 to-violet-100 dark:from-purple-900/70 dark:to-violet-900/70 shadow-md ring-2 ring-purple-400 dark:ring-purple-500'
              : 'from-purple-50 to-violet-50 dark:from-purple-950/50 dark:to-violet-950/50 hover:shadow-md'
          }`}
          onClick={async () => {
            const newFollowUpFilter = !followUpFilter;
            setFollowUpFilter(newFollowUpFilter);
            setCurrentPage(1);
            setSelectedCustomerIds([]);

            // Clear all other card filters (independent filter behavior)
            setSearchQuery('');
            setDebouncedSearchQuery('');
            setStatusFilter('all');
            setNewThisMonthFilter(false);
            setVipFilter(false);
            setAlertFilter(false);

            await loadCustomerList(1, '', null, false, false, newFollowUpFilter, false);

            toast({
              title: newFollowUpFilter ? 'Follow-Up Filter Applied' : 'Follow-Up Filter Removed',
              description: newFollowUpFilter
                ? 'Displaying customers with overdue transactions.'
                : 'Follow-up filter has been removed.'
            });
          }}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300 group-hover:text-purple-800 dark:group-hover:text-purple-200">
                  Needs Follow-Up {loading ? '(Refreshing...)' : ''}
                </p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {loading ? '-' : formatCount(customerStats.needsFollowUp)}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-500/10 dark:bg-purple-400/10 rounded-xl flex items-center justify-center group-hover:bg-purple-500/20 dark:group-hover:bg-purple-400/20">
                <Phone className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/5 dark:bg-purple-400/5 rounded-full -mr-10 -mt-10"></div>
          </CardContent>
        </Card>

        {/* Service Alerts */}
        <Card
          className={`relative overflow-hidden border-0 shadow-sm bg-gradient-to-r transition-all cursor-pointer group ${
            alertFilter
              ? 'from-orange-100 to-red-100 dark:from-orange-900/70 dark:to-red-900/70 shadow-md ring-2 ring-orange-400 dark:ring-orange-500'
              : 'from-orange-50 to-red-50 dark:from-orange-950/50 dark:to-red-950/50 hover:shadow-md'
          }`}
          onClick={async () => {
            // Toggle alert filter
            const newAlertFilter = !alertFilter;
            setAlertFilter(newAlertFilter);
            setCurrentPage(1); // Reset to first page
            setSelectedCustomerIds([]); // Clear selections

            // Clear all other card filters (independent filter behavior)
            setSearchQuery('');
            setDebouncedSearchQuery('');
            setStatusFilter('all');
            setNewThisMonthFilter(false);
            setVipFilter(false);
            setFollowUpFilter(false);

            // Load filtered customers
            await loadCustomerList(1, '', null, newAlertFilter, false, false, false);

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
                <p className="text-sm font-medium text-orange-700 dark:text-orange-300 group-hover:text-orange-800 dark:group-hover:text-orange-200">
                  Service Alerts {loading ? '(Refreshing...)' : ''}
                </p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {loading ? '-' : formatCount(customerStats.serviceAlerts)}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-500/10 dark:bg-orange-400/10 rounded-xl flex items-center justify-center group-hover:bg-orange-500/20 dark:group-hover:bg-orange-400/20">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/5 dark:bg-orange-400/5 rounded-full -mr-10 -mt-10"></div>
          </CardContent>
        </Card>

        {/* Admin-only VIP Customers */}
        {isAdmin && (
          <Card
            className={`relative overflow-hidden border-0 shadow-sm bg-gradient-to-r transition-all cursor-pointer group ${
              vipFilter
                ? 'from-yellow-100 to-amber-100 dark:from-yellow-900/70 dark:to-amber-900/70 shadow-md ring-2 ring-yellow-400 dark:ring-yellow-500'
                : 'from-yellow-50 to-amber-50 dark:from-yellow-950/50 dark:to-amber-950/50 hover:shadow-md'
            }`}
            onClick={async () => {
              // Toggle VIP filter
              const newVipFilter = !vipFilter;
              setVipFilter(newVipFilter);
              setCurrentPage(1); // Reset to first page
              setSelectedCustomerIds([]); // Clear selections

              // Clear all other card filters (independent filter behavior)
              setSearchQuery('');
              setDebouncedSearchQuery('');
              setStatusFilter('all');
              setNewThisMonthFilter(false);
              setAlertFilter(false);
              setFollowUpFilter(false);

              // Load filtered customers
              await loadCustomerList(1, '', null, false, newVipFilter, false, false);

              // Show appropriate toast message
              toast({
                title: newVipFilter ? 'Showing VIP Customers' : 'Showing All Customers',
                description: newVipFilter
                  ? 'Displaying only VIP customers with total loan value of $5,000 or more.'
                  : 'VIP filter has been removed. Showing all customers.'
              });
            }}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300 group-hover:text-yellow-800 dark:group-hover:text-yellow-200">
                    VIP Customers
                  </p>
                  <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                    {formatCount(customerStats.vipCustomers)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-500/10 dark:bg-yellow-400/10 rounded-xl flex items-center justify-center group-hover:bg-yellow-500/20 dark:group-hover:bg-yellow-400/20">
                  <Award className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
              <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-500/5 dark:bg-yellow-400/5 rounded-full -mr-10 -mt-10"></div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modern Search & Filter Section */}
      <Card className="relative overflow-hidden shadow-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        {/* Gold accent line matching cards */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600"></div>

        <CardContent className="p-6 pt-7 space-y-6">
          {/* Search Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500 dark:bg-blue-600 rounded-lg">
                <Search className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Customer Search
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Find customers by name, phone number, or email with advanced filtering options
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                onClick={() => {
                  setEditingCustomer(null);
                  setShowAddDialog(true);
                }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 border-0"
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Customer</span>
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
                  <Loader2 className="h-4 w-4 sm:mr-2 animate-spin text-blue-600 dark:text-blue-400" />
                ) : (
                  <svg className="h-4 w-4 sm:mr-2 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                <span className="hidden sm:inline">Refresh</span>
              </Button>
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
                    className="h-12 text-base font-normal"
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
                <SelectTrigger className="h-12 rounded-xl border-0 bg-slate-100/50 dark:bg-slate-700/50 hover:bg-slate-200/50 dark:hover:bg-slate-600/50 text-base font-normal">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      <span>Active</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="suspended">
                    <div className="flex items-center gap-2">
                      <PauseCircle className="h-4 w-4 text-amber-500" />
                      <span>Suspended</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="archived">
                    <div className="flex items-center gap-2">
                      <Archive className="h-4 w-4 text-slate-500" />
                      <span>Archived</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Advanced Filters Button */}
            <AdvancedFilters
              onFilterChange={handleAdvancedFilterChange}
              onReset={handleAdvancedFilterReset}
            />

            {/* View Mode Toggle - Desktop Only */}
            {!isMobile && (
              <div className="flex items-center bg-slate-100/50 dark:bg-slate-700/50 rounded-xl p-1 h-12">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCustomerViewModeChange('list')}
                  className={`h-9 px-4 rounded-lg ${customerViewMode === 'list' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'}`}
                  title="List View"
                >
                  <TableIcon className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCustomerViewModeChange('card')}
                  className={`h-9 px-4 rounded-lg ${customerViewMode === 'card' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'}`}
                  title="Card View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          </CardContent>
        </Card>

          {/* Active Status Filter Indicator */}
          {statusFilter === 'active' && (
            <Card className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30 border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                  <Users className="w-4 h-4" />
                  <span className="font-medium">Showing active customers only</span>
                  <span className="text-xs opacity-75">({totalCustomers} found)</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatusFilter('all');
                    setCurrentPage(1);
                    loadCustomerList(1, getCurrentSearchTerm(), null, alertFilter, vipFilter, followUpFilter, newThisMonthFilter);
                  }}
                  className="h-7 px-3 text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-100 dark:text-blue-300 dark:hover:text-blue-100 dark:hover:bg-blue-900/20"
                >
                  Clear filter
                </Button>
              </div>
            </Card>
          )}

          {/* Alert Filter Indicator */}
          {alertFilter && (
            <Card className="mb-4 p-3 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 border-orange-200 dark:border-orange-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-300">
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
                    loadCustomerList(1, getCurrentSearchTerm(), statusFilter, false, vipFilter, followUpFilter);
                  }}
                  className="h-7 px-3 text-xs text-orange-700 hover:text-orange-900 hover:bg-orange-100 dark:text-orange-300 dark:hover:text-orange-100 dark:hover:bg-orange-900/20"
                >
                  Clear filter
                </Button>
              </div>
            </Card>
          )}

          {/* VIP Filter Indicator */}
          {vipFilter && (
            <Card className="mb-4 p-3 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                  <Award className="w-4 h-4" />
                  <span className="font-medium">Showing VIP customers only</span>
                  <span className="text-xs opacity-75">({totalCustomers} found)</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setVipFilter(false);
                    setCurrentPage(1);
                    loadCustomerList(1, getCurrentSearchTerm(), statusFilter, alertFilter, false, false);
                  }}
                  className="h-7 px-3 text-xs text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100 dark:text-yellow-300 dark:hover:text-yellow-100 dark:hover:bg-yellow-900/20"
                >
                  Clear filter
                </Button>
              </div>
            </Card>
          )}

          {/* Follow-Up Filter Indicator */}
          {followUpFilter && (
            <Card className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
                  <Phone className="w-4 h-4" />
                  <span className="font-medium">Showing customers needing follow-up only</span>
                  <span className="text-xs opacity-75">({totalCustomers} found)</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFollowUpFilter(false);
                    setCurrentPage(1);
                    loadCustomerList(1, getCurrentSearchTerm(), statusFilter, alertFilter, vipFilter, false, newThisMonthFilter);
                  }}
                  className="h-7 px-3 text-xs text-purple-700 hover:text-purple-900 hover:bg-purple-100 dark:text-purple-300 dark:hover:text-purple-100 dark:hover:bg-purple-900/20"
                >
                  Clear filter
                </Button>
              </div>
            </Card>
          )}

          {/* New This Month Filter Indicator */}
          {newThisMonthFilter && (
            <Card className="mb-4 p-3 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                  <TrendingUp className="w-4 h-4" />
                  <span className="font-medium">Showing new customers this month only</span>
                  <span className="text-xs opacity-75">({totalCustomers} found)</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNewThisMonthFilter(false);
                    setCurrentPage(1);
                    loadCustomerList(1, getCurrentSearchTerm(), statusFilter, alertFilter, vipFilter, followUpFilter, false);
                  }}
                  className="h-7 px-3 text-xs text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:text-emerald-100 dark:hover:bg-emerald-900/20"
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
              <div className="col-span-full flex justify-center items-center py-20">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-full">
                      <AlertTriangle className="h-12 w-12 text-red-500 dark:text-red-400" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      Failed to load customers
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                      {customerListError.includes('Rate limit') ? 'Too many requests. Please wait a moment and try again.' : customerListError}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadCustomerList(currentPage, getCurrentSearchTerm(), statusFilter, alertFilter, vipFilter, followUpFilter)}
                      className="mt-2"
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              </div>
            ) : currentCustomers.length === 0 ? (
              <div className="col-span-full flex justify-center items-center py-20">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
                      <User className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {searchQuery || statusFilter !== 'all' || alertFilter ? 'No customers found' : 'No customers yet'}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                      {searchQuery || statusFilter !== 'all' || alertFilter
                        ? 'Try adjusting your search or filters to find what you\'re looking for.'
                        : 'Get started by adding your first customer to the system.'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {currentCustomers.map((customer) => (
                  <CustomerCard
                    key={customer.phone_number}
                    customer={customer}
                    isSelected={selectedCustomerIds.includes(customer.phone_number)}
                    onSelect={handleSelectCustomer}
                    onView={handleViewCustomer}
                    onCreateTransaction={(customer) => {
                      handleViewCustomer(customer);
                      handleNewTransaction();
                    }}
                    onViewTransactions={(customer) => {
                      handleViewCustomer(customer);
                      setTimeout(() => setActiveTab('transactions'), 100);
                    }}
                    onManageEligibility={(customer) => {
                      handleViewCustomer(customer);
                      setTimeout(() => setActiveTab('overview'), 100);
                    }}
                    onBellClick={handleBellClick}
                    maxActiveLoans={maxActiveLoans}
                    customerTransactions={customerTransactionsMap[customer.phone_number] || []}
                    calculateLastActivity={calculateLastActivityFromTransactions}
                  />
                ))}
              </div>
            )}
          </div>
        ) : customerViewMode === 'card' ? (
          /* Desktop Card View */
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {customerListLoading ? (
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="p-6 space-y-4 animate-pulse">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <div className="space-y-2 flex-1">
                          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                      </div>
                      <div className="h-6 w-6 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                        <div className="h-3 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                        <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <div className="h-8 flex-1 bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="h-8 flex-1 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                  </Card>
                ))}
              </>
            ) : customerListError ? (
              <div className="col-span-full flex justify-center items-center py-20">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-full">
                      <AlertTriangle className="h-12 w-12 text-red-500 dark:text-red-400" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      Failed to load customers
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                      {customerListError.includes('Rate limit') ? 'Too many requests. Please wait a moment and try again.' : customerListError}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadCustomerList(currentPage, getCurrentSearchTerm(), statusFilter, alertFilter, vipFilter, followUpFilter)}
                      className="mt-2"
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              </div>
            ) : currentCustomers.length === 0 ? (
              <div className="col-span-full flex justify-center items-center py-20">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
                      <User className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {searchQuery || statusFilter !== 'all' || alertFilter ? 'No customers found' : 'No customers yet'}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                      {searchQuery || statusFilter !== 'all' || alertFilter
                        ? 'Try adjusting your search or filters to find what you\'re looking for.'
                        : 'Get started by adding your first customer to the system.'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {currentCustomers.map((customer) => (
                  <CustomerCard
                    key={customer.phone_number}
                    customer={customer}
                    isSelected={selectedCustomerIds.includes(customer.phone_number)}
                    onSelect={handleSelectCustomer}
                    onView={handleViewCustomer}
                    onCreateTransaction={(customer) => {
                      handleViewCustomer(customer);
                      handleNewTransaction();
                    }}
                    onViewTransactions={(customer) => {
                      handleViewCustomer(customer);
                      setTimeout(() => setActiveTab('transactions'), 100);
                    }}
                    onManageEligibility={(customer) => {
                      handleViewCustomer(customer);
                      setTimeout(() => setActiveTab('overview'), 100);
                    }}
                    onBellClick={handleBellClick}
                    onSetCustomLimit={handleSetCustomLimit}
                    maxActiveLoans={maxActiveLoans}
                    customerTransactions={customerTransactionsMap[customer.phone_number] || []}
                    calculateLastActivity={calculateLastActivityFromTransactions}
                  />
                ))}
              </>
            )}
          </div>
        ) : customerViewMode === 'list' ? (
          /* Desktop Table View */
          <Card className="shadow-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 relative overflow-hidden">
            {/* Gold accent line matching login page */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600"></div>
            
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 dark:border-slate-700 hover:bg-transparent">
                  <TableHead className="w-[60px] pt-6">
                    <Checkbox
                      checked={currentCustomers.length > 0 && selectedCustomerIds.length === currentCustomers.length}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all customers"
                      className="border-slate-300 dark:border-slate-600"
                    />
                  </TableHead>
                  <TableHead className="w-[240px] pt-6">
                    <button 
                      className="flex items-center gap-2 hover:text-amber-600 dark:hover:text-amber-400 transition-colors font-medium"
                      onClick={() => handleSort('customer')}
                    >
                      <User className="h-3.5 w-3.5" />
                      Customer {getSortIcon('customer')}
                    </button>
                  </TableHead>
                  <TableHead className="w-[200px] pt-6">
                    <div className="flex items-center justify-between">
                      <button 
                        className="flex items-center gap-2 hover:text-amber-600 dark:hover:text-amber-400 transition-colors font-medium"
                        onClick={() => handleSort('loan_activity')}
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Credit & Slots {getSortIcon('loan_activity')}
                      </button>
                      <button
                        onClick={refreshCreditSlotsData}
                        disabled={loadingCustomerActivities}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                        title="Refresh Credit & Slots data"
                      >
                        {loadingCustomerActivities ? (
                          <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                        ) : (
                          <RefreshCw className="h-3 w-3 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400" />
                        )}
                      </button>
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px] pt-6">
                    <button 
                      className="flex items-center gap-2 hover:text-amber-600 dark:hover:text-amber-400 transition-colors font-medium"
                      onClick={() => handleSort('status')}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      Status {getSortIcon('status')}
                    </button>
                  </TableHead>
                  <TableHead className="w-[180px] pt-6">
                    <button 
                      className="flex items-center gap-2 hover:text-amber-600 dark:hover:text-amber-400 transition-colors font-medium"
                      onClick={() => handleSort('contact')}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Contact {getSortIcon('contact')}
                    </button>
                  </TableHead>
                  <TableHead className="w-[140px] pt-6">
                    <button 
                      className="flex items-center gap-2 hover:text-amber-600 dark:hover:text-amber-400 transition-colors font-medium"
                      onClick={() => handleSort('last_visit')}
                      title="Sort by last customer activity"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      Last Visit {getSortIcon('last_visit')}
                    </button>
                  </TableHead>
                  <TableHead className="w-[120px] text-right pt-6 font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Settings className="h-3.5 w-3.5" />
                      Actions
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {customerListLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center border-none">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Loading customers...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : customerListError ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center border-none">
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
                          onClick={() => loadCustomerList(currentPage, getCurrentSearchTerm(), statusFilter, alertFilter, vipFilter, followUpFilter)}
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
                  <TableCell colSpan={7} className="h-32 text-center border-none">
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
                    className="group hover:bg-transparent"
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
                    
                    <TableCell>
                      <div className="space-y-2">
                        {(() => {
                          // Calculate from real-time transaction data (same logic as card view)
                          const customerTransactions = customerTransactionsMap[customer.phone_number] || [];

                          // Filter transactions that use credit/slots
                          const slotUsingTransactions = customerTransactions.filter(t =>
                            t.status === 'active' || t.status === 'overdue' || t.status === 'extended' ||
                            t.status === 'hold' || t.status === 'damaged'
                          );

                          // Calculate used credit from transactions
                          const usedCreditFromTransactions = slotUsingTransactions.reduce((total, t) =>
                            total + (t.loan_amount || 0), 0
                          );

                          // Calculate active loans count from transactions
                          const slotsUsedFromTransactions = slotUsingTransactions.length;

                          // Use calculated values if transaction data available, otherwise fall back to backend
                          const hasTransactionData = customerTransactions.length > 0;
                          const displayUsedCredit = hasTransactionData ? usedCreditFromTransactions : (customer.total_loan_value || 0);
                          const displayActiveLoans = hasTransactionData ? slotsUsedFromTransactions : (customer.active_loans || 0);

                          // Get loan limits - use custom limit if set, otherwise system default
                          const effectiveMaxLoans = customer.custom_loan_limit || maxActiveLoans;
                          
                          // Format credit values
                          const creditLimit = customer.credit_limit || 3000;
                          
                          if (loadingCustomerActivities) {
                            return (
                              <div className="space-y-3 animate-pulse">
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 opacity-50" />
                                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Credit</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
                                      <span className="text-xs text-slate-400">Updating...</span>
                                    </div>
                                  </div>
                                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                    <div className="h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 w-1/3"></div>
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 opacity-50" />
                                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Slots</span>
                                    </div>
                                    <span className="text-xs text-slate-400">...</span>
                                  </div>
                                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                    <div className="h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 w-1/2"></div>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          
                          const creditPercentage = Math.min((displayUsedCredit / creditLimit) * 100, 100);
                          const slotPercentage = Math.min((displayActiveLoans / effectiveMaxLoans) * 100, 100);
                          
                          return (
                            <div className="space-y-3">
                              {/* Credit Usage */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Credit</span>
                                  </div>
                                  <span className={`text-xs font-semibold ${
                                    creditPercentage >= 100 ? 'text-red-600 dark:text-red-400' :
                                    creditPercentage >= 80 ? 'text-amber-600 dark:text-amber-400' :
                                    'text-slate-700 dark:text-slate-300'
                                  }`}>
                                    {formatCurrency(displayUsedCredit)}/{formatCurrency(creditLimit)}
                                  </span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 shadow-inner">
                                  <div 
                                    className={`h-1.5 rounded-full transition-all duration-300 shadow-sm ${
                                      creditPercentage >= 100 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                                      creditPercentage >= 80 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                                      'bg-gradient-to-r from-emerald-500 to-emerald-600'
                                    }`}
                                    style={{ width: `${creditPercentage}%` }}
                                  />
                                </div>
                              </div>

                              {/* Slot Usage */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Slots</span>
                                  </div>
                                  <span className={`text-xs font-semibold ${
                                    slotPercentage >= 100 ? 'text-red-600 dark:text-red-400' :
                                    slotPercentage >= 80 ? 'text-amber-600 dark:text-amber-400' :
                                    'text-slate-700 dark:text-slate-300'
                                  }`}>
                                    {displayActiveLoans}/{effectiveMaxLoans}
                                  </span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 shadow-inner">
                                  <div 
                                    className={`h-1.5 rounded-full transition-all duration-300 shadow-sm ${
                                      slotPercentage >= 100 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                                      slotPercentage >= 80 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                                      'bg-gradient-to-r from-blue-500 to-blue-600'
                                    }`}
                                    style={{ width: `${slotPercentage}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </TableCell>
                    
                    <TableCell 
                      className="cursor-pointer"
                      onClick={() => handleViewCustomer(customer)}
                    >
                      <div className="flex items-center space-x-2">
                        <CustomerStatusBadge status={customer.status} />
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
                    
                    <TableCell className="text-muted-foreground">
                      <div title="Most recent transaction activity (loans, payments, extensions, status changes)">
                        {(() => {
                          // Calculate last activity from transaction data if available
                          const customerTransactions = customerTransactionsMap[customer.phone_number];
                          const calculatedLastActivity = calculateLastActivityFromTransactions(customerTransactions);
                          
                          // Use calculated activity if available, otherwise fall back to last_transaction_date
                          const lastActivity = calculatedLastActivity || customer.last_transaction_date;
                          
                          if (loadingCustomerActivities && !calculatedLastActivity) {
                            return (
                              <div className="flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                                <span className="text-slate-400 dark:text-slate-500 text-xs">Loading...</span>
                              </div>
                            );
                          }
                          
                          if (lastActivity) {
                            return (
                              <>
                                <p className="text-sm">{formatDate(lastActivity)}</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500">{getRelativeTime(lastActivity)}</p>
                              </>
                            );
                          }
                          
                          return (
                            <p className="text-xs text-slate-400 dark:text-slate-500 italic">No activity</p>
                          );
                        })()}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 rounded-lg hover:bg-cyan-50 dark:hover:bg-cyan-950/20 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewCustomer(customer);
                            handleNewTransaction();
                          }}
                          title="Create Transaction"
                        >
                          <FilePlus className="h-4 w-4" />
                        </Button>
                        <AlertBellAction
                          customerPhone={customer.phone_number}
                          onBellClick={handleBellClick}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewCustomer(customer);
                            // Ensure Overview tab is selected
                            setTimeout(() => setActiveTab('overview'), 100);
                          }}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
                              onClick={(e) => e.stopPropagation()}
                              title="More Actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              handleViewCustomer(customer);
                              handleNewTransaction();
                            }}>
                              <FilePlus className="h-4 w-4 mr-2" />
                              Create Transaction
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBellClick(customer.phone_number)}>
                              <Bell className="h-4 w-4 mr-2" />
                              Service Alerts
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              handleViewCustomer(customer);
                              // Ensure Overview tab is selected
                              setTimeout(() => setActiveTab('overview'), 100);
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
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
                            {isAdmin && (
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

            {/* Results Summary and Pagination */}
            {totalCustomers > 0 && (
              <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4">
                <UnifiedPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={customersPerPage}
                  totalItems={totalCustomers}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(value) => handlePageSizeChange(value.toString())}
                  pageSizeOptions={[5, 10, 20, 50, 100]}
                  theme={{ primary: 'cyan' }}
                  itemLabel="customers"
                />
              </div>
            )}
          </Card>
        ) : null}

        {/* Pagination for Card View */}
        {customerViewMode === 'card' && !customerListLoading && totalCustomers > 0 && (
          <div className="mt-4">
            <UnifiedPagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={customersPerPage}
              totalItems={totalCustomers}
              onPageChange={setCurrentPage}
              onPageSizeChange={(value) => handlePageSizeChange(value.toString())}
              pageSizeOptions={[5, 10, 20, 50, 100]}
              theme={{ primary: 'cyan' }}
              itemLabel="customers"
            />
          </div>
        )}

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
                    <CustomerStatusBadge status={selectedCustomer.status} className="shadow-sm" />
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
                        ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-lg shadow-cyan-500/25' 
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
                  {/* Transaction Metrics Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Active Transactions */}
                    <Card className="border-0 shadow-md bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/50 dark:to-blue-950/50 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/10 rounded-full -mr-8 -mt-8"></div>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400 uppercase tracking-wide mb-1">Active</p>
                            <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100 leading-none">
                              {overviewLoading ? '...' : formatCount(overviewTransactions.filter(t => t.status === 'active').length)}
                            </p>
                          </div>
                          <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center ml-2 flex-shrink-0">
                            <CreditCard className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Overdue Transactions */}
                    <Card className="border-0 shadow-md bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/50 dark:to-rose-950/50 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-pink-500/10 rounded-full -mr-8 -mt-8"></div>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-pink-600 dark:text-pink-400 uppercase tracking-wide mb-1">Overdue</p>
                            <p className="text-2xl font-bold text-pink-900 dark:text-pink-100 leading-none">
                              {overviewLoading ? '...' : formatCount(overviewTransactions.filter(t => t.status === 'overdue').length)}
                            </p>
                          </div>
                          <div className="w-8 h-8 bg-pink-500/20 rounded-lg flex items-center justify-center ml-2 flex-shrink-0">
                            <AlertTriangle className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Maturity This Week */}
                    <Card className="border-0 shadow-md bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/50 dark:to-red-950/50 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 rounded-full -mr-8 -mt-8"></div>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-1">Maturity</p>
                            <p className="text-2xl font-bold text-orange-900 dark:text-orange-100 leading-none">
                              {overviewLoading ? '...' : (() => {
                                const now = new Date();
                                const oneWeekFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
                                const count = overviewTransactions.filter(t => {
                                  if (!t.maturity_date) return false;
                                  const maturityDate = new Date(t.maturity_date);
                                  return maturityDate >= now && maturityDate <= oneWeekFromNow && ['active', 'overdue'].includes(t.status);
                                }).length;
                                return formatCount(count);
                              })()}
                            </p>
                          </div>
                          <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center ml-2 flex-shrink-0">
                            <Calendar className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Overall Transactions */}
                    <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950/50 dark:to-slate-900/50 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-slate-500/10 rounded-full -mr-8 -mt-8"></div>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wide mb-1">
                              Overall
                            </p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">
                              {overviewLoading ? '...' : formatCount(overviewTransactions.length)}
                            </p>
                          </div>
                          <div className="w-8 h-8 bg-slate-800/20 dark:bg-slate-200/20 rounded-lg flex items-center justify-center ml-2 flex-shrink-0">
                            <Archive className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Contact Information Card */}
                  <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50/80 to-gray-50/80 dark:from-slate-900/80 dark:to-slate-800/80 backdrop-blur-sm">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Contact Information Group */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                              <MessageCircle className="w-5 h-5 text-white" />
                            </div>
                            Contact Information
                          </h3>
                          
                          {/* Phone */}
                          <div className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                              <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Phone Number</div>
                              <div className="font-mono font-medium text-slate-900 dark:text-slate-100 text-sm">
                                {customerService.formatPhoneNumber(selectedCustomer.phone_number)}
                              </div>
                            </div>
                          </div>

                          {/* Email */}
                          <div className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-colors">
                            <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50 transition-colors">
                              <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Email Address</div>
                              <div className="font-medium text-slate-900 dark:text-slate-100 text-sm break-all">
                                {selectedCustomer.email || 'Not provided'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Account Information Group */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                              <User className="w-5 h-5 text-white" />
                            </div>
                            Account Information
                          </h3>
                          
                          {/* Member Since */}
                          <div className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition-colors">
                            <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors">
                              <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="flex-1">
                              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Member Since</div>
                              <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                                {formatDate(selectedCustomer.created_at)}
                              </div>
                            </div>
                          </div>

                          {/* Last Activity */}
                          <div className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors" title="Most recent transaction activity (loans, payments, extensions, status changes)">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                              <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1">
                              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Last Activity</div>
                              <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                                {(() => {
                                  const lastActivityDate = getLastActivityDate();
                                  return lastActivityDate ? formatDate(lastActivityDate) : 'No transactions yet';
                                })()}
                              </div>
                              <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                Loans, payments, extensions
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Loan Eligibility Section */}
                  <LoanEligibilityManager 
                    customer={selectedCustomer}
                    onEligibilityUpdate={async (eligibility) => {
                      // Customer data is already updated via dialog callbacks and real-time events
                      // No need to manually refresh here to avoid race conditions
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
                <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl flex items-center justify-center">
                          <Settings className="w-5 h-5 text-white" />
                        </div>
                        Admin Controls
                      </CardTitle>
                      <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                        Administrative Actions
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Customer Management Section */}
                    <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-950/50 dark:to-indigo-950/50 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full -mr-8 -mt-8"></div>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                            <UserCog className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Customer Management</h3>
                        </div>
                        
                        <Button 
                          variant="outline" 
                          className="justify-start h-auto py-4 px-4 w-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border-blue-200 dark:border-blue-700 bg-white/50 dark:bg-slate-800/50"
                          onClick={() => {
                            setEditingCustomer(selectedCustomer);
                            setShowAddDialog(true);
                          }}
                        >
                          <Edit2 className="w-4 h-4 mr-3 shrink-0 text-blue-600 dark:text-blue-400" />
                          <div className="text-left min-w-0 flex-1">
                            <p className="font-medium text-blue-900 dark:text-blue-100">Edit Customer Details</p>
                            <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">Modify personal information and contact details</p>
                          </div>
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Account Status Section */}
                    <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-amber-950/50 dark:to-orange-950/50 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full -mr-8 -mt-8"></div>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                            <UserCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">Account Status</h3>
                        </div>
                        
                        <div className="space-y-3">
                          <Button 
                            variant="outline" 
                            className="justify-start h-auto py-4 px-4 w-full hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors border-amber-200 dark:border-amber-700 bg-white/50 dark:bg-slate-800/50"
                            onClick={() => setShowSuspendDialog(true)}
                          >
                            <Lock className="w-4 h-4 mr-3 shrink-0 text-amber-600 dark:text-amber-400" />
                            <div className="text-left min-w-0 flex-1">
                              <p className="font-medium text-amber-900 dark:text-amber-100">Suspend Customer</p>
                              <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">Temporarily restrict account access (reversible)</p>
                            </div>
                          </Button>
                          
                          {selectedCustomer?.status === 'suspended' && (
                            <Button 
                              variant="outline" 
                              className="justify-start h-auto py-4 px-4 w-full hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors border-emerald-200 dark:border-emerald-700 bg-white/50 dark:bg-slate-800/50"
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
                              <CheckCircle className="w-4 h-4 mr-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                              <div className="text-left min-w-0 flex-1">
                                <p className="font-medium text-emerald-900 dark:text-emerald-100">Reactivate Customer</p>
                                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">Remove suspension and restore full access</p>
                              </div>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Dangerous Actions Section */}
                    <Card className="border-0 shadow-md bg-gradient-to-br from-red-50/80 to-rose-50/80 dark:from-red-950/50 dark:to-rose-950/50 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-full -mr-8 -mt-8"></div>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">Dangerous Actions</h3>
                        </div>
                        
                        <div className="p-3 bg-red-100/50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 mb-4">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-red-700 dark:text-red-300">
                              These actions have permanent consequences. Use with extreme caution and ensure proper authorization.
                            </p>
                          </div>
                        </div>
                        
                        <Button 
                          variant="destructive" 
                          className="justify-start h-auto py-4 px-4 w-full bg-white/50 hover:bg-red-100 dark:bg-slate-800/50 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700"
                          onClick={() => setShowArchiveDialog(true)}
                        >
                          <Archive className="w-4 h-4 mr-3 shrink-0" />
                          <div className="text-left min-w-0 flex-1">
                            <p className="font-medium text-red-900 dark:text-red-100">Archive Customer</p>
                            <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">Permanently move to archived records (cannot be undone)</p>
                          </div>
                        </Button>
                      </CardContent>
                    </Card>

                    {/* System Information Section */}
                    <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50/80 to-gray-50/80 dark:from-slate-900/80 dark:to-slate-800/80 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-slate-500/10 rounded-full -mr-8 -mt-8"></div>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-slate-500/20 rounded-lg flex items-center justify-center">
                            <Info className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">System Information</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Customer ID</p>
                            <p className="font-mono text-sm text-slate-900 dark:text-slate-100">{selectedCustomer?.phone_number}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Account Status</p>
                            <p className="text-sm font-semibold capitalize text-slate-900 dark:text-slate-100">{selectedCustomer?.status}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Created Date</p>
                            <p className="text-sm text-slate-900 dark:text-slate-100">
                              {selectedCustomer?.created_at ? formatBusinessDate(selectedCustomer.created_at) : 'N/A'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Last Updated</p>
                            <p className="text-sm text-slate-900 dark:text-slate-100">
                              {selectedCustomer?.updated_at ? formatBusinessDate(selectedCustomer.updated_at) : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Security Notice */}
                    <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50/80 to-cyan-50/80 dark:from-blue-950/50 dark:to-cyan-950/50 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full -mr-8 -mt-8"></div>
                      <CardContent className="p-6">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                              🔒 Security Notice
                            </h3>
                            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                              All administrative actions are logged with your user ID and timestamp for audit compliance. 
                              Customer data modifications are subject to regulatory oversight and data protection policies.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          </div>
        </div>
        </SheetContent>
      </Sheet>

      {/* Suspend Customer Confirmation Dialog */}
      <Dialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-lg">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              Suspend Customer Account
            </DialogTitle>
            <DialogDescription>
              Temporarily restrict account access and transaction privileges
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-foreground mb-3">
                <span className="font-medium">
                  {selectedCustomer?.first_name} {selectedCustomer?.last_name}
                </span> will be temporarily suspended from the system.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Account access will be restricted</li>
                <li>• New pawn transactions will be prevented</li>
                <li>• Existing active loans remain unaffected</li>
                <li>• Suspension can be reversed by administrators</li>
              </ul>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">Security Notice</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    This action will be logged with your admin ID and timestamp for audit compliance.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setShowSuspendDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSuspendCustomer}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Lock className="w-4 h-4 mr-2" />
              Suspend Customer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Customer Confirmation Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-lg">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                <Archive className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              Archive Customer Account
            </DialogTitle>
            <DialogDescription>
              Permanently move customer to archived records
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-foreground mb-3">
                <span className="font-medium">
                  {selectedCustomer?.first_name} {selectedCustomer?.last_name}
                </span> will be permanently archived from the system.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Customer account will be moved to archived records</li>
                <li>• All transaction history will be preserved</li>
                <li>• Customer will no longer appear in active listings</li>
                <li className="text-red-600 dark:text-red-400 font-medium">• This action cannot be undone</li>
              </ul>
            </div>

            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg border-2 border-red-300 dark:border-red-700">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-red-900 dark:text-red-100 mb-1">⚠️ Permanent Action Warning</p>
                  <p className="text-xs text-red-700 dark:text-red-300">
                    This action cannot be reversed. All audit logs will be maintained for compliance.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <p className="text-sm font-medium text-red-900 dark:text-red-100">
                  Confirmation Required
                </p>
              </div>
              <div>
                <Label htmlFor="archiveConfirmation" className="text-sm text-muted-foreground">
                  Type <strong className="text-foreground">"ARCHIVE"</strong> to confirm this permanent action:
                </Label>
                <Input
                  id="archiveConfirmation"
                  type="text"
                  value={archiveConfirmation}
                  onChange={(e) => setArchiveConfirmation(e.target.value)}
                  placeholder="Type ARCHIVE to confirm"
                  className="mt-2 border-red-300 dark:border-red-700 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-500/20"
                />
                {archiveConfirmation && archiveConfirmation !== 'ARCHIVE' && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Please type "ARCHIVE" exactly as shown
                  </p>
                )}
              </div>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">Security Notice</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Archive action will be logged with admin credentials for audit compliance.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setShowArchiveDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleArchiveCustomer}
              disabled={archiveConfirmation !== 'ARCHIVE'}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 disabled:bg-slate-400 dark:disabled:bg-slate-600"
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive Customer
            </Button>
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