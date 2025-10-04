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
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import transactionService from '../../services/transactionService';
import { toast } from 'sonner';

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

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  extended: 'bg-blue-100 text-blue-800',
  forfeited: 'bg-gray-100 text-gray-800',
  redeemed: 'bg-purple-100 text-purple-800',
  sold: 'bg-orange-100 text-orange-800'
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Status Update</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary of selected transactions */}
          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Selected Transactions: {selectedTransactions.length}
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(transactionsByStatus).map(([status, count]) => (
                <span
                  key={status}
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}
                >
                  {STATUS_LABELS[status]}: {count}
                </span>
              ))}
            </div>
          </div>

          {availableTransitions.length === 0 ? (
            <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                No common status transitions available for the selected transactions.
                Transactions may be in different states or have no valid transitions.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* New Status Selection */}
              <div className="space-y-2">
                <Label htmlFor="new-status">New Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger id="new-status">
                    <SelectValue placeholder="Select new status" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTransitions.map((status) => (
                      <SelectItem key={status} value={status}>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
                          {STATUS_LABELS[status]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add notes about this bulk update..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Result Summary */}
          {result && (
            <Alert className={result.error_count === 0 ? "border-green-200 bg-green-50 dark:bg-green-900/20" : "border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20"}>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Update Complete</p>
                  <p className="text-sm">
                    Successfully updated: {result.success_count} / {result.total_requested}
                  </p>
                  {result.error_count > 0 && (
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Failed: {result.error_count}
                    </p>
                  )}
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
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