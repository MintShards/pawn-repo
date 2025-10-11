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
import { Loader2, CheckCircle2, FileText, StickyNote } from 'lucide-react';
import transactionService from '../../services/transactionService';
import { toast } from 'sonner';
import StatusBadge from './components/StatusBadge';

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
            <StickyNote className="mr-2 h-5 w-5 text-orange-500" />
            Bulk Add Notes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary of selected transactions */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                Selected Transactions
              </p>
              <span className="text-lg font-bold text-orange-900 dark:text-orange-100">
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

          {/* Note Input */}
          <div className="space-y-2">
            <Label htmlFor="bulk-note" className="text-sm font-medium">
              Note to Add
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                (will be added to all {selectedTransactions.length} transactions)
              </span>
            </Label>
            <Textarea
              id="bulk-note"
              placeholder="Enter internal note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="min-h-[100px] text-sm"
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This note will appear in the internal notes section with a timestamp.
              </p>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {note.length} chars
              </span>
            </div>
            {note.length > 500 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                ⚠️ Consider keeping notes concise for better readability
              </p>
            )}
          </div>

          {/* Result Summary */}
          {result && (
            <Alert className={result.error_count === 0 ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20" : "border-amber-200 bg-amber-50 dark:bg-amber-900/20"}>
              <CheckCircle2 className={`h-4 w-4 ${result.error_count === 0 ? 'text-emerald-600' : 'text-amber-600'}`} />
              <AlertDescription>
                <div className="space-y-1">
                  <p className={`font-medium ${result.error_count === 0 ? 'text-emerald-900 dark:text-emerald-100' : 'text-amber-900 dark:text-amber-100'}`}>
                    Notes {result.error_count === 0 ? 'Added Successfully' : 'Added with Errors'}
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

          {/* Preview of how note will appear */}
          {note.trim() && !result && (
            <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
              <p className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-2 flex items-center gap-1">
                <StickyNote className="h-3 w-3" />
                Note Preview
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-2 rounded border border-orange-100 dark:border-orange-900">
                {note.trim()}
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
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding Notes...
              </>
            ) : (
              <>
                <StickyNote className="mr-2 h-4 w-4" />
                Add Notes ({selectedTransactions.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}