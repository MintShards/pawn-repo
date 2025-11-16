/**
 * Calendar Component (ShadCN UI)
 *
 * A date picker calendar component built with date-fns
 * Used for date range selection in trends and analytics
 */

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isAfter,
  isBefore,
  isWithinInterval,
  startOfDay
} from "date-fns";

/**
 * Calendar Component
 *
 * @param {Object} props
 * @param {Date} props.selected - Selected date
 * @param {Function} props.onSelect - Callback when date is selected
 * @param {Date} props.month - Current month being displayed
 * @param {Function} props.onMonthChange - Callback when month changes
 * @param {Object} props.range - Date range object { from: Date, to: Date }
 * @param {string} props.mode - Selection mode: 'single' or 'range'
 * @param {Date} props.minDate - Minimum selectable date
 * @param {Date} props.maxDate - Maximum selectable date
 * @param {string} props.className - Additional CSS classes
 */
const Calendar = ({
  selected,
  onSelect,
  month: controlledMonth,
  onMonthChange,
  range,
  mode = "single",
  minDate,
  maxDate,
  className,
  ...props
}) => {
  const [currentMonth, setCurrentMonth] = React.useState(
    controlledMonth || selected || new Date()
  );

  // Update current month when controlled month changes
  React.useEffect(() => {
    if (controlledMonth) {
      setCurrentMonth(controlledMonth);
    }
  }, [controlledMonth]);

  const handleMonthChange = (newMonth) => {
    setCurrentMonth(newMonth);
    onMonthChange?.(newMonth);
  };

  const handlePreviousMonth = () => {
    handleMonthChange(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    handleMonthChange(addMonths(currentMonth, 1));
  };

  const handleDateSelect = (date) => {
    if (mode === "range" && range) {
      // Range selection logic
      if (!range.from || (range.from && range.to)) {
        // Start new range
        onSelect?.({ from: date, to: null });
      } else if (isBefore(date, range.from)) {
        // Selected date is before start, set as new start
        onSelect?.({ from: date, to: null });
      } else {
        // Complete the range
        onSelect?.({ from: range.from, to: date });
      }
    } else {
      // Single date selection
      onSelect?.(date);
    }
  };

  const isDateDisabled = (date) => {
    const dateStart = startOfDay(date);
    if (minDate && isBefore(dateStart, startOfDay(minDate))) {
      return true;
    }
    if (maxDate && isAfter(dateStart, startOfDay(maxDate))) {
      return true;
    }
    return false;
  };

  const isDateSelected = (date) => {
    if (mode === "range" && range) {
      if (range.from && range.to) {
        return isWithinInterval(date, { start: range.from, end: range.to });
      }
      return range.from && isSameDay(date, range.from);
    }
    return selected && isSameDay(date, selected);
  };

  const isDateRangeStart = (date) => {
    return mode === "range" && range?.from && isSameDay(date, range.from);
  };

  const isDateRangeEnd = (date) => {
    return mode === "range" && range?.to && isSameDay(date, range.to);
  };

  const isDateInRange = (date) => {
    if (mode === "range" && range?.from && range?.to) {
      return isWithinInterval(date, { start: range.from, end: range.to });
    }
    return false;
  };

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = [];
  let day = startDate;

  while (day <= endDate) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className={cn("p-3", className)} {...props}>
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={handlePreviousMonth}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="text-sm font-medium">
          {format(currentMonth, "MMMM yyyy")}
        </div>

        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={handleNextMonth}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = isDateSelected(day);
          const isDisabled = isDateDisabled(day);
          const isRangeStart = isDateRangeStart(day);
          const isRangeEnd = isDateRangeEnd(day);
          const inRange = isDateInRange(day);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={index}
              onClick={() => !isDisabled && handleDateSelect(day)}
              disabled={isDisabled}
              className={cn(
                "relative h-8 w-full text-center text-sm rounded-md transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                !isCurrentMonth && "text-slate-400 dark:text-slate-600",
                isCurrentMonth && !isDisabled && "hover:bg-slate-100 dark:hover:bg-slate-800",
                isDisabled && "text-slate-300 dark:text-slate-700 cursor-not-allowed",
                isToday && !isSelected && "font-semibold text-blue-600 dark:text-blue-400",
                (isSelected || isRangeStart || isRangeEnd) && "bg-blue-600 text-white hover:bg-blue-700",
                inRange && !isRangeStart && !isRangeEnd && "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
              )}
              aria-label={format(day, "MMMM d, yyyy")}
              aria-selected={isSelected}
              aria-disabled={isDisabled}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
};

Calendar.displayName = "Calendar";

export { Calendar };
