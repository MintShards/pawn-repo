import React, { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Zap, Plus, CreditCard, Calendar, Search, FileText } from 'lucide-react';

// Action configuration - extracted for better maintainability and reusability
const QUICK_ACTIONS = [
  {
    id: 'new-pawn',
    label: 'New Pawn Loan',
    icon: Plus,
    route: '/transactions',
    tooltip: 'Create new pawn transaction',
    gradient: 'from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50',
    iconColor: 'text-blue-600 dark:text-blue-400',
    textColor: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    hover: 'hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50',
    ringColor: 'ring-blue-500'
  },
  {
    id: 'process-payment',
    label: 'Process Payment',
    icon: CreditCard,
    route: '/payments',
    tooltip: 'Process loan payment',
    gradient: 'from-purple-50 to-violet-50 dark:from-purple-950/50 dark:to-violet-950/50',
    iconColor: 'text-purple-600 dark:text-purple-400',
    textColor: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    hover: 'hover:from-purple-100 hover:to-violet-100 dark:hover:from-purple-900/50 dark:hover:to-violet-900/50',
    ringColor: 'ring-purple-500'
  },
  {
    id: 'apply-extension',
    label: 'Apply Extension',
    icon: Calendar,
    route: '/extensions',
    tooltip: 'Extend loan maturity date',
    gradient: 'from-cyan-50 to-sky-50 dark:from-cyan-950/50 dark:to-sky-950/50',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    textColor: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-200 dark:border-cyan-800',
    hover: 'hover:from-cyan-100 hover:to-sky-100 dark:hover:from-cyan-900/50 dark:hover:to-sky-900/50',
    ringColor: 'ring-cyan-500'
  },
  {
    id: 'quick-search',
    label: 'Quick Search',
    icon: Search,
    route: '/search',
    tooltip: 'Search customers and transactions',
    gradient: 'from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    hover: 'hover:from-emerald-100 hover:to-green-100 dark:hover:from-emerald-900/50 dark:hover:to-green-900/50',
    ringColor: 'ring-emerald-500'
  },
  {
    id: 'generate-report',
    label: 'Generate Report',
    icon: FileText,
    route: '/reports',
    tooltip: 'Generate business reports',
    gradient: 'from-sky-50 to-blue-50 dark:from-sky-950/50 dark:to-blue-950/50',
    iconColor: 'text-sky-600 dark:text-sky-400',
    textColor: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800',
    hover: 'hover:from-sky-100 hover:to-blue-100 dark:hover:from-sky-900/50 dark:hover:to-blue-900/50',
    ringColor: 'ring-sky-500'
  }
];

const QuickActionsSection = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Memoized navigation handler
  const handleNavigate = useCallback((route) => {
    navigate(route);
  }, [navigate]);

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Section Header */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <div
              className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-sm"
              aria-hidden="true"
            >
              <Zap className="w-4 h-4 text-white" />
            </div>
            <CardTitle className="text-base text-slate-900 dark:text-slate-100">
              Quick Actions
            </CardTitle>
          </div>

          {/* Action Buttons */}
          <nav
            className="flex gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent hover:scrollbar-thumb-slate-400 dark:hover:scrollbar-thumb-slate-500"
            aria-label="Quick action buttons"
            role="navigation"
          >
            {QUICK_ACTIONS.map((action) => {
              const isActive = location.pathname.startsWith(action.route);
              const Icon = action.icon;

              return (
                <Button
                  key={action.id}
                  onClick={() => handleNavigate(action.route)}
                  className={`h-10 px-4 flex items-center justify-center gap-2 flex-shrink-0 bg-gradient-to-r ${action.gradient} ${action.border} ${action.hover} transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${action.ringColor} ${
                    isActive ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${action.ringColor}` : ''
                  }`}
                  variant="outline"
                  aria-label={action.tooltip}
                  aria-current={isActive ? 'page' : undefined}
                  title={action.tooltip}
                >
                  <Icon className={`w-4 h-4 ${action.iconColor}`} aria-hidden="true" />
                  <span className={`text-xs font-medium ${action.textColor} whitespace-nowrap`}>
                    {action.label}
                  </span>
                </Button>
              );
            })}
          </nav>
        </div>
      </CardContent>
    </Card>
  );
};

QuickActionsSection.displayName = 'QuickActionsSection';

export default React.memo(QuickActionsSection);
