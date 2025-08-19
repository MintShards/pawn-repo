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
import { 
  Sparkles, 
  Shield, 
  Lock, 
  Users, 
  TrendingUp, 
  Database,
  AlertTriangle,
  Headphones
} from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();

  const handleLoginSuccess = (user) => {
    // Redirect to dashboard on successful login
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 relative overflow-hidden">
      {/* Floating geometric elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-amber-400/20 to-orange-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-400/20 to-indigo-500/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-gradient-to-tr from-violet-400/10 to-purple-500/10 rounded-full blur-2xl"></div>
      </div>

      {/* Theme Toggle - Top Right */}
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          
          {/* Left Side - Brand & Features */}
          <div className="order-2 lg:order-1 text-center lg:text-left space-y-8">
            {/* Modern Brand Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-center lg:justify-start space-x-4">
                <div className="relative">
                  {/* Vault-style Logo */}
                  <div className="w-20 h-20 relative">
                    {/* Corner brackets */}
                    <div className="absolute -top-2 -left-2 w-6 h-6 border-l-3 border-t-3 border-amber-500 rounded-tl-lg"></div>
                    <div className="absolute -top-2 -right-2 w-6 h-6 border-r-3 border-t-3 border-amber-500 rounded-tr-lg"></div>
                    <div className="absolute -bottom-2 -left-2 w-6 h-6 border-l-3 border-b-3 border-amber-500 rounded-bl-lg"></div>
                    <div className="absolute -bottom-2 -right-2 w-6 h-6 border-r-3 border-b-3 border-amber-500 rounded-br-lg"></div>
                    
                    {/* Outer vault ring */}
                    <div className="w-20 h-20 rounded-full border-4 border-amber-500 bg-gradient-to-br from-slate-700 to-slate-800 shadow-2xl flex items-center justify-center relative">
                      {/* Inner vault door */}
                      <div className="w-12 h-12 rounded-full border-3 border-amber-400 bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-inner">
                        {/* Center square (vault handle) */}
                        <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-600 rounded-sm shadow-lg"></div>
                      </div>
                      
                      {/* Small indicator dots */}
                      <div className="absolute top-3 right-3 w-2 h-2 bg-amber-400 rounded-full"></div>
                      <div className="absolute bottom-4 left-4 w-1.5 h-1.5 bg-amber-300 rounded-full"></div>
                    </div>
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-slate-900 via-slate-700 to-amber-600 dark:from-white dark:via-slate-200 dark:to-amber-400 bg-clip-text text-transparent">
                    PawnRepo
                  </h1>
                  <p className="text-amber-600 dark:text-amber-400 font-semibold text-lg tracking-wide">
                    Management Hub
                  </p>
                </div>
              </div>
              
              <p className="text-xl text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg mx-auto lg:mx-0">
                Professional pawn shop management system with enterprise-grade security and real-time operations.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto lg:mx-0">
              <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4 border border-white/20 dark:border-slate-700/50">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">Secure Transactions</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">End-to-end encryption</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4 border border-white/20 dark:border-slate-700/50">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">Customer Hub</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Centralized management</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4 border border-white/20 dark:border-slate-700/50">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">Analytics</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Real-time insights</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4 border border-white/20 dark:border-slate-700/50">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                    <Database className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">Inventory</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Live tracking</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quote */}
            <div className="relative">
              <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-amber-400 to-orange-500 rounded-full"></div>
              <blockquote className="pl-6 text-slate-600 dark:text-slate-400 italic text-lg">
                "Streamlined operations with professional-grade tools designed for serious business."
              </blockquote>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="order-1 lg:order-2 w-full max-w-md mx-auto">
            {/* Floating Login Card */}
            <Card className="border-0 shadow-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl relative overflow-hidden">
              {/* Gradient accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500"></div>
              
              <CardHeader className="pb-6 pt-8 text-center">
                <div className="mx-auto mb-4 w-16 h-16 relative">
                  {/* Mini Vault Logo for Login Card */}
                  <div className="w-16 h-16 rounded-full border-3 border-amber-500 bg-gradient-to-br from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700 shadow-xl flex items-center justify-center relative">
                    {/* Inner vault door */}
                    <div className="w-9 h-9 rounded-full border-2 border-amber-400 bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-inner">
                      {/* Center square (vault handle) */}
                      <div className="w-4 h-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-sm shadow-lg"></div>
                    </div>
                    
                    {/* Small indicator dots */}
                    <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
                    <div className="absolute bottom-2.5 left-2.5 w-1 h-1 bg-amber-300 rounded-full"></div>
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Staff Portal
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400 text-base mt-2">
                  Enter your credentials to access the management system
                </CardDescription>
              </CardHeader>
              
              <CardContent className="pt-0 pb-8">
                <LoginForm onLoginSuccess={handleLoginSuccess} />
              </CardContent>
            </Card>

            {/* Security Notice */}
            <div className="mt-6 p-4 bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-700/30">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Authorized Personnel Only
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    This system is restricted to authorized staff. All access attempts are logged and monitored for security.
                  </p>
                </div>
              </div>
            </div>

            {/* Support Info */}
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 dark:bg-slate-800/20 backdrop-blur-sm rounded-full border border-white/10 dark:border-slate-700/20">
                <Headphones className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Support: Contact system administrator
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;