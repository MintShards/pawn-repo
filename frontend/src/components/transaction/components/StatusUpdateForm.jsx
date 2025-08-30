import React, { useState } from 'react';
import { AlertTriangle, Save, X } from 'lucide-react';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Alert, AlertDescription } from '../../ui/alert';
import StatusBadge from './StatusBadge';
import transactionService from '../../../services/transactionService';

const StatusUpdateForm = ({ transaction, onSuccess, onCancel }) => {
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Define valid status transitions based on business rules
  const getValidStatusOptions = (currentStatus) => {
    const allStatuses = [
      { value: 'active', label: 'Active', description: 'Loan is current and active' },
      { value: 'overdue', label: 'Overdue', description: 'Past maturity date, within grace period' },
      { value: 'extended', label: 'Extended', description: 'Loan has been extended' },
      { value: 'redeemed', label: 'Redeemed', description: 'Customer redeemed items (paid in full)' },
      { value: 'forfeited', label: 'Forfeited', description: 'Items forfeited to shop' },
      { value: 'sold', label: 'Sold', description: 'Forfeited items sold by shop' },
      { value: 'hold', label: 'Hold', description: 'Transaction on temporary hold' },
      { value: 'damaged', label: 'Damaged', description: 'Items damaged while in storage' },
      { value: 'voided', label: 'Voided', description: 'Transaction voided (admin only)' },
      { value: 'canceled', label: 'Canceled', description: 'Transaction canceled (staff)' }
    ];

    // Filter out current status and define business rule restrictions
    return allStatuses.filter(status => {
      if (status.value === currentStatus) return false;
      
      // Business rules for valid transitions
      switch (currentStatus) {
        case 'sold':
        case 'voided':
        case 'canceled':
          return false; // Terminal states - no transitions allowed
        
        case 'redeemed':
          return ['voided'].includes(status.value); // Only admin void allowed
        
        case 'forfeited':
          return ['sold', 'redeemed', 'voided'].includes(status.value);
        
        default:
          return true; // Most statuses can transition to any other status
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!newStatus) {
      setError('Please select a new status');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await transactionService.updateTransactionStatus(transaction.transaction_id, {
        new_status: newStatus,
        notes: notes.trim() || undefined
      });
      
      onSuccess && onSuccess();
    } catch (error) {
      setError(error.message || 'Failed to update transaction status');
    } finally {
      setLoading(false);
    }
  };

  const validOptions = getValidStatusOptions(transaction.status);

  return (
    <div className="space-y-4">
      {/* Current Status Display */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">Current Status</h4>
            <p className="text-sm text-gray-600">Transaction #{transaction.transaction_id?.slice(-8)}</p>
          </div>
          <StatusBadge status={transaction.status} />
        </div>
      </div>

      {/* Status Update Form */}
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
                    <span className="text-sm text-gray-500">- {option.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {validOptions.length === 0 && (
            <p className="text-sm text-gray-500">
              No status changes available for {transaction.status} transactions
            </p>
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
          <p className="text-xs text-gray-500">{notes.length}/200 characters</p>
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
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || !newStatus || validOptions.length === 0}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Updating...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1" />
                Update Status
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default StatusUpdateForm;