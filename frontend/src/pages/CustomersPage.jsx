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
          {/* Minimal Top Bar */}
          <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
            <div className="flex h-14 items-center justify-between px-6">
              <div className="flex items-center gap-6">
                <h1 className="text-base font-medium">Pawn Repo</h1>
                <Button 
                  onClick={() => navigate('/dashboard')} 
                  variant="ghost"
                  size="sm"
                  className="text-sm"
                >
                  Dashboard
                </Button>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {user?.user_id} • {user?.role || 'Staff'}
                </span>
                <ThemeToggle />
                <Button onClick={handleLogout} variant="ghost" size="sm" className="text-sm">
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