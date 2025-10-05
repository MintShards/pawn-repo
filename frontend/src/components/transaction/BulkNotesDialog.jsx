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
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, CheckCircle2, FileText } from 'lucide-react';
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

export default function BulkNotesDialog({ 
  isOpen, 
  onClose, 
  selectedTransactions,
  onSuccess 
}) {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async () => {
    if (!note.trim()) {
      toast.error('Please enter a note');
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const transactionIds = selectedTransactions.map(t => t.transaction_id);
      const response = await transactionService.bulkAddNotes({
        transaction_ids: transactionIds,
        note: note.trim()
      });

      setResult(response);
      
      if (response.success_count > 0) {
        toast.success(`Successfully added notes to ${response.success_count} transaction(s)`);
        
        // Close dialog after a short delay if all were successful
        if (response.error_count === 0) {
          setTimeout(() => {
            handleClose();
            onSuccess?.();
          }, 1500);
        }
      }
      
      if (response.error_count > 0) {
        toast.error(`Failed to add notes to ${response.error_count} transaction(s)`);
      }
    } catch (error) {
      console.error('Bulk notes error:', error);
      toast.error(error.message || 'Failed to add notes to transactions');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setNote('');
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <FileText className="mr-2 h-5 w-5 text-blue-600" />
            Bulk Add Notes
          </DialogTitle>
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

          {/* Note Input */}
          <div className="space-y-2">
            <Label htmlFor="bulk-note">Note to Add</Label>
            <Textarea
              id="bulk-note"
              placeholder="Enter a note to add to all selected transactions..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="min-h-[100px]"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This note will be added to the internal notes of all selected transactions with a timestamp.
            </p>
          </div>

          {/* Character Count */}
          <div className="flex justify-between items-center text-xs text-slate-500">
            <span>
              {note.length} character{note.length !== 1 ? 's' : ''}
            </span>
            {note.length > 500 && (
              <span className="text-amber-600">
                Consider keeping notes concise for better readability
              </span>
            )}
          </div>

          {/* Result Summary */}
          {result && (
            <Alert className={result.error_count === 0 ? "border-green-200 bg-green-50 dark:bg-green-900/20" : "border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20"}>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Notes Added Successfully</p>
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

          {/* Preview of how note will appear */}
          {note.trim() && !result && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                Preview - Note will appear as:
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                "{note.trim()}"
              </p>
            </div>
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
            disabled={isSubmitting || !note.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding Notes...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Add Notes ({selectedTransactions.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}