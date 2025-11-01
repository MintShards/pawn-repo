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
  const [userLoading, setUserLoading] = useState(false);

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

  // Automatic token refresh and session validation - check every 30 seconds
  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshInterval = setInterval(async () => {
      const currentToken = authService.getToken();
      if (!currentToken) return;

      // Validate session is still active by checking token validity
      try {
        const isValid = await authService.checkSessionValid();
        if (!isValid) {
          // Session has been revoked or token is invalid - logout
          logout('session_invalid');
          window.location.href = '/login?reason=session_revoked';
          return;
        }
      } catch (error) {
        // Network error during session check - do NOT logout
        // This could be temporary network issue, backend restart, etc.
        // User stays logged in, will retry in 30 seconds
        console.warn('Session validation failed (network error), will retry:', error.message);
        return; // Skip to next interval check
      }

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
    }, 30 * 1000); // Check every 30 seconds for session validation

    return () => clearInterval(refreshInterval);
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const initializeAuth = useCallback(async () => {
    try {
      // Initialize authentication state
      const hasToken = !!authService.getToken();
      const hasRefreshToken = !!sessionStorage.getItem('pawn_repo_refresh_token');
      
      if (!hasToken) {
        // No access token found
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      
      // EMERGENCY FIX: Skip user data fetch during initialization to prevent request storm
      // Login response already contains user data, no need to fetch during init
      if (hasToken && hasRefreshToken) {
        // Validate token is not expired before trusting it
        if (authService.isTokenExpired(authService.getToken())) {
          // Token is expired - clear auth and redirect to login
          authService.logout();
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        // CRITICAL: Validate session before trusting token to prevent request loops
        // Check if session has been revoked before setting authenticated state
        try {
          const isValid = await authService.checkSessionValid();
          if (!isValid) {
            // Session has been revoked - clear auth and redirect to login
            authService.logout();
            setIsAuthenticated(false);
            setLoading(false);
            window.location.href = '/login?reason=session_revoked';
            return;
          }
        } catch (error) {
          // Session validation failed - but be resilient to network errors
          // Only logout if it's definitely a session revocation, not a network issue
          console.warn('Session validation failed during initialization:', error);

          // If we have a valid token and refresh token, trust them temporarily
          // The 30-second interval will catch revocations once network is restored
          // This prevents logout on temporary network issues during page refresh
        }

        // Session is valid - trust the stored tokens and set authenticated state
        setIsAuthenticated(true);

        // Don't fetch user data here - let components request it when needed
        // This prevents request storms during initialization

        // Start security timer for existing session
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
    // One-time migration: Clear old localStorage tokens
    // This ensures clean transition from localStorage to sessionStorage
    if (localStorage.getItem('pawn_repo_token') || localStorage.getItem('pawn_repo_refresh_token')) {
      localStorage.removeItem('pawn_repo_token');
      localStorage.removeItem('pawn_repo_refresh_token');
      // Migration: Cleared old localStorage tokens
    }

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
      console.log('AuthContext login error:', error);
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
    // Prevent multiple concurrent fetches
    if (userLoading || user || !isAuthenticated) {
      return user;
    }
    
    try {
      setUserLoading(true);
      const userData = await authService.getCurrentUser();
      if (userData) {
        setUser(userData);
        return userData;
      }
    } catch (error) {
      // Failed to fetch user data
      // Don't logout automatically - just leave user data empty
      console.error('Failed to fetch user data:', error);
    } finally {
      setUserLoading(false);
    }
    return null;
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