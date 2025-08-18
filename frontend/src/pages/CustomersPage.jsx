import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { ThemeToggle } from '../components/ui/theme-toggle';
import EnhancedCustomerManagement from '../components/customer/EnhancedCustomerManagement';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { ToastProvider, ToastViewport } from '../components/ui/toast';

const CustomersPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <ToastProvider>
      <ErrorBoundary fallbackMessage="An error occurred in the customer management system. Please try refreshing the page.">
        <div className="min-h-screen bg-background">
          {/* Enhanced Top Navigation Bar */}
          <div className="border-b bg-gradient-to-r from-background via-background to-background/90 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
            <div className="flex h-16 items-center justify-between px-8">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-lg">💎</span>
                  </div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent">
                    Pawn Repo
                  </h1>
                </div>
                <Button 
                  onClick={() => navigate('/dashboard')} 
                  variant="ghost"
                  size="default"
                  className="text-base font-medium hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950 dark:hover:text-emerald-300 px-4 py-2"
                >
                  Dashboard
                </Button>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
                  <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                      {user?.user_id}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium leading-none">
                      {user?.user_id}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {user?.role || 'Staff'}
                    </span>
                  </div>
                </div>
                <ThemeToggle />
                <Button 
                  onClick={handleLogout} 
                  variant="outline" 
                  size="default"
                  className="font-medium hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:hover:bg-red-950 dark:hover:text-red-300 px-4 py-2"
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <EnhancedCustomerManagement />
        </div>
        
        {/* Toast notifications */}
        <ToastViewport />
      </ErrorBoundary>
    </ToastProvider>
  );
};

export default CustomersPage;