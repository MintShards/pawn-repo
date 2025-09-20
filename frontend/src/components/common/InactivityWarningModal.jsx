import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import { Shield, Clock, LogOut, AlertTriangle, Timer } from 'lucide-react';

/**
 * Security Warning Modal for Inactivity Timeout
 * 
 * Shows a prominent warning before automatic logout
 * Provides user options to extend session or logout immediately
 * Includes visual countdown and security messaging
 */
const InactivityWarningModal = ({
  isOpen = false,
  timeRemainingSeconds = 300, // Default 5 minutes in seconds
  warningDuration = 15, // Warning duration in seconds (defaults to 15 for production)
  onExtendSession = () => {},
  onLogoutNow = () => {},
  onCancel = () => {}
}) => {
  const [countdown, setCountdown] = useState(timeRemainingSeconds);
  const [progress, setProgress] = useState(100);

  // Update countdown and progress
  useEffect(() => {
    setCountdown(timeRemainingSeconds);
    const progressPercentage = (timeRemainingSeconds / warningDuration) * 100; // Dynamic based on actual warning duration
    setProgress(Math.max(0, progressPercentage));
  }, [timeRemainingSeconds, warningDuration]);

  // Format time display - now using seconds
  const formatTime = (seconds) => {
    if (seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine urgency level - now using seconds
  const getUrgencyLevel = (seconds) => {
    if (seconds <= 5) return 'critical';   // Last 5 seconds
    if (seconds <= 10) return 'high';      // 6-10 seconds remaining
    return 'medium';                       // 11-15 seconds remaining
  };

  const urgencyLevel = getUrgencyLevel(countdown);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className={`sm:max-w-lg border-2 transition-all duration-300 animate-in zoom-in-95 ${
          urgencyLevel === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-950/20 shadow-red-200' :
          urgencyLevel === 'high' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 shadow-orange-200' :
          'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 shadow-yellow-200'
        } shadow-2xl`}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center space-y-3">
          <DialogTitle className={`flex items-center justify-center gap-3 text-xl font-bold transition-colors duration-300 ${
            urgencyLevel === 'critical' ? 'text-red-800 dark:text-red-200' :
            urgencyLevel === 'high' ? 'text-orange-800 dark:text-orange-200' :
            'text-yellow-800 dark:text-yellow-200'
          }`}>
            <div className={`p-2 rounded-full ${
              urgencyLevel === 'critical' ? 'bg-red-200 dark:bg-red-800 animate-pulse' :
              urgencyLevel === 'high' ? 'bg-orange-200 dark:bg-orange-800 animate-bounce' :
              'bg-yellow-200 dark:bg-yellow-800'
            }`}>
              {urgencyLevel === 'critical' ? 
                <AlertTriangle className="h-6 w-6" /> :
                <Shield className="h-6 w-6" />
              }
            </div>
            🔒 Security Timeout Warning
          </DialogTitle>
          <DialogDescription className="text-base text-slate-700 dark:text-slate-300">
            Your session will automatically end due to inactivity for security purposes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Enhanced Alert Banner */}
          <Alert className={`border-2 transition-all duration-300 ${
            urgencyLevel === 'critical' ? 'border-red-500 bg-red-100 dark:bg-red-900/30 animate-pulse' :
            urgencyLevel === 'high' ? 'border-orange-500 bg-orange-100 dark:bg-orange-900/30' :
            'border-yellow-500 bg-yellow-100 dark:bg-yellow-900/30'
          }`}>
            <div className="flex items-center gap-2">
              {urgencyLevel === 'critical' ? 
                <AlertTriangle className="h-5 w-5 text-red-600 animate-pulse" /> :
                <Clock className="h-5 w-5" />
              }
              <AlertDescription className={`font-bold text-lg ${
                urgencyLevel === 'critical' ? 'text-red-800 dark:text-red-200' :
                urgencyLevel === 'high' ? 'text-orange-800 dark:text-orange-200' :
                'text-yellow-800 dark:text-yellow-200'
              }`}>
                {urgencyLevel === 'critical' 
                  ? '🚨 CRITICAL: Logging out in seconds!'
                  : urgencyLevel === 'high'
                  ? '⚠️ WARNING: Logging out soon!'
                  : '⏰ Session timeout approaching'
                }
              </AlertDescription>
            </div>
          </Alert>

          {/* Enhanced Countdown Display */}
          <div className="text-center space-y-4">
            <div className={`relative p-6 rounded-full mx-auto w-32 h-32 flex items-center justify-center border-4 transition-all duration-300 ${
              urgencyLevel === 'critical' ? 'border-red-500 bg-red-100 dark:bg-red-900/30 animate-pulse' :
              urgencyLevel === 'high' ? 'border-orange-500 bg-orange-100 dark:bg-orange-900/30' :
              'border-yellow-500 bg-yellow-100 dark:bg-yellow-900/30'
            }`}>
              <div className="text-center">
                <div className={`text-3xl font-bold font-mono transition-colors duration-300 ${
                  urgencyLevel === 'critical' ? 'text-red-800 dark:text-red-200' :
                  urgencyLevel === 'high' ? 'text-orange-800 dark:text-orange-200' :
                  'text-yellow-800 dark:text-yellow-200'
                }`}>
                  {formatTime(countdown)}
                </div>
                <Timer className={`h-4 w-4 mx-auto mt-1 ${
                  urgencyLevel === 'critical' ? 'text-red-600 animate-spin' :
                  urgencyLevel === 'high' ? 'text-orange-600' :
                  'text-yellow-600'
                }`} />
              </div>
            </div>
            
            <div className="text-base font-medium text-slate-700 dark:text-slate-300">
              Time remaining until automatic logout
            </div>
            
            {/* Enhanced Progress Bar */}
            <div className="space-y-3">
              <div className="relative">
                <Progress 
                  value={progress} 
                  className={`h-4 transition-all duration-300 ${
                    urgencyLevel === 'critical' ? 'text-red-600' :
                    urgencyLevel === 'high' ? 'text-orange-600' :
                    'text-yellow-600'
                  }`}
                />
                <div className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${
                  progress > 50 ? 'text-white' : 'text-slate-800 dark:text-slate-200'
                }`}>
                  {progress.toFixed(0)}%
                </div>
              </div>
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>Warning started</span>
                <span>Auto-logout</span>
              </div>
            </div>
          </div>

          {/* Enhanced Security Information */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 shadow-inner">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Why am I seeing this?
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm text-blue-800 dark:text-blue-200">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <span>You've been inactive for 2 hours</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <span>This protects your account and sensitive data</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                <span>Click "Stay Logged In" to continue working</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                <span>Or logout now to secure your session</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-3 sm:gap-3 pt-4">
          <Button 
            variant="outline"
            onClick={onLogoutNow}
            className={`flex items-center gap-2 flex-1 py-3 transition-all duration-200 transform hover:scale-105 ${
              urgencyLevel === 'critical' 
                ? 'border-red-400 text-red-800 hover:bg-red-100 shadow-red-200' 
                : 'border-red-300 text-red-700 hover:bg-red-50'
            } shadow-lg`}
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Logout Now</span>
          </Button>
          <Button 
            onClick={onExtendSession}
            className={`flex items-center gap-2 flex-1 py-3 transition-all duration-200 transform hover:scale-105 ${
              urgencyLevel === 'critical'
                ? 'bg-green-600 hover:bg-green-700 animate-pulse'
                : 'bg-green-600 hover:bg-green-700'
            } shadow-lg`}
          >
            <Shield className="h-5 w-5" />
            <span className="font-medium">Stay Logged In</span>
          </Button>
        </DialogFooter>

        {/* Enhanced Security Footer */}
        <div className="text-center mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Shield className="h-4 w-4 text-blue-500" />
            <span className="font-medium">This security feature protects against unauthorized access</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pawnshop Management System • Security Protocol Active
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InactivityWarningModal;