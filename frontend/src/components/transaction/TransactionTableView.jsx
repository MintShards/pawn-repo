import React from 'react';
import { Eye, Banknote, ArrowRightLeft, MapPin, Package } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import StatusBadge from './components/StatusBadge';
import { formatTransactionId, formatStorageLocation, formatCurrency } from '../../utils/transactionUtils';
import { formatBusinessDate } from '../../utils/timezoneUtils';

const TransactionTableView = ({
  transactions,
  onView,
  onViewItems, // Handler for viewing items dialog
  onPayment,
  onExtension,
  balances = {}, // Optional pre-loaded balances map
  customerData = {} // Customer information map by phone number
}) => {
  // Get status color for dot indicator
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'redeemed':
        return 'bg-green-500 dark:bg-green-600';
      case 'active':
        return 'bg-blue-500 dark:bg-blue-600';
      case 'extended':
        return 'bg-cyan-500 dark:bg-cyan-600';
      case 'sold':
        return 'bg-purple-500 dark:bg-purple-600';
      case 'hold':
        return 'bg-amber-400 dark:bg-amber-500';
      case 'forfeited':
        return 'bg-orange-600 dark:bg-orange-700';
      case 'overdue':
        return 'bg-red-500 dark:bg-red-600';
      case 'damaged':
        return 'bg-amber-800 dark:bg-amber-900';
      case 'voided':
        return 'bg-gray-500 dark:bg-gray-600';
      default:
        return 'bg-gray-400 dark:bg-gray-500';
    }
  };

  // Calculate maturity info helper
  const getMaturityInfo = (transaction) => {
    if (['redeemed', 'sold', 'voided'].includes(transaction.status)) {
      return { text: '-', color: 'text-slate-400' };
    }

    if (!transaction.maturity_date) return { text: 'N/A', color: 'text-slate-400' };

    const now = new Date();
    const maturityDate = new Date(transaction.maturity_date);
    const diffTime = maturityDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return {
        text: `${diffDays}d`,
        color: diffDays <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'
      };
    } else if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays);
      return {
        text: `${overdueDays}d overdue`,
        color: 'text-red-600 dark:text-red-400 font-semibold'
      };
    } else {
      return {
        text: 'Today',
        color: 'text-orange-600 dark:text-orange-400 font-semibold'
      };
    }
  };

  // Get row background - single color for all rows
  const getRowBackground = () => {
    return 'bg-slate-50 dark:bg-slate-800';
  };

  return (
    <div className="border border-slate-200/50 dark:border-slate-700/50 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100 dark:bg-slate-800/70 border-b-2 border-slate-200 dark:border-slate-700">
              <TableHead className="font-semibold text-xs py-3">Transaction</TableHead>
              <TableHead className="font-semibold text-xs py-3">Items</TableHead>
              <TableHead className="font-semibold text-xs py-3">Loan</TableHead>
              <TableHead className="font-semibold text-xs py-3">Balance</TableHead>
              <TableHead className="font-semibold text-xs text-center py-3">Status</TableHead>
              <TableHead className="font-semibold text-xs text-center py-3">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction, index) => {
              const maturityInfo = getMaturityInfo(transaction);
              const balance = balances[transaction.transaction_id];
              const currentBalance = balance?.current_balance !== undefined
                ? balance.current_balance
                : transaction.loan_amount || 0;
              const isPaid = currentBalance === 0;
              const isPartiallyPaid = currentBalance < (transaction.loan_amount || 0) && currentBalance > 0;

              return (
                <TableRow
                  key={transaction.transaction_id}
                  className={`cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all duration-200 border-b border-slate-200/50 dark:border-slate-700/50 group ${getRowBackground()}`}
                  onClick={() => onView?.(transaction)}
                >
                  {/* Transaction */}
                  <TableCell className="py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        #{formatTransactionId(transaction)}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {formatBusinessDate(transaction.pawn_date)}
                      </span>
                      {maturityInfo.text !== '-' && (
                        <span className={`text-[10px] font-semibold ${maturityInfo.color}`}>
                          {maturityInfo.text}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Items */}
                  <TableCell
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onViewItems) {
                        onViewItems(transaction);
                      } else {
                        onView?.(transaction);
                      }
                    }}
                    className="cursor-pointer py-3 group/item"
                  >
                    <span className="text-xs font-mono text-slate-900 dark:text-slate-100 group-hover/item:underline transition-colors">
                      {formatTransactionId(transaction).replace('PW', 'IT')}
                    </span>
                  </TableCell>

                  {/* Loan */}
                  <TableCell className="text-xs font-semibold text-slate-700 dark:text-slate-300 py-3">
                    <span className="font-mono tabular-nums">
                      {transaction.loan_amount ? formatCurrency(transaction.loan_amount) : 'N/A'}
                    </span>
                  </TableCell>

                  {/* Balance */}
                  <TableCell className={`text-xs font-semibold py-3 ${
                    isPaid
                      ? 'text-green-600 dark:text-green-400'
                      : isPartiallyPaid
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-900 dark:text-slate-100'
                  }`}>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(currentBalance)}
                    </span>
                  </TableCell>

                  {/* Status - Color only */}
                  <TableCell className="py-3">
                    <div className="flex items-center justify-center">
                      <div
                        className={`w-2.5 h-2.5 rounded-full shadow-sm ${getStatusColor(transaction.status)}`}
                        title={transaction.status ? transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1) : 'Unknown'}
                      />
                    </div>
                  </TableCell>

                  {/* Action Buttons */}
                  <TableCell onClick={(e) => e.stopPropagation()} className="py-3">
                    <div className="flex items-center justify-center space-x-0.5">
                      {/* View Button - Always visible */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onView?.(transaction);
                        }}
                        className="h-7 w-7 p-0 text-blue-600 dark:text-blue-400 hover:bg-blue-300 dark:hover:bg-blue-950/50"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>

                      {/* Payment Button - Active loans only */}
                      {(transaction.status === 'active' ||
                        transaction.status === 'overdue' ||
                        transaction.status === 'extended') && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPayment?.(transaction);
                            }}
                            className="h-7 w-7 p-0 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-300 dark:hover:bg-emerald-950/50"
                            title="Payment"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onExtension?.(transaction);
                            }}
                            className="h-7 w-7 p-0 text-amber-600 dark:text-amber-400 hover:bg-amber-300 dark:hover:bg-amber-950/50"
                            title="Extension"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Empty State */}
      {transactions.length === 0 && (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No transactions found</p>
        </div>
      )}
    </div>
  );
};

export default TransactionTableView;
