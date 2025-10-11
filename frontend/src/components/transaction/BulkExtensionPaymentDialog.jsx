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
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Loader2, CheckCircle2, Calendar, DollarSign, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import extensionService from '../../services/extensionService';
import transactionService from '../../services/transactionService';
import { toast } from 'sonner';
import StatusBadge from './components/StatusBadge';

export default function BulkExtensionPaymentDialog({
  isOpen,
  onClose,
  selectedTransactions,
  onSuccess
}) {
  const [batchNotes, setBatchNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [showTransactionList, setShowTransactionList] = useState(true);
  const [transactionDetails, setTransactionDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [adminPin, setAdminPin] = useState(''); // Admin PIN for discount approval

  // Payment details per transaction
  const [paymentDetails, setPaymentDetails] = useState({});

  // Filter to only extendable transactions
  const extendableTransactions = selectedTransactions.filter(t =>
    ['active', 'overdue', 'extended'].includes(t.status)
  );

  // Initialize payment details for each transaction
  useEffect(() => {
    if (isOpen && extendableTransactions.length > 0) {
      const initialDetails = {};
      extendableTransactions.forEach(transaction => {
        initialDetails[transaction.transaction_id] = {
          duration: 1, // Default to 1 month
          extensionFee: 0,
          overdueFee: 0,
          discount: 0,
          reason: '',
          totalDue: 0
        };
      });
      setPaymentDetails(initialDetails);
      loadTransactionDetails();
    }
  }, [isOpen, extendableTransactions.length]);

  // Calculate extension fee based on duration and monthly interest
  const calculateExtensionFee = (monthlyInterest, duration) => {
    return monthlyInterest * duration;
  };

  // Update payment details when duration changes
  const handleDurationChange = (transactionId, duration) => {
    const detail = transactionDetails[transactionId];
    if (!detail) return;

    const monthlyInterest = detail.transaction?.monthly_interest_amount || 0;
    const extensionFee = calculateExtensionFee(monthlyInterest, duration);

    setPaymentDetails(prev => {
      const current = prev[transactionId] || {};
      const overdueFee = parseFloat(current.overdueFee) || 0;
      const discount = parseFloat(current.discount) || 0;
      const totalDue = Math.max(0, extensionFee + overdueFee - discount);

      return {
        ...prev,
        [transactionId]: {
          ...current,
          duration,
          extensionFee,
          totalDue
        }
      };
    });
  };

  // Update overdue fee
  const handleOverdueFeeChange = (transactionId, value) => {
    setPaymentDetails(prev => {
      const current = prev[transactionId] || {};
      const extensionFee = current.extensionFee || 0;
      const overdueFee = parseFloat(value) || 0;
      const discount = parseFloat(current.discount) || 0;
      const totalDue = Math.max(0, extensionFee + overdueFee - discount);

      return {
        ...prev,
        [transactionId]: {
          ...current,
          overdueFee: value, // Store the string value
          totalDue
        }
      };
    });
  };

  // Update discount
  const handleDiscountChange = (transactionId, value) => {
    setPaymentDetails(prev => {
      const current = prev[transactionId] || {};
      const extensionFee = current.extensionFee || 0;
      const overdueFee = parseFloat(current.overdueFee) || 0;
      const discount = parseFloat(value) || 0;
      const totalDue = Math.max(0, extensionFee + overdueFee - discount);

      return {
        ...prev,
        [transactionId]: {
          ...current,
          discount: value, // Store the string value
          totalDue
        }
      };
    });
  };

  // Update reason
  const handleReasonChange = (transactionId, value) => {
    setPaymentDetails(prev => ({
      ...prev,
      [transactionId]: {
        ...prev[transactionId],
        reason: value
      }
    }));
  };

  // Calculate totals from payment details
  const calculateTotals = () => {
    const totals = {
      totalExtensionFees: 0,
      totalOverdueFees: 0,
      totalDiscounts: 0,
      totalDue: 0,
      transactionCount: extendableTransactions.length
    };

    Object.values(paymentDetails).forEach(detail => {
      totals.totalExtensionFees += detail.extensionFee || 0;
      totals.totalOverdueFees += parseFloat(detail.overdueFee) || 0;
      totals.totalDiscounts += parseFloat(detail.discount) || 0;
      totals.totalDue += detail.totalDue || 0;
    });

    return totals;
  };

  const totals = calculateTotals();

  // Load transaction details when dialog opens
  const loadTransactionDetails = async () => {
    setLoadingDetails(true);
    const details = {};
    const initialPayments = {};

    try {
      await Promise.all(
        extendableTransactions.map(async (transaction) => {
          try {
            const summary = await transactionService.getTransactionSummary(transaction.transaction_id);
            details[transaction.transaction_id] = summary;

            // Initialize payment details with calculated extension fee
            const monthlyInterest = summary.transaction?.monthly_interest_amount || 0;
            const extensionFee = calculateExtensionFee(monthlyInterest, 1); // Default 1 month

            initialPayments[transaction.transaction_id] = {
              duration: 1,
              extensionFee,
              overdueFee: '',
              discount: '',
              reason: '',
              totalDue: extensionFee
            };
          } catch (error) {
            console.error(`Failed to load details for ${transaction.transaction_id}:`, error);

            // Create fallback detail structure
            details[transaction.transaction_id] = {
              transaction: {
                transaction_id: transaction.transaction_id,
                formatted_id: transaction.formatted_id,
                customer_id: transaction.customer_id,
                customer_first_name: '',
                customer_last_name: '',
                loan_amount: 0,
                monthly_interest_amount: 0,
                status: transaction.status
              },
              balance: {
                principal_balance: 0,
                interest_balance: 0,
                current_balance: 0
              },
              items: [],
              summary: {}
            };

            initialPayments[transaction.transaction_id] = {
              duration: 1,
              extensionFee: 0,
              overdueFee: '',
              discount: '',
              reason: '',
              totalDue: 0
            };
          }
        })
      );

      setTransactionDetails(details);
      setPaymentDetails(initialPayments);
    } catch (error) {
      console.error('Failed to load transaction details:', error);
      toast.error('Failed to load some transaction details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSubmit = async () => {
    // Validation checks
    if (extendableTransactions.length === 0) {
      toast.error('No extendable transactions selected');
      return;
    }

    if (extendableTransactions.length > 50) {
      toast.error('Cannot process more than 50 transactions at once. Please select fewer transactions.');
      return;
    }

    // Validate payment details
    let hasDiscounts = false;
    for (const [transactionId, detail] of Object.entries(paymentDetails)) {
      if (detail.extensionFee <= 0) {
        toast.error('Extension fee must be positive for all transactions');
        return;
      }

      if (detail.overdueFee < 0) {
        toast.error('Overdue fee cannot be negative');
        return;
      }

      const maxDiscount = detail.extensionFee + (parseFloat(detail.overdueFee) || 0);
      if (detail.discount > maxDiscount) {
        toast.error('Discount cannot exceed Extension Fee + Overdue Fee');
        return;
      }

      // Check if discount is applied
      const discountAmount = parseFloat(detail.discount) || 0;
      if (discountAmount > 0) {
        hasDiscounts = true;

        // Validate discount reason is required when discount is applied
        if (!detail.reason?.trim()) {
          toast.error('Discount reason is required when discount is applied');
          return;
        }
      }
    }

    // Validate admin PIN when discounts are applied
    if (hasDiscounts && !adminPin) {
      toast.error('Admin PIN is required when discounts are applied');
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      // Prepare payments array
      const payments = extendableTransactions.map(transaction => {
        const detail = paymentDetails[transaction.transaction_id];
        const discount = parseFloat(detail.discount) || 0;

        return {
          transaction_id: transaction.transaction_id,
          extension_fee: detail.extensionFee,
          overdue_fee: parseFloat(detail.overdueFee) || 0,
          discount: discount,
          // Only include reason when discount is applied
          reason: discount > 0 && detail.reason?.trim() ? detail.reason.trim() : undefined,
          payment_method: 'cash',
          total_amount: detail.totalDue
        };
      });

      const response = await extensionService.bulkProcessExtensionPayment({
        payments,
        batch_notes: batchNotes.trim() || undefined,
        admin_pin: hasDiscounts ? adminPin : undefined
      });

      setResult(response);

      // Success notifications
      if (response.success_count > 0) {
        const successMessage = `Successfully processed ${response.success_count} extension payment${response.success_count !== 1 ? 's' : ''} - Total: $${response.total_amount_processed.toLocaleString()}`;
        toast.success(successMessage);

        // Close dialog after a short delay if all were successful
        if (response.error_count === 0) {
          setTimeout(() => {
            handleClose();
            onSuccess?.();
          }, 1500);
        }
      }

      // Error notifications
      if (response.error_count > 0) {
        const errorMessage = response.success_count > 0
          ? `${response.error_count} payment${response.error_count !== 1 ? 's' : ''} failed (${response.success_count} succeeded)`
          : `Failed to process ${response.error_count} payment${response.error_count !== 1 ? 's' : ''}`;
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Bulk extension payment error:', error);

      // Extract detailed error message from API response
      // The custom exception handler transforms errors into: {error, message, error_code, details: {message: "actual error"}}
      let errorMessage = 'Failed to process extension payments';

      // Priority order for error extraction:
      // 1. Check error.response.data.details.message (custom exception handler format)
      // 2. Check error.response.data.detail (standard FastAPI format)
      // 3. Check error.message if it's meaningful
      // 4. Fall back to generic message
      if (error.response?.data?.details?.message) {
        errorMessage = error.response.data.details.message;
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message && !error.message.includes('HTTP error!')) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
      setResult(null);

      // Only close dialog for non-PIN validation errors
      // If it's a PIN error, keep dialog open so user can try again
      const isPinError = errorMessage.toLowerCase().includes('pin') ||
                        errorMessage.toLowerCase().includes('admin');

      if (!isPinError) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setBatchNotes('');
    setResult(null);
    setTransactionDetails({});
    setPaymentDetails({});
    setShowTransactionList(true);
    setAdminPin(''); // Clear admin PIN
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Calendar className="mr-2 h-5 w-5 text-blue-600" />
            Process Bulk Extension Fee Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Extension Summary Section */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <p className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                  Extension Payment Summary
                </p>
              </div>

              {loadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-3 text-sm text-slate-600 dark:text-slate-400">Loading transaction details...</span>
                </div>
              ) : (
                <>
                  {/* Transaction Count & Total */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-slate-600 dark:text-slate-400">Transactions</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {totals.transactionCount}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-slate-600 dark:text-slate-400">Total to Collect</p>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                        ${totals.totalDue.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Fee Breakdown */}
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-md border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between gap-4 text-sm">
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Extension Fees</p>
                        <p className="text-lg font-semibold text-blue-700 dark:text-blue-400">
                          ${totals.totalExtensionFees.toLocaleString()}
                        </p>
                      </div>
                      {totals.totalOverdueFees > 0 && (
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Overdue Fees</p>
                          <p className="text-lg font-semibold text-amber-700 dark:text-amber-400">
                            ${totals.totalOverdueFees.toLocaleString()}
                          </p>
                        </div>
                      )}
                      {totals.totalDiscounts > 0 && (
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Discount</p>
                          <p className="text-lg font-semibold text-purple-700 dark:text-purple-400">
                            -${totals.totalDiscounts.toLocaleString()}
                          </p>
                        </div>
                      )}
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
                Transaction Details ({extendableTransactions.length})
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
                  extendableTransactions.map((transaction) => {
                    const detail = transactionDetails[transaction.transaction_id];
                    const payment = paymentDetails[transaction.transaction_id] || {};
                    const transactionData = detail?.transaction || {};

                    // Use formatted_id if available
                    const displayId = transactionData.formatted_id || transaction.formatted_id || transaction.transaction_id;

                    // Get customer name from various possible sources
                    const customerName = transaction.customer_name ||
                                       (transactionData.customer_first_name && transactionData.customer_last_name
                                         ? `${transactionData.customer_first_name} ${transactionData.customer_last_name}`
                                         : null);

                    // Get amounts with fallbacks (using correct API field names)
                    const principalAmount = transactionData.loan_amount ?? transaction.loan_amount ?? 0;
                    const monthlyInterest = transactionData.monthly_interest_amount ?? transaction.monthly_interest_amount ?? 0;

                    return (
                      <div
                        key={transaction.transaction_id}
                        className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow duration-200"
                      >
                        {/* Transaction Header */}
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex-1 min-w-0 space-y-2">
                            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                              {displayId}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                              {customerName || `Customer ${transactionData.customer_id || transaction.customer_id || 'Unknown'}`}
                            </p>
                          </div>
                          <StatusBadge status={transaction.status} />
                        </div>

                        {/* Payment Details */}
                        <div className="mt-3 text-sm bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                          {/* Duration Selector */}
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Duration</span>
                            <Select
                              value={payment.duration?.toString() || '1'}
                              onValueChange={(value) => handleDurationChange(transaction.transaction_id, parseInt(value))}
                            >
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1 Month</SelectItem>
                                <SelectItem value="2">2 Months</SelectItem>
                                <SelectItem value="3">3 Months</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Grid layout for financial details */}
                          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                            {/* Left Column - Read-only fields */}
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Principal</p>
                                <p className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                  ${principalAmount.toLocaleString()}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Monthly Interest</p>
                                <p className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                  ${monthlyInterest.toLocaleString()}
                                </p>
                              </div>
                            </div>

                            {/* Right Column - Input fields */}
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Extension Fee</p>
                                <p className="text-base font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                                  ${(payment.extensionFee || 0).toLocaleString()}
                                </p>
                              </div>

                              {/* Overdue Fee - Only show for overdue transactions */}
                              {transaction.status === 'overdue' && (
                                <div>
                                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Overdue Fee</p>
                                  <div className="relative w-28">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
                                    <Input
                                      type="number"
                                      min="0"
                                      max="10000"
                                      placeholder="0"
                                      value={payment.overdueFee || ''}
                                      onChange={(e) => handleOverdueFeeChange(transaction.transaction_id, e.target.value)}
                                      className="h-8 w-full pl-5 pr-2 text-sm font-medium text-right tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </div>
                                </div>
                              )}

                              <div>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Discount ($)</p>
                                <div className="relative w-28">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="10000"
                                    placeholder="0"
                                    value={payment.discount || ''}
                                    onChange={(e) => handleDiscountChange(transaction.transaction_id, e.target.value)}
                                    className="h-8 w-full pl-5 pr-2 text-sm font-medium text-right tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </div>
                              </div>

                              {/* Discount Reason Field - Only show when discount is entered */}
                              {payment.discount && parseFloat(payment.discount) > 0 && (
                                <div>
                                  <Input
                                    id={`discount-reason-${transaction.transaction_id}`}
                                    type="text"
                                    placeholder="Discount reason"
                                    maxLength={200}
                                    value={payment.reason || ''}
                                    onChange={(e) => handleReasonChange(transaction.transaction_id, e.target.value)}
                                    className="h-8 text-xs w-full"
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Total Due */}
                          <div className="flex justify-between pt-3 mt-3 border-t border-slate-300 dark:border-slate-600">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Total Due</span>
                            <span className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                              ${(payment.totalDue || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Show non-extendable transactions if any */}
          {selectedTransactions.length > extendableTransactions.length && (
            <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                <span className="font-medium">
                  {selectedTransactions.length - extendableTransactions.length} transaction(s) excluded:
                </span>{' '}
                Cannot process extension payments for transactions with status: forfeited, redeemed, or sold
              </AlertDescription>
            </Alert>
          )}

          {/* Admin PIN Field - Show when any discount is applied */}
          {Object.values(paymentDetails).some(detail => detail.discount && parseFloat(detail.discount) > 0 && detail.reason?.trim()) && (
            <div className="space-y-2 bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-purple-600" />
                <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                  Admin PIN Required for Discounts
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-pin">Admin PIN</Label>
                <Input
                  id="admin-pin"
                  type="password"
                  placeholder="Enter 4-digit admin PIN"
                  maxLength={4}
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  className="w-40"
                />
                <p className="text-xs text-purple-700 dark:text-purple-300">
                  Admin PIN is required to process extension payments with discounts.
                </p>
              </div>
            </div>
          )}

          {/* Batch Notes Field */}
          <div className="space-y-2">
            <Label htmlFor="batch-notes">Batch Notes (Optional)</Label>
            <Textarea
              id="batch-notes"
              placeholder="Add notes for all extension payments..."
              value={batchNotes}
              onChange={(e) => setBatchNotes(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              These notes will be added to all extension payment records.
            </p>
          </div>

          {/* Result Summary */}
          {result && (
            <div className="space-y-2">
              <Alert className={result.error_count === 0 ? "border-green-200 bg-green-50 dark:bg-green-900/20" : "border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20"}>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Extension Payment Complete</p>
                    <p className="text-sm">
                      Successfully processed: {result.success_count} / {result.total_requested}
                    </p>
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">
                      Total Collected: ${result.total_amount_processed.toLocaleString()}
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
            disabled={isSubmitting || extendableTransactions.length === 0 || loadingDetails}
            className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
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
                Process ${totals.totalDue.toLocaleString()} Extension Payment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
