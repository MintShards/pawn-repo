import React from 'react';
import { Button } from '../ui/button';
import { Printer } from 'lucide-react';

export const DualReceiptPrint = ({ transactionId, receiptType = 'initial' }) => {
  const handlePrint = () => {
    // TODO: Implement actual print functionality
    console.log(`Printing ${receiptType} receipt for transaction ${transactionId}`);
    alert(`Print functionality will be implemented soon.\nTransaction: ${transactionId}\nType: ${receiptType}`);
  };

  return (
    <Button
      onClick={handlePrint}
      variant="outline"
      className="gap-2"
    >
      <Printer className="h-4 w-4" />
      Print Receipt
    </Button>
  );
};

export default DualReceiptPrint;
