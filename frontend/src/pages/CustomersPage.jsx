import React from 'react';
import { useAuth } from '../context/AuthContext';
import EnhancedCustomerManagement from '../components/customer/EnhancedCustomerManagement';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { ToastProvider, ToastViewport } from '../components/ui/toast';
import AppHeader from '../components/common/AppHeader';

const CustomersPage = () => {
  const { user, loading, fetchUserDataIfNeeded } = useAuth();

  // Fetch user data if needed on component mount
  React.useEffect(() => {
    if (!user && !loading) {
      fetchUserDataIfNeeded();
    }
  }, [user, loading, fetchUserDataIfNeeded]);

  return (
    <ToastProvider>
      <ErrorBoundary fallbackMessage="An error occurred in the customer management system. Please try refreshing the page.">
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
          <AppHeader pageTitle="Customer Hub" />

          {/* Main Content with improved spacing */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <EnhancedCustomerManagement />
          </main>
        </div>
        
        {/* Toast notifications */}
        <ToastViewport />
      </ErrorBoundary>
    </ToastProvider>
  );
};

export default CustomersPage;