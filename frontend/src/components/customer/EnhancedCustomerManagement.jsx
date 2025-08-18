import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, 
  Filter, 
  MoreHorizontal, 
  Eye, 
  Edit2, 
  User, 
  TrendingUp,
  ChevronUp,
  ChevronDown,
  CreditCard,
  Mail,
  Phone,
  Settings,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Archive,
  Calendar,
  TrendingDown,
  Banknote,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
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
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Progress } from '../ui/progress';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card';
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
import CustomerDialog from './CustomerDialog';
import LoanEligibilityManager from './LoanEligibilityManager';
import { useToast } from '../ui/toast';
import { useAuth } from '../../context/AuthContext';

const EnhancedCustomerManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [customerStats, setCustomerStats] = useState({
    total: 0,
    active: 0,
    suspended: 0,
    archived: 0
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
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const customersPerPage = 10;
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [advancedFilters, setAdvancedFilters] = useState({
    status: 'all',
    creditLimit: 'all',
    paymentHistory: 'all',
    riskLevel: 'all'
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveConfirmation, setArchiveConfirmation] = useState('');
  const [showBulkActivateDialog, setShowBulkActivateDialog] = useState(false);
  const [showBulkSuspendDialog, setShowBulkSuspendDialog] = useState(false);
  const [showBulkArchiveDialog, setShowBulkArchiveDialog] = useState(false);
  const [bulkConfirmation, setBulkConfirmation] = useState('');

  const isAdmin = user?.role === 'admin';

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

  // Helper function to check if advanced search is active (for Clear button logic)
  const isAdvancedSearchActive = () => {
    return searchFields.firstName || searchFields.lastName || searchFields.phone || searchFields.email;
  };

  // Helper function to get current search term (for immediate actions)
  const getCurrentSearchTerm = () => {
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
  };

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
      await customerService.updateCustomer(selectedCustomer.phone_number, {
        ...selectedCustomer,
        status: 'suspended'
      });
      toast({
        title: 'Customer Suspended',
        description: 'Customer account has been suspended'
      });
      setShowDetails(false);
      setShowSuspendDialog(false);
      await loadCustomerList(currentPage, getCurrentSearchTerm(), statusFilter);
      await loadCustomerStats(); // Refresh stats when customer status changes
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to suspend customer',
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
      await customerService.archiveCustomer(selectedCustomer.phone_number, 'Admin action - permanent archive');
      toast({
        title: 'Customer Archived',
        description: 'Customer has been permanently archived'
      });
      setShowDetails(false);
      setShowArchiveDialog(false);
      setArchiveConfirmation('');
      await loadCustomerList(currentPage, getCurrentSearchTerm(), statusFilter);
      await loadCustomerStats(); // Refresh stats when customer is archived
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to archive customer',
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
    loadCustomerList(1, getCurrentSearchTerm(), advancedFilters.status === 'all' ? null : advancedFilters.status);
    
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
      riskLevel: 'all'
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
    
    // Load customers without filters
    loadCustomerList(1, '', null);
    
    // Show confirmation toast
    toast({
      title: 'Filters Cleared',
      description: 'All filters have been removed',
      duration: 2000
    });
  };

  // Load customer statistics
  const loadCustomerStats = useCallback(async () => {
    try {
      const stats = await customerService.getCustomerStatistics();
      if (stats) {
        setCustomerStats({
          total: stats.total_customers || 0,
          active: stats.active_customers || 0,
          suspended: stats.suspended_customers || 0,
          archived: stats.archived_customers || 0
        });
      }
    } catch (error) {
      console.error('Failed to load customer stats:', error);
    }
  }, []);

  // Load only customer list (for search/pagination) 
  const loadCustomerList = useCallback(async (page = 1, search = '', status = null) => {
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
      
      const response = await customerService.getAllCustomers(params);
      
      // Handle paginated response with metadata
      if (response && response.customers) {
        setCustomers(response.customers);
        setTotalCustomers(response.total || 0);
        setCustomerListError(null);
      } else {
        // Fallback for unexpected response
        setCustomers([]);
        setTotalCustomers(0);
      }
      
    } catch (error) {
      console.error('Failed to load customers:', error);
      
      // Enhanced error handling for different error types
      let errorMessage = 'Failed to load customers';
      let userMessage = 'Failed to load customers';
      
      if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
        errorMessage = 'Rate limit exceeded - too many requests';
        userMessage = 'System is busy. Please wait a moment and try again.';
        
        // Auto-retry after rate limit delay with current parameters
        setTimeout(() => {
          console.log('🔄 Auto-retrying after rate limit...');
          loadCustomerList(page, search, status);
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
  }, [customersPerPage, sortField, sortOrder, toast]);

  // Load full page data (initial load with stats)
  const loadCustomers = useCallback(async (page = 1, search = '', status = null) => {
    setLoading(true);
    try {
      // Load stats and customer list in parallel
      await Promise.all([
        loadCustomerStats(),
        loadCustomerList(page, search, status)
      ]);
    } catch (error) {
      console.error('Failed to load initial data:', error);
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
        loadCustomers(currentPage, searchTerm, statusFilter);
      } else {
        // Subsequent loads - only get customer list
        loadCustomerList(currentPage, searchTerm, statusFilter);
      }
    };
    
    if (timeSinceLastCall >= 500) {
      makeRequest();
    } else {
      // Debounce rapid requests
      const timeoutId = setTimeout(makeRequest, 500 - timeSinceLastCall);
      return () => clearTimeout(timeoutId);
    }
  }, [currentPage, debouncedSearchQuery, debouncedSearchFields, statusFilter, sortField, sortOrder, loadCustomers, loadCustomerList]);

  // For server-side pagination, we don't need client-side filtering
  const totalPages = Math.ceil(totalCustomers / customersPerPage);
  const currentCustomers = customers; // Use the loaded customers directly

  // Reset to page 1 when search or filters change (immediate response for UI)
  useEffect(() => {
    setCurrentPage(1);
    setSelectedCustomerIds([]); // Clear selections when filters change
  }, [searchQuery, searchFields, statusFilter]);


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
          console.error(`Failed to update customer ${phoneNumber}:`, error);
        }
      }

      // Refresh data
      await loadCustomerList(currentPage, getCurrentSearchTerm(), statusFilter);
      await loadCustomerStats();
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

  const handleEditCustomer = (customer) => {
    if (user?.role === 'admin') {
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

  const handleCustomerSaved = async () => {
    setShowAddDialog(false);
    setEditingCustomer(null);
    
    // Refresh both customer list and stats
    await Promise.all([
      loadCustomerList(currentPage, getCurrentSearchTerm(), statusFilter),
      loadCustomerStats() // Refresh stats including Eligible for Loans count
    ]);
    
    // If we have a selected customer open, refresh their data
    if (selectedCustomer && showDetails) {
      try {
        const updatedCustomer = await customerService.getCustomerByPhone(selectedCustomer.phone_number);
        if (updatedCustomer) {
          setSelectedCustomer(updatedCustomer);
        }
      } catch (error) {
        console.error('Failed to refresh selected customer:', error);
      }
    }
  };

  const getStatusVariant = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'default';
      case 'suspended':
        return 'secondary';
      case 'banned':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
      <div className="min-h-screen bg-background">
        <div className="border-b">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold">Customer Management</h1>
                <p className="text-muted-foreground">Manage your customer base and relationships</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">Loading customers...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Enhanced Header with Statistics */}
      <div className="border-b bg-background">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Customer Management</h1>
              <p className="text-muted-foreground">Manage your customer base and relationships</p>
            </div>
            <Button 
              size="lg"
              onClick={() => {
                setEditingCustomer(null);
                setShowAddDialog(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Customer
            </Button>
          </div>

          {/* Customer Stats Cards */}
          <div className={`grid grid-cols-1 gap-4 mb-6 ${isAdmin ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
            <Card className="transition-all hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <CreditCard className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-muted-foreground">Eligible for Loans</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{customerStats.active}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="transition-all hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-muted-foreground">Due Today</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">3</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="transition-all hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">7</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="transition-all hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                    <Banknote className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-muted-foreground">Collections</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">$2,450</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Admin-only operational stats */}
            {isAdmin && (
              <>
                <Card className="transition-all hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                        <TrendingDown className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-muted-foreground">At Risk</p>
                        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">5</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
              </>
            )}
          </div>

          {/* Search & Filter Section */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-4">
              {/* Main Search Row */}
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Primary Search */}
                <div className="flex-1">
                  <div className="space-y-1">
                    <div className="relative">
                      <Command className="rounded-lg border h-10">
                        <CommandInput 
                          placeholder="🔍 Search by name, phone, or email..." 
                          value={searchQuery}
                          onValueChange={setSearchQuery}
                          className="h-10 pr-10"
                        />
                      </Command>
                      {searchLoading && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Status Filter */}
                <div className="lg:w-48">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="All Customers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Customers</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={clearSearchFields}
                    className="h-10 px-4"
                    disabled={!searchQuery && !isAdvancedSearchActive() && statusFilter === 'all'}
                  >
                    {searchQuery || isAdvancedSearchActive() || statusFilter !== 'all' ? 'Clear All' : 'Clear'}
                  </Button>
                  <Sheet open={showFilters} onOpenChange={setShowFilters}>
                    <SheetTrigger asChild>
                      <Button variant="outline" className="h-10 px-4 gap-2">
                        <Filter className="h-4 w-4" />
                        Filters
                      </Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Quick Filters</SheetTitle>
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
                        
                        <div>
                          <label className="text-sm font-medium">Payment History Score <span className="text-xs text-muted-foreground">(Coming Soon)</span></label>
                          <Select 
                            value={advancedFilters.paymentHistory} 
                            onValueChange={(value) => setAdvancedFilters(prev => ({ ...prev, paymentHistory: value }))}
                            disabled
                          >
                            <SelectTrigger className="mt-1" disabled>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Scores</SelectItem>
                              <SelectItem value="excellent">🟢 Excellent (90-100)</SelectItem>
                              <SelectItem value="good">🟡 Good (70-89)</SelectItem>
                              <SelectItem value="poor">🔴 Poor (Below 70)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium">Risk Level <span className="text-xs text-muted-foreground">(Coming Soon)</span></label>
                          <Select 
                            value={advancedFilters.riskLevel} 
                            onValueChange={(value) => setAdvancedFilters(prev => ({ ...prev, riskLevel: value }))}
                            disabled
                          >
                            <SelectTrigger className="mt-1" disabled>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Risk Levels</SelectItem>
                              <SelectItem value="low">🟢 Low Risk</SelectItem>
                              <SelectItem value="medium">🟡 Medium Risk</SelectItem>
                              <SelectItem value="high">🔴 High Risk</SelectItem>
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

              {/* Advanced Search Fields (Collapsible) */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Advanced Search</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Input
                        placeholder="👤 First name..."
                        value={searchFields.firstName}
                        onChange={(e) => setSearchFields(prev => ({ ...prev, firstName: e.target.value }))}
                        className="h-10 text-sm"
                      />
                    </div>
                    <div>
                      <Input
                        placeholder="👤 Last name..."
                        value={searchFields.lastName}
                        onChange={(e) => setSearchFields(prev => ({ ...prev, lastName: e.target.value }))}
                        className="h-10 text-sm"
                      />
                    </div>
                    <div>
                      <Input
                        placeholder="📞 Phone number..."
                        value={searchFields.phone}
                        onChange={(e) => setSearchFields(prev => ({ ...prev, phone: e.target.value }))}
                        className="h-10 text-sm"
                      />
                    </div>
                    <div>
                      <Input
                        placeholder="📧 Email address..."
                        value={searchFields.email}
                        onChange={(e) => setSearchFields(prev => ({ ...prev, email: e.target.value }))}
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Enhanced Customer Table */}
      <div className="p-6">
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

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={currentCustomers.length > 0 && selectedCustomerIds.length === currentCustomers.length}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all customers"
                  />
                </TableHead>
                <TableHead className="w-[300px]">
                  <button 
                    className="flex items-center gap-2 hover:text-foreground"
                    onClick={() => handleSort('customer')}
                  >
                    Customer {getSortIcon('customer')}
                  </button>
                </TableHead>
                <TableHead>
                  <button 
                    className="flex items-center gap-2 hover:text-foreground"
                    onClick={() => handleSort('contact')}
                  >
                    Contact {getSortIcon('contact')}
                  </button>
                </TableHead>
                <TableHead>
                  <button 
                    className="flex items-center gap-2 hover:text-foreground"
                    onClick={() => handleSort('status')}
                  >
                    Status {getSortIcon('status')}
                  </button>
                </TableHead>
                <TableHead>
                  <button 
                    className="flex items-center gap-2 hover:text-foreground"
                    onClick={() => handleSort('loan_activity')}
                  >
                    Loan Activity {getSortIcon('loan_activity')}
                  </button>
                </TableHead>
                <TableHead>
                  <button 
                    className="flex items-center gap-2 hover:text-foreground"
                    onClick={() => handleSort('last_visit')}
                  >
                    Last Visit {getSortIcon('last_visit')}
                  </button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                          onClick={() => loadCustomerList(currentPage, getCurrentSearchTerm(), statusFilter)}
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
                        {searchQuery || statusFilter !== 'all' ? 'No customers found' : 'No customers yet'}
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
                        <Badge variant={getStatusVariant(customer.status)}>
                          {customer.status}
                        </Badge>
                        {customer.status === 'active' && (
                          <HoverCard>
                            <HoverCardTrigger>
                              <div className={`w-3 h-3 rounded-full cursor-help ${
                                customer.risk_level === 'high' ? 'bg-red-500' :
                                customer.risk_level === 'medium' ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`} />
                            </HoverCardTrigger>
                            <HoverCardContent>
                              <div className="space-y-2">
                                <p className="font-medium">Loan Risk Assessment</p>
                                <p className="text-sm">
                                  Risk Level: <span className="font-medium">
                                    {customer.risk_level === 'high' ? 'High Risk' :
                                     customer.risk_level === 'medium' ? 'Medium Risk' :
                                     'Low Risk'}
                                  </span>
                                </p>
                                <p className="text-sm">Credit Limit: ${(customer.credit_limit || 1000).toLocaleString()}</p>
                                <p className="text-sm">Payment Score: {customer.payment_history_score || 80}/100</p>
                                <p className="text-sm">Defaults: {customer.default_count || 0}</p>
                                <p className="text-sm text-muted-foreground">
                                  Risk based on payment history and default count
                                </p>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>Active: {customer.active_loans || 0}</span>
                        </div>
                        <Progress 
                          value={Math.min(((customer.active_loans || 0) / 5) * 100, 100)} 
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
      </div>

      {/* Enhanced Customer Details Sheet */}
      <Sheet open={showDetails} onOpenChange={setShowDetails}>
        <SheetContent className="w-full sm:w-[600px] sm:max-w-[600px] max-w-full">
          <SheetHeader>
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                <AvatarImage 
                  src={selectedCustomer && getCustomerAvatarUrl(selectedCustomer)} 
                  alt={selectedCustomer && customerService.getCustomerFullName(selectedCustomer)}
                />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {selectedCustomer && getCustomerInitials(selectedCustomer)}
                </AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle>
                  {selectedCustomer && customerService.getCustomerFullName(selectedCustomer)}
                </SheetTitle>
                <p className="text-muted-foreground">
                  {selectedCustomer && customerService.formatPhoneNumber(selectedCustomer.phone_number)}
                </p>
              </div>
            </div>
          </SheetHeader>

          {selectedCustomer && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
              <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <TabsTrigger value="overview" className="text-xs sm:text-sm font-semibold">
                  Overview & Eligibility
                </TabsTrigger>
                <TabsTrigger value="transactions" className="text-xs sm:text-sm">Transactions</TabsTrigger>
                <TabsTrigger value="notes" className="text-xs sm:text-sm">Notes</TabsTrigger>
                {isAdmin && (
                  <TabsTrigger value="admin" className="text-xs sm:text-sm">Admin</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="overview" className="space-y-6 mt-6">
                {/* Customer Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{selectedCustomer.active_loans || 0}</p>
                        <p className="text-sm text-muted-foreground">Active Loans</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">${(selectedCustomer.total_paid || 0).toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">Total Paid</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Phone:</span>
                      </div>
                      <span className="font-mono">{customerService.formatPhoneNumber(selectedCustomer.phone_number)}</span>
                    </div>
                    {selectedCustomer.email && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Email:</span>
                        </div>
                        <span>{selectedCustomer.email}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Member Since:</span>
                      <span>{formatDate(selectedCustomer.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant={getStatusVariant(selectedCustomer.status)}>
                        {selectedCustomer.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Comprehensive Loan Eligibility Management */}
                <LoanEligibilityManager 
                  customer={selectedCustomer}
                  onEligibilityUpdate={(eligibilityData) => {
                    // Update only the selected customer data, don't reload entire list
                    setSelectedCustomer(prev => ({
                      ...prev,
                      credit_limit: eligibilityData.credit_limit,
                      available_credit: eligibilityData.available_credit
                    }));
                  }}
                />
              </TabsContent>

              <TabsContent value="transactions" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Transaction history will be displayed here</p>
                      <p className="text-sm">This feature is coming soon</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedCustomer.notes ? (
                      <div className="space-y-4">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed p-4 bg-muted/50 rounded-lg border max-h-96 overflow-y-auto">
                          {selectedCustomer.notes}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Last updated: {selectedCustomer.updated_at ? formatDate(selectedCustomer.updated_at) : 'Unknown'}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No notes available for this customer</p>
                        <p className="text-xs mt-2">Notes can be added when editing customer details</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {isAdmin && (
                <TabsContent value="admin" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-red-600 flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Admin Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Nested Admin Tabs */}
                      <Tabs defaultValue="customer-details" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="customer-details" className="text-xs">
                            Customer Details
                          </TabsTrigger>
                          <TabsTrigger value="loan-management" className="text-xs">
                            Loan Management
                          </TabsTrigger>
                          <TabsTrigger value="account-actions" className="text-xs">
                            Account Actions
                          </TabsTrigger>
                        </TabsList>

                        {/* Customer Details Management Tab */}
                        <TabsContent value="customer-details" className="mt-4">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Edit2 className="h-4 w-4" />
                                Edit Customer Details
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="text-sm text-muted-foreground mb-4">
                                Modify customer information, contact details, and account settings.
                              </div>
                              
                              <Button 
                                className="w-full justify-start"
                                onClick={() => {
                                  setEditingCustomer(selectedCustomer);
                                  setShowAddDialog(true);
                                  setShowDetails(false);
                                }}
                              >
                                <Edit2 className="mr-2 h-4 w-4" />
                                Open Customer Editor
                              </Button>

                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="font-medium">Name:</span>
                                  <p className="text-muted-foreground">{customerService.getCustomerFullName(selectedCustomer)}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Phone:</span>
                                  <p className="text-muted-foreground font-mono">{customerService.formatPhoneNumber(selectedCustomer.phone_number)}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Email:</span>
                                  <p className="text-muted-foreground">{selectedCustomer.email || 'Not provided'}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Status:</span>
                                  <Badge variant={getStatusVariant(selectedCustomer.status)} className="ml-1">
                                    {selectedCustomer.status}
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </TabsContent>

                        {/* Loan Management Tab */}
                        <TabsContent value="loan-management" className="mt-4">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Manage Loan Eligibility
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="text-sm text-muted-foreground mb-4">
                                Comprehensive loan eligibility management with credit limits and risk assessment.
                              </div>
                              
                              <Button 
                                className="w-full justify-start"
                                onClick={() => {
                                  // Switch to overview tab to see comprehensive loan eligibility
                                  setActiveTab('overview');
                                  toast({
                                    title: 'Loan Eligibility Management',
                                    description: 'Switched to Overview tab for comprehensive loan eligibility tools.',
                                    duration: 3000
                                  });
                                }}
                              >
                                <TrendingUp className="mr-2 h-4 w-4" />
                                Open Loan Eligibility Manager
                              </Button>

                              {/* Quick Loan Info */}
                              <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">Active Loans</p>
                                  <p className="text-lg font-bold text-blue-600">{selectedCustomer.active_loans || 0}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">Total Borrowed</p>
                                  <p className="text-lg font-bold text-green-600">${(selectedCustomer.total_borrowed || 0).toLocaleString()}</p>
                                </div>
                              </div>

                              <div className="text-xs text-muted-foreground">
                                💡 Use the Overview tab for full loan eligibility management including credit limits, loan calculators, and detailed risk assessment.
                              </div>
                            </CardContent>
                          </Card>
                        </TabsContent>

                        {/* Account Actions Tab */}
                        <TabsContent value="account-actions" className="mt-4">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2 text-red-600">
                                <AlertTriangle className="h-4 w-4" />
                                Account Actions
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="text-sm text-muted-foreground mb-4">
                                <strong>⚠️ Warning:</strong> These actions will affect the customer's account status and access.
                              </div>

                              {/* Suspend Account */}
                              <Card className="border-yellow-200">
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between mb-3">
                                    <div>
                                      <h4 className="font-medium text-yellow-800">Suspend Account</h4>
                                      <p className="text-sm text-muted-foreground">Temporarily disable customer access</p>
                                    </div>
                                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                      Reversible
                                    </Badge>
                                  </div>
                                  <Button 
                                    variant="outline"
                                    className="w-full border-yellow-300 text-yellow-800 hover:bg-yellow-50"
                                    onClick={() => setShowSuspendDialog(true)}
                                  >
                                    <User className="mr-2 h-4 w-4" />
                                    Suspend Account
                                  </Button>
                                </CardContent>
                              </Card>

                              {/* Archive Customer */}
                              <Card className="border-red-200">
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between mb-3">
                                    <div>
                                      <h4 className="font-medium text-red-800">Archive Customer</h4>
                                      <p className="text-sm text-muted-foreground">Permanently archive customer record</p>
                                    </div>
                                    <Badge variant="destructive">
                                      Permanent
                                    </Badge>
                                  </div>
                                  <Button 
                                    variant="destructive"
                                    className="w-full"
                                    onClick={() => setShowArchiveDialog(true)}
                                  >
                                    <Archive className="mr-2 h-4 w-4" />
                                    Archive Customer
                                  </Button>
                                </CardContent>
                              </Card>

                              <div className="text-xs text-muted-foreground p-2 bg-red-50 rounded border-l-4 border-red-200">
                                <strong>Note:</strong> All actions are logged with your admin ID and timestamp for audit purposes.
                              </div>
                            </CardContent>
                          </Card>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      {/* Suspend Customer Confirmation Dialog */}
      <Dialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              Suspend Customer Account
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to suspend {selectedCustomer?.first_name} {selectedCustomer?.last_name}'s account?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-2">This action will:</h4>
              <ul className="space-y-1 text-sm text-yellow-700">
                <li>• Prevent new loans from being created</li>
                <li>• Maintain all existing loan records</li>
                <li>• Allow account reactivation later</li>
                <li>• Be logged for audit purposes</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowSuspendDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              className="bg-yellow-600 hover:bg-yellow-700"
              onClick={handleSuspendCustomer}
            >
              <User className="mr-2 h-4 w-4" />
              Suspend Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Customer Confirmation Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              ⚠️ Permanent Action Warning
            </DialogTitle>
            <DialogDescription>
              You are about to permanently archive {selectedCustomer?.first_name} {selectedCustomer?.last_name}'s account.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-medium text-red-800 mb-2">This action will:</h4>
              <ul className="space-y-1 text-sm text-red-700">
                <li>• Permanently archive all records</li>
                <li>• Cannot be undone</li>
                <li>• Remove customer from active lists</li>
                <li>• Be logged with your admin ID</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="archiveConfirm" className="text-sm font-medium">
                Type <strong>ARCHIVE</strong> to confirm this permanent action:
              </Label>
              <Input
                id="archiveConfirm"
                value={archiveConfirmation}
                onChange={(e) => setArchiveConfirmation(e.target.value)}
                placeholder="Type ARCHIVE here"
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowArchiveDialog(false);
                setArchiveConfirmation('');
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleArchiveCustomer}
              disabled={archiveConfirmation !== 'ARCHIVE'}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Activate Confirmation Dialog */}
      <Dialog open={showBulkActivateDialog} onOpenChange={setShowBulkActivateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-800">
              <AlertTriangle className="h-5 w-5" />
              ⚠️ Bulk Activate Confirmation
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
              <AlertTriangle className="h-5 w-5" />
              ⚠️ Bulk Suspend Warning
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
              <AlertTriangle className="h-5 w-5" />
              ⚠️ Permanent Bulk Action Warning
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
    </div>
  );
};

export default EnhancedCustomerManagement;