import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import TransactionCard from './TransactionCard';
import StatusBadge from './components/StatusBadge';
import BulkStatusUpdateDialog from './BulkStatusUpdateDialog';
import BulkNotesDialog from './BulkNotesDialog';
import transactionService from '../../services/transactionService';
import customerService from '../../services/customerService';
import extensionService from '../../services/extensionService';
import { initializeSequenceNumbers, formatTransactionId, formatExtensionId, formatStorageLocation, formatCurrency, formatCount } from '../../utils/transactionUtils';
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
  const [transactionsPerPage, setTransactionsPerPage] = useState(10);
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
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [showBulkNotesDialog, setShowBulkNotesDialog] = useState(false);
  const [allTransactionsCounts, setAllTransactionsCounts] = useState({
    all: undefined,
    active: undefined,
    overdue: undefined,
    extended: undefined,
    redeemed: undefined,
    sold: undefined
  });
  
  // Advanced search fields
  const [searchFields, setSearchFields] = useState({
    // New filters only
    minLoanAmount: '',
    maxLoanAmount: '',
    minDaysOverdue: '',
    maxDaysOverdue: '',
    pawnDateFrom: '',
    pawnDateTo: '',
    maturityDateFrom: '',
    maturityDateTo: ''
  });

  // Filter validation errors
  const [filterErrors, setFilterErrors] = useState({});

  // Debounced search fields for API calls (prevents too many requests while typing)
  const [debouncedSearchFields, setDebouncedSearchFields] = useState(searchFields);
  const [isFilterPending, setIsFilterPending] = useState(false);

  // Sheet state for auto-close functionality
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Customer data for name display
  const [customerData, setCustomerData] = useState({});

  // Helper to calculate effective transaction status based on extensions
  const getEffectiveTransactionStatus = (transaction) => {
    const baseStatus = transaction.status;
    
    // Check if transaction has any active (non-cancelled) extensions
    const extensions = transaction.extensions || [];
    const hasActiveExtensions = extensions.some(ext => !ext.is_cancelled);
    
    // If there are active extensions, status should be 'extended'
    if (hasActiveExtensions && ['active', 'overdue'].includes(baseStatus)) {
      return 'extended';
    }
    
    return baseStatus;
  };

  // Validation functions
  const validateFilters = useCallback((fields) => {
    const errors = {};
    
    // Validate loan amount range
    if (fields.minLoanAmount && fields.maxLoanAmount) {
      const min = parseInt(fields.minLoanAmount);
      const max = parseInt(fields.maxLoanAmount);
      if (min > max) {
        errors.loanAmount = `Minimum amount ($${min}) cannot be greater than maximum amount ($${max})`;
      }
    }
    
    // Validate individual loan amounts
    if (fields.minLoanAmount) {
      const min = parseInt(fields.minLoanAmount);
      if (min < 0) errors.minLoanAmount = 'Minimum loan amount cannot be negative';
      if (min > 10000) errors.minLoanAmount = 'Minimum loan amount cannot exceed $10,000';
    }
    
    if (fields.maxLoanAmount) {
      const max = parseInt(fields.maxLoanAmount);
      if (max < 0) errors.maxLoanAmount = 'Maximum loan amount cannot be negative';
      if (max > 10000) errors.maxLoanAmount = 'Maximum loan amount cannot exceed $10,000';
    }
    
    // Validate days overdue range
    if (fields.minDaysOverdue && fields.maxDaysOverdue) {
      const min = parseInt(fields.minDaysOverdue);
      const max = parseInt(fields.maxDaysOverdue);
      if (min > max) {
        errors.daysOverdue = `Minimum days (${min}) cannot be greater than maximum days (${max})`;
      }
    }
    
    // Validate individual days overdue
    if (fields.minDaysOverdue) {
      const min = parseInt(fields.minDaysOverdue);
      if (min < 0) errors.minDaysOverdue = 'Minimum days overdue cannot be negative';
      if (min > 10000) errors.minDaysOverdue = 'Minimum days overdue cannot exceed 10,000';
    }
    
    if (fields.maxDaysOverdue) {
      const max = parseInt(fields.maxDaysOverdue);
      if (max < 0) errors.maxDaysOverdue = 'Maximum days overdue cannot be negative';
      if (max > 10000) errors.maxDaysOverdue = 'Maximum days overdue cannot exceed 10,000';
    }
    
    // Validate pawn date range
    if (fields.pawnDateFrom && fields.pawnDateTo) {
      const fromDate = new Date(fields.pawnDateFrom);
      const toDate = new Date(fields.pawnDateTo);
      if (fromDate > toDate) {
        errors.pawnDateRange = `Pawn date 'from' cannot be after 'to' date`;
      }
    }
    
    // Validate maturity date range
    if (fields.maturityDateFrom && fields.maturityDateTo) {
      const fromDate = new Date(fields.maturityDateFrom);
      const toDate = new Date(fields.maturityDateTo);
      if (fromDate > toDate) {
        errors.maturityDateRange = `Maturity date 'from' cannot be after 'to' date`;
      }
    }
    
    // Validate date constraints (not too far in past/future)
    const currentDate = new Date();
    const maxFutureDate = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), currentDate.getDate());
    const minPastDate = new Date(2020, 0, 1);
    
    [
      { field: 'pawnDateFrom', label: 'Pawn date from' },
      { field: 'pawnDateTo', label: 'Pawn date to' },
      { field: 'maturityDateFrom', label: 'Maturity date from' },
      { field: 'maturityDateTo', label: 'Maturity date to' }
    ].forEach(({ field, label }) => {
      if (fields[field]) {
        const date = new Date(fields[field]);
        if (date > maxFutureDate) {
          errors[field] = `${label} cannot be more than 1 year in the future`;
        }
        if (date < minPastDate) {
          errors[field] = `${label} cannot be before 2020`;
        }
      }
    });
    
    return errors;
  }, []);
  
  // Memoized check for frontend filters to optimize performance
  const needsAllTransactionsMemo = useMemo(() => false, []);
  
  // Debounced search to reduce API calls (but not for filters)
  useEffect(() => {
    // Only debounce the text search, not filter changes
    if (searchTerm !== activeSearchTerm) {
      const debounceTimer = setTimeout(() => {
        setActiveSearchTerm(searchTerm);
      }, 300);
      
      return () => clearTimeout(debounceTimer);
    }
  }, [searchTerm, activeSearchTerm]);
  
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

  // Constants for improved maintainability
  const API_DELAY_MS = 500;
  const MAX_PAGE_SIZE = 100;
  
  
  
  // Since all filtering is now done on the backend, just sort the transactions
  const filteredAndSortedTransactions = useMemo(() => {
    // Early return if no transactions
    if (!transactions.length) return [];
    
    // Just sort the transactions returned from the backend
    return transactions.slice().sort((a, b) => {
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
            comparison = new Date(a.updated_at || a.created_at || 0) - new Date(b.updated_at || b.created_at || 0);
        }
        return sortDirection === 'desc' ? -comparison : comparison;
      });
  }, [transactions, sortField, sortDirection]);

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
        // Use memoized check for frontend filters
        const needsAllTransactions = needsAllTransactionsMemo;

        // Regular getAllTransactions when no search term
        const searchParams = {
          ...filters,
          page: needsAllTransactions ? 1 : currentPage, // Always start from page 1 when loading all
          page_size: needsAllTransactions ? MAX_PAGE_SIZE : transactionsPerPage, // Load max transactions for frontend filtering
          sortBy: sortField,
          sortOrder: sortDirection,
          // Add advanced search filters (using debounced values)
          ...(debouncedSearchFields.minLoanAmount && { min_amount: parseInt(debouncedSearchFields.minLoanAmount) }),
          ...(debouncedSearchFields.maxLoanAmount && { max_amount: parseInt(debouncedSearchFields.maxLoanAmount) }),
          ...(debouncedSearchFields.pawnDateFrom && { start_date: debouncedSearchFields.pawnDateFrom + 'T00:00:00Z' }),
          ...(debouncedSearchFields.pawnDateTo && { end_date: debouncedSearchFields.pawnDateTo + 'T23:59:59Z' }),
          ...(debouncedSearchFields.maturityDateFrom && { maturity_date_from: debouncedSearchFields.maturityDateFrom + 'T00:00:00Z' }),
          ...(debouncedSearchFields.maturityDateTo && { maturity_date_to: debouncedSearchFields.maturityDateTo + 'T23:59:59Z' }),
          ...(debouncedSearchFields.minDaysOverdue && { min_days_overdue: parseInt(debouncedSearchFields.minDaysOverdue) }),
          ...(debouncedSearchFields.maxDaysOverdue && { max_days_overdue: parseInt(debouncedSearchFields.maxDaysOverdue) })
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
  }, [filters, activeSearchTerm, currentPage, transactionsPerPage, sortField, sortDirection, fetchCustomerNames, debouncedSearchFields.minLoanAmount, debouncedSearchFields.maxLoanAmount, debouncedSearchFields.pawnDateFrom, debouncedSearchFields.pawnDateTo, debouncedSearchFields.maturityDateFrom, debouncedSearchFields.maturityDateTo, debouncedSearchFields.minDaysOverdue, debouncedSearchFields.maxDaysOverdue, needsAllTransactionsMemo]);

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
                await delay(API_DELAY_MS + (retryCount * API_DELAY_MS)); // Increasing delay for retries
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
  }, [refreshTrigger, filters, customerData, transactionsPerPage, sortField, sortDirection, activeSearchTerm, fetchAllTransactionsCounts]);

  // Calculate total pages for pagination
  // Check if any advanced filters are active
  const hasAdvancedFilters = Object.values(searchFields).some(v => v && v.trim() !== '');
  
  // Check if frontend-only filters are active (memoized for performance)
  const hasFrontendFilters = false;
  
  
  // During search/filter operations, use appropriate count
  let effectiveTotalTransactions;
  if (hasFrontendFilters) {
    // If frontend filters are applied, use the actual filtered list length
    effectiveTotalTransactions = filteredAndSortedTransactions.length;
  } else if (activeSearchTerm || hasAdvancedFilters) {
    // If only backend filters/search, use API result count
    effectiveTotalTransactions = totalTransactions;
  } else {
    // For normal browsing (no filters), use status count
    effectiveTotalTransactions = allTransactionsCounts[filters.status] || allTransactionsCounts.all || 0;
  }
  
  const totalPages = Math.ceil(effectiveTotalTransactions / transactionsPerPage);

  // Apply frontend pagination when frontend filters are active
  const paginatedTransactions = hasFrontendFilters 
    ? filteredAndSortedTransactions.slice(
        (currentPage - 1) * transactionsPerPage,
        currentPage * transactionsPerPage
      )
    : filteredAndSortedTransactions;

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
    setSelectedTransactionIds(checked ? paginatedTransactions.map(t => t.transaction_id) : []);
  };

  const clearSearchFields = () => {
    const emptyFields = { 
      minLoanAmount: '',
      maxLoanAmount: '',
      minDaysOverdue: '',
      maxDaysOverdue: '',
      pawnDateFrom: '',
      pawnDateTo: '',
      maturityDateFrom: '',
      maturityDateTo: ''
    };
    
    setSearchTerm('');
    setActiveSearchTerm('');
    setSearchFields(emptyFields);
    setDebouncedSearchFields(emptyFields); // Clear debounced fields immediately
    setFilterErrors({});
    setIsFilterPending(false);
    setFilters({ status: '', page_size: 10, sortBy: 'updated_at', sortOrder: 'desc' });
    setCurrentPage(1);
    setTransactionsPerPage(10);
  };

  // Validate filters whenever search fields change
  useEffect(() => {
    const errors = validateFilters(searchFields);
    setFilterErrors(errors);
  }, [searchFields, validateFilters]);

  // Debounce search fields to prevent too many API calls while typing
  useEffect(() => {
    // Check if search fields have actually changed
    const hasChanged = JSON.stringify(searchFields) !== JSON.stringify(debouncedSearchFields);
    
    if (hasChanged && Object.values(searchFields).some(v => v)) {
      setIsFilterPending(true);
    }

    const debounceTimer = setTimeout(() => {
      // Only update debounced fields if there are no validation errors
      if (Object.keys(filterErrors).length === 0) {
        setDebouncedSearchFields(searchFields);
        setIsFilterPending(false);
      }
    }, 500); // 500ms delay

    return () => {
      clearTimeout(debounceTimer);
      if (!Object.values(searchFields).some(v => v)) {
        setIsFilterPending(false);
      }
    };
  }, [searchFields, filterErrors, debouncedSearchFields]);

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
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-1.5 flex-wrap">
                {['all', 'active', 'overdue', 'extended', 'redeemed', 'sold'].map((status) => (
                  <Button
                    key={status}
                    variant={filters.status === (status === 'all' ? '' : status) ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleStatusFilter(status === 'all' ? '' : status)}
                    className={`h-9 px-2.5 font-medium transition-all duration-200 text-sm ${
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
                      className={`ml-1.5 h-4 text-xs bg-white/20 text-current border-0 font-bold flex items-center justify-center whitespace-nowrap overflow-hidden ${
                        (() => {
                          const count = status === 'all' ? allTransactionsCounts.all : (allTransactionsCounts[status] || 0);
                          // Dynamic sizing: larger for smaller numbers, smaller for K/M formatted numbers
                          if (count >= 1000) {
                            return 'px-1.5 min-w-[24px] max-w-[36px]'; // Compact for K/M: "3K", "10K", "2.5K", "1.2M"
                          } else {
                            return 'px-2 min-w-[32px] max-w-[48px]'; // Larger for small numbers: "1", "50", "100", "999"
                          }
                        })()
                      }`}
                      title={`${status === 'all' ? allTransactionsCounts.all : (allTransactionsCounts[status] || 0)} transactions`}
                    >
                      {status === 'all' ? formatCount(allTransactionsCounts.all) : formatCount(allTransactionsCounts[status] || 0)}
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
                  className="h-9 px-3 bg-slate-200/50 hover:bg-slate-300/60 hover:shadow-sm text-slate-700 hover:text-slate-900 border-slate-300/50 hover:border-slate-400/60 dark:bg-slate-700/50 dark:hover:bg-slate-600/60 dark:text-slate-300 dark:hover:text-white dark:border-slate-600/50 dark:hover:border-slate-500/60 transition-all duration-200 text-sm"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                  <span className="font-medium">Refresh</span>
                </Button>

                <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
                  <SheetTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="relative h-9 px-3 bg-slate-200/50 hover:bg-slate-300/60 hover:shadow-sm text-slate-700 hover:text-slate-900 border-slate-300/50 hover:border-slate-400/60 dark:bg-slate-700/50 dark:hover:bg-slate-600/60 dark:text-slate-300 dark:hover:text-white dark:border-slate-600/50 dark:hover:border-slate-500/60 transition-all duration-200 text-sm"
                    >
                      <Filter className="h-3.5 w-3.5 mr-1.5" />
                      <span className="font-medium">Advanced</span>
                      {Object.values(searchFields).some(v => v) && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-[400px] sm:w-[540px]">
                    <SheetHeader className="pb-6">
                      <SheetTitle className="flex items-center gap-2 text-lg">
                        <Filter className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        Advanced Search
                      </SheetTitle>
                      <SheetDescription className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        Use these filters for detailed transaction searches. For quick searches, use the main search bar for transaction numbers, extension IDs, customer names, or phone numbers.
                      </SheetDescription>
                    </SheetHeader>
                    
                    <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
                      {/* Loan Amount Range Card */}
                      <Card className="border-slate-200 dark:border-slate-700 shadow-sm dark:bg-slate-800/50">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Loan Amount Range</Label>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label htmlFor="minLoanAmount" className="text-xs text-slate-500 dark:text-slate-400 font-medium">Minimum</Label>
                              <div className="relative">
                                <span className="absolute left-3 text-slate-500 dark:text-slate-400 text-sm pointer-events-none" style={{top: '50%', transform: 'translateY(-40%)', lineHeight: '1'}}>$</span>
                                <Input
                                  id="minLoanAmount"
                                  type="number"
                                  placeholder="Min amount"
                                  step="1"
                                  min="0"
                                  max="10000"
                                  className={`pl-6 h-9 ${filterErrors.minLoanAmount ? 'border-red-500 focus:border-red-500' : ''}`}
                                  value={searchFields.minLoanAmount}
                                  onChange={(e) => setSearchFields(prev => ({ ...prev, minLoanAmount: e.target.value }))}
                                />
                              </div>
                              {filterErrors.minLoanAmount && (
                                <p className="text-xs text-red-500 mt-1">{filterErrors.minLoanAmount}</p>
                              )}
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="maxLoanAmount" className="text-xs text-slate-500 dark:text-slate-400 font-medium">Maximum</Label>
                              <div className="relative">
                                <span className="absolute left-3 text-slate-500 dark:text-slate-400 text-sm pointer-events-none" style={{top: '50%', transform: 'translateY(-40%)', lineHeight: '1'}}>$</span>
                                <Input
                                  id="maxLoanAmount"
                                  type="number"
                                  placeholder="Max amount"
                                  step="1"
                                  min="0"
                                  max="10000"
                                  className={`pl-6 h-9 ${filterErrors.maxLoanAmount ? 'border-red-500 focus:border-red-500' : ''}`}
                                  value={searchFields.maxLoanAmount}
                                  onChange={(e) => setSearchFields(prev => ({ ...prev, maxLoanAmount: e.target.value }))}
                                />
                              </div>
                              {filterErrors.maxLoanAmount && (
                                <p className="text-xs text-red-500 mt-1">{filterErrors.maxLoanAmount}</p>
                              )}
                            </div>
                          </div>
                          {filterErrors.loanAmount && (
                            <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                <span>⚠️</span> {filterErrors.loanAmount}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      
                      {/* Days Overdue Card */}
                      <Card className="border-slate-200 dark:border-slate-700 shadow-sm dark:bg-slate-800/50">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Calendar className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Days Overdue</Label>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label htmlFor="minDaysOverdue" className="text-xs text-slate-500 dark:text-slate-400 font-medium">Minimum Days</Label>
                              <Input
                                id="minDaysOverdue"
                                type="number"
                                placeholder="Min days"
                                min="0"
                                max="10000"
                                className={`h-9 ${filterErrors.minDaysOverdue ? 'border-red-500 focus:border-red-500' : ''}`}
                                value={searchFields.minDaysOverdue}
                                onChange={(e) => setSearchFields(prev => ({ ...prev, minDaysOverdue: e.target.value }))}
                              />
                              {filterErrors.minDaysOverdue && (
                                <p className="text-xs text-red-500 mt-1">{filterErrors.minDaysOverdue}</p>
                              )}
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="maxDaysOverdue" className="text-xs text-slate-500 dark:text-slate-400 font-medium">Maximum Days</Label>
                              <Input
                                id="maxDaysOverdue"
                                type="number"
                                placeholder="Max days"
                                min="0"
                                max="10000"
                                className={`h-9 ${filterErrors.maxDaysOverdue ? 'border-red-500 focus:border-red-500' : ''}`}
                                value={searchFields.maxDaysOverdue}
                                onChange={(e) => setSearchFields(prev => ({ ...prev, maxDaysOverdue: e.target.value }))}
                              />
                              {filterErrors.maxDaysOverdue && (
                                <p className="text-xs text-red-500 mt-1">{filterErrors.maxDaysOverdue}</p>
                              )}
                            </div>
                          </div>
                          
                          {filterErrors.daysOverdue && (
                            <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                <span>⚠️</span> {filterErrors.daysOverdue}
                              </p>
                            </div>
                          )}
                          
                          {/* Helper text for Days Overdue filter */}
                          {(searchFields.minDaysOverdue || searchFields.maxDaysOverdue) && !filterErrors.daysOverdue && (
                            <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                              <div className="flex items-start gap-2">
                                <div className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5">ℹ️</div>
                                <div className="text-xs text-blue-700 dark:text-blue-300">
                                  <strong>Note:</strong> Days Overdue counts from when the transaction became overdue (day after maturity date) to today. Only applies to "Overdue" status transactions.
                                  {filters.status !== 'overdue' && (
                                    <span className="block mt-1 font-medium">
                                      Click "Apply Filters" to automatically switch to Overdue status.
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      
                      {/* Date Ranges Card */}
                      <Card className="border-slate-200 dark:border-slate-700 shadow-sm dark:bg-slate-800/50">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-4">
                            <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Date Ranges</Label>
                          </div>
                          
                          {/* Pawn Date Range */}
                          <div className="space-y-3 mb-4">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-400 dark:bg-blue-500 rounded-full"></div>
                              <Label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Pawn Date Range</Label>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label htmlFor="pawnDateFrom" className="text-xs text-slate-500 dark:text-slate-400">From</Label>
                                <Input
                                  id="pawnDateFrom"
                                  type="date"
                                  placeholder="Start date"
                                  min="2020-01-01"
                                  max={new Date(new Date().getFullYear() + 1, 11, 31).toISOString().split('T')[0]}
                                  className={`h-9 text-sm ${filterErrors.pawnDateFrom ? 'border-red-500 focus:border-red-500' : ''}`}
                                  value={searchFields.pawnDateFrom}
                                  onChange={(e) => setSearchFields(prev => ({ ...prev, pawnDateFrom: e.target.value }))}
                                />
                                {filterErrors.pawnDateFrom && (
                                  <p className="text-xs text-red-500 mt-1">{filterErrors.pawnDateFrom}</p>
                                )}
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="pawnDateTo" className="text-xs text-slate-500 dark:text-slate-400">To</Label>
                                <Input
                                  id="pawnDateTo"
                                  type="date"
                                  placeholder="End date"
                                  min="2020-01-01"
                                  max={new Date(new Date().getFullYear() + 1, 11, 31).toISOString().split('T')[0]}
                                  className={`h-9 text-sm ${filterErrors.pawnDateTo ? 'border-red-500 focus:border-red-500' : ''}`}
                                  value={searchFields.pawnDateTo}
                                  onChange={(e) => setSearchFields(prev => ({ ...prev, pawnDateTo: e.target.value }))}
                                />
                                {filterErrors.pawnDateTo && (
                                  <p className="text-xs text-red-500 mt-1">{filterErrors.pawnDateTo}</p>
                                )}
                              </div>
                            </div>
                            {filterErrors.pawnDateRange && (
                              <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                  <span>⚠️</span> {filterErrors.pawnDateRange}
                                </p>
                              </div>
                            )}
                          </div>
                          
                          {/* Maturity Date Range */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-purple-400 dark:bg-purple-500 rounded-full"></div>
                              <Label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Maturity Date Range</Label>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label htmlFor="maturityDateFrom" className="text-xs text-slate-500 dark:text-slate-400">From</Label>
                                <Input
                                  id="maturityDateFrom"
                                  type="date"
                                  placeholder="Start date"
                                  min="2020-01-01"
                                  max={new Date(new Date().getFullYear() + 1, 11, 31).toISOString().split('T')[0]}
                                  className={`h-9 text-sm ${filterErrors.maturityDateFrom ? 'border-red-500 focus:border-red-500' : ''}`}
                                  value={searchFields.maturityDateFrom}
                                  onChange={(e) => setSearchFields(prev => ({ ...prev, maturityDateFrom: e.target.value }))}
                                />
                                {filterErrors.maturityDateFrom && (
                                  <p className="text-xs text-red-500 mt-1">{filterErrors.maturityDateFrom}</p>
                                )}
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="maturityDateTo" className="text-xs text-slate-500 dark:text-slate-400">To</Label>
                                <Input
                                  id="maturityDateTo"
                                  type="date"
                                  placeholder="End date"
                                  min="2020-01-01"
                                  max={new Date(new Date().getFullYear() + 1, 11, 31).toISOString().split('T')[0]}
                                  className={`h-9 text-sm ${filterErrors.maturityDateTo ? 'border-red-500 focus:border-red-500' : ''}`}
                                  value={searchFields.maturityDateTo}
                                  onChange={(e) => setSearchFields(prev => ({ ...prev, maturityDateTo: e.target.value }))}
                                />
                                {filterErrors.maturityDateTo && (
                                  <p className="text-xs text-red-500 mt-1">{filterErrors.maturityDateTo}</p>
                                )}
                              </div>
                            </div>
                            {filterErrors.maturityDateRange && (
                              <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                  <span>⚠️</span> {filterErrors.maturityDateRange}
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="sticky bottom-0 pt-4 pb-2 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex space-x-3">
                        <Button 
                          onClick={clearSearchFields} 
                          variant="outline" 
                          className="flex-1 h-10 border-slate-300 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Clear All
                        </Button>
                        <Button 
                          variant="default" 
                          className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={Object.keys(filterErrors).length > 0}
                          onClick={() => {
                            // Trigger re-filtering by updating a state that causes re-render
                            // The filters are already applied automatically in the filteredAndSortedTransactions
                            // This button provides visual feedback that filters are being applied
                            const hasActiveFilters = Object.values(searchFields).some(v => v);
                            
                            // If Days Overdue filters are used, automatically set status to "overdue" 
                            // to ensure we can see the overdue transactions
                            const hasDaysOverdueFilter = searchFields.minDaysOverdue || searchFields.maxDaysOverdue;
                            if (hasDaysOverdueFilter && filters.status !== 'overdue') {
                              setFilters(prev => ({ 
                                ...prev, 
                                status: 'overdue'
                              }));
                            }
                            
                            if (hasActiveFilters) {
                              // Force a refresh to ensure the latest data is filtered
                              forceRefresh();
                            }
                            // Auto-close the filter sidebar after applying filters
                            setIsFilterSheetOpen(false);
                          }}
                        >
                          {isFilterPending ? (
                            <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          ) : (
                            <Search className="h-4 w-4 mr-2" />
                          )}
                          {isFilterPending ? 'Applying...' : 'Apply Filters'}
                        </Button>
                      </div>
                      
                      {/* Active Filters Count */}
                      {Object.values(searchFields).some(v => v) && (
                        <div className="mt-3 text-center">
                          <Badge variant="secondary" className="text-xs px-2 py-1">
                            {Object.values(searchFields).filter(v => v).length} active filter{Object.values(searchFields).filter(v => v).length !== 1 ? 's' : ''}
                          </Badge>
                          {isFilterPending && (
                            <div className="mt-2">
                              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                                <div className="w-3 h-3 animate-spin rounded-full border border-amber-500 border-t-transparent"></div>
                                Filters will apply in 0.5s...
                              </span>
                            </div>
                          )}
                        </div>
                      )}
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
      {!loading && paginatedTransactions.length > 0 && (
        <div className="space-y-4">
          {/* Results Summary & View Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl border border-blue-200/30 dark:border-blue-800/30">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {effectiveTotalTransactions} result{effectiveTotalTransactions !== 1 ? 's' : ''}
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
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBulkStatusDialog(true)}
                    className="h-8 px-3 bg-blue-500 text-white hover:bg-blue-600 border-blue-600"
                  >
                    Update Status
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBulkNotesDialog(true)}
                    className="h-8 px-3 bg-green-500 text-white hover:bg-green-600 border-green-600"
                  >
                    Add Notes
                  </Button>
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
                          checked={selectedTransactionIds.length === paginatedTransactions.length && paginatedTransactions.length > 0}
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
                    {paginatedTransactions.map((transaction, index) => (
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
                            {['active', 'overdue', 'extended'].includes(getEffectiveTransactionStatus(transaction)) ? (
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
                                {getEffectiveTransactionStatus(transaction) === 'redeemed' ? 'Paid' : 'N/A'}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <StatusBadge status={getEffectiveTransactionStatus(transaction)} />
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
                            {['active', 'overdue', 'extended'].includes(getEffectiveTransactionStatus(transaction)) && (
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
              {paginatedTransactions.map((transaction) => (
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
      {!loading && effectiveTotalTransactions === 0 && !error && allTransactionsCounts.all !== undefined && (
        <Card className="border-0 shadow-xl bg-gradient-to-br from-white/90 to-slate-50/90 dark:from-slate-900/90 dark:to-slate-800/90 backdrop-blur-sm">
          <CardContent className="text-center py-16">
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-3xl flex items-center justify-center mx-auto shadow-lg border border-blue-200/50 dark:border-blue-800/50">
                <CreditCard className="w-12 h-12 text-blue-600 dark:text-blue-400" />
              </div>
              {activeSearchTerm || filters.status || Object.values(searchFields).some(v => v) ? (
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
              {activeSearchTerm || filters.status || Object.values(searchFields).some(v => v) ? 'No Matching Transactions' : 'Ready to Start'}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
              {activeSearchTerm || filters.status || Object.values(searchFields).some(v => v) ? 
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
                  Object.values(searchFields).some(v => v) ?
                  'No transactions match your advanced search criteria. Try adjusting your filters.' :
                  'No transactions match your filters.'
                ) : 
                'Create your first pawn transaction to begin managing loans and tracking customer activity.'
              }
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {(activeSearchTerm || filters.status || Object.values(searchFields).some(v => v)) && (
                <Button 
                  variant="outline"
                  onClick={() => {
                    const emptyFields = { 
                      minLoanAmount: '',
                      maxLoanAmount: '',
                      minDaysOverdue: '',
                      maxDaysOverdue: '',
                      pawnDateFrom: '',
                      pawnDateTo: '',
                      maturityDateFrom: '',
                      maturityDateTo: ''
                    };
                    
                    setSearchTerm('');
                    setActiveSearchTerm('');
                    setFilters({ status: '', page_size: 10, sortBy: 'updated_at', sortOrder: 'desc' });
                    setSearchFields(emptyFields);
                    setDebouncedSearchFields(emptyFields); // Clear debounced fields immediately
                    setFilterErrors({});
                    setIsFilterPending(false);
                    setCurrentPage(1);
                    setTransactionsPerPage(10);
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

      {/* Enhanced Pagination - Always show if there are transactions */}
      {effectiveTotalTransactions > 0 && (
        <div className="!mt-0 mb-0 flex items-center justify-between px-6 py-2">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground font-medium">
              Showing {Math.min((currentPage - 1) * transactionsPerPage + 1, effectiveTotalTransactions)}-{Math.min(currentPage * transactionsPerPage, effectiveTotalTransactions)} of {effectiveTotalTransactions} transactions
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show:</span>
              <Select
                value={transactionsPerPage.toString()}
                onValueChange={(value) => {
                  setTransactionsPerPage(parseInt(value));
                  setCurrentPage(1); // Reset to first page when changing page size
                }}
              >
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {totalPages > 1 && (
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
          )}
        </div>
      )}

      {/* Bulk Status Update Dialog */}
      <BulkStatusUpdateDialog
        isOpen={showBulkStatusDialog}
        onClose={() => setShowBulkStatusDialog(false)}
        selectedTransactions={transactions.filter(t => selectedTransactionIds.includes(t.transaction_id))}
        onSuccess={() => {
          setSelectedTransactionIds([]);
          handleRefresh();
        }}
      />

      {/* Bulk Notes Dialog */}
      <BulkNotesDialog
        isOpen={showBulkNotesDialog}
        onClose={() => setShowBulkNotesDialog(false)}
        selectedTransactions={transactions.filter(t => selectedTransactionIds.includes(t.transaction_id))}
        onSuccess={() => {
          setSelectedTransactionIds([]);
          handleRefresh();
        }}
      />

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
                    Status: <span className="capitalize font-medium">{getEffectiveTransactionStatus(selectedTransactionItems)}</span>
                  </p>
                </div>
                <StatusBadge status={getEffectiveTransactionStatus(selectedTransactionItems)} />
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