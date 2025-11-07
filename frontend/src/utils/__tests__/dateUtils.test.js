import {
  formatCurrentDate,
  formatRelativeTime,
  formatShortDate,
  formatLongDate,
  formatDateTime,
  isToday,
  toISOString
} from '../dateUtils';

describe('dateUtils', () => {
  describe('formatCurrentDate', () => {
    it('should format current date with default timezone', () => {
      const result = formatCurrentDate();
      // Should match format: "Friday, November 7, 2025"
      expect(result).toMatch(/^\w+, \w+ \d{1,2}, \d{4}$/);
    });

    it('should format current date with specified timezone', () => {
      const result = formatCurrentDate('America/New_York');
      expect(result).toMatch(/^\w+, \w+ \d{1,2}, \d{4}$/);
    });
  });

  describe('formatRelativeTime', () => {
    it('should format recent timestamps', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = formatRelativeTime(fiveMinutesAgo);
      expect(result).toContain('ago');
    });

    it('should handle null/undefined timestamps', () => {
      expect(formatRelativeTime(null)).toBe('Unknown');
      expect(formatRelativeTime(undefined)).toBe('Unknown');
    });

    it('should handle invalid date strings', () => {
      const result = formatRelativeTime('invalid-date');
      expect(result).toBe('Invalid date');
    });

    it('should format ISO date strings', () => {
      const isoString = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const result = formatRelativeTime(isoString);
      expect(result).toContain('ago');
    });
  });

  describe('formatShortDate', () => {
    it('should format date as short string', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      const result = formatShortDate(date);
      expect(result).toBe('Jan 15, 2025');
    });

    it('should handle ISO strings', () => {
      const isoString = '2025-01-15T12:00:00Z';
      const result = formatShortDate(isoString);
      expect(result).toBe('Jan 15, 2025');
    });

    it('should handle null/undefined', () => {
      expect(formatShortDate(null)).toBe('Unknown');
      expect(formatShortDate(undefined)).toBe('Unknown');
    });

    it('should handle invalid dates', () => {
      const result = formatShortDate('not-a-date');
      expect(result).toBe('Invalid date');
    });
  });

  describe('formatLongDate', () => {
    it('should format date as long string', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      const result = formatLongDate(date);
      expect(result).toBe('January 15, 2025');
    });

    it('should handle ISO strings', () => {
      const isoString = '2025-01-15T12:00:00Z';
      const result = formatLongDate(isoString);
      expect(result).toBe('January 15, 2025');
    });

    it('should handle null/undefined', () => {
      expect(formatLongDate(null)).toBe('Unknown');
    });
  });

  describe('formatDateTime', () => {
    it('should format date with time', () => {
      const date = new Date('2025-01-15T14:30:00Z');
      const result = formatDateTime(date);
      // Should match format: "Jan 15, 2025 at 2:30 PM" (local time may vary)
      expect(result).toMatch(/\w{3} \d{1,2}, \d{4} at \d{1,2}:\d{2} (AM|PM)/);
    });

    it('should handle ISO strings', () => {
      const isoString = '2025-01-15T14:30:00Z';
      const result = formatDateTime(isoString);
      expect(result).toMatch(/\w{3} \d{1,2}, \d{4} at \d{1,2}:\d{2} (AM|PM)/);
    });

    it('should handle null/undefined', () => {
      expect(formatDateTime(null)).toBe('Unknown');
    });
  });

  describe('isToday', () => {
    it('should return true for today\'s date', () => {
      const today = new Date();
      expect(isToday(today)).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(isToday(yesterday)).toBe(false);
    });

    it('should return false for tomorrow', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      expect(isToday(tomorrow)).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(isToday(null)).toBe(false);
      expect(isToday(undefined)).toBe(false);
    });

    it('should handle ISO strings', () => {
      const todayISO = new Date().toISOString();
      expect(isToday(todayISO)).toBe(true);
    });
  });

  describe('toISOString', () => {
    it('should convert valid date to ISO string', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      const result = toISOString(date);
      expect(result).toBe('2025-01-15T12:00:00.000Z');
    });

    it('should return current ISO string for null/undefined', () => {
      const result = toISOString(null);
      // Should be a valid ISO string
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should return current ISO string for invalid date', () => {
      const result = toISOString(new Date('invalid'));
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});
