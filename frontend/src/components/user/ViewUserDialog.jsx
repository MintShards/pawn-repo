import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';
import {
  Crown,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Mail,
  Calendar,
  Clock,
  Activity,
  Lock,
  Phone,
  Key,
  Edit,
  History,
  Check,
  X,
  UserCircle,
  Shield,
  Users,
  Unlock,
  AlertCircle,
  ShieldCheck,
  StickyNote,
} from 'lucide-react';
import { formatBusinessDateTime } from '../../utils/timezoneUtils';

const ViewUserDialog = ({
  user,
  open,
  onOpenChange,
  currentUser,
  onEdit,
  onResetPin,
  onViewActivityLog
}) => {
  if (!user) return null;

  const isAdmin = currentUser?.role === 'admin';
  const isViewingSelf = currentUser?.user_id === user.user_id;

  // Handle action button clicks with dialog closure
  const handleEditClick = () => {
    if (onEdit) {
      onEdit(user);
      onOpenChange(false);
    }
  };

  const handleResetPinClick = () => {
    if (onResetPin) {
      onResetPin(user);
      onOpenChange(false);
    }
  };

  const handleActivityLogClick = () => {
    if (onViewActivityLog) {
      onViewActivityLog(user);
      onOpenChange(false);
    }
  };

  // Role badge helper
  const getRoleBadge = (role) => {
    if (role === 'admin') {
      return (
        <Badge className="gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-sm">
          <Crown className="h-3.5 w-3.5" />
          Admin
        </Badge>
      );
    }

    return (
      <Badge className="gap-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0 shadow-sm">
        <UserCheck className="h-3.5 w-3.5" />
        Staff
      </Badge>
    );
  };

  // Status badge helper
  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase();

    let classes = '';
    let icon = null;

    switch (statusLower) {
      case 'active':
        classes = 'bg-green-500 dark:bg-green-600 text-white';
        icon = <CheckCircle2 className="h-3.5 w-3.5" />;
        break;
      case 'suspended':
        classes = 'bg-amber-500 dark:bg-amber-600 text-white';
        icon = <AlertTriangle className="h-3.5 w-3.5" />;
        break;
      case 'deactivated':
      case 'inactive':
        classes = 'bg-red-500 dark:bg-red-600 text-white';
        icon = <XCircle className="h-3.5 w-3.5" />;
        break;
      default:
        classes = 'bg-gray-500 dark:bg-gray-600 text-white';
        icon = null;
    }

    return (
      <Badge className={`gap-1.5 border-0 ${classes}`}>
        {icon}
        {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
      </Badge>
    );
  };

  // Format date helper using business timezone (Pacific Time)
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
      return formatBusinessDateTime(dateString, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: undefined,
        timeZoneName: undefined,
      });
    } catch {
      return 'Invalid date';
    }
  };

  // Format phone number helper
  const formatPhoneNumber = (phone) => {
    if (!phone) return null;
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    // Format as (XXX) XXX-XXXX
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone; // Return as-is if not 10 digits
  };

  // Check if account is locked
  const isLocked = user.locked_until && new Date(user.locked_until) > new Date();

  // Permission badge helper
  const getPermissionBadge = (hasPermission) => {
    if (hasPermission) {
      return (
        <Badge variant="outline" className="gap-1 border-green-500 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30">
          <Check className="h-3 w-3" />
          Granted
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 border-slate-300 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30">
        <X className="h-3 w-3" />
        Denied
      </Badge>
    );
  };

  // Section header component for consistency
  const SectionHeader = ({ icon: Icon, title, iconColor = "text-slate-600 dark:text-slate-400" }) => (
    <div className="flex items-center gap-2 pt-2 pb-2">
      <Icon className={`h-4 w-4 ${iconColor}`} />
      <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
    </div>
  );

  // Info field component for consistency
  const InfoField = ({ icon: Icon, label, value, fullWidth = false }) => (
    <div className={`space-y-1 ${fullWidth ? 'col-span-2' : ''}`}>
      <div className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {value || <span className="text-slate-400 dark:text-slate-500 italic">Not provided</span>}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header - No padding, full width background */}
        <DialogHeader className="px-4 pt-4 pb-3 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/30 border-b border-slate-200 dark:border-slate-700">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-100">
            <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            User Details
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600 dark:text-slate-400">
            View comprehensive information for this user account
          </DialogDescription>
        </DialogHeader>

        {/* Main Content - Consistent padding */}
        <div className="px-4 pb-3 space-y-3">
          {/* User Header Section with Avatar */}
          <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/40 dark:to-slate-900/20 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <Avatar className="h-14 w-14 ring-2 ring-slate-200 dark:ring-slate-700">
              <AvatarImage
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.user_id}`}
              />
              <AvatarFallback className="bg-blue-500 text-white text-lg font-bold">
                {user.user_id}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                {user.last_name?.toUpperCase()}, {user.first_name?.toUpperCase()}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                User ID: <span className="font-semibold">{user.user_id}</span>
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              {getRoleBadge(user.role)}
              {getStatusBadge(user.status)}
            </div>
          </div>

          {/* Account Details Section */}
          <div>
            <SectionHeader icon={UserCircle} title="Account Details" iconColor="text-blue-600 dark:text-blue-400" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-3 bg-slate-50/50 dark:bg-slate-800/20 rounded-lg border border-slate-200 dark:border-slate-700">
              <InfoField icon={Mail} label="Email Address" value={user.email} />
              <InfoField icon={Phone} label="Phone Number" value={formatPhoneNumber(user.phone)} />
              <InfoField icon={Shield} label="Role" value={<div className="mt-1">{getRoleBadge(user.role)}</div>} />
              <InfoField icon={Activity} label="Status" value={<div className="mt-1">{getStatusBadge(user.status)}</div>} />
              {user.created_by && (
                <InfoField icon={Users} label="Created By" value={user.created_by} fullWidth />
              )}
            </div>
          </div>

          <Separator className="my-3" />

          {/* Security Information Section */}
          <div>
            <SectionHeader
              icon={isLocked ? Lock : Unlock}
              title="Security Information"
              iconColor={isLocked ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}
            />
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-3 bg-slate-50/50 dark:bg-slate-800/20 rounded-lg border border-slate-200 dark:border-slate-700">
                <InfoField icon={Clock} label="Last Login" value={formatDate(user.last_login)} />
                {typeof user.failed_login_attempts === 'number' && (
                  <InfoField
                    icon={AlertCircle}
                    label="Failed Login Attempts"
                    value={
                      <span className={user.failed_login_attempts > 0 ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
                        {user.failed_login_attempts}
                        {user.failed_login_attempts > 0 && ' ⚠️'}
                      </span>
                    }
                  />
                )}
                {user.active_sessions && user.active_sessions.length > 0 && (
                  <InfoField
                    icon={Activity}
                    label="Active Sessions"
                    value={`${user.active_sessions.length} session(s)`}
                    fullWidth
                  />
                )}
              </div>

              {/* Account Lock Warning */}
              {isLocked && (
                <div className="p-2 bg-red-50 dark:bg-red-950/30 rounded-lg border-2 border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 mb-1">
                    <Lock className="h-3.5 w-3.5" />
                    <span className="font-bold text-sm">Account Locked</span>
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                    Locked until: <span className="font-semibold">{formatDate(user.locked_until)}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator className="my-3" />

          {/* Activity Information Section */}
          <div>
            <SectionHeader icon={History} title="Activity Information" iconColor="text-purple-600 dark:text-purple-400" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-3 bg-slate-50/50 dark:bg-slate-800/20 rounded-lg border border-slate-200 dark:border-slate-700">
              <InfoField icon={Calendar} label="Account Created" value={formatDate(user.created_at)} />
              {user.updated_at && (
                <InfoField icon={Clock} label="Last Updated" value={formatDate(user.updated_at)} />
              )}
              {user.last_activity && (
                <InfoField icon={Activity} label="Last Activity" value={formatDate(user.last_activity)} />
              )}
            </div>
          </div>

          {/* Permissions & Access Section (Admin role gets full access) */}
          <Separator className="my-3" />
          <div>
            <SectionHeader icon={ShieldCheck} title="Permissions & Access" iconColor="text-emerald-600 dark:text-emerald-400" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 bg-slate-50/50 dark:bg-slate-800/20 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Create Transactions</span>
                {getPermissionBadge(user.role === 'admin' || user.role === 'staff')}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Manage Customers</span>
                {getPermissionBadge(user.role === 'admin' || user.role === 'staff')}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Access Reports</span>
                {getPermissionBadge(user.role === 'admin')}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Manage Users</span>
                {getPermissionBadge(user.role === 'admin')}
              </div>
            </div>
          </div>

          {/* Admin Notes Section */}
          {user.notes && (
            <>
              <Separator className="my-3" />
              <div>
                <SectionHeader icon={StickyNote} title="Admin Notes" iconColor="text-amber-600 dark:text-amber-400" />
                <div className="p-2 bg-amber-50/50 dark:bg-amber-950/10 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {user.notes}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Quick Actions Footer (Admin only) */}
        {isAdmin && (
          <DialogFooter className="px-4 py-3 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-700 flex-row gap-2">
            {!isViewingSelf && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleEditClick}
                >
                  <Edit className="h-4 w-4" />
                  Edit User
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleResetPinClick}
                >
                  <Key className="h-4 w-4" />
                  Reset PIN
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleActivityLogClick}
              disabled={!onViewActivityLog}
              title={!onViewActivityLog ? 'Activity log feature coming soon' : 'View user activity log'}
            >
              <History className="h-4 w-4" />
              Activity Log
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ViewUserDialog;
