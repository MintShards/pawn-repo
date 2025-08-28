import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import useInactivityTimer from '../hooks/useInactivityTimer';
import InactivityWarningModal from '../components/common/InactivityWarningModal';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Security: Inactivity timer for automatic logout
  const handleInactivityTimeout = () => {
    // Automatic logout due to 2 hours + 1 minute of inactivity
    logout('inactivity_timeout');
  };

  const handleInactivityWarning = () => {
    // Inactivity warning - automatic logout in 60 seconds
  };

  const handleUserActivity = () => {
    
    // Update last activity time for token refresh logic
    setLastActivity(Date.now());
  };

  const {
    showWarning,
    timeRemainingSeconds,
    startTimer,
    stopTimer,
    extendSession
  } = useInactivityTimer({
    timeoutDuration: 7260000, // 2 hours + 1 minute (7,200,000ms + 60,000ms)
    warningTime: 60000, // 60 seconds (1 minute) warning countdown
    onTimeout: handleInactivityTimeout,
    onWarning: handleInactivityWarning,
    onActivity: handleUserActivity,
    enabled: isAuthenticated
  });

  // Automatic token refresh - check every 5 minutes for proactive refresh
  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshInterval = setInterval(async () => {
      const currentToken = authService.getToken();
      if (!currentToken) return;

      // Check if token is expiring soon (within 5 minutes)
      if (authService.isTokenExpiringSoon(currentToken)) {
        try {
          const refreshSuccess = await authService.refreshAccessToken();
          if (refreshSuccess) {
            // Token auto-refreshed successfully
          } else {
            // Token auto-refresh failed - user may need to re-login
          }
        } catch (error) {
          // Token auto-refresh error
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes for proactive refresh

    return () => clearInterval(refreshInterval);
  }, [isAuthenticated]);

  const initializeAuth = useCallback(async () => {
    try {
      // Initialize authentication state
      const hasToken = !!authService.getToken();
      const hasRefreshToken = !!localStorage.getItem('pawn_repo_refresh_token');
      
      if (!hasToken) {
        // No access token found
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      
      // EMERGENCY FIX: Skip user data fetch during initialization to prevent request storm
      // Login response already contains user data, no need to fetch during init
      if (hasToken && hasRefreshToken) {
        // Trust the stored tokens and set authenticated state
        // Note: User data will be fetched lazily when needed to prevent API spam
        setIsAuthenticated(true);
        
        // Start security timer for existing session without user data fetch
        setTimeout(() => startTimer(), 200);
        setLoading(false);
        return;
      }
      
      // EMERGENCY FIX: Don't fetch user data during initialization
      // Sessions without refresh token are considered invalid - require re-login
      if (!hasRefreshToken) {
        // No refresh token - requiring fresh login
        authService.logout();
        setIsAuthenticated(false);
      }
    } catch (error) {
      // Auth initialization error
      authService.logout();
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [startTimer]);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const login = async (credentials) => {
    try {
      setLoading(true);
      const response = await authService.login(credentials);
      
      // Handle both response formats: login-with-refresh returns user as dict, regular login returns user object
      const userData = response.user;
      if (userData) {
        setUser(userData);
        setIsAuthenticated(true);
        setLastActivity(Date.now()); // Initialize activity tracking
        
        // Login successful
        
        // Start security inactivity timer
        // Use setTimeout to avoid race condition during login
        setTimeout(() => {
          startTimer();
        }, 200);
        
        return { success: true, user: userData };
      } else {
        // Login response missing user data
        throw new Error('No user data received');
      }
    } catch (error) {
      // Login error
      return { 
        success: false, 
        error: error.message || 'Login failed. Please check your credentials.' 
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = (reason = 'manual') => {
    // Log security event
    if (reason === 'inactivity_timeout') {
      // User logged out due to inactivity timeout
    }
    
    // Stop inactivity monitoring
    stopTimer();
    
    // Clear authentication state
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
    setLastActivity(Date.now()); // Reset activity tracking
  };

  // Handle warning modal actions
  const handleExtendSession = () => {
    extendSession();
  };

  const handleLogoutNow = () => {
    logout('manual_from_warning');
  };

  // EMERGENCY: Lazy user data fetch to prevent request storms
  const fetchUserDataIfNeeded = async () => {
    if (!user && isAuthenticated) {
      try {
        const userData = await authService.getCurrentUser();
        if (userData) {
          setUser(userData);
          return userData;
        }
      } catch (error) {
        // Failed to fetch user data
        // Don't logout automatically - just leave user data empty
      }
    }
    return user;
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
    refreshUser: initializeAuth,
    fetchUserDataIfNeeded,
    // Security features
    inactivityWarning: showWarning,
    timeRemainingSeconds,
    lastActivity
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      
      {/* Security: Inactivity Warning Modal */}
      <InactivityWarningModal
        isOpen={showWarning}
        timeRemainingSeconds={timeRemainingSeconds}
        warningDuration={60} // 60 seconds (1 minute) warning countdown
        onExtendSession={handleExtendSession}
        onLogoutNow={handleLogoutNow}
      />
    </AuthContext.Provider>
  );
};