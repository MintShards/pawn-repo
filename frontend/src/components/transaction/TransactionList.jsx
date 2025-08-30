import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Search,
  Plus,
  Filter,
  X,
  SortAsc,
  SortDesc,
  Calendar,
  DollarSign,
  CreditCard,
  Eye,
  Banknote,
  ArrowRightLeft,
  Package
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import TransactionCard from './TransactionCard';
import StatusBadge from './components/StatusBadge';
import transactionService from '../../services/transactionService';
import { matchesTransactionSearch, initializeSequenceNumbers, formatTransactionId, formatStorageLocation } from '../../utils/transactionUtils';

const TransactionList = ({ 
  onCreateNew, 
  onViewTransaction, 
  onPayment, 
  onExtension,
  onStatusUpdate,
  refreshTrigger 
}) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const transactionsPerPage = 10;
  const [filters, setFilters] = useState({
    status: '',
    page_size: 10,
    sortBy: 'updated_at',  // Sort by most recently modified
    sortOrder: 'desc'
  });
  const [isExtensionSearch, setIsExtensionSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState([]);
  const [sortField, setSortField] = useState('updated_at');  // Sort by most recently modified
  const [sortDirection, setSortDirection] = useState('desc');
  const [transactionBalances, setTransactionBalances] = useState({});
  const [showItemsDialog, setShowItemsDialog] = useState(false);
  const [selectedTransactionItems, setSelectedTransactionItems] = useState(null);
  
  // Advanced search fields
  const [searchFields, setSearchFields] = useState({
    transactionId: '',
    customerId: '',
    loanAmount: '',
    storageLocation: ''
  });

  // Responsive detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Filter and sort transactions
  const filteredAndSortedTransactions = transactions
    .filter(transaction => {
      // Basic search filter
      if (searchTerm) {
        if (isExtensionSearch) return true;
        const isTransactionSearch = /^(PW)?\d+$/i.test(searchTerm);
        if (isTransactionSearch) {
          return matchesTransactionSearch(transaction, searchTerm);
        }
        return transaction.customer_id?.includes(searchTerm);
      }
      
      // Advanced search filters
      if (searchFields.transactionId && !formatTransactionId(transaction).toLowerCase().includes(searchFields.transactionId.toLowerCase())) return false;
      if (searchFields.customerId && !transaction.customer_id?.includes(searchFields.customerId)) return false;
      if (searchFields.loanAmount && transaction.loan_amount < parseFloat(searchFields.loanAmount)) return false;
      if (searchFields.storageLocation && !transaction.storage_location?.toLowerCase().includes(searchFields.storageLocation.toLowerCase())) return false;
      
      // Status filter
      if (filters.status && transaction.status !== filters.status) return false;
      
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'created_at':
          comparison = new Date(a.created_at || a.pawn_date || 0) - new Date(b.created_at || b.pawn_date || 0);
          break;
        case 'pawn_date':
          comparison = new Date(a.pawn_date || 0) - new Date(b.pawn_date || 0);
          break;
        case 'loan_amount':
          comparison = (a.loan_amount || 0) - (b.loan_amount || 0);
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'customer_id':
          comparison = (a.customer_id || '').localeCompare(b.customer_id || '');
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if searching by extension ID
      const isExtensionSearch = searchTerm && /^EX\d*$/i.test(searchTerm);
      const isTransactionSearch = searchTerm && /^(PW)?\d+$/i.test(searchTerm);
      
      let response;
      
      if (isExtensionSearch) {
        // Search for transactions by extension ID
        response = await transactionService.searchTransactionsByExtension(searchTerm);
        setIsExtensionSearch(true);
      } else {
        setIsExtensionSearch(false);
        // Regular transaction search or customer search
        const searchParams = {
          ...filters,
          page: currentPage,
          page_size: transactionsPerPage,
          sortBy: sortField,
          sortOrder: sortDirection,
          ...(searchTerm && !isTransactionSearch && { customer_id: searchTerm })
        };
        
        response = await transactionService.getAllTransactions(searchParams);
        
        // Set total count for pagination
        setTotalTransactions(response.total_count || response.total || 0);
        
        // Enrich all transactions with extension data for better user experience
        const transactionList = response.transactions || [];
        const enrichedTransactions = await transactionService.enrichTransactionsWithExtensions(transactionList);
        response.transactions = enrichedTransactions;
      }
      
      const transactionList = response.transactions || [];
      
      // Initialize sequence numbers for consistent PW numbering
      initializeSequenceNumbers(transactionList);
      
      setTransactions(transactionList);
      
      // Fetch balances for active/overdue/extended transactions
      const activeTransactions = transactionList.filter(t => 
        ['active', 'overdue', 'extended'].includes(t.status)
      );
      
      if (activeTransactions.length > 0) {
        fetchTransactionBalances(activeTransactions);
      }
    } catch (err) {
      // Error handled
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [filters, searchTerm, currentPage, transactionsPerPage, sortField, sortDirection]);

  // Load transactions on mount and when filters change
  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Reset to page 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters.status]);

  // Refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      setCurrentPage(1); // Reset to first page
      loadTransactions();
    }
  }, [refreshTrigger, loadTransactions]);

  // Calculate total pages for pagination
  const totalPages = Math.ceil(totalTransactions / transactionsPerPage);

  const handleSearch = () => {
    loadTransactions();
  };

  const handleStatusFilter = (status) => {
    setFilters(prev => ({ 
      ...prev, 
      status: status === filters.status ? '' : status
    }));
  };

  const handleRefresh = () => {
    setIsExtensionSearch(false);
    setCurrentPage(1); // Reset to first page
    loadTransactions();
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <SortAsc className="w-4 h-4 opacity-50" />;
    }
    return sortDirection === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />;
  };

  const handleSelectTransaction = (transactionId) => {
    setSelectedTransactionIds(prev => 
      prev.includes(transactionId) 
        ? prev.filter(id => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  const handleSelectAll = (checked) => {
    setSelectedTransactionIds(checked ? filteredAndSortedTransactions.map(t => t.transaction_id) : []);
  };

  const clearSearchFields = () => {
    setSearchTerm('');
    setSearchFields({ transactionId: '', customerId: '', loanAmount: '', storageLocation: '' });
    setFilters({ status: '', page_size: 10, sortBy: 'updated_at', sortOrder: 'desc' });
    setCurrentPage(1);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Fetch balances for transactions
  // Handle viewing items for a transaction
  const handleViewItems = async (transaction) => {
    try {
      // Fetch complete transaction summary with items
      const summary = await transactionService.getTransactionSummary(transaction.transaction_id);
      // The summary contains transaction, items, and balance
      setSelectedTransactionItems({
        ...summary.transaction,
        items: summary.items
      });
      setShowItemsDialog(true);
    } catch (error) {
      console.error('Failed to fetch transaction summary:', error);
      // Fallback to the transaction data we have
      setSelectedTransactionItems(transaction);
      setShowItemsDialog(true);
    }
  };

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
      console.error('Failed to fetch transaction balances:', error);
    }
  };


  return (
    <div className="space-y-6">
      {/* Modern Search Interface */}
      <div className="space-y-4">
        {/* Primary Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          </div>
          <Input
            placeholder="Search by transaction ID (PW000123), customer phone, or item description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 pr-4 h-14 text-base bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 shadow-sm focus:shadow-lg focus:border-blue-500/50 dark:focus:border-blue-400/50 transition-all"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Quick Status Filters & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            {['all', 'active', 'overdue', 'extended', 'redeemed', 'sold'].map((status) => (
              <Button
                key={status}
                variant={filters.status === (status === 'all' ? '' : status) ? "default" : "ghost"}
                size="sm"
                onClick={() => handleStatusFilter(status === 'all' ? '' : status)}
                className={`h-8 px-3 ${
                  filters.status === (status === 'all' ? '' : status)
                    ? status === 'active' 
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : status === 'overdue'
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : status === 'extended'
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : status === 'redeemed'
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : status === 'sold'
                      ? 'bg-purple-500 hover:bg-purple-600 text-white'
                      : 'bg-slate-500 hover:bg-slate-600 text-white'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                {status !== 'all' && (
                  <Badge 
                    variant="secondary" 
                    className="ml-2 h-5 px-1.5 text-xs bg-white/20 text-current border-0"
                  >
                    {filteredAndSortedTransactions.filter(t => t.status === status).length}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-600"></div>

          <Button 
            onClick={handleRefresh} 
            variant="ghost" 
            size="sm"
            disabled={loading}
            className="h-8 px-3 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-3">
                <Filter className="h-4 w-4 mr-2" />
                Advanced
                {Object.values(searchFields).some(v => v) && (
                  <Badge variant="destructive" className="ml-2 h-4 w-4 p-0 text-xs">•</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Advanced Search</SheetTitle>
                <SheetDescription>
                  Use multiple criteria to find specific transactions
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="transactionId">Transaction ID</Label>
                    <Input
                      id="transactionId"
                      placeholder="PW000123"
                      value={searchFields.transactionId}
                      onChange={(e) => setSearchFields(prev => ({ ...prev, transactionId: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="customerId">Customer Phone</Label>
                    <Input
                      id="customerId"
                      placeholder="1234567890"
                      value={searchFields.customerId}
                      onChange={(e) => setSearchFields(prev => ({ ...prev, customerId: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="loanAmount">Minimum Loan Amount</Label>
                    <Input
                      id="loanAmount"
                      type="number"
                      placeholder="0.00"
                      value={searchFields.loanAmount}
                      onChange={(e) => setSearchFields(prev => ({ ...prev, loanAmount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="storageLocation">Storage Location</Label>
                    <Input
                      id="storageLocation"
                      placeholder="Shelf A-1"
                      value={searchFields.storageLocation}
                      onChange={(e) => setSearchFields(prev => ({ ...prev, storageLocation: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Button onClick={clearSearchFields} variant="outline" className="flex-1">
                    Clear All
                  </Button>
                  <Button onClick={() => setShowFilters(false)} className="flex-1">
                    Apply
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {(searchTerm || filters.status || Object.values(searchFields).some(v => v)) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setFilters({ status: '', page_size: 10, sortBy: 'updated_at', sortOrder: 'desc' });
                setSearchFields({ transactionId: '', customerId: '', loanAmount: '', storageLocation: '' });
              }}
              className="h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/50"
            >
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-600">
              <strong>Error:</strong> {error}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              className="ml-auto"
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">Loading transactions...</span>
        </div>
      )}


      {/* Enhanced Transaction Display */}
      {!loading && filteredAndSortedTransactions.length > 0 && (
        <div className="space-y-4">
          {/* Results Summary & View Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl border border-blue-200/30 dark:border-blue-800/30">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {filteredAndSortedTransactions.length} result{filteredAndSortedTransactions.length !== 1 ? 's' : ''}
                </span>
                {(filters.status || searchTerm || Object.values(searchFields).some(v => v)) && (
                  <Badge variant="outline" className="text-xs bg-blue-100/50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                    filtered
                  </Badge>
                )}
              </div>
              
              {selectedTransactionIds.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Badge className="px-3 py-1 bg-blue-500 text-white">
                    {selectedTransactionIds.length} selected
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTransactionIds([])}
                    className="h-7 px-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* View Toggle */}
            <div className="flex items-center space-x-1 bg-white/80 dark:bg-slate-800/80 rounded-lg p-1 shadow-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobile(false)}
                className={`h-8 px-4 transition-all ${
                  !isMobile 
                    ? 'bg-blue-500 text-white shadow-sm hover:bg-blue-600' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div className="grid grid-cols-2 gap-0.5 w-3.5 h-3.5">
                    <div className="w-1.5 h-1.5 bg-current rounded-sm"></div>
                    <div className="w-1.5 h-1.5 bg-current rounded-sm"></div>
                    <div className="w-1.5 h-1.5 bg-current rounded-sm"></div>
                    <div className="w-1.5 h-1.5 bg-current rounded-sm"></div>
                  </div>
                  <span className="font-medium">Table</span>
                </div>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobile(true)}
                className={`h-8 px-4 transition-all ${
                  isMobile 
                    ? 'bg-blue-500 text-white shadow-sm hover:bg-blue-600' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div className="grid grid-cols-1 gap-0.5 w-3.5 h-3.5">
                    <div className="w-3.5 h-1 bg-current rounded-sm"></div>
                    <div className="w-3.5 h-1 bg-current rounded-sm"></div>
                    <div className="w-3.5 h-0.5 bg-current rounded-sm"></div>
                  </div>
                  <span className="font-medium">Cards</span>
                </div>
              </Button>
            </div>
          </div>

          {/* Transaction Display */}
          {!isMobile ? (
            /* Enhanced Table View */
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
              <div className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
                      <TableHead className="w-12 pl-6">
                        <Checkbox
                          checked={selectedTransactionIds.length === filteredAndSortedTransactions.length && filteredAndSortedTransactions.length > 0}
                          onCheckedChange={handleSelectAll}
                          className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                        />
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors font-semibold text-slate-700 dark:text-slate-300"
                        onClick={() => handleSort('pawn_date')}
                      >
                        <div className="flex items-center space-x-2 py-2">
                          <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span>Transaction</span>
                          {getSortIcon('pawn_date')}
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-slate-600 dark:bg-slate-300"></div>
                          </div>
                          <span>Customer</span>
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 rounded-lg bg-amber-200 dark:bg-amber-700 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-sm bg-amber-600 dark:bg-amber-300"></div>
                          </div>
                          <span>Items</span>
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors font-semibold text-slate-700 dark:text-slate-300"
                        onClick={() => handleSort('loan_amount')}
                      >
                        <div className="flex items-center space-x-2 py-2">
                          <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Loan Amount</span>
                          {getSortIcon('loan_amount')}
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        <div className="flex items-center space-x-2">
                          <CreditCard className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                          <span>Balance</span>
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors font-semibold text-slate-700 dark:text-slate-300"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center space-x-2 py-2">
                          <div className="w-4 h-4 rounded-full bg-gradient-to-r from-emerald-500 to-blue-500"></div>
                          <span>Status</span>
                          {getSortIcon('status')}
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-center">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedTransactions.map((transaction, index) => (
                      <TableRow 
                        key={transaction.transaction_id}
                        className={`border-slate-200/50 dark:border-slate-700/50 hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-indigo-50/30 dark:hover:from-blue-950/10 dark:hover:to-indigo-950/10 transition-all cursor-pointer group ${
                          selectedTransactionIds.includes(transaction.transaction_id) 
                            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800' 
                            : index % 2 === 0 ? 'bg-slate-25/50 dark:bg-slate-900/20' : ''
                        }`}
                        onClick={() => handleSelectTransaction(transaction.transaction_id)}
                      >
                        <TableCell className="pl-6">
                          <Checkbox
                            checked={selectedTransactionIds.includes(transaction.transaction_id)}
                            onCheckedChange={() => handleSelectTransaction(transaction.transaction_id)}
                            className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                          />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-1">
                            <div className="font-bold text-blue-700 dark:text-blue-300 text-base">
                              #{formatTransactionId(transaction)}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(transaction.pawn_date)}</span>
                            </div>
                            {transaction.storage_location && (
                              <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center space-x-1">
                                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                                <span>{formatStorageLocation(transaction.storage_location)}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {transaction.customer_id || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-1">
                            <Button
                              variant="link"
                              className="h-auto p-0 font-mono font-bold text-amber-700 dark:text-amber-300 text-sm hover:text-amber-800 dark:hover:text-amber-200 underline-offset-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewItems(transaction);
                              }}
                            >
                              IT{formatTransactionId(transaction).replace('PW', '')}
                            </Button>
                            {transaction.items && transaction.items.length > 0 && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {transaction.items.length} item{transaction.items.length !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-1">
                            <div className="font-bold text-lg text-slate-900 dark:text-slate-100">
                              {formatCurrency(transaction.loan_amount || 0)}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {transaction.monthly_interest_amount ? `${formatCurrency(transaction.monthly_interest_amount)}/month` : 'Interest not set'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-1">
                            {['active', 'overdue', 'extended'].includes(transaction.status) ? (
                              <>
                                <div className="font-bold text-lg text-slate-900 dark:text-slate-100">
                                  {transactionBalances[transaction.transaction_id]?.current_balance !== undefined 
                                    ? formatCurrency(transactionBalances[transaction.transaction_id].current_balance)
                                    : '...'
                                  }
                                </div>
                                {transactionBalances[transaction.transaction_id]?.current_balance !== undefined && (
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {transactionBalances[transaction.transaction_id].current_balance > 0 
                                      ? 'Outstanding' 
                                      : 'Paid in full'
                                    }
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="text-slate-400 dark:text-slate-500 text-sm italic">
                                {transaction.status === 'redeemed' ? 'Paid' : 'N/A'}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center space-x-2">
                            <StatusBadge status={transaction.status} />
                            {transaction.extensions && transaction.extensions.length > 0 && (
                              <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                                +{transaction.extensions.length} ext
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onViewTransaction?.(transaction)}
                              className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-950/50 text-blue-600 dark:text-blue-400"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {(transaction.status === 'active' || transaction.status === 'overdue' || transaction.status === 'extended') && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onPayment?.(transaction)}
                                  className="h-8 w-8 p-0 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
                                  title="Process Payment"
                                >
                                  <Banknote className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onExtension?.(transaction)}
                                  className="h-8 w-8 p-0 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-amber-600 dark:text-amber-400"
                                  title="Extend Loan"
                                >
                                  <ArrowRightLeft className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ) : (
            /* Enhanced Card View */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredAndSortedTransactions.map((transaction) => (
                <TransactionCard
                  key={transaction.transaction_id}
                  transaction={transaction}
                  onView={onViewTransaction}
                  onPayment={onPayment}
                  onExtension={onExtension}
                  onStatusUpdate={onStatusUpdate}
                  isSelected={selectedTransactionIds.includes(transaction.transaction_id)}
                  onSelect={() => handleSelectTransaction(transaction.transaction_id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enhanced Empty State */}
      {!loading && filteredAndSortedTransactions.length === 0 && !error && (
        <Card className="border-0 shadow-xl bg-gradient-to-br from-white/90 to-slate-50/90 dark:from-slate-900/90 dark:to-slate-800/90 backdrop-blur-sm">
          <CardContent className="text-center py-16">
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-3xl flex items-center justify-center mx-auto shadow-lg border border-blue-200/50 dark:border-blue-800/50">
                <CreditCard className="w-12 h-12 text-blue-600 dark:text-blue-400" />
              </div>
              {searchTerm || filters.status ? (
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900">
                  <Search className="w-4 h-4 text-white" />
                </div>
              ) : (
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900">
                  <Plus className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
              {searchTerm || filters.status ? 'No Matching Transactions' : 'Ready to Start'}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
              {searchTerm || filters.status ? 
                'No transactions match your search criteria. Try adjusting your filters or search terms.' : 
                'Create your first pawn transaction to begin managing loans and tracking customer activity.'
              }
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {(searchTerm || filters.status) && (
                <Button 
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setFilters({ status: '', page_size: 10, sortBy: 'updated_at', sortOrder: 'desc' });
                    setSearchFields({ transactionId: '', customerId: '', loanAmount: '', storageLocation: '' });
                    setCurrentPage(1);
                  }}
                  className="bg-white/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear All Filters
                </Button>
              )}
              <Button 
                onClick={onCreateNew}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all px-6 py-2"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Transaction
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Pagination */}
      {!loading && totalTransactions > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {Math.min((currentPage - 1) * transactionsPerPage + 1, totalTransactions)}-{Math.min(currentPage * transactionsPerPage, totalTransactions)} of {totalTransactions} transactions
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
      )}

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
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    Transaction #{formatTransactionId(selectedTransactionItems)}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Customer: {selectedTransactionItems.customer_id} | 
                    Status: <span className="capitalize font-medium">{selectedTransactionItems.status}</span>
                  </p>
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
    </div>
  );
};

export default TransactionList;