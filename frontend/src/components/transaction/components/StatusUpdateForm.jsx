import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Alert, AlertDescription } from '../../ui/alert';
import StatusBadge from './StatusBadge';
import transactionService from '../../../services/transactionService';
import customerService from '../../../services/customerService';
import { useStatsPolling } from '../../../hooks/useStatsPolling';
import { useAuth } from '../../../context/AuthContext';
import { formatTransactionId } from '../../../utils/transactionUtils';

const StatusUpdateForm = ({ transaction, customer, onSuccess, onCancel }) => {
  const { triggerRefresh } = useStatsPolling();
  const { user } = useAuth();
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const isAdmin = user?.role === 'admin';

  // Define valid status transitions based on backend business rules
  const getValidStatusOptions = (currentStatus) => {
    // Status definitions with accurate business rules
    const statusDefinitions = {
      'active': { label: 'Active', description: 'Loan is current and active' },
      'overdue': { label: 'Overdue', description: 'Past maturity date' },
      'extended': { label: 'Extended', description: 'Loan has been extended' },
      'redeemed': { label: 'Redeemed', description: 'Customer redeemed items (paid in full)' },
      'forfeited': { label: 'Forfeited', description: 'Items forfeited to shop' },
      'sold': { label: 'Sold', description: 'Forfeited items sold by shop' },
      'hold': { label: 'Hold', description: 'Transaction on temporary hold' },
      'damaged': { label: 'Damaged', description: 'Items damaged while in storage' },
      'voided': { label: 'Voided', description: 'Transaction voided by admin' }
    };

    // Admin-only statuses (for future use)
    const adminOnlyStatuses = []; // None currently defined, but infrastructure ready

    // Valid transitions based on backend business rules
    // Note: 'extended', 'redeemed', and 'voided' are handled by separate workflows, not this form
    const validTransitions = {
      'active': ['overdue', 'hold', 'damaged', 'forfeited'],
      'overdue': ['active', 'forfeited', 'hold', 'damaged'],
      'extended': ['overdue', 'forfeited', 'hold', 'damaged'],
      'hold': ['active', 'overdue', 'damaged', 'forfeited'],
      'damaged': ['forfeited', 'sold'],
      'redeemed': [], // Terminal state
      'forfeited': ['sold'],
      'sold': [], // Terminal state
      'voided': [] // Terminal state
    };

    const allowedStatuses = validTransitions[currentStatus] || [];
    
    // Filter out admin-only statuses for non-admin users
    const filteredStatuses = allowedStatuses.filter(statusValue => {
      if (adminOnlyStatuses.includes(statusValue)) {
        return isAdmin;
      }
      return true;
    });
    
    return filteredStatuses.map(statusValue => ({
      value: statusValue,
      label: statusDefinitions[statusValue]?.label || statusValue,
      description: statusDefinitions[statusValue]?.description || ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!newStatus) {
      setError('Please select a new status');
      return;
    }

    // Double-check that the selected status is still valid
    const currentValidOptions = getValidStatusOptions(transaction.status);
    const isStillValid = currentValidOptions.some(option => option.value === newStatus);
    
    if (!isStillValid) {
      setError(`This status transition is no longer valid. The transaction status may have changed. Please close and reopen to see the current status.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await transactionService.updateTransactionStatus(transaction.transaction_id, {
        new_status: newStatus,
        notes: notes.trim() || undefined
      });
      
      // Trigger immediate stats refresh after status update
      triggerRefresh();
      
      // Pass the result with status information to the success handler
      onSuccess && onSuccess({
        ...result,
        new_status: newStatus,
        old_status: transaction.status,
        transaction_id: transaction.transaction_id
      });
    } catch (error) {
      let errorMessage = 'Failed to update transaction status';
      
      // Parse specific error messages for better user feedback
      if (error.message) {
        if (error.message.includes('Invalid status transition')) {
          errorMessage = `Cannot change status from "${transaction.status}" to "${newStatus}". This transition is not allowed by business rules.`;
        } else if (error.message.includes('not found')) {
          errorMessage = 'Transaction not found. Please refresh and try again.';
        } else if (error.message.includes('Forbidden') || error.message.includes('permission') || error.message.includes('403')) {
          errorMessage = 'You do not have permission to make this status change. Your session may have expired.';
        } else if (error.message.includes('400')) {
          // Try to extract the actual error message from the backend
          const match = error.message.match(/detail:\s*"([^"]+)"/);
          if (match) {
            errorMessage = match[1];
          } else {
            errorMessage = `Invalid request: The status change from "${transaction.status}" to "${newStatus}" is not allowed.`;
          }
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const validOptions = getValidStatusOptions(transaction.status);

  return (
    <div className="space-y-4">
      {/* Transaction Details */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Transaction Details</h4>
        <div className="text-sm text-blue-900 space-y-1">
          <p><strong>Transaction ID:</strong> {formatTransactionId(transaction)}</p>
          <div><strong>Current Status:</strong> <StatusBadge status={transaction.status} /></div>
          {customer && (
            <p><strong>Customer:</strong> {customerService.getCustomerFullName(customer)}</p>
          )}
          {transaction.loan_amount && (
            <p><strong>Loan Amount:</strong> ${transaction.loan_amount}</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* New Status Selection */}
        <div className="space-y-2">
          <Label htmlFor="new-status">New Status</Label>
          <Select value={newStatus} onValueChange={setNewStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Select new status..." />
            </SelectTrigger>
            <SelectContent>
              {validOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">- {option.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {validOptions.length === 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    No Status Changes Available
                  </h3>
                  <p className="text-sm text-blue-700 mt-1">
                    {transaction.status === 'redeemed' || transaction.status === 'sold' 
                      ? `Transactions with "${transaction.status}" status are final and cannot be changed.`
                      : `No valid status transitions are available for "${transaction.status}" transactions at this time.`
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this status change..."
            maxLength={200}
            rows={3}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">{notes.length}/200 characters</p>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || !newStatus || validOptions.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Updating...
              </>
            ) : (
              'Update Status'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default StatusUpdateForm;