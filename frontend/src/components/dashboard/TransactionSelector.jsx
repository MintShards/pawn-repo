import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, CheckCircle, AlertCircle, User, Phone, Loader2, FileSearch, Package, Calendar, Eye } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import transactionService from '../../services/transactionService';
import customerService from '../../services/customerService';
import { formatTransactionId, formatCurrency } from '../../utils/transactionUtils';
import { formatBusinessDate } from '../../utils/timezoneUtils';
import StatusBadge from '../transaction/components/StatusBadge';
import { useDebounce } from '../../hooks/useDebounce';

const TransactionSelector = ({ onSelect, onCancel, title, subtitle, filterStatus }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMessage, setSearchMessage] = useState('');
  const [showItemsDialog, setShowItemsDialog] = useState(false);
  const [selectedTransactionItems, setSelectedTransactionItems] = useState(null);
  const searchInputRef = useRef(null);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Handle viewing items for a transaction
  const handleViewItems = async (e, transaction) => {
    e.stopPropagation(); // Prevent transaction selection
    try {
      // Fetch complete transaction summary with items
      const summary = await transactionService.getTransactionSummary(transaction.transaction_id);
      setSelectedTransactionItems({
        ...summary.transaction,
        customer: transaction.customer, // Preserve customer from list
        items: summary.items
      });
      setShowItemsDialog(true);
    } catch (error) {
      // Failed to fetch transaction summary - use basic data
      setSelectedTransactionItems(transaction);
      setShowItemsDialog(true);
    }
  };

  // Auto-focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Load transactions with backend search
  useEffect(() => {
    const loadTransactions = async () => {
      try {
        setLoading(true);
        setSearchMessage(''); // Clear previous messages

        // Determine search text: use debounced search term if available, otherwise load all
        const searchText = debouncedSearchTerm.trim() || 'PW'; // "PW" matches all transaction IDs

        // Use unified search with customer data
        const response = await transactionService.unifiedSearch({
          search_text: searchText,
          search_type: debouncedSearchTerm.trim() ? 'auto_detect' : 'transaction_id',
          include_customer: true,
          include_items: true,
          include_extensions: false,
          page: 1,
          page_size: 100
        });

        // Transform transactions: convert customer_info array to customer object
        let allTransactions = (response.transactions || []).map(transaction => {
          // Backend returns customer_info as an array, transform to customer object
          if (transaction.customer_info && transaction.customer_info.length > 0) {
            transaction.customer = transaction.customer_info[0];
          }
          return transaction;
        });

        // Check if we're searching for a specific transaction
        const isSpecificSearch = debouncedSearchTerm.trim().length > 0;

        // Filter by status if provided (supports single status or array of statuses)
        let transactionList = allTransactions;
        if (filterStatus) {
          const allowedStatuses = Array.isArray(filterStatus) ? filterStatus : [filterStatus];
          transactionList = allTransactions.filter(t => allowedStatuses.includes(t.status));

          // If searching for specific transaction and it exists but wrong status, show helpful message
          if (isSpecificSearch && allTransactions.length > 0 && transactionList.length === 0) {
            const foundTransaction = allTransactions[0];
            const statusFormatted = foundTransaction.status.charAt(0).toUpperCase() + foundTransaction.status.slice(1);
            const allowedStatusesFormatted = allowedStatuses
              .map(s => `"${s.charAt(0).toUpperCase() + s.slice(1)}"`)
              .join(', ');
            setSearchMessage(
              `This transaction is "${statusFormatted}". Only ${allowedStatusesFormatted} transactions can be selected.`
            );
          }
        }

        // If no results at all when searching, show message
        if (isSpecificSearch && allTransactions.length === 0) {
          setSearchMessage('Transaction not found.');
        }

        // Sort by pawn date (newest first)
        transactionList.sort((a, b) => {
          const dateA = new Date(a.pawn_date || 0);
          const dateB = new Date(b.pawn_date || 0);
          return dateB - dateA; // Newest first
        });

        setTransactions(transactionList);
      } catch (error) {
        console.error('Failed to load transactions:', error);
        setTransactions([]);
        setSearchMessage('Error searching transactions. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [filterStatus, debouncedSearchTerm]); // Re-run when search term changes

  // Use transactions directly (no client-side filtering needed since backend does the search)
  const filteredTransactions = transactions;

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-2xl border-2 border-slate-300 dark:border-slate-700">
      <CardHeader className="border-b border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <FileSearch className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              {title || 'Select Transaction'}
            </CardTitle>
            {subtitle && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-blue-600 dark:bg-blue-400"></span>
                {subtitle}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Enhanced Search Input */}
        <div className="mb-6">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2 block">
            Search Transactions
          </label>
          <div className="relative group">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors ${
              searchTerm ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
            }`} />
            <Input
              ref={searchInputRef}
              placeholder="Type transaction ID (e.g., PW001036), customer name, or phone number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 h-11 border-2 border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 shadow-sm focus:shadow-md placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
              autoComplete="off"
            />
            {loading && debouncedSearchTerm && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
            )}
            {searchTerm && !loading && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-red-100 dark:hover:bg-red-900/20"
                onClick={() => setSearchTerm('')}
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {/* Search hint */}
          {!searchTerm && filterStatus && (
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              Showing {
                Array.isArray(filterStatus)
                  ? filterStatus.length > 1
                    ? filterStatus.slice(0, -1).join(', ') + ', and ' + filterStatus[filterStatus.length - 1]
                    : filterStatus[0]
                  : filterStatus
              } transactions only
            </p>
          )}
        </div>

        <Separator className="mb-4 bg-slate-300 dark:bg-slate-700" />

        {/* Results Header */}
        {!loading && filteredTransactions.length > 0 && (
          <div className="flex items-center justify-between mb-3 text-sm">
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} found
            </span>
            {searchTerm && (
              <Badge variant="secondary" className="text-xs">
                Searching: "{searchTerm}"
              </Badge>
            )}
          </div>
        )}

        {/* Transaction List */}
        <div className="space-y-3 max-h-[450px] overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-slate-700 dark:text-slate-300 font-medium">Searching transactions...</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Please wait a moment</p>
              </div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              {searchMessage ? (
                <>
                  <AlertCircle className="h-12 w-12 text-amber-500 dark:text-amber-400" />
                  <div className="text-center space-y-1 max-w-md">
                    <p className="text-slate-700 dark:text-slate-300 font-medium">
                      {searchMessage}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <FileSearch className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                  <p className="text-slate-600 dark:text-slate-300 font-medium">
                    {searchTerm ? 'No transactions found.' : 'No transactions available.'}
                  </p>
                </>
              )}
            </div>
          ) : (
            filteredTransactions.map((transaction, index) => (
              <Button
                key={transaction.transaction_id}
                variant="outline"
                className="w-full h-auto p-0 justify-start hover:bg-accent/50 hover:border-primary/50 transition-all duration-200 group border-2 border-slate-300 dark:border-slate-700 shadow-sm hover:shadow-md"
                onClick={() => onSelect(transaction)}
              >
                <div className="flex items-stretch w-full">
                  {/* Left accent bar */}
                  <div className="w-1.5 bg-gradient-to-b from-primary/20 to-primary/50 group-hover:from-primary group-hover:to-primary/70 transition-all rounded-l-md" />

                  <div className="grid grid-cols-[1fr_2fr_1.2fr_1.2fr_0.8fr_0.6fr] gap-5 items-center w-full p-4">
                    {/* Column 1: Transaction ID and Status */}
                    <div className="flex flex-col items-start gap-2">
                      <div className="font-mono font-bold text-base text-white bg-primary px-3 py-1 rounded-md shadow-sm">
                        #{formatTransactionId(transaction)}
                      </div>
                      <StatusBadge status={transaction.status} size="sm" />
                    </div>

                    {/* Column 2: Customer Info */}
                    <div className="text-left min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-semibold text-base truncate">
                          {transaction.customer
                            ? customerService.getCustomerFullName(transaction.customer)
                            : 'Unknown Customer'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>
                          {transaction.customer?.phone_number
                            ? customerService.formatPhoneNumber(transaction.customer.phone_number)
                            : 'No phone number'}
                        </span>
                      </div>
                    </div>

                    {/* Column 3: Items */}
                    <div className="text-left">
                      {transaction.items && transaction.items.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                          <div className="flex flex-col gap-0.5">
                            <span
                              onClick={(e) => handleViewItems(e, transaction)}
                              className="text-base font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline underline-offset-2 transition-colors text-left cursor-pointer"
                            >
                              #IT{formatTransactionId(transaction).replace('PW', '')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {transaction.items.length} item{transaction.items.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No items</span>
                      )}
                    </div>

                    {/* Column 4: Pawn Date */}
                    <div className="text-left">
                      {transaction.pawn_date ? (
                        <div className="flex items-center gap-2 text-base">
                          <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                          <span className="text-muted-foreground font-semibold">
                            {formatBusinessDate(transaction.pawn_date)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No date</span>
                      )}
                    </div>

                    {/* Column 5: Balance */}
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-lg font-bold text-green-700 dark:text-green-400">
                        {formatCurrency(transaction.total_due || transaction.loan_amount || 0)}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        {transaction.total_due ? 'Total Due' : 'Loan Amount'}
                      </span>
                    </div>

                    {/* Column 6: Selection Icon */}
                    <div className="flex items-center justify-center">
                      <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <CheckCircle className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  </div>
                </div>
              </Button>
            ))
          )}
        </div>
      </CardContent>

      {/* Items Dialog - Matches TransactionList.jsx design */}
      <Dialog open={showItemsDialog} onOpenChange={setShowItemsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-details-light dark:bg-details-dark border-2 border-slate-300 dark:border-slate-700 shadow-2xl">
          <DialogHeader className="border-b-2 border-slate-300 dark:border-slate-700 pb-4">
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
              <div className="flex items-center justify-between p-4 bg-details-light dark:bg-details-medium/30 rounded-lg border-2 border-slate-300 dark:border-slate-700 shadow-sm">
                <div className="flex-1 space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    #{formatTransactionId(selectedTransactionItems)}
                  </h3>
                  {selectedTransactionItems.customer && (
                    <div className="text-base font-semibold text-slate-800 dark:text-slate-200 uppercase">
                      {customerService.getCustomerFullName(selectedTransactionItems.customer)}
                    </div>
                  )}
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {customerService.formatPhoneNumber(selectedTransactionItems.customer_id)}
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
                      <Card key={index} className="border-2 border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 shadow-sm">
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
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-4">No items available</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TransactionSelector;
