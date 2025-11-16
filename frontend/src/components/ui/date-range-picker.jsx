/**
 * Date Range Picker Component
 *
 * Provides a popover-based date range selector with calendar interface
 * Used for custom date range selection in trends analytics
 */

import React, { useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { format, isValid, subDays, startOfDay, endOfDay } from "date-fns";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/**
 * Format date range for display
 *
 * @param {Date} from - Start date
 * @param {Date} to - End date
 * @returns {string} Formatted date range string
 */
const formatDateRange = (from, to) => {
  if (!from) return "Select date range";
  if (!to) return format(from, "MMM dd, yyyy");
  return `${format(from, "MMM dd, yyyy")} - ${format(to, "MMM dd, yyyy")}`;
};

/**
 * DateRangePicker Component
 *
 * @param {Object} props
 * @param {Object} props.value - Current date range { from: Date, to: Date }
 * @param {Function} props.onChange - Callback when date range changes
 * @param {Function} props.onClear - Callback when range is cleared
 * @param {Date} props.minDate - Minimum selectable date
 * @param {Date} props.maxDate - Maximum selectable date (defaults to today)
 * @param {number} props.maxRangeDays - Maximum number of days in range (default: 365)
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.disabled - Whether picker is disabled
 */
const DateRangePicker = ({
  value,
  onChange,
  onClear,
  minDate,
  maxDate = new Date(),
  maxRangeDays = 365,
  className,
  disabled = false,
  ...props
}) => {
  const [open, setOpen] = useState(false);
  const [tempRange, setTempRange] = useState(value || { from: null, to: null });
  const [error, setError] = useState(null);

  // Validate date range
  const validateRange = (range) => {
    if (!range.from || !range.to) {
      return null;
    }

    // Ensure from is before to
    if (range.from > range.to) {
      return "Start date must be before end date";
    }

    // Check maximum range
    const daysDiff = Math.ceil((range.to - range.from) / (1000 * 60 * 60 * 24));
    if (daysDiff > maxRangeDays) {
      return `Maximum range is ${maxRangeDays} days`;
    }

    // Check date boundaries
    if (minDate && range.from < startOfDay(minDate)) {
      return `Start date cannot be before ${format(minDate, "MMM dd, yyyy")}`;
    }

    if (maxDate && range.to > endOfDay(maxDate)) {
      return `End date cannot be after ${format(maxDate, "MMM dd, yyyy")}`;
    }

    return null;
  };

  const handleRangeChange = (newRange) => {
    setTempRange(newRange);

    // Validate when both dates are selected
    if (newRange.from && newRange.to) {
      const validationError = validateRange(newRange);
      setError(validationError);
    } else {
      setError(null);
    }
  };

  const handleApply = () => {
    if (!tempRange.from || !tempRange.to) {
      setError("Please select both start and end dates");
      return;
    }

    const validationError = validateRange(tempRange);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Normalize dates to start and end of day
    const normalizedRange = {
      from: startOfDay(tempRange.from),
      to: endOfDay(tempRange.to)
    };

    onChange?.(normalizedRange);
    setOpen(false);
    setError(null);
  };

  const handleClear = () => {
    setTempRange({ from: null, to: null });
    setError(null);
    onClear?.();
    setOpen(false);
  };

  const handleCancel = () => {
    setTempRange(value || { from: null, to: null });
    setError(null);
    setOpen(false);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value?.from && !value?.to && "text-muted-foreground"
            )}
            disabled={disabled}
            {...props}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
            {formatDateRange(value?.from, value?.to)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col space-y-2 p-3">
            {/* Calendar */}
            <Calendar
              mode="range"
              range={tempRange}
              onSelect={handleRangeChange}
              minDate={minDate}
              maxDate={maxDate}
              className="rounded-md border"
            />

            {/* Error Message */}
            {error && (
              <div className="text-xs text-red-600 dark:text-red-400 px-2">
                {error}
              </div>
            )}

            {/* Selected Range Display */}
            {tempRange.from && (
              <div className="text-sm text-center px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
                {tempRange.to
                  ? `${format(tempRange.from, "MMM dd, yyyy")} - ${format(tempRange.to, "MMM dd, yyyy")}`
                  : `From ${format(tempRange.from, "MMM dd, yyyy")}`}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-8"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="h-8"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={!tempRange.from || !tempRange.to || !!error}
                  className="h-8 bg-blue-600 hover:bg-blue-700"
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

DateRangePicker.displayName = "DateRangePicker";

export { DateRangePicker };
