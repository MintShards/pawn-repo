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
  Package,
  FileText,
  User,
  Wallet,
  Table as TableIcon,
  LayoutGrid
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
import customerService from '../../services/customerService';
import extensionService from '../../services/extensionService';
import { initializeSequenceNumbers, formatTransactionId, formatExtensionId, formatStorageLocation, formatCurrency } from '../../utils/transactionUtils';
import { formatBusinessDate } from '../../utils/timezoneUtils';
import { useOptimisticTransactionUpdate } from '../../hooks/useOptimisticTransactionUpdate';

const TransactionList = ({ 
  onCreateNew, 
  onViewTransaction, 
  onViewCustomer,
  onPayment, 
  onExtension,
  onStatusUpdate,
  onVoidTransaction,
  refreshTrigger
}) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState(''); // Term to actually search with
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const transactionsPerPage = 10;
  const [filters, setFilters] = useState({
    status: '',
    page_size: 10,
    sortBy: 'updated_at',
    sortOrder: 'desc'
  });
  const [isMobile, setIsMobile] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState([]);
  const [sortField, setSortField] = useState('updated_at');  // Sort by most recently modified
  const [sortDirection, setSortDirection] = useState('desc');
  const [transactionBalances, setTransactionBalances] = useState({});
  const [showItemsDialog, setShowItemsDialog] = useState(false);
  const [selectedTransactionItems, setSelectedTransactionItems] = useState(null);
  const [allTransactionsCounts, setAllTransactionsCounts] = useState({
    all: 0,
    active: 0,
    overdue: 0,
    extended: 0,
    redeemed: 0,
    sold: 0
  });
  
  // Advanced search fields
  const [searchFields, setSearchFields] = useState({
    transactionId: '',
    customerId: '',
    loanAmount: '',
    storageLocation: ''
  });

  // Customer data for name display
  const [customerData, setCustomerData] = useState({});
  
  // REAL-TIME FIX: Optimistic updates for immediate UI feedback
  const {
    optimisticCreate,
    optimisticStatusUpdate,
    optimisticExtension,
    forceRefresh
  } = useOptimisticTransactionUpdate();

  // Responsive detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Filter and sort transactions (backend now handles basic search)
  const filteredAndSortedTransactions = transactions
    .filter(transaction => {
      // Advanced search filters (basic search now handled by backend)
      if (searchFields.transactionId && !formatTransactionId(transaction).toLowerCase().includes(searchFields.transactionId.toLowerCase())) return false;
      if (searchFields.customerId && !transaction.customer_id?.includes(searchFields.customerId)) return false;
      if (searchFields.loanAmount && transaction.loan_amount < parseFloat(searchFields.loanAmount)) return false;
      if (searchFields.storageLocation && !transaction.storage_location?.toLowerCase().includes(searchFields.storageLocation.toLowerCase())) return false;
      
      // Status filter (local filter for immediate UI response)
      if (filters.status && transaction.status !== filters.status) return false;
      
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'updated_at':
          comparison = new Date(a.updated_at || a.created_at || 0) - new Date(b.updated_at || b.created_at || 0);
          break;
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
          // Default to updated_at for recently modified items at top
          comparison = new Date(a.updated_at || a.created_at || 0) - new Date(b.updated_at || b.created_at || 0);
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

  // Fetch customer names for transactions
  const fetchCustomerNames = useCallback(async (transactionList) => {
    try {
      // Get unique customer IDs from transactions
      const customerIds = [...new Set(
        transactionList
          .map(t => t.customer_id)
          .filter(id => id && id !== 'N/A' && id !== 'No Customer')
      )];

      if (customerIds.length === 0) return;

      // Fetch customer data for all unique phone numbers
      const customerResults = await customerService.getMultipleCustomers(customerIds);
      
      // Build customer data map
      const customerMap = {};
      customerResults.forEach(result => {
        if (result.data) {
          customerMap[result.phone] = result.data;
        }
      });

      setCustomerData(customerMap);
    } catch (error) {
      console.warn('Failed to fetch customer names:', error);
      // Don't throw error as customer names are optional enhancement
    }
  }, []);

  const loadTransactions = useCallback(async (bustCache = false) => {
    try {
      setLoading(true);
      setError(null);
      
      let response;
      
      // Use unified search for all search operations, or regular getAllTransactions if no search
      if (activeSearchTerm) {
        // Use unified search for all search types
        const searchResult = await transactionService.unifiedSearch({
          search_text: activeSearchTerm,
          search_type: 'auto_detect',
          include_extensions: true,
          include_items: true,
          include_customer: true,
          page: currentPage,
          page_size: transactionsPerPage,
          sortBy: sortField,
          sortOrder: sortDirection,
          ...(filters.status && { status: filters.status })
        });
        
        // Transform unified search response to match expected format
        response = {
          transactions: searchResult.transactions || [],
          total_count: searchResult.total_count || 0,
          total: searchResult.total_count || 0
        };
        
        // Set total count for pagination in search results
        setTotalTransactions(searchResult.total_count || 0);
      } else {
        // Regular getAllTransactions when no search term
        const searchParams = {
          ...filters,
          page: currentPage,
          page_size: transactionsPerPage,
          sortBy: sortField,
          sortOrder: sortDirection
        };
        
        response = await transactionService.getAllTransactions(searchParams);
        
        // Enrich all transactions with extension data for better user experience
        const transactionList = response.transactions || [];
        const enrichedTransactions = await transactionService.enrichTransactionsWithExtensions(transactionList, bustCache);
        response.transactions = enrichedTransactions;
        
        // Set total count for pagination
        setTotalTransactions(response.total_count || response.total || 0);
      }
      
      let transactionList = response.transactions || [];
      
      // Only initialize sequence numbers if transactions don't have backend formatted_id
      const hasBackendFormattedIds = transactionList.length > 0 && transactionList.some(t => t.formatted_id);
      if (hasBackendFormattedIds) {
        // Skip localStorage sequences when using backend IDs
      } else {
        initializeSequenceNumbers(transactionList);
      }
      
      // All search types now handled by unified search backend
      
      setTransactions(transactionList);

      // Fetch customer names for display
      await fetchCustomerNames(transactionList);
      
      // Fetch balances for active/overdue/extended transactions immediately
      const activeTransactions = transactionList.filter(t => 
        ['active', 'overdue', 'extended'].includes(t.status)
      );
      
      if (activeTransactions.length > 0) {
        await fetchTransactionBalances(activeTransactions);
      }
    } catch (err) {
      // Error handled
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [filters, activeSearchTerm, currentPage, transactionsPerPage, sortField, sortDirection, fetchCustomerNames]);

  const fetchAllTransactionsCounts = useCallback(async (immediate = false) => {
    try {
      // Fetch counts for each status separately with enhanced rate limiting protection
      const statusCounts = {};
      const statuses = ['active', 'overdue', 'extended', 'redeemed', 'sold'];
      
      // Fetch all transactions count first
      const allResponse = await transactionService.getAllTransactions({
        page_size: 1, // Just get total count
        sortBy: 'updated_at',
        sortOrder: 'desc',
        _t: immediate ? Date.now() : undefined // Cache buster for immediate refreshes
      });
      
      statusCounts.all = allResponse.total_count || allResponse.total || 0;
      
      if (immediate) {
        // For immediate refreshes (after extension), fetch all at once without delays
        try {
          const responses = await Promise.all(
            statuses.map(status => 
              transactionService.getAllTransactions({
                page_size: 1,
                status: status,
                sortBy: 'updated_at',
                sortOrder: 'desc',
                _t: Date.now() // Cache buster
              })
            )
          );
          
          statuses.forEach((status, index) => {
            statusCounts[status] = responses[index].total_count || responses[index].total || 0;
          });
        } catch (error) {
          // Fallback to zero counts if immediate fetch fails
          statuses.forEach(status => {
            statusCounts[status] = 0;
          });
        }
      } else {
        // Add longer delay between requests to prevent rate limiting (500ms spacing)
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        
        // Fetch count for each status with delays and retry logic
        for (let i = 0; i < statuses.length; i++) {
          const status = statuses[i];
          let retryCount = 0;
          const maxRetries = 2;
          
          while (retryCount <= maxRetries) {
            try {
              if (i > 0 || retryCount > 0) {
                await delay(500 + (retryCount * 500)); // Increasing delay for retries
              }
              
              const response = await transactionService.getAllTransactions({
                page_size: 1, // Just get total count
                status: status,
                sortBy: 'updated_at',
                sortOrder: 'desc'
              });
              statusCounts[status] = response.total_count || response.total || 0;
              break; // Success, exit retry loop
            } catch (error) {
              retryCount++;
              if (error.message?.includes('Rate limit') && retryCount <= maxRetries) {
                // Rate limit hit - retry with longer delay
                continue;
              } else {
                // Failed to fetch count after retries
                statusCounts[status] = 0;
                break;
              }
            }
          }
        }
      }
      
      setAllTransactionsCounts(statusCounts);
    } catch (error) {
      // Failed to fetch transaction counts - use defaults
    }
  }, []);

  // Load transactions when component mounts or dependencies change
  useEffect(() => {
    loadTransactions(false);
  }, [loadTransactions]);

  // Load transaction counts on mount and when filters change
  useEffect(() => {
    fetchAllTransactionsCounts();
  }, [fetchAllTransactionsCounts]);


  // Reset to page 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchTerm, filters.status]);

  // Refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      // Always reset to page 1 to show updated transaction at top
      setCurrentPage(1);
      
      // Add a small delay to ensure the backend has processed the update
      const performRefresh = setTimeout(async () => {
        // Clear the transaction service cache first to ensure fresh data
        transactionService.clearTransactionCache();
        
        // Clear extension cache to ensure fresh extension counts
        extensionService.clearExtensionCache();
        
        // Force reload by calling the functions directly
        try {
          setLoading(true);
          setError(null);
          
          const searchParams = {
            ...filters,
            page: 1, // Reset to first page
            page_size: transactionsPerPage,
            sortBy: sortField,
            sortOrder: sortDirection,
            // Add timestamp to prevent any browser-level caching
            _t: Date.now()
          };
          
          if (activeSearchTerm) {
            // Use unified search_text parameter - backend handles all search logic
            searchParams.search_text = activeSearchTerm;
          }
          
          const response = await transactionService.getAllTransactions(searchParams);
          let transactionList = response.transactions || [];
          
          // Enrich transactions with extension data for immediate display
          const enrichedTransactions = await transactionService.enrichTransactionsWithExtensions(transactionList, true);
          
          // Only initialize sequence numbers if transactions don't have backend formatted_id
          const hasBackendFormattedIds = enrichedTransactions.length > 0 && enrichedTransactions.some(t => t.formatted_id);
          if (hasBackendFormattedIds) {
            // Using backend formatted IDs, skipping localStorage sequences
          } else {
            initializeSequenceNumbers(enrichedTransactions);
          }
          
          // Handle different search patterns
          let filteredTransactions = enrichedTransactions;
          
          // Extension search - filter on frontend
          if (activeSearchTerm && /^#?(EX)\d+$/i.test(activeSearchTerm)) {
            const searchNum = activeSearchTerm.replace(/^#?EX/i, '').padStart(6, '0');
            const targetExtId = `EX${searchNum}`;
            
            filteredTransactions = enrichedTransactions.filter(transaction => {
              if (!transaction.extensions || transaction.extensions.length === 0) {
                return false;
              }
              return transaction.extensions.some(ext => {
                const extId = formatExtensionId(ext);
                return extId === targetExtId;
              });
            });
          }
          
          // Item search - Future enhancement for item ID lookup
          else if (activeSearchTerm && /^#?(IT)\d+$/i.test(activeSearchTerm)) {
            // Reserved for future item search implementation
          }
          
          // Phone number search - handled by backend
          else if (activeSearchTerm && /^\d{7,}$/.test(activeSearchTerm)) {
            // Backend handles phone number search
          }
          
          // Customer name search - filter on frontend using cached customer data  
          else if (activeSearchTerm && isNaN(activeSearchTerm) && !activeSearchTerm.match(/^#?(PW|EX|IT)/i)) {
            filteredTransactions = enrichedTransactions.filter(transaction => {
              const customer = customerData[transaction.customer_id];
              if (!customer) {
                return false;
              }
              
              const fullName = `${customer.first_name || ''} ${customer.last_name || ''}`.toLowerCase();
              const searchLower = activeSearchTerm.toLowerCase();
              return fullName.includes(searchLower) || 
                             (customer.first_name || '').toLowerCase().includes(searchLower) ||
                             (customer.last_name || '').toLowerCase().includes(searchLower);
            });
          }
          
          // Transaction ID search - backend handles this
          else if (activeSearchTerm && /^#?(PW)?\d{1,6}$/i.test(activeSearchTerm)) {
            // Backend handles transaction ID search
          }
          
          setTransactions(filteredTransactions);
          setTotalTransactions(response.total_count || response.total || filteredTransactions.length);
          
          // Immediately refresh balances for active transactions after any operation
          const activeTransactions = enrichedTransactions.filter(t => 
            ['active', 'overdue', 'extended'].includes(t.status)
          );
          
          if (activeTransactions.length > 0) {
            await fetchTransactionBalances(activeTransactions);
          }
          
          // Also update counts immediately for refresh triggers
          fetchAllTransactionsCounts(true);
        } catch (err) {
          // Error refreshing transactions
          setError(err.message || 'Failed to refresh transactions');
        } finally {
          setLoading(false);
        }
      }, 300); // 300ms delay to ensure backend processing is complete
      
      // Cleanup timeout on unmount or when refreshTrigger changes
      return () => clearTimeout(performRefresh);
    }
  }, [refreshTrigger, filters, transactionsPerPage, sortField, sortDirection, activeSearchTerm, customerData, fetchAllTransactionsCounts]);

  // Calculate total pages for pagination
  // During search/filter operations, use totalTransactions (from search results)
  // For normal browsing (no active search), use allTransactionsCounts for current filter status
  const effectiveTotalTransactions = activeSearchTerm 
    ? totalTransactions // Use search result count when searching
    : (allTransactionsCounts[filters.status] || allTransactionsCounts.all || 0); // Use filtered count when browsing
  const totalPages = Math.ceil(effectiveTotalTransactions / transactionsPerPage);


  const handleStatusFilter = (status) => {
    setFilters(prev => ({ 
      ...prev, 
      status: status === filters.status ? '' : status
    }));
  };

  const handleRefresh = () => {
    setCurrentPage(1); // Reset to first page
    loadTransactions(true); // Bust cache on manual refresh
    fetchAllTransactionsCounts(); // Refresh counts as well
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

  // Use business timezone for consistent date display across the application
  const formatDate = (dateString) => formatBusinessDate(dateString);

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
      // Failed to fetch transaction summary - use basic data
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
      // Failed to fetch transaction balances - continue without them
    }
  };

  // REAL-TIME FIX: Optimistic update handlers for immediate UI feedback
  const handleOptimisticTransactionCreate = useCallback((transaction, type) => {
    if (type === 'optimistic') {
      // Add optimistic transaction to top of list immediately
      setTransactions(prev => [transaction, ...prev]);
    } else if (type === 'confirmed') {
      // Replace optimistic transaction with confirmed data
      setTransactions(prev => 
        prev.map(t => t.isOptimistic && t.transaction_id.startsWith('temp_') ? transaction : t)
      );
      
      // Force refresh to ensure list is completely up to date
      forceRefresh(() => {
        loadTransactions();
        fetchAllTransactionsCounts(true); // immediate=true for cache busting
      });
    }
  }, [forceRefresh, loadTransactions, fetchAllTransactionsCounts]);

  const handleOptimisticTransactionUpdate = useCallback((transaction, type) => {
    if (type === 'optimistic') {
      // Update transaction immediately in list
      setTransactions(prev => 
        prev.map(t => 
          t.transaction_id === transaction.transaction_id 
            ? { ...t, ...transaction }
            : t
        )
      );
    } else if (type === 'confirmed') {
      // Force refresh to ensure all data is current
      forceRefresh(() => {
        loadTransactions();
        fetchAllTransactionsCounts(true);
      });
    }
  }, [forceRefresh, loadTransactions, fetchAllTransactionsCounts]);

  const handleOptimisticError = useCallback((transactionIdOrState, error) => {
    console.error('❌ OPTIMISTIC UPDATE ERROR:', error);
    
    if (typeof transactionIdOrState === 'string' && transactionIdOrState.startsWith('temp_')) {
      // Remove failed optimistic transaction
      setTransactions(prev => 
        prev.filter(t => t.transaction_id !== transactionIdOrState)
      );
    } else {
      // Force refresh to restore correct state
      forceRefresh(() => {
        loadTransactions();
        fetchAllTransactionsCounts(true);
      });
    }
  }, [forceRefresh, loadTransactions, fetchAllTransactionsCounts]);

  // Expose optimistic operations to parent components
  window.TransactionListOptimistic = {
    createTransaction: (data) => optimisticCreate(data, handleOptimisticTransactionCreate, handleOptimisticError),
    updateStatus: (id, status, updateFn) => optimisticStatusUpdate(id, status, updateFn, handleOptimisticTransactionUpdate, handleOptimisticError),
    processExtension: (id, data) => optimisticExtension(id, data, handleOptimisticTransactionUpdate, handleOptimisticError)
  };

  return (
    <div className="space-y-6">
      {/* Redesigned Search Interface */}
      <div className="space-y-6">
        {/* Primary Search Bar with Dark Gradient Theme */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 rounded-xl opacity-95 transition-colors duration-300"></div>
          <div className="relative p-6 space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none z-10">
                <Search className="h-6 w-6 text-blue-400" />
              </div>
              <Input
                placeholder="Search by transaction number, extension ID, customer name, or phone - Press Enter to search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setActiveSearchTerm(searchTerm);
                  }
                }}
                className="pl-16 pr-14 h-16 text-lg font-medium bg-white/50 border-slate-300/50 text-slate-900 placeholder:text-slate-500 focus:bg-white/70 focus:border-blue-500/50 focus:ring-blue-500/20 dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:bg-slate-800/70 transition-all shadow-lg backdrop-blur-sm"
              />
              {searchTerm && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {searchTerm !== activeSearchTerm && (
                    <span className="text-sm text-blue-400 font-medium animate-pulse mr-2">
                      Press Enter
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm('');
                      setActiveSearchTerm('');
                    }}
                    className="h-10 w-10 p-0 rounded-lg hover:bg-slate-200/50 text-slate-600 hover:text-slate-800 dark:hover:bg-slate-700/50 dark:text-slate-400 dark:hover:text-slate-200 transition-all"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Filters with Enhanced Dark Theme */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 rounded-xl opacity-95 transition-colors duration-300"></div>
          <div className="relative p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                {['all', 'active', 'overdue', 'extended', 'redeemed', 'sold'].map((status) => (
                  <Button
                    key={status}
                    variant={filters.status === (status === 'all' ? '' : status) ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleStatusFilter(status === 'all' ? '' : status)}
                    className={`h-10 px-3 font-medium transition-all duration-200 text-sm ${
                      filters.status === (status === 'all' ? '' : status)
                        ? 'text-white shadow-lg'
                        : 'bg-slate-200/50 hover:bg-slate-300/60 hover:shadow-sm text-slate-700 hover:text-slate-900 border-slate-300/50 hover:border-slate-400/60 dark:bg-slate-700/50 dark:hover:bg-slate-600/60 dark:text-slate-300 dark:hover:text-white dark:border-slate-600/50 dark:hover:border-slate-500/60'
                    }`}
                    style={filters.status === (status === 'all' ? '' : status) ? {
                      background: status === 'redeemed' ? '#4CAF50' :
                                 status === 'active' ? '#2196F3' :
                                 status === 'extended' ? '#00BCD4' :
                                 status === 'sold' ? '#9C27B0' :
                                 status === 'overdue' ? '#F44336' :
                                 '#64748B',
                      boxShadow: status === 'redeemed' ? '0 10px 15px -3px rgba(76, 175, 80, 0.25)' :
                                status === 'active' ? '0 10px 15px -3px rgba(33, 150, 243, 0.25)' :
                                status === 'extended' ? '0 10px 15px -3px rgba(0, 188, 212, 0.25)' :
                                status === 'sold' ? '0 10px 15px -3px rgba(156, 39, 176, 0.25)' :
                                status === 'overdue' ? '0 10px 15px -3px rgba(244, 67, 54, 0.25)' :
                                '0 10px 15px -3px rgba(100, 116, 139, 0.25)'
                    } : {}}
                  >
                    {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                    <Badge 
                      variant="secondary" 
                      className="ml-2 h-5 px-2 min-w-[20px] max-w-[60px] text-xs bg-white/20 text-current border-0 font-bold flex items-center justify-center whitespace-nowrap overflow-hidden"
                    >
                      {status === 'all' ? (allTransactionsCounts.all > 999999 ? '999K+' : allTransactionsCounts.all) : (allTransactionsCounts[status] > 999999 ? '999K+' : allTransactionsCounts[status] || 0)}
                    </Badge>
                  </Button>
                ))}
              </div>

              <div className="flex items-center space-x-2">
                <div className="h-6 w-px bg-gradient-to-b from-transparent via-slate-600 to-transparent"></div>

                <Button 
                  onClick={handleRefresh} 
                  variant="ghost" 
                  size="sm"
                  disabled={loading}
                  className="h-10 px-3 bg-slate-200/50 hover:bg-slate-300/60 hover:shadow-sm text-slate-700 hover:text-slate-900 border-slate-300/50 hover:border-slate-400/60 dark:bg-slate-700/50 dark:hover:bg-slate-600/60 dark:text-slate-300 dark:hover:text-white dark:border-slate-600/50 dark:hover:border-slate-500/60 transition-all duration-200 text-sm"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  <span className="font-medium">Refresh</span>
                </Button>

                <Sheet>
                  <SheetTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-10 px-3 bg-slate-200/50 hover:bg-slate-300/60 hover:shadow-sm text-slate-700 hover:text-slate-900 border-slate-300/50 hover:border-slate-400/60 dark:bg-slate-700/50 dark:hover:bg-slate-600/60 dark:text-slate-300 dark:hover:text-white dark:border-slate-600/50 dark:hover:border-slate-500/60 transition-all duration-200 text-sm"
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      <span className="font-medium">Advanced</span>
                      {Object.values(searchFields).some(v => v) && (
                        <div className="ml-2 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Advanced Search</SheetTitle>
                      <SheetDescription>
                        Use these filters for detailed transaction searches. For quick searches, use the main search bar for transaction numbers, extension IDs, customer names, or phone numbers.
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
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>

              </div>
            </div>
          </div>
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
          <RefreshCw className="h-6 w-6 animate-spin text-slate-400 dark:text-slate-500" />
          <span className="ml-2 text-slate-600 dark:text-slate-400">Loading transactions...</span>
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
                  <TableIcon className="w-4 h-4" />
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
                  <LayoutGrid className="w-4 h-4" />
                  <span className="font-medium">Cards</span>
                </div>
              </Button>
            </div>
          </div>

          {/* Transaction Display */}
          {!isMobile ? (
            /* Enhanced Table View */
            <Card className="border-0 shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm transition-colors duration-300">
              <div className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors duration-300">
                      <TableHead className="w-12 pl-6">
                        <Checkbox
                          checked={selectedTransactionIds.length === filteredAndSortedTransactions.length && filteredAndSortedTransactions.length > 0}
                          onCheckedChange={handleSelectAll}
                          className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                        />
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:shadow-sm transition-all duration-200 font-semibold text-slate-700 dark:text-slate-300"
                        onClick={() => handleSort('pawn_date')}
                      >
                        <div className="flex items-center space-x-2 py-2">
                          <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span>Transaction</span>
                          {getSortIcon('pawn_date')}
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                          <span>Customer</span>
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        <div className="flex items-center space-x-2">
                          <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span>Items</span>
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:shadow-sm transition-all duration-200 font-semibold text-slate-700 dark:text-slate-300"
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
                          <Wallet className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                          <span>Balance</span>
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:shadow-sm transition-all duration-200 font-semibold text-slate-700 dark:text-slate-300"
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
                        className={`border-0 hover:bg-slate-50/10 dark:hover:bg-slate-800/3 hover:shadow-sm transition-all duration-300 cursor-pointer group ${
                          selectedTransactionIds.includes(transaction.transaction_id) 
                            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 shadow-sm' 
                            : index % 2 === 0 ? 'bg-slate-25/50 dark:bg-slate-900/20' : ''
                        }`}
                        onClick={() => onViewTransaction?.(transaction)}
                      >
                        <TableCell className="pl-6" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedTransactionIds.includes(transaction.transaction_id)}
                            onCheckedChange={() => handleSelectTransaction(transaction.transaction_id)}
                            className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-bold text-slate-900 dark:text-slate-100 text-base">
                              #{formatTransactionId(transaction)}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(transaction.pawn_date)}</span>
                            </div>
                            {transaction.storage_location && (
                              <div className="text-xs text-slate-500 dark:text-slate-500 flex items-center space-x-1">
                                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                                <span>{formatStorageLocation(transaction.storage_location)}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {transaction.customer_id && transaction.customer_id !== 'N/A' ? (
                            <div className="space-y-1">
                              {/* Customer Name in DOE, J. format */}
                              <div className="min-h-[20px]">
                                {customerData[transaction.customer_id] ? (
                                  <Button
                                    variant="link"
                                    className="h-auto p-0 text-sm font-bold text-slate-900 dark:text-slate-100 hover:text-slate-700 dark:hover:text-slate-300 underline-offset-2 transition-colors duration-300"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onViewCustomer?.(transaction.customer_id);
                                    }}
                                  >
                                    {customerService.getCustomerNameFormatted(customerData[transaction.customer_id])}
                                  </Button>
                                ) : (
                                  <div className="text-xs text-slate-500 dark:text-slate-500">Loading...</div>
                                )}
                              </div>
                              {/* Customer Phone Number */}
                              <Button
                                variant="link"
                                className="h-auto p-0 text-xs font-normal text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 underline-offset-2 transition-colors duration-300"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewCustomer?.(transaction.customer_id);
                                }}
                              >
                                {transaction.customer_id}
                              </Button>
                            </div>
                          ) : (
                            <div className="font-medium text-slate-600 dark:text-slate-500">N/A</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Button
                              variant="link"
                              className="h-auto p-0 font-mono font-bold text-slate-700 dark:text-slate-300 text-sm hover:text-slate-800 dark:hover:text-slate-200 underline-offset-2 transition-colors duration-300"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewItems(transaction);
                              }}
                            >
                              IT{formatTransactionId(transaction).replace('PW', '')}
                            </Button>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {(transaction.items && transaction.items.length) || 0} item{((transaction.items && transaction.items.length) || 0) !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-bold text-lg text-slate-700 dark:text-slate-300">
                              {formatCurrency(transaction.loan_amount || 0)}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {transaction.monthly_interest_amount ? `${formatCurrency(transaction.monthly_interest_amount)}/month` : 'Interest not set'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {['active', 'overdue', 'extended'].includes(transaction.status) ? (
                              <>
                                <div className="font-bold text-lg text-slate-800 dark:text-slate-200">
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
                              <div className="text-slate-600 dark:text-slate-500 text-sm italic font-medium">
                                {transaction.status === 'redeemed' ? 'Paid' : 'N/A'}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <StatusBadge status={transaction.status} />
                            {transaction.extensions && transaction.extensions.length > 0 && (() => {
                              const activeExtensions = transaction.extensions.filter(ext => !ext.is_cancelled);
                              const cancelledExtensions = transaction.extensions.filter(ext => ext.is_cancelled);
                              
                              if (activeExtensions.length > 0) {
                                return (
                                  <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                                    +{activeExtensions.length} ext
                                  </Badge>
                                );
                              } else if (cancelledExtensions.length > 0) {
                                return (
                                  <Badge variant="outline" className="text-xs bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700">
                                    {cancelledExtensions.length} canc
                                  </Badge>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onViewTransaction?.(transaction)}
                              className="h-8 w-8 p-0 hover:bg-blue-300 dark:hover:bg-blue-950/50 hover:scale-110 text-blue-600 dark:text-blue-400 transition-all duration-300"
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
                                  className="h-8 w-8 p-0 hover:bg-emerald-300 dark:hover:bg-emerald-950/50 hover:scale-110 text-emerald-600 dark:text-emerald-400 transition-all duration-300"
                                  title="Process Payment"
                                >
                                  <Banknote className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onExtension?.(transaction)}
                                  className="h-8 w-8 p-0 hover:bg-amber-300 dark:hover:bg-amber-950/50 hover:scale-110 text-amber-600 dark:text-amber-400 transition-all duration-300"
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
                  onViewCustomer={onViewCustomer}
                  onPayment={onPayment}
                  onExtension={onExtension}
                  onStatusUpdate={onStatusUpdate}
                  onVoidTransaction={onVoidTransaction}
                  isSelected={selectedTransactionIds.includes(transaction.transaction_id)}
                  onSelect={() => handleSelectTransaction(transaction.transaction_id)}
                  refreshTrigger={refreshTrigger}
                  customerData={customerData}
                  balance={transactionBalances[transaction.transaction_id]}
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
              {activeSearchTerm || filters.status ? (
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
              {activeSearchTerm || filters.status ? 'No Matching Transactions' : 'Ready to Start'}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
              {activeSearchTerm || filters.status ? 
                (activeSearchTerm && /^#?(PW)?\d+$/i.test(activeSearchTerm) ?
                  `Transaction ${activeSearchTerm.replace('#', '').toUpperCase().startsWith('PW') ? activeSearchTerm.replace('#', '').toUpperCase() : 'PW' + activeSearchTerm.replace('#', '').padStart(6, '0')} not found.` :
                  activeSearchTerm && /^#?(EX)\d+$/i.test(activeSearchTerm) ?
                  `No transactions found with extension ${activeSearchTerm.replace('#', '').toUpperCase()}` :
                  activeSearchTerm && /^#?(IT)\d+$/i.test(activeSearchTerm) ?
                  `Item search is not yet implemented` :
                  activeSearchTerm && activeSearchTerm.match(/^\d+$/) && activeSearchTerm.length < 7 ?
                  `No transactions found with loan amount $${activeSearchTerm}` :
                  activeSearchTerm && activeSearchTerm.match(/^\d{7,}$/) ?
                  `No transactions found for customer phone ${activeSearchTerm}` :
                  activeSearchTerm ?
                  `No transactions found for "${activeSearchTerm}"` :
                  'No transactions match your filters.'
                ) : 
                'Create your first pawn transaction to begin managing loans and tracking customer activity.'
              }
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {(activeSearchTerm || filters.status) && (
                <Button 
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setActiveSearchTerm('');
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

      {/* Enhanced Pagination - Always show if more than 1 page of data */}
      {totalPages > 1 && (
        <div className="!mt-0 mb-0 flex items-center justify-between px-6 py-2">
          <div className="text-sm text-muted-foreground font-medium">
            Showing {Math.min((currentPage - 1) * transactionsPerPage + 1, effectiveTotalTransactions)}-{Math.min(currentPage * transactionsPerPage, effectiveTotalTransactions)} of {effectiveTotalTransactions} transactions
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                setCurrentPage(prev => Math.max(1, prev - 1));
              }}
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
                      variant="outline"
                      size="sm"
                      className={`w-8 h-8 p-0 ${currentPage === pageNumber ? 'bg-orange-600 text-white border-orange-600 hover:bg-orange-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(pageNumber);
                      }}
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
              onClick={(e) => {
                e.preventDefault();
                setCurrentPage(prev => Math.min(totalPages, prev + 1));
              }}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
            </div>
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