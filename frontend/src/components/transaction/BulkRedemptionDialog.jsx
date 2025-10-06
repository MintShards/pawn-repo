import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, CheckCircle2, Banknote, DollarSign, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import transactionService from '../../services/transactionService';
import { toast } from 'sonner';

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  extended: 'bg-blue-100 text-blue-800',
  forfeited: 'bg-gray-100 text-gray-800',
  redeemed: 'bg-purple-100 text-purple-800',
  sold: 'bg-orange-100 text-orange-800'
};

const STATUS_LABELS = {
  active: 'Active',
  overdue: 'Overdue',
  extended: 'Extended',
  forfeited: 'Forfeited',
  redeemed: 'Redeemed',
  sold: 'Sold'
};

export default function BulkRedemptionDialog({
  isOpen,
  onClose,
  selectedTransactions,
  onSuccess
}) {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [showTransactionList, setShowTransactionList] = useState(true); // Default to showing list
  const [transactionDetails, setTransactionDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Filter to only redeemable transactions
  const redeemableTransactions = selectedTransactions.filter(t =>
    ['active', 'overdue', 'extended'].includes(t.status)
  );

  // Calculate totals from loaded transaction details
  const calculateTotals = () => {
    const totals = {
      totalPrincipal: 0,
      totalInterest: 0,
      totalDue: 0,
      transactionCount: redeemableTransactions.length
    };

    Object.values(transactionDetails).forEach(detail => {
      if (detail && detail.balance) {
        // Use correct BalanceResponse fields
        totals.totalPrincipal += detail.balance?.principal_balance || 0;
        totals.totalInterest += detail.balance?.interest_balance || 0;
        totals.totalDue += detail.balance?.current_balance || 0;
      }
    });

    return totals;
  };

  const totals = calculateTotals();

  // Load transaction details when dialog opens
  useEffect(() => {
    if (isOpen && redeemableTransactions.length > 0 && Object.keys(transactionDetails).length === 0) {
      loadTransactionDetails();
    }
  }, [isOpen, redeemableTransactions.length]);

  const loadTransactionDetails = async () => {
    setLoadingDetails(true);
    const details = {};

    try {
      // Load full transaction summaries for all redeemable transactions
      await Promise.all(
        redeemableTransactions.map(async (transaction) => {
          try {
            const summary = await transactionService.getTransactionSummary(transaction.transaction_id);

            // Debug log to see actual response structure
            console.log('Transaction summary for', transaction.transaction_id, summary);

            details[transaction.transaction_id] = summary;
          } catch (error) {
            console.error(`Failed to load details for ${transaction.transaction_id}:`, error);

            // Create fallback detail structure matching TransactionSummaryResponse
            details[transaction.transaction_id] = {
              transaction: {
                transaction_id: transaction.transaction_id,
                formatted_id: transaction.formatted_id,
                customer_id: transaction.customer_id
              },
              balance: {
                principal_balance: 0,
                interest_balance: 0,
                current_balance: 0
              },
              items: [],
              summary: {}
            };
          }
        })
      );

      console.log('All transaction details loaded:', details);
      setTransactionDetails(details);
    } catch (error) {
      console.error('Failed to load transaction details:', error);
      toast.error('Failed to load some transaction details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSubmit = async () => {
    // Validation checks
    if (redeemableTransactions.length === 0) {
      toast.error('No redeemable transactions selected');
      return;
    }

    if (redeemableTransactions.length > 50) {
      toast.error('Cannot process more than 50 transactions at once. Please select fewer transactions.');
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const transactionIds = redeemableTransactions.map(t => t.transaction_id);
      const response = await transactionService.bulkProcessRedemption({
        transaction_ids: transactionIds,
        notes: notes.trim() || undefined
      });

      setResult(response);

      // Success notifications
      if (response.success_count > 0) {
        const successMessage = `Successfully redeemed ${response.success_count} transaction${response.success_count !== 1 ? 's' : ''} - Total: $${response.total_amount_processed.toLocaleString()}`;
        toast.success(successMessage);

        // Close dialog after a short delay if all were successful
        if (response.error_count === 0) {
          setTimeout(() => {
            handleClose();
            onSuccess?.();
          }, 1500);
        }
      }

      // Error notifications with specific counts
      if (response.error_count > 0) {
        const errorMessage = response.success_count > 0
          ? `${response.error_count} redemption${response.error_count !== 1 ? 's' : ''} failed (${response.success_count} succeeded)`
          : `Failed to process ${response.error_count} redemption${response.error_count !== 1 ? 's' : ''}`;
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Bulk redemption error:', error);
      toast.error(error.message || 'Failed to process redemptions');
      setResult(null); // Clear any partial results on error
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setNotes('');
    setResult(null);
    setTransactionDetails({});
    setShowTransactionList(true);
    onClose();
  };

  // Group transactions by current status for display
  const transactionsByStatus = redeemableTransactions.reduce((acc, transaction) => {
    const status = transaction.status;
    if (!acc[status]) acc[status] = 0;
    acc[status]++;
    return acc;
  }, {});

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Banknote className="mr-2 h-5 w-5 text-green-600" />
            Process Cash Redemption
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Comprehensive Summary Section */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-green-600" />
                <p className="text-lg font-semibold text-green-800 dark:text-green-200">
                  Redemption Summary
                </p>
              </div>

              {loadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                  <span className="ml-3 text-sm text-slate-600 dark:text-slate-400">Loading transaction details...</span>
                </div>
              ) : (
                <>
                  {/* Transaction Count & Total */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-md border border-green-200 dark:border-green-800">
                      <p className="text-xs text-slate-600 dark:text-slate-400">Transactions</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {totals.transactionCount}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-md border border-green-200 dark:border-green-800">
                      <p className="text-xs text-slate-600 dark:text-slate-400">Total Cash to Collect</p>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                        ${totals.totalDue.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Balance Breakdown */}
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-md border border-slate-200 dark:border-slate-700">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Principal</p>
                        <p className="text-lg font-semibold text-blue-700 dark:text-blue-400">
                          ${totals.totalPrincipal.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Interest</p>
                        <p className="text-lg font-semibold text-orange-700 dark:text-orange-400">
                          ${totals.totalInterest.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Transaction Details List */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowTransactionList(!showTransactionList)}
              className="w-full flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Transaction Details ({redeemableTransactions.length})
              </span>
              {showTransactionList ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </button>

            {/* Detailed Transaction List */}
            {showTransactionList && (
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg max-h-96 overflow-y-auto space-y-3">
                {loadingDetails ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : (
                  redeemableTransactions.map((transaction) => {
                    const detail = transactionDetails[transaction.transaction_id];
                    const balance = detail?.balance || {};
                    const transactionData = detail?.transaction || {};

                    // Use formatted_id if available, otherwise fall back to transaction_id
                    const displayId = transactionData.formatted_id || transaction.formatted_id || transaction.transaction_id;

                    // Get customer name from various possible sources
                    const customerName = transaction.customer_name ||
                                       (transactionData.customer_first_name && transactionData.customer_last_name
                                         ? `${transactionData.customer_first_name} ${transactionData.customer_last_name}`
                                         : null);

                    return (
                      <div
                        key={transaction.transaction_id}
                        className="bg-white dark:bg-slate-900 p-4 rounded-md border border-slate-200 dark:border-slate-700 space-y-3"
                      >
                        {/* Transaction Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {displayId}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {customerName || `Customer ${transactionData.customer_id || transaction.customer_id || 'Unknown'}`}
                            </p>
                          </div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[transaction.status]}`}>
                            {STATUS_LABELS[transaction.status]}
                          </span>
                        </div>

                        {/* Transaction Financial Details */}
                        <div className="flex items-center justify-between text-sm border-t border-slate-200 dark:border-slate-700 pt-2">
                          <div className="flex gap-4">
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Principal</p>
                              <p className="font-medium text-blue-700 dark:text-blue-400">
                                ${(balance.principal_balance || 0).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Interest</p>
                              <p className="font-medium text-orange-700 dark:text-orange-400">
                                ${(balance.interest_balance || 0).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Total Due</p>
                            <p className="text-lg font-bold text-green-700 dark:text-green-400">
                              ${(balance.current_balance || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>


          {/* Show non-redeemable transactions if any */}
          {selectedTransactions.length > redeemableTransactions.length && (
            <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                <span className="font-medium">
                  {selectedTransactions.length - redeemableTransactions.length} transaction(s) excluded:
                </span>{' '}
                Cannot redeem transactions with status: forfeited, redeemed, or sold
              </AlertDescription>
            </Alert>
          )}

          {/* Notes Field */}
          <div className="space-y-2">
            <Label htmlFor="redemption-notes">Notes (Optional)</Label>
            <Textarea
              id="redemption-notes"
              placeholder="Add notes for all redemption payments..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              These notes will be added to all redemption payment records.
            </p>
          </div>

          {/* Result Summary */}
          {result && (
            <div className="space-y-2">
              <Alert className={result.error_count === 0 ? "border-green-200 bg-green-50 dark:bg-green-900/20" : "border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20"}>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Redemption Complete</p>
                    <p className="text-sm">
                      Successfully processed: {result.success_count} / {result.total_requested}
                    </p>
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">
                      Total Cash Collected: ${result.total_amount_processed.toLocaleString()}
                    </p>
                    {result.error_count > 0 && (
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Failed: {result.error_count}
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              {/* Detailed Error Display */}
              {result.errors && result.errors.length > 0 && (
                <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium text-red-800 dark:text-red-200">Error Details:</p>
                      <div className="mt-2 max-h-40 overflow-y-auto space-y-1 text-xs text-red-700 dark:text-red-300">
                        {result.errors.map((error, idx) => (
                          <p key={idx} className="flex items-start">
                            <span className="mr-1">•</span>
                            <span className="flex-1">{error}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || redeemableTransactions.length === 0 || loadingDetails}
            className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Payments...
              </>
            ) : loadingDetails ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading Details...
              </>
            ) : (
              <>
                <DollarSign className="mr-2 h-4 w-4" />
                Collect ${totals.totalDue.toLocaleString()} Cash
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}