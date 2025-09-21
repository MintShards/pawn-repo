import React, { useState, useEffect, useCallback } from 'react';
import { MoreHorizontal, DollarSign, Phone, CreditCard, Eye, Banknote, ArrowRightLeft, Trash2, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import StatusBadge from './components/StatusBadge';
import transactionService from '../../services/transactionService';
import customerService from '../../services/customerService';
import { formatTransactionId, formatStorageLocation, formatCurrency } from '../../utils/transactionUtils';
import { formatBusinessDate } from '../../utils/timezoneUtils';

const TransactionCard = ({ 
  transaction, 
  onView, 
  onViewCustomer,
  onPayment, 
  onExtension,
  onStatusUpdate,
  onVoidTransaction,
  isSelected = false,
  onSelect,
  refreshTrigger, // Add prop to trigger balance refresh
  customerData = {}, // Customer data map
  balance: parentBalance // Balance passed from parent
}) => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(parentBalance || null);
  const [loading, setLoading] = useState(false);

  // Use parent balance if provided, otherwise fetch it
  const loadBalance = useCallback(async () => {
    if (!transaction?.transaction_id) return;
    
    // If parent provides balance, use it
    if (parentBalance !== undefined) {
      setBalance(parentBalance);
      return;
    }
    
    try {
      setLoading(true);
      const balanceData = await transactionService.getTransactionBalance(transaction.transaction_id);
      setBalance(balanceData);
    } catch (error) {
      // Error handled
    } finally {
      setLoading(false);
    }
  }, [transaction?.transaction_id, parentBalance]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance, refreshTrigger]); // Refresh when trigger changes

  // formatCurrency is now imported from transactionUtils


  if (!transaction) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50';
      case 'overdue': return 'from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/50';
      case 'extended': return 'from-teal-50 to-teal-100 dark:from-teal-950/50 dark:to-teal-900/50';
      case 'redeemed': return 'from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/50';
      case 'sold': return 'from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50';
      case 'hold': return 'from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/50';
      case 'forfeited': return 'from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/50';
      case 'damaged': return 'from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/50';
      case 'voided': return 'from-gray-50 to-gray-100 dark:from-gray-950/50 dark:to-gray-900/50';
      default: return 'from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50';
    }
  };


  // Calculate days until maturity or days overdue
  const getMaturityInfo = () => {
    if (!transaction.maturity_date) return null;
    
    const now = new Date();
    const maturityDate = new Date(transaction.maturity_date);
    const diffTime = maturityDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      return {
        type: 'due',
        days: diffDays,
        text: `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`,
        color: diffDays <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'
      };
    } else if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays);
      return {
        type: 'overdue',
        days: overdueDays,
        text: `${overdueDays} day${overdueDays !== 1 ? 's' : ''} overdue`,
        color: 'text-red-600 dark:text-red-400'
      };
    } else {
      return {
        type: 'today',
        days: 0,
        text: 'Due today',
        color: 'text-orange-600 dark:text-orange-400'
      };
    }
  };

  const maturityInfo = getMaturityInfo();


  return (
    <Card 
      className={`border-0 shadow-md bg-gradient-to-br ${getStatusColor(transaction.status)} relative overflow-hidden transition-all duration-200 hover:shadow-lg group cursor-pointer ${
        isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''
      }`}
      onClick={() => onView?.(transaction)}
    >
      {/* Simplified decorative element */}
      <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full -mr-8 -mt-8"></div>
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                #{formatTransactionId(transaction)}
              </h3>
              <StatusBadge status={transaction.status} />
            </div>
            
            {/* Key info row */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">
                {formatBusinessDate(transaction.pawn_date)}
              </span>
              {maturityInfo && (
                <span className={`text-xs font-medium ${maturityInfo.color}`}>
                  {maturityInfo.text}
                </span>
              )}
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
              
              {/* Admin-only Void Transaction Option */}
              {user?.role === 'admin' && (
                <DropdownMenuItem 
                  onClick={() => onVoidTransaction?.(transaction)} 
                  className="flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Void Transaction
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Simplified Financial Summary */}
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

        {/* Customer Info */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Phone className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Customer:</span>
            </div>
            {(transaction.customer_phone || transaction.customer_id) && 
             (transaction.customer_phone !== 'No Customer' && transaction.customer_id !== 'No Customer') ? (
              <div className="text-right">
                {customerData[transaction.customer_phone || transaction.customer_id] ? (
                  <Button
                    variant="link"
                    className="h-auto p-0 text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewCustomer?.(transaction.customer_phone || transaction.customer_id);
                    }}
                  >
                    {customerService.getCustomerNameFormatted(customerData[transaction.customer_phone || transaction.customer_id])}
                  </Button>
                ) : (
                  <span className="text-sm text-slate-600 dark:text-slate-400">Loading...</span>
                )}
              </div>
            ) : (
              <span className="text-sm text-slate-400 dark:text-slate-500">No Customer</span>
            )}
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
          <div className="mb-4 p-3 bg-white/40 dark:bg-slate-800/40 rounded-lg">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              Items ({transaction.items.length})
            </div>
            <div className="space-y-2">
              {transaction.items.slice(0, 2).map((item, index) => (
                <div key={index} className="text-sm">
                  <div className="text-slate-700 dark:text-slate-300 font-medium">
                    {item.description}
                  </div>
                  {item.serial_number && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      S/N: {item.serial_number}
                    </div>
                  )}
                </div>
              ))}
              {transaction.items.length > 2 && (
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium pt-1">
                  +{transaction.items.length - 2} more item{transaction.items.length - 2 !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
          {/* View Button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation();
              onView?.(transaction);
            }}
            className="w-full flex items-center justify-center gap-2 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800"
          >
            <Eye className="w-4 h-4" />
            View Details
          </Button>
          
          {/* Action Buttons for Active Loans */}
          {(transaction.status === 'active' || transaction.status === 'overdue' || transaction.status === 'extended') && (
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onPayment?.(transaction);
                }}
                className="flex items-center justify-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800"
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
                className="flex items-center justify-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800"
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
              onClick={(e) => {
                e.stopPropagation();
                onSelect(transaction);
              }}
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