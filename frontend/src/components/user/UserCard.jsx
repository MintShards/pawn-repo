import React from 'react';
import { Eye, Edit, Key, Crown, UserCheck, CheckCircle2, AlertTriangle, XCircle, Clock, Activity, Mail, Phone, Calendar, Lock, History } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { formatBusinessDateTime } from '../../utils/timezoneUtils';

const UserCard = ({
  user,
  onView,
  onEdit,
  onResetPin,
  onViewActivityLog,
  onSelect,
  isSelected = false,
  currentUser
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const isViewingSelf = currentUser?.user_id === user.user_id;

  const getUserInitials = (user) => {
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

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

  const isLocked = user.locked_until && new Date(user.locked_until) > new Date();

  return (
    <Card className={`relative overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
      {/* Blue accent line matching user module theme */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500"></div>

      <CardContent className="p-5 pt-6 flex flex-col h-full">
        <div className="flex-1">
        {/* Header Section */}
        <div className="flex items-center gap-4 mb-5">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect?.(user.user_id, e.target.checked)}
            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer flex-shrink-0"
            aria-label={`Select user ${user.first_name} ${user.last_name}`}
          />

          {/* Avatar and basic info */}
          <div className="flex items-center gap-4 flex-1">
            <div
              className="flex items-center gap-4 flex-1 cursor-pointer rounded-xl p-3 -m-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
              onClick={() => onView?.(user)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onView?.(user);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`View details for user ${user.first_name} ${user.last_name}`}
            >
              <Avatar className="h-14 w-14 ring-2 ring-slate-200 dark:ring-slate-700 shadow-sm">
                <AvatarImage
                  src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.user_id}`}
                  alt={`${user.first_name} ${user.last_name}`}
                />
                <AvatarFallback className="bg-gradient-to-br from-blue-400 to-blue-600 text-white font-bold text-lg">
                  {getUserInitials(user)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base text-slate-900 dark:text-slate-100 truncate mb-1.5">
                  {user.last_name?.toUpperCase()}, {user.first_name?.toUpperCase()}
                </p>
                <div className="text-sm text-slate-600 dark:text-slate-400 font-mono mb-1">
                  ID: <span className="font-semibold">{user.user_id}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0 self-start mt-3">
              {getRoleBadge(user.role)}
              {getStatusBadge(user.status)}
            </div>
          </div>
        </div>

        {/* Contact Information Section */}
        <div className="space-y-3 mb-5">
          <div className="bg-gradient-to-br from-slate-50 via-slate-50 to-white dark:from-slate-800/40 dark:via-slate-800/40 dark:to-slate-900/20 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700">
            <div className="space-y-2 min-h-[60px]">
              {user.email && (
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                    <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{user.email}</span>
                </div>
              )}
              {user.phone && (
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-green-100 dark:bg-green-900/50 rounded-lg">
                    <Phone className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm text-slate-700 dark:text-slate-300 font-mono">{formatPhoneNumber(user.phone)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Activity Information Section */}
        <div className="space-y-3 mb-5">
          <div className="grid grid-cols-2 gap-3">
            {/* Last Login */}
            <div className="bg-gradient-to-br from-blue-50 via-blue-50 to-white dark:from-blue-950/40 dark:via-blue-950/40 dark:to-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                  <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Last Login</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                {user.last_login ? formatDate(user.last_login) : 'Never'}
              </p>
            </div>

            {/* Account Created */}
            <div className="bg-gradient-to-br from-cyan-50 via-cyan-50 to-white dark:from-cyan-950/40 dark:via-cyan-950/40 dark:to-cyan-900/20 rounded-xl p-3 border border-cyan-100 dark:border-cyan-900/30">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1 bg-cyan-100 dark:bg-cyan-900/50 rounded-lg">
                  <Calendar className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
                </div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Created</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                {formatDate(user.created_at)}
              </p>
            </div>
          </div>

          {/* Failed Login Attempts Warning */}
          {typeof user.failed_login_attempts === 'number' && user.failed_login_attempts > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium text-amber-900 dark:text-amber-200">Failed Attempts</span>
              </div>
              <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{user.failed_login_attempts}</span>
            </div>
          )}

          {/* Account Locked Warning */}
          {isLocked && (
            <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-1">
                <Lock className="h-4 w-4" />
                <span className="font-bold text-sm">Account Locked</span>
              </div>
              <p className="text-xs text-red-600 dark:text-red-400">
                Until: <span className="font-semibold">{formatDate(user.locked_until)}</span>
              </p>
            </div>
          )}

          {/* Active Sessions */}
          {user.active_sessions && user.active_sessions.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-900 dark:text-green-200">Active Sessions</span>
              </div>
              <span className="text-sm font-bold text-green-700 dark:text-green-400">{user.active_sessions.length}</span>
            </div>
          )}
        </div>
        </div>

        {/* Quick Actions */}
        {isAdmin && (
          <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            {!isViewingSelf && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(user);
                  }}
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResetPin?.(user);
                  }}
                >
                  <Key className="h-3.5 w-3.5" />
                  Reset PIN
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950/30"
              onClick={(e) => {
                e.stopPropagation();
                onViewActivityLog?.(user);
              }}
              disabled={!onViewActivityLog}
              title={!onViewActivityLog ? 'Activity log feature coming soon' : 'View user activity log'}
            >
              <History className="h-3.5 w-3.5" />
              Activity Log
            </Button>
          </div>
        )}

        {/* View Details Button (always shown) */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={(e) => {
              e.stopPropagation();
              onView?.(user);
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserCard;
