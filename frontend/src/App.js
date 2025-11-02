import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AlertCountProvider } from './context/AlertCountContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import TransactionHub from './pages/TransactionHub';
import UserManagementPage from './pages/UserManagementPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import { Toaster } from './components/ui/sonner';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AlertCountProvider>
          <Router
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}
          >
            <div className="App">
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              
              {/* Protected routes */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/customers" 
                element={
                  <ProtectedRoute>
                    <CustomersPage />
                  </ProtectedRoute>
                } 
              />
              
              <Route
                path="/transactions"
                element={
                  <ProtectedRoute>
                    <TransactionHub />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute>
                    <UserManagementPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute>
                    <AdminSettingsPage />
                  </ProtectedRoute>
                }
              />

              {/* Redirect root to dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              {/* Catch all route - redirect to dashboard */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            
            </div>
          </Router>
          <Toaster />
        </AlertCountProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
