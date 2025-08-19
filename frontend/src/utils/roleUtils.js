/**
 * Role utility functions for consistent role display and access control
 */

/**
 * Get display name for user role
 * @param {string} role - The user role ('admin' or 'staff')
 * @param {boolean} isLoading - Whether user data is still loading
 * @returns {string} Display name for the role
 */
export const getRoleDisplayName = (role, isLoading = false) => {
  // Show loading state only when explicitly loading
  if (isLoading) {
    return 'User';
  }
  
  // If no role but not loading, we're likely waiting for user data to load
  if (role === undefined || role === null) {
    return 'User';
  }
  
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'staff':
      return 'Staff';
    default:
      return 'Staff';
  }
};

/**
 * Get full role title for user role
 * @param {string} role - The user role ('admin' or 'staff')
 * @param {boolean} isLoading - Whether user data is still loading
 * @returns {string} Full title for the role
 */
export const getRoleTitle = (role, isLoading = false) => {
  // Show loading state only when explicitly loading
  if (isLoading) {
    return 'Loading...';
  }
  
  // If no role but not loading, show placeholder until data loads
  if (role === undefined || role === null) {
    return '...';
  }
  
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'staff':
      return 'Staff Member';
    default:
      return 'Staff Member';
  }
};

/**
 * Check if user has admin privileges
 * @param {Object} user - User object with role property
 * @returns {boolean} True if user is admin
 */
export const isAdmin = (user) => {
  return user?.role === 'admin';
};

/**
 * Check if user has staff privileges (includes admin)
 * @param {Object} user - User object with role property
 * @returns {boolean} True if user is staff or admin
 */
export const isStaffOrAdmin = (user) => {
  return user?.role === 'admin' || user?.role === 'staff';
};

/**
 * Get user display string with role and ID
 * @param {Object} user - User object with role, user_id, first_name, last_name properties
 * @param {boolean} isLoading - Whether user data is still loading
 * @returns {string} Formatted user display string
 */
export const getUserDisplayString = (user, isLoading = false) => {
  if (isLoading || !user?.user_id) return 'User';
  
  // Use first name if available, otherwise fall back to role + ID
  if (user.first_name) {
    return `${user.first_name} (${user.user_id})`;
  }
  
  const roleDisplay = getRoleDisplayName(user.role, isLoading);
  return `${roleDisplay} ${user.user_id}`;
};

/**
 * Get welcome message for user
 * @param {Object} user - User object with role, user_id, first_name properties
 * @param {boolean} isLoading - Whether user data is still loading
 * @returns {string} Formatted welcome message
 */
export const getWelcomeMessage = (user, isLoading = false) => {
  if (isLoading) return 'Welcome back...';
  
  // If user is not loaded yet, show loading placeholder
  if (!user?.user_id) return 'Welcome back...';
  
  const roleTitle = getRoleTitle(user.role, isLoading);
  
  // Don't show incomplete data while role is loading
  if (roleTitle === '...') return 'Welcome back...';
  
  // Use first name if available, otherwise use role title + ID
  if (user.first_name) {
    return `Welcome back, ${user.first_name}`;
  }
  
  return `Welcome back, ${roleTitle} ${user.user_id}`;
};