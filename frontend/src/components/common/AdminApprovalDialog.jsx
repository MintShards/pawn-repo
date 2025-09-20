import React, { useState, useRef, useEffect } from 'react';
import { Shield, Eye, EyeOff, AlertTriangle, RotateCcw, X, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';

const AdminApprovalDialog = ({
  open,
  onOpenChange,
  title = "Admin Authorization Required",
  description,
  onApprove,
  onCancel,
  loading = false,
  requireReason = true,
  actionType = "reversal", // reversal, cancellation, correction, etc.
  warningMessage,
  children
}) => {
  const [adminPin, setAdminPin] = useState('');
  const [reason, setReason] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errors, setErrors] = useState({});
  const pinInputRef = useRef(null);

  // Color scheme and icon based on action type
  const getActionConfig = (type) => {
    switch (type) {
      case 'cancellation':
        return {
          icon: Calendar,
          iconColor: 'text-orange-600',
          warning: 'bg-orange-50 border-orange-200',
          warningIcon: 'text-orange-700',
          warningText: 'text-orange-900',
          button: 'bg-orange-600 hover:bg-orange-700 text-white',
          details: 'bg-orange-50 border-orange-200',
          detailsTitle: 'text-orange-900',
          detailsText: 'text-orange-900'
        };
      case 'void':
        return {
          icon: X,
          iconColor: 'text-red-600',
          warning: 'bg-red-50 border-red-300',
          warningIcon: 'text-red-700',
          warningText: 'text-red-900',
          button: 'bg-red-600 hover:bg-red-700 text-white',
          details: 'bg-red-50 border-red-300',
          detailsTitle: 'text-red-900',
          detailsText: 'text-red-800'
        };
      case 'reversal':
        return {
          icon: RotateCcw,
          iconColor: 'text-amber-600',
          warning: 'bg-amber-50 border-amber-300',
          warningIcon: 'text-amber-700',
          warningText: 'text-amber-900',
          button: 'bg-amber-600 hover:bg-amber-700 text-white',
          details: 'bg-amber-50 border-amber-300',
          detailsTitle: 'text-amber-900',
          detailsText: 'text-amber-900'
        };
      case 'correction':
        return {
          icon: Shield,
          iconColor: 'text-blue-500',
          warning: 'bg-blue-50 border-blue-200',
          warningIcon: 'text-blue-600',
          warningText: 'text-blue-800',
          button: 'bg-blue-600 hover:bg-blue-700 text-white',
          details: 'bg-blue-50 border-blue-200',
          detailsTitle: 'text-blue-800',
          detailsText: 'text-blue-700'
        };
      default:
        return {
          icon: Shield,
          iconColor: 'text-amber-500',
          warning: 'bg-amber-50 border-amber-200',
          warningIcon: 'text-amber-600',
          warningText: 'text-amber-800',
          button: 'bg-amber-600 hover:bg-amber-700 text-white',
          details: 'bg-amber-50 border-amber-200',
          detailsTitle: 'text-amber-800',
          detailsText: 'text-amber-700'
        };
    }
  };

  const actionConfig = getActionConfig(actionType);
  const ActionIcon = actionConfig.icon;

  // Clear form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setAdminPin('');
      setReason('');
      setErrors({});
      setShowPin(false);
      // Focus on PIN input when dialog opens
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!adminPin.trim()) {
      newErrors.adminPin = 'Admin PIN is required';
    } else if (adminPin.length < 4) {
      newErrors.adminPin = 'PIN must be at least 4 characters';
    }
    
    if (requireReason && !reason.trim()) {
      newErrors.reason = `Reason for ${actionType} is required`;
    } else if (requireReason && reason.trim().length < 10) {
      newErrors.reason = `Please provide a more detailed reason (minimum 10 characters)`;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleApprove = () => {
    if (!validateForm()) {
      return;
    }
    
    const approvalData = {
      admin_pin: adminPin,
      ...(requireReason && { reason: reason.trim() })
    };
    
    onApprove(approvalData);
  };

  const handleCancel = () => {
    setAdminPin('');
    setReason('');
    setErrors({});
    onCancel?.();
    onOpenChange?.(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      if (e.target.name === 'adminPin' && requireReason) {
        // Move to reason field if PIN is entered
        document.querySelector('textarea[name="reason"]')?.focus();
      } else {
        // Submit if all fields are filled or reason not required
        handleApprove();
      }
    }
  };

  // Get dialog size based on action type
  const getDialogSize = (type) => {
    switch (type) {
      case 'void':
        return 'sm:max-w-2xl';
      case 'reversal':
        return 'sm:max-w-lg';
      case 'correction':
        return 'sm:max-w-xl';
      case 'cancellation':
        return 'sm:max-w-lg';
      default:
        return 'sm:max-w-md';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${getDialogSize(actionType)} max-h-[90vh] overflow-y-auto`} showCloseButton={!loading}>
        <DialogHeader className={actionType === 'void' ? 'border-b border-red-200 pb-4' : actionType === 'reversal' ? 'border-b border-amber-200 pb-4' : ''}>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${
              actionType === 'void' ? 'bg-red-100' : 
              actionType === 'reversal' ? 'bg-amber-100' : 
              actionType === 'correction' ? 'bg-blue-100' : 
              actionType === 'cancellation' ? 'bg-orange-100' : 'bg-gray-100'
            }`}>
              <ActionIcon className={`h-5 w-5 ${actionConfig.iconColor}`} />
            </div>
            <div>
              <DialogTitle className={`text-xl font-bold ${
                actionType === 'void' ? 'text-red-800' : 
                actionType === 'reversal' ? 'text-amber-500' : 
                actionType === 'correction' ? 'text-blue-500' : 
                actionType === 'cancellation' ? 'text-orange-500' : 'text-gray-800'
              }`}>
                {title}
              </DialogTitle>
              {actionType === 'void' && (
                <p className="text-xs text-red-600 font-medium mt-1">PERMANENT ACTION</p>
              )}
              {actionType === 'reversal' && (
                <p className="text-xs text-amber-600 font-medium mt-1">SAME-DAY ONLY</p>
              )}
              {actionType === 'correction' && (
                <p className="text-xs text-blue-600 font-medium mt-1">DATA CORRECTION</p>
              )}
              {actionType === 'cancellation' && (
                <p className="text-xs text-orange-600 font-medium mt-1">CANCELLATION</p>
              )}
            </div>
          </div>
          <DialogDescription className="mt-3">
            {description || `Please provide your admin credentials to authorize this ${actionType}.`}
          </DialogDescription>
        </DialogHeader>

        {warningMessage && (
          <div className={`flex items-start space-x-2 p-3 ${actionConfig.warning} rounded-md`}>
            <AlertTriangle className={`h-5 w-5 ${actionConfig.warningIcon} mt-0.5 flex-shrink-0`} />
            <p className={`text-sm ${actionConfig.warningText}`}>{warningMessage}</p>
          </div>
        )}

        {children}

        <div className="space-y-4">
          {requireReason && (
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-medium">
                Reason for {actionType} *
              </Label>
              <Textarea
                id="reason"
                name="reason"
                placeholder={
                  actionType === 'void' ? 
                    'Describe the specific reason for voiding this transaction (e.g., data entry error, customer request, duplicate entry)...' : 
                  actionType === 'reversal' ? 
                    'Explain why this payment needs to be reversed (e.g., incorrect amount, wrong customer, processing error)...' :
                  actionType === 'cancellation' ? 
                    'Explain why this extension needs to be cancelled (e.g., customer request, processing error, incorrect terms)...' :
                  actionType === 'correction' ? 
                    'Describe what needs to be corrected and why (e.g., wrong amount entered, incorrect date, customer information error)...' :
                    `Please explain why this ${actionType} is necessary...`
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyPress={handleKeyPress}
                className={errors.reason ? 'border-red-500' : ''}
                rows={actionType === 'void' ? 4 : 3}
                disabled={loading}
              />
              {actionType === 'void' && (
                <p className="text-xs text-red-600">
                  Be specific and detailed. This reason will be permanently recorded in the audit log.
                </p>
              )}
              {actionType === 'reversal' && (
                <p className="text-xs text-amber-600">
                  Reversals can only be done on the same business day. Provide clear justification.
                </p>
              )}
              {actionType === 'cancellation' && (
                <p className="text-xs text-orange-600">
                  Cancellation will refund any fees paid. Explain the business reason clearly.
                </p>
              )}
              {actionType === 'correction' && (
                <p className="text-xs text-blue-600">
                  Describe the original error and the correct information. This creates an audit trail.
                </p>
              )}
              {errors.reason && (
                <p className="text-sm text-red-600">{errors.reason}</p>
              )}
              {reason.length > 0 && reason.length < 10 && (
                <p className="text-xs text-amber-600">
                  {10 - reason.length} more characters needed for a detailed reason
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="adminPin" className="text-sm font-medium">
              Admin PIN *
            </Label>
            <div className="relative">
              <Input
                ref={pinInputRef}
                id="adminPin"
                name="adminPin"
                type={showPin ? "text" : "password"}
                placeholder="Enter your admin PIN"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                onKeyPress={handleKeyPress}
                className={errors.adminPin ? 'border-red-500 pr-10' : 'pr-10'}
                disabled={loading}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPin(!showPin)}
                disabled={loading}
              >
                {showPin ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </Button>
            </div>
            {errors.adminPin && (
              <p className="text-sm text-red-600">{errors.adminPin}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleApprove}
            disabled={loading}
            className={actionConfig.button}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                Processing...
              </>
            ) : (
              actionType === 'void' ? 'Authorize Void' :
              actionType === 'reversal' ? 'Authorize Reversal' :
              actionType === 'cancellation' ? 'Authorize Cancellation' :
              actionType === 'correction' ? 'Authorize Correction' :
              `Authorize ${actionType}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminApprovalDialog;