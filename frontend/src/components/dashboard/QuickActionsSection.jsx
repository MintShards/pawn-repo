import React, { useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Zap, Plus, CreditCard, Calendar, Search, FileText, UserPlus } from 'lucide-react';
import { CreatePawnDialogRedesigned } from '../transaction';
import { PaymentForm } from '../transaction/components';
import { ExtensionForm } from '../transaction/components';
import TransactionSelector from './TransactionSelector';
import CustomerDialog from '../customer/CustomerDialog';

// Action configuration - extracted for better maintainability and reusability
const QUICK_ACTIONS = [
  {
    id: 'new-pawn',
    label: 'New Pawn Loan',
    icon: Plus,
    route: '/transactions',
    tooltip: 'Create new pawn transaction'
  },
  {
    id: 'add-customer',
    label: 'Add Customer',
    icon: UserPlus,
    route: '/customers',
    tooltip: 'Add new customer'
  },
  {
    id: 'process-payment',
    label: 'Process Payment',
    icon: CreditCard,
    route: '/payments',
    tooltip: 'Process loan payment'
  },
  {
    id: 'apply-extension',
    label: 'Apply Extension',
    icon: Calendar,
    route: '/extensions',
    tooltip: 'Extend loan maturity date'
  },
  {
    id: 'generate-report',
    label: 'Generate Report',
    icon: FileText,
    route: '/reports',
    tooltip: 'Generate business reports'
  }
];

const QuickActionsSection = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showCreatePawnDialog, setShowCreatePawnDialog] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showExtensionDialog, setShowExtensionDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Handle action click - special handling for dialogs
  const handleActionClick = useCallback((action) => {
    if (action.id === 'new-pawn') {
      setShowCreatePawnDialog(true);
    } else if (action.id === 'add-customer') {
      setShowCustomerDialog(true);
    } else if (action.id === 'process-payment') {
      setShowPaymentDialog(true);
    } else if (action.id === 'apply-extension') {
      setShowExtensionDialog(true);
    } else {
      navigate(action.route);
    }
  }, [navigate]);

  // Handle payment dialog close - reset transaction selection
  const handlePaymentDialogClose = useCallback((open) => {
    setShowPaymentDialog(open);
    if (!open) {
      setSelectedTransaction(null);
    }
  }, []);

  // Handle extension dialog close - reset transaction selection
  const handleExtensionDialogClose = useCallback((open) => {
    setShowExtensionDialog(open);
    if (!open) {
      setSelectedTransaction(null);
    }
  }, []);

  return (
    <>
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm h-full">
      <CardContent className="py-4">
        <div className="flex flex-col gap-4">
          {/* Section Header */}
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-sm self-center"
              aria-hidden="true"
            >
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col gap-0.5">
              <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Quick Actions
              </CardTitle>
              <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                Frequently used operations
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <nav
            className="flex flex-col gap-3"
            aria-label="Quick action buttons"
            role="navigation"
          >
          {QUICK_ACTIONS.map((action) => {
            const isActive = location.pathname.startsWith(action.route);
            const Icon = action.icon;

            return (
              <Button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className={`w-full justify-start h-11 px-4 bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-900 border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all duration-200 group relative dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white dark:hover:text-white dark:border-slate-600/50 dark:hover:border-slate-500/70 ${
                  isActive ? 'border-slate-300 shadow-md dark:border-slate-500/70' : ''
                }`}
                variant="outline"
                aria-label={action.tooltip}
                aria-current={isActive ? 'page' : undefined}
                title={action.tooltip}
              >
                <div className="w-6 h-6 bg-slate-200/60 dark:bg-slate-500/30 rounded-md flex items-center justify-center mr-2 group-hover:bg-slate-300/70 dark:group-hover:bg-slate-400/40 transition-colors">
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
                <span className="font-medium text-sm whitespace-nowrap">
                  {action.label}
                </span>
              </Button>
            );
          })}
        </nav>
      </div>
    </CardContent>
  </Card>

    {/* Create Pawn Transaction Dialog - Floating */}
    <Dialog open={showCreatePawnDialog} onOpenChange={setShowCreatePawnDialog}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 bg-transparent border-0 shadow-none">
        <VisuallyHidden>
          <DialogTitle>Create Pawn Transaction</DialogTitle>
        </VisuallyHidden>
        <CreatePawnDialogRedesigned
          onSuccess={(transaction) => {
            setShowCreatePawnDialog(false);
            // Optionally dispatch a custom event to refresh dashboard stats
            window.dispatchEvent(new CustomEvent('transactionCreated', { detail: transaction }));
          }}
          onCancel={() => setShowCreatePawnDialog(false)}
        />
      </DialogContent>
    </Dialog>

    {/* Process Payment Dialog - Two-step: Select transaction, then payment form */}
    <Dialog open={showPaymentDialog} onOpenChange={handlePaymentDialogClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 bg-transparent border-0 shadow-none">
        <VisuallyHidden>
          <DialogTitle>Process Payment</DialogTitle>
        </VisuallyHidden>
        {!selectedTransaction ? (
          <TransactionSelector
            title="Select Transaction for Payment"
            subtitle="Choose a transaction to process payment"
            filterStatus={['active', 'overdue', 'extended']}
            onSelect={(transaction) => setSelectedTransaction(transaction)}
            onCancel={() => setShowPaymentDialog(false)}
          />
        ) : (
          <PaymentForm
            transaction={selectedTransaction}
            onSuccess={() => {
              setShowPaymentDialog(false);
              setSelectedTransaction(null);
              window.dispatchEvent(new CustomEvent('paymentProcessed'));
            }}
            onCancel={() => {
              setSelectedTransaction(null);
              setShowPaymentDialog(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>

    {/* Apply Extension Dialog - Two-step: Select transaction, then extension form */}
    <Dialog open={showExtensionDialog} onOpenChange={handleExtensionDialogClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 bg-transparent border-0 shadow-none">
        <VisuallyHidden>
          <DialogTitle>Apply Extension</DialogTitle>
        </VisuallyHidden>
        {!selectedTransaction ? (
          <TransactionSelector
            title="Select Transaction for Extension"
            subtitle="Choose a transaction to extend maturity date"
            filterStatus={['active', 'overdue', 'extended']}
            onSelect={(transaction) => setSelectedTransaction(transaction)}
            onCancel={() => setShowExtensionDialog(false)}
          />
        ) : (
          <ExtensionForm
            transaction={selectedTransaction}
            onSuccess={() => {
              setShowExtensionDialog(false);
              setSelectedTransaction(null);
              window.dispatchEvent(new CustomEvent('extensionApplied'));
            }}
            onCancel={() => {
              setSelectedTransaction(null);
              setShowExtensionDialog(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>

    {/* Add Customer Dialog */}
    <CustomerDialog
      open={showCustomerDialog}
      onOpenChange={setShowCustomerDialog}
      onSave={(customer) => {
        setShowCustomerDialog(false);
        // Optionally dispatch a custom event to refresh customer data
        window.dispatchEvent(new CustomEvent('customerCreated', { detail: customer }));
      }}
      onCancel={() => setShowCustomerDialog(false)}
    />
    </>
  );
};

QuickActionsSection.displayName = 'QuickActionsSection';

export default React.memo(QuickActionsSection);
