import React, { useState, useEffect } from 'react';
import { MoreHorizontal, DollarSign, Calendar, Phone, CreditCard, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import StatusBadge from './components/StatusBadge';
import transactionService from '../../services/transactionService';
import { formatTransactionId } from '../../utils/transactionUtils';

const TransactionCard = ({ 
  transaction, 
  onView, 
  onPayment, 
  onExtension,
  onStatusUpdate,
  isSelected = false,
  onSelect
}) => {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch balance on mount
  useEffect(() => {
    if (transaction?.transaction_id) {
      loadBalance();
    }
  }, [transaction?.transaction_id]);

  const loadBalance = async () => {
    try {
      setLoading(true);
      const balanceData = await transactionService.getTransactionBalance(transaction.transaction_id);
      setBalance(balanceData);
    } catch (error) {
      console.error('Error loading balance:', error);
    } finally {
      setLoading(false);
    }
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

  if (!transaction) return null;

  return (
    <Card className={`p-4 border transition-all duration-200 hover:shadow-md ${
      isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
    }`}>
      <CardContent className="p-0">
        <div className="flex items-start justify-between">
          {/* Transaction Info */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center space-x-2">
              <h3 className="font-medium text-lg">
                Transaction #{formatTransactionId(transaction)}
              </h3>
              <StatusBadge status={transaction.status} />
              {transaction.hasExtensions && (
                <div className="flex items-center space-x-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                  <Clock className="h-3 w-3" />
                  <span>{transaction.extensions?.length || 0} Extension{transaction.extensions?.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <Phone className="h-4 w-4" />
                <span>Customer: {transaction.customer_id || 'N/A'}</span>
              </div>
              
              <div className="flex items-center space-x-1">
                <DollarSign className="h-4 w-4" />
                <span>Loan: {formatCurrency(transaction.loan_amount || 0)}</span>
              </div>
              
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4" />
                <span>Date: {formatDate(transaction.pawn_date || new Date())}</span>
              </div>

              <div className="flex items-center space-x-1">
                <CreditCard className="h-4 w-4" />
                <span>
                  Balance: {loading ? '...' : balance?.current_balance !== undefined 
                    ? formatCurrency(balance.current_balance) 
                    : 'Loading...'
                  }
                </span>
              </div>
            </div>

            {transaction.storage_location && (
              <div className="text-sm text-gray-500">
                Location: {transaction.storage_location}
              </div>
            )}
          </div>

          {/* Action Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView?.(transaction)}>
                View Details
              </DropdownMenuItem>
              {transaction.status === 'active' || transaction.status === 'overdue' ? (
                <>
                  <DropdownMenuItem onClick={() => onPayment?.(transaction)}>
                    Process Payment
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onExtension?.(transaction)}>
                    Extend Loan
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuItem onClick={() => onStatusUpdate?.(transaction)}>
                Update Status
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Items Preview */}
        {transaction.items && transaction.items.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-sm text-gray-600">
              Items ({transaction.items.length}): {
                transaction.items.slice(0, 2).map(item => item.description).join(', ')
              }
              {transaction.items.length > 2 && ` +${transaction.items.length - 2} more`}
            </div>
          </div>
        )}

        {/* Select Button */}
        {onSelect && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <Button 
              variant={isSelected ? "default" : "outline"} 
              size="sm" 
              onClick={() => onSelect(transaction)}
              className="w-full"
            >
              {isSelected ? 'Selected' : 'Select Transaction'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionCard;