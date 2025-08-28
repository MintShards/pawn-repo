import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '../ui/button';
import serviceAlertService from '../../services/serviceAlertService';

const AlertBellAction = React.memo(({ customerPhone, onBellClick }) => {
  // Self-contained state - no context dependencies
  const [alertCount, setAlertCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [initialized, setInitialized] = useState(false);
  
  // Memoize badge text calculation to prevent unnecessary re-renders
  const badgeText = useMemo(() => {
    return alertCount > 99 ? '99+' : alertCount.toString();
  }, [alertCount]);
  
  // Memoize badge display logic
  const showBadge = useMemo(() => alertCount > 0, [alertCount]);

  // Initialize alert count once when component mounts
  useEffect(() => {
    if (!customerPhone || initialized) return;
    
    const loadAlertCount = async () => {
      try {
        setIsLoading(true);
        const result = await serviceAlertService.getCustomerAlertCount(customerPhone);
        setAlertCount(result.active_count || 0);
        setInitialized(true);
      } catch (error) {
        setAlertCount(0);
        setInitialized(true);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAlertCount();
  }, [customerPhone, initialized]);

  // Optimized refresh function - self-contained
  const refreshAlertCount = useCallback(async () => {
    if (!customerPhone) return;
    
    try {
      setIsUpdating(true);
      const result = await serviceAlertService.getCustomerAlertCount(customerPhone);
      setAlertCount(result.active_count || 0);
    } catch (error) {
      // Keep current count on error
    } finally {
      setTimeout(() => setIsUpdating(false), 500);
    }
  }, [customerPhone]);
  
  // Event listeners with minimal dependencies
  useEffect(() => {
    if (!customerPhone) return;
    
    let updateTimeout;
    
    const handleGlobalRefresh = async () => {
      if (updateTimeout) clearTimeout(updateTimeout);
      await refreshAlertCount();
    };
    
    const handleCustomerRefresh = async (event) => {
      if (event.detail?.customerPhone === customerPhone) {
        if (updateTimeout) clearTimeout(updateTimeout);
        await refreshAlertCount();
      }
    };
    
    window.addEventListener('refreshAlertCounts', handleGlobalRefresh);
    window.addEventListener('refreshCustomerAlerts', handleCustomerRefresh);

    return () => {
      window.removeEventListener('refreshAlertCounts', handleGlobalRefresh);
      window.removeEventListener('refreshCustomerAlerts', handleCustomerRefresh);
      if (updateTimeout) clearTimeout(updateTimeout);
    };
  }, [customerPhone, refreshAlertCount]);

  // Expose refresh method for parent components
  const refreshCount = refreshAlertCount;

  // Expose refresh method via ref or callback
  React.useImperativeHandle(onBellClick?.ref, () => ({
    refreshCount
  }), [refreshCount]);

  // Stable bell click handler
  const handleBellClick = useCallback((e) => {
    e.stopPropagation();
    if (onBellClick && typeof onBellClick === 'function') {
      onBellClick(customerPhone, alertCount, refreshCount);
    }
  }, [customerPhone, alertCount, onBellClick, refreshCount]);

  if (isLoading) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        className="relative"
      >
        <Bell className="h-4 w-4 animate-pulse opacity-50" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBellClick}
      className="relative hover:bg-accent/50 transition-colors"
      title={alertCount > 0 ? `${alertCount} active service alert${alertCount > 1 ? 's' : ''}` : 'No active service alerts'}
    >
      <Bell className="h-4 w-4" />
      
      {/* Optimized Badge for alert count */}
      {showBadge && (
        <span 
          className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] text-xs font-medium text-white bg-red-500 rounded-full border-2 border-white dark:border-slate-800 transition-all duration-300 transform ${
            isUpdating 
              ? 'animate-bounce scale-110' 
              : 'animate-pulse scale-105'
          }`}
          style={{ 
            animationDuration: isUpdating ? '0.6s' : '2s',
            animationIterationCount: isUpdating ? '3' : 'infinite'
          }}
        >
          {badgeText}
        </span>
      )}
    </Button>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo optimization
  return (
    prevProps.customerPhone === nextProps.customerPhone &&
    prevProps.onBellClick === nextProps.onBellClick
  );
});

// Set display name for debugging
AlertBellAction.displayName = 'AlertBellAction';

export default AlertBellAction;