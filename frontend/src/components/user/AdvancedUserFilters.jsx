import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import { Badge } from '../ui/badge';
import {
  Calendar,
  X,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  Activity,
  Clock,
  AlertTriangle,
  Users,
  UserCheck,
  Check,
  Sparkles,
  UserX,
  Mail,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  getBusinessToday,
  getBusinessDaysAgo,
  businessDateToISOStart,
  businessDateToISOEnd
} from '../../utils/timezoneUtils';

const AdvancedUserFilters = ({ filters, onFilterChange, onClearFilters }) => {
  // Collapsible sections state
  const [dateFiltersOpen, setDateFiltersOpen] = useState(false);
  const [securityFiltersOpen, setSecurityFiltersOpen] = useState(false);
  const [activityFiltersOpen, setActivityFiltersOpen] = useState(false);
  const [contactFiltersOpen, setContactFiltersOpen] = useState(false);
  const [accountAgeFiltersOpen, setAccountAgeFiltersOpen] = useState(false);
  const [auditFiltersOpen, setAuditFiltersOpen] = useState(false);

  // Local state for date inputs
  const [localFilters, setLocalFilters] = useState({
    created_after: filters.created_after || '',
    created_before: filters.created_before || '',
    last_login_after: filters.last_login_after || '',
    last_login_before: filters.last_login_before || '',
  });

  // Track active preset for visual feedback
  const [activePreset, setActivePreset] = useState(null);

  // Update local state when filters prop changes
  useEffect(() => {
    setLocalFilters({
      created_after: filters.created_after || '',
      created_before: filters.created_before || '',
      last_login_after: filters.last_login_after || '',
      last_login_before: filters.last_login_before || '',
    });
  }, [filters]);

  // Wrapper for filter changes to clear active preset when manually changed
  const handleFilterChange = (key, value) => {
    // Clear active preset when user manually changes filters
    setActivePreset(null);
    onFilterChange(key, value);
  };

  // Wrapper for clear filters to clear active preset
  const handleClearFilters = () => {
    setActivePreset(null);
    onClearFilters();
  };

  // Count active advanced filters
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.created_after || filters.created_before) count++;
    if (filters.last_login_after || filters.last_login_before) count++;
    if (filters.is_locked !== undefined && filters.is_locked !== '') count++;
    if (filters.min_failed_attempts !== undefined && filters.min_failed_attempts !== '') count++;
    if (filters.has_active_sessions !== undefined && filters.has_active_sessions !== '') count++;
    if (filters.never_logged_in !== undefined && filters.never_logged_in !== '') count++;
    if (filters.has_email !== undefined && filters.has_email !== '') count++;
    if (filters.account_age_min_days !== undefined && filters.account_age_min_days !== '') count++;
    if (filters.account_age_max_days !== undefined && filters.account_age_max_days !== '') count++;
    if (filters.created_by) count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  // Check which filters are active
  const isDateFilterActive = !!(filters.created_after || filters.created_before || filters.last_login_after || filters.last_login_before);
  const isSecurityFilterActive = !!(
    (filters.is_locked !== undefined && filters.is_locked !== '') ||
    (filters.min_failed_attempts !== undefined && filters.min_failed_attempts !== '')
  );
  const isActivityFilterActive = !!(
    (filters.has_active_sessions !== undefined && filters.has_active_sessions !== '') ||
    (filters.never_logged_in !== undefined && filters.never_logged_in !== '')
  );
  const isContactFilterActive = !!(filters.has_email !== undefined && filters.has_email !== '');
  const isAccountAgeFilterActive = !!(
    (filters.account_age_min_days !== undefined && filters.account_age_min_days !== '') ||
    (filters.account_age_max_days !== undefined && filters.account_age_max_days !== '')
  );
  const isAuditFilterActive = !!(filters.created_by);

  // Handle date input changes
  const handleDateChange = (key, value) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  // Apply date filters with visual feedback
  const applyDateFilter = (key) => {
    const value = localFilters[key];
    if (value) {
      const isoDate = new Date(value).toISOString();
      handleFilterChange(key, isoDate);
    } else {
      handleFilterChange(key, '');
    }
  };

  // Quick preset filters with improved UX (using business timezone utilities)
  const applyPreset = (presetName) => {
    setActivePreset(presetName);
    const presets = {
      locked_accounts: {
        is_locked: true,
        reset: ['created_after', 'created_before', 'last_login_after', 'last_login_before', 'has_active_sessions', 'min_failed_attempts', 'never_logged_in', 'has_email', 'account_age_min_days', 'account_age_max_days', 'created_by']
      },
      new_today: {
        // Use business timezone (Pacific Time) for consistent date boundaries
        created_after: businessDateToISOStart(getBusinessToday()),
        reset: ['created_before', 'last_login_after', 'last_login_before', 'is_locked', 'has_active_sessions', 'min_failed_attempts', 'never_logged_in', 'has_email', 'account_age_min_days', 'account_age_max_days', 'created_by']
      },
      inactive_30d: {
        // Use business timezone (Pacific Time) for consistent date calculations
        last_login_before: businessDateToISOEnd(getBusinessDaysAgo(30)),
        reset: ['created_after', 'created_before', 'last_login_after', 'is_locked', 'has_active_sessions', 'min_failed_attempts', 'never_logged_in', 'has_email', 'account_age_min_days', 'account_age_max_days', 'created_by']
      },
      active_sessions: {
        has_active_sessions: true,
        reset: ['created_after', 'created_before', 'last_login_after', 'last_login_before', 'is_locked', 'min_failed_attempts', 'never_logged_in', 'has_email', 'account_age_min_days', 'account_age_max_days', 'created_by']
      },
      failed_attempts: {
        min_failed_attempts: 3,
        reset: ['created_after', 'created_before', 'last_login_after', 'last_login_before', 'is_locked', 'has_active_sessions', 'never_logged_in', 'has_email', 'account_age_min_days', 'account_age_max_days', 'created_by']
      },
      never_logged_in: {
        never_logged_in: true,
        reset: ['created_after', 'created_before', 'last_login_after', 'last_login_before', 'is_locked', 'has_active_sessions', 'min_failed_attempts', 'has_email', 'account_age_min_days', 'account_age_max_days', 'created_by']
      },
      new_accounts: {
        account_age_max_days: 30,
        reset: ['created_after', 'created_before', 'last_login_after', 'last_login_before', 'is_locked', 'has_active_sessions', 'min_failed_attempts', 'never_logged_in', 'has_email', 'account_age_min_days', 'created_by']
      },
      no_email: {
        has_email: false,
        reset: ['created_after', 'created_before', 'last_login_after', 'last_login_before', 'is_locked', 'has_active_sessions', 'min_failed_attempts', 'never_logged_in', 'account_age_min_days', 'account_age_max_days', 'created_by']
      }
    };

    const preset = presets[presetName];
    if (preset) {
      // Reset other filters (use onFilterChange directly to avoid clearing activePreset)
      preset.reset.forEach(key => onFilterChange(key, ''));
      Object.entries(preset).forEach(([key, value]) => {
        if (key !== 'reset') {
          onFilterChange(key, value);
        }
      });
    }
    // Note: activePreset stays set until user manually changes filters or clears all
  };

  return (
    <div className="space-y-6">
      {/* Active filter indicator and clear button */}
      {activeFilterCount > 0 && (
        <div className="flex items-center justify-end gap-2 pb-2">
          <Badge
            variant="secondary"
            className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800 animate-in fade-in duration-200"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            {activeFilterCount} active
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-8 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
          >
            <X className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        </div>
      )}

      {/* Quick Presets with enhanced visual design */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Quick Presets</Label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          <Button
            variant={activePreset === 'locked_accounts' ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset('locked_accounts')}
            className="h-auto py-3 px-4 flex flex-col items-center gap-2 transition-all duration-200 hover:scale-105 hover:shadow-md"
          >
            <Lock className="h-4 w-4" />
            <span className="text-xs font-medium">Locked</span>
            {activePreset === 'locked_accounts' && <Check className="h-3 w-3 animate-in zoom-in duration-200" />}
          </Button>
          <Button
            variant={activePreset === 'new_today' ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset('new_today')}
            className="h-auto py-3 px-4 flex flex-col items-center gap-2 transition-all duration-200 hover:scale-105 hover:shadow-md"
          >
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">New Today</span>
            {activePreset === 'new_today' && <Check className="h-3 w-3 animate-in zoom-in duration-200" />}
          </Button>
          <Button
            variant={activePreset === 'inactive_30d' ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset('inactive_30d')}
            className="h-auto py-3 px-4 flex flex-col items-center gap-2 transition-all duration-200 hover:scale-105 hover:shadow-md"
          >
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">Inactive 30d</span>
            {activePreset === 'inactive_30d' && <Check className="h-3 w-3 animate-in zoom-in duration-200" />}
          </Button>
          <Button
            variant={activePreset === 'active_sessions' ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset('active_sessions')}
            className="h-auto py-3 px-4 flex flex-col items-center gap-2 transition-all duration-200 hover:scale-105 hover:shadow-md"
          >
            <Activity className="h-4 w-4" />
            <span className="text-xs font-medium">Active Now</span>
            {activePreset === 'active_sessions' && <Check className="h-3 w-3 animate-in zoom-in duration-200" />}
          </Button>
          <Button
            variant={activePreset === 'failed_attempts' ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset('failed_attempts')}
            className="h-auto py-3 px-4 flex flex-col items-center gap-2 transition-all duration-200 hover:scale-105 hover:shadow-md"
          >
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium">Failed 3+</span>
            {activePreset === 'failed_attempts' && <Check className="h-3 w-3 animate-in zoom-in duration-200" />}
          </Button>
          <Button
            variant={activePreset === 'never_logged_in' ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset('never_logged_in')}
            className="h-auto py-3 px-4 flex flex-col items-center gap-2 transition-all duration-200 hover:scale-105 hover:shadow-md"
          >
            <UserX className="h-4 w-4" />
            <span className="text-xs font-medium">Never Login</span>
            {activePreset === 'never_logged_in' && <Check className="h-3 w-3 animate-in zoom-in duration-200" />}
          </Button>
          <Button
            variant={activePreset === 'new_accounts' ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset('new_accounts')}
            className="h-auto py-3 px-4 flex flex-col items-center gap-2 transition-all duration-200 hover:scale-105 hover:shadow-md"
          >
            <UserCheck className="h-4 w-4" />
            <span className="text-xs font-medium">New &lt;30d</span>
            {activePreset === 'new_accounts' && <Check className="h-3 w-3 animate-in zoom-in duration-200" />}
          </Button>
          <Button
            variant={activePreset === 'no_email' ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset('no_email')}
            className="h-auto py-3 px-4 flex flex-col items-center gap-2 transition-all duration-200 hover:scale-105 hover:shadow-md"
          >
            <Mail className="h-4 w-4" />
            <span className="text-xs font-medium">No Email</span>
            {activePreset === 'no_email' && <Check className="h-3 w-3 animate-in zoom-in duration-200" />}
          </Button>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />

      {/* Date Filters with improved styling */}
      <Collapsible open={dateFiltersOpen} onOpenChange={setDateFiltersOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={`w-full justify-between h-auto py-3 px-4 rounded-xl transition-all duration-200 ${
              dateFiltersOpen
                ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-100'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${isDateFilterActive ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                <Calendar className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Date Range Filters</span>
                  {isDateFilterActive && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Filter by creation and login dates</p>
              </div>
            </div>
            {dateFiltersOpen ? (
              <ChevronUp className="h-4 w-4 transition-transform duration-200" />
            ) : (
              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4 px-1 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="created_after" className="text-sm font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3 text-slate-400" />
                Created After
              </Label>
              <div className="flex gap-2">
                <Input
                  id="created_after"
                  type="date"
                  value={localFilters.created_after.split('T')[0] || ''}
                  onChange={(e) => handleDateChange('created_after', e.target.value)}
                  className="h-10 transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => applyDateFilter('created_after')}
                  className="h-10 px-4 bg-blue-600 hover:bg-blue-700"
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="created_before" className="text-sm font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3 text-slate-400" />
                Created Before
              </Label>
              <div className="flex gap-2">
                <Input
                  id="created_before"
                  type="date"
                  value={localFilters.created_before.split('T')[0] || ''}
                  onChange={(e) => handleDateChange('created_before', e.target.value)}
                  className="h-10 transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => applyDateFilter('created_before')}
                  className="h-10 px-4 bg-blue-600 hover:bg-blue-700"
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="last_login_after" className="text-sm font-medium flex items-center gap-1">
                <Activity className="h-3 w-3 text-slate-400" />
                Last Login After
              </Label>
              <div className="flex gap-2">
                <Input
                  id="last_login_after"
                  type="date"
                  value={localFilters.last_login_after.split('T')[0] || ''}
                  onChange={(e) => handleDateChange('last_login_after', e.target.value)}
                  className="h-10 transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => applyDateFilter('last_login_after')}
                  className="h-10 px-4 bg-blue-600 hover:bg-blue-700"
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_login_before" className="text-sm font-medium flex items-center gap-1">
                <Activity className="h-3 w-3 text-slate-400" />
                Last Login Before
              </Label>
              <div className="flex gap-2">
                <Input
                  id="last_login_before"
                  type="date"
                  value={localFilters.last_login_before.split('T')[0] || ''}
                  onChange={(e) => handleDateChange('last_login_before', e.target.value)}
                  className="h-10 transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => applyDateFilter('last_login_before')}
                  className="h-10 px-4 bg-blue-600 hover:bg-blue-700"
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Security Filters with improved styling */}
      <Collapsible open={securityFiltersOpen} onOpenChange={setSecurityFiltersOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={`w-full justify-between h-auto py-3 px-4 rounded-xl transition-all duration-200 ${
              securityFiltersOpen
                ? 'bg-orange-50 dark:bg-orange-950/20 text-orange-900 dark:text-orange-100'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${isSecurityFilterActive ? 'bg-orange-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                <Lock className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Security Filters</span>
                  {isSecurityFilterActive && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Lock status and failed attempts</p>
              </div>
            </div>
            {securityFiltersOpen ? (
              <ChevronUp className="h-4 w-4 transition-transform duration-200" />
            ) : (
              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4 px-1 animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <Label htmlFor="is_locked" className="text-sm font-medium">Account Lock Status</Label>
              <Select
                value={filters.is_locked === true ? 'locked' : filters.is_locked === false ? 'unlocked' : 'all'}
                onValueChange={(value) => {
                  if (value === 'all') {
                    handleFilterChange('is_locked', '');
                  } else {
                    handleFilterChange('is_locked', value === 'locked');
                  }
                }}
              >
                <SelectTrigger className="w-44 h-10">
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  <SelectItem value="locked" className="group">
                    <div className="flex items-center gap-2">
                      <Lock className="h-3 w-3 text-orange-500 group-hover:text-orange-900 dark:group-hover:text-orange-200" />
                      Locked Only
                    </div>
                  </SelectItem>
                  <SelectItem value="unlocked" className="group">
                    <div className="flex items-center gap-2">
                      <Unlock className="h-3 w-3 text-green-500 group-hover:text-green-900 dark:group-hover:text-green-200" />
                      Unlocked Only
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <Label htmlFor="min_failed_attempts" className="text-sm font-medium">
                Minimum Failed Attempts
              </Label>
              <Select
                value={filters.min_failed_attempts?.toString() || 'none'}
                onValueChange={(value) => {
                  handleFilterChange('min_failed_attempts', value === 'none' ? '' : parseInt(value));
                }}
              >
                <SelectTrigger className="w-44 h-10">
                  <SelectValue placeholder="No Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Filter</SelectItem>
                  <SelectItem value="1">1 or more</SelectItem>
                  <SelectItem value="2">2 or more</SelectItem>
                  <SelectItem value="3">3 or more</SelectItem>
                  <SelectItem value="4">4 or more</SelectItem>
                  <SelectItem value="5">5 (maximum)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Activity Filters with improved styling */}
      <Collapsible open={activityFiltersOpen} onOpenChange={setActivityFiltersOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={`w-full justify-between h-auto py-3 px-4 rounded-xl transition-all duration-200 ${
              activityFiltersOpen
                ? 'bg-green-50 dark:bg-green-950/20 text-green-900 dark:text-green-100'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${isActivityFilterActive ? 'bg-green-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                <Activity className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Activity Filters</span>
                  {isActivityFilterActive && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Login activity tracking</p>
              </div>
            </div>
            {activityFiltersOpen ? (
              <ChevronUp className="h-4 w-4 transition-transform duration-200" />
            ) : (
              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4 px-1 animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <Label htmlFor="has_active_sessions" className="text-sm font-medium">Active Sessions</Label>
              <Select
                value={filters.has_active_sessions === true ? 'yes' : filters.has_active_sessions === false ? 'no' : 'all'}
                onValueChange={(value) => {
                  if (value === 'all') {
                    handleFilterChange('has_active_sessions', '');
                  } else {
                    handleFilterChange('has_active_sessions', value === 'yes');
                  }
                }}
              >
                <SelectTrigger className="w-44 h-10">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="yes" className="group">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-3 w-3 text-green-500 group-hover:text-green-900 dark:group-hover:text-green-200" />
                      Has Active Sessions
                    </div>
                  </SelectItem>
                  <SelectItem value="no" className="group">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-3 w-3 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-200" />
                      No Active Sessions
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <Label htmlFor="never_logged_in" className="text-sm font-medium">Login Status</Label>
              <Select
                value={filters.never_logged_in === true ? 'yes' : filters.never_logged_in === false ? 'no' : 'all'}
                onValueChange={(value) => {
                  if (value === 'all') {
                    handleFilterChange('never_logged_in', '');
                  } else {
                    handleFilterChange('never_logged_in', value === 'yes');
                  }
                }}
              >
                <SelectTrigger className="w-44 h-10">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="yes" className="group">
                    <div className="flex items-center gap-2">
                      <UserX className="h-3 w-3 text-orange-500 group-hover:text-orange-900 dark:group-hover:text-orange-200" />
                      Never Logged In
                    </div>
                  </SelectItem>
                  <SelectItem value="no" className="group">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500 group-hover:text-green-900 dark:group-hover:text-green-200" />
                      Has Logged In
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Contact Information Filters */}
      <Collapsible open={contactFiltersOpen} onOpenChange={setContactFiltersOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={`w-full justify-between h-auto py-3 px-4 rounded-xl transition-all duration-200 ${
              contactFiltersOpen
                ? 'bg-purple-50 dark:bg-purple-950/20 text-purple-900 dark:text-purple-100'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${isContactFilterActive ? 'bg-purple-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                <Mail className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Contact Info Filters</span>
                  {isContactFilterActive && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Email address presence</p>
              </div>
            </div>
            {contactFiltersOpen ? (
              <ChevronUp className="h-4 w-4 transition-transform duration-200" />
            ) : (
              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4 px-1 animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <Label htmlFor="has_email" className="text-sm font-medium flex items-center gap-1">
                <Mail className="h-3 w-3 text-slate-400" />
                Email Address
              </Label>
              <Select
                value={filters.has_email === true ? 'yes' : filters.has_email === false ? 'no' : 'all'}
                onValueChange={(value) => {
                  if (value === 'all') {
                    handleFilterChange('has_email', '');
                  } else {
                    handleFilterChange('has_email', value === 'yes');
                  }
                }}
              >
                <SelectTrigger className="w-44 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="yes" className="group">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500 group-hover:text-green-900 dark:group-hover:text-green-200" />
                      Has Email
                    </div>
                  </SelectItem>
                  <SelectItem value="no" className="group">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-3 w-3 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-200" />
                      No Email
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Account Age Filters */}
      <Collapsible open={accountAgeFiltersOpen} onOpenChange={setAccountAgeFiltersOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={`w-full justify-between h-auto py-3 px-4 rounded-xl transition-all duration-200 ${
              accountAgeFiltersOpen
                ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-100'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${isAccountAgeFilterActive ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                <Clock className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Account Age Filters</span>
                  {isAccountAgeFilterActive && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Days since account creation</p>
              </div>
            </div>
            {accountAgeFiltersOpen ? (
              <ChevronUp className="h-4 w-4 transition-transform duration-200" />
            ) : (
              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4 px-1 animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account_age_min_days" className="text-sm font-medium flex items-center gap-1">
                <Clock className="h-3 w-3 text-slate-400" />
                Minimum Age (days)
              </Label>
              <Input
                id="account_age_min_days"
                type="number"
                min="0"
                placeholder="e.g., 30"
                value={filters.account_age_min_days || ''}
                onChange={(e) => handleFilterChange('account_age_min_days', e.target.value ? parseInt(e.target.value) : '')}
                className="h-10 transition-all duration-200 focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">Accounts older than this many days</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account_age_max_days" className="text-sm font-medium flex items-center gap-1">
                <Clock className="h-3 w-3 text-slate-400" />
                Maximum Age (days)
              </Label>
              <Input
                id="account_age_max_days"
                type="number"
                min="0"
                placeholder="e.g., 90"
                value={filters.account_age_max_days || ''}
                onChange={(e) => handleFilterChange('account_age_max_days', e.target.value ? parseInt(e.target.value) : '')}
                className="h-10 transition-all duration-200 focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">Accounts younger than this many days</p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Audit Filters */}
      <Collapsible open={auditFiltersOpen} onOpenChange={setAuditFiltersOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={`w-full justify-between h-auto py-3 px-4 rounded-xl transition-all duration-200 ${
              auditFiltersOpen
                ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-100'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${isAuditFilterActive ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                <UserCheck className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Audit Filters</span>
                  {isAuditFilterActive && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Account creation tracking</p>
              </div>
            </div>
            {auditFiltersOpen ? (
              <ChevronUp className="h-4 w-4 transition-transform duration-200" />
            ) : (
              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4 px-1 animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-2">
            <Label htmlFor="created_by" className="text-sm font-medium flex items-center gap-1">
              <UserCheck className="h-3 w-3 text-slate-400" />
              Created By (User ID)
            </Label>
            <Input
              id="created_by"
              type="text"
              maxLength={2}
              placeholder="e.g., 69"
              value={filters.created_by || ''}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                handleFilterChange('created_by', value);
              }}
              className="h-10 transition-all duration-200 focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">Filter by which admin created the account</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default AdvancedUserFilters;
