import { MoreHorizontal, Eye, Edit2, CreditCard, TrendingUp, Phone, Mail, Gauge } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { StatusBadge } from '../ui/enhanced-badge';
import { formatBusinessDate } from '../../utils/timezoneUtils';
import { formatCurrency } from '../../utils/transactionUtils';
import customerService from '../../services/customerService';
import { useAuth } from '../../context/AuthContext';
import { isAdmin as isAdminRole } from '../../utils/roleUtils';

const CustomerCard = ({ 
  customer, 
  onView, 
  onEdit, 
  onSelect, 
  isSelected = false,
  onViewTransactions,
  onManageEligibility,
  onNotifications,
  onSetCustomLimit,
  maxActiveLoans = 8,
  customerTransactions = [] // Pass transaction data to calculate accurate values
}) => {
  const { user } = useAuth();
  const isAdmin = isAdminRole(user);
  
  
  const getCustomerInitials = (customer) => {
    const firstName = customer.first_name || '';
    const lastName = customer.last_name || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getCustomerAvatarUrl = (customer) => {
    const fullName = customerService.getCustomerFullName(customer);
    return `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(fullName + customer.phone_number)}`;
  };

  // Get the effective loan limit for this customer
  const getEffectiveLoanLimit = () => {
    return customer.custom_loan_limit || maxActiveLoans;
  };

  const formatDate = (dateString) => {
    return formatBusinessDate(dateString);
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

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={() => onView?.(customer)}
              aria-label={`View details for customer ${customerService.getCustomerFullName(customer)}`}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0"
                  aria-label={`More actions for customer ${customerService.getCustomerFullName(customer)}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
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
                {isAdmin && (
                  <DropdownMenuItem 
                    onClick={() => onSetCustomLimit?.(customer)}
                  >
                    <Gauge className="h-4 w-4 mr-2" />
                    Set Loan Limit
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Status Section */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={customer.status} />
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Loan Activity</span>
            {customer.custom_loan_limit && (
              <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 px-2 py-1 rounded-full">
                Custom Limit
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Credit Information */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Credit Used</div>
              {(() => {
                // Calculate credit from transactions with customer field fallback
                const slotUsingTransactions = customerTransactions.filter(t => 
                  t.status === 'active' || t.status === 'overdue' || t.status === 'extended' || 
                  t.status === 'hold' || t.status === 'damaged'
                );
                const usedCreditFromTransactions = slotUsingTransactions.reduce((total, t) => 
                  total + (t.loan_amount || 0), 0
                );
                
                const hasTransactionData = customerTransactions.length > 0;
                const displayUsedCredit = hasTransactionData ? usedCreditFromTransactions : (customer.total_loan_value || 0);
                const creditLimit = customer.credit_limit || 3000;
                
                return (
                  <>
                    <div className={`text-sm font-semibold ${displayUsedCredit >= creditLimit ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
                      {formatCurrency(displayUsedCredit)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      of {formatCurrency(creditLimit)}
                    </div>
                  </>
                );
              })()}
            </div>
            
            {/* Slot Information */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Active Slots</div>
              {(() => {
                // Calculate slots from transactions with customer field fallback
                const slotsUsedFromTransactions = customerTransactions.filter(t => 
                  t.status === 'active' || t.status === 'overdue' || t.status === 'extended' || 
                  t.status === 'hold' || t.status === 'damaged'
                ).length;
                
                const hasTransactionData = customerTransactions.length > 0;
                const displayActiveLoans = hasTransactionData ? slotsUsedFromTransactions : (customer.active_loans || 0);
                const effectiveMaxLoans = getEffectiveLoanLimit();
                
                return (
                  <>
                    <div className={`text-sm font-semibold ${displayActiveLoans >= effectiveMaxLoans ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
                      {displayActiveLoans} / {effectiveMaxLoans}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {customer.total_transactions || 0} total loans
                    </div>
                  </>
                );
              })()}
            </div>
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
          {isAdmin && (
            <Button 
              variant="outline" 
              size="sm" 
              className="hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950"
              onClick={() => onSetCustomLimit?.(customer)}
              title="Set Custom Loan Limit (Admin Only)"
            >
              <Gauge className="h-4 w-4 mr-1" />
              Limit
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomerCard;