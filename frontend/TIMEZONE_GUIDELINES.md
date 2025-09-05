# 🕐 Timezone Guidelines for Pawn Shop System

## ⚠️ CRITICAL: Prevent Recurring Timezone Bugs

This document establishes mandatory guidelines to prevent timezone conversion bugs that have repeatedly occurred in the pawn shop system.

## 🎯 Core Problem

**Business operates in Pacific Time (America/Vancouver), but dates were displayed in user's browser timezone, causing incorrect date display and recurring bugs.**

**Example Bug**: Redemption at 10:38 PM Pacific on Sep 4 → stored as UTC `2025-09-05T05:38:35.030000` → displayed as "Sep 5, 2025" instead of correct "Sep 4, 2025"

## ✅ MANDATORY RULES

### Rule 1: Always Use Business Timezone Functions

```javascript
// ✅ CORRECT - Use business timezone functions
import { formatBusinessDate, formatRedemptionDate } from '../utils/timezoneUtils';

const displayDate = formatBusinessDate(utcDateString);
const redemptionDate = formatRedemptionDate(utcDateString);
```

```javascript
// ❌ WRONG - Don't use user timezone or direct Date formatting
const date = new Date(utcDateString);
const display = date.toLocaleDateString(); // Uses user's timezone!

// ❌ WRONG - Don't use formatLocalDate for business data
const display = formatLocalDate(utcDateString); // Uses user's timezone!
```

### Rule 2: Backend Sends UTC, Frontend Converts to Pacific

**Backend**: Always store and send dates in UTC format
**Frontend**: Always display business dates in Pacific Time using utilities

### Rule 3: Use the Correct Function for Each Use Case

| Use Case | Function | Example |
|----------|----------|---------|
| Transaction dates | `formatBusinessDate()` | "Sep 4, 2025" |
| Redemption dates | `formatRedemptionDate()` | "Sep 4, 2025" (with debug logging) |
| Date with time | `formatBusinessDateTime()` | "Sep 4, 2025, 10:38 PM PDT" |
| Current business time | `getBusinessNow()` | Current Pacific Time |

## 🛠️ Implementation Guide

### Step 1: Import Business Timezone Functions

```javascript
// In any component that displays business dates
import { 
  formatBusinessDate, 
  formatRedemptionDate, 
  formatBusinessDateTime 
} from '../utils/timezoneUtils';
```

### Step 2: Replace All Date Formatting

```javascript
// ✅ BEFORE (causes timezone bugs)
const formatDate = (dateString) => {
  return formatLocalDate(dateString); // User timezone!
};

// ✅ AFTER (business timezone)  
const formatDate = (dateString) => {
  return formatBusinessDate(dateString); // Pacific Time!
};
```

### Step 3: Specific Date Type Handlers

```javascript
// Redemption dates (extra logging for confidence)
const redemptionDate = formatRedemptionDate(rawRedemptionDate);

// Extension dates  
const extensionDate = formatBusinessDate(rawExtensionDate);

// Transaction created dates
const createdDate = formatBusinessDate(rawCreatedDate);

// Maturity dates
const maturityDate = formatBusinessDate(rawMaturityDate);
```

## 🚨 Common Mistakes to Avoid

### Mistake 1: Using User's Browser Timezone
```javascript
// ❌ WRONG - Different for each user's location
const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const display = new Intl.DateTimeFormat('en-US', { timeZone: userTz }).format(date);
```

### Mistake 2: Double Timezone Conversion
```javascript
// ❌ WRONG - Converting twice causes wrong dates
const utcDate = new Date(utcString + 'Z');
const pacificString = convertToPacific(utcDate); 
const display = formatLocalDate(pacificString); // Converts again!
```

### Mistake 3: Inconsistent Date Handling
```javascript
// ❌ WRONG - Some dates in user timezone, some in business timezone
const redemptionDate = formatLocalDate(redemption); // User timezone
const extensionDate = formatBusinessDate(extension); // Business timezone
// Results in inconsistent display!
```

## 📋 Code Review Checklist

When reviewing date-related code, check:

- [ ] All business dates use `formatBusinessDate()` or `formatRedemptionDate()`
- [ ] No direct usage of `formatLocalDate()` for transaction data
- [ ] No direct usage of `new Date().toLocaleDateString()` for business data
- [ ] Import statements include business timezone functions
- [ ] Timezone conversion is done only once (not double-converted)
- [ ] UTC strings properly handled with 'Z' suffix when needed

## 🔍 Testing Guidelines

### Manual Test Cases

1. **Cross-timezone Test**: Test from different browser timezones
   - Set browser to Eastern Time → dates should still show Pacific
   - Set browser to Mountain Time → dates should still show Pacific

2. **Redemption Date Test**: 
   - Redeem transaction late at night (after midnight UTC)
   - Verify redemption shows correct Pacific date, not next day

3. **Extension Date Test**:
   - Create extension late at night
   - Verify extension and redemption dates match when done same day

### Automated Test Suggestions

```javascript
describe('Timezone Consistency', () => {
  test('formatRedemptionDate converts UTC to Pacific correctly', () => {
    const utcDate = '2025-09-05T05:38:35.030000'; // 10:38 PM Sep 4 Pacific
    const result = formatRedemptionDate(utcDate);
    expect(result).toBe('Sep 4, 2025'); // NOT Sep 5
  });
  
  test('business dates consistent across components', () => {
    const utcDate = '2025-09-05T05:38:35.030000';
    const redemption = formatRedemptionDate(utcDate);
    const business = formatBusinessDate(utcDate);
    expect(redemption).toBe(business); // Same date
  });
});
```

## 📚 Reference

### Business Timezone Functions Location
`/frontend/src/utils/timezoneUtils.js` - Lines 195-323

### Key Constants
- `BUSINESS_TIMEZONE = 'America/Vancouver'`
- Business operates in Pacific Standard Time (PST) / Pacific Daylight Time (PDT)

### Updated Files in This Fix
- ✅ `/frontend/src/utils/timezoneUtils.js` - Added business timezone functions
- ✅ `/frontend/src/pages/TransactionHub.jsx` - Updated to use business timezone
- ✅ `/frontend/TIMEZONE_GUIDELINES.md` - This documentation

## 🔄 Future Updates

When adding new date displays:

1. **Always** use business timezone functions from `timezoneUtils.js`
2. **Never** use user timezone functions for business data
3. **Test** across different browser timezones
4. **Document** any special date handling requirements

## 📞 Emergency Response

If timezone bugs reoccur:

1. Check if new code uses `formatLocalDate()` instead of `formatBusinessDate()`
2. Verify imports include business timezone functions
3. Look for direct `new Date()` usage without timezone conversion
4. Test the specific date formatting in Pacific Time

---

**Remember: Business operates in Pacific Time. All business dates must display in Pacific Time regardless of user's location.**