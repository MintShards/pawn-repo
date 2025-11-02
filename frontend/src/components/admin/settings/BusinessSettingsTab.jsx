import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';

// Lazy load configuration components
const CompanyInfoConfig = lazy(() => import('../business-config/CompanyInfoConfig'));
const FinancialPolicyConfig = lazy(() => import('../business-config/FinancialPolicyConfig'));
const PrinterConfig = lazy(() => import('../business-config/PrinterConfig'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center py-8">
    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
  </div>
);

const BusinessSettingsTab = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Business Settings</h2>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Configure loan policies, fees, and system business rules
        </p>
      </div>

      {/* Company Information */}
      <Suspense fallback={<LoadingFallback />}>
        <CompanyInfoConfig />
      </Suspense>

      {/* Financial Policies */}
      <Suspense fallback={<LoadingFallback />}>
        <FinancialPolicyConfig />
      </Suspense>

      {/* Printer Configuration */}
      <Suspense fallback={<LoadingFallback />}>
        <PrinterConfig />
      </Suspense>
    </div>
  );
};

export default BusinessSettingsTab;
