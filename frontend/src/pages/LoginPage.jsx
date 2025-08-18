import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { ThemeToggle } from '../components/ui/theme-toggle';
import LoginForm from '../components/auth/LoginForm';

const LoginPage = () => {
  const navigate = useNavigate();

  const handleLoginSuccess = (user) => {
    // Redirect to dashboard on successful login
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Hero Section with Dark Slate Pattern */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Geometric Pattern Overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(45deg, transparent 25%, rgba(255,215,0,0.1) 25%, rgba(255,215,0,0.1) 50%, transparent 50%, transparent 75%, rgba(255,215,0,0.1) 75%),
              linear-gradient(-45deg, transparent 25%, rgba(255,215,0,0.1) 25%, rgba(255,215,0,0.1) 50%, transparent 50%, transparent 75%, rgba(255,215,0,0.1) 75%)
            `,
            backgroundSize: '60px 60px'
          }} />
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-3xl">💰</span>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-amber-200 bg-clip-text text-transparent">
                  PAWN REPO
                </h1>
                <p className="text-amber-400 font-semibold text-lg tracking-wide">
                  MANAGEMENT SYSTEM
                </p>
              </div>
            </div>
            
            <div className="space-y-4 text-slate-300">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                <span className="text-lg">Secure Transaction Processing</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                <span className="text-lg">Real-time Inventory Management</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                <span className="text-lg">Professional Staff Dashboard</span>
              </div>
            </div>
          </div>
          
          <div className="border-l-4 border-amber-400 pl-6">
            <p className="text-slate-400 italic text-lg leading-relaxed">
              "Professional tools for serious business. Streamlined operations with enterprise-grade security."
            </p>
          </div>
        </div>
        
        {/* Bottom accent */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600"></div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 relative">
        {/* Theme Toggle - Positioned in top-right */}
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-lg mx-auto px-8 py-12">
          {/* Mobile Logo - Only shown on small screens */}
          <div className="lg:hidden text-center mb-12">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center mb-4 shadow-xl">
              <span className="text-3xl">💰</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">
              PAWN REPO
            </h1>
            <p className="text-amber-600 dark:text-amber-400 font-semibold tracking-wide">
              MANAGEMENT SYSTEM
            </p>
          </div>

          {/* Welcome Message */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-3">
              Welcome Back
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Sign in to access your dashboard
            </p>
          </div>

          {/* Login Card */}
          <Card className="shadow-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 relative overflow-hidden">
            {/* Gold accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600"></div>
            
            <CardHeader className="pb-6 pt-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <CardTitle className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                  Staff Access
                </CardTitle>
              </div>
              <CardDescription className="text-slate-600 dark:text-slate-400 text-base">
                Enter your credentials to access the management system
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pb-8">
              <LoginForm onLoginSuccess={handleLoginSuccess} />
            </CardContent>
          </Card>

          {/* Security Notice */}
          <div className="mt-8 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Authorized Personnel Only
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  This system is restricted to authorized staff members. All access attempts are logged and monitored.
                </p>
              </div>
            </div>
          </div>

          {/* Support Info */}
          <div className="text-center mt-6 text-sm text-slate-500 dark:text-slate-400">
            <p>Technical support: Contact your system administrator</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;