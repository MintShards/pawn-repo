import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { ThemeToggle } from '../components/ui/theme-toggle';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { Card } from '../components/ui/card';
import EnhancedCustomerManagement from '../components/customer/EnhancedCustomerManagement';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { ToastProvider, ToastViewport } from '../components/ui/toast';
import { getRoleTitle, getUserDisplayString } from '../utils/roleUtils';
import { 
  LayoutDashboard, 
  Users, 
  LogOut, 
  Sparkles,
  Crown,
  UserCheck
} from 'lucide-react';

const CustomersPage = () => {
  const { user, logout, loading, fetchUserDataIfNeeded } = useAuth();
  const navigate = useNavigate();

  // Fetch user data if needed on component mount
  React.useEffect(() => {
    if (!user && !loading) {
      fetchUserDataIfNeeded();
    }
  }, [user, loading, fetchUserDataIfNeeded]);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <ToastProvider>
      <ErrorBoundary fallbackMessage="An error occurred in the customer management system. Please try refreshing the page.">
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
          {/* Modern Minimal Header */}
          <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 items-center justify-between">
                
                {/* Left: Brand & Navigation */}
                <div className="flex items-center space-x-8">
                  {/* Vault Logo Brand */}
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full border-2 border-amber-500 bg-gradient-to-br from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700 shadow-lg flex items-center justify-center">
                        {/* Inner vault door */}
                        <div className="w-6 h-6 rounded-full border border-amber-400 bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                          {/* Center square (vault handle) */}
                          <div className="w-2.5 h-2.5 bg-gradient-to-br from-orange-500 to-red-600 rounded-sm"></div>
                        </div>
                      </div>
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900"></div>
                    </div>
                    <div className="hidden sm:block">
                      <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                        PawnRepo
                      </h1>
                      <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1">
                        Customer Hub
                      </p>
                    </div>
                  </div>

                  {/* Navigation Pills */}
                  <nav className="hidden md:flex items-center space-x-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => navigate('/dashboard')}
                      className="h-9 px-3 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </Button>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
                    <div className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 rounded-lg border border-blue-100 dark:border-blue-900/50">
                      <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Customers
                      </span>
                    </div>
                  </nav>
                </div>

                {/* Right: User & Controls */}
                <div className="flex items-center space-x-4">
                  {/* User Profile Card */}
                  <Card className="border-0 shadow-sm bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="flex items-center space-x-3 px-4 py-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage 
                          src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.user_id || 'XX'}&backgroundColor=f59e0b`} 
                        />
                        <AvatarFallback className="bg-amber-500 text-white text-xs font-semibold">
                          {user?.user_id || 'XX'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="hidden sm:block">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {user?.first_name ? user.first_name : getUserDisplayString(user, loading)}
                          </span>
                          {user?.role === 'admin' && (
                            <Crown className="w-3 h-3 text-amber-500" />
                          )}
                          {user?.role === 'staff' && (
                            <UserCheck className="w-3 h-3 text-blue-500" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {getRoleTitle(user?.role, loading)}
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Controls */}
                  <div className="flex items-center space-x-2">
                    <ThemeToggle />
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleLogout}
                      className="h-9 px-3 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="hidden sm:inline ml-2">Sign Out</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </header>

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