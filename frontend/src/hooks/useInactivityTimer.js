import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/**
 * Custom hook for security-focused inactivity monitoring
 * Implements automatic logout after 2 hours of inactivity
 * 
 * Security Features:
 * - Tracks multiple types of user activity
 * - Configurable timeout periods
 * - Warning system before auto-logout
 * - Proper cleanup and security logging
 */
const useInactivityTimer = ({
  timeoutDuration = 7200000, // 2 hours in milliseconds
  warningTime = 300000, // 5 minutes warning in milliseconds
  onTimeout = () => {},
  onWarning = () => {},
  onActivity = () => {},
  enabled = true
}) => {
  const [isActive, setIsActive] = useState(false); // Start as false to prevent immediate firing
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(timeoutDuration);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const timeoutRef = useRef(null);
  const warningRef = useRef(null);
  const intervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);
  const initializationRef = useRef(false);
  const warningStartTimeRef = useRef(null);
  const handleActivityRef = useRef(null);

  // Events to monitor for meaningful user activity - memoized to prevent re-renders
  const activityEvents = useMemo(() => [
    'mousemove', // Mouse movement - most common activity
    'mousedown', // Will be filtered to only left-clicks
    'keydown',   // Keyboard activity
    'click',     // Left clicks only
    'touchstart', // Touch interactions
    'touchmove', // Touch movement
    'scroll'     // Page scrolling
  ], []);

  // Reset the inactivity timer
  const resetTimer = useCallback(() => {
    if (!isActive || !isInitialized) {
      return;
    }

    const now = Date.now();
    lastActivityRef.current = now;
    setTimeRemaining(timeoutDuration);
    setShowWarning(false);
    warningShownRef.current = false;

    // Clear existing timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set warning timer (warning before logout)
    const warningDelay = timeoutDuration - warningTime;
    
    warningRef.current = setTimeout(() => {
      if (isActive && !warningShownRef.current) {
        warningShownRef.current = true;
        warningStartTimeRef.current = Date.now();
        setShowWarning(true);
        onWarning();
        console.warn('🔒 Security Warning: Auto-logout due to inactivity');
        
        // Start countdown interval - counts down from warning time remaining
        setTimeRemaining(warningTime); // Initialize with full warning time
        
        intervalRef.current = setInterval(() => {
          const elapsed = Date.now() - warningStartTimeRef.current;
          const remaining = warningTime - elapsed;
          const remainingMs = Math.max(0, remaining);
          
          setTimeRemaining(remainingMs);
          
          if (remainingMs <= 0) {
            clearInterval(intervalRef.current);
            
            // Clear the main timeout timer since we're triggering logout now
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            
            // Force state reset
            setIsActive(false);
            setShowWarning(false);
            setTimeRemaining(0);
            
            // Trigger logout immediately when countdown reaches zero
            console.warn('🔒 Security: Auto-logout triggered by countdown completion');
            onTimeout();
          }
        }, 1000); // Update every second for clear countdown
      }
    }, warningDelay);

    // Set logout timer (full timeout)
    timeoutRef.current = setTimeout(() => {
      console.warn('🔒 Security: Auto-logout due to inactivity');
      
      // Clean up everything
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (warningRef.current) {
        clearTimeout(warningRef.current);
        warningRef.current = null;
      }
      
      // Force state reset
      setIsActive(false);
      setShowWarning(false);
      setTimeRemaining(0);
      
      // Trigger logout
      onTimeout();
    }, timeoutDuration);

    // Notify activity callback
    if (onActivity) {
      onActivity();
    }
  }, [isActive, isInitialized, timeoutDuration, warningTime, onTimeout, onWarning, onActivity]);

  // Handle user activity with debounce to prevent timer thrashing
  const handleActivity = useCallback((event) => {
    // Ignore programmatic events for security
    if (event && event.isTrusted === false) {
      return;
    }
    
    // Filter out right-clicks and other non-meaningful interactions
    if (event.type === 'mousedown' && event.button !== 0) {
      // Only count left mouse button (button 0) as activity
      return;
    }
    
    // Ignore context menu and auxiliary clicks
    if (event.type === 'contextmenu' || (event.button && (event.button === 1 || event.button === 2))) {
      return;
    }
    
    // CRITICAL: Do not reset timer when warning is already shown
    // This prevents modal interactions from canceling the auto-logout
    if (showWarning) {
      return;
    }
    
    // Debounce activity to prevent excessive resets
    // Use longer debounce for mouse movement, shorter for other events
    const now = Date.now();
    const debounceTime = event.type === 'mousemove' ? 2000 : 1000; // 2s for mouse, 1s for others
    
    if (now - lastActivityRef.current < debounceTime) {
      return;
    }
    
    // Reset the timer due to meaningful user activity
    resetTimer();
  }, [resetTimer, showWarning]);

  // Update the ref whenever handleActivity changes
  handleActivityRef.current = handleActivity;

  // Start monitoring with proper initialization
  const startTimer = useCallback(() => {
    if (initializationRef.current) return; // Prevent multiple initializations
    
    initializationRef.current = true;
    
    // Small delay to ensure React has finished rendering
    setTimeout(() => {
      setIsActive(true);
      setIsInitialized(true);
      
      // Start the timer after a brief delay
      setTimeout(() => {
        if (initializationRef.current) {
          
          // Set up timers directly since state might not be updated yet
          const now = Date.now();
          lastActivityRef.current = now;
          setTimeRemaining(timeoutDuration);
          setShowWarning(false);
          warningShownRef.current = false;

          // Clear existing timers
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          if (warningRef.current) {
            clearTimeout(warningRef.current);
          }
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }

          // Set warning timer
          const warningDelay = timeoutDuration - warningTime;
                
          warningRef.current = setTimeout(() => {
            if (initializationRef.current && !warningShownRef.current) {
              warningShownRef.current = true;
              warningStartTimeRef.current = Date.now();
              setShowWarning(true);
              onWarning();
              console.warn('🔒 Security Warning: Auto-logout due to inactivity');
              
              // Start countdown interval
              setTimeRemaining(warningTime);
              
              intervalRef.current = setInterval(() => {
                const elapsed = Date.now() - warningStartTimeRef.current;
                const remaining = warningTime - elapsed;
                const remainingMs = Math.max(0, remaining);
                
                setTimeRemaining(remainingMs);
                
                if (remainingMs <= 0) {
                  clearInterval(intervalRef.current);
                  
                  // Clear the main timeout timer since we're triggering logout now
                  if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                  }
                  
                  // Force state reset
                  setIsActive(false);
                  setShowWarning(false);
                  setTimeRemaining(0);
                  
                  // Trigger logout immediately when countdown reaches zero
                  console.warn('🔒 Security: Auto-logout triggered by countdown completion');
                  onTimeout();
                }
              }, 1000);
            }
          }, warningDelay);

          // Set logout timer
          timeoutRef.current = setTimeout(() => {
            console.warn('🔒 Security: Auto-logout due to inactivity');
            
            // Clean up everything
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            if (warningRef.current) {
              clearTimeout(warningRef.current);
              warningRef.current = null;
            }
            
            // Force state reset
            setIsActive(false);
            setShowWarning(false);
            setTimeRemaining(0);
            
            // Trigger logout
            onTimeout();
          }, timeoutDuration);
        }
      }, 100); // Small delay to ensure everything is ready
    }, 50);
  }, [timeoutDuration, warningTime, onTimeout, onWarning]);

  // Stop monitoring
  const stopTimer = useCallback(() => {
    initializationRef.current = false;
    setIsActive(false);
    setIsInitialized(false);
    setShowWarning(false);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, []);

  // Extend session (reset timer without full restart)
  const extendSession = useCallback(() => {
    if (showWarning) {
      setShowWarning(false);
      resetTimer();
    }
  }, [showWarning, resetTimer]);

  // Setup and cleanup event listeners
  useEffect(() => {
    if (!isActive || !isInitialized) return;

    // Add event listeners for activity detection using stable ref
    const stableHandler = (event) => handleActivityRef.current?.(event);
    
    activityEvents.forEach(event => {
      document.addEventListener(event, stableHandler, {
        passive: true,
        capture: true
      });
    });

    // Cleanup function
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, stableHandler, {
          capture: true
        });
      });
      
      // CRITICAL: Do NOT clear the countdown interval during cleanup
      // This prevents the warning countdown from being destroyed
      // Only clear main timers if we're actually stopping the timer
      if (!showWarning) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        if (warningRef.current) {
          clearTimeout(warningRef.current);
        }
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }
    };
  }, [isActive, isInitialized, activityEvents]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: showWarning intentionally excluded to prevent clearing interval during warning state

  // Return hook interface
  return {
    isActive,
    showWarning,
    timeRemaining: Math.max(0, timeRemaining),
    timeRemainingMinutes: Math.max(0, Math.ceil(timeRemaining / 1000 / 60)), // Convert ms to minutes
    timeRemainingSeconds: Math.max(0, Math.ceil(timeRemaining / 1000)), // Convert ms to seconds
    startTimer,
    stopTimer,
    resetTimer,
    extendSession,
    lastActivity: lastActivityRef.current
  };
};

export default useInactivityTimer;