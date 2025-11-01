import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/common/AppHeader';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { ToastProvider, ToastViewport, useToast } from '../components/ui/toast';
import userService from '../services/userService';
import { formatBusinessDateTime } from '../utils/timezoneUtils';
import {
  Card,
  CardContent,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import ViewUserDialog from '../components/user/ViewUserDialog';
import UserCard from '../components/user/UserCard';
import UserActivityLogDialog from '../components/user/UserActivityLogDialog';
import UnifiedPagination from '../components/ui/unified-pagination';
import {
  Users,
  UserPlus,
  Search,
  Edit,
  Key,
  Unlock,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Activity,
  TableIcon,
  LayoutGrid,
  Filter,
  Phone,
  Hash,
  Clock,
  Settings,
  Crown,
  UserCheck,
  Eye,
  EyeOff,
  UserCircle,
  ShieldCheck,
  MoreHorizontal,
} from 'lucide-react';

const UserManagementPage = () => {
  const { user: currentUser, loading: authLoading, fetchUserDataIfNeeded } = useAuth();
  const { toast } = useToast();

  // State
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'card'
  const [filters, setFilters] = useState({
    role: '',
    status: '',
    search: '',
    page: 1,
    per_page: 10,
    sort_by: 'created_at',
    sort_order: 'desc',
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [activityLogDialogOpen, setActivityLogDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [resetPinDialogOpen, setResetPinDialogOpen] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [revokeSessionDialogOpen, setRevokeSessionDialogOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

  // Bulk selection state
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  // Form states
  const [formData, setFormData] = useState({
    user_id: '',
    pin: '',
    confirm_pin: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'staff',
    status: 'active',
    notes: '',
  });

  // UX Enhancement states
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [checkingUserId, setCheckingUserId] = useState(false);

  // Reset PIN form states
  const [resetPinData, setResetPinData] = useState({
    new_pin: '',
    confirm_pin: '',
  });
  const [showResetPin, setShowResetPin] = useState(false);
  const [showResetConfirmPin, setShowResetConfirmPin] = useState(false);
  const [resetPinErrors, setResetPinErrors] = useState({});

  // Fetch user data if needed
  useEffect(() => {
    if (!currentUser && !authLoading) {
      fetchUserDataIfNeeded();
    }
  }, [currentUser, authLoading, fetchUserDataIfNeeded]);

  // Check if current user is admin
  const isAdmin = currentUser?.role === 'admin';

  // Fetch users list
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getUsersList(filters);
      setUsers(response.users || []);
      setTotalPages(response.pages || 1);
      setTotalUsers(response.total || 0);
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch user statistics
  const fetchStats = async () => {
    if (!isAdmin) return;

    try {
      setStatsLoading(true);
      const response = await userService.getUserStats();
      setStats(response);
    } catch (error) {
      // Silently fail for stats
    } finally {
      setStatsLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, isAdmin]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : value, // Reset to page 1 unless changing page
    }));
  };

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers();
  };

  // Validation helper functions
  const validateUserId = (userId) => {
    if (!userId || userId.length !== 2) {
      return 'User ID must be exactly 2 digits';
    }
    if (!/^\d{2}$/.test(userId)) {
      return 'User ID must contain only numbers';
    }
    return null;
  };

  const validatePin = (pin) => {
    if (!pin || pin.length !== 4) {
      return 'PIN must be exactly 4 digits';
    }
    if (!/^\d{4}$/.test(pin)) {
      return 'PIN must contain only numbers';
    }
    // Check for weak PINs
    if (pin === '0000' || pin === '1234' || pin === '1111' || pin === '2222') {
      return 'PIN is too weak. Avoid common patterns like 0000, 1234, etc.';
    }
    // Check for sequential numbers
    const isSequential = pin.split('').every((digit, i, arr) => {
      if (i === 0) return true;
      return parseInt(digit) === parseInt(arr[i - 1]) + 1;
    });
    if (isSequential) {
      return 'PIN is too weak. Avoid sequential patterns';
    }
    return null;
  };

  const validatePhone = (phone) => {
    if (!phone) return 'Phone number is required';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      return 'Phone number must be exactly 10 digits';
    }
    return null;
  };

  const validateEmail = (email) => {
    if (!email) return null; // Email is optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return null;
  };

  // Check if User ID already exists
  const checkUserIdExists = async (userId) => {
    if (!userId || userId.length !== 2) return;

    setCheckingUserId(true);
    try {
      const response = await userService.getUsersList({ search: userId, per_page: 1 });
      const exists = response.users?.some(u => u.user_id === userId);
      if (exists) {
        setValidationErrors(prev => ({
          ...prev,
          user_id: 'User ID already exists. Please choose a different ID.'
        }));
      } else {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.user_id;
          return newErrors;
        });
      }
    } catch (error) {
      // Silently fail - validation will happen on submit anyway
    } finally {
      setCheckingUserId(false);
    }
  };

  // Real-time validation handlers
  const handleUserIdChange = (value) => {
    setFormData({ ...formData, user_id: value });
    const error = validateUserId(value);
    if (error) {
      setValidationErrors(prev => ({ ...prev, user_id: error }));
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.user_id;
        return newErrors;
      });
      // Check uniqueness after basic validation passes
      if (value.length === 2) {
        checkUserIdExists(value);
      }
    }
  };

  const handlePinChange = (value) => {
    setFormData({ ...formData, pin: value });
    const error = validatePin(value);
    if (error) {
      setValidationErrors(prev => ({ ...prev, pin: error }));
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.pin;
        return newErrors;
      });
    }

    // Also validate confirm PIN if it exists
    if (formData.confirm_pin) {
      if (value !== formData.confirm_pin) {
        setValidationErrors(prev => ({ ...prev, confirm_pin: 'PINs do not match' }));
      } else {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.confirm_pin;
          return newErrors;
        });
      }
    }
  };

  const handleConfirmPinChange = (value) => {
    setFormData({ ...formData, confirm_pin: value });
    if (formData.pin !== value) {
      setValidationErrors(prev => ({ ...prev, confirm_pin: 'PINs do not match' }));
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.confirm_pin;
        return newErrors;
      });
    }
  };

  const handlePhoneChange = (value) => {
    const cleaned = value.replace(/\D/g, '');
    setFormData({ ...formData, phone: cleaned });
    const error = validatePhone(cleaned);
    if (error) {
      setValidationErrors(prev => ({ ...prev, phone: error }));
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.phone;
        return newErrors;
      });
    }
  };

  const handleEmailChange = (value) => {
    setFormData({ ...formData, email: value });
    const error = validateEmail(value);
    if (error) {
      setValidationErrors(prev => ({ ...prev, email: error }));
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.email;
        return newErrors;
      });
    }
  };

  // Handle create user
  const handleCreateUser = async (e) => {
    e.preventDefault();

    // Check for validation errors
    if (Object.keys(validationErrors).length > 0) {
      toast({
        title: 'Validation Error',
        description: 'Please fix all validation errors before submitting',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Convert empty strings to null for optional fields
      const userData = {
        ...formData,
        email: formData.email || null,
        phone: formData.phone,  // Phone is required, don't convert to null
        notes: formData.notes || null,
      };

      await userService.createUser(userData);
      toast({
        title: 'Success',
        description: 'User created successfully',
      });
      setCreateDialogOpen(false);
      setFormData({
        user_id: '',
        pin: '',
        confirm_pin: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        role: 'staff',
        status: 'active',
        notes: '',
      });
      setValidationErrors({});
      setShowPin(false);
      setShowConfirmPin(false);
      fetchUsers();
      fetchStats();
    } catch (error) {
      const errorMessage = error.message || 'Failed to create user';

      // Check if error is related to email uniqueness and set field-level validation
      // Only show duplicate error if format is valid
      if (errorMessage.includes('Email') || errorMessage.includes('email')) {
        if (errorMessage.includes('already') || errorMessage.includes('registered') || errorMessage.includes('exists')) {
          const formatError = validateEmail(formData.email);
          if (!formatError) {
            // Format is valid, show duplicate error
            setValidationErrors(prev => ({
              ...prev,
              email: 'This email address is already registered'
            }));
          }
          // If format error exists, it's already shown, don't override
        }
      }

      // Check if error is related to User ID uniqueness
      if (errorMessage.includes('User ID') || errorMessage.includes('user_id')) {
        if (errorMessage.includes('already') || errorMessage.includes('exists')) {
          setValidationErrors(prev => ({
            ...prev,
            user_id: 'User ID already exists. Please choose a different ID.'
          }));
        }
      }

      // Check if error is related to phone number uniqueness
      // Only show duplicate error if format is valid
      if (errorMessage.includes('Phone') || errorMessage.includes('phone')) {
        if (errorMessage.includes('already') || errorMessage.includes('registered') || errorMessage.includes('exists')) {
          const formatError = validatePhone(formData.phone);
          if (!formatError) {
            // Format is valid, show duplicate error
            setValidationErrors(prev => ({
              ...prev,
              phone: 'This phone number is already registered'
            }));
          }
          // If format error exists, it's already shown, don't override
        }
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  // Handle edit user
  const handleEditUser = async (e) => {
    e.preventDefault();

    // Check for validation errors
    if (Object.keys(validationErrors).length > 0) {
      toast({
        title: 'Validation Error',
        description: 'Please fix all validation errors before submitting',
        variant: 'destructive',
      });
      return;
    }

    try {
      await userService.updateUser(selectedUser.user_id, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        phone: formData.phone || null,
        role: formData.role,
        status: formData.status,
        notes: formData.notes || null,
      });
      toast({
        title: 'Success',
        description: 'User updated successfully',
      });
      setEditDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
      fetchStats();
    } catch (error) {
      const errorMessage = error.message || 'Failed to update user';

      // Check if error is related to email uniqueness and set field-level validation
      // Only show duplicate error if format is valid
      if (errorMessage.includes('Email') || errorMessage.includes('email')) {
        if (errorMessage.includes('already') || errorMessage.includes('registered') || errorMessage.includes('exists')) {
          const formatError = validateEmail(formData.email);
          if (!formatError) {
            // Format is valid, show duplicate error
            setValidationErrors(prev => ({
              ...prev,
              email: 'This email address is already registered to another user'
            }));
          }
          // If format error exists, it's already shown, don't override
        }
      }

      // Check if error is related to phone number uniqueness
      // Only show duplicate error if format is valid
      if (errorMessage.includes('Phone') || errorMessage.includes('phone')) {
        if (errorMessage.includes('already') || errorMessage.includes('registered') || errorMessage.includes('exists')) {
          const formatError = validatePhone(formData.phone);
          if (!formatError) {
            // Format is valid, show duplicate error
            setValidationErrors(prev => ({
              ...prev,
              phone: 'This phone number is already registered to another user'
            }));
          }
          // If format error exists, it's already shown, don't override
        }
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  // Handle deactivate user
  const handleDeactivateUser = async () => {
    try {
      await userService.deactivateUser(selectedUser.user_id);
      toast({
        title: 'Success',
        description: 'User deactivated successfully',
      });
      setDeactivateDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
      fetchStats();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to deactivate user',
        variant: 'destructive',
      });
    }
  };

  // Reset PIN validation handlers
  const handleResetPinChange = (value) => {
    setResetPinData({ ...resetPinData, new_pin: value });
    const error = validatePin(value);
    if (error) {
      setResetPinErrors(prev => ({ ...prev, new_pin: error }));
    } else {
      setResetPinErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.new_pin;
        return newErrors;
      });
    }

    // Also validate confirm PIN if it exists
    if (resetPinData.confirm_pin) {
      if (value !== resetPinData.confirm_pin) {
        setResetPinErrors(prev => ({ ...prev, confirm_pin: 'PINs do not match' }));
      } else {
        setResetPinErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.confirm_pin;
          return newErrors;
        });
      }
    }
  };

  const handleResetConfirmPinChange = (value) => {
    setResetPinData({ ...resetPinData, confirm_pin: value });
    if (resetPinData.new_pin !== value) {
      setResetPinErrors(prev => ({ ...prev, confirm_pin: 'PINs do not match' }));
    } else {
      setResetPinErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.confirm_pin;
        return newErrors;
      });
    }
  };

  // Handle reset PIN
  const handleResetPin = async (e) => {
    e.preventDefault();

    // Check for validation errors
    if (Object.keys(resetPinErrors).length > 0) {
      toast({
        title: 'Validation Error',
        description: 'Please fix all validation errors before submitting',
        variant: 'destructive',
      });
      return;
    }

    try {
      await userService.setUserPin(selectedUser.user_id, resetPinData.new_pin);
      toast({
        title: 'Success',
        description: 'PIN reset successfully',
      });
      setResetPinDialogOpen(false);
      setSelectedUser(null);
      setResetPinData({ new_pin: '', confirm_pin: '' });
      setResetPinErrors({});
      setShowResetPin(false);
      setShowResetConfirmPin(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset PIN',
        variant: 'destructive',
      });
    }
  };

  // Handle unlock user
  const handleUnlockUser = async () => {
    try {
      await userService.unlockUser(selectedUser.user_id);
      toast({
        title: 'Success',
        description: 'User account unlocked successfully',
      });
      setUnlockDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
      fetchStats();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to unlock user',
        variant: 'destructive',
      });
    }
  };

  // Handle revoke user sessions
  const handleRevokeUserSessions = async () => {
    try {
      await userService.terminateUserSessions(selectedUser.user_id);
      toast({
        title: 'Success',
        description: 'All user sessions have been terminated successfully',
      });
      setRevokeSessionDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke user sessions',
        variant: 'destructive',
      });
    }
  };

  // Open edit dialog
  const openEditDialog = (user) => {
    setSelectedUser(user);
    setFormData({
      user_id: user.user_id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email || '',
      phone: user.phone || '',
      role: user.role,
      status: user.status,
      notes: user.notes || '',
    });
    // Clear validation errors when opening edit dialog
    setValidationErrors({});
    setEditDialogOpen(true);
  };

  // Open create dialog
  const openCreateDialog = () => {
    // Reset form to empty state
    setFormData({
      user_id: '',
      pin: '',
      confirm_pin: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      role: 'staff',
      status: 'active',
      notes: '',
    });
    // Clear all validation states
    setValidationErrors({});
    setShowPin(false);
    setShowConfirmPin(false);
    setCheckingUserId(false);
    // Open dialog
    setCreateDialogOpen(true);
  };

  // Bulk selection handlers
  const handleSelectUser = (userId, checked) => {
    if (checked) {
      setSelectedUserIds(prev => [...prev, userId]);
    } else {
      setSelectedUserIds(prev => prev.filter(id => id !== userId));
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedUserIds(users.map(user => user.user_id));
    } else {
      setSelectedUserIds([]);
    }
  };

  // Bulk status change handler
  const handleBulkStatusChange = async (newStatus) => {
    if (selectedUserIds.length === 0) return;

    try {
      // Process each user status update
      const updatePromises = selectedUserIds.map(userId =>
        userService.updateUser(userId, { status: newStatus })
      );

      await Promise.all(updatePromises);

      toast({
        title: 'Success',
        description: `Successfully updated ${selectedUserIds.length} user${selectedUserIds.length > 1 ? 's' : ''} to ${newStatus}`,
      });

      // Clear selection and refresh user list
      setSelectedUserIds([]);
      fetchUsers();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user statuses',
        variant: 'destructive',
      });
    }
  };

  // Single user status change handler
  const handleSingleStatusChange = async (userId, newStatus) => {
    try {
      await userService.updateUser(userId, { status: newStatus });

      toast({
        title: 'Success',
        description: `User status updated to ${newStatus}`,
      });

      fetchUsers();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user status',
        variant: 'destructive',
      });
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const getStatusClasses = (status) => {
      switch (status?.toLowerCase()) {
        case 'active':
          return 'bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-700';
        case 'suspended':
          return 'bg-amber-500 dark:bg-amber-600 text-white hover:bg-amber-600 dark:hover:bg-amber-700';
        case 'deactivated':
        case 'inactive':
          return 'bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700';
        default:
          return 'bg-gray-500 dark:bg-gray-600 text-white hover:bg-gray-600 dark:hover:bg-gray-700';
      }
    };

    const getStatusIcon = (status) => {
      switch (status?.toLowerCase()) {
        case 'active':
          return <CheckCircle2 className="h-3 w-3" />;
        case 'suspended':
          return <AlertTriangle className="h-3 w-3" />;
        case 'deactivated':
        case 'inactive':
          return <XCircle className="h-3 w-3" />;
        default:
          return null;
      }
    };

    const getStatusText = (status) => {
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
    };

    return (
      <Badge className={`gap-1.5 border-0 transition-colors duration-200 ${getStatusClasses(status)}`}>
        {getStatusIcon(status)}
        {getStatusText(status)}
      </Badge>
    );
  };

  // Get role badge
  const getRoleBadge = (role) => {
    if (role === 'admin') {
      return (
        <Badge className="gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-sm">
          <Crown className="h-3 w-3" />
          Admin
        </Badge>
      );
    }

    return (
      <Badge className="gap-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white border-0 shadow-sm">
        <UserCheck className="h-3 w-3" />
        Staff
      </Badge>
    );
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Format phone number
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

  // Check if user is not admin
  if (!isAdmin && !authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <AppHeader pageTitle="User Management" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Shield className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
              <p className="text-muted-foreground text-center">
                You need administrator privileges to access user management.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <ToastProvider>
      <ErrorBoundary fallbackMessage="An error occurred in user management. Please try refreshing the page.">
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
          <AppHeader pageTitle="User Management" />

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            {/* Statistics Overview */}
            {!statsLoading && stats && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                    Staff Management
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 text-lg">
                    Manage staff accounts, monitor login activity, assign roles, track user actions, and review security events
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {/* Active Users - Blue */}
                <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/50 dark:to-sky-950/50 relative overflow-hidden transition-all duration-300 hover:shadow-xl">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -mr-10 -mt-10" />
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          Active Users
                        </p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                          {stats.active_users}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* New This Month - Teal */}
                <Card className="border-0 shadow-lg bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/50 dark:to-cyan-950/50 relative overflow-hidden transition-all duration-300 hover:shadow-xl">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-teal-500/10 rounded-full -mr-10 -mt-10" />
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-medium text-teal-600 dark:text-teal-400">
                          New This Month
                        </p>
                        <p className="text-2xl font-bold text-teal-900 dark:text-teal-100">
                          {stats.users_created_this_month}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Locked Accounts - Orange/Amber */}
                <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/50 relative overflow-hidden transition-all duration-300 hover:shadow-xl">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-full -mr-10 -mt-10" />
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                          Locked Accounts
                        </p>
                        <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                          {stats.locked_users}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                        <XCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Active Today - Indigo */}
                <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50 relative overflow-hidden transition-all duration-300 hover:shadow-xl">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 rounded-full -mr-10 -mt-10" />
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                          Active Today
                        </p>
                        <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
                          {stats.recent_logins}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                        <Activity className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Total Users - Slate/Gray */}
                <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-950/50 dark:to-gray-950/50 relative overflow-hidden transition-all duration-300 hover:shadow-xl">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-slate-500/10 rounded-full -mr-10 -mt-10" />
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Total Users
                        </p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                          {stats.total_users}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-slate-500/20 rounded-xl flex items-center justify-center">
                        <Users className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                </div>
              </div>
            )}

            {/* Search & Filter Section */}
            <Card className="relative overflow-hidden shadow-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              {/* Blue accent line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500"></div>

              <CardContent className="p-6 pt-7 space-y-6">
                {/* Search Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500 dark:bg-blue-600 rounded-lg">
                      <Search className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        Staff Search
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Find staff members by name, user ID, role (Admin/Staff), or account status
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={openCreateDialog}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 border-0"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Create User
                    </Button>
                    <Button
                      onClick={fetchUsers}
                      variant="outline"
                      disabled={loading}
                      className="border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 shadow-sm dark:shadow-slate-800/50 transition-all duration-200"
                    >
                      {loading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin text-blue-600 dark:text-blue-400" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2 text-slate-600 dark:text-slate-400" />
                      )}
                      Refresh
                    </Button>
                  </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <form onSubmit={handleSearch}>
                      <Input
                        placeholder="Search by name, email, phone, or ID..."
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        className="h-12 rounded-xl border-0 bg-slate-100/50 dark:bg-slate-700/50 hover:bg-slate-200/50 dark:hover:bg-slate-600/50 text-base font-normal"
                      />
                    </form>
                  </div>

                  <div className="sm:w-40">
                    <Select
                      value={filters.role || 'all'}
                      onValueChange={(value) => handleFilterChange('role', value === 'all' ? '' : value)}
                    >
                      <SelectTrigger className="h-12 rounded-xl border-0 bg-slate-100/50 dark:bg-slate-700/50 hover:bg-slate-200/50 dark:hover:bg-slate-600/50 text-base font-normal">
                        <SelectValue placeholder="All Roles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-blue-500" />
                            <span>Admin</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="staff">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-slate-500" />
                            <span>Staff</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:w-40">
                    <Select
                      value={filters.status || 'all'}
                      onValueChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}
                    >
                      <SelectTrigger className="h-12 rounded-xl border-0 bg-slate-100/50 dark:bg-slate-700/50 hover:bg-slate-200/50 dark:hover:bg-slate-600/50 text-base font-normal">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="active">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>Active</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="suspended">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <span>Suspended</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="deactivated">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span>Deactivated</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Advanced Filters Button */}
                  <Button
                    variant="outline"
                    onClick={() => setAdvancedFiltersOpen(true)}
                    className="h-12 px-4 rounded-xl border-0 bg-slate-100/50 dark:bg-slate-700/50 hover:bg-slate-200/50 dark:hover:bg-slate-600/50 text-slate-700 dark:text-slate-300 font-normal"
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Advanced
                  </Button>

                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-slate-100/50 dark:bg-slate-700/50 rounded-xl p-1 h-12">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className={`h-9 px-4 rounded-lg ${viewMode === 'list' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'}`}
                      title="List View"
                    >
                      <TableIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode('card')}
                      className={`h-9 px-4 rounded-lg ${viewMode === 'card' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'}`}
                      title="Card View"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bulk Actions Bar */}
            {selectedUserIds.length > 0 && (
              <Card className="mb-4 p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      {selectedUserIds.length} user{selectedUserIds.length > 1 ? 's' : ''} selected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedUserIds([])}
                      className="h-8 text-xs border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                    >
                      Clear Selection
                    </Button>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-blue-700 dark:text-blue-300 mr-2">Bulk Actions:</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkStatusChange('active')}
                        className="h-8 text-xs border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Activate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkStatusChange('suspended')}
                        className="h-8 text-xs border-yellow-300 dark:border-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                        Suspend
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkStatusChange('inactive')}
                        className="h-8 text-xs border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Deactivate
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* User View (Card or Table) */}
            {viewMode === 'card' ? (
              /* Card View */
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {loading ? (
                  <>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Card key={i} className="p-6 space-y-4 animate-pulse">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            <div className="h-14 w-14 rounded-full bg-slate-200 dark:bg-slate-700" />
                            <div className="space-y-2 flex-1">
                              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                          <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <div className="h-8 flex-1 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                      </Card>
                    ))}
                  </>
                ) : users.length === 0 ? (
                  <div className="col-span-full flex justify-center items-center py-20">
                    <div className="text-center space-y-4">
                      <div className="flex justify-center">
                        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
                          <Users className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          No users found
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                          {filters.search || filters.role || filters.status
                            ? 'Try adjusting your search or filters to find what you\'re looking for.'
                            : 'Get started by creating your first user account.'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {users.map((user) => (
                      <UserCard
                        key={user.user_id}
                        user={user}
                        onView={(user) => {
                          setSelectedUser(user);
                          setViewDialogOpen(true);
                        }}
                        onEdit={openEditDialog}
                        onResetPin={(user) => {
                          setSelectedUser(user);
                          setResetPinData({ new_pin: '', confirm_pin: '' });
                          setResetPinErrors({});
                          setShowResetPin(false);
                          setShowResetConfirmPin(false);
                          setResetPinDialogOpen(true);
                        }}
                        onViewActivityLog={(user) => {
                          setSelectedUser(user);
                          setActivityLogDialogOpen(true);
                        }}
                        onSelect={handleSelectUser}
                        isSelected={selectedUserIds.includes(user.user_id)}
                        currentUser={currentUser}
                      />
                    ))}
                  </>
                )}
              </div>
            ) : (
              /* Table View */
              <Card className="shadow-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 relative overflow-hidden">
                {/* Blue accent line matching search card */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500"></div>

                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                      <p className="text-sm text-slate-600 dark:text-slate-400">Loading users...</p>
                    </div>
                  </div>
                ) : users.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
                      <Users className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        No users found
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                        {filters.search || filters.role || filters.status
                          ? 'Try adjusting your search or filters to find what you\'re looking for.'
                          : 'Get started by creating your first user account.'}
                      </p>
                    </div>
                  </div>
                ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 dark:border-slate-700 hover:bg-transparent">
                      <TableHead className="w-[50px] pt-6 px-6">
                        <Checkbox
                          checked={selectedUserIds.length === users.length && users.length > 0}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all users"
                          className="border-slate-400 dark:border-slate-500"
                        />
                      </TableHead>
                      <TableHead className="w-[80px] pt-6 px-6 font-medium">
                        <div className="flex items-center gap-2">
                          <Hash className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                          ID
                        </div>
                      </TableHead>
                      <TableHead className="w-[200px] pt-6 px-6 font-medium">
                        <div className="flex items-center gap-2">
                          <UserCircle className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                          Name
                        </div>
                      </TableHead>
                      <TableHead className="w-[120px] pt-6 px-6 font-medium">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                          Role
                        </div>
                      </TableHead>
                      <TableHead className="w-[220px] pt-6 px-6 font-medium">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                          Contact
                        </div>
                      </TableHead>
                      <TableHead className="w-[120px] pt-6 px-6 font-medium">
                        <div className="flex items-center gap-2">
                          <Activity className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                          Status
                        </div>
                      </TableHead>
                      <TableHead className="w-[160px] pt-6 px-6 font-medium">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                          Last Login
                        </div>
                      </TableHead>
                      <TableHead className="w-[100px] text-right pt-6 px-6 font-medium">
                        <div className="flex items-center gap-2 justify-end">
                          <Settings className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                          Actions
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow
                        key={user.user_id}
                        className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-slate-200 dark:border-slate-700"
                      >
                        <TableCell className="px-6">
                          <Checkbox
                            checked={selectedUserIds.includes(user.user_id)}
                            onCheckedChange={(checked) => handleSelectUser(user.user_id, checked)}
                            aria-label={`Select ${user.first_name} ${user.last_name}`}
                            className="border-slate-400 dark:border-slate-500"
                          />
                        </TableCell>
                        <TableCell className="px-6 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {user.user_id}
                        </TableCell>
                        <TableCell className="px-6">
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage
                                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.user_id}`}
                              />
                              <AvatarFallback className="bg-blue-500 text-white text-xs font-semibold">
                                {user.user_id}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {user.last_name?.toUpperCase()}, {user.first_name?.toUpperCase()}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-6">{getRoleBadge(user.role)}</TableCell>
                        <TableCell className="px-6">
                          <div className="space-y-1">
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              {user.email || ''}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              {formatPhoneNumber(user.phone) || ''}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-6">{getStatusBadge(user.status)}</TableCell>
                        <TableCell className="px-6 text-slate-600 dark:text-slate-400">
                          {formatDate(user.last_login)}
                        </TableCell>
                        <TableCell className="px-6 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Primary Action 1: View Details */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedUser(user);
                                setViewDialogOpen(true);
                              }}
                              className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100"
                              title="View Details"
                              aria-label={`View details for ${user.first_name} ${user.last_name}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            {/* Primary Action 2: Edit User */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(user)}
                              className="h-8 w-8 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400"
                              title="Edit User"
                              aria-label={`Edit ${user.first_name} ${user.last_name}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>

                            {/* More Actions Dropdown */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-700"
                                  aria-label={`More actions for ${user.first_name} ${user.last_name}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel className="font-semibold">More Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />

                                {/* Security Actions Section */}
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setResetPinData({ new_pin: '', confirm_pin: '' });
                                    setResetPinErrors({});
                                    setShowResetPin(false);
                                    setShowResetConfirmPin(false);
                                    setResetPinDialogOpen(true);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Key className="mr-2 h-4 w-4 text-orange-600 dark:text-orange-400" />
                                  Reset PIN
                                </DropdownMenuItem>

                                {user.locked_until && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setUnlockDialogOpen(true);
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <Unlock className="mr-2 h-4 w-4 text-green-600 dark:text-green-400" />
                                    Unlock Account
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setRevokeSessionDialogOpen(true);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <RefreshCw className="mr-2 h-4 w-4 text-red-600 dark:text-red-400" />
                                  Revoke Sessions
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                )}

                {/* Enhanced Pagination for Table View */}
                {!loading && users.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4">
                    <UnifiedPagination
                      currentPage={filters.page}
                      totalPages={totalPages}
                      pageSize={filters.per_page}
                      totalItems={totalUsers}
                      onPageChange={(page) => handleFilterChange('page', page)}
                      onPageSizeChange={(size) => handleFilterChange('per_page', size)}
                      pageSizeOptions={[5, 10, 20, 50, 100]}
                      theme={{ primary: 'blue' }}
                      itemLabel="users"
                    />
                  </div>
                )}
              </Card>
            )}

            {/* Pagination for Card View */}
            {viewMode === 'card' && !loading && users.length > 0 && (
              <div className="mt-4">
                <UnifiedPagination
                  currentPage={filters.page}
                  totalPages={totalPages}
                  pageSize={filters.per_page}
                  totalItems={totalUsers}
                  onPageChange={(page) => handleFilterChange('page', page)}
                  onPageSizeChange={(size) => handleFilterChange('per_page', size)}
                  pageSizeOptions={[5, 10, 20, 50, 100]}
                  theme={{ primary: 'blue' }}
                  itemLabel="users"
                />
              </div>
            )}
          </main>

          {/* Create User Dialog */}
          <Dialog open={createDialogOpen} onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) {
              // Clear validation errors when closing
              setValidationErrors({});
              setShowPin(false);
              setShowConfirmPin(false);
              setCheckingUserId(false);
            }
          }}>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleCreateUser}>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>
                    Add a new user to the system. They will be able to log in with their User ID and PIN.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <label htmlFor="user_id" className="text-sm font-medium">
                      User ID <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        id="user_id"
                        placeholder="Enter 2-digit user ID"
                        maxLength={2}
                        required
                        value={formData.user_id}
                        onChange={(e) => handleUserIdChange(e.target.value)}
                        className={validationErrors.user_id ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      />
                      {checkingUserId && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
                        </div>
                      )}
                    </div>
                    {validationErrors.user_id && (
                      <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {validationErrors.user_id}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="pin" className="text-sm font-medium">
                      PIN <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        id="pin"
                        type={showPin ? "text" : "password"}
                        placeholder="Enter 4-digit PIN"
                        maxLength={4}
                        required
                        value={formData.pin}
                        onChange={(e) => handlePinChange(e.target.value)}
                        className={validationErrors.pin ? 'border-red-500 focus-visible:ring-red-500 pr-10' : 'pr-10'}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPin(!showPin)}
                      >
                        {showPin ? (
                          <EyeOff className="h-4 w-4 text-slate-500" />
                        ) : (
                          <Eye className="h-4 w-4 text-slate-500" />
                        )}
                      </Button>
                    </div>
                    {validationErrors.pin ? (
                      <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {validationErrors.pin}
                      </p>
                    ) : formData.pin && formData.pin.length === 4 && !validationErrors.pin ? (
                      <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Strong PIN
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirm_pin" className="text-sm font-medium">
                      Confirm PIN <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        id="confirm_pin"
                        type={showConfirmPin ? "text" : "password"}
                        placeholder="Re-enter 4-digit PIN"
                        maxLength={4}
                        required
                        value={formData.confirm_pin}
                        onChange={(e) => handleConfirmPinChange(e.target.value)}
                        className={validationErrors.confirm_pin ? 'border-red-500 focus-visible:ring-red-500 pr-10' : 'pr-10'}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowConfirmPin(!showConfirmPin)}
                      >
                        {showConfirmPin ? (
                          <EyeOff className="h-4 w-4 text-slate-500" />
                        ) : (
                          <Eye className="h-4 w-4 text-slate-500" />
                        )}
                      </Button>
                    </div>
                    {validationErrors.confirm_pin ? (
                      <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {validationErrors.confirm_pin}
                      </p>
                    ) : formData.confirm_pin && formData.pin === formData.confirm_pin && formData.confirm_pin.length === 4 ? (
                      <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        PINs match
                      </p>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="first_name" className="text-sm font-medium">
                        First Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        id="first_name"
                        placeholder="Enter first name"
                        required
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="last_name" className="text-sm font-medium">
                        Last Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        id="last_name"
                        placeholder="Enter last name"
                        required
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter email address"
                      value={formData.email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      className={validationErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    {validationErrors.email && (
                      <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {validationErrors.email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="phone" className="text-sm font-medium">
                      Phone Number <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter phone number"
                      maxLength={10}
                      value={formData.phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className={validationErrors.phone ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      required
                    />
                    {validationErrors.phone ? (
                      <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {validationErrors.phone}
                      </p>
                    ) : formData.phone && formData.phone.length === 10 && !validationErrors.phone ? (
                      <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {formatPhoneNumber(formData.phone)}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="role" className="text-sm font-medium">
                        Role <span className="text-destructive">*</span>
                      </label>
                      <Select
                        value={formData.role}
                        onValueChange={(value) => setFormData({ ...formData, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="status" className="text-sm font-medium">
                        Status <span className="text-destructive">*</span>
                      </label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="deactivated">Deactivated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="notes" className="text-sm font-medium">
                      Notes
                    </label>
                    <Input
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Enter any additional notes"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCreateDialogOpen(false);
                      setValidationErrors({});
                      setShowPin(false);
                      setShowConfirmPin(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={Object.keys(validationErrors).length > 0 || checkingUserId}
                  >
                    {checkingUserId ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      'Create User'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit User Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              // Clear validation errors when closing
              setValidationErrors({});
              setSelectedUser(null);
            }
          }}>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleEditUser}>
                <DialogHeader>
                  <DialogTitle>Edit User</DialogTitle>
                  <DialogDescription>
                    Update user information and permissions.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <label htmlFor="edit_user_id" className="text-sm font-medium">
                      User ID
                    </label>
                    <Input
                      id="edit_user_id"
                      value={formData.user_id}
                      disabled
                      className="bg-slate-100 dark:bg-slate-800 cursor-not-allowed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="edit_first_name" className="text-sm font-medium">
                        First Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        id="edit_first_name"
                        placeholder="Enter first name"
                        required
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="edit_last_name" className="text-sm font-medium">
                        Last Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        id="edit_last_name"
                        placeholder="Enter last name"
                        required
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="edit_email" className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="edit_email"
                      type="email"
                      placeholder="Enter email address"
                      value={formData.email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      className={validationErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    {validationErrors.email && (
                      <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {validationErrors.email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="edit_phone" className="text-sm font-medium">
                      Phone Number <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="edit_phone"
                      type="tel"
                      placeholder="Enter phone number"
                      maxLength={10}
                      value={formData.phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className={validationErrors.phone ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      required
                    />
                    {validationErrors.phone && (
                      <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {validationErrors.phone}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="edit_role" className="text-sm font-medium">
                        Role <span className="text-destructive">*</span>
                      </label>
                      <Select
                        value={formData.role}
                        onValueChange={(value) => setFormData({ ...formData, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="edit_status" className="text-sm font-medium">
                        Status <span className="text-destructive">*</span>
                      </label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="deactivated">Deactivated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="edit_notes" className="text-sm font-medium">
                      Notes
                    </label>
                    <Input
                      id="edit_notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Enter any additional notes"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={Object.keys(validationErrors).length > 0}
                  >
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Deactivate User Confirmation */}
          <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deactivate User?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to deactivate user <strong>{selectedUser?.user_id}</strong> (
                  {selectedUser?.first_name} {selectedUser?.last_name})? They will no longer be able
                  to log in.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeactivateUser}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Deactivate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Reset PIN Dialog */}
          <Dialog open={resetPinDialogOpen} onOpenChange={(open) => {
            setResetPinDialogOpen(open);
            if (!open) {
              // Clear reset PIN form when closing
              setResetPinData({ new_pin: '', confirm_pin: '' });
              setResetPinErrors({});
              setShowResetPin(false);
              setShowResetConfirmPin(false);
              setSelectedUser(null);
            }
          }}>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleResetPin}>
                <DialogHeader>
                  <DialogTitle>Reset PIN</DialogTitle>
                  <DialogDescription>
                    Set a new PIN for user {selectedUser?.user_id} ({selectedUser?.first_name} {selectedUser?.last_name}).
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <label htmlFor="reset_user_id" className="text-sm font-medium">
                      User ID
                    </label>
                    <Input
                      id="reset_user_id"
                      value={selectedUser?.user_id || ''}
                      disabled
                      className="bg-slate-100 dark:bg-slate-800 cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="new_pin" className="text-sm font-medium">
                      New PIN <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        id="new_pin"
                        type={showResetPin ? "text" : "password"}
                        placeholder="Enter 4-digit PIN"
                        maxLength={4}
                        required
                        value={resetPinData.new_pin}
                        onChange={(e) => handleResetPinChange(e.target.value)}
                        className={resetPinErrors.new_pin ? 'border-red-500 focus-visible:ring-red-500 pr-10' : 'pr-10'}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowResetPin(!showResetPin)}
                      >
                        {showResetPin ? (
                          <EyeOff className="h-4 w-4 text-slate-500" />
                        ) : (
                          <Eye className="h-4 w-4 text-slate-500" />
                        )}
                      </Button>
                    </div>
                    {resetPinErrors.new_pin ? (
                      <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {resetPinErrors.new_pin}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Enter 4-digit PIN (numbers only)
                      </p>
                    )}
                    {!resetPinErrors.new_pin && resetPinData.new_pin && resetPinData.new_pin.length === 4 && (
                      <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Strong PIN
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirm_reset_pin" className="text-sm font-medium">
                      Confirm PIN <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        id="confirm_reset_pin"
                        type={showResetConfirmPin ? "text" : "password"}
                        placeholder="Re-enter 4-digit PIN"
                        maxLength={4}
                        required
                        value={resetPinData.confirm_pin}
                        onChange={(e) => handleResetConfirmPinChange(e.target.value)}
                        className={resetPinErrors.confirm_pin ? 'border-red-500 focus-visible:ring-red-500 pr-10' : 'pr-10'}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowResetConfirmPin(!showResetConfirmPin)}
                      >
                        {showResetConfirmPin ? (
                          <EyeOff className="h-4 w-4 text-slate-500" />
                        ) : (
                          <Eye className="h-4 w-4 text-slate-500" />
                        )}
                      </Button>
                    </div>
                    {resetPinErrors.confirm_pin ? (
                      <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {resetPinErrors.confirm_pin}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Re-enter the same PIN
                      </p>
                    )}
                    {!resetPinErrors.confirm_pin && resetPinData.confirm_pin && resetPinData.new_pin === resetPinData.confirm_pin && resetPinData.confirm_pin.length === 4 && (
                      <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        PINs match
                      </p>
                    )}
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setResetPinDialogOpen(false);
                      setResetPinData({ new_pin: '', confirm_pin: '' });
                      setResetPinErrors({});
                      setShowResetPin(false);
                      setShowResetConfirmPin(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      Object.keys(resetPinErrors).length > 0 ||
                      !resetPinData.new_pin ||
                      !resetPinData.confirm_pin ||
                      resetPinData.new_pin.length !== 4 ||
                      resetPinData.confirm_pin.length !== 4 ||
                      resetPinData.new_pin !== resetPinData.confirm_pin
                    }
                  >
                    Reset PIN
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Unlock Account Dialog */}
          <AlertDialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Unlock className="h-5 w-5 text-green-600 dark:text-green-400" />
                  Unlock User Account
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to unlock the account for user{' '}
                  <strong>{selectedUser?.user_id}</strong> ({selectedUser?.first_name}{' '}
                  {selectedUser?.last_name})?
                </AlertDialogDescription>
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                    This will:
                  </p>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1 ml-4 list-disc">
                    <li>Reset failed login attempts to 0</li>
                    <li>Remove account lock (locked until: {selectedUser?.locked_until ? formatBusinessDateTime(selectedUser.locked_until) : 'N/A'})</li>
                    <li>Allow the user to login immediately</li>
                  </ul>
                </div>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleUnlockUser}
                  className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700"
                >
                  <Unlock className="mr-2 h-4 w-4" />
                  Unlock Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Revoke Sessions Confirmation */}
          <AlertDialog open={revokeSessionDialogOpen} onOpenChange={setRevokeSessionDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-red-600 dark:text-red-400" />
                  Revoke All Sessions
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to revoke all active sessions for user{' '}
                  <strong>{selectedUser?.user_id}</strong> ({selectedUser?.first_name}{' '}
                  {selectedUser?.last_name})?
                </AlertDialogDescription>
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-900 dark:text-amber-100 font-medium">
                    This will:
                  </p>
                  <ul className="text-sm text-amber-800 dark:text-amber-200 mt-2 space-y-1 ml-4 list-disc">
                    <li>Terminate all active sessions immediately</li>
                    <li>Force the user to login again on all devices</li>
                    <li>Clear all session tokens and JWT tokens</li>
                  </ul>
                </div>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRevokeUserSessions}
                  className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Revoke Sessions
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Advanced Filters Dialog */}
          <Dialog open={advancedFiltersOpen} onOpenChange={setAdvancedFiltersOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-blue-500" />
                  Advanced Filters
                </DialogTitle>
                <DialogDescription>
                  Filter users by creation date, login activity, and account status
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Placeholder for future advanced filters */}
                <div className="space-y-4 text-center py-8">
                  <div className="flex justify-center">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-full">
                      <Filter className="h-8 w-8 text-blue-500" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Advanced Filters
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                      Advanced filtering options for user management will be available here. Filter by creation date, last login, failed attempts, and more.
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setAdvancedFiltersOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* View User Dialog */}
          <ViewUserDialog
            user={selectedUser}
            open={viewDialogOpen}
            onOpenChange={setViewDialogOpen}
            currentUser={currentUser}
            onEdit={(user) => {
              setViewDialogOpen(false);
              openEditDialog(user);
            }}
            onResetPin={(user) => {
              setViewDialogOpen(false);
              setSelectedUser(user);
              setResetPinData({ new_pin: '', confirm_pin: '' });
              setResetPinErrors({});
              setShowResetPin(false);
              setShowResetConfirmPin(false);
              setResetPinDialogOpen(true);
            }}
            onViewActivityLog={(user) => {
              setViewDialogOpen(false);
              setSelectedUser(user);
              setActivityLogDialogOpen(true);
            }}
          />

          {/* User Activity Log Dialog */}
          <UserActivityLogDialog
            user={selectedUser}
            open={activityLogDialogOpen}
            onOpenChange={setActivityLogDialogOpen}
          />
        </div>

        <ToastViewport />
      </ErrorBoundary>
    </ToastProvider>
  );
};

export default UserManagementPage;
