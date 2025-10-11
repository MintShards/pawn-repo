import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, AlertCircle, CheckCircle2, ListChecks, ArrowRight, Info } from 'lucide-react';
import transactionService from '../../services/transactionService';
import { toast } from 'sonner';
import StatusBadge from './components/StatusBadge';

const AVAILABLE_STATUS_TRANSITIONS = {
  active: ['overdue', 'forfeited'],
  overdue: ['forfeited'],
  extended: ['overdue', 'forfeited'],
  forfeited: ['sold'],
  redeemed: [],
  sold: []
};

const STATUS_LABELS = {
  active: 'Active',
  overdue: 'Overdue',
  extended: 'Extended',
  forfeited: 'Forfeited',
  redeemed: 'Redeemed',
  sold: 'Sold'
};

export default function BulkStatusUpdateDialog({ 
  isOpen, 
  onClose, 
  selectedTransactions,
  onSuccess 
}) {
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Get common allowed transitions for selected transactions
  const getAvailableTransitions = () => {
    if (!selectedTransactions || selectedTransactions.length === 0) return [];
    
    // Find common allowed transitions across all selected transactions
    const allTransitions = selectedTransactions.map(transaction => 
      AVAILABLE_STATUS_TRANSITIONS[transaction.status] || []
    );
    
    // Get intersection of all transitions
    if (allTransitions.length === 0) return [];
    
    return allTransitions.reduce((common, transitions) => 
      common.filter(status => transitions.includes(status))
    );
  };

  const availableTransitions = getAvailableTransitions();

  const handleSubmit = async () => {
    if (!newStatus) {
      toast.error('Please select a new status');
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const transactionIds = selectedTransactions.map(t => t.transaction_id);
      const response = await transactionService.bulkUpdateStatus({
        transaction_ids: transactionIds,
        new_status: newStatus,
        notes: notes.trim() || undefined
      });

      setResult(response);
      
      if (response.success_count > 0) {
        toast.success(`Successfully updated ${response.success_count} transaction(s)`);
        
        // Close dialog after a short delay if all were successful
        if (response.error_count === 0) {
          setTimeout(() => {
            handleClose();
            onSuccess?.();
          }, 1500);
        }
      }
      
      if (response.error_count > 0) {
        toast.error(`Failed to update ${response.error_count} transaction(s)`);
      }
    } catch (error) {
      console.error('Bulk status update error:', error);
      toast.error(error.message || 'Failed to update transaction statuses');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setNewStatus('');
    setNotes('');
    setResult(null);
    onClose();
  };

  // Group transactions by current status for display
  const transactionsByStatus = selectedTransactions.reduce((acc, transaction) => {
    const status = transaction.status;
    if (!acc[status]) acc[status] = 0;
    acc[status]++;
    return acc;
  }, {});

  // Get detailed transition info per status
  const getTransitionDetails = () => {
    const details = {};
    Object.entries(transactionsByStatus).forEach(([status, count]) => {
      const transitions = AVAILABLE_STATUS_TRANSITIONS[status] || [];
      details[status] = {
        count,
        transitions,
        hasTransitions: transitions.length > 0
      };
    });
    return details;
  };

  const transitionDetails = getTransitionDetails();
  const hasAnyTransitions = Object.values(transitionDetails).some(detail => detail.hasTransitions);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <ListChecks className="mr-2 h-5 w-5 text-slate-600" />
            Bulk Status Update
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary of selected transactions */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Selected Transactions
              </p>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {selectedTransactions.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(transactionsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center gap-1">
                  <StatusBadge status={status} />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    × {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {!hasAnyTransitions ? (
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    No Status Updates Available
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    The selected transactions cannot be updated because:
                  </p>
                  <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc list-inside space-y-1 ml-2">
                    {Object.entries(transitionDetails)
                      .filter(([, detail]) => !detail.hasTransitions)
                      .map(([status, detail]) => (
                        <li key={status}>
                          <span className="font-medium">{STATUS_LABELS[status]}</span> transactions have no valid transitions
                          {status === 'redeemed' && ' (already completed)'}
                          {status === 'sold' && ' (already sold)'}
                        </li>
                      ))}
                  </ul>
                  <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
                      <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>Select transactions with different statuses (Active, Overdue, Extended, or Forfeited) to perform bulk updates.</span>
                    </p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Available transitions per status group */}
              {Object.keys(transactionsByStatus).length > 1 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Available Transitions
                  </p>
                  <div className="space-y-1.5">
                    {Object.entries(transitionDetails).map(([status, detail]) => (
                      detail.hasTransitions && (
                        <div key={status} className="flex items-center gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <StatusBadge status={status} />
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              ({detail.count})
                            </span>
                          </div>
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <div className="flex flex-wrap gap-1">
                            {detail.transitions.map(transition => (
                              <StatusBadge key={transition} status={transition} />
                            ))}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}

              {availableTransitions.length === 0 ? (
                <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription>
                    <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                      No Common Transitions
                    </p>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Selected transactions have different statuses with no overlapping transition options.
                      Try selecting transactions with the same status for bulk updates.
                    </p>
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {/* New Status Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="new-status" className="text-sm font-medium">
                      New Status
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                        (applies to all {selectedTransactions.length} transactions)
                      </span>
                    </Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger id="new-status" className="h-10">
                        <SelectValue placeholder="Select new status" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTransitions.map((status) => (
                          <SelectItem key={status} value={status}>
                            <StatusBadge status={status} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Reason for Status Change */}
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-sm font-medium">
                      Reason for Status Change (Optional)
                    </Label>
                    <Textarea
                      id="notes"
                      placeholder="Enter reason for status change..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="text-sm"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      This reason will appear in the transaction timeline for all {selectedTransactions.length} transactions.
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          {/* Result Summary */}
          {result && (
            <Alert className={result.error_count === 0 ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20" : "border-amber-200 bg-amber-50 dark:bg-amber-900/20"}>
              <CheckCircle2 className={`h-4 w-4 ${result.error_count === 0 ? 'text-emerald-600' : 'text-amber-600'}`} />
              <AlertDescription>
                <div className="space-y-1">
                  <p className={`font-medium ${result.error_count === 0 ? 'text-emerald-900 dark:text-emerald-100' : 'text-amber-900 dark:text-amber-100'}`}>
                    Status Update {result.error_count === 0 ? 'Complete' : 'Completed with Errors'}
                  </p>
                  <p className={`text-sm ${result.error_count === 0 ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200'}`}>
                    Successfully updated: {result.success_count} / {result.total_requested}
                  </p>
                  {result.error_count > 0 && (
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Failed: {result.error_count}
                    </p>
                  )}
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      {result.errors.slice(0, 3).map((error, idx) => (
                        <p key={idx}>• {error}</p>
                      ))}
                      {result.errors.length > 3 && (
                        <p>... and {result.errors.length - 3} more errors</p>
                      )}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !newStatus || availableTransitions.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Status'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}