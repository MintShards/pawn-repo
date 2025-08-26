import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import TransactionList from '../components/transaction/TransactionList';
import CreatePawnForm from '../components/transaction/CreatePawnForm';
import PaymentForm from '../components/transaction/components/PaymentForm';
import ExtensionForm from '../components/transaction/components/ExtensionForm';
import { formatTransactionId, formatExtensionId } from '../utils/transactionUtils';
// Toast functionality will be added later

const TransactionHub = () => {
  const [activeTab, setActiveTab] = useState('list');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showExtensionForm, setShowExtensionForm] = useState(false);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0); // Add refresh key for forcing list reload

  // Handle creating new transaction
  const handleCreateNew = () => {
    setShowCreateForm(true);
  };

  // Handle successful transaction creation
  const handleTransactionCreated = (newTransaction) => {
    setShowCreateForm(false);
    setActiveTab('list'); // Switch back to list to see new transaction
    setRefreshKey(prev => prev + 1); // Force TransactionList to refresh
    // Simple notification - can be replaced with proper toast later
    alert(`Transaction #${formatTransactionId(newTransaction)} created successfully`);
  };

  // Handle viewing transaction details
  const handleViewTransaction = (transaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionDetails(true);
  };

  // Handle payment processing
  const handlePayment = (transaction) => {
    setSelectedTransaction(transaction);
    setShowPaymentForm(true);
  };

  // Handle successful payment
  const handlePaymentSuccess = (paymentResult) => {
    setShowPaymentForm(false);
    setSelectedTransaction(null);
    setRefreshKey(prev => prev + 1); // Force TransactionList to refresh
    // Simple notification - can be replaced with proper toast later
    alert(`Payment of $${paymentResult.payment_amount || 0} processed successfully`);
  };

  // Handle successful extension
  const handleExtensionSuccess = (extensionResult) => {
    setShowExtensionForm(false);
    setSelectedTransaction(null);
    setRefreshKey(prev => prev + 1); // Force TransactionList to refresh
    // Simple notification - can be replaced with proper toast later
    alert(`Extension processed successfully. New maturity: ${new Date(extensionResult.new_maturity_date).toLocaleDateString()}`);
  };

  // Handle extension
  const handleExtension = (transaction) => {
    setSelectedTransaction(transaction);
    setShowExtensionForm(true);
  };

  // Handle status update (placeholder)
  const handleStatusUpdate = (transaction) => {
    alert("Status update functionality will be available in a future update");
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Transaction Management</h1>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="list">All Transactions</TabsTrigger>
          <TabsTrigger value="create">New Transaction</TabsTrigger>
        </TabsList>

        {/* Transaction List Tab */}
        <TabsContent value="list" className="space-y-4">
          <TransactionList
            key={refreshKey} // Force component remount on refresh
            onCreateNew={handleCreateNew}
            onViewTransaction={handleViewTransaction}
            onPayment={handlePayment}
            onExtension={handleExtension}
            onStatusUpdate={handleStatusUpdate}
          />
        </TabsContent>

        {/* Create Transaction Tab */}
        <TabsContent value="create" className="space-y-4">
          <CreatePawnForm
            onSuccess={handleTransactionCreated}
            onCancel={() => setActiveTab('list')}
          />
        </TabsContent>
      </Tabs>

      {/* Create Transaction Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Pawn Transaction</DialogTitle>
          </DialogHeader>
          <CreatePawnForm
            onSuccess={handleTransactionCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentForm} onOpenChange={setShowPaymentForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Process Payment</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <PaymentForm
              transaction={selectedTransaction}
              onSuccess={handlePaymentSuccess}
              onCancel={() => setShowPaymentForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Extension Dialog */}
      <Dialog open={showExtensionForm} onOpenChange={setShowExtensionForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Extend Loan</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <ExtensionForm
              transaction={selectedTransaction}
              onSuccess={handleExtensionSuccess}
              onCancel={() => setShowExtensionForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Transaction Details Dialog */}
      <Dialog open={showTransactionDetails} onOpenChange={setShowTransactionDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Transaction #{formatTransactionId(selectedTransaction)}</span>
                  <span className="text-lg font-normal">
                    Status: <span className="capitalize">{selectedTransaction.status}</span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Customer Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Customer</h4>
                    <p className="text-gray-600">{selectedTransaction.customer_id}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Pawn Date</h4>
                    <p className="text-gray-600">{formatDate(selectedTransaction.pawn_date)}</p>
                  </div>
                </div>

                {/* Financial Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Loan Amount</h4>
                    <p className="text-gray-600">{formatCurrency(selectedTransaction.loan_amount || 0)}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Monthly Interest</h4>
                    <p className="text-gray-600">{formatCurrency(selectedTransaction.monthly_interest_amount || 0)}</p>
                  </div>
                </div>

                {/* Storage Location */}
                {selectedTransaction.storage_location && (
                  <div>
                    <h4 className="font-medium text-gray-900">Storage Location</h4>
                    <p className="text-gray-600">{selectedTransaction.storage_location}</p>
                  </div>
                )}

                {/* Items */}
                {selectedTransaction.items && selectedTransaction.items.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Items ({selectedTransaction.items.length})</h4>
                    <div className="space-y-2">
                      {selectedTransaction.items.map((item, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{item.description}</p>
                              {item.serial_number && (
                                <p className="text-sm text-gray-600">Serial: {item.serial_number}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Internal Notes */}
                {selectedTransaction.internal_notes && (
                  <div>
                    <h4 className="font-medium text-gray-900">Internal Notes</h4>
                    <p className="text-gray-600">{selectedTransaction.internal_notes}</p>
                  </div>
                )}

                {/* Extensions */}
                {selectedTransaction.extensions && selectedTransaction.extensions.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Extensions ({selectedTransaction.extensions.length})</h4>
                    <div className="space-y-2">
                      {selectedTransaction.extensions.map((extension, index) => (
                        <div key={index} className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                          <div className="flex justify-between items-start mb-2">
                            <h5 className="font-medium text-blue-800">Extension #{formatExtensionId(extension)}</h5>
                            <span className="text-xs text-blue-600">{formatDate(extension.extension_date)}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <span className="font-medium">Duration:</span>
                              <p>{extension.extension_months} month{extension.extension_months !== 1 ? 's' : ''}</p>
                            </div>
                            <div>
                              <span className="font-medium">Fee/Month:</span>
                              <p>{formatCurrency(extension.extension_fee_per_month)}</p>
                            </div>
                            <div>
                              <span className="font-medium">Total Fee:</span>
                              <p>{formatCurrency((extension.extension_fee_per_month || 0) * (extension.extension_months || 0))}</p>
                            </div>
                          </div>
                          {extension.internal_notes && (
                            <div className="mt-2 pt-2 border-t border-blue-300">
                              <span className="text-xs text-blue-600 font-medium">Notes: </span>
                              <span className="text-xs text-blue-700">{extension.internal_notes}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  {(selectedTransaction.status === 'active' || selectedTransaction.status === 'overdue') && (
                    <>
                      <Button 
                        onClick={() => {
                          setShowTransactionDetails(false);
                          handlePayment(selectedTransaction);
                        }}
                      >
                        Process Payment
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setShowTransactionDetails(false);
                          handleExtension(selectedTransaction);
                        }}
                      >
                        Extend Loan
                      </Button>
                    </>
                  )}
                  <Button 
                    variant="outline"
                    onClick={() => handleStatusUpdate(selectedTransaction)}
                  >
                    Update Status
                  </Button>
                  <Button 
                    variant="ghost"
                    onClick={() => setShowTransactionDetails(false)}
                  >
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransactionHub;