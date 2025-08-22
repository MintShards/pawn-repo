import React from 'react';
import { MoreHorizontal, Eye, Edit2, CreditCard, TrendingUp, Phone, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Progress } from '../ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card';
import { StatusBadge, RiskBadge } from '../ui/enhanced-badge';
import customerService from '../../services/customerService';

const CustomerCard = ({ 
  customer, 
  onView, 
  onEdit, 
  onSelect, 
  isSelected = false,
  onViewTransactions,
  onManageEligibility
}) => {
  const getCustomerInitials = (customer) => {
    const firstName = customer.first_name || '';
    const lastName = customer.last_name || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getCustomerAvatarUrl = (customer) => {
    const fullName = customerService.getCustomerFullName(customer);
    return `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(fullName + customer.phone_number)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getRelativeTime = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
    return `${Math.ceil(diffDays / 365)} years ago`;
  };

  return (
    <Card className={`hover:shadow-md transition-all duration-200 ${isSelected ? 'ring-2 ring-amber-500 ring-offset-2' : ''}`}>
      <CardContent className="p-4">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1">
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelect?.(customer.phone_number, e.target.checked)}
              className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500 focus:ring-2"
              aria-label={`Select customer ${customerService.getCustomerFullName(customer)}`}
            />
            
            {/* Avatar and basic info */}
            <div 
              className="flex items-center gap-3 flex-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 rounded-lg p-1 -m-1" 
              onClick={() => onView?.(customer)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onView?.(customer);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`View details for customer ${customerService.getCustomerFullName(customer)}`}
            >
              <Avatar className="h-12 w-12 border-2 border-slate-200 dark:border-slate-700">
                <AvatarImage 
                  src={getCustomerAvatarUrl(customer)} 
                  alt={customerService.getCustomerFullName(customer)}
                />
                <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-600 text-white font-bold">
                  {getCustomerInitials(customer)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {customerService.getCustomerFullName(customer)}
                </p>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Phone className="h-3 w-3" />
                  <span className="font-mono">{customerService.formatPhoneNumber(customer.phone_number)}</span>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mt-1">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0"
                aria-label={`Actions for customer ${customerService.getCustomerFullName(customer)}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onView?.(customer)}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit?.(customer)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Customer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewTransactions?.(customer)}>
                <CreditCard className="h-4 w-4 mr-2" />
                View Transactions
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onManageEligibility?.(customer)}>
                <TrendingUp className="h-4 w-4 mr-2" />
                Manage Eligibility
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status and Risk Section */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={customer.status} />
            {customer.status === 'active' && (
              <HoverCard>
                <HoverCardTrigger>
                  <RiskBadge level={customer.risk_level} className="text-xs cursor-pointer" />
                </HoverCardTrigger>
                <HoverCardContent className="w-64" side="top">
                  <div className="space-y-2">
                    <p className="font-medium text-sm">Risk Assessment</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Can Borrow:</span>
                        <p className="font-medium text-green-600">
                          {customerService.getBorrowAmountDisplay(customer)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Score:</span>
                        <p className="font-medium">{customer.payment_history_score || 80}/100</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Risk Level:</span>
                        <p className={`font-medium ${customerService.getRiskLevelDisplay(customer).color}`}>
                          {customerService.getRiskLevelDisplay(customer).level}
                        </p>
                      </div>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            )}
          </div>
          
          {/* Last visit */}
          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {customer.last_visit ? formatDate(customer.last_visit) : 'Never'}
            </p>
            {customer.last_visit && (
              <p className="text-xs text-slate-400">{getRelativeTime(customer.last_visit)}</p>
            )}
          </div>
        </div>

        {/* Loan Activity Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">Loan Activity</span>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {customer.active_loans || 0}
                </span>
                <span className="text-xs text-slate-500 ml-1">active</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500">
                  {customer.total_transactions || 0} total
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Progress 
              value={Math.min(((customer.active_loans || 0) / 5) * 100, 100)} 
              className="flex-1 h-2"
            />
            <span className="text-xs text-slate-500 w-8">
              {Math.min(((customer.active_loans || 0) / 5) * 100, 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 hover:bg-amber-50 hover:border-amber-300 dark:hover:bg-amber-950"
            onClick={() => onView?.(customer)}
          >
            <Eye className="h-3 w-3 mr-1" />
            View
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 hover:bg-amber-50 hover:border-amber-300 dark:hover:bg-amber-950"
            onClick={() => onEdit?.(customer)}
          >
            <Edit2 className="h-3 w-3 mr-1" />
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomerCard;