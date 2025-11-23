import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { CheckCircle2 } from 'lucide-react';

export const ExtensionSuccessDialog = ({ open, extensionData, onClose }) => {
  if (!extensionData) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Extension Successful
          </DialogTitle>
          <DialogDescription>
            The loan extension has been processed successfully.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Transaction ID</p>
              <p className="font-medium">{extensionData.transaction_id}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Extension Days</p>
              <p className="font-medium">{extensionData.extension_days} days</p>
            </div>
            <div>
              <p className="text-muted-foreground">Extension Fee</p>
              <p className="font-medium">${extensionData.extension_fee}</p>
            </div>
            <div>
              <p className="text-muted-foreground">New Maturity Date</p>
              <p className="font-medium">
                {extensionData.new_maturity_date ?
                  new Date(extensionData.new_maturity_date).toLocaleDateString() :
                  'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExtensionSuccessDialog;
