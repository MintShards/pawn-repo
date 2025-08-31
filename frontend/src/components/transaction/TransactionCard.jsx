import React, { useState, useEffect, useCallback } from 'react';
import { MoreHorizontal, DollarSign, Calendar, Phone, CreditCard, Clock, MapPin, Eye, Banknote, ArrowRightLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import StatusBadge from './components/StatusBadge';
import transactionService from '../../services/transactionService';
import { formatTransactionId, formatStorageLocation } from '../../utils/transactionUtils';

const TransactionCard = ({ 
  transaction, 
  onView, 
  onViewCustomer,
  onPayment, 
  onExtension,
  onStatusUpdate,
  isSelected = false,
  onSelect
}) => {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch balance on mount
  const loadBalance = useCallback(async () => {
    if (!transaction?.transaction_id) return;
    
    try {
      setLoading(true);
      const balanceData = await transactionService.getTransactionBalance(transaction.transaction_id);
      setBalance(balanceData);
    } catch (error) {
      // Error handled
    } finally {
      setLoading(false);
    }
  }, [transaction?.transaction_id]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

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

  if (!transaction) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50';
      case 'overdue': return 'from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50';
      case 'extended': return 'from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50';
      case 'redeemed': return 'from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50';
      case 'sold': return 'from-purple-50 to-violet-50 dark:from-purple-950/50 dark:to-violet-950/50';
      default: return 'from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <CreditCard className="w-4 h-4" />;
      case 'overdue': return <Clock className="w-4 h-4" />;
      case 'extended': return <ArrowRightLeft className="w-4 h-4" />;
      case 'redeemed': return <Banknote className="w-4 h-4" />;
      default: return <CreditCard className="w-4 h-4" />;
    }
  };

  return (
    <Card 
      className={`border-0 shadow-lg bg-gradient-to-br ${getStatusColor(transaction.status)} relative overflow-hidden transition-all duration-200 hover:shadow-xl group cursor-pointer ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      }`}
      onClick={() => onView?.(transaction)}
    >
      {/* Decorative Element */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              transaction.status === 'active' ? 'bg-emerald-500/20' :
              transaction.status === 'overdue' ? 'bg-red-500/20' :
              transaction.status === 'extended' ? 'bg-blue-500/20' :
              transaction.status === 'redeemed' ? 'bg-green-500/20' :
              'bg-slate-500/20'
            }`}>
              {getStatusIcon(transaction.status)}
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                #{formatTransactionId(transaction)}
              </h3>
              <div className="flex items-center space-x-2">
                <StatusBadge status={transaction.status} />
                {transaction.hasExtensions && (
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {transaction.extensions?.length || 0} Extension{transaction.extensions?.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Action Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 opacity-60 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView?.(transaction)} className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                View Details
              </DropdownMenuItem>
              {transaction.status === 'active' || transaction.status === 'overdue' || transaction.status === 'extended' ? (
                <>
                  <DropdownMenuItem onClick={() => onPayment?.(transaction)} className="flex items-center gap-2">
                    <Banknote className="w-4 h-4" />
                    Process Payment
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onExtension?.(transaction)} className="flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4" />
                    Extend Loan
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuItem onClick={() => onStatusUpdate?.(transaction)} className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Update Status
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Financial Summary */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Loan Amount</span>
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {transaction.loan_amount ? formatCurrency(transaction.loan_amount) : 'Not Set'}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Balance</span>
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {loading ? '...' : balance?.current_balance !== undefined 
                ? formatCurrency(balance.current_balance) 
                : 'Loading...'
              }
            </p>
          </div>
        </div>

        {/* Customer & Date Info */}
        <div className="grid grid-cols-1 gap-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Phone className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Customer:</span>
            </div>
            {(transaction.customer_phone || transaction.customer_id) && 
             (transaction.customer_phone !== 'No Customer' && transaction.customer_id !== 'No Customer') ? (
              <Button
                variant="link"
                className="h-auto p-0 text-sm font-medium text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 underline-offset-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewCustomer?.(transaction.customer_phone || transaction.customer_id);
                }}
              >
                {transaction.customer_phone || transaction.customer_id}
              </Button>
            ) : (
              <span className="text-sm font-medium text-slate-400 dark:text-slate-500">No Customer</span>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Loan Date:</span>
            </div>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {formatDate(transaction.pawn_date)}
            </span>
          </div>

          {transaction.storage_location && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Location:</span>
              </div>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {formatStorageLocation(transaction.storage_location)}
              </span>
            </div>
          )}
        </div>

        {/* Items Preview */}
        {transaction.items && transaction.items.length > 0 && (
          <div className="mb-4 p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-white/20 dark:border-slate-700/20">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              Items ({transaction.items.length})
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-300">
              {transaction.items.slice(0, 2).map(item => item.description).join(', ')}
              {transaction.items.length > 2 && (
                <span className="text-slate-500 dark:text-slate-400">
                  {' '}+{transaction.items.length - 2} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation();
              onView?.(transaction);
            }}
            className="flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800"
          >
            <Eye className="w-4 h-4" />
            View
          </Button>
          
          {(transaction.status === 'active' || transaction.status === 'overdue' || transaction.status === 'extended') && (
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onPayment?.(transaction);
                }}
                className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800"
              >
                <Banknote className="w-4 h-4" />
                Payment
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onExtension?.(transaction);
                }}
                className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800"
              >
                <ArrowRightLeft className="w-4 h-4" />
                Extend
              </Button>
            </div>
          )}
        </div>

        {/* Select Button */}
        {onSelect && (
          <div className="mt-4 pt-3 border-t border-white/20 dark:border-slate-700/20">
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