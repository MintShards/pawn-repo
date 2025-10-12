import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, CreditCard, Eye, Banknote, ArrowRightLeft, MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import StatusBadge from './components/StatusBadge';
import transactionService from '../../services/transactionService';
import { formatTransactionId, formatStorageLocation, formatCurrency } from '../../utils/transactionUtils';
import { formatBusinessDate } from '../../utils/timezoneUtils';

const TransactionCard = React.memo(({
  transaction,
  onView,
  onPayment,
  onExtension,
  isSelected = false,
  onSelect,
  refreshTrigger, // Add prop to trigger balance refresh
  balance: parentBalance // Balance passed from parent
}) => {
  // Performance optimization: Use parent balance directly to avoid API calls
  const balance = parentBalance || null;
  const loading = false; // No loading state needed when using parent balance

  // formatCurrency is now imported from transactionUtils


  if (!transaction) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50';
      case 'overdue': return 'from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/50';
      case 'extended': return 'from-cyan-50 to-cyan-100 dark:from-cyan-950/50 dark:to-cyan-900/50';
      case 'redeemed': return 'from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/50';
      case 'sold': return 'from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50';
      case 'hold': return 'from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/50';
      case 'forfeited': return 'from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/50';
      case 'damaged': return 'from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/50';
      case 'voided': return 'from-gray-50 to-gray-100 dark:from-gray-950/50 dark:to-gray-900/50';
      default: return 'from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50';
    }
  };


  // Calculate days until maturity or days overdue (only for non-terminal states)
  const getMaturityInfo = () => {
    // Don't show maturity info for terminal states
    if (['redeemed', 'sold', 'voided', 'forfeited'].includes(transaction.status)) {
      return null;
    }
    
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
      className={`border shadow-sm bg-gradient-to-br ${getStatusColor(transaction.status)} relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 group cursor-pointer ${
        isSelected ? 'ring-2 ring-blue-500 shadow-md border-blue-500' : 'border-slate-200 dark:border-slate-700'
      }`}
      onClick={() => onView?.(transaction)}
    >
      {/* Subtle decorative element */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -mr-10 -mt-10"></div>
      
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between mb-1">
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
            <span className={`text-sm font-medium ${maturityInfo.color}`}>
              {maturityInfo.text}
            </span>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-2 space-y-3">
        {/* Simplified Financial Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Loan</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {transaction.loan_amount ? formatCurrency(transaction.loan_amount) : 'Not Set'}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Balance</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {loading ? '...' : balance?.current_balance !== undefined 
                ? formatCurrency(balance.current_balance) 
                : 'Loading...'
              }
            </p>
          </div>
        </div>

        {/* Location Info */}
        {transaction.storage_location && (
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="flex items-center space-x-2 min-w-0">
              <MapPin className="h-4 w-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Location</span>
            </div>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100 text-right truncate ml-2">
              {formatStorageLocation(transaction.storage_location)}
            </span>
          </div>
        )}

        {/* Items Preview */}
        {transaction.items && transaction.items.length > 0 && (
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Items ({transaction.items.length})
              </div>
            </div>
            <div className="p-3 space-y-2">
              {transaction.items.slice(0, 2).map((item, index) => (
                <div key={index} className="text-sm">
                  <div className="text-slate-800 dark:text-slate-200 font-medium">
                    {item.description}
                  </div>
                  {item.serial_number && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      S/N: {item.serial_number}
                    </div>
                  )}
                </div>
              ))}
              {transaction.items.length > 2 && (
                <div className="text-xs text-slate-600 dark:text-slate-400 font-semibold pt-1">
                  +{transaction.items.length - 2} more item{transaction.items.length - 2 !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="pt-2" onClick={(e) => e.stopPropagation()}>
          {/* View Button */}
          <Button 
            variant="outline" 
            size="default" 
            onClick={(e) => {
              e.stopPropagation();
              onView?.(transaction);
            }}
            className="w-full h-10 flex items-center justify-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600 font-medium"
          >
            <Eye className="w-4 h-4" />
            View Details
          </Button>
          
          {/* Action Buttons for Active Loans */}
          {(transaction.status === 'active' || transaction.status === 'overdue' || transaction.status === 'extended') && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Button 
                variant="default"
                size="default"
                onClick={(e) => {
                  e.stopPropagation();
                  onPayment?.(transaction);
                }}
                className="h-10 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                <Banknote className="w-4 h-4" />
                Payment
              </Button>
              <Button 
                variant="default"
                size="default"
                onClick={(e) => {
                  e.stopPropagation();
                  onExtension?.(transaction);
                }}
                className="h-10 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                <ArrowRightLeft className="w-4 h-4" />
                Extend
              </Button>
            </div>
          )}
        </div>

        {/* Select Button */}
        {onSelect && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50">
            <Button 
              variant={isSelected ? "default" : "outline"} 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                onSelect(transaction);
              }}
              className="w-full h-9"
            >
              {isSelected ? 'Selected' : 'Select Transaction'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo optimization
  return (
    prevProps.transaction?.transaction_id === nextProps.transaction?.transaction_id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.balance?.current_balance === nextProps.balance?.current_balance &&
    prevProps.refreshTrigger === nextProps.refreshTrigger
  );
});

export default TransactionCard;