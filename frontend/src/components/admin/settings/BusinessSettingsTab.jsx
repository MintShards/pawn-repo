import React, { Suspense, lazy } from 'react';
import { CompanyInfoSkeleton, SettingsFormSkeleton, PrinterConfigSkeleton } from '../../ui/skeleton';

// Lazy load configuration components
const CompanyInfoConfig = lazy(() => import('../business-config/CompanyInfoConfig'));
const FinancialPolicyConfig = lazy(() => import('../business-config/FinancialPolicyConfig'));
const LocationConfig = lazy(() => import('../business-config/LocationConfig'));
const PrinterConfig = lazy(() => import('../business-config/PrinterConfig'));

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
      <Suspense fallback={<CompanyInfoSkeleton />}>
        <CompanyInfoConfig />
      </Suspense>

      {/* Financial Policies */}
      <Suspense fallback={<SettingsFormSkeleton sections={3} />}>
        <FinancialPolicyConfig />
      </Suspense>

      {/* Business Location */}
      <Suspense fallback={<CompanyInfoSkeleton />}>
        <LocationConfig />
      </Suspense>

      {/* Printer Configuration */}
      <Suspense fallback={<PrinterConfigSkeleton />}>
        <PrinterConfig />
      </Suspense>
    </div>
  );
};

export default BusinessSettingsTab;
