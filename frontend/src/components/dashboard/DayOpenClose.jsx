import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Calculator,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Unlock,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { SIDEBAR_CARD_STYLES, SIDEBAR_GRADIENTS, cn } from './sidebarCardStyles';

const DayOpenClose = () => {
  const [dayStatus, setDayStatus] = useState('closed'); // 'closed', 'open'
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [openTime, setOpenTime] = useState(null);
  const [closeTime, setCloseTime] = useState(null);

  // Load day status from localStorage on mount
  useEffect(() => {
    const savedStatus = localStorage.getItem('dayStatus');
    const savedOpeningCash = localStorage.getItem('openingCash');
    const savedOpenTime = localStorage.getItem('openTime');
    const savedCloseTime = localStorage.getItem('closeTime');

    if (savedStatus) {
      setDayStatus(savedStatus);
      if (savedOpeningCash) setOpeningCash(savedOpeningCash);
      if (savedOpenTime) setOpenTime(savedOpenTime);
      if (savedCloseTime) setCloseTime(savedCloseTime);
    }
  }, []);

  const handleOpenDay = () => {
    if (!openingCash || parseFloat(openingCash) < 0) {
      toast.error('Please enter a valid opening cash amount');
      return;
    }

    const now = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    setDayStatus('open');
    setOpenTime(now);

    localStorage.setItem('dayStatus', 'open');
    localStorage.setItem('openingCash', openingCash);
    localStorage.setItem('openTime', now);

    toast.success(`Day opened at ${now} with $${parseFloat(openingCash).toLocaleString()}`);
  };

  const handleCloseDay = () => {
    if (!closingCash || parseFloat(closingCash) < 0) {
      toast.error('Please enter a valid closing cash amount');
      return;
    }

    const now = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const cashDifference = parseFloat(closingCash) - parseFloat(openingCash);

    setDayStatus('closed');
    setCloseTime(now);

    localStorage.setItem('dayStatus', 'closed');
    localStorage.setItem('closeTime', now);

    toast.success(
      `Day closed at ${now}. Cash difference: ${cashDifference >= 0 ? '+' : ''}$${cashDifference.toLocaleString()}`,
      { duration: 5000 }
    );

    // Reset for next day after showing message
    setTimeout(() => {
      setOpeningCash('');
      setClosingCash('');
      setOpenTime(null);
      setCloseTime(null);
      localStorage.removeItem('openingCash');
      localStorage.removeItem('openTime');
      localStorage.removeItem('closeTime');
    }, 5000);
  };

  return (
    <Card className={SIDEBAR_CARD_STYLES.card}>
      <CardContent className={SIDEBAR_CARD_STYLES.cardContent}>
        <div className={SIDEBAR_CARD_STYLES.container}>
          {/* Section Header */}
          <div className={SIDEBAR_CARD_STYLES.header}>
            <div className={SIDEBAR_CARD_STYLES.iconWrapper}>
              <div className={cn(
                SIDEBAR_CARD_STYLES.iconContainer,
                SIDEBAR_CARD_STYLES.iconContainerGradient,
                SIDEBAR_GRADIENTS.cashRegister
              )}>
                <Calculator className={SIDEBAR_CARD_STYLES.icon} />
              </div>
            </div>
            <div className={SIDEBAR_CARD_STYLES.textContainer}>
              <CardTitle className={SIDEBAR_CARD_STYLES.title}>Cash Register</CardTitle>
              <p className={SIDEBAR_CARD_STYLES.subtitle}>Track daily cash</p>
            </div>
          </div>

          {/* Form Content */}
          <div className="space-y-4">
        {dayStatus === 'closed' ? (
          // Day Closed - Show opening form
          <>
            <div className="space-y-2">
              <Label htmlFor="openingCash" className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center space-x-2">
                <DollarSign className="w-4 h-4" />
                <span>Opening Cash Amount</span>
              </Label>
              <Input
                id="openingCash"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
              />
            </div>

            <Button
              onClick={handleOpenDay}
              className="w-full justify-center h-11 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-200"
            >
              <Unlock className="w-4 h-4 mr-2" />
              Open Day
            </Button>
          </>
        ) : (
          // Day Open - Show status and closing form
          <>
            {/* Status Display */}
            <div className="space-y-3 p-4 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Opened At</span>
                </div>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{openTime}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Opening Cash</span>
                </div>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  ${parseFloat(openingCash).toLocaleString()}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-medium">Day is currently open</span>
                </div>
              </div>
            </div>

            {/* Closing Form */}
            <div className="space-y-2">
              <Label htmlFor="closingCash" className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center space-x-2">
                <DollarSign className="w-4 h-4" />
                <span>Closing Cash Amount</span>
              </Label>
              <Input
                id="closingCash"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
              />
            </div>

            <Button
              onClick={handleCloseDay}
              className="w-full justify-center h-11 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold shadow-lg shadow-orange-500/30 transition-all duration-200"
            >
              <Lock className="w-4 h-4 mr-2" />
              Close Day
            </Button>
          </>
        )}

            {/* Info Alert */}
            <div className="flex items-start space-x-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                {dayStatus === 'open'
                  ? 'Enter the total cash amount in the register at the end of the day to close.'
                  : 'Enter the starting cash amount in your register to begin the day.'}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DayOpenClose;
