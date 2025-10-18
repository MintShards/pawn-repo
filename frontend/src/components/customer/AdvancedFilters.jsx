import React, { useState, useEffect } from 'react';
import {
  Filter,
  RotateCcw,
  Users,
  DollarSign,
  Calendar,
  Gauge,
  Activity,
  SlidersHorizontal
} from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Badge } from '../ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';

/**
 * Advanced Filters Component (Sidebar Sheet)
 *
 * Provides 5 advanced customer filtering options:
 * 1. Active Loans Range
 * 2. Total Loan Value Range
 * 3. Last Activity Date Range
 * 4. Credit Utilization
 * 5. Transaction Frequency
 */
const AdvancedFilters = ({ onFilterChange, onReset }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  // Filter states
  const [activeLoansMin, setActiveLoansMin] = useState('');
  const [activeLoansMax, setActiveLoansMax] = useState('');
  const [loanValueMin, setLoanValueMin] = useState('');
  const [loanValueMax, setLoanValueMax] = useState('');
  const [lastActivityDays, setLastActivityDays] = useState('');
  const [inactiveDays, setInactiveDays] = useState('');
  const [creditUtilization, setCreditUtilization] = useState('');
  const [transactionFrequency, setTransactionFrequency] = useState('');

  // Count active filters
  useEffect(() => {
    const count = [
      activeLoansMin,
      activeLoansMax,
      loanValueMin,
      loanValueMax,
      lastActivityDays,
      inactiveDays,
      creditUtilization,
      transactionFrequency
    ].filter(val => val !== '' && val !== null && val !== undefined).length;

    setActiveFilterCount(count);
  }, [activeLoansMin, activeLoansMax, loanValueMin, loanValueMax, lastActivityDays, inactiveDays, creditUtilization, transactionFrequency]);

  // Build filter object for API
  const buildFilters = () => {
    const filters = {};

    // Use explicit checks for non-empty strings, allowing 0 as valid value
    if (activeLoansMin !== '' && activeLoansMin !== null && activeLoansMin !== undefined) {
      filters.active_loans_min = parseInt(activeLoansMin, 10);
    }
    if (activeLoansMax !== '' && activeLoansMax !== null && activeLoansMax !== undefined) {
      filters.active_loans_max = parseInt(activeLoansMax, 10);
    }
    if (loanValueMin !== '' && loanValueMin !== null && loanValueMin !== undefined) {
      filters.loan_value_min = parseFloat(loanValueMin);
    }
    if (loanValueMax !== '' && loanValueMax !== null && loanValueMax !== undefined) {
      filters.loan_value_max = parseFloat(loanValueMax);
    }
    if (lastActivityDays !== '' && lastActivityDays !== null && lastActivityDays !== undefined) {
      filters.last_activity_days = parseInt(lastActivityDays, 10);
    }
    if (inactiveDays !== '' && inactiveDays !== null && inactiveDays !== undefined) {
      filters.inactive_days = parseInt(inactiveDays, 10);
    }
    if (creditUtilization) filters.credit_utilization = creditUtilization;
    if (transactionFrequency) filters.transaction_frequency = transactionFrequency;

    return filters;
  };

  // Handle apply filters
  const handleApplyFilters = () => {
    const filters = buildFilters();
    onFilterChange(filters);
  };

  // Handle reset filters
  const handleResetFilters = () => {
    setActiveLoansMin('');
    setActiveLoansMax('');
    setLoanValueMin('');
    setLoanValueMax('');
    setLastActivityDays('');
    setInactiveDays('');
    setCreditUtilization('');
    setTransactionFrequency('');
    onReset();
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button className="h-12 rounded-xl border-0 bg-slate-100/50 dark:bg-slate-700/50 hover:bg-slate-200/50 dark:hover:bg-slate-600/50 text-base font-normal text-slate-900 dark:text-slate-100 gap-2">
          <Filter className="h-4 w-4" />
          Advanced
          {activeFilterCount > 0 && (
            <Badge variant="default" className="ml-1 bg-indigo-500 hover:bg-indigo-600">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-indigo-500" />
            Advanced Filters
          </SheetTitle>
          <SheetDescription>
            Filter customers by loans, activity, credit utilization, and transaction frequency
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Filter 1: Active Loans Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Active Loans
              </Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="active-loans-min" className="text-xs text-slate-600 dark:text-slate-400">
                  Minimum
                </Label>
                <Input
                  id="active-loans-min"
                  type="number"
                  min="0"
                  placeholder="Min"
                  value={activeLoansMin}
                  onChange={(e) => setActiveLoansMin(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="active-loans-max" className="text-xs text-slate-600 dark:text-slate-400">
                  Maximum
                </Label>
                <Input
                  id="active-loans-max"
                  type="number"
                  min="0"
                  placeholder="Max"
                  value={activeLoansMax}
                  onChange={(e) => setActiveLoansMax(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Filter 2: Total Loan Value Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Total Loan Value
              </Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="loan-value-min" className="text-xs text-slate-600 dark:text-slate-400">
                  Minimum ($)
                </Label>
                <Input
                  id="loan-value-min"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="Min"
                  value={loanValueMin}
                  onChange={(e) => setLoanValueMin(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="loan-value-max" className="text-xs text-slate-600 dark:text-slate-400">
                  Maximum ($)
                </Label>
                <Input
                  id="loan-value-max"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="Max"
                  value={loanValueMax}
                  onChange={(e) => setLoanValueMax(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Filter 3: Last Activity Date Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-500" />
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Last Activity
              </Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="last-activity-days" className="text-xs text-slate-600 dark:text-slate-400">
                  Active within (days)
                </Label>
                <Input
                  id="last-activity-days"
                  type="number"
                  min="0"
                  placeholder="e.g., 30"
                  value={lastActivityDays}
                  onChange={(e) => {
                    setLastActivityDays(e.target.value);
                    if (e.target.value) setInactiveDays(''); // Clear opposite filter
                  }}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="inactive-days" className="text-xs text-slate-600 dark:text-slate-400">
                  Inactive for (days)
                </Label>
                <Input
                  id="inactive-days"
                  type="number"
                  min="0"
                  placeholder="e.g., 60"
                  value={inactiveDays}
                  onChange={(e) => {
                    setInactiveDays(e.target.value);
                    if (e.target.value) setLastActivityDays(''); // Clear opposite filter
                  }}
                  className="mt-1"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Note: Use either "Active within" OR "Inactive for", not both
            </p>
          </div>

          {/* Filter 4: Credit Utilization */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-orange-500" />
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Credit Utilization
              </Label>
            </div>
            <Select
              value={creditUtilization}
              onValueChange={setCreditUtilization}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select utilization level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High (&gt;80%)</SelectItem>
                <SelectItem value="medium">Medium (50-80%)</SelectItem>
                <SelectItem value="low">Low (&lt;50%)</SelectItem>
                <SelectItem value="none">None (0%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter 5: Transaction Frequency */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-pink-500" />
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Transaction Frequency
              </Label>
            </div>
            <Select
              value={transactionFrequency}
              onValueChange={setTransactionFrequency}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select frequency tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newcomer">Newcomer (1-5 transactions)</SelectItem>
                <SelectItem value="regular">Regular (6-15 transactions)</SelectItem>
                <SelectItem value="loyal">Loyal (16-30 transactions)</SelectItem>
                <SelectItem value="vip">VIP (31+ transactions)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button
              onClick={() => {
                handleApplyFilters();
                setIsOpen(false);
              }}
              className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white"
            >
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
            <Button
              onClick={() => {
                handleResetFilters();
                setIsOpen(false);
              }}
              variant="outline"
              className="flex-1"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset All
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AdvancedFilters;
