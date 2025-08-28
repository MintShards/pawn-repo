import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import TransactionCard from './TransactionCard';
import transactionService from '../../services/transactionService';
import { matchesTransactionSearch, initializeSequenceNumbers } from '../../utils/transactionUtils';

const TransactionList = ({ 
  onCreateNew, 
  onViewTransaction, 
  onPayment, 
  onExtension,
  onStatusUpdate 
}) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    page: 1,
    page_size: 20
  });
  const [isExtensionSearch, setIsExtensionSearch] = useState(false);

  // Filter transactions based on search term (client-side for transaction IDs)
  const filteredTransactions = transactions.filter(transaction => {
    if (!searchTerm) return true;
    
    // If this was an extension search, the results are already filtered by the server
    if (isExtensionSearch) return true;
    
    // Check if searching by transaction number (PW format or numbers) - exclude EX since that's handled server-side
    const isTransactionSearch = /^(PW)?\d+$/i.test(searchTerm);
    
    if (isTransactionSearch) {
      return matchesTransactionSearch(transaction, searchTerm);
    }
    
    // Otherwise search by customer phone (server-side search is better for this)
    return transaction.customer_id?.includes(searchTerm);
  });

  // Load transactions on mount and when filters change
  useEffect(() => {
    loadTransactions();
  }, [filters]);

  const loadTransactions = async () => {
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
          ...(searchTerm && !isTransactionSearch && { customer_id: searchTerm })
        };
        
        response = await transactionService.getAllTransactions(searchParams);
        
        // Enrich all transactions with extension data for better user experience
        const transactionList = response.transactions || [];
        const enrichedTransactions = await transactionService.enrichTransactionsWithExtensions(transactionList);
        response.transactions = enrichedTransactions;
      }
      
      const transactionList = response.transactions || [];
      
      // Initialize sequence numbers for consistent PW numbering
      initializeSequenceNumbers(transactionList);
      
      setTransactions(transactionList);
    } catch (err) {
      // Error handled
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, page: 1 }));
    loadTransactions();
  };

  const handleStatusFilter = (status) => {
    setFilters(prev => ({ 
      ...prev, 
      status: status === filters.status ? '' : status,
      page: 1 
    }));
  };

  const handleRefresh = () => {
    setIsExtensionSearch(false);
    loadTransactions();
  };


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Transactions</h2>
        <div className="flex items-center space-x-2">
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={onCreateNew} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Transaction
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2 flex-1 min-w-[250px]">
          <Input
            placeholder="Search by transaction # (PW000123, EX000045) or customer phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} variant="outline" size="sm">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Status Filters */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Status:</span>
          {['active', 'overdue', 'extended', 'redeemed'].map((status) => (
            <Button
              key={status}
              variant={filters.status === status ? "default" : "outline"}
              size="sm"
              onClick={() => handleStatusFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
          {filters.status && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleStatusFilter('')}
            >
              Clear
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

      {/* Transaction Grid */}
      {!loading && filteredTransactions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTransactions.map((transaction) => (
            <TransactionCard
              key={transaction.transaction_id}
              transaction={transaction}
              onView={onViewTransaction}
              onPayment={onPayment}
              onExtension={onExtension}
              onStatusUpdate={onStatusUpdate}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredTransactions.length === 0 && !error && (
        <div className="text-center p-8">
          <div className="text-gray-500">
            {searchTerm || filters.status ? 
              'No transactions found matching your criteria.' : 
              'No transactions found. Create your first transaction to get started.'
            }
          </div>
          {!searchTerm && !filters.status && (
            <Button onClick={onCreateNew} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create New Transaction
            </Button>
          )}
        </div>
      )}

      {/* Pagination - Simple version */}
      {transactions.length >= filters.page_size && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={loading}
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
};

export default TransactionList;