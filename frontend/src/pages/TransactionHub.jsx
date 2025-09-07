import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  CreditCard, 
  DollarSign, 
  Clock, 
  Plus,
  Activity,
  AlertTriangle,
  CheckCircle,
  Crown,
  UserCheck,
  FileText,
  LogOut,
  Calendar,
  Package,
  Phone,
  BarChart3,
  Mail,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { handleError, handleSuccess } from '../utils/errorHandling';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { ThemeToggle } from '../components/ui/theme-toggle';
import TransactionList from '../components/transaction/TransactionList';
import CreatePawnDialogRedesigned from '../components/transaction/CreatePawnDialogRedesigned';
import PaymentForm from '../components/transaction/components/PaymentForm';
import ExtensionForm from '../components/transaction/components/ExtensionForm';
import StatusUpdateForm from '../components/transaction/components/StatusUpdateForm';
import TransactionNotesDisplay from '../components/transaction/TransactionNotesDisplay';
import { formatTransactionId, formatStorageLocation, formatCurrency } from '../utils/transactionUtils';
import { getRoleTitle, getUserDisplayString } from '../utils/roleUtils';
import { formatRedemptionDate, formatBusinessDate } from '../utils/timezoneUtils';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../components/ui/resizable';
import { ScrollArea } from '../components/ui/scroll-area';
import transactionService from '../services/transactionService';
import extensionService from '../services/extensionService';
import customerService from '../services/customerService';
import authService from '../services/authService';

const TransactionHub = () => {
  const { user, logout, loading, fetchUserDataIfNeeded } = useAuth();
  const navigate = useNavigate();
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedTransactionCustomer, setSelectedTransactionCustomer] = useState(null);
  const [showAllExtensions, setShowAllExtensions] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showExtensionForm, setShowExtensionForm] = useState(false);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [showStatusUpdateForm, setShowStatusUpdateForm] = useState(false);
  const [loadingTransactionDetails, setLoadingTransactionDetails] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Add refresh key for TransactionList
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loadingCustomerDetails, setLoadingCustomerDetails] = useState(false);
  const [customerTransactions, setCustomerTransactions] = useState([]);
  const [showQuickPayment, setShowQuickPayment] = useState(false);
  const [showQuickExtension, setShowQuickExtension] = useState(false);
  
  // Transaction stats state
  const [transactionStats, setTransactionStats] = useState({
    total_active: 0,
    total_overdue: 0,
    new_this_month: 0,
    maturity_this_week: 0,
    cash_collected_today: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch user data if not already loaded
  useEffect(() => {
    if (!user && fetchUserDataIfNeeded) {
      fetchUserDataIfNeeded();
    }
  }, [user, fetchUserDataIfNeeded]); // Only run once on mount

  // Fetch transaction stats
  useEffect(() => {
    const fetchTransactionStats = async () => {
      try {
        setStatsLoading(true);
        const transactions = await transactionService.getAllTransactions();
        const transactionList = transactions.transactions || [];
        
        const currentDate = new Date();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        const startOfDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(startOfDay.getDate() + 1);
        
        const stats = {
          total_active: transactionList.filter(t => t.status === 'active').length,
          total_overdue: transactionList.filter(t => t.status === 'overdue').length,
          new_this_month: transactionList.filter(t => 
            new Date(t.pawn_date || t.created_at) >= startOfMonth
          ).length,
          maturity_this_week: transactionList.filter(t => {
            if (!t.maturity_date) return false;
            const maturityDate = new Date(t.maturity_date);
            return maturityDate >= startOfWeek && maturityDate <= endOfWeek && 
                   ['active', 'overdue', 'extended'].includes(t.status);
          }).length,
          cash_collected_today: 0 // Will be fetched separately from payments API
        };
        
        // Fetch today's cash collections
        try {
          const today = new Date().toISOString().split('T')[0];
          const token = localStorage.getItem('access_token');
          
          if (token) {
            const paymentsResponse = await fetch(`http://localhost:8000/api/v1/payment/?start_date=${today}T00:00:00&end_date=${today}T23:59:59`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (paymentsResponse.ok) {
              const paymentsData = await paymentsResponse.json();
              const todayCash = paymentsData.payments?.reduce((sum, payment) => sum + payment.payment_amount, 0) || 0;
              stats.cash_collected_today = todayCash;
            }
          }
        } catch (cashError) {
          // Failed to fetch cash collections - continue with default value
        }
        
        setTransactionStats(stats);
      } catch (error) {
        // Failed to fetch transaction stats - use default values
        setTransactionStats({
          total_active: 0,
          total_overdue: 0,
          new_this_month: 0,
          maturity_this_week: 0,
          cash_collected_today: 0
        });
      } finally {
        setStatsLoading(false);
      }
    };

    fetchTransactionStats();
  }, [refreshKey]); // Refresh stats when transactions are updated

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Handle creating new transaction
  const handleCreateNew = () => {
    setShowCreateForm(true);
  };

  // Handle successful transaction creation
  const handleTransactionCreated = (newTransaction) => {
    setShowCreateForm(false);
    setRefreshKey(prev => prev + 1); // Trigger immediate TransactionList refresh
    handleSuccess(`Transaction #${formatTransactionId(newTransaction)} created successfully`);
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
        setSelectedTransaction({
          ...fullTransaction,
          extensions: extensionArray,
          hasExtensions: extensionArray.length > 0
        });
      } catch (extensionError) {
        // Failed to load extensions - continue without them
        // Continue with transaction data even if extensions fail
        setSelectedTransaction({
          ...fullTransaction,
          extensions: [],
          hasExtensions: false
        });
      }
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
      let page = 1;
      const pageSize = 50;
      
      // Search through all pages until found
      while (true) {
        const response = await transactionService.getAllTransactions({ 
          page: page,
          page_size: pageSize,
          sortBy: 'updated_at',
          sortOrder: 'desc'
        });
        
        const transactions = response.transactions || [];
        
        const transaction = transactions.find(t => formatTransactionId(t) === displayId.toUpperCase());
        
        if (transaction) {
          return transaction;
        }
        
        // Check if we've reached the end
        if (transactions.length < pageSize || !response.has_next) {
          break;
        }
        
        page++;
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      throw new Error(`Transaction ${displayId} not found`);
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
    
    // Clear transaction cache to ensure fresh data
    transactionService.clearTransactionCache();
    
    // If transaction details dialog is open, refresh the transaction data
    if (showTransactionDetails && selectedTransaction) {
      try {
        const transactionId = selectedTransaction.transaction_id || selectedTransaction.transaction?.transaction_id;
        
        // Add cache busting to force fresh data
        const bustCacheUrl = `/api/v1/pawn-transaction/${transactionId}/summary?_t=${Date.now()}`;
        const updatedTransaction = await authService.apiRequest(bustCacheUrl, { method: 'GET' });
        
        // Always fetch extensions separately after payment to ensure they're preserved
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
          console.warn('Could not fetch extensions after payment:', extError);
        }
        
        setSelectedTransaction(updatedTransaction);
      } catch (error) {
        console.error('Failed to refresh transaction after payment:', error);
      }
    } else {
      setSelectedTransaction(null);
    }
    
    // Always refresh the transaction list to show updated balance/status
    setRefreshKey(prev => prev + 1);
    handleSuccess('Payment processed successfully');
  };

  // Handle successful extension
  const handleExtensionSuccess = async (extensionResult) => {
    setShowExtensionForm(false);
    
    // Clear all caches immediately
    transactionService.clearTransactionCache();
    extensionService.clearExtensionCache();
    
    // If transaction details dialog is open, refresh the transaction data
    if (showTransactionDetails && selectedTransaction) {
      try {
        // Fetch updated transaction with new extensions
        const transactionId = selectedTransaction.transaction_id || selectedTransaction.transaction?.transaction_id;
        
        // Add cache busting to force fresh data
        const bustCacheUrl = `/api/v1/pawn-transaction/${transactionId}/summary?_t=${Date.now()}`;
        const updatedTransaction = await authService.apiRequest(bustCacheUrl, { method: 'GET' });
        
        // Also fetch updated extensions
        try {
          const extensions = await extensionService.getExtensionHistory(transactionId, true); // bustCache = true
          
          let extensionArray = [];
          if (Array.isArray(extensions)) {
            extensionArray = extensions;
          } else if (extensions && extensions.extensions) {
            extensionArray = extensions.extensions;
          }
          
          updatedTransaction.extensions = extensionArray;
        } catch (extError) {
          console.warn('Could not fetch extensions:', extError);
        }
        
        setSelectedTransaction(updatedTransaction);
      } catch (error) {
        console.error('Failed to refresh transaction after extension:', error);
      }
    } else {
      setSelectedTransaction(null);
    }
    
    // Always refresh the transaction list to show updated maturity date
    setRefreshKey(prev => prev + 1);
    handleSuccess('Extension processed successfully');
    
    // Immediately recalculate and update transaction stats
    const refreshStats = async () => {
      try {
        setStatsLoading(true);
        const transactions = await transactionService.getAllTransactions();
        const transactionList = transactions.transactions || [];
        
        const currentDate = new Date();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        const stats = {
          total_active: transactionList.filter(t => t.status === 'active').length,
          total_overdue: transactionList.filter(t => t.status === 'overdue').length,
          new_this_month: transactionList.filter(t => 
            new Date(t.pawn_date || t.created_at) >= startOfMonth
          ).length,
          maturity_this_week: transactionList.filter(t => {
            if (!t.maturity_date) return false;
            const maturityDate = new Date(t.maturity_date);
            return maturityDate >= startOfWeek && maturityDate <= endOfWeek && 
                   ['active', 'overdue', 'extended'].includes(t.status);
          }).length,
          cash_collected_today: transactionStats.cash_collected_today // Preserve cash data
        };
        
        setTransactionStats(stats);
      } catch (error) {
        // Stats refresh failed - user will see updated stats on next page refresh
      } finally {
        setStatsLoading(false);
      }
    };
    
    // Execute stats refresh with a small delay to ensure backend consistency
    setTimeout(async () => {
      await refreshStats();
    }, 200);
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

  // Handle successful status update
  const handleStatusUpdateSuccess = async () => {
    setShowStatusUpdateForm(false);
    
    // If transaction details dialog is open, refresh the transaction data
    if (showTransactionDetails && selectedTransaction) {
      try {
        const updatedTransaction = await transactionService.getTransactionSummary(
          selectedTransaction.transaction_id || selectedTransaction.transaction?.transaction_id
        );
        setSelectedTransaction(updatedTransaction);
      } catch (error) {
        console.error('Failed to refresh transaction after status update:', error);
      }
    } else {
      setSelectedTransaction(null);
    }
    
    setRefreshKey(prev => prev + 1); // Trigger immediate TransactionList refresh
    handleSuccess('Transaction status updated successfully');
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
                  <Activity className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
                <div className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 rounded-lg border border-blue-100 dark:border-blue-900/50">
                  <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
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
            <p className="text-details-medium dark:text-slate-400 text-lg">
              Manage pawn transactions, process payments, and track loan extensions
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          {/* Active Transactions */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950/50 dark:to-sky-950/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-cyan-600 dark:text-cyan-400">Active Loans</p>
                  <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">
                    {statsLoading ? '-' : transactionStats.total_active}
                  </p>
                </div>
                <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* New This Month */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">New This Month</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {statsLoading ? '-' : transactionStats.new_this_month}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <Plus className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Overdue Transactions */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/50 dark:to-rose-950/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-pink-500/10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-pink-600 dark:text-pink-400">Overdue Loans</p>
                  <p className="text-2xl font-bold text-pink-900 dark:text-pink-100">
                    {statsLoading ? '-' : transactionStats.total_overdue}
                  </p>
                </div>
                <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-pink-600 dark:text-pink-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Maturity This Week */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Maturity This Week</p>
                  <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                    {statsLoading ? '-' : transactionStats.maturity_this_week}
                  </p>
                </div>
                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cash Collected Today */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/50 dark:to-violet-950/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Today's Collection</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {statsLoading ? '-' : formatCurrency(transactionStats.cash_collected_today)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Transaction Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Quick Actions & Reports Sidebar */}
          <div className="lg:col-span-1 space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
            {/* Quick Actions Card */}
            <Card className="border-0 shadow-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-hidden relative z-10">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 pointer-events-none"></div>
              <CardHeader className="relative pb-3">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900"></div>
                  </div>
                  <div>
                    <CardTitle className="text-white text-lg font-bold">Quick Actions</CardTitle>
                    <p className="text-xs text-slate-400">Frequently used operations</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative space-y-3 pt-2 z-20">
                <Button 
                  onClick={handleCreateNew}
                  className="w-full justify-start h-11 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white border border-slate-600/50 hover:border-slate-500/70 shadow-md hover:shadow-lg transition-all duration-200 group relative z-30" 
                  variant="outline"
                >
                  <div className="w-6 h-6 bg-slate-500/30 rounded-md flex items-center justify-center mr-2 group-hover:bg-slate-400/40 transition-colors">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">New Transaction</span>
                </Button>

                <Button 
                  onClick={() => setShowQuickPayment(true)}
                  className="w-full justify-start h-11 bg-gradient-to-r from-slate-800/50 to-slate-700/50 hover:from-slate-700/60 hover:to-slate-600/60 text-slate-300 border border-slate-600/30 hover:border-slate-500/50 shadow-md hover:shadow-lg transition-all duration-200 group" 
                  variant="outline"
                >
                  <div className="w-6 h-6 bg-slate-600/30 rounded-md flex items-center justify-center mr-2 group-hover:bg-slate-500/40 transition-colors">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">Quick Payment</span>
                </Button>

                <Button 
                  onClick={() => setShowQuickExtension(true)}
                  className="w-full justify-start h-11 bg-gradient-to-r from-slate-800/50 to-slate-700/50 hover:from-slate-700/60 hover:to-slate-600/60 text-slate-300 border border-slate-600/30 hover:border-slate-500/50 shadow-md hover:shadow-lg transition-all duration-200 group" 
                  variant="outline"
                >
                  <div className="w-6 h-6 bg-slate-600/30 rounded-md flex items-center justify-center mr-2 group-hover:bg-slate-500/40 transition-colors">
                    <Clock className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">Quick Extension</span>
                </Button>
                
                <Button 
                  className="w-full justify-start h-11 bg-gradient-to-r from-slate-800/50 to-slate-700/50 hover:from-slate-700/60 hover:to-slate-600/60 text-slate-300 border border-slate-600/30 hover:border-slate-500/50 shadow-md hover:shadow-lg transition-all duration-200 group" 
                  variant="outline"
                  onClick={() => navigate('/customers')}
                >
                  <div className="w-6 h-6 bg-slate-600/30 rounded-md flex items-center justify-center mr-2 group-hover:bg-slate-500/40 transition-colors">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">Manage Customers</span>
                </Button>
              </CardContent>
            </Card>

            {/* Reports Section */}
            <Card className="border-0 shadow-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-hidden relative z-10">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 pointer-events-none"></div>
              <CardHeader className="relative pb-3">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-orange-500 rounded-full border-2 border-slate-900"></div>
                  </div>
                  <div>
                    <CardTitle className="text-white text-lg font-bold">Reports</CardTitle>
                    <p className="text-xs text-slate-400">Analytics and documentation</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative space-y-3 pt-2 z-20">
                <Button 
                  className="w-full justify-start h-11 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white border border-slate-600/50 hover:border-slate-500/70 shadow-md hover:shadow-lg transition-all duration-200 group" 
                  variant="outline"
                >
                  <div className="w-6 h-6 bg-slate-500/30 rounded-md flex items-center justify-center mr-2 group-hover:bg-slate-400/40 transition-colors">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">Today's Summary</span>
                </Button>

                <Button 
                  className="w-full justify-start h-11 bg-gradient-to-r from-slate-800/50 to-slate-700/50 hover:from-slate-700/60 hover:to-slate-600/60 text-slate-300 border border-slate-600/30 hover:border-slate-500/50 shadow-md hover:shadow-lg transition-all duration-200 group" 
                  variant="outline"
                >
                  <div className="w-6 h-6 bg-slate-600/30 rounded-md flex items-center justify-center mr-2 group-hover:bg-slate-500/40 transition-colors">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">Generate Report</span>
                </Button>
              </CardContent>
            </Card>
            
            {/* Quick Stats Mini Card */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5"></div>
              <CardContent className="relative p-5">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-white" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">Today's Overview</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-400 font-medium">New Loans</span>
                    <span className="text-sm font-bold text-emerald-400">{transactionStats.new_this_month || 0}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-400 font-medium">Collections</span>
                    <span className="text-sm font-bold text-blue-400">${transactionStats.cash_collected_today || 0}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-400 font-medium">Due Soon</span>
                    <span className="text-sm font-bold text-indigo-400">{transactionStats.maturity_this_week || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-0 shadow-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5"></div>
              <CardHeader className="relative pb-6 border-b border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/50">
                      <CreditCard className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-white">All Transactions</CardTitle>
                      <p className="text-sm text-slate-400 mt-1">Search, filter, and manage all pawn transactions</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="hidden sm:flex items-center space-x-2 bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-slate-400">Live Updates</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative bg-slate-950/50 p-0">
                <TransactionList
                  refreshTrigger={refreshKey}
                  onCreateNew={handleCreateNew}
                  onViewTransaction={handleViewTransaction}
                  onViewCustomer={handleViewCustomer}
                  onPayment={handlePayment}
                  onExtension={handleExtension}
                  onStatusUpdate={handleStatusUpdate}
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
          setShowAllExtensions(false); // Reset extension view
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
                    <div className="p-6 h-full bg-slate-50 dark:bg-slate-800/30">
                      <ScrollArea className="h-full">
                        <div className="space-y-4 pr-4">
                          {/* Status Badge */}
                          <div className={`p-3 rounded-lg border-l-4 ${
                            getTransactionStatus() === 'active' 
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500'
                              : getTransactionStatus() === 'overdue'
                              ? 'bg-red-50 dark:bg-red-950/20 border-red-500'
                              : getTransactionStatus() === 'extended'
                              ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-500'
                              : getTransactionStatus() === 'redeemed'
                              ? 'bg-green-50 dark:bg-green-950/20 border-green-500'
                              : 'bg-slate-50 dark:bg-slate-800/20 border-slate-500'
                          }`}>
                            <div className="flex items-center space-x-2">
                              <div className={`w-3 h-3 rounded-full ${
                                getTransactionStatus() === 'active' ? 'bg-emerald-500' :
                                getTransactionStatus() === 'overdue' ? 'bg-red-500' :
                                getTransactionStatus() === 'extended' ? 'bg-blue-500' :
                                getTransactionStatus() === 'redeemed' ? 'bg-green-500' : 'bg-slate-500'
                              }`}></div>
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
                              // Refresh transaction data when notes are updated
                              if (selectedTransaction) {
                                // You might want to refresh the transaction data here
                                // This depends on how your transaction data is managed
                                // Notes updated successfully
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
                    <div className="p-6 h-full bg-slate-50 dark:bg-slate-800/30">
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
                                className="w-full border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/20"
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
                        </div>

                        {/* Timeline Section */}
                        <div className="flex-1 min-h-0 overflow-hidden">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center justify-between">
                            <span>Timeline</span>
                            {(selectedTransaction?.extensions || selectedTransaction?.transaction?.extensions)?.length > 0 && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {(selectedTransaction?.extensions || selectedTransaction?.transaction?.extensions)?.length} extensions
                              </span>
                            )}
                          </div>
                          <ScrollArea className="h-[calc(100%-2rem)]">
                            <div className="space-y-3 pr-4 pb-4">
                              {/* Status indicator - Most Recent */}
                              {getTransactionStatus() !== 'active' && (
                                <div className="flex space-x-3">
                                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                    getTransactionStatus() === 'redeemed' ? 'bg-green-500' :
                                    getTransactionStatus() === 'overdue' ? 'bg-red-500' :
                                    getTransactionStatus() === 'extended' ? 'bg-blue-500' : 'bg-slate-500'
                                  }`}></div>
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
                              
                              {/* Extensions Timeline - Most Recent First */}
                              {(() => {
                                const extensions = selectedTransaction?.extensions || selectedTransaction?.transaction?.extensions || [];
                                const sortedExtensions = [...extensions].sort((a, b) => 
                                  new Date(b.extension_date || b.created_at) - new Date(a.extension_date || a.created_at)
                                );
                                const displayLimit = 5;
                                const hasMany = sortedExtensions.length > displayLimit;
                                const displayExtensions = showAllExtensions ? sortedExtensions : sortedExtensions.slice(0, displayLimit);
                                
                                return (
                                  <>
                                    {displayExtensions.map((extension, index) => (
                                      <div key={index} className="flex space-x-3">
                                        <div className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
                                        <div>
                                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                            {extension.formatted_id ? `${extension.formatted_id} - ` : ''}Extension #{extensions.length - index} ({extension.extension_months}mo)
                                          </div>
                                          <div className="text-xs text-slate-600 dark:text-slate-400">
                                            {(() => {
                                              const extRawDate = extension.extension_date || extension.created_at;
                                              // Use the centralized business timezone utility for consistency
                                              return formatBusinessDate(extRawDate);
                                            })()}
                                          </div>
                                          <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                            Fee: {formatCurrency(
                                              extension.total_extension_fee || 
                                              extension.extension_fee || 
                                              extension.fee || 
                                              (extension.extension_months * (extension.extension_fee_per_month || 0))
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                    
                                    {hasMany && !showAllExtensions && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => setShowAllExtensions(true)}
                                        className="w-full text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                                      >
                                        Show {extensions.length - displayLimit} more extensions
                                      </Button>
                                    )}
                                    
                                    {hasMany && showAllExtensions && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => setShowAllExtensions(false)}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Update Transaction Status</DialogTitle>
            <DialogDescription>
              Change the status of the selected transaction. This action will be recorded in the audit log.
            </DialogDescription>
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
                                  <div className={`w-3 h-3 rounded-full ${
                                    transaction.status === 'active' ? 'bg-emerald-500' :
                                    transaction.status === 'overdue' ? 'bg-red-500' :
                                    transaction.status === 'extended' ? 'bg-blue-500' :
                                    transaction.status === 'redeemed' ? 'bg-green-500' :
                                    transaction.status === 'sold' ? 'bg-purple-500' : 'bg-slate-500'
                                  }`}></div>
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
              Enter the transaction ID to process a payment. Only active, overdue, or extended transactions can accept payments.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="paymentTransactionId">Transaction ID</Label>
              <Input
                id="paymentTransactionId"
                placeholder="Enter transaction ID (e.g., PW000001)"
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
              Enter the transaction ID to extend the loan. Only active, overdue, or extended transactions can be extended.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="extensionTransactionId">Transaction ID</Label>
              <Input
                id="extensionTransactionId"
                placeholder="Enter transaction ID (e.g., PW000001)"
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
    </div>
  );
};

export default TransactionHub;