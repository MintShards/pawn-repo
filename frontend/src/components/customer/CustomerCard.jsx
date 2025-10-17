import { MoreHorizontal, Eye, Edit2, CreditCard, TrendingUp, Phone, Mail, DollarSign, Package } from 'lucide-react';
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
import AlertBellAction from './AlertBellAction';

const CustomerCard = ({
  customer,
  onView,
  onEdit,
  onSelect,
  isSelected = false,
  onViewTransactions,
  onManageEligibility,
  onBellClick,
  onSetCustomLimit,
  maxActiveLoans = 8,
  customerTransactions = [], // Pass transaction data to calculate accurate values
  calculateLastActivity = null // Function to calculate last activity from transactions
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
    <Card className={`relative overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${isSelected ? 'ring-2 ring-amber-500 ring-offset-2' : ''}`}>
      {/* Gold accent line matching main UI */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600"></div>

      <CardContent className="p-5 pt-6">
        {/* Header Section */}
        <div className="flex items-center gap-4 mb-5">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect?.(customer.phone_number, e.target.checked)}
            className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500 focus:ring-2 cursor-pointer flex-shrink-0"
            aria-label={`Select customer ${customerService.getCustomerFullName(customer)}`}
          />

          {/* Avatar and basic info */}
          <div className="flex items-center gap-4 flex-1">
            <div
              className="flex items-center gap-4 flex-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200 rounded-xl p-3 -m-3"
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
              <Avatar className="h-14 w-14 ring-2 ring-slate-200 dark:ring-slate-700 shadow-sm">
                <AvatarImage
                  src={getCustomerAvatarUrl(customer)}
                  alt={customerService.getCustomerFullName(customer)}
                />
                <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-600 text-white font-bold text-lg">
                  {getCustomerInitials(customer)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base text-slate-900 dark:text-slate-100 truncate mb-1.5">
                  {customerService.getCustomerFullName(customer)}
                </p>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-1">
                  <Phone className="h-3.5 w-3.5" />
                  <span className="font-mono text-xs">{customerService.formatPhoneNumber(customer.phone_number)}</span>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate text-xs">{customer.email}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 self-start mt-3">
              <StatusBadge status={customer.status} />
            </div>
          </div>
        </div>

        {/* Loan Activity Section */}
        <div className="space-y-3 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-700 dark:text-slate-300 font-semibold">Loan Activity</span>
            {customer.custom_loan_limit && (
              <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-2.5 py-0.5 rounded-full font-medium">
                Custom Limit
              </span>
            )}
          </div>

          <div className="space-y-3">
            {/* Credit Usage */}
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
              const creditPercentage = Math.min((displayUsedCredit / creditLimit) * 100, 100);
              
              return (
                <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-50 dark:from-emerald-950/40 dark:via-green-950/40 dark:to-emerald-950/40 rounded-xl p-3.5 space-y-2.5 border border-emerald-100 dark:border-emerald-900/30 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Credit Usage</span>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${
                      creditPercentage >= 100 ? 'text-red-600 dark:text-red-400' :
                      creditPercentage >= 80 ? 'text-amber-600 dark:text-amber-400' :
                      'text-emerald-700 dark:text-emerald-300'
                    }`}>
                      {Math.round(creditPercentage)}%
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-600 dark:text-slate-400">{formatCurrency(displayUsedCredit)}</span>
                      <span className="text-slate-500 dark:text-slate-500">of {formatCurrency(creditLimit)}</span>
                    </div>
                    <div className="w-full bg-white/80 dark:bg-slate-800/80 rounded-full h-2.5 overflow-hidden shadow-inner">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-700 ease-out ${
                          creditPercentage >= 100 ? 'bg-gradient-to-r from-red-500 via-red-600 to-red-500' :
                          creditPercentage >= 80 ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500' :
                          'bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500'
                        }`}
                        style={{ width: `${creditPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Slot Usage */}
            {(() => {
              // Calculate slots from transactions with customer field fallback
              const slotsUsedFromTransactions = customerTransactions.filter(t => 
                t.status === 'active' || t.status === 'overdue' || t.status === 'extended' || 
                t.status === 'hold' || t.status === 'damaged'
              ).length;
              
              const hasTransactionData = customerTransactions.length > 0;
              const displayActiveLoans = hasTransactionData ? slotsUsedFromTransactions : (customer.active_loans || 0);
              const effectiveMaxLoans = getEffectiveLoanLimit();
              const slotPercentage = Math.min((displayActiveLoans / effectiveMaxLoans) * 100, 100);
              
              return (
                <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-blue-950/40 rounded-xl p-3.5 space-y-2.5 border border-blue-100 dark:border-blue-900/30 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                        <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Loan Slots</span>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${
                      slotPercentage >= 100 ? 'text-red-600 dark:text-red-400' :
                      slotPercentage >= 80 ? 'text-amber-600 dark:text-amber-400' :
                      'text-blue-700 dark:text-blue-300'
                    }`}>
                      {Math.round(slotPercentage)}%
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-600 dark:text-slate-400">{displayActiveLoans} active</span>
                      <span className="text-slate-500 dark:text-slate-500">of {effectiveMaxLoans}</span>
                    </div>
                    <div className="w-full bg-white/80 dark:bg-slate-800/80 rounded-full h-2.5 overflow-hidden shadow-inner">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-700 ease-out ${
                          slotPercentage >= 100 ? 'bg-gradient-to-r from-red-500 via-red-600 to-red-500' :
                          slotPercentage >= 80 ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500' :
                          'bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500'
                        }`}
                        style={{ width: `${slotPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Last Visit Section */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">Last Visit</span>
            <div className="text-right">
              {(() => {
                // Calculate last activity from transactions if available and calculator provided
                const calculatedLastActivity = calculateLastActivity ? calculateLastActivity(customerTransactions) : null;

                // Use calculated activity if available, otherwise fall back to last_transaction_date
                const lastActivity = calculatedLastActivity || customer.last_transaction_date;

                if (lastActivity) {
                  return (
                    <>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatDate(lastActivity)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {getRelativeTime(lastActivity)}
                      </p>
                    </>
                  );
                }

                return (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                    No activity
                  </p>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-1 mt-5">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/20 hover:text-amber-600 dark:hover:text-amber-400 transition-all duration-200"
            onClick={() => onEdit?.(customer)}
            title="Edit Customer"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200"
            onClick={() => onView?.(customer)}
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <AlertBellAction
            customerPhone={customer.phone_number}
            onBellClick={onBellClick}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
                title="More Actions"
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
              {isAdmin && (
                <DropdownMenuItem onClick={() => onManageEligibility?.(customer)}>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Manage Eligibility
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomerCard;