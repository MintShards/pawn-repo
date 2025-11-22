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
import { Alert, AlertDescription } from '../ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Loader2, FileText, AlertCircle } from 'lucide-react';
import transactionService from '../../services/transactionService';
import { toast } from 'sonner';

export default function TransactionTypeEditDialog({
  isOpen,
  onClose,
  transaction,
  onSuccess
}) {
  const [transactionType, setTransactionType] = useState('New Entry');
  const [referenceBarcode, setReferenceBarcode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Track initial values for change detection
  const [initialTransactionType, setInitialTransactionType] = useState('New Entry');
  const [initialReferenceBarcode, setInitialReferenceBarcode] = useState('');

  // Helper to get transaction field consistently (handles nested transaction property)
  const getTransactionField = (field) => {
    return transaction?.transaction?.[field] || transaction?.[field];
  };

  // Get transaction ID safely
  const getTransactionId = () => {
    return transaction?.transaction?.transaction_id || transaction?.transaction_id;
  };

  // Initialize form with current transaction data when dialog opens
  useEffect(() => {
    if (isOpen && transaction) {
      const currentType = getTransactionField('transaction_type') || 'New Entry';
      const currentBarcode = getTransactionField('reference_barcode') || '';

      setTransactionType(currentType);
      setReferenceBarcode(currentBarcode);
      setInitialTransactionType(currentType);
      setInitialReferenceBarcode(currentBarcode);
      setValidationError('');
    }
  }, [isOpen, transaction]);

  const handleBarcodeChange = (e) => {
    const value = e.target.value;
    setReferenceBarcode(value);

    // Clear error if empty (barcode is optional)
    if (!value.trim()) {
      setValidationError('');
      return;
    }

    // Validate pattern in real-time
    if (value.length > 100) {
      setValidationError('Reference Barcode must be 100 characters or less');
    } else if (!/^[A-Za-z0-9\-_\s\/\.]+$/.test(value)) {
      setValidationError('Barcode can only contain letters, numbers, hyphens, underscores, spaces, slashes, and periods');
    } else {
      setValidationError('');
    }
  };

  const validateForm = () => {
    setValidationError('');

    // Validate reference barcode pattern if provided
    if (transactionType === 'Imported' && referenceBarcode.trim()) {
      const trimmed = referenceBarcode.trim();

      // Check length
      if (trimmed.length > 100) {
        setValidationError('Reference Barcode must be 100 characters or less');
        return false;
      }

      // Check pattern - match backend validation (alphanumeric, hyphens, underscores, spaces, slashes, periods)
      if (!/^[A-Za-z0-9\-_\s\/\.]+$/.test(trimmed)) {
        setValidationError('Barcode can only contain letters, numbers, hyphens, underscores, spaces, slashes, and periods');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    // Validate transaction exists and has an ID
    const transactionId = getTransactionId();
    if (!transactionId) {
      toast.error('Transaction data is not available. Please try again.');
      return;
    }

    // Check if any changes were made
    const trimmedBarcode = transactionType === 'Imported' ? referenceBarcode.trim() : '';
    const initialTrimmedBarcode = initialTransactionType === 'Imported' ? initialReferenceBarcode.trim() : '';

    const hasTypeChanged = transactionType !== initialTransactionType;
    const hasBarcodeChanged = trimmedBarcode !== initialTrimmedBarcode;

    if (!hasTypeChanged && !hasBarcodeChanged) {
      toast.info('No changes detected', {
        description: 'Transaction type and reference barcode are unchanged.'
      });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Capture backend response with actual updated values
      const updatedTransaction = await transactionService.updateTransactionType(transactionId, {
        transaction_type: transactionType,
        reference_barcode: transactionType === 'Imported' ? referenceBarcode.trim() : null
      });

      toast.success('Transaction type updated successfully');

      // Close dialog after short delay
      setTimeout(() => {
        handleClose();
        // Pass backend-confirmed values (not optimistic client values)
        onSuccess?.(updatedTransaction);
      }, 500);
    } catch (error) {
      // Show the backend error message directly (already concise)
      const errorMessage = error.message || 'Failed to update transaction type';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setTransactionType('New Entry');
      setReferenceBarcode('');
      setInitialTransactionType('New Entry');
      setInitialReferenceBarcode('');
      setValidationError('');
      onClose();
    }
  };

  const handleTypeChange = (value) => {
    setTransactionType(value);
    // Clear validation error when type changes
    setValidationError('');
    // Clear reference barcode if changing to New Entry
    if (value === 'New Entry') {
      setReferenceBarcode('');
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <FileText className="mr-2 h-5 w-5 text-blue-500" />
            Edit Transaction Type
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction ID Display */}
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Transaction ID
            </p>
            <p className="text-base font-mono font-semibold text-gray-900 dark:text-gray-100 mt-1">
              {getTransactionField('formatted_id') || getTransactionId()}
            </p>
          </div>

          {/* Transaction Type Select */}
          <div className="space-y-2">
            <Label htmlFor="transaction-type" className="text-sm font-medium">
              Transaction Type
            </Label>
            <Select
              value={transactionType}
              onValueChange={handleTypeChange}
              disabled={isSubmitting}
            >
              <SelectTrigger id="transaction-type" className="w-full">
                <SelectValue placeholder="Select transaction type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="New Entry">New Entry</SelectItem>
                <SelectItem value="Imported">Imported</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reference Barcode Input (only show for Imported type) */}
          {transactionType === 'Imported' && (
            <div className="space-y-2">
              <Label htmlFor="reference-barcode" className="text-sm font-medium">
                Reference Barcode
              </Label>
              <Input
                id="reference-barcode"
                type="text"
                placeholder="Enter reference barcode (optional)"
                value={referenceBarcode}
                onChange={handleBarcodeChange}
                disabled={isSubmitting}
                className="font-mono"
                maxLength={100}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Optional: Barcode from external system
              </p>
            </div>
          )}

          {/* Validation Error */}
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
