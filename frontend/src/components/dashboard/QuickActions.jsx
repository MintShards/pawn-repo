import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Zap, Plus, Users, CreditCard, Bell, FileText, Settings } from 'lucide-react';

const QuickActions = ({ userRole }) => {
  const navigate = useNavigate();

  const actions = [
    {
      label: 'New Pawn Transaction',
      icon: Plus,
      route: '/transactions',
      gradient: 'from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
      hover: 'hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/50 dark:hover:to-teal-900/50'
    },
    {
      label: 'Manage Customers',
      icon: Users,
      route: '/customers',
      gradient: 'from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
      hover: 'hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50'
    },
    {
      label: 'View Service Alerts',
      icon: Bell,
      route: '/service-alerts',
      gradient: 'from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50',
      text: 'text-red-700 dark:text-red-300',
      border: 'border-red-200 dark:border-red-800',
      hover: 'hover:from-red-100 hover:to-rose-100 dark:hover:from-red-900/50 dark:hover:to-rose-900/50'
    },
    {
      label: 'Process Payment',
      icon: CreditCard,
      route: '/payments',
      gradient: 'from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
      hover: 'hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900/50 dark:hover:to-orange-900/50'
    }
  ];

  // Admin-only actions
  if (userRole === 'admin') {
    actions.push(
      {
        label: 'Generate Report',
        icon: FileText,
        route: '/reports',
        gradient: 'from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50',
        text: 'text-slate-700 dark:text-slate-300',
        border: 'border-slate-200 dark:border-slate-700',
        hover: 'hover:from-slate-100 hover:to-slate-200 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50'
      },
      {
        label: 'Business Settings',
        icon: Settings,
        route: '/settings',
        gradient: 'from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50',
        text: 'text-violet-700 dark:text-violet-300',
        border: 'border-violet-200 dark:border-violet-800',
        hover: 'hover:from-violet-100 hover:to-purple-100 dark:hover:from-violet-900/50 dark:hover:to-purple-900/50'
      }
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-slate-900 dark:text-slate-100">Quick Actions</CardTitle>
            <CardDescription>Common daily tasks</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action) => (
          <Button
            key={action.route}
            onClick={() => navigate(action.route)}
            className={`w-full justify-start bg-gradient-to-r ${action.gradient} ${action.text} ${action.border} ${action.hover}`}
            variant="outline"
            aria-label={action.label}
          >
            <action.icon className="w-4 h-4 mr-2" aria-hidden="true" />
            {action.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
};

export default QuickActions;
