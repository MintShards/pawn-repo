import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  CreditCard, 
  DollarSign, 
  Clock, 
  TrendingUp, 
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
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { handleError, handleSuccess } from '../utils/errorHandling';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { ThemeToggle } from '../components/ui/theme-toggle';
import TransactionList from '../components/transaction/TransactionList';
import CreatePawnDialogRedesigned from '../components/transaction/CreatePawnDialogRedesigned';
import PaymentForm from '../components/transaction/components/PaymentForm';
import ExtensionForm from '../components/transaction/components/ExtensionForm';
import StatusUpdateForm from '../components/transaction/components/StatusUpdateForm';
import { formatTransactionId, formatExtensionId, formatStorageLocation } from '../utils/transactionUtils';
import { getRoleTitle, getUserDisplayString } from '../utils/roleUtils';
import transactionService from '../services/transactionService';
import extensionService from '../services/extensionService';

const TransactionHub = () => {
  const { user, logout, loading, fetchUserDataIfNeeded } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('list');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showExtensionForm, setShowExtensionForm] = useState(false);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [showStatusUpdateForm, setShowStatusUpdateForm] = useState(false);
  const [loadingTransactionDetails, setLoadingTransactionDetails] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Add refresh key for TransactionList
  
  // Transaction stats state
  const [transactionStats, setTransactionStats] = useState({
    total_active: 0,
    total_overdue: 0,
    total_value: 0,
    recent_payments: 0,
    pending_extensions: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch user data if not already loaded
  useEffect(() => {
    if (!user && fetchUserDataIfNeeded) {
      fetchUserDataIfNeeded();
    }
  }, []); // Only run once on mount

  // Fetch transaction stats
  useEffect(() => {
    const fetchTransactionStats = async () => {
      try {
        setStatsLoading(true);
        const transactions = await transactionService.getAllTransactions();
        const transactionList = transactions.transactions || [];
        
        const stats = {
          total_active: transactionList.filter(t => t.status === 'active').length,
          total_overdue: transactionList.filter(t => t.status === 'overdue').length,
          total_value: transactionList
            .filter(t => ['active', 'overdue', 'extended'].includes(t.status))
            .reduce((sum, t) => sum + (t.loan_amount || 0), 0),
          recent_payments: transactionList.filter(t => 
            t.payments && t.payments.length > 0 && 
            new Date(t.payments[t.payments.length - 1].payment_date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          ).length,
          pending_extensions: transactionList.filter(t => 
            t.status === 'overdue' && !t.extensions?.length
          ).length
        };
        
        setTransactionStats(stats);
      } catch (error) {
        console.error('Failed to fetch transaction stats:', error);
        setTransactionStats({
          total_active: 0,
          total_overdue: 0,
          total_value: 0,
          recent_payments: 0,
          pending_extensions: 0
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
    setActiveTab('list'); // Switch back to list to see new transaction
    setRefreshKey(prev => prev + 1); // Trigger TransactionList refresh
    handleSuccess(`Transaction #${formatTransactionId(newTransaction)} created successfully`);
  };

  // Handle viewing transaction details
  const handleViewTransaction = async (transaction) => {
    setLoadingTransactionDetails(true);
    setShowTransactionDetails(true);
    setSelectedTransaction(transaction); // Show basic info immediately
    
    try {
      // Fetch comprehensive transaction summary with items and balance
      const fullTransaction = await transactionService.getTransactionSummary(transaction.transaction_id);
      
      // Fetch extensions separately
      try {
        const extensions = await extensionService.getExtensionHistory(transaction.transaction_id);
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
        console.error('Failed to load extensions:', extensionError);
        // Continue with transaction data even if extensions fail
        setSelectedTransaction({
          ...fullTransaction,
          extensions: [],
          hasExtensions: false
        });
      }
    } catch (error) {
      console.error('Failed to load transaction details:', error);
      // If summary fails, try to get basic transaction data
      try {
        const basicTransaction = await transactionService.getTransactionById(transaction.transaction_id);
        setSelectedTransaction(basicTransaction);
      } catch (fallbackError) {
        console.error('Failed to load basic transaction data:', fallbackError);
        // Keep the original transaction data as fallback
        handleError(fallbackError, 'Loading transaction details');
      }
    } finally {
      setLoadingTransactionDetails(false);
    }
  };

  // Handle payment processing
  const handlePayment = (transaction) => {
    setSelectedTransaction(transaction);
    setShowPaymentForm(true);
  };

  // Handle successful payment
  const handlePaymentSuccess = (paymentResult) => {
    setShowPaymentForm(false);
    setSelectedTransaction(null);
    setRefreshKey(prev => prev + 1); // Trigger TransactionList refresh
    // Success message handled by PaymentForm component
  };

  // Handle successful extension
  const handleExtensionSuccess = (extensionResult) => {
    setShowExtensionForm(false);
    setSelectedTransaction(null);
    setRefreshKey(prev => prev + 1); // Trigger TransactionList refresh
    // Success message handled by ExtensionForm component
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
  const handleStatusUpdateSuccess = () => {
    setShowStatusUpdateForm(false);
    setSelectedTransaction(null);
    setRefreshKey(prev => prev + 1); // Trigger TransactionList refresh
    handleSuccess('Transaction status updated successfully');
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Not Set';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
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
                  <CheckCircle className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
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

          {/* Total Value */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">Total Value</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {statsLoading ? '-' : `$${transactionStats.total_value.toLocaleString()}`}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Payments */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/50 dark:to-cyan-950/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-teal-500/10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-teal-600 dark:text-teal-400">This Week</p>
                  <p className="text-2xl font-bold text-teal-900 dark:text-teal-100">
                    {statsLoading ? '-' : transactionStats.recent_payments}
                  </p>
                </div>
                <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Extensions */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-950/50 dark:to-gray-950/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-slate-500/10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-details-medium dark:text-slate-400">Need Extensions</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {statsLoading ? '-' : transactionStats.pending_extensions}
                  </p>
                </div>
                <div className="w-12 h-12 bg-slate-500/20 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-details-medium dark:text-slate-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Transaction Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Quick Actions Sidebar */}
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm lg:col-span-1">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-slate-900 dark:text-slate-100 text-lg">Quick Actions</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={handleCreateNew}
                className="w-full justify-start bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/50 dark:hover:to-teal-900/50" 
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Transaction
              </Button>
              <Button 
                onClick={() => {
                  if (transactionStats.total_overdue > 0) {
                    setActiveTab('list');
                  }
                }}
                className="w-full justify-start bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 hover:from-red-100 hover:to-rose-100 dark:hover:from-red-900/50 dark:hover:to-rose-900/50" 
                variant="outline"
                disabled={transactionStats.total_overdue === 0}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Review Overdue ({transactionStats.total_overdue})
              </Button>
              <Button 
                className="w-full justify-start bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50" 
                variant="outline"
                onClick={() => navigate('/customers')}
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Manage Customers
              </Button>
              <Button 
                className="w-full justify-start bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 hover:from-violet-100 hover:to-purple-100 dark:hover:from-violet-900/50 dark:hover:to-purple-900/50" 
                variant="outline"
              >
                <FileText className="w-4 h-4 mr-2" />
                Generate Report
              </Button>
            </CardContent>
          </Card>

          {/* Main Content Area */}
          <div className="lg:col-span-4 space-y-6">
            {activeTab === 'list' && (
              <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-slate-900 dark:text-slate-100">All Transactions</CardTitle>
                      <p className="text-sm text-details-medium dark:text-slate-400">Search, filter, and manage all pawn transactions</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <TransactionList
                    refreshTrigger={refreshKey}
                    onCreateNew={handleCreateNew}
                    onViewTransaction={handleViewTransaction}
                    onPayment={handlePayment}
                    onExtension={handleExtension}
                    onStatusUpdate={handleStatusUpdate}
                  />
                </CardContent>
              </Card>
            )}

            {activeTab === 'create' && (
              <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                        <Plus className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-slate-900 dark:text-slate-100">Create New Transaction</CardTitle>
                        <p className="text-sm text-details-medium dark:text-slate-400">Enter loan details and customer information</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      onClick={() => setActiveTab('list')}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      ← Back to List
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <CreatePawnDialogRedesigned
                    onSuccess={handleTransactionCreated}
                    onCancel={() => setActiveTab('list')}
                  />
                </CardContent>
              </Card>
            )}
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
            <DialogTitle>Process Payment</DialogTitle>
            <DialogDescription>Process payment for selected transaction</DialogDescription>
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
            <DialogDescription>Extend loan period for selected transaction</DialogDescription>
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

      {/* Enhanced Transaction Details Dialog */}
      <Dialog open={showTransactionDetails} onOpenChange={setShowTransactionDetails}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-details-light dark:bg-details-dark backdrop-blur-xl border border-details-medium/20 dark:border-details-medium/40">
          <DialogHeader className="pb-6 border-b border-details-medium/20 dark:border-details-medium/40">
            <DialogTitle className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-details-accent rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-details-dark dark:text-details-secondary">
                  Transaction #{selectedTransaction ? formatTransactionId(selectedTransaction.transaction || selectedTransaction) : 'Loading...'}
                </div>
                <div className="text-sm text-details-medium dark:text-slate-400">
                  {loadingTransactionDetails ? 'Loading transaction details...' : 'Complete transaction overview and history'}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-6">
              {/* Loading State */}
              {loadingTransactionDetails && (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-details-accent"></div>
                    <span className="text-details-medium dark:text-slate-400">Loading transaction details...</span>
                  </div>
                </div>
              )}
              
              {!loadingTransactionDetails && (
                <>
                  {/* Status Banner */}
                  <div className={`p-4 rounded-xl border-l-4 shadow-sm ${
                    (selectedTransaction?.transaction?.status || selectedTransaction?.status) === 'active' 
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 dark:border-emerald-400' 
                      : (selectedTransaction?.transaction?.status || selectedTransaction?.status) === 'overdue'
                      ? 'bg-red-50 dark:bg-red-950/20 border-red-500 dark:border-red-400'
                      : (selectedTransaction?.transaction?.status || selectedTransaction?.status) === 'extended'
                      ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-500 dark:border-blue-400'
                      : (selectedTransaction?.transaction?.status || selectedTransaction?.status) === 'redeemed'
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-500 dark:border-green-400'
                      : 'bg-slate-50 dark:bg-slate-800/20 border-slate-500 dark:border-slate-400'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-4 h-4 rounded-full ${
                          (selectedTransaction?.transaction?.status || selectedTransaction?.status) === 'active' ? 'bg-emerald-500' :
                          (selectedTransaction?.transaction?.status || selectedTransaction?.status) === 'overdue' ? 'bg-red-500' :
                          (selectedTransaction?.transaction?.status || selectedTransaction?.status) === 'extended' ? 'bg-blue-500' :
                          (selectedTransaction?.transaction?.status || selectedTransaction?.status) === 'redeemed' ? 'bg-green-500' : 'bg-slate-500'
                        }`}></div>
                        <span className="font-bold text-xl capitalize">
                          {(selectedTransaction?.transaction?.status || selectedTransaction?.status) || 'Unknown Status'}
                        </span>
                        {(selectedTransaction?.transaction?.status || selectedTransaction?.status) === 'overdue' && (
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                        )}
                        {(selectedTransaction?.transaction?.status || selectedTransaction?.status) === 'redeemed' && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                      <div className="text-sm text-details-medium dark:text-slate-400">
                        Last updated: {(selectedTransaction?.transaction?.updated_at || selectedTransaction?.updated_at) ? 
                          formatDate(selectedTransaction.transaction?.updated_at || selectedTransaction.updated_at) : 'Not Available'}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Key Metrics Cards */}
              {!loadingTransactionDetails && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-details-medium/20 dark:border-details-medium/40 shadow-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-details-accent/10 dark:bg-details-accent/20 rounded-lg flex items-center justify-center">
                          <Phone className="w-5 h-5 text-details-accent" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-details-medium dark:text-slate-400">Customer</div>
                          <div className="font-bold text-xl text-details-dark dark:text-details-secondary">
                            {(selectedTransaction?.transaction?.customer_phone || selectedTransaction?.customer_phone) ||
                             (selectedTransaction?.transaction?.customer_name || selectedTransaction?.customer_name) ||
                             (selectedTransaction?.transaction?.customer_id || selectedTransaction?.customer_id) || 'No Customer'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-details-medium/20 dark:border-details-medium/40 shadow-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-details-accent/10 dark:bg-details-accent/20 rounded-lg flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-details-accent" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-details-medium dark:text-slate-400">Loan Amount</div>
                          <div className="font-bold text-xl text-details-dark dark:text-details-secondary">
                            {(selectedTransaction?.transaction?.loan_amount || selectedTransaction?.loan_amount) 
                              ? formatCurrency(selectedTransaction.transaction?.loan_amount || selectedTransaction.loan_amount) 
                              : 'Not Set'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-details-medium/20 dark:border-details-medium/40 shadow-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-details-accent/10 dark:bg-details-accent/20 rounded-lg flex items-center justify-center">
                          <Clock className="w-5 h-5 text-details-accent" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-details-medium dark:text-slate-400">Pawn Date</div>
                          <div className="font-bold text-details-dark dark:text-details-secondary">
                            {formatDate(selectedTransaction?.transaction?.pawn_date || selectedTransaction?.pawn_date)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Redesigned Layout - Emphasis on Pawn Items */}
              {!loadingTransactionDetails && (
                <div className="space-y-8">
                  {/* Main Content Area */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Financial & Extensions */}
                    <div className="space-y-3">
                      {/* Financial Details - Ultra Compact */}
                      <Card className="bg-details-light dark:bg-details-medium/20 backdrop-blur-sm shadow-lg border border-details-medium/20 dark:border-details-medium/40">
                        <CardHeader className="pb-1 pt-3">
                          <CardTitle className="flex items-center space-x-1.5 text-sm font-semibold text-details-dark dark:text-details-secondary">
                            <DollarSign className="w-3.5 h-3.5 text-details-accent" />
                            <span>Financial</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-2 space-y-2">
                          <div className="p-2 bg-details-accent/10 dark:bg-details-accent/20 rounded border border-details-accent/20 dark:border-details-accent/40">
                            <div className="text-xs text-details-accent font-medium">Monthly Interest</div>
                            <div className="font-bold text-base text-details-dark dark:text-details-secondary">
                              {(selectedTransaction?.transaction?.monthly_interest_amount || selectedTransaction?.monthly_interest_amount) 
                                ? formatCurrency(selectedTransaction.transaction?.monthly_interest_amount || selectedTransaction.monthly_interest_amount) 
                                : 'Not Set'}
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <div className="text-xs text-details-medium dark:text-slate-400">Maturity</div>
                              <div className="text-xs font-semibold text-details-dark dark:text-details-secondary">
                                {formatDate(selectedTransaction?.transaction?.maturity_date || selectedTransaction?.maturity_date)}
                              </div>
                            </div>
                            {(selectedTransaction?.transaction?.grace_period_end || selectedTransaction?.grace_period_end) && (
                              <div className="flex justify-between items-center">
                                <div className="text-xs text-details-medium dark:text-slate-400">Grace End</div>
                                <div className="text-xs font-semibold text-details-dark dark:text-details-secondary">
                                  {formatDate(selectedTransaction?.transaction?.grace_period_end || selectedTransaction?.grace_period_end)}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Transaction Info - Ultra Compact */}
                      <Card className="bg-details-light dark:bg-details-medium/20 backdrop-blur-sm shadow-lg border border-details-medium/20 dark:border-details-medium/40">
                        <CardHeader className="pb-1 pt-3">
                          <CardTitle className="flex items-center space-x-1.5 text-sm font-semibold text-details-dark dark:text-details-secondary">
                            <Activity className="w-3.5 h-3.5 text-details-accent" />
                            <span>Info</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-2 space-y-1">
                          {(selectedTransaction?.transaction?.storage_location || selectedTransaction?.storage_location) && (
                            <div className="flex justify-between items-center">
                              <div className="text-xs text-details-medium dark:text-slate-400">Storage:</div>
                              <div className="text-xs font-mono font-medium text-details-dark dark:text-details-secondary">
                                {formatStorageLocation(selectedTransaction?.transaction?.storage_location || selectedTransaction?.storage_location)}
                              </div>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <div className="text-xs text-details-medium dark:text-slate-400">Created by:</div>
                            <div className="text-xs font-medium text-details-dark dark:text-details-secondary">
                              User #{selectedTransaction?.transaction?.created_by_user_id || selectedTransaction?.created_by_user_id || 'Unknown'}
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="text-xs text-details-medium dark:text-slate-400">Date:</div>
                            <div className="text-xs font-medium text-details-dark dark:text-details-secondary">
                              {formatDate(selectedTransaction?.transaction?.created_at || selectedTransaction?.created_at)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Extensions - Ultra Compact */}
                      <Card className="bg-details-light dark:bg-details-medium/20 backdrop-blur-sm shadow-lg border border-details-medium/20 dark:border-details-medium/40">
                        <CardHeader className="pb-1 pt-3">
                          <CardTitle className="flex items-center space-x-1.5 text-sm font-semibold text-details-dark dark:text-details-secondary">
                            <Calendar className="w-3.5 h-3.5 text-details-accent" />
                            <span>Extensions</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-2">
                          {(selectedTransaction?.extensions || selectedTransaction?.transaction?.extensions) && 
                           (selectedTransaction?.extensions?.length > 0 || selectedTransaction?.transaction?.extensions?.length > 0) ? (
                            <div className="space-y-1.5">
                              {(selectedTransaction?.extensions || selectedTransaction?.transaction?.extensions).map((extension, index) => (
                                <div key={index} className="p-1.5 bg-details-accent/10 dark:bg-details-accent/20 rounded border border-details-accent/20 dark:border-details-accent/40">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <div className="font-mono text-xs font-medium text-details-accent">
                                      {formatExtensionId(extension)}
                                    </div>
                                    <div className="text-xs text-details-medium dark:text-slate-400">
                                      {formatDate(extension.extension_date || extension.created_at)}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-medium text-details-dark dark:text-details-secondary">
                                      {extension.extension_months}mo
                                    </div>
                                    <div className="text-xs font-bold text-details-accent">
                                      {formatCurrency(
                                        extension.total_extension_fee || 
                                        extension.extension_fee || 
                                        extension.fee || 
                                        extension.amount || 
                                        (extension.extension_months && extension.extension_fee_per_month ? 
                                          extension.extension_months * extension.extension_fee_per_month : 0)
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center text-slate-500 dark:text-slate-400 py-2 text-xs">
                              No extensions
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Center Column - Pawn Items (Featured) */}
                    <Card className="lg:col-span-2 bg-details-light dark:bg-details-medium/20 backdrop-blur-sm shadow-xl border border-details-medium/20 dark:border-details-medium/40">
                      <CardHeader className="pb-6 border-b border-details-medium/20 dark:border-details-medium/40">
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-details-accent rounded-lg flex items-center justify-center shadow-lg">
                              <Package className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-details-dark dark:text-details-secondary">Pawn Items</div>
                              <div className="text-base text-details-medium dark:text-slate-400 mt-1">
                                {(selectedTransaction?.items || selectedTransaction?.transaction?.items)?.length || 0} item(s) in this transaction
                              </div>
                            </div>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        {(selectedTransaction?.items || selectedTransaction?.transaction?.items) && 
                         (selectedTransaction?.items?.length > 0 || selectedTransaction?.transaction?.items?.length > 0) ? (
                          <div className="grid grid-cols-1 gap-6 max-h-[500px] overflow-y-auto pr-2">
                            {(selectedTransaction?.items || selectedTransaction?.transaction?.items).map((item, index) => (
                              <div key={index} className="group p-5 bg-white/90 dark:bg-slate-800/90 rounded-xl border border-details-medium/20 dark:border-details-medium/40 shadow-sm hover:shadow-md transition-all duration-200 hover:border-details-accent dark:hover:border-details-accent">
                                <div className="space-y-4">
                                  <div className="flex items-start justify-between">
                                    <div className="font-semibold text-xl text-details-dark dark:text-details-secondary group-hover:text-details-accent transition-colors">
                                      {item.description}
                                    </div>
                                    {item.estimated_value && (
                                      <div className="bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 px-4 py-2 rounded-full">
                                        <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(item.estimated_value)}</span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-6">
                                    {item.category && (
                                      <div className="flex items-center space-x-3">
                                        <div className="w-3 h-3 bg-details-accent rounded-full"></div>
                                        <span className="text-base text-slate-700 dark:text-slate-300 capitalize font-medium">{item.category}</span>
                                      </div>
                                    )}
                                    {item.condition && (
                                      <div className="flex items-center space-x-3">
                                        <div className={`w-3 h-3 rounded-full ${
                                          item.condition === 'excellent' ? 'bg-green-400' :
                                          item.condition === 'good' ? 'bg-yellow-400' :
                                          item.condition === 'fair' ? 'bg-orange-400' : 'bg-red-400'
                                        }`}></div>
                                        <span className="text-base text-details-medium dark:text-slate-400 capitalize font-medium">{item.condition}</span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {item.serial_number && (
                                    <div className="mt-3 p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                                      <div className="text-sm text-slate-500 dark:text-slate-400 mb-2 font-medium">Serial Number</div>
                                      <div className="text-base font-mono font-medium text-details-dark dark:text-details-secondary break-all">{item.serial_number}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-20 h-20 bg-details-accent/10 dark:bg-details-accent/20 rounded-full flex items-center justify-center mb-6">
                              <Package className="w-10 h-10 text-details-accent" />
                            </div>
                            <div className="text-base text-slate-500 dark:text-slate-400 font-medium">No items found for this transaction</div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>


                  {/* Internal Notes */}
                  {(selectedTransaction?.transaction?.notes || selectedTransaction?.notes) && (
                    <Card className="bg-details-light dark:bg-details-medium/20 backdrop-blur-sm shadow-lg border border-details-medium/20 dark:border-details-medium/40">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center space-x-3 text-lg font-semibold text-details-dark dark:text-details-secondary">
                          <FileText className="w-5 h-5 text-details-accent" />
                          <span>Internal Notes</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="p-4 bg-details-accent/5 dark:bg-details-accent/10 rounded-lg border border-details-accent/20 dark:border-details-accent/30">
                          <div className="text-base text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {selectedTransaction?.transaction?.notes || selectedTransaction?.notes}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-6 border-t border-details-medium/20 dark:border-details-medium/40">
                    <Button 
                      variant="outline"
                      onClick={() => setShowTransactionDetails(false)}
                      className="text-details-medium dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      Close
                    </Button>
                    
                    <div className="flex space-x-3">
                      {((selectedTransaction?.transaction?.status || selectedTransaction?.status) === 'active' || 
                        (selectedTransaction?.transaction?.status || selectedTransaction?.status) === 'overdue' || 
                        (selectedTransaction?.transaction?.status || selectedTransaction?.status) === 'extended') && (
                        <>
                          <Button 
                            onClick={() => {
                              setShowTransactionDetails(false);
                              handlePayment(selectedTransaction?.transaction || selectedTransaction);
                            }}
                            className="bg-gradient-to-r from-payment-accent to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg"
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
                            className="border-extension-accent/30 dark:border-extension-accent/40 text-extension-accent hover:bg-extension-accent/10 dark:hover:bg-extension-accent/20"
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
                        className="border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Activity className="w-4 h-4 mr-2" />
                        Update Status
                      </Button>
                    </div>
                  </div>
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
    </div>
  );
};

export default TransactionHub;