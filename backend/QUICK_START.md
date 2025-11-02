# Quick Start Guide: Dynamic Credit Limits

## TL;DR

Your question: **"If I put $4000 it will reflect to all customers?"**

**Answer**: ✅ **YES** - After running the migration script, when you set Financial Policy to $4,000, all customers without custom limits will automatically use $4,000.

## 3-Step Setup

### Step 1: Run Migration (One-Time)

```bash
cd backend
source env/bin/activate  # Windows: env\Scripts\activate

# Preview changes first (recommended)
python migrate_credit_limits_to_dynamic.py --dry-run

# Apply migration
python migrate_credit_limits_to_dynamic.py
```

**What this does**: Converts customers with default $3,000 to use dynamic system default (`credit_limit = null`)

### Step 2: Set Financial Policy

1. Login as admin
2. Go to **Admin > Business Settings > Financial Policies**
3. Set **Customer Credit Limit** to $4,000 (minimum $3,000, maximum $50,000)
4. Save

**Note**: The system enforces a minimum of $3,000 for the default credit limit.

### Step 3: Done!

**All customers with `credit_limit = null` now use $4,000 automatically.**

## How It Works

### Without Migration
```
Customer A: credit_limit = 3000 (stored value)
Financial Policy: $4,000

Customer A sees: $3,000 ❌ (old stored value)
```

### After Migration
```
Customer A: credit_limit = null (use system default)
Financial Policy: $4,000

Customer A sees: $4,000 ✅ (dynamic fetch)
```

### When You Change Financial Policy
```
Before: Financial Policy = $4,000
        Customer A (credit_limit = null) → uses $4,000

Change: Financial Policy → $5,000

After:  Customer A (credit_limit = null) → uses $5,000 ✅ (instant update)
```

## Who Uses System Default vs Custom

### System Default (Affected by Financial Policy Changes)
- New customers (created after deployment)
- Migrated customers (with `credit_limit = null`)
- Any customer you reset to system default

### Custom Limits (NOT Affected by Financial Policy Changes)
- Customers with explicit dollar amounts set
- Example: Customer B has custom $10,000 limit
- Financial Policy changes don't affect them

## Testing

### Test 1: Change Financial Policy
```
1. Set Financial Policy to $4,000
2. Check customer with credit_limit = null
3. Should show $4,000 ✅

4. Change Financial Policy to $5,000
5. Check same customer
6. Should show $5,000 ✅
```

### Test 2: Custom Limit
```
1. Set customer to custom $8,000
2. Change Financial Policy to $6,000
3. Customer should still show $8,000 ✅ (not affected)
```

### Test 3: Reset to Default
```
1. Customer has custom $8,000
2. Reset to system default (leave field empty, save)
3. Customer now uses Financial Policy amount ✅
```

## Verification

### Check Migration Results
```bash
python migrate_credit_limits_to_dynamic.py --verify-only

# Output should show:
# Using System Default (credit_limit = None): 45
# Using Custom Limits: 105
```

### Check in Database
```javascript
// MongoDB shell
db.customers.countDocuments({ credit_limit: null })
// Returns count of customers using system default

db.customers.countDocuments({ credit_limit: { $ne: null } })
// Returns count of customers with custom limits
```

## Common Scenarios

### Scenario 1: "I want all customers to use $4,000"
1. Run migration script ✓
2. Set Financial Policy to $4,000 ✓
3. Done! All non-custom customers use $4,000

### Scenario 2: "I want to change default to $5,000"
1. Go to Financial Policy settings
2. Change to $5,000 (must be ≥ $3,000)
3. Save
4. Done! All non-custom customers immediately use $5,000

**Note**: You cannot set the default below $3,000. The system will reject values below this minimum.

### Scenario 3: "One customer needs special $10,000 limit"
1. Select customer
2. Set custom limit to $10,000
3. Save
4. This customer now uses $10,000 regardless of Financial Policy

### Scenario 4: "Customer no longer needs special limit"
1. Select customer
2. Reset to system default (leave field empty)
3. Save
4. Customer now uses current Financial Policy default

## Files to Review

- **IMPLEMENTATION_SUMMARY.md** - Complete technical overview
- **DYNAMIC_CREDIT_LIMITS.md** - Detailed documentation with troubleshooting
- **migrate_credit_limits_to_dynamic.py** - Migration script

## Support

Questions? Review these docs:
1. This file (QUICK_START.md) - Quick reference
2. IMPLEMENTATION_SUMMARY.md - Technical overview
3. DYNAMIC_CREDIT_LIMITS.md - Complete documentation

## Summary

✅ Run migration once → Customers use dynamic defaults
✅ Change Financial Policy → All non-custom customers update instantly
✅ Set custom limits → Those customers unaffected by Financial Policy changes
✅ Reset to default → Customer goes back to using Financial Policy dynamically

**Result**: True centralized management where your Financial Policy setting immediately affects all relevant customers.
