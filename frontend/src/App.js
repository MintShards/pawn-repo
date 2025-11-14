import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AlertCountProvider } from './context/AlertCountContext';
import { WeatherProvider } from './context/WeatherContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import CustomersPage from './pages/CustomersPage';
import ReportsPage from './pages/ReportsPage';
import TransactionHub from './pages/TransactionHub';
import UserManagementPage from './pages/UserManagementPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import { Toaster } from './components/ui/sonner';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WeatherProvider>
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
                path="/transactions"
                element={
                  <ProtectedRoute>
                    <TransactionHub />
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
                path="/reports"
                element={
                  <ProtectedRoute>
                    <ReportsPage />
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

              {/* Redirect root to transactions */}
              <Route path="/" element={<Navigate to="/transactions" replace />} />

              {/* Catch all route - redirect to transactions */}
              <Route path="*" element={<Navigate to="/transactions" replace />} />
            </Routes>
            
            </div>
          </Router>
          <Toaster />
          </AlertCountProvider>
        </WeatherProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
